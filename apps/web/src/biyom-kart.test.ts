// Biyom kartı (OT-ilk-kez-oyun-48): melodi hedefi mekaniğin ("Yerçekimi:") başlığının altında değil, kendi başlığıyla.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BIOMES } from '@odi/content';
import type { LevelSpec } from '@odi/shared';
import { BiomeIntro } from './screens/BiomeIntro';

const spec = (number: number, biome: LevelSpec['biome'], mechanic: LevelSpec['mechanic']) => ({ number, biome, mechanic, abilities: [], newAbilities: [] }) as unknown as LevelSpec;
const sections = (html: string) => [...html.matchAll(/<div class="bi-mech-head[^"]*">(.*?)<\/div><ul class="bi-moves">(.*?)<\/ul>/g)].map((m) => ({ head: m[1]!.replace(/<[^>]+>/g, '').trim(), items: [...m[2]!.matchAll(/<li>(.*?)<\/li>/g)].map((x) => x[1]!) }));

describe('Biyom kartı: mekanik ve hedef ayrı başlıkta', () => {
  it('İşitme Korteksi: "Yerçekimi:" altında yalnız yerçekimi, melodi "Melodi:" başlığında', () => {
    const html = renderToStaticMarkup(createElement(BiomeIntro, { spec: spec(35, 'korteks', 'ruya'), onGo: () => undefined }));
    const s = sections(html);
    expect(s.map((x) => x.head)).toEqual(['Yerçekimi:', 'Melodi:']);
    expect(s[0]!.items.join(' ')).not.toMatch(/[Mm]elodi|[Nn]ota/);
    expect(s[1]!.items).toEqual(['Nota biçimli olanları soldan sağa, atlamadan topla (&quot;Nota 3/7&quot; yazar)']);
    // alt başlık ilk kez oynayana yabancı terimle başlamaz (Heschl sözlükte ve kartlarda)
    expect(BIOMES.korteks.blurb).not.toMatch(/Heschl/);
    expect(html).toContain(BIOMES.korteks.blurb);
  });
  it('melodi bölümü olmayan biyomda yalnız mekaniğin başlığı', () => {
    const html = renderToStaticMarkup(createElement(BiomeIntro, { spec: spec(31, 'sinir', 'impuls'), onGo: () => undefined }));
    expect(sections(html).map((x) => x.head)).toEqual(['Ses Darbesi:']);
  });
});
