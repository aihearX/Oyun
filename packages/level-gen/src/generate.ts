import type { AbilityId, ChunkSpec, Entity, LevelSpec, ModifierId, PlayerSkills } from '@odi/shared';
import { mulberry32, hashString, pick, GROUND_Y } from '@odi/shared';
import { ALL_CHUNKS, BOSSES, MODIFIERS, abilitiesAt, chunkNeeds, journeyById, newAbilitiesAt, objective, type LevelPlan } from '@odi/content';
import { quietProfile, startsWithPit } from './pacing';

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
  // ters yerçekimi değiştiricisi, yerçekimi çevirmenin kendisi açılınca (35+) karışıklık yaratır ve otomatik çevirmelerle yolu ölü bırakır
  const avail = (Object.keys(MODIFIERS) as ModifierId[]).filter((m) => MODIFIERS[m].minLevel <= plan.number && !(m === 'ters-yercekimi' && abilitiesAt(plan.number).includes('cevir')));
  if (!avail.length) return [];
  const count = plan.number >= 30 ? (rng() < 0.5 ? 2 : 1) : rng() < 0.6 ? 1 : 0;
  const out: ModifierId[] = [];
  while (out.length < count) { const m = pick(rng, avail); if (!out.includes(m)) out.push(m); }
  return out;
}

const isTutorial = (c: ChunkSpec) => c.tags.includes('ogretici');
const isMicro = (c: ChunkSpec) => c.tags.includes('mikro');
const isRisk = (c: ChunkSpec) => c.tags.includes('risk');
const isCheckpoint = (c: ChunkSpec) => !!c.rest && c.entities.some((e) => e.type === 'checkpoint');
const hasSecret = (c: ChunkSpec) => c.entities.some((e) => e.type === 'secret');
const fits = (c: ChunkSpec, abil: Set<AbilityId>) => chunkNeeds(c).every((a) => abil.has(a));

/** ağırlıklı seçim */
function weighted<T>(rng: () => number, items: { v: T; w: number }[]): T | undefined {
  const tot = items.reduce((a, i) => a + Math.max(0, i.w), 0); if (tot <= 0) return items[0]?.v;
  let r = rng() * tot; for (const i of items) { r -= Math.max(0, i.w); if (r <= 0) return i.v; }
  return items[items.length - 1]?.v;
}

/** Bölüm üretimi: deterministik (journey + number + seedSalt). Profil yalnızca zorluk ve parça seçimini etkiler.
 *  Bir önceki bölümün odaları düşük ağırlık alır: art arda bölümler farklı hissettirsin. */
export function generateLevel(journeyId: string, number: number, profile: PlayerProfile = DEFAULT_PROFILE, seedSalt = 0): LevelSpec {
  const prev = new Set<string>();
  for (const k of [1, 2]) if (number > k) { try { for (const c of generateCore(journeyId, number - k, profile, seedSalt, new Set()).chunks) prev.add(c.id); } catch { /* yok */ } }
  return generateCore(journeyId, number, profile, seedSalt, prev);
}

function generateCore(journeyId: string, number: number, profile: PlayerProfile, seedSalt: number, prevIds: Set<string>): LevelSpec {
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
  const normal = pool.filter((c) => !c.rest && !c.setPiece && !isTutorial(c) && !isMicro(c));
  const opener = pool.find((c) => c.tags.includes('giris'));
  const micros = pool.filter((c) => isMicro(c) && !c.tags.includes('giris'));
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
      if (plan.biome === 'zar' && c.tags.includes('zar')) w *= 2.5; // kulak zarı: zar sıçrayışı biyomun kalbi
      if (isRisk(c) && !chunks.slice(sectionStarts[sectionStarts.length - 1] ?? 0).some(isRisk)) w *= 1.8; // bölüm-içi bölümde risk yolu yoksa öne çıkar
      if (last && c.tags.length && last.tags[0] === c.tags[0]) w *= 0.5; // aynı tür art arda gelmesin
      if (prevIds.has(c.id)) w *= 0.1; // önceki iki bölümde vardı
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
  // her bölüm bir doruk gösterisiyle biter (giriş öğretir → gelişim birleştirir → final doruk); biyomun gösterileri dönüşümlü
  if (sets.length) chunks.push(sets[(idxInBiome + seedSalt) % sets.length]!);

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
  // ---- risk yolu: her bölüm-içi bölümde en az bir isteğe bağlı zor (daha çok notalı) yol
  const riskMicros = micros.filter(isRisk);
  if (riskMicros.length) {
    for (let k = 2; k >= 0; k--) {
      const a = sectionStarts[k]!, b = k < 2 ? sectionStarts[k + 1]! : finalChunks.length;
      if (finalChunks.slice(a, b).some(isRisk)) continue;
      const at = Math.min(k === 2 && finalChunks[b - 1]?.setPiece ? b - 1 : b, a + 2); // doruk gösterisi en sonda kalsın
      const m = weighted(rng, riskMicros.map((c) => ({ v: c, w: (chunkNeeds(c).includes(latest) ? 3 : 1) * (plan.biome === 'zar' && c.tags.includes('zar') ? 3 : 1) })))!;
      finalChunks.splice(at, 0, { ...m, entities: m.entities.slice() });
      for (let j = k + 1; j < 3; j++) sectionStarts[j]! += 1;
    }
  }
  // ---- tırmanış odağı (kanal 7, 8, 17): bölümde uzun tırmanış odası yoksa gelişim bölümüne bir tane eklenir
  if (focus.has('tirmanis') && !finalChunks.some((c) => c.tags.includes('tirmanis'))) {
    const climb = pool.filter((c) => c.tags.includes('tirmanis') && !c.setPiece);
    if (climb.length) { const c = climb[(plan.number + seedSalt) % climb.length]!; const at = sectionStarts[1]! + 1; finalChunks.splice(at, 0, { ...c, entities: c.entities.slice() }); sectionStarts[2]! += 1; }
  }
  // ---- kulak zarı: zar biyomun kalbi — bölümde en az 7 zar yoksa bölüm-içi bölüm sınırlarına zar mikro odası eklenir
  if (plan.biome === 'zar') {
    const tramps = () => finalChunks.reduce((a, c) => a + c.entities.filter((e) => e.type === 'trampoline').length, 0);
    const zm = micros.filter((c) => c.tags.includes('zar') && !isRisk(c));
    for (let k = 0; tramps() < 7 && zm.length && k < 6; k++) {
      const sec = 1 + (k % 2); const at = sectionStarts[sec]!; const m = zm[(plan.number + k + seedSalt) % zm.length]!;
      finalChunks.splice(at, 0, { ...m, entities: m.entities.slice() }); for (let j = sec; j < 3; j++) sectionStarts[j]! += 1;
    }
  }
  // ---- tempo: iki girdi arasındaki sessiz yol PACE_LIMIT'i aşmasın — gerekirse araya mikro oda (pacing.ts)
  const paced = paceChunks(finalChunks, sectionStarts, micros, { latest, biome: plan.biome, rng });
  finalChunks.length = 0; finalChunks.push(...paced.chunks); sectionStarts.splice(0, 3, ...paced.sectionStarts);
  // boşta oyuncu ölmeli: bölüm bir çukurla başlamıyorsa en başa kısa giriş çukuru (yoksa gidip-gelme odalarında sonsuza dek koşar)
  if (opener && !startsWithPit(finalChunks[0]!)) { finalChunks.unshift({ ...opener, entities: opener.entities.slice() }); sectionStarts[1]! += 1; sectionStarts[2]! += 1; }
  // nota sınırı: fazlası, en uzun nota dizilerinin uçlarından kırpılır (yaylar bölünmez, yalnız kısalır)
  const countNotes = () => finalChunks.reduce((a, c) => a + c.entities.reduce((b, e) => b + (e.type === 'coin' ? 1 : e.type === 'collect' ? 5 : 0), 0), 0);
  let notes = countNotes();
  if (notes > MAX_NOTES) { thinNotes(finalChunks, notes - MAX_NOTES); notes = countNotes(); }
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

/** dizi: aynı odada art arda gelen ve birbirine yakın (≤ 70 px) notalar */
function noteGroups(c: ChunkSpec): number[][] {
  const out: number[][] = []; let cur: number[] = [];
  c.entities.forEach((e, i) => {
    const prev = cur.length ? c.entities[cur[cur.length - 1]!]! : null;
    if (e.type === 'coin' && (!prev || Math.hypot(e.x - prev.x, e.y - prev.y) <= 70)) cur.push(i);
    else { if (cur.length) out.push(cur); cur = e.type === 'coin' ? [i] : []; }
  });
  if (cur.length) out.push(cur);
  return out;
}
/**
 * Nota sınırı: fazlası BÜTÜN diziler halinde çıkarılır (yay bölünmez, tek tük nota kalmaz). Önce gösteri/öğretici dışındaki,
 * en çok notası olan odaların dizileri; eşitlikte sondaki. Deterministik.
 */
function thinNotes(chunks: ChunkSpec[], drop: number) {
  const gone = chunks.map(() => new Set<number>());
  const left = chunks.map((c) => c.entities.filter((e) => e.type === 'coin').length);
  const protectedC = (c: ChunkSpec) => !!c.setPiece || c.tags.includes('ogretici');
  while (drop > 0) {
    let best: { ci: number; g: number[]; key: number } | null = null;
    for (let ci = 0; ci < chunks.length; ci++) {
      const c = chunks[ci]!;
      for (const g0 of noteGroups(c)) {
        const g = g0.filter((i) => !gone[ci]!.has(i)); if (!g.length) continue;
        const key = (protectedC(c) ? 0 : 1000) + left[ci]! * 10 + Math.min(9, g.length) + ci * 0.001;
        if (!best || key > best.key) best = { ci, g, key };
      }
    }
    if (!best) break;
    const b = best as { ci: number; g: number[] };
    for (const i of b.g) gone[b.ci]!.add(i);
    left[b.ci]! -= b.g.length; drop -= b.g.length;
  }
  chunks.forEach((c, ci) => { if (gone[ci]!.size) c.entities = c.entities.filter((_, i) => !gone[ci]!.has(i)); });
}

/**
 * Tempo kuralı: kahraman START_PAD'den başlar; her odanın girdi isteyen noktaları (pacing.actionXs) arasında ve odalar
 * arası geçişte sessiz yol PACE_LIMIT px'i (≈ 3,2 sn koşu) aşacaksa araya bir mikro oda konur. Mikro oda, bölüm-içi
 * bölümün kontrol noktası odasından ÖNCE eklenir (bölümler kontrol noktasıyla başlamaya devam eder).
 * Seçim: açık yeteneklere uygun; en yeni yeteneği kullanan ve biyoma yakışan (zarda zar) öne çıkar; art arda aynısı gelmez.
 */
export const PACE_LIMIT = 820;
const START_QUIET = 120; // START_PAD (220) − başlangıç x'i (100)
const END_QUIET = 110;   // END_PAD (260) − kapı payı (150)
export function paceChunks(chunks: ChunkSpec[], sectionStarts: number[], micros: ChunkSpec[], o: { latest: AbilityId; biome: string; rng: () => number }): { chunks: ChunkSpec[]; sectionStarts: number[]; inserted: number } {
  if (!micros.length) return { chunks, sectionStarts, inserted: 0 };
  const out: ChunkSpec[] = []; const map: number[] = []; let inserted = 0; let lastMicro = '';
  const pickMicro = (): ChunkSpec => {
    const m = weighted(o.rng, micros.filter((c) => !isRisk(c)).map((c) => {
      let w = 1;
      if (chunkNeeds(c).includes(o.latest)) w *= 3;
      if (o.biome === 'zar' && c.tags.includes('zar')) w *= 5;
      if (c.id === lastMicro) w *= 0.05;
      return { v: c, w };
    }))!;
    lastMicro = m.id; inserted++;
    return { ...m, entities: m.entities.slice() };
  };
  let carry = START_QUIET;
  chunks.forEach((c, i) => {
    const p = quietProfile(c);
    const need = p.actions.length ? p.entry : c.length + 160;
    if (carry + need > PACE_LIMIT) { const m = pickMicro(); out.push(m); carry = quietProfile(m).exit; }
    map[i] = out.length; out.push(c);
    carry = p.actions.length ? p.exit : carry + c.length;
  });
  if (carry + END_QUIET > PACE_LIMIT) out.push(pickMicro());
  return { chunks: out, sectionStarts: sectionStarts.map((k, i) => (i === 0 ? 0 : map[k] ?? k)), inserted };
}

export { GROUND_Y };
