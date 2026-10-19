import type { AbilityId, BiomeId, ChunkSpec, Entity, MechanicId } from '@odi/shared';
import { GROUND_Y } from '@odi/shared';

/**
 * Parça yazımını kısaltan yardımcılar. Koordinatlar px; y dünya yüksekliği (GROUND_Y zemin).
 * Dikdörtgenler sol-üst (x,y); ayaklılar (düşman, yay, zar, fırlatıcı, anahtar) x orta / y taban; noktalar merkez.
 */
export const G = GROUND_Y;
export const ground = (x: number, w: number, y = GROUND_Y): Entity => ({ type: 'platform', x, y, w, h: 200 });
export const plat = (x: number, y: number, w: number, h = 24): Entity => ({ type: 'platform', x, y, w, h });
/** kalın blok (katı, alttan geçilmez) */
export const block = (x: number, y: number, w: number, h: number): Entity => ({ type: 'platform', x, y, w, h: Math.max(40, h) });
export const spike = (x: number, w = 32, y = GROUND_Y): Entity => ({ type: 'spike', x, y, w });
export const coin = (x: number, y: number): Entity => ({ type: 'coin', x, y });
export const coins = (x: number, y: number, n: number, gap = 36, arc = 0): Entity[] => Array.from({ length: n }, (_, i) => coin(x + i * gap, y - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * arc));
/** dikey jeton sütunu */
export const coinCol = (x: number, y: number, n: number, gap = 36): Entity[] => Array.from({ length: n }, (_, i) => coin(x, y - i * gap));
export const enemy = (x: number, y: number, kind = 'devriye', dx = 60, extra: Record<string, number | string | boolean> = {}): Entity => ({ type: 'enemy', x, y, props: { kind, dx, ...extra } });
export const power = (x: number, y: number, kind: 'shield' | 'magnet' | 'life' | 'speed'): Entity => ({ type: 'powerup', x, y, props: { kind } });
export const hazard = (x: number, y: number, w: number, h: number, kind = 'gurultu', extra: Record<string, number | string | boolean> = {}): Entity => ({ type: 'hazard', x, y, w, h, props: { kind, ...extra } });
export const text = (x: number, y: number, t: string): Entity => ({ type: 'text', x, y, props: { text: t } });
/** altın koklea adayı (üretici her bölüm-içi bölümde birini tutar) */
export const secret = (x: number, y: number): Entity => ({ type: 'secret', x, y });
export const checkpoint = (x: number, y = GROUND_Y): Entity => ({ type: 'checkpoint', x, y });
export const spring = (x: number, y: number, power = 1): Entity => ({ type: 'spring', x, y, props: { power } });
/** zar; extra.beat: müziğin vuruşunda nabız atar, vuruşa denk gelen güçlü sıçrayış daha yükseğe çıkar */
export const trampoline = (x: number, y: number, w = 128, power = 1, extra: Record<string, number | string | boolean> = {}): Entity => ({ type: 'trampoline', x, y, w, props: { power, ...extra } });
export const moving = (x: number, y: number, w: number, dx: number, dy: number, period: number, phase = 0): Entity => ({ type: 'moving', x, y, w, h: 24, props: { dx, dy, period, phase } });
export const decor = (x: number, y: number, kind: string, scale = 1): Entity => ({ type: 'decor', x, y, props: { kind, scale } });
// ---- v2
export const wall = (x: number, y: number, h: number, w = 40): Entity => ({ type: 'wall', x, y, w, h });
export const hook = (x: number, y: number, r = 150): Entity => ({ type: 'hook', x, y, props: { r } });
export const crumble = (x: number, y: number, w = 120): Entity => ({ type: 'crumble', x, y, w, h: 24 });
export const barrier = (x: number, y: number, h = 160, w = 36): Entity => ({ type: 'barrier', x, y, w, h });
/** anahtar: by 'cakil' (üstüne çakıl), 'darbe' (ses darbesiyle vur), 'temas' (üstünden geç — geri dönülerek ulaşılır) */
export const sw = (x: number, y: number, id: string, by: 'cakil' | 'darbe' | 'temas' = 'cakil'): Entity => ({ type: 'switch', x, y, props: { id, by } });
export const door = (x: number, y: number, h: number, id: string, w = 36): Entity => ({ type: 'door', x, y, w, h, props: { id } });
export const fork = (x: number, y: number, color: number): Entity => ({ type: 'fork', x, y, props: { color } });
export const fgate = (x: number, y: number, h: number, color: number, w = 36): Entity => ({ type: 'freqgate', x, y, w, h, props: { color } });
export const beat = (x: number, y: number, w: number, pattern: string, extra: Record<string, number | string | boolean> = {}): Entity => ({ type: 'beat', x, y, w, h: 20, props: { pattern, mode: 'belir', ...extra } });
export const beatSlide = (x: number, y: number, w: number, dx: number, pattern: string, offset = 0): Entity => ({ type: 'beat', x, y, w, h: 20, props: { pattern, mode: 'kay', dx, offset } });
export const echo = (x: number, y: number, w = 120): Entity => ({ type: 'echo', x, y, w, h: 20 });
export const launcher = (x: number, y: number, vx: number, vy: number): Entity => ({ type: 'launcher', x, y, props: { vx, vy } });
export const water = (x: number, y: number, w: number, h: number): Entity => ({ type: 'water', x, y, w, h });
export const current = (x: number, y: number, w: number, h: number, vx: number, vy = 0): Entity => ({ type: 'current', x, y, w, h, props: { vx, vy } });
export const bubble = (x: number, y: number): Entity => ({ type: 'bubble', x, y });
export const grav = (x: number, y: number, w: number, h: number): Entity => ({ type: 'gravzone', x, y, w, h });
export const lift = (x: number, y: number, w: number, dy: number): Entity => ({ type: 'lift', x, y, w, h: 20, props: { dy } });
/** havuz: yüzey zeminin 10 px altında, derinlik `depth`; yan duvarları kalın blokla yap (block(x, G, w, depth + 210)) */
export const pool = (x: number, w: number, depth: number): Entity[] => [water(x, G - 10, w, depth + 10), { type: 'platform', x: x - 20, y: G + depth, w: w + 40, h: 160 }];
/** havuz kenarı zemini (havuzun duvarı olur) */
export const bank = (x: number, w: number, depth = 250): Entity => ({ type: 'platform', x, y: G, w, h: depth + 210 });
export const collect = (x: number, y: number): Entity => ({ type: 'collect', x, y });
export const tutor = (x: number, w: number, ability: AbilityId): Entity => ({ type: 'tutor', x, y: GROUND_Y, w, props: { ability } });
export const note = (x: number, y: number): Entity => ({ type: 'note', x, y });
export const escortee = (x: number, y: number): Entity => ({ type: 'escortee', x, y });

/**
 * Zıplama yayı üstüne nota dizisi (kahramanın gövde merkezinin izlediği eğri): kalkış ayağı x0'da, zemin y0'da.
 * `hold`: basılı tutma oranı 0 (dokun ≈ 69 px) … 1 (tam ≈ 163 px). Notalar uçuşun %18–%82'si arasında eşit aralıklı.
 * Fizik motorla aynı (JUMP_V 700, yükselirken basılı 1500 / bırakınca 3600, düşüş 2200, koşu 260) — nota her zaman
 * gerçekten ulaşılabilir bir yayın üstündedir; tam yay yalnız basılı tutana, alçak yay dokunana ödül verir.
 */
export function jumpArc(x0: number, n: number, hold = 1, y0 = GROUND_Y, run = 260): Entity[] {
  const dt = 1 / 60; const holdT = 0.02 + hold * 0.45; let t = 0, x = x0, y = y0, vy = -700; const pts: [number, number][] = [];
  while (t < 2) { const up = vy < 0; vy += (up ? (t < holdT ? 1500 : 3600) : 2200) * dt; y += vy * dt; x += run * dt; t += dt; if (y >= y0) break; pts.push([x, y - 21]); }
  const out: Entity[] = [];
  for (let i = 0; i < n; i++) { const k = 0.18 + (0.64 * i) / Math.max(1, n - 1); const p = pts[Math.min(pts.length - 1, Math.round(k * (pts.length - 1)))]!; out.push(coin(Math.round(p[0]), Math.round(p[1]))); }
  return out;
}

/**
 * Uçuş yayı üstüne notalar: ayak (x0, y0)'dan dikey hız `vy` (yukarı +) ile kalkan kahramanın gövde merkezi izi.
 * Zar/yay sıçrayışı ve fırlatıcı için (yükselirken yerçekimi 1500, düşüşte 2200; koşu 260 px/sn ileri). `landY`: iniş yüzeyi
 * (yay oradan sonra kesilir). Dikey sütun yerine gerçek yörünge: oyuncu doğru sıçrarsa notaların hepsi yolunun üstündedir.
 */
export function flightArc(x0: number, y0: number, vy: number, n: number, o: { landY?: number; from?: number; to?: number; run?: number } = {}): Entity[] {
  const dt = 1 / 60; const run = o.run ?? 260; const landY = o.landY ?? y0; let x = x0, y = y0, v = -vy; const pts: [number, number][] = [];
  for (let t = 0; t < 3; t += dt) { v += (v < 0 ? 1500 : 2200) * dt; y += v * dt; x += run * dt; if (v > 0 && y >= landY) break; pts.push([x, y - 21]); }
  const a = o.from ?? 0.12, b = o.to ?? 0.85; const out: Entity[] = []; if (!pts.length) return out;
  for (let i = 0; i < n; i++) { const k = a + ((b - a) * i) / Math.max(1, n - 1); const p = pts[Math.min(pts.length - 1, Math.round(k * (pts.length - 1)))]!; out.push(coin(Math.round(p[0]), Math.round(p[1]))); }
  return out;
}
/** süzülme yayı: tam basılı zıplama (x0'dan) + tepeden sonra süzülerek alçalış (115 px/sn); x0..x0+span arası n nota */
export function glideArc(x0: number, n: number, span: number, y0 = GROUND_Y): Entity[] {
  const dt = 1 / 60; let x = x0, y = y0, v = -700, t = 0; const pts: [number, number][] = [];
  while (x < x0 + span && t < 4) { v += (v < 0 ? (t < 0.47 ? 1500 : 3600) : 2200) * dt; if (v > 115) v = 115; y += v * dt; x += 260 * dt; t += dt; if (v > 0 && y >= y0) break; pts.push([x, y - 21]); }
  const out: Entity[] = [];
  for (let i = 0; i < n; i++) { const p = pts[Math.min(pts.length - 1, Math.round((0.15 + (0.83 * i) / Math.max(1, n - 1)) * (pts.length - 1)))]!; out.push(coin(Math.round(p[0]), Math.round(p[1]))); }
  return out;
}
/** kanca salınımı: kancanın (hx, hy) altındaki yay üstüne notalar (ip uzunluğu ≈ r; açı a0..a1 radyan, 0 = dik aşağı) */
export function hookArc(hx: number, hy: number, r: number, n: number, a0 = -0.85, a1 = 0.85): Entity[] {
  return Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / Math.max(1, n - 1); return coin(Math.round(hx + Math.sin(a) * (r - 4)), Math.round(hy + Math.cos(a) * (r - 4))); });
}
/** fırlatıcı yayı: launcher(lx, y, vx, vy) ile fırlatılan kahramanın yolu */
export const launchArc = (lx: number, vx: number, vy: number, n: number, o: { y?: number; landY?: number; from?: number; to?: number } = {}): Entity[] =>
  flightArc(lx - 6, o.y ?? GROUND_Y, -vy, n, { run: vx, landY: o.landY, from: o.from, to: o.to });
/** zar sıçrayışı yayı: zar üstünden (y = zar tabanı − 20) güçlü sıçrayış. Varsayılan: yükseliş bölümü (güçlü ve "Mükemmel"
 *  sıçrayış ikisi de geçer); `perfect` + from/to ≈ 0,45–0,6: yalnız "Mükemmel" sıçrayışın tepesindeki ödül notaları */
export const trampArc = (x0: number, n: number, o: { power?: number; perfect?: boolean; landY?: number; from?: number; to?: number; base?: number } = {}): Entity[] =>
  flightArc(x0, (o.base ?? GROUND_Y + 60) - 20, 1080 * (o.power ?? 1) * (o.perfect ? 1.12 : 1), n, { landY: o.landY, from: o.from ?? 0.05, to: o.to ?? 0.42 });

export interface ChunkOpts { entryY?: number; exitY?: number; tags?: string[]; biomes?: BiomeId[]; rest?: boolean; needs?: AbilityId[]; setPiece?: boolean }
export function chunk(id: string, mechanic: MechanicId, difficulty: ChunkSpec['difficulty'], length: number, entities: Entity[], opts: ChunkOpts = {}): ChunkSpec {
  const c: ChunkSpec = { id, mechanic, difficulty, length, entities, entryY: opts.entryY ?? GROUND_Y, exitY: opts.exitY ?? GROUND_Y, tags: opts.tags ?? [], biomes: opts.biomes, rest: opts.rest };
  if (opts.needs) c.needs = opts.needs;
  if (opts.setPiece) c.setPiece = true;
  return c;
}
