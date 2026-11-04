// Biyom kartı (OT-ilk-kez-oyun-48): melodi hedefi mekaniğin ("Yerçekimi:") başlığının altında değil, kendi başlığıyla.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BIOMES, DEFAULT_SKILLS, HUMAN_JOURNEY } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import type { LevelSpec } from '@odi/shared';
import { nodeGoalLines, star3Line } from './map/goals';
import { BiomeIntro } from './screens/BiomeIntro';

const spec = (number: number, biome: LevelSpec['biome'], mechanic: LevelSpec['mechanic']) => ({ number, biome, mechanic, abilities: [], newAbilities: [], objective: { id: 'reach', label: 'Kapıya ulaş' }, coinsTotal: 60 }) as unknown as LevelSpec;
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

// YN-176: yeni biyom kartı ("Haydi!" doğrudan bölüme götürür) 3. yıldızın koşulunu bölüm kartıyla aynı satırla yazar
describe('Biyom kartı: 3. yıldız satırı', () => {
  const prof = { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS };
  it('her biyomun ilk bölümünde kartta "3. yıldız: …" bölüm kartının satırıyla aynı', () => {
    const firsts = HUMAN_JOURNEY.levels.filter((l, i, a) => a.findIndex((x) => x.biome === l.biome) === i);
    expect(firsts.length).toBeGreaterThan(5);
    for (const l of firsts) {
      const sp = generateLevel(HUMAN_JOURNEY.id, l.number, prof);
      const html = renderToStaticMarkup(createElement(BiomeIntro, { spec: sp, onGo: () => undefined }));
      const line = /data-testid="biyom-yildiz3">(.*?)<\/div>/.exec(html)?.[1]?.replace(/<[^>]+>/g, '').trim();
      expect(line, `bölüm ${l.number}`).toBe(star3Line(sp));
      expect(star3Line(sp)).toBe(`3. yıldız: ${nodeGoalLines(sp).star3}`);
    }
  });
  it('Kulak Zarı (9): "3. yıldız: 90 nota"; canavar bölümünde hasarsız', () => {
    const sp = generateLevel(HUMAN_JOURNEY.id, 9, prof);
    expect(star3Line(sp)).toBe(`3. yıldız: ${Math.ceil(sp.coinsTotal * 0.9 - 1e-9)} nota`);
    expect(star3Line(generateLevel(HUMAN_JOURNEY.id, 20, prof))).toBe('3. yıldız: Hiç hasar alma');
  });
});
