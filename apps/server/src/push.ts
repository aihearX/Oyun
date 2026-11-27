/**
 * Anlık bildirimler (1.3.0). Cihaz Expo bildirim anahtarını 'push.register' ile bağlar; sunucu ücretsiz Expo Push API'sine
 * (https://exp.host/--/api/v2/push/send, istekte en çok 100 ileti) gönderir. Anahtar yoksa, tür kapalıysa ya da kural izin
 * vermiyorsa hiçbir şey gitmez; gönderim hatası oyunu hiç etkilemez.
 *
 * Denge (PUSH_KURALLARI, sahip isteği "aşırı bildirime boğmak istemem"):
 * - Oyun açıkken (bağlı ve önde) bildirim gitmez: oyuncu zaten oyunda görür. Uygulama arka plana geçince istemci 'push.away' der.
 * - Özel mesaj her zaman gider (tür açıksa): sessiz saat ve günlük sınır yok. Sessize alınan ya da engellenen kişiden hiç gitmez.
 * - Diğer türler İstanbul saatiyle 23.00 ile 08.00 arasında gitmez (bekletilmez, sabaha ertelenmez); arkadaş ve başvuru bildirimleri
 *   günde en çok 5 tanedir (takım sohbeti bu sınıra girmez, 60 sn toplama onu sınırlar).
 * - Takım sohbeti: yalnız oyuncunun yazdığı mesaj (otomatik kart ve sistem satırı değil), yazana gitmez. Bir bildirimden sonra
 *   60 saniye içinde gelenler beklenir, pencere bitince "Takım sohbetinde N yeni mesaj" özeti gider (zamanlayıcı pushSweep).
 * - Arkadaş hediyesi günde tek bildirim.
 * - iOS'ta konuşma başına gruplama (threadId); uygulama simgesine sayı yazılmaz.
 */
import { DM_STICKERS, PUSH_KATEGORILER, PUSH_KURALLARI, PUSH_VARSAYILAN, type ChatMessage, type DmMessage, type PushKategori, type PushSettings, type PushVeri } from '@odi/shared';
import { parseJson, type App, type Handlers, type PlayerRow } from './app';
import { dayKey, istanbulOffsetMs } from './time';

// ------------------------------------------------------------------ taşıma (Expo Push API; testte sahte)
export interface PushMesaj {
  to: string; title: string; body: string; data: PushVeri; sound: 'default'; priority: 'high'; channelId: string; threadId?: string;
}
export type PushBilet = { status: 'ok'; id: string } | { status: 'error'; message?: string; details?: { error?: string } };
export type PushMakbuz = { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };
export interface PushTransport {
  /** iletiler (en çok 100) → aynı sırada bilet */
  send(msgs: PushMesaj[]): Promise<PushBilet[]>;
  /** bilet kimlikleri (en çok 1000) → makbuz */
  receipts?(ids: string[]): Promise<Record<string, PushMakbuz>>;
}
/** Android bildirim kanalı (istemci aynı kimlikle kurar: apps/mobile/src/bildirim.ts) */
export const PUSH_KANAL = 'varsayilan';
const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';
const PARCA = 100;
const MAKBUZ_PARCA = 1000;
/** makbuzlar biletten en az bu kadar sonra sorulur (Expo önerisi: ~15 dk) */
const MAKBUZ_BEKLE_MS = 15 * 60_000;
/** oyuncu başına en çok cihaz anahtarı (eskiler düşer) */
const CIHAZ_MAX = 5;
export const PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;

/** Expo Push API (ücretsiz). EXPO_ACCESS_TOKEN ortam değişkeni verilirse (isteğe bağlı "gelişmiş güvenlik") başlığa eklenir. */
export function expoTransport(accessToken?: string): PushTransport {
  const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) };
  return {
    async send(msgs) {
      const r = await fetch(EXPO_SEND, { method: 'POST', headers, body: JSON.stringify(msgs), signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => null) as { data?: PushBilet[]; errors?: { message?: string }[] } | null;
      if (!r.ok || !Array.isArray(j?.data)) throw new Error(`Expo push ${r.status}: ${j?.errors?.[0]?.message ?? 'yanıt yok'}`);
      return j.data;
    },
    async receipts(ids) {
      const r = await fetch(EXPO_RECEIPTS, { method: 'POST', headers, body: JSON.stringify({ ids }), signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => null) as { data?: Record<string, PushMakbuz> } | null;
      if (!r.ok || !j?.data) throw new Error(`Expo makbuz ${r.status}`);
      return j.data;
    },
  };
}

// ------------------------------------------------------------------ bellek durumu (uygulama başına)
interface Durum {
  kuyruk: PushMesaj[];
  calisiyor: Promise<void> | null;
  /** bilet kimliği → anahtar, zaman (makbuz kontrolü) */
  biletler: Map<string, { token: string; at: number }>;
  /** takım sohbeti birleştirme: oyuncu → son bildirim anı, bekleyen ileti sayısı, takım */
  takim: Map<string, { son: number; bekleyen: number; teamId: string }>;
  makbuzSorgu: boolean;
}
const durumlar = new WeakMap<App, Durum>();
function durum(app: App): Durum {
  let d = durumlar.get(app);
  if (!d) { d = { kuyruk: [], calisiyor: null, biletler: new Map(), takim: new Map(), makbuzSorgu: false }; durumlar.set(app, d); }
  return d;
}
const transport = (app: App) => app.cfg.push ?? null;

function sil(app: App, token: string): void {
  try { app.db.run('DELETE FROM push_tokens WHERE token = ?', token); } catch { /* kapanıyor */ }
}

function kuyrugaEkle(app: App, msgs: PushMesaj[]): void {
  const d = durum(app);
  d.kuyruk.push(...msgs);
  if (!d.calisiyor) d.calisiyor = new Promise<void>((r) => setImmediate(r)).then(() => bosalt(app)).finally(() => { d.calisiyor = null; });
}
async function bosalt(app: App): Promise<void> {
  const t = transport(app); const d = durum(app);
  while (d.kuyruk.length) {
    const parca = d.kuyruk.splice(0, PARCA);
    if (!t) continue;
    try {
      const biletler = await t.send(parca);
      biletler.forEach((b, i) => {
        const to = parca[i]?.to; if (!to) return;
        if (b.status === 'ok') { if (t.receipts) d.biletler.set(b.id, { token: to, at: app.now() }); }
        else if (b.details?.error === 'DeviceNotRegistered') sil(app, to);
      });
    } catch (e) { if (app.cfg.log) console.error('[bildirim]', (e as Error).message); }
  }
}
/** gönderim kuyruğu boşalana kadar bekle (testler, kapanış) */
export async function pushBekle(app: App): Promise<void> {
  for (let i = 0; i < 10 && durum(app).calisiyor; i++) await durum(app).calisiyor;
}
/** makbuzlar: Expo "cihaz kayıtlı değil" dediyse anahtar silinir (uygulama kaldırıldı, izin kapandı) */
async function makbuzlar(app: App): Promise<void> {
  const t = transport(app); const d = durum(app);
  if (!t?.receipts || d.makbuzSorgu) return;
  const sinir = app.now() - MAKBUZ_BEKLE_MS;
  const ids = [...d.biletler].filter(([, v]) => v.at <= sinir).map(([k]) => k).slice(0, MAKBUZ_PARCA);
  if (!ids.length) return;
  d.makbuzSorgu = true;
  try {
    const m = await t.receipts(ids);
    for (const id of ids) {
      const b = d.biletler.get(id); d.biletler.delete(id);
      const r = m[id];
      if (b && r?.status === 'error' && r.details?.error === 'DeviceNotRegistered') sil(app, b.token);
    }
  } catch (e) {
    if (app.cfg.log) console.error('[bildirim makbuz]', (e as Error).message);
    // bir gün içinde sorulamayan biletler bırakılır (bellek büyümesin)
    for (const [k, v] of d.biletler) if (v.at < app.now() - 86_400_000) d.biletler.delete(k);
  } finally { d.makbuzSorgu = false; }
}

// ------------------------------------------------------------------ ayarlar ve anahtarlar
interface AyarRow { dm: number; takim: number; arkadas: number; basvuru: number }
export function pushAyar(app: App, pid: string): PushSettings {
  const r = app.db.get<AyarRow>('SELECT dm, takim, arkadas, basvuru FROM push_settings WHERE player_id = ?', pid);
  if (!r) return { ...PUSH_VARSAYILAN };
  return { dm: !!r.dm, takim: !!r.takim, arkadas: !!r.arkadas, basvuru: !!r.basvuru };
}
const hicbiri = (s: PushSettings) => PUSH_KATEGORILER.every((k) => !s[k]);
const anahtarlar = (app: App, pid: string) => app.db.all<{ token: string }>('SELECT token FROM push_tokens WHERE player_id = ? ORDER BY at DESC', pid).map((r) => r.token);

/** oyuncu oyunda mı: bağlı ve uygulama önde (arka plandaki açık bağlantı sayılmaz) */
export const oyunda = (app: App, pid: string) => { const c = app.online.get(pid); return !!c && !c.away; };
/** İstanbul saatiyle 23.00 ile 08.00 arası */
export function sessizSaat(t: number): boolean {
  const h = new Date(t + istanbulOffsetMs(t)).getUTCHours();
  return h >= PUSH_KURALLARI.sessizBas || h < PUSH_KURALLARI.sessizBit;
}
/** alıcı göndereni sessize aldı ya da engelledi mi */
function susturdu(app: App, alici: string, gonderen: string): boolean {
  if (app.db.get('SELECT 1 AS x FROM blocks WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', alici, gonderen, gonderen, alici)) return true;
  const muted = app.db.get<{ muted: string }>('SELECT muted FROM players WHERE id = ?', alici)?.muted;
  return parseJson<string[]>(muted ?? '[]', []).includes(gonderen);
}
const kisalt = (s: string, n: number = PUSH_KURALLARI.metinMax) => { const t = s.replace(/\s+/g, ' ').trim(); return [...t].length > n ? `${[...t].slice(0, n - 1).join('').trimEnd()}…` : t; };

interface Bildirim { title: string; body: string; data: PushVeri; threadId?: string }
/**
 * Tek oyuncuya bildirim (bütün kurallar burada). İşlem (app.run) içinde çağrılır: günlük sayaç aynı işlemde yazılır, ileti işlem
 * başarıyla bitince kuyruğa girer. Dönüş: gönderildi mi.
 */
export function bildir(app: App, pid: string, kat: PushKategori, b: Bildirim): boolean {
  if (!transport(app)) return false;
  const tokens = anahtarlar(app, pid);
  if (!tokens.length || !pushAyar(app, pid)[kat] || oyunda(app, pid)) return false;
  if (kat !== 'dm') {
    if (sessizSaat(app.now())) return false;
    // takım sohbeti oyuncunun kendi açtığı tür: günlük sınıra girmez (60 sn toplama zaten sınırlar), arkadaş isteğini de yemez
    if (kat !== 'takim') {
      const day = dayKey(app.now());
      if (app.dailyCount(pid, day, 'push') >= PUSH_KURALLARI.gunlukSinir) return false;
      app.dailyInc(pid, day, 'push');
    }
  }
  const msgs: PushMesaj[] = tokens.map((to) => ({
    to, title: kisalt(b.title, 60), body: kisalt(b.body), data: b.data, sound: 'default', priority: 'high', channelId: PUSH_KANAL, ...(b.threadId ? { threadId: b.threadId } : {}),
  }));
  app.after(() => kuyrugaEkle(app, msgs));
  return true;
}

// ------------------------------------------------------------------ olaylar (küçük çağrılar: dm.ts, chat.ts, friends.ts, teamapply.ts, yonetici-ekran.ts)
/** özel mesajın bildirimdeki metni (hazır söz ve emoji metin olarak) */
export function dmMetni(m: Pick<DmMessage, 'kind' | 'text'>): string {
  if (m.kind === 'sticker') { const s = DM_STICKERS.find((x) => x.id === m.text); return s ? `${s.emoji} ${s.label}` : 'Çıkartma gönderdi'; }
  return m.text;
}
export function pushDm(app: App, from: PlayerRow, to: string, m: DmMessage): void {
  if (susturdu(app, to, from.id)) return;
  bildir(app, to, 'dm', { title: from.name, body: dmMetni(m), data: { kind: 'dm', id: from.id }, threadId: `dm:${from.id}` });
}

/** takım sohbetinde oyuncunun yazdığı mesaj (chat.send); otomatik kartlar ve sistem satırları buraya gelmez */
export function pushTakim(app: App, teamId: string, msg: ChatMessage): void {
  if (!transport(app) || msg.from === 'sistem') return;
  const d = durum(app); const now = app.now();
  const adi = app.team(teamId)?.name ?? 'Takım sohbeti';
  for (const id of app.teamMemberIds(teamId)) {
    if (id === msg.from || oyunda(app, id) || !pushAyar(app, id).takim || susturdu(app, id, msg.from)) continue;
    const st = d.takim.get(id);
    // pencere içinde: beklet, pencere bitince tek özet (pushSweep)
    if (st && st.teamId === teamId && now - st.son < PUSH_KURALLARI.takimPencereMs) { st.bekleyen++; continue; }
    if (bildir(app, id, 'takim', { title: adi, body: `${msg.name}: ${msg.text}`, data: { kind: 'takim', id: teamId }, threadId: `takim:${teamId}` })) {
      d.takim.set(id, { son: now, bekleyen: 0, teamId });
    }
  }
}

/** zamanlayıcı: penceresi biten takım özetleri; eski makbuzlar */
export function pushSweep(app: App): void {
  const d = durum(app); const now = app.now();
  for (const [pid, st] of d.takim) {
    if (now - st.son < PUSH_KURALLARI.takimPencereMs) continue;
    if (st.bekleyen <= 0) { d.takim.delete(pid); continue; }
    const n = st.bekleyen; st.bekleyen = 0;
    const p = app.playerOrNull(pid);
    if (!p || p.team_id !== st.teamId) { d.takim.delete(pid); continue; }
    const adi = app.team(st.teamId)?.name ?? 'Takım sohbeti';
    if (bildir(app, pid, 'takim', { title: adi, body: `Takım sohbetinde ${n} yeni mesaj`, data: { kind: 'takim', id: st.teamId }, threadId: `takim:${st.teamId}` })) st.son = now;
    else d.takim.delete(pid);
  }
  if (transport(app)?.receipts && d.biletler.size) void makbuzlar(app);
}

export function pushArkadasIstegi(app: App, from: PlayerRow, to: string): void {
  if (susturdu(app, to, from.id)) return;
  bildir(app, to, 'arkadas', { title: 'Arkadaşlık isteği', body: `${from.name} sana arkadaşlık isteği gönderdi.`, data: { kind: 'arkadas', id: from.id }, threadId: 'arkadas' });
}
export function pushArkadasKabul(app: App, by: PlayerRow, to: string): void {
  if (susturdu(app, to, by.id)) return;
  bildir(app, to, 'arkadas', { title: 'Yeni arkadaş', body: `${by.name} arkadaşlık isteğini kabul etti.`, data: { kind: 'arkadas', id: by.id }, threadId: 'arkadas' });
}
/** arkadaş hediyesi: günde tek bildirim (ilk hediye; sonrakiler ödül kutusunda) */
export function pushArkadasHediyesi(app: App, from: PlayerRow, to: string): void {
  if (susturdu(app, to, from.id)) return;
  const day = dayKey(app.now());
  if (app.dailyCount(to, day, 'push_hediye') > 0) return;
  if (bildir(app, to, 'arkadas', { title: 'Arkadaş hediyesi', body: `${from.name} sana hediye gönderdi. Ödül kutuna bak.`, data: { kind: 'odul', id: '' }, threadId: 'odul' })) app.dailyInc(to, day, 'push_hediye');
}
/** ödül kutusuna gelen hediye (ODİ'den hediye ya da kilit hediyesi) */
export function pushHediye(app: App, to: string, kilit: boolean, not?: string): void {
  bildir(app, to, 'arkadas', kilit
    ? { title: 'Kilit hediyesi', body: 'Ödül kutunda sana bir kilit hediyesi var. Alınca yeni yerler açılır.', data: { kind: 'odul', id: '' }, threadId: 'odul' }
    : { title: not || 'Sana bir hediye var', body: 'Ödül kutunda seni bekleyen bir hediye var.', data: { kind: 'odul', id: '' }, threadId: 'odul' });
}
/** herkese hediye: bildirim anahtarı olan (silinmemiş) her oyuncuya */
export function pushHediyeHerkese(app: App, not?: string): void {
  if (!transport(app)) return;
  for (const r of app.db.all<{ player_id: string }>('SELECT DISTINCT player_id FROM push_tokens WHERE player_id NOT IN (SELECT player_id FROM deleted_players)')) pushHediye(app, r.player_id, false, not);
}
/** takıma başvuru: lider ve yardımcılara */
export function pushBasvuru(app: App, from: PlayerRow, teamId: string, teamName: string, onaylayanlar: string[]): void {
  for (const id of onaylayanlar) {
    if (susturdu(app, id, from.id)) continue;
    bildir(app, id, 'basvuru', { title: 'Takım başvurusu', body: `${from.name} ${teamName} takımına katılmak istiyor.`, data: { kind: 'basvuru', id: teamId }, threadId: `basvuru:${teamId}` });
  }
}

/** hesap başka cihaza geçti (kurtarma): eski cihazların anahtarları silinir, yeni cihaz bağlanınca kendi anahtarını yazar */
export function pushAnahtarlariSil(app: App, pid: string): void {
  app.db.run('DELETE FROM push_tokens WHERE player_id = ?', pid);
}

// ------------------------------------------------------------------ işlemler
export const pushHandlers: Handlers = {
  'push.register': (app, s, { token, platform }) => {
    const settings = pushAyar(app, s.pid);
    // bütün türler kapalıysa anahtar tutulmaz (gizlilik metni: bildirimler kapatılınca silinir)
    if (hicbiri(settings)) { app.db.run('DELETE FROM push_tokens WHERE token = ?', token); return { settings }; }
    app.db.run('INSERT INTO push_tokens(token, player_id, platform, at) VALUES(?, ?, ?, ?) ON CONFLICT(token) DO UPDATE SET player_id = excluded.player_id, platform = excluded.platform, at = excluded.at',
      token, s.pid, platform, app.now());
    const fazla = anahtarlar(app, s.pid).slice(CIHAZ_MAX);
    for (const t of fazla) app.db.run('DELETE FROM push_tokens WHERE token = ?', t);
    return { settings };
  },
  'push.unregister': (app, s, { token }) => {
    app.db.run('DELETE FROM push_tokens WHERE token = ? AND player_id = ?', token, s.pid);
    return {};
  },
  'push.settings': (app, s, d) => {
    const cur = pushAyar(app, s.pid);
    if (!PUSH_KATEGORILER.some((k) => typeof d[k] === 'boolean')) return { settings: cur };
    const yeni: PushSettings = { ...cur };
    for (const k of PUSH_KATEGORILER) if (typeof d[k] === 'boolean') yeni[k] = d[k];
    app.db.run(`INSERT INTO push_settings(player_id, dm, takim, arkadas, basvuru, at) VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET dm = excluded.dm, takim = excluded.takim, arkadas = excluded.arkadas, basvuru = excluded.basvuru, at = excluded.at`,
    s.pid, +yeni.dm, +yeni.takim, +yeni.arkadas, +yeni.basvuru, app.now());
    if (hicbiri(yeni)) pushAnahtarlariSil(app, s.pid);
    if (!yeni.takim) durum(app).takim.delete(s.pid);
    return { settings: yeni };
  },
  'push.away': (_app, s, { away }) => {
    s.conn.away = away;
    return {};
  },
};
