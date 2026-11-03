// Harita bölüm kartının hedef satırları (YN-162, OT-rekabetci-35): geçme koşulu ayrı, 3. yıldız satırı sonuç ekranının
// 3. yıldız kartıyla aynı kaynaktan (meta star3Rules → star3View; başlık starHead).
import { describe, expect, it } from 'vitest';
import { DEFAULT_SKILLS, HUMAN_JOURNEY } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { star3View, starHead } from '@odi/meta';
import { scoreRun, type LevelSpec, type RunResult } from '@odi/shared';
import { nodeGoalLines } from './map/goals';

const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };
/** sonuç ekranı 3. yıldız kartını 2★ kazançta gösterir: 2★ eşiğinde bir koşu (hedef tutmadı) */
const run2 = (spec: LevelSpec): RunResult => {
  const base = { levelId: spec.id, completed: true, coins: Math.ceil(spec.coinsTotal * 0.6), timeSec: spec.parTimeSec, deaths: 0, damageTaken: 1, objectiveMet: false, secretFound: false };
  return { ...base, ...scoreRun(spec, base) };
};

describe('bölüm kartı: geçme koşulu ve 3. yıldız', () => {
  it('1–40 her bölümde 3. yıldız satırı sonuç kartının satırlarıyla aynı; geçme satırı bölüm hedefini zorunlu göstermez', () => {
    expect(HUMAN_JOURNEY.levels.length).toBe(40);
    for (const l of HUMAN_JOURNEY.levels) {
      const spec = generateLevel(HUMAN_JOURNEY.id, l.number, prof);
      const card = nodeGoalLines(spec); const view = star3View(spec, run2(spec));
      expect(card.star3, `bölüm ${l.number}`).toBe(view.rows.map((r) => r.text).join(' ya da '));
      expect(card.star3Head, `bölüm ${l.number}`).toBe(starHead(3, view.rows.length));
      // geçmek kapıya ulaşmak (canavarda canavarı yenmek); hedef yalnız 3. yıldızın bir yolu
      expect(card.pass, `bölüm ${l.number}`).toBe(spec.mechanic === 'boss' ? 'Canavarı yen' : 'Kapıya ulaş');
      if (spec.objective.id !== 'reach' && spec.objective.id !== 'boss') {
        expect(card.pass).not.toContain(spec.objective.label);
        if (view.rows.length > 1) expect(card.star3).toContain(spec.objective.label);
      }
    }
  });

  it('16: altın koklea geçme koşulu değil, 3. yıldızın ikinci yolu (90 nota ya da 3 altın koklea ve 60 nota)', () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 16, prof);
    expect(spec.objective.id).toBe('secret');
    const card = nodeGoalLines(spec);
    const n3 = Math.ceil(spec.coinsTotal * 0.9 - 1e-9); const n2 = Math.ceil(spec.coinsTotal * 0.6 - 1e-9);
    expect(card).toEqual({ pass: 'Kapıya ulaş', star3Head: '3. yıldız · biri yeter', star3: `${n3} nota ya da 3 altın kokleayı bul ve ${n2} nota` });
  });

  it('13: hedefi "Kapıya ulaş" olan bölümde 3. yıldız tek yol (90 nota)', () => {
    const spec = generateLevel(HUMAN_JOURNEY.id, 13, prof);
    expect(spec.objective.id).toBe('reach');
    const n3 = Math.ceil(spec.coinsTotal * 0.9 - 1e-9);
    expect(nodeGoalLines(spec)).toEqual({ pass: 'Kapıya ulaş', star3Head: '3. yıldız', star3: `${n3} nota` });
  });

  it('canavar bölümü: geçmek canavarı yenmek, 3. yıldız hasarsız', () => {
    expect(nodeGoalLines(generateLevel(HUMAN_JOURNEY.id, 20, prof))).toEqual({ pass: 'Canavarı yen', star3Head: '3. yıldız', star3: 'Hiç hasar alma' });
  });
});
