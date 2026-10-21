/**
 * Geliştirme önizlemesi: `?demo=kamp&seviye=1|5|10|15[&insaat=<bina>]` — kampı sunucusuz, yerel sahte durumla gösterir.
 * Yalnızca localhost/127.0.0.1 (geliştirme, önizleme) üzerinde etkindir; üretim alan adında yok sayılır. Hiçbir şey kaydedilmez/gönderilmez.
 */
import { BUILDINGS, buildCost, crystalsToFinish, type BuildingId, type CampState, type Wallet } from '@odi/shared';
import { depotStored } from '@odi/game-core';
import { REMEDY_INV_CAP, remedyById, remedyShelf } from '@odi/content';

export interface DemoParams { level: number; build: BuildingId | null }
export function demoParams(): DemoParams | null {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('demo') !== 'kamp') return null;
    const dev = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (!dev) return null;
    const level = Math.max(1, Math.min(15, Math.round(Number(q.get('seviye') ?? 5)) || 5));
    const b = q.get('insaat'); const build = BUILDINGS.some((x) => x.id === b) ? (b as BuildingId) : null;
    return { level, build };
  } catch { return null; }
}

/** seviyeye göre gerçekçi bir kamp (diğer binalar merkezin biraz gerisinde) */
export function demoCamp(p: DemoParams, now = Date.now()): { camp: CampState; wallet: Wallet } {
  const L = p.level;
  const lv: Record<BuildingId, number> = {
    merkez: L, laboratuvar: L, depo: L, kule: Math.max(L === 1 ? 0 : 1, L - 1), atolye: Math.max(L === 1 ? 0 : 1, L - 1), revir: Math.max(0, L - 2), tedavi: Math.max(0, L - 1),
  };
  const camp: CampState = {
    serverTime: now, depotStoredAt: now - 9 * 3_600_000,
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
export function demoReduce(s: { camp: CampState; wallet: Wallet }, op: { k: 'upgrade'; id: BuildingId } | { k: 'speed'; id: BuildingId; item: 'm5' | 'm60' | 's8' | 'kristal' } | { k: 'collect' } | { k: 'complete' } | { k: 'remedyMake'; item: string | null } | { k: 'remedyCollect' }, now = Date.now()): { camp: CampState; wallet: Wallet; collected?: number } {
  const camp = { ...s.camp, serverTime: now, buildings: s.camp.buildings.map((b) => ({ ...b })), remedy: s.camp.remedy ? { ...s.camp.remedy, inv: { ...s.camp.remedy.inv } } : undefined }; const wallet = { ...s.wallet, hizlandirici: { ...s.wallet.hizlandirici } };
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
  for (const b of camp.buildings) if (b.upgradingTo && b.endsAt && b.endsAt <= now) { if (b.id === 'depo' && b.level === 0) camp.depotStoredAt = now; b.level = b.upgradingTo; b.upgradingTo = null; b.startedAt = null; b.endsAt = null; b.helpsReceived = 0; }
  return { camp, wallet };
}
