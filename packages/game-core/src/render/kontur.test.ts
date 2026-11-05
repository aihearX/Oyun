import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '@odi/shared';
import { DEFAULT_SKILLS } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { setup, testSpec } from '../play/testkit';
import type { World } from '../play/world';
import { zeminKonturu, type KonturCizgi, type KonturRect } from './kontur';

/** LevelScene.drawHiVis'in verdiği gibi: görünen katı zeminler (duvar sütunu ve tavan asılı) */
const zeminler = (w: World): KonturRect[] => w.ents.filter((e) => (e.type === 'platform' || e.type === 'wall') && !e.p.boss)
  .map((e) => ({ l: e.l, t: e.t, r: e.r, b: e.b, asili: e.type === 'wall' || !!e.p.tavan }));
const noktalar = (c: KonturCizgi) => Array.from({ length: c.pts.length / 2 }, (_, i) => [c.pts[2 * i]!, c.pts[2 * i + 1]!] as const);
/** kırık çizginin x = `x` boyunca kapsadığı dikey boy */
const yanBoyu = (cs: KonturCizgi[], x: number) => {
  let s = 0;
  for (const c of cs) { const p = noktalar(c); const n = c.kapali ? p.length : p.length - 1; for (let i = 0; i < n; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; if (Math.abs(a[0] - x) < 0.5 && Math.abs(b[0] - x) < 0.5) s += Math.abs(b[1] - a[1]); } }
  return s;
};

/** YN-268 (OT-buyuk-yazi-76): yüksek görünürlükte tavandan sarkan duvar sütununun bütün dış kenarı ve alt ucu açık çizgili */
describe('yüksek görünürlük zemin konturu (render/kontur.ts)', () => {
  const b11 = setup(generateLevel('insan', 11, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, 0)).w;
  const z11 = zeminler(b11);

  it('Bölüm 11: asılı sütunun alt ucu (Odi altından geçer) kesintisiz çizgiyle yanlara bağlı', () => {
    const asili = z11.filter((k) => k.asili && k.b < GROUND_Y - 40 && k.b - k.t > 200);
    expect(asili.length).toBeGreaterThan(0);
    for (const k of asili) {
      const cs = zeminKonturu(k, z11);
      // alt uç: sütunun tabanında, iki yanın arasında çizgi var ve yanlarla aynı kırık çizgide (köşe kopuk değil)
      const alt = cs.find((c) => noktalar(c).some(([x, y]) => Math.abs(y - k.b) < 0.5 && x > k.l && x < k.r));
      expect(alt, `sütun ${k.l},${k.t}-${k.r},${k.b}`).toBeDefined();
      const p = noktalar(alt!);
      expect(p.some(([x, y]) => Math.abs(x - k.l) < 0.5 && y < k.b - 100)).toBe(true);
      expect(p.some(([x, y]) => Math.abs(x - k.r) < 0.5 && y < k.b - 100)).toBe(true);
      // yanlar üstten alt köşeye dek (bitişik zeminin örttüğü yer hariç): düz zeminin 140 px'inden çok daha uzun
      expect(yanBoyu(cs, k.r)).toBeGreaterThan(k.b - k.t - 60);
      expect(yanBoyu(cs, k.l)).toBeGreaterThan(k.b - k.t - 60);
    }
  });

  it('Bölüm 11: yerdeki sütunun platform altından inen gövdesi çizgili, tabanı zeminle birleşik (alt çizgi yok)', () => {
    const yerde = z11.filter((k) => k.asili && Math.abs(k.b - GROUND_Y) < 1 && k.b - k.t > 200);
    expect(yerde.length).toBeGreaterThan(0);
    for (const k of yerde) {
      const cs = zeminKonturu(k, z11);
      // platformun bitiştiği yan da platformun altından yere dek çizili
      expect(Math.min(yanBoyu(cs, k.l), yanBoyu(cs, k.r))).toBeGreaterThan(k.b - k.t - 60);
      expect(cs.some((c) => noktalar(c).some(([x, y]) => Math.abs(y - k.b) < 0.5 && x > k.l + 1 && x < k.r - 1))).toBe(false);
    }
  });

  it('düz zemin ve platform önceki gibi: üst kenar + açık yanların üst 140 px\'i, alt çizgi yok', () => {
    const plat: KonturRect = { l: 100, t: GROUND_Y - 200, r: 260, b: GROUND_Y - 176 };
    const yer: KonturRect = { l: 300, t: GROUND_Y, r: 900, b: GROUND_Y + 400 };
    const yan: KonturRect = { l: 900, t: GROUND_Y, r: 1300, b: GROUND_Y + 400 };
    const all = [plat, yer, yan];
    expect(zeminKonturu(plat, all)).toEqual([{ pts: [100, GROUND_Y - 176, 100, GROUND_Y - 200, 260, GROUND_Y - 200, 260, GROUND_Y - 176], kapali: false }]);
    // bitişik zemin tarafında yan yok, açık tarafta 140 px
    expect(zeminKonturu(yer, all)).toEqual([{ pts: [300, GROUND_Y + 140, 300, GROUND_Y, 900, GROUND_Y], kapali: false }]);
  });

  it('ters yerçekimi tavanı da asılı: alt yüzü (tavanda koşulan yer) çizgili', () => {
    const w = setup(testSpec([{ type: 'platform', x: 0, y: GROUND_Y, w: 3000, h: 400 }], { modifiers: ['ters-yercekimi'] })).w;
    const z = zeminler(w); const tavan = w.ents.filter((e) => e.p.tavan);
    expect(tavan.length).toBeGreaterThan(0);
    for (const e of tavan) {
      const k = z.find((o) => o.l === e.l && o.t === e.t)!; expect(k.asili).toBe(true);
      const cs = zeminKonturu(k, z);
      const alt = noktalar(cs[0]!).filter(([, y]) => Math.abs(y - e.b) < 0.5);
      expect(Math.max(...alt.map(([x]) => x)) - Math.min(...alt.map(([x]) => x))).toBeGreaterThan(e.r - e.l - 40);
    }
  });
});
