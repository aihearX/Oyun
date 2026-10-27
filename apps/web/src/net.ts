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
import { createCoinEstimate, createOutbox, reconcileCoins, type OutItem } from './outbox';

declare const __ODI_E2E__: boolean | undefined;
/** yalnız uçtan uca test derlemesi (VITE_ODI_E2E=1): harness istemci durumunu okur (kopma-e2e) */
const E2E = typeof __ODI_E2E__ !== 'undefined' && !!__ODI_E2E__;
const K = { token: 'odi.net.token', queue: 'odi.net.queue', outbox: 'odi.net.outbox', sent: 'odi.net.sent' } as const;
const MECHANICS = new Set(['kosu', 'yuzme', 'trambolin', 'makine', 'impuls', 'ruya', 'boss']);
/** wallet.local şeması: tek kayıtta en çok bu kadar jeton (apps/server/src/schemas.ts); devir zaten DEVIR_MAX (3000) ile sınırlı */
const LOCAL_JETON_PER_CALL = 10_000;

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
    if (e.code === 'CEVRIMDISI' || e.code === 'KAPALI') return 'Sunucuya bağlı değilsin. Bağlantı gelince tekrar dene.';
    // istek gitti ama yanıt gelmeden bağlantı koptu: sunucu işlemi yapmış olabilir; bağlanınca durum kendiliğinden yenilenir
    if (e.code === 'KOPTU') return 'Bağlantı koptu. Yeniden bağlanınca son durumu göreceksin; olmadıysa bir daha dene.';
    if (e.code === 'ZAMAN_ASIMI') return 'Sunucu geç yanıt verdi; bir daha dener misin?';
    return e.message;
  }
  return 'Bir şeyler ters gitti; bir daha dener misin?';
}
/**
 * Tekrar korumalı istek (aynı istek kimliği sunucuda bir kez işlenir: chat.send cid, progress.submit runId, wallet.local ledgerId):
 * yanıt gelmeden bağlantı koparsa (KOPTU) bir kez daha gönderilir; istemci bağlantı gelene kadar (zaman aşımına dek) bekler.
 */
export async function callSafe<O extends keyof OpMap>(op: O, data: OpMap[O]['req']): Promise<OpMap[O]['res']> {
  const c = client; if (!c) throw new NetError('KAPALI', 'Sunucu adresi yok.');
  try { return await c.call(op, data); } catch (e) { if (e instanceof NetError && e.code === 'KOPTU') return c.call(op, data); throw e; }
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
/**
 * Üst çubuk = sunucu cüzdanı + bekleyenler. Outbox ya da bölüm sonu (progress.submit) kaydı sunucuya gitmiş ama yanıtı alınmamışken
 * (sunucunun olayı yanıttan önce gelir; zaman aşımı, kopma ve yeniden bağlanma boyunca) gelen cüzdan o kaydı içerebilir: değer
 * cüzdandan değil, tahminden yürür (ayrıntı: outbox.ts `createCoinEstimate`; MK-035, MK-036, MK-038). Bu sürede üst çubuktaki kum
 * saati "Kaydediliyor…" der (ui/social.tsx).
 */
const tahmin = createCoinEstimate();
const unanswered = () => outbox_.unanswered() || !!client?.submitting();
function mirrorCoins(): void {
  const n = useNet.getState();
  if (n.status !== 'bağlı' || !n.wallet) return;
  const coins = tahmin.next({ wallet: n.wallet.jeton, pending: pendingJeton(), unanswered: unanswered(), current: useStore.getState().coins });
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
function setOutbox(outbox: OutItem[]): void { useSocial.setState({ outbox }); writeJson(K.outbox, outbox); mirrorCoins(); void outbox_.flush(); }

/**
 * Outbox (MK-035, ayrıntı: outbox.ts): tur sürerken gelen tetik kaybolmaz; bağlantı kaynaklı hata kaydı bir sonraki bağlanışa,
 * geçici ret (HIZ, ZAMAN_ASIMI, SUNUCU) kısa süre sonraya bırakır; yanıttaki cüzdan uygulanır (olay kaybolsa da üst çubuk doğru).
 */
const outbox_ = createOutbox({
  client: () => client,
  items: () => useSocial.getState().outbox,
  save: (outbox) => { useSocial.setState({ outbox }); writeJson(K.outbox, outbox); mirrorCoins(); },
  onWallet: (wallet) => useNet.setState({ wallet }),
  onLocal: (item, r) => {
    if (item.reason === 'devir') { if (r.credited > 0) toast('🪙', 'Cihazdaki jetonların hesabında', `${r.credited} jeton aktarıldı.`, 'green'); }
    else if (r.credited < item.jeton) toast('🪙', 'Bugünkü ödül sınırı doldu', `Görev ve sandık jetonlarında günlük üst sınır ${LOCAL_JETON_DAILY_MAX}. ${item.jeton - r.credited} jeton hesaba eklenmedi.`, 'bronze');
  },
  onSpend: (_, r) => applyServerSkills(r.skills),
  onAck: (_, jeton) => tahmin.credit(jeton),
  onSettled: () => mirrorCoins(),
  onDrained: () => void reconcile(),
});
const flushOutbox = () => outbox_.flush();

/**
 * Uzlaşma: outbox ve ilerleme kuyruğu boşken (bağlanınca ve outbox boşalınca) sunucu cüzdanı okunur; üst çubuk = sunucu + bekleyen
 * değilse sunucu kazanır ve tanı yazılır (yalnız sayılar; kişisel veri yok).
 */
const uzlasma = { runs: 0, fixes: 0, last: null as null | { shown: number; server: number; known: number | null } };
let reconciling = false;
async function reconcile(): Promise<void> {
  const c = client;
  const idle = () => { const s = useSocial.getState(); return !s.outbox.length && !s.queued; };
  if (!c || c.status !== 'bağlı' || reconciling || !idle()) return;
  reconciling = true;
  try {
    const { wallet } = await c.call('wallet.get', {});
    if (c.status !== 'bağlı' || !idle()) return; // arada yeni kayıt geldi: bir sonraki boşalmada
    uzlasma.runs++;
    const shown = useStore.getState().coins; const known = useNet.getState().wallet?.jeton ?? null;
    const { coins, diff } = reconcileCoins({ shown, server: wallet.jeton, pending: pendingJeton() });
    if (diff !== 0 || known !== wallet.jeton) {
      uzlasma.fixes++; uzlasma.last = { shown, server: wallet.jeton, known };
      console.warn(`[cüzdan] uzlaşma: üst çubuk ${shown}, istemcideki cüzdan ${known ?? '-'}, sunucu ${wallet.jeton}; sunucu değeri alındı`);
    }
    useNet.setState({ wallet });
    tahmin.set(coins, pendingJeton());
    if (useStore.getState().coins !== coins) useStore.setState({ coins });
  } catch { /* bağlantı koptu: bir sonraki bağlanışta */ } finally { reconciling = false; }
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
      if (st.coins > 0) outbox = [{ k: 'local', ledgerId: `devir-${Date.now().toString(36)}`, jeton: Math.min(LOCAL_JETON_PER_CALL, Math.round(st.coins)), reason: 'devir' }, ...outbox];
      writeJson(K.outbox, outbox);
    }
    useSocial.setState({ outbox });
    client = createClient({
      url,
      // sunucu yeniden başlarken (güncelleme, yeniden açılış) bekleme en çok 8 sn: sunucu döndükten sonra ≤ 8 sn'de bağlanır (MK-019)
      maxBackoffMs: 8_000,
      // kopukken basılan işlem (sohbet iletisi, kamp) bağlantıyı 20 sn bekler: kısa yeniden başlatmada kaybolmaz, uzun kopuklukta açık hata
      offlineWaitMs: 20_000,
      // sunucu bağlantı başına 30 ileti/sn; bağlanınca giden ~35 yenileme isteğinin fazlası 'HIZ' ile düşmesin (MK-019)
      maxPerSec: 20,
      getToken: () => store().getItem(K.token),
      saveToken: (t) => (t ? store().setItem(K.token, t) : store().removeItem(K.token)),
      getQueue: () => readJson<ProgressSubmit[]>(K.queue, []),
      saveQueue: (q) => { useSocial.setState({ queued: q.length, queuedCoins: q.reduce((a, x) => a + (x.coins ?? 0), 0) }); writeJson(K.queue, q); mirrorCoins(); },
      onSubmitSettled: () => mirrorCoins(),
      // yanıt gelen koşunun hesaba geçen jetonu (yeniden gönderimde kayıtlı yanıt: cüzdanı eski olabilir, jetonu doğru)
      onSubmitAck: (_, ack) => tahmin.credit(ack.jeton),
    });
    const c = client;
    // bağlanınca İLK istek outbox: yanıtı kaybolmuş (sunucuda yazılmış) ödül, yenilemenin getirdiği cüzdandan önce kapanır;
    // aksi halde üst çubuk bir an "cüzdan + aynı ödül" (fazla) gösterir. Sonra uzlaşma (MK-035).
    c.onStatus((st) => { if (st === 'bağlı') void flushOutbox().then(reconcile); });
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
    // güvenlik ağı: bağlıyken bekleyen ödül/harcama kalmışsa (geçici ret, yarış) kısa aralıkla yeniden dene; ledgerId ile tek yazılır
    setInterval(() => { if (useSocial.getState().outbox.length && c.status === 'bağlı') void flushOutbox(); }, 10_000);
    // ağ geri gelince ya da uygulama öne gelince beklemeden dene (bekleyen istekler korunur)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => c.retryNow());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') c.retryNow(); });
    }
    if (E2E && typeof window !== 'undefined') (window as unknown as { __ag?: unknown }).__ag = { social: useSocial, store: useStore, net: () => client, cuzdan: () => ({ ...outbox_.stats(), uzlasma: { ...uzlasma }, bekliyor: unanswered() }) };
    c.connect();
  })();
}

/** bağlantıyı şimdi dene (bekleme süresini sıfırlar; bekleyen istekler ve kuyruk korunur) */
export function reconnect(): void {
  if (!client) { started = false; startNet(); return; }
  if (client.status === 'bağlı' || client.status === 'bağlanıyor') return;
  useSocial.setState({ tried: false });
  if (client.status === 'kapalı') { client.close(); client.connect(); return; }
  client.retryNow();
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
