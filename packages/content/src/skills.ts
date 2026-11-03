import type { PlayerSkills } from '@odi/shared';

export interface SkillNode { id: keyof PlayerSkills | `${keyof PlayerSkills}:${number}`; key: keyof PlayerSkills; name: string; desc: string; cost: number; level?: number; requires?: string }
export const SKILL_TREE: SkillNode[] = [
  { id: 'doubleJump', key: 'doubleJump', name: 'Çift Zıplama', desc: 'Havada bir kez daha zıpla.', cost: 120 },
  { id: 'longSlide', key: 'longSlide', name: 'Uzun Kayma', desc: 'Kayma iki kat sürer.', cost: 150, requires: 'doubleJump' },
  { id: 'magnet:1', key: 'magnet', level: 1, name: 'Mıknatıs I', desc: 'Jetonlar yakından çekilir.', cost: 100 },
  { id: 'magnet:2', key: 'magnet', level: 2, name: 'Mıknatıs II', desc: 'Çekim alanı büyür.', cost: 220, requires: 'magnet:1' },
  { id: 'magnet:3', key: 'magnet', level: 3, name: 'Mıknatıs III', desc: 'Çekim alanı ekranın yarısı.', cost: 400, requires: 'magnet:2' },
  { id: 'shield:1', key: 'shield', level: 1, name: 'Kalkan', desc: 'Her bölüme 1 kalkanla başla: kalkan bir vuruşu karşılar (düşüşü değil), canın gitmez ama vuruş yine hasar sayılır.', cost: 200 },
  { id: 'shield:2', key: 'shield', level: 2, name: 'Çift Kalkan', desc: 'Her bölüme 2 kalkanla başla: her biri bir vuruşu karşılar, vuruş yine hasar sayılır. Takım ya da Atölye kalkanı bir tane ekler (en çok 3).', cost: 450, requires: 'shield:1' },
  { id: 'breath:1', key: 'breath', level: 1, name: 'Nefes I', desc: 'Su altında daha uzun kal.', cost: 120 },
  { id: 'breath:2', key: 'breath', level: 2, name: 'Nefes II', desc: 'Nefes iki kat.', cost: 240, requires: 'breath:1' },
  { id: 'breath:3', key: 'breath', level: 3, name: 'Nefes III', desc: 'Neredeyse balık.', cost: 420, requires: 'breath:2' },
  { id: 'echoSight', key: 'echoSight', name: 'Yankı Görüşü', desc: 'Gece ve sis bölümlerinde daha geniş görüş.', cost: 300 },
];
/**
 * Bölüm başı kalkan (YN-099): yetenek düzeyi kadar (Kalkan 1, Çift Kalkan 2); takım kalkanı ya da Atölye/Ortak Kalkan şansı
 * bunlara bir tane ekler (`runShields`), toplam en çok `SHIELD_MAX`. Her kalkan bir vuruşu karşılar (düşüşü değil); karşılanan
 * vuruş yıldız, "Hiç hasar alma", skor ve lig için hasar sayılır (sahip kararı 37; game-core `sim.ts` `hurt`).
 */
export const SHIELD_MAX = 3;
/** bu koşunun bölüm başı kalkanı: yetenek düzeyi + bir ek kalkan (takım ya da Atölye), en çok SHIELD_MAX */
export const runShields = (level: number): number => Math.min(SHIELD_MAX, Math.max(0, level) + 1);
export const DEFAULT_SKILLS: PlayerSkills = { doubleJump: false, longSlide: false, magnet: 0, shield: 0, breath: 0, echoSight: false };
