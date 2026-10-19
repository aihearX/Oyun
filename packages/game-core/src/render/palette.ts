/**
 * Biyom sanat paletleri — "Kulak Gecesi" teması: koyu, büyülü, ışıklı. Her biyom anatomiden esinlenir ama sevimli kalır.
 * İçerikteki pastel paletler (content/biomes.ts) harita kartları içindir; oyun içi bu gece paletini kullanır.
 */
export type Motif = 'auricle' | 'tunnel' | 'drum' | 'bones' | 'spiral' | 'nerve' | 'stem' | 'cortex';

export interface BiomeArt {
  id: string;
  motif: Motif;
  /** gök: üst → orta → ufuk */
  sky: [number, number, number];
  /** ana ışık (ay, uzak parıltı) ve konumu (0..1 ekran) */
  light: { c: number; x: number; y: number; r: number };
  /** siluet renkleri: uzak (puslu) → yakın (koyu) */
  far: number; midFar: number; mid: number; near: number; fg: number;
  /** atmosfer sisi */
  fog: number;
  /** zemin: üst kat (dudak), parlaklık, gövde üstü, derin, kenar ışığı, kontur */
  ground: { top: number; topHi: number; topLo: number; body: number; deep: number; rim: number; line: number };
  /** vurgu (ışık, parıltı) ve süs renkleri */
  accent: number; accent2: number;
  /** sürüklenen parçacık renkleri */
  motes: number[];
  /** tonotopi aralığı (koklea) */
  tono?: [number, number];
  /** suyun içinde mi (kabarcıklar, ışık huzmeleri yukarıdan) */
  underwater?: boolean;
  /** bölüm kimliği: gökteki vurgu motifi (bkz. LEVEL_VARIANTS) */
  skyAccent?: SkyAccent;
}

/** gökte bölüme özgü vurgu: ses halkaları, hilal ay, ufuk huzmeleri, kayan yıldızlar, nota takımyıldızı */
export type SkyAccent = 'halkalar' | 'ay' | 'huzme' | 'kayan' | 'nota-burcu';

/**
 * Aynı biyomdaki bölümler aynı görünmesin (docs/11 §6): her bölüm, biyom paletinin bir "günün saati / ruh hali"
 * varyantıyla ve gökte kendi vurgu motifiyle boyanır. Ağır yeni varlık yok: yalnızca palet kaydırma + birkaç gök çizimi.
 * Zemin renkleri (oynanış okunaklılığı) değişmez; siluetler gökle uyum için hafifçe yeni göğe çekilir.
 * Varyant kimliği doku önbelleği ve siluet tohumunu da değiştirir (tepe/ağaç dizilişi bölüme göre farklı).
 */
export interface LevelVariant { name: string; sky: (s: [number, number, number]) => [number, number, number]; light: (l: BiomeArt['light']) => BiomeArt['light']; accent: SkyAccent; fog?: (f: number) => number; motes?: (m: number[]) => number[] }
export const LEVEL_VARIANTS: LevelVariant[] = [
  { name: 'aksam', sky: (s) => s, light: (l) => l, accent: 'halkalar' },
  { name: 'gece', sky: ([t, m, h]) => [mixC(t, 0x03020c, 0.4), mixC(m, 0x0a0a2a, 0.45), mixC(h, 0x3a3a8a, 0.55)], light: () => ({ c: 0xe4ecff, x: 0.24, y: 0.2, r: 0.34 }), accent: 'ay', fog: (f) => mixC(f, 0x8a9aff, 0.5), motes: (m) => [0xdbe8ff, ...m.slice(1)] },
  { name: 'safak', sky: ([t, m, h]) => [mixC(t, 0x1a2a6a, 0.45), mixC(m, 0x6a5aa8, 0.35), mixC(h, 0xffd8a0, 0.6)], light: (l) => ({ c: mixC(l.c, 0xfff0c0, 0.6), x: 0.22, y: 0.8, r: 0.62 }), accent: 'huzme', fog: (f) => mixC(f, 0xffe0b8, 0.4) },
  { name: 'mor-sis', sky: ([t, m, h]) => [mixC(t, 0x10062a, 0.3), mixC(m, 0x3a1a7a, 0.45), mixC(h, 0x7a6aff, 0.5)], light: (l) => ({ c: mixC(l.c, 0xc8b8ff, 0.5), x: 0.78, y: 0.42, r: 0.5 }), accent: 'kayan', fog: (f) => mixC(f, 0xb8a8ff, 0.5) },
  { name: 'kizil', sky: ([t, m, h]) => [mixC(t, 0x1a0410, 0.4), mixC(m, 0x6a1430, 0.45), mixC(h, 0xff6a4a, 0.5)], light: (l) => ({ c: mixC(l.c, 0xffa070, 0.5), x: 0.55, y: 0.7, r: 0.7 }), accent: 'nota-burcu', fog: (f) => mixC(f, 0xff9a80, 0.4) },
];
function mixC(a: number, b: number, t: number): number { const m = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); }

/** biyom sanatı + bölüm varyantı (0 = biyomun kendi paleti, yalnız gök motifi eklenir) */
export function variantArt(A: BiomeArt, v: number): BiomeArt {
  const V = LEVEL_VARIANTS[((v % LEVEL_VARIANTS.length) + LEVEL_VARIANTS.length) % LEVEL_VARIANTS.length]!;
  if (V.name === 'aksam') return { ...A, id: `${A.id}~0`, skyAccent: V.accent };
  const sky = V.sky(A.sky); const pull = (c: number, k: number) => mixC(c, sky[1], k);
  return {
    ...A, id: `${A.id}~${v}`, sky, light: V.light(A.light), skyAccent: V.accent,
    far: pull(A.far, 0.28), midFar: pull(A.midFar, 0.2), mid: pull(A.mid, 0.14), near: pull(A.near, 0.08),
    fog: V.fog ? V.fog(A.fog) : A.fog, motes: V.motes ? V.motes(A.motes) : A.motes,
  };
}

export const BIOME_ART: Record<string, BiomeArt> = {
  'dis-kulak': {
    id: 'dis-kulak', motif: 'auricle',
    sky: [0x140c35, 0x4a2468, 0xf08aa0], light: { c: 0xffc59a, x: 0.7, y: 0.62, r: 0.55 },
    far: 0x8a4a86, midFar: 0x6a3274, mid: 0x4c2160, near: 0x2e1244, fg: 0x1a0828, fog: 0xffa6b8,
    ground: { top: 0xf7a48c, topHi: 0xffd9c8, topLo: 0xd8746a, body: 0x6a2c5c, deep: 0x220c34, rim: 0xffb48a, line: 0x3a1238 },
    accent: 0xffc93c, accent2: 0xff8a7a, motes: [0xffd9a0, 0xffb3c4, 0xfff6e5],
  },
  'kanal': {
    id: 'kanal', motif: 'tunnel',
    sky: [0x0e0507, 0x3a1410, 0xff9f3c], light: { c: 0xffb347, x: 0.62, y: 0.5, r: 0.5 },
    far: 0x7a3418, midFar: 0x5a2412, mid: 0x3e170c, near: 0x260c06, fg: 0x140503, fog: 0xffa04a,
    ground: { top: 0xffb53c, topHi: 0xffe9a8, topLo: 0xd9781a, body: 0x58240f, deep: 0x160604, rim: 0xffc25c, line: 0x2a0c04 },
    accent: 0xffc93c, accent2: 0xff7a2c, motes: [0xffc25c, 0xffe1a0, 0xff9f1c],
  },
  'zar': {
    id: 'zar', motif: 'drum',
    sky: [0x12082a, 0x4a1450, 0xff6f9e], light: { c: 0xffc2dc, x: 0.5, y: 0.36, r: 0.55 },
    far: 0x8a3a84, midFar: 0x6a2468, mid: 0x4c1650, near: 0x300a36, fg: 0x1a041e, fog: 0xff9ec4,
    ground: { top: 0xf9b6d6, topHi: 0xfff0f8, topLo: 0xd57aa8, body: 0x5e1e56, deep: 0x1c0622, rim: 0xff9ec8, line: 0x3a0a34 },
    accent: 0xff5c8a, accent2: 0xffc93c, motes: [0xffc2dc, 0xfff6e5, 0xff8ab0],
  },
  'kemikcikler': {
    id: 'kemikcikler', motif: 'bones',
    sky: [0x0a1030, 0x1e3266, 0x6a8fd8], light: { c: 0xdbe8ff, x: 0.72, y: 0.28, r: 0.42 },
    far: 0x4a64a0, midFar: 0x34508a, mid: 0x243a6c, near: 0x16244a, fg: 0x0a1028, fog: 0xa8c4ff,
    ground: { top: 0xf2e8d2, topHi: 0xfffdf4, topLo: 0xc9b996, body: 0x34446e, deep: 0x0c1230, rim: 0xbfd6ff, line: 0x141c40 },
    accent: 0xffc93c, accent2: 0x8fb6ff, motes: [0xdbe8ff, 0xfff6e5, 0xffc93c],
  },
  'koklea-1': {
    id: 'koklea-1', motif: 'spiral', tono: [0, 0.33], underwater: true,
    sky: [0x080a30, 0x1c1a70, 0x4a5ee0], light: { c: 0x9fb4ff, x: 0.4, y: 0.0, r: 0.7 },
    far: 0x3a3a9a, midFar: 0x2c2884, mid: 0x1e1a64, near: 0x120e44, fg: 0x08062a, fog: 0x8b8bff,
    ground: { top: 0x8b6bff, topHi: 0xd8ccff, topLo: 0x5a40d0, body: 0x2e2378, deep: 0x0a0826, rim: 0x6fa8ff, line: 0x120a40 },
    accent: 0x2ee6d6, accent2: 0x8b6bff, motes: [0xbfe6ff, 0x8b6bff, 0x2ee6d6],
  },
  'koklea-2': {
    id: 'koklea-2', motif: 'spiral', tono: [0.33, 0.66], underwater: true,
    sky: [0x041628, 0x0a3a50, 0x22b8b0], light: { c: 0xa8fff0, x: 0.55, y: 0.0, r: 0.7 },
    far: 0x1a6a7a, midFar: 0x125866, mid: 0x0c424e, near: 0x062a34, fg: 0x02141c, fog: 0x7af0e0,
    ground: { top: 0x3ad8b0, topHi: 0xc8fff0, topLo: 0x1a9a88, body: 0x0f3e48, deep: 0x041218, rim: 0x8ef0b0, line: 0x04222a },
    accent: 0xffc93c, accent2: 0x8ef0b0, motes: [0xc8fff0, 0x8ef0b0, 0x2ee6d6],
  },
  'koklea-3': {
    id: 'koklea-3', motif: 'spiral', tono: [0.66, 1], underwater: true,
    sky: [0x1a0a2e, 0x50204e, 0xff8a3c], light: { c: 0xffc27a, x: 0.45, y: 0.0, r: 0.7 },
    far: 0x8a3a5a, midFar: 0x6c2648, mid: 0x4e1838, near: 0x320c26, fg: 0x1a0414, fog: 0xffa070,
    ground: { top: 0xffb04a, topHi: 0xfff0c0, topLo: 0xe0762a, body: 0x5a2232, deep: 0x180610, rim: 0xffd27a, line: 0x2e0a14 },
    accent: 0x8b6bff, accent2: 0xffd23c, motes: [0xffe0a0, 0xff9f5c, 0xffd23c],
  },
  'sinir': {
    id: 'sinir', motif: 'nerve',
    sky: [0x02041a, 0x081446, 0x1a40a0], light: { c: 0x6ad8ff, x: 0.5, y: 0.45, r: 0.6 },
    far: 0x1a3a8a, midFar: 0x122c70, mid: 0x0c1f54, near: 0x061238, fg: 0x02061a, fog: 0x4c8dff,
    ground: { top: 0xa8e4ff, topHi: 0xf0fcff, topLo: 0x5aa8e0, body: 0x1c2e72, deep: 0x040818, rim: 0x4cf0ff, line: 0x061038 },
    accent: 0x4cf0ff, accent2: 0xffc93c, motes: [0x4cf0ff, 0xa8e4ff, 0x8b6bff],
  },
  'beyin-sapi': {
    id: 'beyin-sapi', motif: 'stem',
    sky: [0x08051a, 0x221048, 0x7a2a90], light: { c: 0xff8fc0, x: 0.5, y: 0.55, r: 0.55 },
    far: 0x4a2a7a, midFar: 0x3a1f68, mid: 0x2a1450, near: 0x1a0c36, fg: 0x0c0620, fog: 0xc07aff,
    ground: { top: 0x9a7ae8, topHi: 0xe4d8ff, topLo: 0x6a4ac0, body: 0x2e2060, deep: 0x0a0618, rim: 0xff8fc0, line: 0x140a30 },
    accent: 0xff6b9b, accent2: 0x4cd8ff, motes: [0xff8fc0, 0x6bd7ff, 0xe4d8ff],
  },
  'korteks': {
    id: 'korteks', motif: 'cortex',
    sky: [0x10062a, 0x3c1464, 0xd04aa0], light: { c: 0xffb8e0, x: 0.3, y: 0.4, r: 0.6 },
    far: 0x7a2e8a, midFar: 0x5c2074, mid: 0x42165a, near: 0x2a0c3e, fg: 0x160622, fog: 0xff9ad8,
    ground: { top: 0xff9cc6, topHi: 0xffe4f0, topLo: 0xd8669a, body: 0x581f5c, deep: 0x160826, rim: 0xffc93c, line: 0x30082e },
    accent: 0xffc93c, accent2: 0xb69bff, motes: [0xfff1a8, 0xffb8e0, 0xb69bff],
  },
};

export function artOf(biomeId: string): BiomeArt { return BIOME_ART[biomeId] ?? BIOME_ART['dis-kulak']!; }
export const BIOME_IDS = Object.keys(BIOME_ART);
