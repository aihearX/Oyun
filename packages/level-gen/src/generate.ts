import type { AbilityId, ChunkSpec, Entity, LevelSpec, ModifierId, PlayerSkills } from '@odi/shared';
import { mulberry32, hashString, pick, GROUND_Y } from '@odi/shared';
import { ALL_CHUNKS, BOSSES, MODIFIERS, abilitiesAt, chunkNeeds, journeyById, newAbilitiesAt, objective, type LevelPlan } from '@odi/content';

export interface PlayerProfile {
  /** son 5 bölümdeki ortalama yıldız (0-3); dinamik zorluk */
  recentStars: number;
  /** aynı bölümde üst üste başarısızlık */
  failStreak: number;
  skills: PlayerSkills;
}

export const DEFAULT_PROFILE: PlayerProfile = { recentStars: 2, failStreak: 0, skills: { doubleJump: false, longSlide: false, magnet: 0, shield: 0, breath: 0, echoSight: false } };

/** bir bölümde en çok nota (docs/11 §5) */
export const MAX_NOTES = 100;

/**
 * Zorluk eğrisi (1..5, sürekli): bölüm 1 → 1, bölüm 40 → 5. Bölüm-içi bölümler: giriş −0,6 · gelişim 0 · final +0,5.
 * Profil: ustaysa biraz zorlaştır, takıldıysa nefes aldır.
 */
export function difficultyFor(number: number, profile: PlayerProfile = DEFAULT_PROFILE): number {
  let d = 1 + ((Math.min(40, Math.max(1, number)) - 1) * 4) / 39;
  if (profile.recentStars >= 2.8) d += 0.5;
  if (profile.failStreak >= 2) d -= 0.7;
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

const isTutorial = (c: ChunkSpec) => c.tags.includes('ogretici');
const isCheckpoint = (c: ChunkSpec) => !!c.rest && c.entities.some((e) => e.type === 'checkpoint');
const hasSecret = (c: ChunkSpec) => c.entities.some((e) => e.type === 'secret');
const fits = (c: ChunkSpec, abil: Set<AbilityId>) => chunkNeeds(c).every((a) => abil.has(a));

/** ağırlıklı seçim */
function weighted<T>(rng: () => number, items: { v: T; w: number }[]): T | undefined {
  const tot = items.reduce((a, i) => a + Math.max(0, i.w), 0); if (tot <= 0) return items[0]?.v;
  let r = rng() * tot; for (const i of items) { r -= Math.max(0, i.w); if (r <= 0) return i.v; }
  return items[items.length - 1]?.v;
}

/** Bölüm üretimi: deterministik (journey + number + seedSalt). Profil yalnızca zorluk ve parça seçimini etkiler. */
export function generateLevel(journeyId: string, number: number, profile: PlayerProfile = DEFAULT_PROFILE, seedSalt = 0): LevelSpec {
  const journey = journeyById(journeyId);
  if (!journey) throw new Error(`yolculuk yok: ${journeyId}`);
  const plan = journey.levels.find((l) => l.number === number) ?? journey.levels[journey.levels.length - 1]!;
  const seed = hashString(`${journeyId}:${number}:${seedSalt}`);
  const rng = mulberry32(seed);
  const modifiers = pickModifiers(plan, rng);
  const abilities = abilitiesAt(plan.number); const abil = new Set(abilities);
  const newAbilities = newAbilitiesAt(plan.number);

  if (plan.mechanic === 'boss') {
    const boss = BOSSES[plan.boss ?? ''];
    if (!boss) throw new Error(`boss yok: ${plan.boss}`);
    return { id: `${journeyId}-${number}`, number, journey: journeyId, name: plan.name, biome: plan.biome, mechanic: 'boss', objective: objective('boss'), modifiers: [], seed, chunks: [], lengthPx: 0, parTimeSec: 120, coinsTotal: 0, intro: plan.intro, boss, abilities, newAbilities: [], sectionStarts: [0], cochleasTotal: 0 };
  }

  // ---- havuz: biyoma uygun, açık yeteneklerle oynanabilir parçalar
  const biomeOk = (c: ChunkSpec) => !c.biomes || c.biomes.includes(plan.biome);
  const pool = ALL_CHUNKS.filter((c) => biomeOk(c) && fits(c, abil));
  const normal = pool.filter((c) => !c.rest && !c.setPiece && !isTutorial(c));
  if (!normal.length) throw new Error(`parça yok: ${plan.biome}`);
  const focus = new Set(plan.focus ?? []);
  // bu biyomda açılan / en yeni yetenek: o yeteneği kullanan parçalar öne çıkar
  const latest = abilities[abilities.length - 1]!;
  const base = difficultyFor(plan.number, profile);
  const total = Math.max(6, Math.min(13, (plan.targetChunks ?? 6) + 2));
  const counts = [Math.max(2, Math.round(total * 0.3)), Math.max(2, Math.round(total * 0.38))];
  counts.push(Math.max(2, total - counts[0]! - counts[1]!));
  const used = new Set<string>();
  const chunks: ChunkSpec[] = []; const sectionStarts: number[] = [];

  const pickChunk = (target: number, needSecret: boolean): ChunkSpec => {
    let cands = normal.filter((c) => !used.has(c.id) && Math.abs(c.difficulty - target) <= 1.5);
    if (needSecret) { const s = cands.filter(hasSecret); if (s.length) cands = s; }
    if (!cands.length) cands = normal.filter((c) => !used.has(c.id));
    if (!cands.length) cands = normal;
    const last = chunks[chunks.length - 1];
    const c = weighted(rng, cands.map((c) => {
      let w = 1 / (1 + Math.abs(c.difficulty - target) * 1.6);
      if (c.biomes?.includes(plan.biome)) w *= 3;
      const needs = chunkNeeds(c);
      if (needs.includes(latest)) w *= 2.2;
      if (c.tags.some((t) => focus.has(t))) w *= 3;
      if (last && c.tags.length && last.tags[0] === c.tags[0]) w *= 0.5; // aynı tür art arda gelmesin
      return { v: c, w };
    }))!;
    used.add(c.id);
    return c;
  };
  const checkpointChunk = (): ChunkSpec | undefined => {
    const cps = pool.filter(isCheckpoint);
    const own = cps.filter((c) => c.biomes?.includes(plan.biome));
    return pick(rng, own.length ? own : cps);
  };

  const targets = [base - 0.6, base, base + 0.5].map((d) => Math.max(1, Math.min(5, d)));
  for (let s = 0; s < 3; s++) {
    sectionStarts.push(chunks.length);
    const startLen = chunks.length;
    if (s === 0) {
      // öğretici: yeni açılan her yetenek için oynanarak öğrenilen parça
      for (const a of newAbilities) {
        const tut = pool.filter((c) => isTutorial(c) && c.entities.some((e) => e.type === 'tutor' && e.props?.ability === a));
        const own = tut.filter((c) => c.biomes?.includes(plan.biome)); const t = pick(rng, own.length ? own : tut);
        if (t) { chunks.push(t); used.add(t.id); }
      }
    } else { const cp = checkpointChunk(); if (cp) chunks.push(cp); }
    const n = counts[s]!;
    for (let i = 0; i < n; i++) {
      const secretSoFar = chunks.slice(startLen).some(hasSecret);
      chunks.push(pickChunk(targets[s]! + (i === n - 1 && s === 2 ? 0.4 : 0), !secretSoFar && i === n - 1));
    }
  }
  // gösteri parçası (set piece): biyomun bölümlerinde dönüşümlü, final bölümünün sonunda
  const biomeLevels = journey.levels.filter((l) => l.biome === plan.biome && l.mechanic !== 'boss').map((l) => l.number);
  const idxInBiome = biomeLevels.indexOf(plan.number);
  const sets = pool.filter((c) => c.setPiece && c.biomes?.includes(plan.biome));
  const wantSet = sets.length && (idxInBiome % 2 === 1 || idxInBiome === biomeLevels.length - 1 || plan.setPiece);
  if (wantSet) chunks.push(sets[(Math.floor(idxInBiome / 2) + (plan.number % 2)) % sets.length]!);

  // ---- altın koklealar: her bölüm-içi bölümde tam bir tane; notalar en çok 100
  const sectionOf = (i: number) => (i >= sectionStarts[2]! ? 2 : i >= sectionStarts[1]! ? 1 : 0);
  const keepSecret: (string | null)[] = [null, null, null];
  for (let s = 0; s < 3; s++) {
    const cands: string[] = [];
    chunks.forEach((c, i) => { if (sectionOf(i) === s) c.entities.forEach((e, j) => { if (e.type === 'secret') cands.push(`${i}:${j}`); }); });
    keepSecret[s] = cands.length ? pick(rng, cands) : null;
  }
  const finalChunks: ChunkSpec[] = chunks.map((c, i) => {
    const ents: Entity[] = [];
    c.entities.forEach((e, j) => {
      if (e.type === 'secret' && keepSecret[sectionOf(i)] !== `${i}:${j}`) return;
      if (e.type === 'tutor' && !newAbilities.includes(String(e.props?.ability) as AbilityId)) return; // tekrar oynanan öğretici parça: yalnızca metin
      ents.push(e);
    });
    return { ...c, entities: ents };
  });
  // nota sınırı: fazla jetonları eşit aralıkla seyrelt
  const countNotes = () => finalChunks.reduce((a, c) => a + c.entities.reduce((b, e) => b + (e.type === 'coin' ? 1 : e.type === 'collect' ? 5 : 0), 0), 0);
  let notes = countNotes();
  if (notes > MAX_NOTES) {
    const coinsN = finalChunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'coin').length, 0);
    const drop = notes - MAX_NOTES; const every = coinsN / drop; let k = 0, next = every / 2;
    for (const c of finalChunks) c.entities = c.entities.filter((e) => { if (e.type !== 'coin') return true; k++; if (k >= next && notes > MAX_NOTES) { next += every; notes--; return false; } return true; });
    notes = countNotes();
  }
  let coinBudget = notes;
  // ---- hedefe özel: melodi notaları (yol üstündeki jetonlardan), eskort başlangıcı
  if (plan.objective === 'melody') {
    const want = 6 + Math.floor(plan.number / 10);
    const spots: { ci: number; ei: number }[] = [];
    finalChunks.forEach((c, ci) => { if (c.tags.includes('duvar') || c.tags.includes('su')) return; c.entities.forEach((e, ei) => { if (e.type === 'coin' && e.y >= GROUND_Y - 130) spots.push({ ci, ei }); }); });
    const chosen: { ci: number; ei: number }[] = [];
    for (let i = 0; i < want && spots.length; i++) { const idx = Math.min(spots.length - 1, Math.floor(((i + 0.5) / want) * spots.length)); chosen.push(spots[idx]!); }
    chosen.forEach((p, i) => { const c = finalChunks[p.ci]!; const e = c.entities[p.ei]!; c.entities = c.entities.slice(); c.entities[p.ei] = { type: 'note', x: e.x, y: e.y, props: { t: chosen.length > 1 ? i / (chosen.length - 1) : 0.5 } }; });
    coinBudget = countNotes();
  }
  if (plan.objective === 'escort') {
    const c0 = finalChunks[0]!; finalChunks[0] = { ...c0, entities: [{ type: 'escortee', x: 10, y: GROUND_Y - 40 }, ...c0.entities] };
  }

  const lengthPx = finalChunks.reduce((a, c) => a + c.length, 0) + 600;
  const melodyNotes = finalChunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'note').length, 0);
  const speedPx = 260 * (modifiers.includes('hiz') ? 1.3 : 1);
  const slow = finalChunks.reduce((a, c) => a + (c.tags.includes('duvar') ? 2.5 : 0) + (c.tags.includes('su') ? 1.5 : 0) + (c.tags.includes('anahtar') ? 3 : 0), 0);
  const parTimeSec = Math.round(lengthPx / speedPx + slow + finalChunks.length * 1.5 + 6);
  const obj = plan.objective === 'collect-all' ? objective('collect-all', coinBudget)
    : plan.objective === 'timed' ? objective('timed', Math.max(25, Math.round(parTimeSec * 0.95)))
    : plan.objective === 'melody' ? objective('melody', melodyNotes || 5)
    : objective(plan.objective);
  const sectionChunkStarts = sectionStarts.slice();
  return {
    id: `${journeyId}-${number}`, number, journey: journeyId, name: plan.name, biome: plan.biome, mechanic: plan.mechanic, objective: obj, modifiers, seed,
    chunks: finalChunks, lengthPx, parTimeSec, coinsTotal: coinBudget, intro: plan.intro, tutorial: plan.tutorial || newAbilities.length > 0,
    abilities, newAbilities, sectionStarts: sectionChunkStarts, cochleasTotal: keepSecret.filter(Boolean).length,
  };
}

export { GROUND_Y };
