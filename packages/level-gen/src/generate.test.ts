import { describe, it, expect } from 'vitest';
import { generateLevel, DEFAULT_PROFILE, MAX_NOTES } from './generate';
import { validateChunks, HUMAN_JOURNEY, abilitiesAt, chunkNeeds, newAbilitiesAt } from '@odi/content';
import type { LevelSpec } from '@odi/shared';

const ALL = HUMAN_JOURNEY.levels.map((l) => generateLevel('insan', l.number));
const normal = ALL.filter((s) => s.mechanic !== 'boss');
const notesOf = (s: LevelSpec) => s.chunks.reduce((a, c) => a + c.entities.reduce((b, e) => b + (e.type === 'coin' ? 1 : e.type === 'collect' ? 5 : 0), 0), 0);

describe('içerik', () => {
  it('tüm parçalar şemaya uyar', () => { expect(validateChunks()).toEqual([]); });
});

describe('bölüm üretici', () => {
  it('deterministik: aynı bölüm aynı parçalar', () => {
    const a = generateLevel('insan', 3), b = generateLevel('insan', 3);
    expect(a.chunks.map((c) => c.id)).toEqual(b.chunks.map((c) => c.id));
  });
  it('40 bölümün hepsi üretilir; boss bölümleri arenadır', () => {
    expect(ALL).toHaveLength(40);
    for (const s of ALL) { if (s.mechanic === 'boss') { expect(s.boss).toBeTruthy(); expect(s.chunks).toHaveLength(0); } else expect(s.chunks.length).toBeGreaterThanOrEqual(6); }
  });
  it('her bölüm 3 bölüm-içi bölümden oluşur; 2. ve 3. bölüm kontrol noktasıyla başlar', () => {
    for (const s of normal) {
      expect(s.sectionStarts).toHaveLength(3);
      const [a, b, c] = s.sectionStarts!; expect(a).toBe(0); expect(b).toBeGreaterThan(a!); expect(c).toBeGreaterThan(b!);
      for (const k of [b!, c!]) expect(s.chunks[k]!.entities.some((e) => e.type === 'checkpoint')).toBe(true);
    }
  });
  it('3 gizli altın koklea (her bölüm-içi bölümde bir) ve en çok 100 nota', () => {
    for (const s of normal) {
      expect(s.cochleasTotal).toBe(3);
      const secrets = s.chunks.map((c, i) => c.entities.filter((e) => e.type === 'secret').length > 0 ? i : -1).filter((i) => i >= 0);
      expect(s.chunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'secret').length, 0)).toBe(3);
      const st = s.sectionStarts!; const sec = (i: number) => (i >= st[2]! ? 2 : i >= st[1]! ? 1 : 0);
      expect(new Set(secrets.map(sec)).size).toBe(3);
      expect(notesOf(s)).toBeLessThanOrEqual(MAX_NOTES); expect(notesOf(s)).toBeGreaterThanOrEqual(40);
      expect(s.coinsTotal).toBe(notesOf(s));
    }
  });
  it('yetenekler yalnızca açıldıktan sonra kullanılır', () => {
    for (const s of ALL) {
      expect(s.abilities).toEqual(abilitiesAt(s.number));
      const open = new Set(s.abilities);
      for (const c of s.chunks) for (const a of chunkNeeds(c)) expect(open.has(a), `${s.number}: ${c.id} → ${a}`).toBe(true);
    }
  });
  it('yeni yetenek açılan bölüm, o yeteneğin öğretici anıyla başlar', () => {
    for (const s of normal) {
      const fresh = newAbilitiesAt(s.number); expect(s.newAbilities).toEqual(fresh);
      const tutors = s.chunks.slice(0, s.sectionStarts![1]).flatMap((c) => c.entities.filter((e) => e.type === 'tutor').map((e) => e.props?.ability));
      for (const a of fresh) expect(tutors, `${s.number}`).toContain(a);
      // eski yeteneğin öğretici anı tekrar tetiklenmez
      for (const c of s.chunks) for (const e of c.entities) if (e.type === 'tutor') expect(fresh).toContain(e.props?.ability);
    }
  });
  it('her biyomda en az bir gösteri parçası kullanılır', () => {
    const biomes = new Set(normal.map((s) => s.biome));
    for (const b of biomes) expect(normal.filter((s) => s.biome === b).some((s) => s.chunks.some((c) => c.setPiece)), b).toBe(true);
  });
  it('her bölüm farklı: iki bölümün oda kümesi en çok %60 örtüşür', () => {
    // dinlenme, mikro ve doruk gösterisi odaları hariç (gösteri, biyomun bölümleri arasında dönüşümlü kullanılan doruktur)
    const sets = normal.map((s) => new Set(s.chunks.filter((c) => !c.rest && !c.setPiece && !c.tags.includes('mikro')).map((c) => c.id)));
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i]!, b = sets[j]!; const inter = [...a].filter((x) => b.has(x)).length; const uni = new Set([...a, ...b]).size;
      expect(inter / uni, `${normal[i]!.number} ~ ${normal[j]!.number}`).toBeLessThanOrEqual(0.6);
    }
  });
  it('zorluk eğrisi yükselir', () => {
    const avg = (from: number, to: number) => { const l = normal.filter((s) => s.number >= from && s.number <= to); const cs = l.flatMap((s) => s.chunks.filter((c) => !c.rest && !c.tags.includes('ogretici'))); return cs.reduce((a, c) => a + c.difficulty, 0) / cs.length; };
    const quarters = [avg(1, 10), avg(11, 20), avg(21, 30), avg(31, 39)];
    for (let i = 1; i < quarters.length; i++) expect(quarters[i]!).toBeGreaterThan(quarters[i - 1]!);
  });
  it('zorluk profille değişir', () => {
    const easy = generateLevel('insan', 27, { ...DEFAULT_PROFILE, failStreak: 3 });
    const hard = generateLevel('insan', 27, { ...DEFAULT_PROFILE, recentStars: 3 });
    const avg = (s: typeof easy) => s.chunks.reduce((a, c) => a + c.difficulty, 0) / s.chunks.length;
    expect(avg(hard)).toBeGreaterThanOrEqual(avg(easy));
  });
});
