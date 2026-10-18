import { describe, expect, it } from 'vitest';
import { HUMAN_JOURNEY } from '@odi/content';
import { buildLayout, nextVitalityNeed, planReturn, pointAt, unlockedOf, vitalityOf, zoneOfLevels, finaleVitality, type StarMap } from './layout';

const upTo = (n: number, s = 2): StarMap => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, s]));

describe('harita yerleşimi', () => {
  const L = buildLayout();
  it('40 düğüm, alttan üste sıralı, dünya içinde', () => {
    expect(L.nodes).toHaveLength(HUMAN_JOURNEY.levels.length);
    for (let i = 1; i < L.nodes.length; i++) expect(L.nodes[i]!.y).toBeLessThan(L.nodes[i - 1]!.y);
    for (const n of L.nodes) { expect(n.x).toBeGreaterThan(40); expect(n.x).toBeLessThan(L.width - 40); expect(n.y).toBeGreaterThan(0); expect(n.y).toBeLessThan(L.height); }
    expect(L.height).toBeGreaterThan(6500);
  });
  it('10 biyom bölgesi + final; geri dönen kanal bölümleri kemikçik bölgesinde', () => {
    expect(L.zones.map((z) => z.id)).toEqual(['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks', 'finale']);
    const z = zoneOfLevels(); expect(z[16]).toBe('kemikcikler'); expect(z[19]).toBe('kemikcikler');
    for (const zone of L.zones) expect(zone.top).toBeLessThan(zone.bottom);
  });
  it('yol düğümlerden geçer ve uzunluk konumları artar', () => {
    for (let i = 1; i < L.nodes.length; i++) expect(L.nodes[i]!.s).toBeGreaterThan(L.nodes[i - 1]!.s);
    for (const n of L.nodes) { const p = pointAt(L, n.s); expect(Math.hypot(p.x - n.x, p.y - n.y)).toBeLessThan(1); }
  });
});

describe('canlanma', () => {
  it('yeni oyuncu: yalnız dış kulak uyanık', () => {
    expect(vitalityOf('dis-kulak', {})).toBe(1); expect(vitalityOf('kanal', {})).toBe(0);
  });
  it('8 bölüm: dış kulak canlı, kanal yarıyı geçti, zar uyanıyor', () => {
    const s = upTo(8); expect(unlockedOf(s)).toBe(9);
    expect(vitalityOf('dis-kulak', s)).toBe(3); expect(vitalityOf('kanal', s)).toBe(2); expect(vitalityOf('zar', s)).toBe(1); expect(vitalityOf('kemikcikler', s)).toBe(0);
  });
  it('hepsi 3 yıldız: 4; final', () => {
    const s = upTo(40, 3); expect(vitalityOf('korteks', s)).toBe(4); expect(finaleVitality(s)).toBe(4); expect(finaleVitality(upTo(39))).toBe(1);
    expect(nextVitalityNeed('zar', upTo(12, 2))).toEqual({ to: 4, stars: 4 });
  });
});

describe('dönüş sahnesi', () => {
  it('yeni yıldız + hazine + yürüyüş + bölge yükselişi sırayla', () => {
    const steps = planReturn(upTo(4), upTo(5));
    expect(steps.map((s) => s.kind)).toEqual(['stars', 'treasure', 'zone', 'walk', 'zone']);
    expect(steps[2]).toMatchObject({ zone: 'dis-kulak', from: 2, to: 3 });
    expect(steps[4]).toMatchObject({ zone: 'kanal', from: 0, to: 1 });
  });
  it('tekrar oynanan bölümde yalnız yıldız', () => {
    expect(planReturn({ ...upTo(3), 2: 1 }, upTo(3)).map((s) => s.kind)).toEqual(['stars']);
  });
  it('değişiklik yoksa boş; son bölüm finale yürür', () => {
    expect(planReturn(upTo(6), upTo(6))).toEqual([]);
    expect(planReturn(upTo(39), upTo(40)).find((s) => s.kind === 'walk')).toEqual({ kind: 'walk', from: 40, to: 'finale' });
  });
});
