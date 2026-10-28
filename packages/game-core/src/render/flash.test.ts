import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { blinkOn, FLASH, HIT_FILL, overlayLuma, relLuma, safeFlashAlpha, safeFlashColor, setFlashPolicy, takeFlash } from './flash';

/** ışığa duyarlılık (WCAG 2.3.1): oyundaki ekran flaşlarının ölçüleri ve kaynak taraması */
const SRC = fileURLToPath(new URL('..', import.meta.url));
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith('.test.ts') ? [p] : []; });
const sources = files(SRC).map((p) => ({ p: p.slice(SRC.length), s: readFileSync(p, 'utf8') }));

/** bölüm 35'in gece zemini (ölçülen kare ortalaması ~0,04) ve daha açık bir gündüz zemini (kamp) */
const NIGHT_BG = 0x2a2150, DAY_BG = 0x808080;

describe('ekran flaşı ışığa duyarlılık sınırları (render/flash.ts)', () => {
  afterEach(() => setFlashPolicy({ reduced: false }));

  it('saydamlık en çok 0,35, saniyede en çok 3 flaş', () => {
    expect(FLASH.maxAlpha).toBeLessThanOrEqual(0.35);
    expect(FLASH.maxPerSec).toBeLessThanOrEqual(3);
    expect(FLASH.windowMs).toBeGreaterThanOrEqual(1000);
    expect(FLASH.blinkHz).toBeLessThan(3);
    expect(safeFlashAlpha(0.9)).toBe(FLASH.maxAlpha); expect(safeFlashAlpha(0.2)).toBe(0.2);
  });

  it('beyaz flaş rengi koyulaştırılır; tam ekran karede beyaza yakın parlaklık yok', () => {
    for (const c of [0xffffff, 0xfff6e5, 0xd6b8ff, 0xffe066, 0x8ef0b0, 0xffe08a, 0xc9b8ff]) {
      const safe = safeFlashColor(c);
      expect(relLuma(safe)).toBeLessThanOrEqual(FLASH.maxLuma + 1e-9);
      // en kötü kare: en açık renk, en yüksek saydamlık
      expect(overlayLuma(NIGHT_BG, safe, FLASH.maxAlpha)).toBeLessThan(0.2);
      expect(overlayLuma(DAY_BG, safe, FLASH.maxAlpha)).toBeLessThan(0.5);
      // gece zemininde parlaklık değişimi küçük kalır (eski beyaz kamera flaşı ~0,55 → 1,0 idi)
      expect(overlayLuma(NIGHT_BG, safe, FLASH.maxAlpha) - relLuma(NIGHT_BG)).toBeLessThan(0.15);
    }
    expect(relLuma(HIT_FILL)).toBeLessThanOrEqual(FLASH.maxLuma + 1e-9);
    // koyu renk değişmez
    expect(safeFlashColor(0xff3d6e)).toBe(0xff3d6e);
  });

  it('kayan 1 sn penceresinde en çok 3 flaş (art arda isteklerde fazlası atlanır)', () => {
    setFlashPolicy({ reduced: false });
    const shown: number[] = [];
    for (let t = 0; t <= 5000; t += 50) if (takeFlash(t)) shown.push(t);
    expect(shown.length).toBeGreaterThan(0);
    for (const t of shown) expect(shown.filter((u) => u >= t && u < t + 1000).length).toBeLessThanOrEqual(3);
  });

  it('azaltılmış harekette hiç flaş ve parıltı yok', () => {
    setFlashPolicy({ reduced: true });
    for (let t = 0; t < 3000; t += 100) expect(takeFlash(t)).toBe(false);
    for (let t = 0; t < 3; t += 1 / 60) expect(blinkOn(t)).toBe(false);
  });

  it('boss yenilgi parıltısı saniyede 3 kezden az', () => {
    setFlashPolicy({ reduced: false });
    let on = false, rises = 0;
    for (let i = 0; i < 600; i++) { const b = blinkOn(i / 60); if (b && !on) rises++; on = b; }
    expect(rises / 10).toBeLessThanOrEqual(3);
  });

  it('kaynak: kamera flaşı yok, tam ekran flaşlar güvenli yoldan; ui.flash çağrıları sınır içinde', () => {
    for (const { p, s } of sources) expect(s, p).not.toMatch(/cameras\.main\.flash\(|\bcam\.flash\(/);
    for (const { p, s } of sources) expect(s, p).not.toMatch(/setTintFill\(0xffffff\)/);
    const calls = sources.flatMap(({ p, s }) => [...s.matchAll(/\bflash\(this, (0x[0-9a-f]{6}), ([0-9.]+)/gi)].map((m) => ({ p, color: Number(m[1]), alpha: Number(m[2]) })));
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const c of calls) expect(c.alpha, `${c.p} ${c.color.toString(16)}`).toBeLessThanOrEqual(FLASH.maxAlpha);
    const ui = sources.find((f) => f.p.endsWith('ui.ts'))!.s;
    expect(ui).toMatch(/takeFlash\(/); expect(ui).toMatch(/safeFlashColor\(/); expect(ui).toMatch(/safeFlashAlpha\(/);
  });
});
