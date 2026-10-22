import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '@odi/shared';
import { DEFAULT_SKILLS } from '@odi/content';
import { generateLevel } from './generate';

/**
 * Diken seyrekliği (docs/12 §4; oyuncu geri bildirimi: "yerden çıkan kırmızı dikenler oyunu çok zorlaştırıyor"):
 * 1-5'te hiç diken yok; 6-12'de bölüm-içi bölüm başına en çok bir, kontrol noktası ve geri dönüş odalarında hiç; 13+'da
 * 1000 px başına en çok 0,9 (eskiden 1,1-1,7); nabız (zamanlı) tehlike ilk iki bölgede (1-8) yok.
 */
const gen = (n: number, salt: number) => generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, salt);
const salts = [0, 1, 2, 3];
const spikesOf = (n: number, salt: number) => {
  const sp = gen(n, salt); const st = sp.sectionStarts ?? [0]; const per = [0, 0, 0]; let all = 0; const calm: string[] = [];
  sp.chunks.forEach((c, i) => {
    const k = c.entities.filter((e) => e.type === 'spike').length; if (!k) return;
    all += k; per[Math.max(0, st.filter((s) => i >= s).length - 1)]! += k;
    if (c.id.startsWith('cp-')) calm.push(c.id);
  });
  return { all, per, calm, len: sp.chunks.reduce((a, c) => a + c.length, 0), sp };
};

describe('diken seyrekliği', () => {
  it('1-5: hiç diken yok', () => {
    for (let n = 1; n <= 5; n++) for (const salt of salts) expect(spikesOf(n, salt).all, `${n}/${salt}`).toBe(0);
  });
  it('6-12: bölüm-içi bölüm başına en çok bir diken, hepsi zeminde, kontrol noktası odasında hiç', () => {
    for (let n = 6; n <= 12; n++) for (const salt of salts) {
      const r = spikesOf(n, salt);
      for (const k of r.per) expect(k, `${n}/${salt} ${JSON.stringify(r.per)}`).toBeLessThanOrEqual(1);
      expect(r.calm, `${n}/${salt}`).toEqual([]);
      for (const c of r.sp.chunks) for (const e of c.entities) if (e.type === 'spike') expect(e.y, `${n}/${salt} ${c.id}`).toBe(GROUND_Y);
    }
  });
  it('13+: 1000 px başına en çok 0,9 diken, kontrol noktası odasında hiç', () => {
    for (let n = 13; n <= 39; n++) { if (n === 20) continue; for (const salt of [0, 1]) {
      const r = spikesOf(n, salt);
      expect((r.all / r.len) * 1000, `${n}/${salt}`).toBeLessThanOrEqual(0.9);
      expect(r.calm, `${n}/${salt}`).toEqual([]);
    } }
  });
  it('nabız (zamanlı) tehlike ilk iki bölgede (1-8) yok', () => {
    for (let n = 1; n <= 8; n++) for (const salt of salts) for (const c of gen(n, salt).chunks) {
      expect(c.entities.filter((e) => e.type === 'hazard' && Number(e.props?.on ?? 0) > 0).map(() => `${n}/${salt} ${c.id}`)).toEqual([]);
    }
  });
});
