// tanitim.mjs yardımcısı: oyunun içerik paketinden tanıtım dosyası için düz veri (bölümler, bölgeler, yetenekler, patolojiler,
// kartlar, başarımlar, kozmetikler). esbuild ile paketlenip node ile çalıştırılır; çıktı stdout'a JSON.
import { generateLevel } from '@odi/level-gen';
import { HUMAN_JOURNEY, BIOMES, ABILITIES, PATOLOJILER, DEFAULT_SKILLS, CARDS, ACHIEVEMENTS, COSMETICS, REMEDIES } from '@odi/content';

const levels = HUMAN_JOURNEY.levels.map((_, i) => {
  const n = i + 1;
  const s = generateLevel(HUMAN_JOURNEY.id, n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
  const pats = new Set<string>();
  for (const c of s.chunks) for (const e of (c as unknown as { entities?: { props?: { patoloji?: string } }[] }).entities ?? []) if (e.props?.patoloji) pats.add(e.props.patoloji);
  return {
    n, name: s.name, biome: s.biome, zone: BIOMES[s.biome].name, mechanic: s.mechanic, objective: s.objective.label, modifiers: s.modifiers,
    boss: !!s.boss, intro: s.intro ?? null, newAbilities: (s.newAbilities ?? []).map((a) => ({ id: a, name: ABILITIES[a].name, how: ABILITIES[a].how })),
    pats: [...pats], parTimeSec: s.parTimeSec, coinsTotal: s.coinsTotal,
  };
});
const out = {
  levels,
  biomes: Object.fromEntries(Object.values(BIOMES).map((b) => [b.id, { name: b.name, blurb: b.blurb, fact: b.fact }])),
  pathologies: Object.fromEntries(Object.values(PATOLOJILER).map((p) => [p.id, { ad: p.ad, terim: p.terim, sade: p.sade, mekanik: p.mekanik }])),
  cards: CARDS.map((c) => ({ id: c.id, biome: c.biome, title: c.title })),
  achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name })),
  cosmetics: COSMETICS.map((c) => ({ id: c.id, kind: c.kind, name: c.name })),
  remedies: REMEDIES.map((r) => ({ id: r.id, name: r.name, level: r.level })),
};
console.log(JSON.stringify(out));
