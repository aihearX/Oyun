/**
 * Geliştirme önizlemesi: `?demo=kamp&seviye=1..25[&kampsv=1..30][&insaat=<bina>]` — kampı sunucusuz, yerel sahte durumla gösterir.
 * Yalnızca localhost/127.0.0.1 (geliştirme, önizleme) üzerinde etkindir; üretim alan adında yok sayılır. Hiçbir şey kaydedilmez/gönderilmez.
 */
import { BUILDINGS, buildCost, crystalsToFinish, type BuildingId, type CampState, type Wallet } from '@odi/shared';
import { depotStored } from '@odi/game-core';
import { CAMP_LEVEL_MAX, CAMP_XP, REMEDY_INV_CAP, campLevelRewards, campXpNeed, campXpState, campXpTotalFor, cellFree, decorById, decorSlots, footprint, libStored, pointCell, remedyById, remedyShelf } from '@odi/content';
import type { DecorPlaced } from '@odi/shared';

export interface DemoParams { level: number; build: BuildingId | null; campLevel: number }
export function demoParams(): DemoParams | null {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('demo') !== 'kamp') return null;
    const dev = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (!dev) return null;
    const level = Math.max(1, Math.min(25, Math.round(Number(q.get('seviye') ?? 5)) || 5));
    const b = q.get('insaat'); const build = BUILDINGS.some((x) => x.id === b) ? (b as BuildingId) : null;
    const campLevel = Math.max(1, Math.min(CAMP_LEVEL_MAX, Math.round(Number(q.get('kampsv') ?? Math.ceil(level * 1.2))) || 1));
    return { level, build, campLevel };
  } catch { return null; }
}

/** seviyeye göre gerçekçi bir kamp (diğer binalar merkezin biraz gerisinde) */
export function demoCamp(p: DemoParams, now = Date.now()): { camp: CampState; wallet: Wallet } {
  const L = p.level;
  const lv: Record<BuildingId, number> = {
    merkez: L, laboratuvar: L, depo: L, kule: Math.max(L === 1 ? 0 : 1, L - 1), atolye: Math.max(L === 1 ? 0 : 1, L - 1), revir: Math.max(0, L - 2), tedavi: Math.max(0, L - 1),
    kabin: 0, tarama: 0, park: 0, denge: 0, kutuphane: 0,
  };
  // bölge binaları: bölgesi açıksa (Kamp Seviyesi) merkezin birkaç seviye gerisinde
  for (const d of BUILDINGS) if (d.campLevel && p.campLevel >= d.campLevel) lv[d.id] = Math.max(1, Math.min(d.maxLevel, L - Math.round((d.campLevel - 2) / 3)));
  const xp = campXpState(campXpTotalFor(p.campLevel) + Math.round(campXpNeed(p.campLevel) * 0.4));
  // örnek süsler: seviyeye göre birkaç tanesi yerleşik, kalanı envanterde
  const inv: Record<string, number> = {};
  for (let l = 1; l <= p.campLevel; l++) for (const r of campLevelRewards(l)) if (r.kind === 'sus') inv[r.id] = (inv[r.id] ?? 0) + r.n;
  const spots: [number, number][] = [[-120, 110], [120, 118], [-300, 150], [300, 150], [-200, 220], [210, 230], [-380, 40], [380, 30], [-90, 240], [80, 250], [-460, -60], [470, -60]];
  const placed: DecorPlaced[] = []; let uid = 1;
  for (const [id, n] of Object.entries(inv)) {
    if (placed.length >= Math.min(spots.length, decorSlots(p.campLevel, lv.park) - 1) || n <= 0) continue;
    const [x, y] = spots[placed.length]!; const [gx, gy] = pointCell(x, y);
    placed.push({ uid: uid++, id, gx, gy, flip: placed.length % 2 === 1 }); inv[id] = n - 1; if (!inv[id]) delete inv[id];
  }
  const camp: CampState = {
    serverTime: now, depotStoredAt: now - 9 * 3_600_000,
    xp, decor: { inv, placed, cap: decorSlots(p.campLevel, lv.park) }, libAt: now - 5 * 3_600_000, cheers: p.campLevel * 3,
    remedy: lv.tedavi > 0 ? { item: lv.tedavi >= 4 ? 'ventilasyon-tupu' : 'kulak-tikaci', since: now - 3 * 3_600_000, inv: lv.tedavi >= 4 ? { 'kulak-tikaci': 3, 'serumen-damlasi': 2, 'zar-yamasi': 1 } : { 'kulak-tikaci': 1 } } : { item: null, since: now, inv: {} },
    buildings: BUILDINGS.map((b) => {
      const building = p.build === b.id && lv[b.id] < b.maxLevel;
      const sec = buildCost(b.id, lv[b.id] + 1).seconds;
      return { id: b.id, level: lv[b.id], upgradingTo: building ? lv[b.id] + 1 : null, startedAt: building ? now - sec * 400 : null, endsAt: building ? now + sec * 600 : null, helpsReceived: building ? 2 : 0 };
    }),
  };
  return { camp, wallet: { jeton: 25_000 + L * 4000, kristal: 480, hizlandirici: { m5: 6, m60: 3, s8: 1 } } };
}

/** yerel eylemler: sunucu kurallarının sade bir kopyası (yalnızca önizleme) */
export type DemoOp = { k: 'upgrade'; id: BuildingId } | { k: 'speed'; id: BuildingId; item: 'm5' | 'm60' | 's8' | 'kristal' } | { k: 'collect' } | { k: 'complete' } | { k: 'remedyMake'; item: string | null } | { k: 'remedyCollect' }
  | { k: 'decorPlace'; id: string; gx: number; gy: number; flip: boolean } | { k: 'decorMove'; uid: number; gx: number; gy: number; flip: boolean } | { k: 'decorStore'; uid: number } | { k: 'lib' };
/** önizlemede süs yeri uygun mu (sunucu kuralının aynısı) */
function demoFits(camp: CampState, id: string, gx: number, gy: number, except?: number): boolean {
  const taken = new Set<string>(); const lv = camp.xp?.level ?? 1;
  for (const p of camp.decor?.placed ?? []) if (p.uid !== except) for (const [x, y] of footprint(p.gx, p.gy, decorById(p.id)?.size ?? 1)) taken.add(`${x},${y}`);
  return footprint(gx, gy, decorById(id)?.size ?? 1).every(([x, y]) => cellFree(x, y, lv) && !taken.has(`${x},${y}`));
}
export function demoReduce(s: { camp: CampState; wallet: Wallet }, op: DemoOp, now = Date.now()): { camp: CampState; wallet: Wallet; collected?: number; error?: string } {
  const camp = { ...s.camp, serverTime: now, buildings: s.camp.buildings.map((b) => ({ ...b })), remedy: s.camp.remedy ? { ...s.camp.remedy, inv: { ...s.camp.remedy.inv } } : undefined,
    decor: s.camp.decor ? { ...s.camp.decor, inv: { ...s.camp.decor.inv }, placed: s.camp.decor.placed.map((p) => ({ ...p })) } : undefined }; const wallet = { ...s.wallet, hizlandirici: { ...s.wallet.hizlandirici } };
  if (op.k === 'decorPlace' || op.k === 'decorMove' || op.k === 'decorStore') {
    const d = camp.decor ?? { inv: {}, placed: [], cap: 4 }; camp.decor = d;
    if (op.k === 'decorPlace') {
      if (!(d.inv[op.id] ?? 0) || d.placed.length >= d.cap || !demoFits(camp, op.id, op.gx, op.gy)) return { camp: s.camp, wallet: s.wallet, error: 'YER' };
      d.inv[op.id]! -= 1; if (!d.inv[op.id]) delete d.inv[op.id];
      d.placed.push({ uid: Math.max(0, ...d.placed.map((p) => p.uid)) + 1, id: op.id, gx: op.gx, gy: op.gy, flip: op.flip });
    } else if (op.k === 'decorMove') {
      const p = d.placed.find((x) => x.uid === op.uid); if (!p || !demoFits(camp, p.id, op.gx, op.gy, op.uid)) return { camp: s.camp, wallet: s.wallet, error: 'YER' };
      p.gx = op.gx; p.gy = op.gy; p.flip = op.flip;
    } else { const p = d.placed.find((x) => x.uid === op.uid); if (p) { d.placed = d.placed.filter((x) => x.uid !== op.uid); d.inv[p.id] = (d.inv[p.id] ?? 0) + 1; } }
    return { camp, wallet };
  }
  if (op.k === 'lib') { const lv = camp.buildings.find((b) => b.id === 'kutuphane')?.level ?? 0; const st = libStored(lv, camp.libAt ?? 0, now); camp.libAt = now; if (camp.xp && st.stored) camp.xp = campXpState(camp.xp.total + st.stored); return { camp, wallet, collected: st.stored }; }
  if (op.k === 'remedyMake' || op.k === 'remedyCollect') {
    const r = camp.remedy ?? { item: null, since: now, inv: {} }; camp.remedy = r;
    const lv = camp.buildings.find((b) => b.id === 'tedavi')?.level ?? 0; const def = r.item ? remedyById(r.item) : undefined;
    let collected = 0;
    if (def) { const sh = remedyShelf(def, lv, r.since, now); collected = Math.max(0, Math.min(sh.ready, REMEDY_INV_CAP - (r.inv[def.id] ?? 0))); r.inv[def.id] = (r.inv[def.id] ?? 0) + collected; r.since = sh.nextSince - (sh.ready - collected) * sh.periodMs; }
    if (op.k === 'remedyMake') { r.item = op.item; r.since = now; }
    return { camp, wallet, collected };
  }
  if (op.k === 'upgrade') {
    const b = camp.buildings.find((x) => x.id === op.id)!; const c = buildCost(op.id, b.level + 1);
    wallet.jeton -= c.jeton; b.upgradingTo = b.level + 1; b.startedAt = now; b.endsAt = now + Math.min(c.seconds, 90) * 1000; b.helpsReceived = 0;
  } else if (op.k === 'speed') {
    const b = camp.buildings.find((x) => x.id === op.id)!; if (!b.endsAt) return s;
    if (op.item === 'kristal') { wallet.kristal -= crystalsToFinish(Math.ceil((b.endsAt - now) / 1000)); b.endsAt = now; }
    else { wallet.hizlandirici[op.item] -= 1; b.endsAt -= ({ m5: 300, m60: 3600, s8: 28_800 })[op.item] * 1000; }
  } else if (op.k === 'collect') {
    const d = camp.buildings.find((x) => x.id === 'depo')!; const st = depotStored(d.level, camp.depotStoredAt, now);
    wallet.jeton += st.stored; camp.depotStoredAt = now;
    return { camp, wallet, collected: st.stored };
  }
  for (const b of camp.buildings) if (b.upgradingTo && b.endsAt && b.endsAt <= now) { if (b.id === 'depo' && b.level === 0) camp.depotStoredAt = now; if (camp.xp) camp.xp = campXpState(camp.xp.total + CAMP_XP.build(b.id, b.upgradingTo)); b.level = b.upgradingTo; b.upgradingTo = null; b.startedAt = null; b.endsAt = null; b.helpsReceived = 0; }
  return { camp, wallet };
}
