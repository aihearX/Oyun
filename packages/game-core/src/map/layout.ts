/**
 * Yaşayan Kulak Haritası — saf yerleşim ve ilerleme hesapları (Phaser'sız; test edilebilir).
 * Dünya dikeydir: dış kulak en altta, korteks ve "Ninni Merkezi" en üstte. Koordinatlar tasarım birimidir (genişlik 390).
 */
import { BIOME_ORDER, HUMAN_JOURNEY, TREASURES, type LevelPlan } from '@odi/content';
import type { BiomeId } from '@odi/shared';

export const MAP_W = 390;
/** bölge anahtarı: 10 biyom + en tepedeki final alanı */
export type ZoneId = BiomeId | 'finale';
/** canlanma seviyesi: 0 kilitli/gri · 1 uyanıyor · 2 çiçekleniyor · 3 canlandı · 4 ışıl ışıl */
export type Vitality = 0 | 1 | 2 | 3 | 4;
export const VITALITY_NAMES: Record<Vitality, string> = { 0: 'Uykuda', 1: 'Uyanıyor', 2: 'Çiçekleniyor', 3: 'Canlandı', 4: 'Işıl ışıl' };

export interface MapNode { n: number; x: number; y: number; biome: BiomeId; zone: ZoneId; boss: boolean; treasure: boolean; name: string; /** yol üzerindeki uzunluk konumu */ s: number }
export interface MapZone { id: ZoneId; top: number; bottom: number; /** bölge kapısı (isim afişi) merkezi */ gateY: number; nodes: number[] }
export interface MapLayout {
  width: number; height: number;
  nodes: MapNode[]; zones: MapZone[];
  /** yol örnekleri (alttan üste) ve birikimli uzunlukları */
  path: { x: number; y: number }[]; cum: number[];
  /** yolun başı (dış dünya) ve sonu (Ninni Merkezi) */
  start: { x: number; y: number; s: number }; finale: { x: number; y: number; s: number };
}

const BOTTOM = 200, ENTRY = 150, STEP = 158, BOSS_GAP = 205, EXIT = 96, FINALE_H = 560;
const SAMPLES = 22;

/** Bölge sırası: bölüm sırayla yürür; geri dönen biyom (ör. 17 ve 20: kanal) içinde bulunduğu bölgede kalır. */
export function zoneOfLevels(levels: LevelPlan[] = HUMAN_JOURNEY.levels): ZoneId[] {
  let maxIdx = 0;
  return levels.map((l) => { maxIdx = Math.max(maxIdx, BIOME_ORDER.indexOf(l.biome)); return BIOME_ORDER[maxIdx]!; });
}

export function buildLayout(levels: LevelPlan[] = HUMAN_JOURNEY.levels): MapLayout {
  const zoneOf = zoneOfLevels(levels);
  const treasure = new Set(TREASURES.map((t) => t.level));
  // yukarı doğru negatif y ile kur, sonra kaydır
  const nodes: MapNode[] = []; const zones: MapZone[] = [];
  let y = 0; let cur: MapZone | null = null; let i = 0;
  for (const [k, l] of levels.entries()) {
    const z = zoneOf[k]!;
    if (!cur || cur.id !== z) {
      if (cur) { const top = y - EXIT; cur.top = top; y = top; }
      cur = { id: z, bottom: y, top: 0, gateY: y - 62, nodes: [] }; zones.push(cur);
      y -= ENTRY;
    } else y -= l.boss || levels[k - 1]?.boss ? BOSS_GAP : STEP;
    const boss = !!l.boss;
    // yılan gibi kıvrılan yol: düğümler iki yana salınır; canavarlar ortada
    const x = boss ? MAP_W / 2 : MAP_W / 2 + Math.sin(i * 1.12 + 0.55) * 102;
    nodes.push({ n: l.number, x, y, biome: l.biome, zone: z, boss, treasure: treasure.has(l.number), name: l.name, s: 0 });
    cur.nodes.push(l.number); i++;
  }
  if (cur) { cur.top = y - EXIT; y = cur.top; }
  const finaleZone: MapZone = { id: 'finale', bottom: y, top: y - FINALE_H, gateY: y - 40, nodes: [] };
  zones.push(finaleZone);
  const height = -finaleZone.top + BOTTOM;
  const shift = -finaleZone.top;
  for (const n of nodes) n.y += shift;
  // dış dünya: ilk bölge en alta kadar uzanır
  for (const z of zones) { z.top += shift; z.gateY += shift; z.bottom = z === zones[0] ? height : z.bottom + shift; }
  const start = { x: MAP_W / 2 - 20, y: height - 120, s: 0 };
  const finale = { x: MAP_W / 2, y: finaleZone.top + 250, s: 0 };
  // Catmull-Rom yol
  const ctrl = [{ x: start.x, y: height + 40 }, start, ...nodes.map((n) => ({ x: n.x, y: n.y })), finale, { x: finale.x, y: finale.y - 80 }];
  const path: { x: number; y: number }[] = []; const cum: number[] = [];
  const at: number[] = [];
  for (let k = 1; k < ctrl.length - 2; k++) {
    const p0 = ctrl[k - 1]!, p1 = ctrl[k]!, p2 = ctrl[k + 1]!, p3 = ctrl[k + 2]!;
    at.push(path.length);
    for (let j = 0; j < SAMPLES; j++) {
      const t = j / SAMPLES, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      path.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  at.push(path.length); path.push({ ...finale });
  let acc = 0;
  for (let k = 0; k < path.length; k++) { if (k > 0) acc += Math.hypot(path[k]!.x - path[k - 1]!.x, path[k]!.y - path[k - 1]!.y); cum.push(acc); }
  start.s = cum[at[0]!]!;
  nodes.forEach((n, k) => { n.s = cum[at[k + 1]!]!; });
  finale.s = cum[cum.length - 1]!;
  return { width: MAP_W, height, nodes, zones, path, cum, start, finale };
}

/** yol üzerinde uzunluk konumundaki nokta (+ teğet açısı) */
export function pointAt(L: Pick<MapLayout, 'path' | 'cum'>, s: number): { x: number; y: number; a: number } {
  const { path, cum } = L;
  if (s <= 0) return { ...path[0]!, a: -Math.PI / 2 };
  let lo = 0, hi = cum.length - 1;
  if (s >= cum[hi]!) return { ...path[hi]!, a: -Math.PI / 2 };
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m]! <= s) lo = m; else hi = m; }
  const a = path[lo]!, b = path[hi]!; const t = (s - cum[lo]!) / Math.max(1e-6, cum[hi]! - cum[lo]!);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) };
}

// ---------------------------------------------------------------- ilerleme

export type StarMap = Record<number, number>;
/** İlk kilitli bölüm (önceki bölüm en az 1 yıldız) — @odi/meta highestUnlocked ile aynı kural */
export function unlockedOf(stars: StarMap, total = HUMAN_JOURNEY.levels.length): number {
  let n = 1; while ((stars[n] ?? 0) > 0) n++; return Math.min(n, total);
}
export const journeyDone = (stars: StarMap, total = HUMAN_JOURNEY.levels.length) => (stars[total] ?? 0) > 0 && unlockedOf(stars, total) === total;

/** Biyom canlanması: 0 = ilk bölümü kilitli, 1 = açık, 2 = yarısı geçildi, 3 = hepsi geçildi, 4 = hepsi 3 yıldız */
export function vitalityOf(biome: BiomeId, stars: StarMap, levels: LevelPlan[] = HUMAN_JOURNEY.levels): Vitality {
  const ls = levels.filter((l) => l.biome === biome); if (!ls.length) return 0;
  const unlocked = unlockedOf(stars, levels.length);
  if (ls[0]!.number > unlocked) return 0;
  const cleared = ls.filter((l) => (stars[l.number] ?? 0) > 0).length;
  if (cleared === ls.length) return ls.every((l) => (stars[l.number] ?? 0) >= 3) ? 4 : 3;
  return cleared >= Math.ceil(ls.length / 2) ? 2 : 1;
}
/** Ninni Merkezi: son bölüm açılınca uyanır, yolculuk bitince canlanır, 120 yıldızda ışıl ışıl */
export function finaleVitality(stars: StarMap, levels: LevelPlan[] = HUMAN_JOURNEY.levels): Vitality {
  const total = levels.length;
  if (unlockedOf(stars, total) < total) return 0;
  if (!((stars[total] ?? 0) > 0)) return 1;
  return levels.every((l) => (stars[l.number] ?? 0) >= 3) ? 4 : 3;
}
export function zoneVitality(z: ZoneId, stars: StarMap, levels: LevelPlan[] = HUMAN_JOURNEY.levels): Vitality {
  return z === 'finale' ? finaleVitality(stars, levels) : vitalityOf(z, stars, levels);
}
/** bir sonraki canlanma seviyesi için ne gerekiyor (dürüst; gerçek sayılar) */
export function nextVitalityNeed(biome: BiomeId, stars: StarMap, levels: LevelPlan[] = HUMAN_JOURNEY.levels): { to: Vitality; clears?: number; stars?: number } | null {
  const v = vitalityOf(biome, stars, levels); const ls = levels.filter((l) => l.biome === biome);
  const cleared = ls.filter((l) => (stars[l.number] ?? 0) > 0).length;
  if (v === 0) return { to: 1 };
  if (v === 1) return { to: 2, clears: Math.ceil(ls.length / 2) - cleared };
  if (v === 2) return { to: 3, clears: ls.length - cleared };
  if (v === 3) return { to: 4, stars: ls.reduce((a, l) => a + 3 - Math.min(3, stars[l.number] ?? 0), 0) };
  return null;
}

/** Haritaya dönüş sahnesi: gösterilen son durumdan (seen) bugünkü duruma adım adım. */
export type ReturnStep =
  | { kind: 'stars'; n: number; from: number; to: number }
  | { kind: 'treasure'; n: number }
  | { kind: 'walk'; from: number; to: number | 'finale' }
  | { kind: 'zone'; zone: ZoneId; from: Vitality; to: Vitality };

export function planReturn(seen: StarMap, now: StarMap, levels: LevelPlan[] = HUMAN_JOURNEY.levels): ReturnStep[] {
  const steps: ReturnStep[] = []; const total = levels.length;
  const treasure = new Set(TREASURES.map((t) => t.level));
  const zones: ZoneId[] = [...BIOME_ORDER, 'finale'];
  const before = Object.fromEntries(zones.map((z) => [z, zoneVitality(z, seen, levels)])) as Record<ZoneId, Vitality>;
  const after = Object.fromEntries(zones.map((z) => [z, zoneVitality(z, now, levels)])) as Record<ZoneId, Vitality>;
  for (const l of levels) {
    const a = seen[l.number] ?? 0, b = now[l.number] ?? 0;
    if (b > a) { steps.push({ kind: 'stars', n: l.number, from: a, to: b }); if (a === 0 && treasure.has(l.number)) steps.push({ kind: 'treasure', n: l.number }); }
  }
  // geçilen bölgenin yükselişi yürüyüşten önce; yeni girilen bölgenin uyanışı Odi varınca
  const rising = zones.filter((z) => after[z] > before[z]);
  for (const z of rising) if (before[z] > 0) steps.push({ kind: 'zone', zone: z, from: before[z], to: after[z] });
  const u0 = unlockedOf(seen, total), u1 = unlockedOf(now, total);
  const end0 = journeyDone(seen, total), end1 = journeyDone(now, total);
  if (u1 > u0 || (end1 && !end0)) steps.push({ kind: 'walk', from: u0, to: end1 ? 'finale' : u1 });
  for (const z of rising) if (before[z] === 0) steps.push({ kind: 'zone', zone: z, from: 0, to: after[z] });
  return steps;
}
