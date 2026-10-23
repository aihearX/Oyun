import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingId } from '@odi/shared';
import { CAMP_LEVEL_MAX, CAMP_LEVEL_REWARDS, campLevelCosmetics, campTitle, decorSlots, remedyInvCap, taramaFactor, depotCapHours, libStored, buildingOpen } from './kamp-seviye';
import { CAMP_LOTS, DISTRICTS, ISLAND, KULAK_YOLU, bridgeOf, cellFree, cellPoint, districtOfBuilding, footprint, inDistrict, onIsland, pointCell } from './kamp-arazi';
import { DECORATIONS, MONUMENT_DECOR, decorById } from './kamp-susler';
import { COSMETICS } from './cosmetics';
import { BUILDING_INFO, CAMP_TERMS } from './kamp';

const BAD = /Ã|Ä|Å|Ð|Þ|�|\s{2,}|\s[,.;:!?]|TODO|XXX|lorem|[Ѐ-ӿ]/i;
function sane(s: string, where: string) {
  expect(s.trim(), where).toBe(s);
  expect(BAD.test(s), `${where}: “${s}”`).toBe(false);
  expect(/salyangoz/i.test(s), `${where}: Koklea denmeli`).toBe(false);
}
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe('Kamp Seviyesi ödülleri', () => {
  it('her seviyenin görünür bir ödülü var; ödüller tutarlı', () => {
    for (let l = 1; l <= CAMP_LEVEL_MAX; l++) expect(CAMP_LEVEL_REWARDS[l]?.length, `Sv ${l}`).toBeGreaterThan(0);
    for (const rs of Object.values(CAMP_LEVEL_REWARDS)) for (const r of rs) {
      if (r.kind === 'sus') { expect(decorById(r.id), r.id).toBeTruthy(); expect(decorById(r.id)!.from).toContain('seviye'); }
      if (r.kind === 'unvan') sane(r.name, 'unvan');
    }
    // bina yerleri BUILDINGS.campLevel ile, araziler DISTRICTS.level ile aynı
    for (const b of BUILDINGS.filter((x) => x.campLevel)) {
      const at = Object.entries(CAMP_LEVEL_REWARDS).find(([, rs]) => rs.some((r) => r.kind === 'bina' && r.building === b.id));
      expect(Number(at?.[0]), b.id).toBe(b.campLevel);
      expect(buildingOpen(b.id, b.campLevel! - 1)).toBe(false); expect(buildingOpen(b.id, b.campLevel!)).toBe(true);
      const d = districtOfBuilding(b.id); expect(d, b.id).toBeTruthy(); expect(b.campLevel!).toBeGreaterThanOrEqual(d!.level);
    }
    for (const d of DISTRICTS) {
      const at = Object.entries(CAMP_LEVEL_REWARDS).find(([, rs]) => rs.some((r) => r.kind === 'arazi' && r.district === d.id));
      expect(Number(at?.[0]), d.id).toBe(d.level);
      sane(d.name, d.id); sane(d.plain, d.id);
    }
    // kozmetikler cosmetics.ts'te { by: 'kamp' } ile tanımlı
    const cos = campLevelCosmetics(CAMP_LEVEL_MAX);
    expect(cos.length).toBeGreaterThanOrEqual(2);
    for (const id of cos) { const c = COSMETICS.find((x) => x.id === id); expect(c, id).toBeTruthy(); expect(c!.unlock.by).toBe('kamp'); }
    expect(COSMETICS.filter((c) => c.unlock.by === 'kamp').map((c) => c.id).sort()).toEqual([...cos].sort());
  });
  it('unvan, süs yeri, çanta ve bina etkileri seviyeyle büyür', () => {
    expect(campTitle(1)).toBe('Kamp Çırağı'); expect(campTitle(5)).toBe('Kulak Kaşifi'); expect(campTitle(30)).toBe('Kulak Adası Efsanesi');
    expect(decorSlots(1, 0)).toBe(4); expect(decorSlots(30, 0)).toBeGreaterThan(30); expect(decorSlots(5, 3) - decorSlots(5, 0)).toBe(6);
    expect([1, 13, 14, 24, 30].map(remedyInvCap)).toEqual([9, 9, 12, 15, 15]);
    expect(taramaFactor(0)).toBe(1); expect(taramaFactor(10)).toBeCloseTo(0.8); expect(taramaFactor(40)).toBe(0.6);
    expect(depotCapHours(0)).toBe(8); expect(depotCapHours(20)).toBe(18);
    expect(libStored(2, 1000, 1000 + 3_600_000)).toEqual({ stored: 4, max: 48, ratio: 4 / 48 });
    expect(libStored(0, 1000, 9e9).stored).toBe(0);
  });
});

describe('Kamp arazisi', () => {
  it('bölgeler ana adayla ve birbiriyle çakışmaz; köprü iki karayı bağlar', () => {
    for (const d of DISTRICTS) {
      for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; const x = d.cx + Math.cos(a) * d.rx * 1.12, y = d.cy + Math.sin(a) * d.ry * 1.12; expect(onIsland(x, y, 1.06), `${d.id} ana adaya değiyor`).toBe(false); }
      for (const e of DISTRICTS) if (e.id !== d.id) expect(inDistrict(e, d.cx, d.cy, 1.3), `${d.id}/${e.id}`).toBe(false);
      const b = bridgeOf(d); expect(onIsland(b.x0, b.y0, 1.0)).toBe(true); expect(inDistrict(d, b.x1, b.y1, 1.0)).toBe(true);
      expect(Math.hypot(b.x1 - b.x0, b.y1 - b.y0)).toBeLessThan(260);
    }
  });
  it('bölge binalarının arsası kendi bölgesinde; ana binalar ana adada', () => {
    for (const id of Object.keys(CAMP_LOTS) as BuildingId[]) {
      const l = CAMP_LOTS[id]; const d = districtOfBuilding(id);
      if (d) expect(inDistrict(d, l.x, l.y, 0.6), id).toBe(true); else expect(onIsland(l.x, l.y, 0.8), id).toBe(true);
      expect(BUILDING_INFO[id], id).toBeTruthy();
    }
    expect(Object.keys(CAMP_LOTS).sort()).toEqual(BUILDINGS.map((b) => b.id).sort());
  });
  it('süs ızgarası: dönüşüm tutarlı, arsa/anıt/deniz dolu, bölge açılınca yer açılır', () => {
    for (const [gx, gy] of [[0, 0], [3, -7], [-12, 5]] as const) expect(pointCell(...cellPoint(gx, gy))).toEqual([gx, gy]);
    expect(cellFree(...pointCell(CAMP_LOTS.merkez.x, CAMP_LOTS.merkez.y), 30)).toBe(false);
    expect(cellFree(...pointCell(KULAK_YOLU[0]!.x, KULAK_YOLU[0]!.y - 4), 30)).toBe(false);
    expect(cellFree(...pointCell(0, ISLAND.ry * 1.7), 30)).toBe(false);
    expect(cellFree(...pointCell(-120, 110), 1)).toBe(true);
    const koy = DISTRICTS.find((d) => d.id === 'koy')!; const spot = pointCell(koy.cx + 40, koy.cy + 120);
    expect(cellFree(...spot, koy.level - 1)).toBe(false); expect(cellFree(...spot, koy.level)).toBe(true);
    expect(footprint(2, 3, 2)).toEqual([[2, 3], [2, 4], [3, 3], [3, 4]]);
  });
});

describe('Süslemeler', () => {
  it('eşsiz, Türkçe, doğru terimler; anıt süsleri geçerli', () => {
    expect(DECORATIONS.length).toBeGreaterThanOrEqual(20);
    expect(dupes(DECORATIONS.map((d) => d.id))).toEqual([]);
    expect(dupes(DECORATIONS.map((d) => d.name))).toEqual([]);
    for (const d of DECORATIONS) { expect(d.id).toMatch(/^[a-z0-9-]+$/); sane(d.name, d.id); sane(d.plain, d.id); expect(d.plain.endsWith('.')).toBe(true); expect(d.plain.length).toBeLessThanOrEqual(170); }
    for (const [r, x] of Object.entries(MONUMENT_DECOR)) { expect(decorById(x.id), r).toBeTruthy(); expect(decorById(x.id)!.from).toContain('anit'); }
    expect(DECORATIONS.filter((d) => d.from.includes('gorev')).length).toBeGreaterThanOrEqual(2);
  });
  it('yeni bina terimleri ve açıklamaları Türkçe', () => {
    for (const t of CAMP_TERMS) { sane(t.term, t.id); sane(t.plain, t.id); sane(t.tech, t.id); }
    for (const i of Object.values(BUILDING_INFO)) { sane(i.plain, 'info'); sane(i.tech, 'info'); }
  });
});
