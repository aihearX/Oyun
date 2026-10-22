import { describe, it, expect } from 'vitest';
import { generateLevel, levelKnobs, DEFAULT_PROFILE, MAX_NOTES } from './generate';
import { CURVE_ZONES, targetLambda } from './curve';
import { predictDmg, roomStats } from './rooms';
import { validateChunks, HUMAN_JOURNEY, abilitiesAt, chunkNeeds, newAbilitiesAt } from '@odi/content';
import type { LevelSpec } from '@odi/shared';

const ALL = HUMAN_JOURNEY.levels.map((l) => generateLevel('insan', l.number));
const normal = ALL.filter((s) => s.mechanic !== 'boss');
/** bölümün tahmini can kaybı: odaların bu bölümün sıkılığındaki ölçülen can kayıplarının toplamı */
const predicted = (s: LevelSpec) => s.chunks.reduce((a, c) => a + predictDmg(c, levelKnobs(s.number).tight), 0);
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
      // eski yeteneğin öğretici anı tekrar tetiklenmez (5. bölümün kayma tazeleme anı dışında)
      for (const c of s.chunks) for (const e of c.entities) if (e.type === 'tutor' && !e.props?.refresher) expect(fresh).toContain(e.props?.ability);
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
  it('zorluk eğrisi yükselir: bölümün tahmini can kaybı (ölçülen oda puanlarından) çeyreklerde artar', () => {
    const avg = (from: number, to: number) => { const l = normal.filter((s) => s.number >= from && s.number <= to); return l.reduce((a, s) => a + predicted(s), 0) / l.length; };
    const quarters = [avg(1, 10), avg(11, 20), avg(21, 30), avg(31, 39)];
    for (let i = 1; i < quarters.length; i++) expect(quarters[i]!).toBeGreaterThan(quarters[i - 1]!);
  });
  it('hedef eğri testere dişidir: bölge içinde yükselir, girişler ve finaller bölgeden bölgeye yükselir, boss doruktur', () => {
    for (const z of CURVE_ZONES) {
      for (let n = z.from + 1; n <= z.peak; n++) expect(targetLambda(n), `${n}`).toBeGreaterThan(targetLambda(n - 1));
      expect(targetLambda(z.from), `${z.name} girişi bir öncekinin finalinden düşük (nefes)`).toBeLessThan(targetLambda(Math.max(1, z.from - 1)) + (z.from === 1 ? 1 : 0));
    }
    for (let i = 1; i < CURVE_ZONES.length; i++) {
      expect(targetLambda(CURVE_ZONES[i]!.from)).toBeGreaterThan(targetLambda(CURVE_ZONES[i - 1]!.from));
      expect(targetLambda(CURVE_ZONES[i]!.peak)).toBeGreaterThan(targetLambda(CURVE_ZONES[i - 1]!.peak));
    }
    for (let n = 1; n < 20; n++) expect(targetLambda(20)).toBeGreaterThan(targetLambda(n));
    for (let n = 1; n < 40; n++) expect(targetLambda(40)).toBeGreaterThan(targetLambda(n));
  });
  it('alıştırma (1-3): düşman yok (3: yalnız kayma öğreticisindeki devriye), kısa çukur, geniş iniş, değiştirici yok', () => {
    for (const s of normal.filter((x) => x.number <= 3)) {
      expect(s.modifiers).toEqual([]);
      for (const c of s.chunks) {
        if (c.tags.includes('ogretici')) continue;
        expect(c.entities.some((e) => e.type === 'enemy'), `${s.number}: ${c.id}`).toBe(false);
        const st = roomStats(c); expect(st.maxGap, `${s.number}: ${c.id}`).toBeLessThanOrEqual(200);
      }
    }
  });
  it('değiştiriciler yalnızca ileri bölgelerde; tek can ve ters yerçekimi yolculukta yok', () => {
    for (const s of ALL) { if (s.number < 19) expect(s.modifiers).toEqual([]); expect(s.modifiers).not.toContain('tek-can'); expect(s.modifiers).not.toContain('ters-yercekimi'); }
  });
  it('uyarlanabilir yardım yumuşaktır: 3 başarısızlık kolaylaştırır, usta oyuncu ilk bölümleri zorlaştırmaz', () => {
    for (const n of [12, 27, 35]) {
      const base = generateLevel('insan', n); const easy = generateLevel('insan', n, { ...DEFAULT_PROFILE, failStreak: 3 });
      const exams = (x: LevelSpec) => x.chunks.filter((c) => c.tags.includes('sinav')).length;
      expect(exams(easy), `${n} sınav`).toBeLessThanOrEqual(exams(base));
      const kb = levelKnobs(n), ke = levelKnobs(n, { ...DEFAULT_PROFILE, failStreak: 3 });
      expect(ke.lambda).toBeLessThan(kb.lambda); expect(ke.tight).toBeLessThan(kb.tight); expect(ke.rooms).toBeLessThanOrEqual(kb.rooms);
    }
    for (let n = 1; n <= 5; n++) {
      const a = generateLevel('insan', n); const b = generateLevel('insan', n, { ...DEFAULT_PROFILE, recentStars: 3 });
      expect(b.chunks.map((c) => c.id)).toEqual(a.chunks.map((c) => c.id));
    }
    expect(levelKnobs(27, { ...DEFAULT_PROFILE, recentStars: 3 }).lambda).toBeGreaterThanOrEqual(levelKnobs(27).lambda);
  });
});
