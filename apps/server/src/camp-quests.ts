/**
 * Kamp Görevleri (docs/17-kamp-gorevleri.md): sunucu yetkili ilerleme. Kamp eylemleri (depo toplama, inşaat, malzeme, yardım,
 * vaka, kamp oyunları, bölüm sonucu) sayaçları artırır — her olay bir kez (kg_seen); görev/hikâye/başarı ilerlemesi sayaçlardan ve
 * anlık durumdan (bina seviyeleri, Vaka Defteri, bölge) hesaplanır. Her ödül tam bir kez alınır (kg_claim birincil anahtarı).
 */
import { BUILDINGS, type BuildingId, type KampOdul, type KgBasamak, type KgBolum, type KgGorev, type KgHafta, type KgState, type OpMap } from '@odi/shared';
import {
  HUMAN_JOURNEY, KG_ACILIS, KG_BASARI, KG_BUYUME_OLCUT, KG_GUNLUK, KG_HAFTA, KG_HAFTA_ODUL, KG_HIKAYE, KG_KURAL, KG_ODUL, KG_SAYACLAR,
  PATHOLOGY_IDS, REMEDY_INV_CAP, VAKALAR, kgHash, kgRng, remedyById,
  type KgAdim, type KgOlcut, type KgOzellik, type KgSart, type KgSayac,
} from '@odi/content';
import { fail, type App, type Handler, type Handlers } from './app';
import { isAdmin, isAdminOn } from './codes';
import { GROWTH_OP_METRICS, campLevel, decorCount, giveCampXp, giveDecoration, growthOn, pendingOf } from './camp-quests-adapter';
import { campState } from './camp';
import { dayBounds } from './events/common';
import { dayKey } from './time';

// ------------------------------------------------------------------ yardımcılar
const levelOf = (app: App, pid: string, id: BuildingId) => app.db.get<{ level: number }>('SELECT level FROM buildings WHERE player_id = ? AND id = ?', pid, id)?.level ?? 0;
/** geçilen bölüm sayısı (sunucu: en yüksek açık bölüm − 1) */
export const clearedOf = (app: App, pid: string) => Math.max(0, app.player(pid).highest - 1);
export function featureOpen(app: App, pid: string, f: KgOzellik): boolean { return clearedOf(app, pid) >= KG_ACILIS[f] || isAdminOn(app, pid); }
/** Türkçe bulunma eki (apps/web/src/ftue/features.ts ile aynı) */
function ek(n: number): string {
  if (n % 10 === 0) return ({ 10: 'da', 20: 'de', 30: 'da', 40: 'ta' } as Record<number, string>)[n % 100] ?? 'de';
  return ['', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'][n % 10]!;
}
export const bolumKilit = (f: KgOzellik) => `Bölüm ${KG_ACILIS[f]}’${ek(KG_ACILIS[f])} açılır`;
const KUR: Record<BuildingId, string> = { merkez: 'Odyoloji Merkezi’ni', laboratuvar: 'Odyometri Odası’nı', atolye: 'İşitme Cihazı Atölyesi’ni', depo: 'Kulak Deposu’nu', kule: 'Timpanometri Kulesi’ni', revir: 'Odyoloji Kliniği’ni', tedavi: 'Tedavi Odası’nı',
  kabin: 'Akustik Kabin’i', tarama: 'Yenidoğan İşitme Tarama Birimi’ni', park: 'İşitsel Rehabilitasyon Parkı’nı', denge: 'Vestibüler Laboratuvar’ı', kutuphane: 'Odyoloji Kütüphanesi’ni' };
const bname = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!.name;
/** şart karşılanmıyorsa dürüst neden, karşılanıyorsa null */
export function sartKilit(app: App, pid: string, s: KgSart | undefined): string | null {
  if (!s) return null;
  if (s.ozellik && !featureOpen(app, pid, s.ozellik)) return bolumKilit(s.ozellik);
  if (s.bina) { const [id, lv] = s.bina; if (levelOf(app, pid, id) < lv) return lv <= 1 ? `${KUR[id]} kur` : `${bname(id)} Sv ${lv} gerekli`; }
  if (s.takim && !app.player(pid).team_id) return 'Bir takıma katıl';
  return null;
}
const isGrowth = (o: KgOlcut) => KG_BUYUME_OLCUT.includes(o);

// ------------------------------------------------------------------ sayaçlar
const scopes = (app: App) => ['all', `d:${dayKey(app.now())}`, `w:${app.week().key}`];
/**
 * sayaç artır. key verilirse olay oyuncu başına bir kez sayılır (aynı koşu/tur/deneme ikinci kez gelirse yok sayılır).
 * Dönüş: sayıldı mı.
 */
export function kgBump(app: App, pid: string, metric: KgSayac, n = 1, key?: string): boolean {
  if (n <= 0) return false;
  if (key && !app.db.run('INSERT OR IGNORE INTO kg_seen(player_id, key, at) VALUES(?, ?, ?)', pid, key, app.now())) return false;
  const ms: KgSayac[] = metric === 'ton' || metric === 'timpano' ? [metric, 'oyun'] : [metric];
  for (const m of ms) for (const sc of scopes(app)) app.db.run('INSERT INTO kg_count(player_id, scope, metric, n) VALUES(?, ?, ?, ?) ON CONFLICT(player_id, scope, metric) DO UPDATE SET n = n + excluded.n', pid, sc, m, Math.round(n));
  kgDirty(app, pid);
  return true;
}
export function kgCount(app: App, pid: string, metric: KgSayac, scope: 'all' | 'day' | 'week' = 'all'): number {
  const sc = scope === 'all' ? 'all' : scope === 'day' ? `d:${dayKey(app.now())}` : `w:${app.week().key}`;
  return app.db.get<{ n: number }>('SELECT n FROM kg_count WHERE player_id = ? AND scope = ? AND metric = ?', pid, sc, metric)?.n ?? 0;
}
/** ulaşılan bölge sayısı (Kulak Sözlüğü / anıt kuralı: geçilen bölümler + sıradaki bölümün bölgesi) */
function regionsReached(app: App, pid: string): number {
  const upto = Math.min(HUMAN_JOURNEY.levels.length, clearedOf(app, pid) + 1);
  return new Set(HUMAN_JOURNEY.levels.slice(0, upto).map((l) => l.biome)).size;
}
/** bir ölçütün değeri (sayaç ya da anlık durum) */
export function metricValue(app: App, pid: string, o: KgOlcut, scope: 'all' | 'day' | 'week' = 'all'): number {
  if ((KG_SAYACLAR as string[]).includes(o)) return kgCount(app, pid, o as KgSayac, scope);
  if (o.startsWith('bina:')) return levelOf(app, pid, o.slice(5) as BuildingId);
  switch (o) {
    case 'bina-toplam': return app.db.get<{ n: number }>('SELECT COALESCE(SUM(level), 0) AS n FROM buildings WHERE player_id = ?', pid)!.n;
    case 'defter': return app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM kv_book WHERE player_id = ? AND stars > 0', pid)!.n;
    case 'defter-yildiz': return app.db.get<{ n: number }>('SELECT COALESCE(SUM(stars), 0) AS n FROM kv_book WHERE player_id = ?', pid)!.n;
    case 'patoloji': {
      const solved = new Set(app.db.all<{ case_id: string }>('SELECT case_id FROM kv_book WHERE player_id = ? AND stars > 0', pid).map((r) => r.case_id));
      return new Set(VAKALAR.filter((v) => solved.has(v.id) && (PATHOLOGY_IDS as readonly string[]).includes(v.kat)).map((v) => v.kat)).size;
    }
    case 'bolge': return regionsReached(app, pid);
    case 'takim': return app.player(pid).team_id ? 1 : 0;
    case 'hikaye': return app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM kg_claim WHERE player_id = ? AND ref LIKE 'hikaye:%'", pid)!.n;
    case 'kamp-sv': return campLevel(app, pid);
    case 'dekor': return decorCount(app, pid);
  }
  return 0;
}

// ------------------------------------------------------------------ ödül
const claimed = (app: App, pid: string, ref: string) => !!app.db.get('SELECT 1 AS x FROM kg_claim WHERE player_id = ? AND ref = ?', pid, ref);
/** ödülü uygula (jeton/kristal/hızlandırıcı cüzdana, Kamp XP ve dekor büyüme sistemine ya da beklemeye, malzeme çantaya) */
export function grantKampOdul(app: App, pid: string, r: KampOdul, ref: string): KampOdul {
  const out: KampOdul = {};
  if (r.jeton) { app.addCurrency(pid, 'jeton', r.jeton); out.jeton = r.jeton; }
  if (r.kristal) { app.addCurrency(pid, 'kristal', r.kristal); out.kristal = r.kristal; }
  if (r.m5) { app.addCurrency(pid, 'm5', r.m5); out.m5 = r.m5; }
  if (r.m60) { app.addCurrency(pid, 'm60', r.m60); out.m60 = r.m60; }
  if (r.kampXp) { giveCampXp(app, pid, r.kampXp, ref); out.kampXp = r.kampXp; }
  if (r.dekor) { giveDecoration(app, pid, r.dekor, ref); out.dekor = r.dekor; }
  if (r.malzeme && remedyById(r.malzeme)) {
    const have = app.db.get<{ n: number }>('SELECT n FROM remedy_inv WHERE player_id = ? AND id = ?', pid, r.malzeme)?.n ?? 0;
    const add = Math.max(0, Math.min(r.malzemeN ?? 1, REMEDY_INV_CAP - have));
    if (add > 0) {
      app.db.run('INSERT INTO remedy_inv(player_id, id, n) VALUES(?, ?, ?) ON CONFLICT(player_id, id) DO UPDATE SET n = n + excluded.n', pid, r.malzeme, add);
      out.malzeme = r.malzeme; out.malzemeN = add;
      app.emit(pid, 'camp.updated', { camp: campState(app, pid) });
    }
  }
  if (r.jeton || r.kristal || r.m5 || r.m60) app.walletChanged(pid);
  return out;
}

// ------------------------------------------------------------------ günlük, haftalık, hikâye, başarı, takım
function available(app: App, pid: string, a: KgAdim): boolean { return !(isGrowth(a.olcut) && !growthOn()) && sartKilit(app, pid, a.sart) === null; }
function dailyIds(app: App, pid: string): { ids: string[]; rerolls: number } {
  const day = dayKey(app.now());
  const row = app.db.get<{ tasks: string; rerolls: number }>('SELECT tasks, rerolls FROM kg_daily WHERE player_id = ? AND day = ?', pid, day);
  if (row) return { ids: JSON.parse(row.tasks) as string[], rerolls: row.rerolls };
  const r = kgRng(kgHash(`${pid}:${day}`));
  const ids = pickWeighted(KG_GUNLUK.filter((g) => available(app, pid, g)), KG_KURAL.gunlukGorev, r).map((g) => g.id);
  app.db.run('INSERT OR IGNORE INTO kg_daily(player_id, day, tasks, rerolls) VALUES(?, ?, ?, 0)', pid, day, JSON.stringify(ids));
  return { ids, rerolls: 0 };
}
function pickWeighted<T extends { w: number }>(pool: T[], n: number, r: () => number): T[] {
  const left = [...pool]; const out: T[] = [];
  while (out.length < n && left.length) {
    const tot = left.reduce((a, x) => a + x.w, 0); let x = r() * tot; let i = 0;
    for (; i < left.length - 1; i++) { x -= left[i]!.w; if (x < 0) break; }
    out.push(left.splice(i, 1)[0]!);
  }
  return out;
}
function dailyTasks(app: App, pid: string): { tasks: KgGorev[]; rerollLeft: number } {
  const day = dayKey(app.now()); const { ids, rerolls } = dailyIds(app, pid);
  const tasks = ids.map((id) => KG_GUNLUK.find((g) => g.id === id)).filter((g) => !!g).map((g) => {
    const ref = `gunluk:${day}:${g.id}`; const progress = Math.min(g.need, metricValue(app, pid, g.olcut, 'day'));
    return { ref, id: g.id, text: g.text, art: g.art, need: g.need, progress, done: progress >= g.need, claimed: claimed(app, pid, ref), reward: { ...KG_ODUL.gunluk }, locked: sartKilit(app, pid, g.sart) };
  });
  return { tasks, rerollLeft: Math.max(0, KG_KURAL.degistirme - rerolls) };
}
function weeklyGoal(app: App, pid: string): KgHafta | null {
  const week = app.week().key;
  let id = app.db.get<{ goal: string }>('SELECT goal FROM kg_week WHERE player_id = ? AND week = ?', pid, week)?.goal;
  if (!id) {
    const pool = KG_HAFTA.filter((h) => sartKilit(app, pid, h.sart) === null);
    id = (pool.length ? pool : [KG_HAFTA[0]!])[kgHash(`${pid}:${week}`) % Math.max(1, pool.length)]!.id;
    app.db.run('INSERT OR IGNORE INTO kg_week(player_id, week, goal) VALUES(?, ?, ?)', pid, week, id);
  }
  const def = KG_HAFTA.find((h) => h.id === id); if (!def) return null;
  const progress = kgCount(app, pid, def.olcut, 'week');
  const tiers: KgBasamak[] = def.tiers.map((need, i) => { const ref = `hafta:${week}:${i}`; return { need, reward: KG_HAFTA_ODUL[i]!, reached: progress >= need, claimed: claimed(app, pid, ref), ref }; });
  return { id: def.id, text: def.text, art: def.art, progress, tiers };
}
function story(app: App, pid: string): KgState['story'] {
  const total = KG_HIKAYE.length;
  const done = KG_HIKAYE.filter((c) => claimed(app, pid, `hikaye:${c.no}`)).length;
  const cur = KG_HIKAYE.find((c) => !claimed(app, pid, `hikaye:${c.no}`));
  if (!cur) return { chapter: null, next: null, claimed: done, total };
  const steps: KgGorev[] = cur.steps.filter((s) => !(isGrowth(s.olcut) && !growthOn())).map((s) => {
    const progress = Math.min(s.need, metricValue(app, pid, s.olcut));
    return { ref: '', id: s.id, text: s.text, art: s.art, need: s.need, progress, done: progress >= s.need, claimed: false, reward: null, locked: progress >= s.need ? null : sartKilit(app, pid, s.sart) };
  });
  const ref = `hikaye:${cur.no}`;
  const chapter: KgBolum = { no: cur.no, title: cur.title, intro: cur.intro, outro: cur.outro, steps, reward: cur.reward, done: steps.every((s) => s.done), claimed: false, ref };
  const nx = KG_HIKAYE.find((c) => c.no === cur.no + 1);
  return { chapter, next: nx ? { no: nx.no, title: nx.title } : null, claimed: done, total };
}
function achievements(app: App, pid: string): KgState['achievements'] {
  return KG_BASARI.map((b) => {
    const progress = metricValue(app, pid, b.olcut);
    const tiers: KgBasamak[] = b.tiers.map((t, i) => { const ref = `basari:${b.id}:${i}`; return { need: t.need, reward: t.reward, reached: progress >= t.need, claimed: claimed(app, pid, ref), ref }; });
    return { id: b.id, title: b.title, text: b.text, art: b.art, progress, tiers, locked: sartKilit(app, pid, b.sart) };
  });
}
/** takım kliniği: takımca bu hafta ilk kez çözülen vakalar (yönetici hesapları sayılmaz ve ödül alamaz) */
export function teamClinic(app: App, pid: string): KgState['takim'] {
  const p = app.player(pid); if (!p.team_id || !featureOpen(app, pid, 'vaka')) return null;
  const week = app.week().key;
  const progress = app.db.get<{ n: number }>("SELECT COALESCE(SUM(w.n), 0) AS n FROM kv_team_week w WHERE w.team_id = ? AND w.week = ? AND w.player_id NOT IN (SELECT player_id FROM player_flags WHERE admin = 1)", p.team_id, week)!.n;
  const contributed = !isAdmin(app, pid) && !!app.db.get('SELECT 1 AS x FROM kv_team_week WHERE team_id = ? AND week = ? AND player_id = ? AND n > 0', p.team_id, week, pid);
  const ref = `takim:${week}`;
  return { need: KG_KURAL.takimHedef, progress, reward: { ...KG_ODUL.takim }, reached: progress >= KG_KURAL.takimHedef, claimed: claimed(app, pid, ref), contributed, ref };
}

// ------------------------------------------------------------------ durum
/** kliniğe bağlı özet (vakalar camp-quests-vaka.ts'te; döngüsel içe aktarmayı önlemek için kancayla) */
let vakaSummary: (app: App, pid: string) => KgState['vaka'] = () => ({ open: false, waiting: 0, locked: null });
let oyunSummary: (app: App, pid: string) => KgState['oyun'] = () => [];
export function setKgSummaries(v: typeof vakaSummary, o: typeof oyunSummary): void { vakaSummary = v; oyunSummary = o; }

export function kgState(app: App, pid: string): KgState {
  const now = app.now(); const w = app.week(); const b = dayBounds(now);
  const open = { gorev: featureOpen(app, pid, 'gorev'), oyun: featureOpen(app, pid, 'oyun'), vaka: featureOpen(app, pid, 'vaka') };
  const st = story(app, pid); const daily = dailyTasks(app, pid); const weekly = weeklyGoal(app, pid); const ach = achievements(app, pid); const takim = teamClinic(app, pid);
  let claimable = 0;
  if (st.chapter?.done) claimable++;
  claimable += daily.tasks.filter((t) => t.done && !t.claimed).length;
  if (weekly) claimable += weekly.tiers.filter((t) => t.reached && !t.claimed).length;
  for (const a of ach) claimable += a.tiers.filter((t) => t.reached && !t.claimed).length;
  if (takim?.reached && takim.contributed && !takim.claimed) claimable++;
  return {
    day: dayKey(now), dayEndsAt: b.endsAt, week: w.key, weekEndsAt: w.endsAt, open, story: st, daily, weekly, achievements: ach,
    oyun: oyunSummary(app, pid), takim, vaka: vakaSummary(app, pid), claimable: open.gorev ? claimable : 0, growth: growthOn(), pending: pendingOf(app, pid),
  };
}

/** işlem sonunda bir kez kg.updated (aynı işlemde birden çok sayaç artsa da) */
const dirty = new WeakMap<App, Set<string>>();
export function kgDirty(app: App, pid: string): void {
  let s = dirty.get(app); if (!s) { s = new Set(); dirty.set(app, s); }
  if (s.has(pid)) return;
  s.add(pid);
  app.after(() => { s!.delete(pid); if (app.online.has(pid)) { try { app.emit(pid, 'kg.updated', { state: kgState(app, pid) }); } catch (e) { if (app.cfg.log) console.error('[kg.updated]', e); } } });
}

// ------------------------------------------------------------------ ödül alma
function claim(app: App, pid: string, ref: string): KampOdul {
  if (!featureOpen(app, pid, 'gorev')) fail('KILIT', `Kamp Görevleri ${bolumKilit('gorev')}.`);
  if (claimed(app, pid, ref)) fail('TEKRAR', 'Bu ödülü zaten aldın.');
  const parts = ref.split(':'); let reward: KampOdul | null = null;
  switch (parts[0]) {
    case 'hikaye': {
      const st = story(app, pid);
      if (!st.chapter || st.chapter.ref !== ref) fail('YOK', 'Bu bölüm şu an açık değil.');
      if (!st.chapter.done) fail('BITMEDI', 'Bölümün bütün adımlarını tamamla.');
      reward = st.chapter.reward; break;
    }
    case 'gunluk': {
      const t = dailyTasks(app, pid).tasks.find((x) => x.ref === ref);
      if (!t) fail('YOK', 'Bu görev bugünün görevi değil.');
      if (!t.done) fail('BITMEDI', 'Görev henüz tamamlanmadı.');
      reward = t.reward; break;
    }
    case 'hafta': {
      const t = weeklyGoal(app, pid)?.tiers.find((x) => x.ref === ref);
      if (!t) fail('YOK', 'Bu haftanın hedefi değil.');
      if (!t.reached) fail('BITMEDI', 'Hedefe henüz ulaşmadın.');
      reward = t.reward; break;
    }
    case 'basari': {
      const a = achievements(app, pid).find((x) => x.id === parts[1]); const t = a?.tiers.find((x) => x.ref === ref);
      if (!a || !t) fail('YOK', 'Başarı bulunamadı.');
      if (!t.reached) fail('BITMEDI', 'Basamağa henüz ulaşmadın.');
      reward = t.reward; break;
    }
    case 'takim': {
      const t = teamClinic(app, pid);
      if (!t || t.ref !== ref) fail('YOK', 'Takım kliniği hedefi yok.');
      if (!t.contributed) fail('SART', 'Bu hafta takım kliniğine en az bir vakayla katkı ver.');
      if (!t.reached) fail('BITMEDI', 'Takımın hedefe henüz ulaşmadı.');
      reward = t.reward; break;
    }
    default: fail('YOK', 'Bilinmeyen ödül.');
  }
  if (!app.db.run('INSERT OR IGNORE INTO kg_claim(player_id, ref, at, reward) VALUES(?, ?, ?, ?)', pid, ref, app.now(), JSON.stringify(reward))) fail('TEKRAR', 'Bu ödülü zaten aldın.');
  const got = grantKampOdul(app, pid, reward!, ref);
  if (parts[0] === 'gunluk') kgBump(app, pid, 'gunluk', 1, `gunluk:${ref}`);
  kgDirty(app, pid);
  return got;
}

function reroll(app: App, pid: string, id: string): void {
  if (!featureOpen(app, pid, 'gorev')) fail('KILIT', `Kamp Görevleri ${bolumKilit('gorev')}.`);
  const day = dayKey(app.now()); const { ids, rerolls } = dailyIds(app, pid);
  if (rerolls >= KG_KURAL.degistirme) fail('LIMIT', 'Bugün görev değiştirme hakkını kullandın.');
  if (!ids.includes(id)) fail('YOK', 'Bu görev bugünün görevi değil.');
  if (claimed(app, pid, `gunluk:${day}:${id}`)) fail('GECERSIZ', 'Ödülü alınmış görev değiştirilemez.');
  const pool = KG_GUNLUK.filter((g) => !ids.includes(g.id) && available(app, pid, g));
  if (!pool.length) fail('YOK', 'Şu an değiştirilecek başka görev yok.');
  const pick = pickWeighted(pool, 1, kgRng(kgHash(`${pid}:${day}:r`)))[0]!;
  app.db.run('UPDATE kg_daily SET tasks = ?, rerolls = rerolls + 1 WHERE player_id = ? AND day = ?', JSON.stringify(ids.map((x) => (x === id ? pick.id : x))), pid, day);
}

export const kgHandlers: Handlers = {
  'kg.state': (app, s) => ({ state: kgState(app, s.pid) }),
  'kg.claim': (app, s, { ref }) => { const reward = claim(app, s.pid, ref); return { state: kgState(app, s.pid), reward, wallet: app.wallet(s.pid) }; },
  'kg.reroll': (app, s, { id }) => { reroll(app, s.pid, id); return { state: kgState(app, s.pid) }; },
};

// ------------------------------------------------------------------ kamp eylemlerinden sayaçlar (kancalar)
type AnyHandler = Handler<keyof OpMap>;
/**
 * kamp/bölüm işleyicilerini sarar: işlem başarılı olunca ilgili sayaç artar (aynı işlem içinde; kanca hatası işlemi bozmaz).
 * Kamp büyümesi işlemleri (dekor yerleştirme, ziyaret) GROWTH_OP_METRICS ile eşlenir.
 */
export function withKgHooks(h: Handlers): Handlers {
  const out: Handlers = { ...h };
  const wrap = <O extends keyof OpMap>(op: O, after: (app: App, pid: string, req: OpMap[O]['req'], res: OpMap[O]['res']) => void) => {
    const inner = h[op] as Handler<O> | undefined; if (!inner) return;
    (out as Record<string, unknown>)[op] = ((app: App, s: Parameters<Handler<O>>[1], d: OpMap[O]['req']) => {
      const res = inner(app, s, d) as OpMap[O]['res'];
      try { after(app, s.pid, d, res); } catch (e) { if (app.cfg.log) console.error('[kamp görevi kancası]', op, e); }
      return res;
    }) as Handler<O>;
  };
  wrap('camp.collect', (app, pid, _d, r) => { if (r.collected > 0) kgBump(app, pid, 'depo-topla'); });
  wrap('camp.remedy.collect', (app, pid, _d, r) => { if (r.collected > 0) kgBump(app, pid, 'malzeme', r.collected); });
  wrap('camp.remedy.make', (app, pid, _d, r) => { if (r.collected > 0) kgBump(app, pid, 'malzeme', r.collected); else kgDirty(app, pid); });
  wrap('camp.upgrade', (app, pid) => { kgBump(app, pid, 'insaat'); });
  wrap('camp.speedup', (app, pid) => { kgDirty(app, pid); });
  wrap('camp.state', (app, pid) => { kgDirty(app, pid); });
  wrap('team.camp.help', (app, pid, _d, r) => { kgBump(app, pid, 'yardim', r.given); });
  wrap('team.camp.helpAll', (app, pid, _d, r) => { if (r.given > 0) kgBump(app, pid, 'yardim', r.given); });
  wrap('progress.submit', (app, pid, d) => {
    if (d.completed) kgBump(app, pid, 'bolum', 1, `run:${d.runId}`);
    const used = (d.remediesUsed ?? []).reduce((a, u) => a + u.count, 0);
    if (used > 0 && !d.raceId) kgBump(app, pid, 'malzeme-kullan', used, `rem:${d.runId}`);
    kgDirty(app, pid);
  });
  for (const op of ['team.join', 'team.create', 'team.leave', 'progress.sync', 'code.redeem', 'admin.set'] as const) wrap(op, (app, pid) => kgDirty(app, pid));
  // kamp büyümesi işlemleri (varsa): dekor yerleştirme, kamp ziyareti
  for (const [op, metric] of Object.entries(GROWTH_OP_METRICS)) {
    const inner = (h as Record<string, AnyHandler | undefined>)[op]; if (!inner) continue;
    (out as Record<string, unknown>)[op] = ((app: App, s: Parameters<AnyHandler>[1], d: never) => {
      const res = inner(app, s, d);
      try { kgBump(app, s.pid, metric); } catch (e) { if (app.cfg.log) console.error('[kamp görevi kancası]', op, e); }
      return res;
    }) as AnyHandler;
  }
  return out;
}
