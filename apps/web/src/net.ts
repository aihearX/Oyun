/**
 * Sosyal katman bağlantısı: tek @odi/net istemcisi (uygulama genelinde), çevrimdışı kuyruk, ekonomi eşitleme.
 * Sunucu yoksa oyun tamamen çevrimdışı oynanır; bot modunda hiç başlatılmaz (window.__odi sözleşmesi aynı kalır).
 *
 * Ekonomi kuralı: bağlıyken sunucu cüzdanı tek doğru kaynaktır. Yerel `coins` = sunucu jetonu + bekleyenler
 * (kuyruktaki bölüm jetonları + gönderilmemiş yerel ödüller − gönderilmemiş harcamalar).
 */
import { create } from 'zustand';
import { createClient, NetError, newRunId, type NetClient } from '@odi/net';
import { bindNet, useNet } from '@odi/net/store';
import { CAMP_CHEERS, LOCAL_JETON_DAILY_MAX, WAR_REGIONS, type CampState, type InboxItem, type LevelSpec, type OpMap, type ProgressAck, type ProgressSubmit, type RunResult } from '@odi/shared';
import { COSMETICS, SKILL_TREE, CARDS, campLevelCosmetics, earnedCampCosmetics } from '@odi/content';
import { bindEvents } from './events/store';
import { platform } from './platform';
import { ownsSkill, useStore, type Toast } from './store';
import { bindFriends } from './friends/state';
import { bindComm } from './comm/state';
import { bindTeamRace } from './teamrace/state';
import { bindCodes } from './codes/Codes';
import { bindTeamApply } from './screens/team/apply';
import { bindOdiColor } from './look';
import { bindKg } from './camp/gorev/state';

const K = { token: 'odi.net.token', queue: 'odi.net.queue', outbox: 'odi.net.outbox', sent: 'odi.net.sent' } as const;
const MECHANICS = new Set(['kosu', 'yuzme', 'trambolin', 'makine', 'impuls', 'ruya', 'boss']);
const NET_CODES = new Set(['CEVRIMDISI', 'ZAMAN_ASIMI', 'KOPTU', 'HIZ', 'KAPALI']);

type OutItem = { k: 'local'; ledgerId: string; jeton: number; reason: string } | { k: 'spend'; id: string; jeton: number; reason: string };

export interface LastRun { runId: string; state: 'gonderiliyor' | 'kuyrukta' | 'tamam' | 'hata' | 'yok'; ack?: ProgressAck; error?: string; biome: string; level: number; completed: boolean }
interface SocialState {
  /** sunucu adresi var mı (yoksa sosyal katman kapalı) */
  enabled: boolean;
  /** en az bir kez bağlanmaya çalışıldı mı (iskelet yerine hata kartı göstermek için) */
  tried: boolean;
  queued: number; queuedCoins: number;
  outbox: OutItem[];
  lastRun: LastRun | null;
  bonuses: OpMap['me.bonuses']['res'] | null;
  /** takma ad kartı bu oturumda ertelendi mi */
  onboardDismissed: boolean;
}
export const useSocial = create<SocialState>()(() => ({ enabled: false, tried: false, queued: 0, queuedCoins: 0, outbox: [], lastRun: null, bonuses: null, onboardDismissed: false }));

let client: NetClient | null = null;
export const getNet = () => client;

const store = () => platform().storage;
async function readJson<T>(k: string, d: T): Promise<T> { try { const v = await store().getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } }
const writeJson = (k: string, v: unknown) => { void store().setItem(k, JSON.stringify(v)).catch(() => undefined); };

export function toast(icon: string, title: string, text?: string, tone: Toast['tone'] = 'accent'): void {
  useStore.setState((s) => ({ toasts: [...s.toasts, { id: Date.now() + Math.random(), icon, title, text, tone }] }));
}
/** Türkçe hata metni */
export function errText(e: unknown): string {
  if (e instanceof NetError) {
    if (e.code === 'CEVRIMDISI' || e.code === 'KOPTU' || e.code === 'KAPALI') return 'Sunucuya bağlı değilsin. Bağlantı gelince tekrar dene.';
    if (e.code === 'ZAMAN_ASIMI') return 'Sunucu geç yanıt verdi; bir daha dener misin?';
    return e.message;
  }
  return 'Bir şeyler ters gitti; bir daha dener misin?';
}
/** isteği çalıştır, hata olursa nazik bir bildirim göster; başarısızsa null */
export async function act<O extends keyof OpMap>(op: O, data: OpMap[O]['req']): Promise<OpMap[O]['res'] | null> {
  if (!client) { toast('📡', 'Sosyal özellikler kapalı', 'Sunucu adresi yok.'); return null; }
  try { return await client.call(op, data); } catch (e) { platform().haptic('error'); toast('🙈', 'Olmadı', errText(e), 'bronze'); return null; }
}

// ------------------------------------------------------------------ ekonomi eşitleme
function pendingJeton(): number {
  const s = useSocial.getState();
  return s.queuedCoins + s.outbox.reduce((a, o) => a + (o.k === 'local' ? o.jeton : -o.jeton), 0);
}
function mirrorCoins(): void {
  const n = useNet.getState();
  if (n.status !== 'bağlı' || !n.wallet) return;
  const coins = Math.max(0, n.wallet.jeton + pendingJeton());
  if (useStore.getState().coins !== coins) useStore.setState({ coins });
}
export const usePending = () => useSocial((s) => s.queuedCoins + s.outbox.reduce((a, o) => a + (o.k === 'local' ? o.jeton : -o.jeton), 0));

let sent = new Set<string>();
const ledgerKey = (at: number, reason: string) => `${at}:${reason}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);
/** yerel deftere yazılan meta ödüllerinin jetonunu sunucuya kuyrukla (bölüm jetonu progress.submit ile gider) */
function scanLedger(): void {
  const ledger = useStore.getState().meta.ledger;
  const add: OutItem[] = [];
  for (const g of ledger) {
    if (g.reason.startsWith('bolum:') || g.reason.startsWith('sunucu:')) continue;
    const jeton = g.items.filter((i) => i.kind === 'jeton').reduce((a, i) => a + i.amount, 0);
    const id = ledgerKey(g.at, g.reason);
    if (jeton <= 0 || sent.has(id)) continue;
    sent.add(id); add.push({ k: 'local', ledgerId: id, jeton, reason: g.reason.slice(0, 60) });
  }
  if (!add.length) return;
  writeJson(K.sent, [...sent].slice(-300));
  setOutbox([...useSocial.getState().outbox, ...add]);
}
function setOutbox(outbox: OutItem[]): void { useSocial.setState({ outbox }); writeJson(K.outbox, outbox); mirrorCoins(); void flushOutbox(); }

let flushing = false;
async function flushOutbox(): Promise<void> {
  if (flushing || !client || client.status !== 'bağlı') return;
  flushing = true;
  try {
    while (client.status === 'bağlı') {
      const item = useSocial.getState().outbox[0];
      if (!item) break;
      try {
        if (item.k === 'local') {
          const r = await client.call('wallet.local', { ledgerId: item.ledgerId, jeton: item.jeton, reason: item.reason });
          if (item.reason === 'devir') { if (r.credited > 0) toast('🪙', 'Cihazdaki jetonların hesabında', `${r.credited} jeton aktarıldı.`, 'green'); }
          else if (r.credited < item.jeton) toast('🪙', 'Bugünkü ödül sınırı doldu', `Görev ve sandık jetonlarında günlük üst sınır ${LOCAL_JETON_DAILY_MAX}. ${item.jeton - r.credited} jeton hesaba eklenmedi.`, 'bronze');
        } else {
          const r = await client.call('wallet.spend', { jeton: item.jeton, reason: item.reason });
          applyServerSkills(r.skills);
        }
      } catch (e) {
        if (e instanceof NetError && NET_CODES.has(e.code)) break;
        // sunucu reddettiyse (ör. zaten alınmış yetenek) kayıt atılır; kuyruk takılmaz
      }
      const rest = useSocial.getState().outbox.slice(1);
      useSocial.setState({ outbox: rest }); writeJson(K.outbox, rest);
      mirrorCoins();
    }
  } finally { flushing = false; }
}

/** sunucudaki yetenekleri yerel yetenek ağacına işle (yalnızca ekler) */
function applyServerSkills(ids: string[]): void {
  const s = useStore.getState();
  const skills = { ...s.skills } as Record<string, number | boolean>;
  let changed = false;
  for (const id of ids) {
    const node = SKILL_TREE.find((n) => n.id === id);
    if (!node || ownsSkill(s.skills, id)) continue;
    const cur = skills[node.key];
    skills[node.key] = typeof cur === 'number' ? Math.max(cur, node.level ?? 1) : true;
    changed = true;
  }
  if (changed) useStore.setState({ skills: skills as unknown as typeof s.skills });
}

/** Yetenek satın alma: bağlıyken sunucu doğrular; çevrimdışıyken yerelde alınır ve harcama kuyruğa yazılır. */
export async function buySkill(id: string): Promise<boolean> {
  const node = SKILL_TREE.find((n) => n.id === id); if (!node) return false;
  if (client && client.status === 'bağlı') {
    const r = await act('wallet.spend', { jeton: node.cost, reason: `yetenek:${id}` });
    if (!r) return false;
    applyServerSkills(r.skills);
    return true;
  }
  const ok = useStore.getState().buySkill(id);
  if (ok && client) setOutbox([...useSocial.getState().outbox, { k: 'spend', id, jeton: node.cost, reason: `yetenek:${id}` }]);
  return ok;
}

/** sunucudan gelen kozmetik/kart/kalkanı yerel meta'ya işle (jetonsuz; jeton cüzdandan yansır) */
export function applyServerItems(items: Pick<InboxItem, 'kind' | 'amount' | 'ref'>[]): void {
  const s = useStore.getState();
  const owned = new Set(s.meta.cosmetics.owned); const cards = new Set(s.meta.cards);
  let shields = s.teamShields; let changed = false;
  for (const it of items) {
    if (it.kind === 'kozmetik' && it.ref && COSMETICS.some((c) => c.id === it.ref) && !owned.has(it.ref)) { owned.add(it.ref); changed = true; }
    else if (it.kind === 'kart' && it.ref && CARDS.some((c) => c.id === it.ref) && !cards.has(it.ref)) { cards.add(it.ref); changed = true; }
    else if (it.kind === 'kalkan' && it.amount > 0) { shields += it.amount; changed = true; }
  }
  if (!changed) return;
  useStore.getState().applyServerMeta({ cosmetics: [...owned], cards: [...cards], teamShields: shields });
}

/** kamp bina seviyesiyle açılan kozmetikler (sunucu da profiline yazar; burada beklemeden yerel Dolap'a eklenir) */
function syncCampUnlocks(camp: CampState): void {
  const lv = (b: string) => camp.buildings.find((x) => x.id === b)?.level ?? 0;
  // bina seviyesiyle ve Kamp Seviyesiyle açılan kozmetikler (sunucu verir; burada Dolap'a hemen yansır)
  const ids = [...earnedCampCosmetics(lv), ...campLevelCosmetics(camp.xp?.level ?? 0)]; const s = useStore.getState();
  if (ids.some((id) => !s.meta.cosmetics.owned.includes(id))) s.applyServerMeta({ cosmetics: ids, cards: [], teamShields: s.teamShields });
}

// ------------------------------------------------------------------ bölüm sonu
const sanitizeMechanic = (m: string) => (MECHANICS.has(m) ? m : 'kosu') as ProgressSubmit['mechanic'];
/** Her koşu sunucuya gider (çevrimdışıysa kalıcı kuyruğa). Dönen runId sonuç ekranında katkı satırlarını eşler. */
export function submitRun(spec: LevelSpec, r: RunResult, raceId?: string): string {
  const runId = newRunId();
  const base: LastRun = { runId, state: 'gonderiliyor', biome: spec.biome, level: spec.number, completed: r.completed };
  if (!client) { useSocial.setState({ lastRun: { ...base, state: 'yok' } }); return runId; }
  const data: ProgressSubmit = {
    runId, level: spec.number, completed: r.completed, stars: r.completed ? r.stars : 0, score: Math.max(0, Math.min(50_000, Math.round(r.score))),
    timeSec: Math.max(5, Math.min(3600, Math.round(r.timeSec))), coins: Math.max(0, Math.min(400, Math.round(r.coins))),
    biome: spec.biome as ProgressSubmit['biome'], mechanic: sanitizeMechanic(spec.mechanic), ...(raceId ? { raceId } : {}),
    // altın koklea (Takım Akışı kartı): bölümün bildirdiği sayı, 0-3
    ...(r.completed && Number(r.extra?.cochleas) > 0 ? { cochleas: Math.max(0, Math.min(3, Math.floor(Number(r.extra?.cochleas)))) } : {}),
    // Tedavi Odası: bölümde kullanılan malzemeler (sunucu envanterden bir kez düşer); yarışta malzeme yok
    ...(!raceId && r.remediesUsed?.length ? { remediesUsed: r.remediesUsed.filter((u) => u.count > 0).slice(0, 12).map((u) => ({ id: u.id, count: Math.min(9, Math.floor(u.count)) })) } : {}),
  };
  useSocial.setState({ lastRun: { ...base, state: client.status === 'bağlı' ? 'gonderiliyor' : 'kuyrukta' } });
  const set = (p: Partial<LastRun>) => useSocial.setState((s) => (s.lastRun?.runId === runId ? { lastRun: { ...s.lastRun, ...p } } : {}));
  client.submitProgress(data).then((ack) => {
    set({ state: 'tamam', ack });
    if (useNet.getState().team) { void client?.call('raid.state', {}).then((x) => useNet.setState({ raid: x.raid })).catch(() => undefined); }
  }, (e) => set({ state: 'hata', error: errText(e) }));
  return runId;
}

/** savaş hedeflerine göre bu biyomun puanının yazılacağı bölge (sunucudaki kuralın aynısı) */
export function regionForBiome(targets: string[], biome: string): { id: string; name: string } | null {
  for (const id of targets) { const r = WAR_REGIONS.find((x) => x.id === id); if (r && id !== 'merkez' && r.biomes.includes(biome)) return r; }
  return targets.includes('merkez') ? WAR_REGIONS.find((r) => r.id === 'merkez')! : null;
}

// ------------------------------------------------------------------ başlatma
async function onConnected(c: NetClient): Promise<void> {
  // çevrimdışı ilerlemeyi hesaba taşı (yalnızca açık bölüm ve yıldız; ödül vermez) — kuyruktan önce gitsin diye ilk istek
  const s = useStore.getState(); const me = c.me;
  const best = Object.entries(s.progress).filter(([, p]) => p.stars > 0).map(([lvl, p]) => ({ level: Number(lvl), stars: p.stars, score: Math.min(50_000, p.best) }));
  const localTop = best.reduce((a, b) => Math.max(a, b.level), 0);
  if (me && localTop + 1 > me.highest && best.length) void c.call('progress.sync', { best: best.slice(0, 40) }).catch(() => undefined);
  void flushOutbox();
  try {
    const [sk, bonuses, camp] = await Promise.all([c.call('skills.list', {}), c.call('me.bonuses', {}), c.call('camp.state', {})]);
    applyServerSkills(sk.skills);
    useSocial.setState({ bonuses });
    useNet.setState({ camp: camp.camp, wallet: camp.wallet });
    const team = await c.call('team.detail', {});
    if (team.team) { const [w, r] = await Promise.all([c.call('war.state', {}), c.call('raid.state', {})]); useNet.setState({ war: w.war, raid: r.raid }); }
  } catch { /* bir sonraki bağlantıda */ }
  mirrorCoins();
}

let started = false;
export function startNet(): void {
  if (started) return;
  started = true;
  const url = platform().serverUrl();
  if (!url) { useSocial.setState({ enabled: false, tried: true }); return; }
  useSocial.setState({ enabled: true });
  void (async () => {
    sent = new Set(await readJson<string[]>(K.sent, []));
    let outbox = await readJson<OutItem[]>(K.outbox, []);
    if (!Array.isArray(outbox)) outbox = [];
    // ilk kez hesap açılacaksa: cihazdaki çevrimdışı jeton bir kez hesaba devredilir (sunucu: yeni hesapta, en çok 3000);
    // devre dahil olan eski defter kayıtları ayrıca gönderilmez (iki kez sayılmasın)
    const hadToken = !!(await store().getItem(K.token).catch(() => null));
    if (!hadToken) {
      const st = useStore.getState();
      for (const g of st.meta.ledger) sent.add(ledgerKey(g.at, g.reason));
      writeJson(K.sent, [...sent].slice(-300));
      outbox = outbox.filter((o) => !(o.k === 'local' && o.reason === 'devir'));
      if (st.coins > 0) outbox = [{ k: 'local', ledgerId: `devir-${Date.now().toString(36)}`, jeton: Math.round(st.coins), reason: 'devir' }, ...outbox];
      writeJson(K.outbox, outbox);
    }
    useSocial.setState({ outbox });
    client = createClient({
      url,
      getToken: () => store().getItem(K.token),
      saveToken: (t) => (t ? store().setItem(K.token, t) : store().removeItem(K.token)),
      getQueue: () => readJson<ProgressSubmit[]>(K.queue, []),
      saveQueue: (q) => { useSocial.setState({ queued: q.length, queuedCoins: q.reduce((a, x) => a + (x.coins ?? 0), 0) }); writeJson(K.queue, q); mirrorCoins(); },
    });
    const c = client;
    bindNet(c);
    bindEvents(c);
    bindFriends(c); // arkadaşlık + özel mesaj olayları (istek, dm, okunmamış, bildirim şeridi)
    bindOdiColor(c); // Odi rengi: yerel tek kaynak ↔ sunucu profili
    bindComm(c); // iletişim: ayarlar, akış/soru güncellemeleri, bahsetme, ikili görev, usta–çırak
    bindTeamRace(c); // takım rekabeti: Takım Yarışı lobisi/eşleşme/sonuç, Takım Ligi
    bindCodes(c); // Kod Gir: yönetici modu sunucu durumuyla eşitlenir
    bindTeamApply(c); // takım başvuruları: lider/yardımcı rozeti, karar bildirimi
    bindKg(c); // Kamp Görevleri: hikâye, günlük görevler, vakalar, kamp oyunları (docs/17-kamp-gorevleri.md)
    c.onStatus((st) => { if (st !== 'bağlanıyor') useSocial.setState({ tried: true }); if (st === 'bağlı') void onConnected(c); });
    c.onMe((me) => applyServerItems([...me.cosmetics.map((ref) => ({ kind: 'kozmetik' as const, amount: 1, ref })), ...me.cards.map((ref) => ({ kind: 'kart' as const, amount: 1, ref }))]));
    useNet.subscribe((n, p) => { if (n.wallet !== p.wallet || n.status !== p.status) mirrorCoins(); });
    c.on('camp.updated', () => { void c.call('me.bonuses', {}).then((b) => useSocial.setState({ bonuses: b })).catch(() => undefined); });
    useNet.subscribe((n, p) => { if (n.camp && n.camp !== p.camp) syncCampUnlocks(n.camp); }); // kampta açılan kozmetikler hemen Dolap'a
    c.on('team.extra.updated', () => { void c.call('me.bonuses', {}).then((b) => useSocial.setState({ bonuses: b })).catch(() => undefined); });
    c.on('team.updated', ({ team }) => { if (team) void c.call('war.state', {}).then((w) => useNet.setState({ war: w.war })).catch(() => undefined); });
    c.on('team.help', ({ request }) => useNet.setState((s) => (s.team ? { team: { ...s.team, help: [request, ...s.team.help.filter((h) => h.id !== request.id)] } } : {})));
    c.on('camp.helped', ({ name, seconds }) => toast('🤝', `${name} inşaatını hızlandırdı`, `−${fmtShort(seconds)}`, 'green'));
    c.on('camp.cheered', ({ name, kind }) => toast('👏', `${name} kampına tepki bıraktı`, CAMP_CHEERS.find((x) => x.id === kind)?.text, 'green'));
    c.on('team.gift', ({ gift }) => toast('🎁', 'Takım hediyesi geldi!', gift.reason, 'gold'));
    useStore.subscribe((n, p) => { if (n.meta.ledger !== p.meta.ledger) scanLedger(); });
    scanLedger();
    c.connect();
  })();
}

/** bağlantıyı baştan dene (bekleme süresini sıfırlar) */
export function reconnect(): void {
  if (!client) { started = false; startNet(); return; }
  useSocial.setState({ tried: false });
  client.close(); client.connect();
}

/** ödül kutusundan al: cüzdan sunucudan yansır; kozmetik/kart/kalkan yerel meta'ya da işlenir */
export async function claimInboxItem(id: string): Promise<InboxItem | null> {
  if (!client) return null;
  try {
    const r = await client.call('inbox.claim', { id });
    useNet.setState((s) => ({ wallet: r.wallet, inboxCount: Math.max(0, s.inboxCount - 1) }));
    applyServerItems([r.item]);
    return r.item;
  } catch (e) { toast('🙈', 'Alınamadı', errText(e), 'bronze'); return null; }
}

export function fmtShort(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)} sa ${Math.round((sec % 3600) / 60)} dk`;
  if (sec >= 60) return `${Math.round(sec / 60)} dk`;
  return `${Math.max(0, Math.round(sec))} sn`;
}
