// Uygulama ikonu, uyarlanabilir ikon, splash ve favicon üretimi: saf JS PNG yazıcı (bağımlılık yok).
// Kullanım: node tools/make-icons.mjs   → assets/icon.png (1024), adaptive-icon.png (1024), splash-icon.png (512), favicon.png (64)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'assets');
fs.mkdirSync(out, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ACCENT = hex('#6c4cf1'), ACCENT2 = hex('#8f74ff'), WHITE = [255, 255, 255], CORAL = hex('#f0567a'), TEAL = hex('#2ee6d6');

/** Katmanlı çizim: her katman (x,y)→alpha 0..1 ve renk. Kenarlar 4× süper örnekleme ile yumuşatılır. */
function render(size, layers, { transparent = false, ss = 3 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const px = (x + (sx + 0.5) / ss) / size, py = (y + (sy + 0.5) / ss) / size;
      let cr = 0, cg = 0, cb = 0, ca = transparent ? 0 : 1;
      if (!transparent) { [cr, cg, cb] = WHITE; }
      for (const L of layers) { const al = L.a(px, py); if (al <= 0) continue; const c = L.c(px, py); cr = cr * (1 - al) + c[0] * al; cg = cg * (1 - al) + c[1] * al; cb = cb * (1 - al) + c[2] * al; ca = ca + al * (1 - ca); }
      r += cr; g += cg; b += cb; a += ca;
    }
    const n = ss * ss, i = (y * size + x) * 4;
    buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(b / n); buf[i + 3] = Math.round((a / n) * 255);
  }
  return png(size, size, buf);
}

const roundRect = (cx, cy, w, h, rad) => (x, y) => { const dx = Math.max(Math.abs(x - cx) - (w / 2 - rad), 0), dy = Math.max(Math.abs(y - cy) - (h / 2 - rad), 0); return Math.hypot(dx, dy) <= rad ? 1 : 0; };
const circle = (cx, cy, r) => (x, y) => (Math.hypot(x - cx, y - cy) <= r ? 1 : 0);
const ring = (cx, cy, r, t, a0, a1) => (x, y) => { const d = Math.hypot(x - cx, y - cy); if (Math.abs(d - r) > t / 2) return 0; const ang = Math.atan2(y - cy, x - cx); return ang >= a0 && ang <= a1 ? 1 : 0; };
const gradient = (c1, c2) => (x, y) => { const t = Math.min(1, Math.max(0, (x + y) / 2)); return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t]; };
const solid = (c) => () => c;

/** Odi: beyaz ses damlası + yankı halkaları (mor zemin). `pad` ile içerik küçültülür (uyarlanabilir ikon). */
function odiLayers(pad, withBg) {
  const s = 1 - pad * 2, o = pad;
  const m = (v) => o + v * s;
  const layers = [];
  if (withBg) layers.push({ a: roundRect(0.5, 0.5, 1, 1, 0.22), c: gradient(ACCENT, ACCENT2) });
  // yankı halkaları (sağa doğru)
  layers.push({ a: ring(m(0.42), m(0.5), 0.36 * s, 0.055 * s, -0.9, 0.9), c: solid([255, 255, 255]) });
  layers.push({ a: ring(m(0.42), m(0.5), 0.25 * s, 0.055 * s, -0.95, 0.95), c: solid([255, 255, 255]) });
  // Odi gövdesi
  layers.push({ a: circle(m(0.42), m(0.5), 0.14 * s), c: solid(WHITE) });
  // gözler
  layers.push({ a: circle(m(0.385), m(0.48), 0.022 * s), c: solid(ACCENT) });
  layers.push({ a: circle(m(0.455), m(0.48), 0.022 * s), c: solid(ACCENT) });
  // yanak
  layers.push({ a: circle(m(0.36), m(0.53), 0.02 * s), c: solid(CORAL) });
  layers.push({ a: circle(m(0.48), m(0.53), 0.02 * s), c: solid(CORAL) });
  // gülümseme
  layers.push({ a: ring(m(0.42), m(0.5), 0.07 * s, 0.018 * s, 0.35, 2.8), c: solid(ACCENT) });
  // ninni notası (turkuaz)
  layers.push({ a: circle(m(0.75), m(0.32), 0.035 * s), c: solid(TEAL) });
  layers.push({ a: roundRect(m(0.78), m(0.24), 0.018 * s, 0.17 * s, 0.009 * s), c: solid(TEAL) });
  return layers;
}

const files = {
  'icon.png': render(1024, [{ a: () => 1, c: gradient(ACCENT, ACCENT2) }, ...odiLayers(0, false)]),
  'adaptive-icon.png': render(1024, odiLayers(0.17, false), { transparent: true }),
  'splash-icon.png': render(512, odiLayers(0.04, true), { transparent: true }),
  'favicon.png': render(64, odiLayers(0, true)),
};
for (const [name, buf] of Object.entries(files)) { fs.writeFileSync(path.join(out, name), buf); console.log(name, buf.length, 'bayt'); }
