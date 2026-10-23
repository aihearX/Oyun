import type { BuildingId } from '@odi/shared';

/**
 * Kulak Kampı arazisi (docs/14-kamp.md §9): ana ada + Kamp Seviyesiyle açılan bölgeler (uydu adalar), bina arsaları ve süs ızgarası.
 * Saf geometri (Phaser'sız): sahne (game-core), sunucu (süs yerleşimini doğrular) ve testler aynı kuralı kullanır.
 * Koordinatlar ekran izdüşümündeki dünya birimidir (izometrik: bir karo 32 birim = ekranda 64×32).
 */

/** ana ada (kulak kepçesi vadisi) */
export const ISLAND = { cx: 0, cy: 6, rx: 610, ry: 330 };
/** ada kıyısı yarıçap çarpanı (açıya göre organik) */
export function shoreK(a: number): number { return 1 + 0.05 * Math.sin(a * 3 + 0.6) + 0.035 * Math.sin(a * 5 + 2.1) + 0.02 * Math.sin(a * 9 + 1.3); }
/** nokta ana adanın içinde mi (margin: 0..1, kıyıdan içeri oran) */
export function onIsland(x: number, y: number, margin = 0.9): boolean {
  const dx = (x - ISLAND.cx) / ISLAND.rx, dy = (y - ISLAND.cy) / ISLAND.ry; const a = Math.atan2(dy, dx);
  return Math.hypot(dx, dy) < shoreK(a) * margin;
}

export type DistrictId = 'koru' | 'koy' | 'tepe' | 'yerleske' | 'orman';
export interface District {
  id: DistrictId;
  name: string;
  /** açıldığı Kamp Seviyesi */
  level: number;
  /** bölgenin kısa tanımı (açılış kartı, kilitli tabela) */
  plain: string;
  cx: number; cy: number; rx: number; ry: number;
  /** kıyı dalgalanması için tohum */
  seed: number;
  /** bu bölgedeki binalar */
  buildings: BuildingId[];
}
/** Kamp Seviyesiyle açılan bölgeler (ana adanın çevresinde uydu adalar; köprüyle bağlanır) */
export const DISTRICTS: District[] = [
  { id: 'koru', name: 'Sessiz Koru', level: 3, seed: 11, cx: -780, cy: -405, rx: 280, ry: 160, buildings: ['kabin'],
    plain: 'Ağaçların sesi yuttuğu sakin koru. Akustik Kabin burada kurulur; en hafif ses ancak sessizlikte duyulur.' },
  { id: 'koy', name: 'Koklea Koyu', level: 6, seed: 23, cx: 1090, cy: 80, rx: 320, ry: 190, buildings: ['tarama', 'park'],
    plain: 'Sarmal bir lagün: kokleanın iki buçuk turu gibi kıvrılır. Yenidoğan Tarama Birimi ve Rehabilitasyon Parkı burada.' },
  { id: 'tepe', name: 'Denge Tepesi', level: 12, seed: 37, cx: -800, cy: 420, rx: 280, ry: 160, buildings: ['denge'],
    plain: 'Üç patikası üç yarım daire kanalı gibi birbirine dik uzanan tepe. Vestibüler Laboratuvar dengeyi burada ölçer.' },
  { id: 'yerleske', name: 'Araştırma Yerleşkesi', level: 16, seed: 41, cx: 700, cy: -445, rx: 290, ry: 150, buildings: ['kutuphane'],
    plain: 'Taş döşeli bilim mahallesi: kitaplar, makaleler ve sorular. Odyoloji Kütüphanesi burada.' },
  { id: 'orman', name: 'Kulak Kılı Ormanı', level: 20, seed: 53, cx: 740, cy: 515, rx: 290, ry: 140, buildings: [],
    plain: 'İnce, sık kulak kıllarından bir orman: kanalın girişindeki kıllar gibi tozu ve böcekleri tutar. Süsler için geniş bir alan.' },
];
export const districtById = (id: string): District | undefined => DISTRICTS.find((d) => d.id === id);
/** bu Kamp Seviyesinde açık bölgeler */
export const openDistricts = (campLevel: number): District[] => DISTRICTS.filter((d) => campLevel >= d.level);
/** bölge kıyısı çarpanı (tohumla farklı dalgalanma) */
export function districtShoreK(d: Pick<District, 'seed'>, a: number): number { return 1 + 0.06 * Math.sin(a * 3 + d.seed) + 0.04 * Math.sin(a * 5 + d.seed * 0.7) + 0.02 * Math.sin(a * 8 + d.seed * 1.3); }
export function inDistrict(d: District, x: number, y: number, margin = 0.88): boolean {
  const dx = (x - d.cx) / d.rx, dy = (y - d.cy) / d.ry; return Math.hypot(dx, dy) < districtShoreK(d, Math.atan2(dy, dx)) * margin;
}
/** iki kara arasındaki köprü: ana ada kıyısından bölge kıyısına (uç noktalar) */
export function bridgeOf(d: District): { x0: number; y0: number; x1: number; y1: number } {
  const a = Math.atan2((d.cy - ISLAND.cy) / ISLAND.ry, (d.cx - ISLAND.cx) / ISLAND.rx);
  const s = shoreK(a) * 0.97; const x0 = ISLAND.cx + Math.cos(a) * ISLAND.rx * s, y0 = ISLAND.cy + Math.sin(a) * ISLAND.ry * s;
  const b = Math.atan2((y0 - d.cy) / d.ry, (x0 - d.cx) / d.rx); const k = districtShoreK(d, b) * 0.95;
  return { x0, y0, x1: d.cx + Math.cos(b) * d.rx * k, y1: d.cy + Math.sin(b) * d.ry * k };
}

/** bina arsaları (arsa merkezi, yarıçap karo). Ana adadakiler değişmedi. */
export const CAMP_LOTS: Record<BuildingId, { x: number; y: number; tiles: number }> = {
  merkez: { x: 0, y: 0, tiles: 3 },
  laboratuvar: { x: -176, y: -112, tiles: 2 },
  kule: { x: 176, y: -112, tiles: 2 },
  atolye: { x: -240, y: 56, tiles: 2 },
  depo: { x: 240, y: 56, tiles: 2 },
  revir: { x: 0, y: 168, tiles: 2 },
  /** Tedavi Odası: merkezin arkasında, iki tepenin arasındaki vadide */
  tedavi: { x: 0, y: -226, tiles: 2 },
  kabin: { x: -790, y: -415, tiles: 2 },
  tarama: { x: 985, y: 5, tiles: 2 },
  park: { x: 1195, y: 120, tiles: 2 },
  denge: { x: -800, y: 400, tiles: 2 },
  kutuphane: { x: 705, y: -455, tiles: 2 },
};
/** binanın bulunduğu bölge (ana adadakiler için null) */
export function districtOfBuilding(id: BuildingId): District | null { return DISTRICTS.find((d) => d.buildings.includes(id)) ?? null; }

/** "Kulak Yolu": ön kıyı boyunca bölge anıtlarının yerleri (soldan sağa kulaktan beyne; zikzak iki sıra) */
export const KULAK_YOLU_REGIONS = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'] as const;
const KY_X = [-236, -192, -148, -104, -60, 30, 80, 130, 180, 230];
export const KULAK_YOLU: { region: (typeof KULAK_YOLU_REGIONS)[number]; x: number; y: number }[] = KULAK_YOLU_REGIONS.map((region, i) => {
  const x = KY_X[i]!; const k = i % 2 ? 0.71 : 0.8;
  const t = Math.min(0.99, Math.abs(x) / (ISLAND.rx * k));
  return { region, x, y: Math.round(ISLAND.cy + ISLAND.ry * k * Math.sqrt(1 - t * t)) };
});

// ---------------------------------------------------------------- süs ızgarası
/** hücre boyu (izometrik birim): hücre (gx, gy) ekranda (16·(gx−gy), 8·(gx+gy)) noktasına düşer */
export const DECOR_CELL = 16;
export const DECOR_GRID_MAX = 120;
/** hücre merkezinin ekran noktası */
export const cellPoint = (gx: number, gy: number): [number, number] => [(gx - gy) * DECOR_CELL, ((gx + gy) * DECOR_CELL) / 2];
/** ekran noktasına en yakın hücre */
export function pointCell(x: number, y: number): [number, number] {
  const u = (x / 2 + y) / DECOR_CELL, v = (y - x / 2) / DECOR_CELL; return [Math.round(u), Math.round(v)];
}
/** bir hücrenin (merkezinin) süs için uygun olup olmadığı: açık arazide, arsaların ve anıtların dışında */
export function cellFree(gx: number, gy: number, campLevel: number): boolean {
  if (Math.abs(gx) > DECOR_GRID_MAX || Math.abs(gy) > DECOR_GRID_MAX) return false;
  const [x, y] = cellPoint(gx, gy);
  const land = onIsland(x, y, 0.9) || openDistricts(campLevel).some((d) => inDistrict(d, x, y, 0.86));
  if (!land) return false;
  for (const id of Object.keys(CAMP_LOTS) as BuildingId[]) {
    const l = CAMP_LOTS[id]; const h = l.tiles * 16 + 14;
    if (Math.abs(x - l.x) / (h * 2) + Math.abs(y - l.y) / h <= 1) return false; // arsa elması (+pay)
    if (Math.abs(x - l.x) < h * 1.3 && y < l.y && y > l.y - h * 2.6) return false; // binanın gövdesi arkada yükselir
  }
  for (const m of KULAK_YOLU) if (Math.abs(x - m.x) < 26 && y - m.y > -40 && y - m.y < 22) return false;
  if (Math.hypot(x + 40, (y - 300) * 1.8) < 40) return false; // iskele başı
  return true;
}
/** süsün kapladığı hücreler (size × size) */
export function footprint(gx: number, gy: number, size: number): [number, number][] {
  const out: [number, number][] = []; for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) out.push([gx + i, gy + j]); return out;
}
