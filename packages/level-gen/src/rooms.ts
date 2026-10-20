import type { ChunkSpec, Entity } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';
import { ROOM_RATINGS, chunkNeeds } from '@odi/content';

/**
 * Oda ölçüleri (docs/12-zorluk-egrisi.md): üreticinin zorluk düğmeleri odaları bu ölçülere göre süzer ve seçer.
 *  - yapısal (burada, varlıklardan hesaplanır): mekanik aileleri (bir odada kaç farklı beceri birleşiyor), düşman türleri,
 *    en geniş zemin boşluğu, boşluk üstündeki en dar iniş, tehlike sayısı, zamanlamalı öğe sayısı;
 *  - ölçülen (`content/chunks/puanlar.ts`, `tools/harness/zorluk.mjs` üretir): insan benzeri oyuncu modelinin odayı tek başına
 *    oynarken kaybettiği ortalama can (kitle: sıkılık 0 ve 1 düğmeleriyle; acemi model: düğmesiz), hasar olasılığı ve yakın kaçışlar.
 */
export type Family = 'bosluk' | 'diken' | 'dusman' | 'zaman' | 'duvar' | 'suzul' | 'zar' | 'kanca' | 'cakil' | 'geri' | 'su' | 'kayma' | 'darbe' | 'cevir' | 'frekans';

export interface RoomStats {
  families: Family[];
  enemies: string[];
  /** zemin seviyesinde hiçbir desteğin örtmediği en geniş aralık (px) */
  maxGap: number;
  /** bir boşluğun üstündeki en dar basamak (px; yoksa Infinity) */
  minLanding: number;
  hazards: number;
  timed: number;
  /** ölçülen: acemi oyuncu modeli odada ortalama kaç can kaybeder (oda tek başına) */
  dmg: number;
  /** ölçülen: oyuncu kitlesinin en bağışlayıcı (sıkılık 0) ve en sıkı (1) düğmelerle can kaybı */
  h0: number; h1: number;
  /** ölçülen: yakın kaçış sayısı */
  nm: number;
  /** ölçülen: hasar alma olasılığı */
  hit: number;
  /** 0-10 oda puanı (ölçüm + yapı) */
  score: number;
}

const G = GROUND_Y;
const enemyKind = (e: Entity) => { const k = String(e.props?.kind ?? 'devriye'); return k === 'bakteri' ? 'devriye' : k === 'sinek' ? 'ucan' : k; };
const isCurtain = (e: Entity) => e.type === 'hazard' && e.y + (e.h ?? 0) <= G - 20 && e.y + (e.h ?? 0) >= G - 40;
const timedHazard = (e: Entity) => e.type === 'hazard' && !!(e.props?.period || e.props?.on || e.props?.chase);

const cache = new Map<string, RoomStats>();

export function roomStats(c: ChunkSpec): RoomStats {
  const hit0 = cache.get(c.id); if (hit0) return hit0;
  const fam = new Set<Family>(); const enemies = new Set<string>(); let hazards = 0, timed = 0;
  const needs = chunkNeeds(c);
  if (needs.includes('suzul')) fam.add('suzul');
  for (const e of c.entities) {
    switch (e.type) {
      case 'spike': fam.add('diken'); hazards++; break;
      case 'hazard': hazards++; if (isCurtain(e)) fam.add('kayma'); else if (timedHazard(e)) { fam.add('zaman'); timed++; } else if (e.y + (e.h ?? 0) >= G - 70) fam.add('diken'); break;
      case 'gear': fam.add('diken'); hazards++; break;
      case 'enemy': { const k = enemyKind(e); enemies.add(k); fam.add('dusman'); hazards++; if (k === 'atici') { fam.add('zaman'); timed++; } if (k === 'kalkanli') fam.add('cakil'); break; }
      case 'moving': case 'beat': case 'lift': case 'crumble': fam.add('zaman'); timed++; break;
      case 'wall': fam.add('duvar'); break;
      case 'trampoline': fam.add('zar'); break;
      case 'hook': fam.add('kanca'); break;
      case 'switch': fam.add(e.props?.by === 'temas' ? 'geri' : e.props?.by === 'darbe' ? 'darbe' : 'cakil'); break;
      case 'water': fam.add('su'); break;
      case 'barrier': case 'echo': fam.add('darbe'); break;
      case 'gravzone': fam.add('cevir'); break;
      case 'fork': case 'freqgate': fam.add('frekans'); break;
      default: break;
    }
  }
  // zemin boşlukları: zemin seviyesindeki destekler (kalın zemin, her türlü basamak, zar, sıvı) dışında kalan aralıklar
  const supports = c.entities.filter((e) => (e.type === 'platform' && e.y >= G - 160 && e.y <= G + 20) || e.type === 'water' || e.type === 'trampoline'
    || ((e.type === 'moving' || e.type === 'beat' || e.type === 'crumble' || e.type === 'lift' || e.type === 'echo') && e.y >= G - 200));
  const span = (e: Entity): [number, number] => e.type === 'trampoline' ? [e.x - (e.w ?? 128) / 2, e.x + (e.w ?? 128) / 2] : e.type === 'moving' ? [Math.min(e.x, e.x + Number(e.props?.dx ?? 0)), Math.max(e.x, e.x + Number(e.props?.dx ?? 0)) + (e.w ?? 120)] : [e.x, e.x + (e.w ?? 120)];
  const floors = c.entities.filter((e) => e.type === 'platform' && (e.h ?? 24) >= 100 && Math.abs(e.y - G) <= 12).map(span).sort((a, b) => a[0] - b[0]);
  const all = supports.map(span).sort((a, b) => a[0] - b[0]);
  let maxGap = 0, cover = 0;
  for (const [a, b] of all) { if (a > cover) maxGap = Math.max(maxGap, a - cover); cover = Math.max(cover, b); }
  if (c.length > cover) maxGap = Math.max(maxGap, c.length - cover);
  // boşluk üstündeki basamaklar: zemin örtüsünün dışında kalan basamakların en darı
  const gaps: [number, number][] = []; cover = 0;
  for (const [a, b] of floors) { if (a - cover >= 40) gaps.push([cover, a]); cover = Math.max(cover, b); }
  if (c.length - cover >= 40) gaps.push([cover, c.length]);
  let minLanding = Infinity;
  for (const e of c.entities) {
    if (!(e.type === 'platform' && (e.h ?? 24) <= 60) && e.type !== 'moving' && e.type !== 'beat' && e.type !== 'crumble' && e.type !== 'echo' && e.type !== 'lift') continue;
    const [a, b] = [e.x, e.x + (e.w ?? 120)];
    if (gaps.some(([l, r]) => a < r && b > l)) minLanding = Math.min(minLanding, b - a);
  }
  if (gaps.length) fam.add('bosluk');
  const m = ROOM_RATINGS[c.id];
  const families = [...fam];
  const struct = Math.min(10, families.length * 0.9 + timed * 0.35 + hazards * 0.12 + Math.max(0, maxGap - 100) / 60);
  // ölçüm yoksa (yeni oda, puanlar.ts yenilenmedi) yapıdan kaba tahmin
  const dmg = m?.dmg ?? struct * 0.02; const hit = m?.hit ?? Math.min(1, dmg); const nm = m?.nm ?? struct * 0.2;
  // risk: oyuncu kitlesinin can kaybı + acemi modelin yarısı + yakın kaçışların küçük payı (hasarsız odaları da ayırır);
  // puan 0-10, yapı %15
  const h0 = m?.h0 ?? dmg * 0.3, h1 = m?.h1 ?? dmg * 0.6;
  const risk = (h0 + h1) / 2 + 0.5 * dmg + 0.05 * nm;
  const score = Math.round((10 * (1 - Math.exp(-2.2 * risk)) * 0.85 + struct * 0.15) * 100) / 100;
  const st: RoomStats = { families, enemies: [...enemies], maxGap, minLanding, hazards, timed, dmg, h0, h1, hit, nm, score };
  cache.set(c.id, st);
  return st;
}

/** oyuncu kitlesinin bu odada, verilen sıkılıkta kaybedeceği tahmini can (ölçülen iki uç arası doğrusal) */
export function predictDmg(c: ChunkSpec, tight: number): number { const st = roomStats(c); return st.h0 + (st.h1 - st.h0) * Math.max(0, Math.min(1, tight)); }
