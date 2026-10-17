import type { ChunkSpec, LevelSpec, ModifierId, PlayerSkills } from '@odi/shared';
import { mulberry32, hashString, pick, GROUND_Y } from '@odi/shared';
import { chunksFor, objective, BOSSES, MODIFIERS, journeyById, type LevelPlan } from '@odi/content';

export interface PlayerProfile {
  /** son 5 bölümdeki ortalama yıldız (0-3); dinamik zorluk */
  recentStars: number;
  /** aynı bölümde üst üste başarısızlık */
  failStreak: number;
  skills: PlayerSkills;
}

export const DEFAULT_PROFILE: PlayerProfile = { recentStars: 2, failStreak: 0, skills: { doubleJump: false, longSlide: false, magnet: 0, shield: 0, breath: 0, echoSight: false } };

/** Ritim eğrisi: parça zorlukları (1-5). Kolay-zor-nefes-zor-final. */
function rhythm(n: number, base: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    let d = base + Math.round(Math.sin(t * Math.PI) * 1.5);
    if (i === Math.floor(n / 2) && n >= 5) d = base - 1;          // nefes
    if (i === n - 1) d = base + 1;                                 // final
    out.push(Math.max(1, Math.min(5, d)));
  }
  return out;
}

function baseDifficulty(number: number, profile: PlayerProfile): number {
  let d = 1 + Math.floor((number - 1) / 8);          // 1-5 arası, 8 bölümde bir artar
  if (profile.recentStars >= 2.8) d += 1;             // ustaysa zorlaştır
  if (profile.failStreak >= 2) d -= 1;                // takıldıysa nefes aldır
  return Math.max(1, Math.min(5, d));
}

function pickModifiers(plan: LevelPlan, rng: () => number): ModifierId[] {
  if (plan.number < 15 || plan.mechanic === 'boss') return [];
  const avail = (Object.keys(MODIFIERS) as ModifierId[]).filter((m) => MODIFIERS[m].minLevel <= plan.number);
  if (!avail.length) return [];
  const count = plan.number >= 30 ? (rng() < 0.5 ? 2 : 1) : rng() < 0.6 ? 1 : 0;
  const out: ModifierId[] = [];
  while (out.length < count) { const m = pick(rng, avail); if (!out.includes(m)) out.push(m); }
  return out;
}

/** Bölüm üretimi: deterministik (journey + number + seedSalt). Profil yalnızca zorluk ve parça seçimini etkiler. */
export function generateLevel(journeyId: string, number: number, profile: PlayerProfile = DEFAULT_PROFILE, seedSalt = 0): LevelSpec {
  const journey = journeyById(journeyId);
  if (!journey) throw new Error(`yolculuk yok: ${journeyId}`);
  const plan = journey.levels.find((l) => l.number === number) ?? journey.levels[journey.levels.length - 1]!;
  const seed = hashString(`${journeyId}:${number}:${seedSalt}`);
  const rng = mulberry32(seed);
  const modifiers = pickModifiers(plan, rng);

  if (plan.mechanic === 'boss') {
    const boss = BOSSES[plan.boss ?? ''];
    if (!boss) throw new Error(`boss yok: ${plan.boss}`);
    return { id: `${journeyId}-${number}`, number, journey: journeyId, name: plan.name, biome: plan.biome, mechanic: 'boss', objective: objective('boss'), modifiers: [], seed, chunks: [], lengthPx: 0, parTimeSec: 120, coinsTotal: 0, intro: plan.intro, boss };
  }

  const pool = chunksFor(plan.mechanic).filter((c) => !c.biomes || c.biomes.includes(plan.biome));
  if (!pool.length) throw new Error(`parça yok: ${plan.mechanic}`);
  const n = plan.targetChunks ?? 6;
  const base = baseDifficulty(number, profile);
  const curve = rhythm(n, base);
  const chunks: ChunkSpec[] = [];
  let lastId = ''; const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const want = curve[i]!;
    const wantRest = i === Math.floor(n / 2) && n >= 5;
    let cands = pool.filter((c) => (wantRest ? c.rest : !c.rest) && Math.abs(c.difficulty - want) <= 1 && c.id !== lastId);
    if (!cands.length) cands = pool.filter((c) => c.id !== lastId);
    // çeşitlilik: daha önce kullanılmamış parçalar varsa onları tercih et
    const fresh = cands.filter((c) => !used.has(c.id)); if (fresh.length) cands = fresh;
    if (!cands.length) cands = pool;
    // öğretici bölümde "ogretici" etiketli parçalar önce
    if (plan.tutorial && i < 2) { const tut = cands.filter((c) => c.tags.includes('ogretici')); if (tut.length) cands = tut; }
    // gizli hedefte en az bir gizli parça
    if (plan.objective === 'secret' && i === n - 2) { const s = cands.filter((c) => c.tags.includes('gizli')); if (s.length) cands = s; }
    const c = pick(rng, cands);
    chunks.push(c); lastId = c.id; used.add(c.id);
  }
  const lengthPx = chunks.reduce((a, c) => a + c.length, 0) + 600; // başlangıç ve kapı payı
  const coinsTotal = chunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'coin').length, 0);
  const notes = chunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'note').length, 0);
  const MECH_SPEED: Record<string, number> = { kosu: 260, yuzme: 220, trambolin: 260, makine: 240, impuls: 380, ruya: 260 };
  const speedPx = (MECH_SPEED[plan.mechanic] ?? 260) * (modifiers.includes('hiz') ? 1.3 : 1);
  const parTimeSec = Math.round(lengthPx / speedPx + n * 3);
  const obj = plan.objective === 'collect-all' ? objective('collect-all', coinsTotal)
    : plan.objective === 'timed' ? objective('timed', Math.max(20, Math.round(parTimeSec * 0.9)))
    : plan.objective === 'melody' ? objective('melody', notes || 5)
    : objective(plan.objective);
  return { id: `${journeyId}-${number}`, number, journey: journeyId, name: plan.name, biome: plan.biome, mechanic: plan.mechanic, objective: obj, modifiers, seed, chunks, lengthPx, parTimeSec, coinsTotal, intro: plan.intro, tutorial: plan.tutorial };
}

export { GROUND_Y };
