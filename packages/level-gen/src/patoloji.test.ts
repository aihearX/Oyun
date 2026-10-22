import { describe, expect, it } from 'vitest';
import type { ChunkSpec } from '@odi/shared';
import { HUMAN_JOURNEY, PATHOLOGY_IDS, PATOLOJILER, PATOLOJI_IDS, REGION_PATHOLOGIES, remediesFor } from '@odi/content';
import { generateLevel } from './generate';
import { PATHOLOGY_ROOMS, pathologiesIn, PATOLOJI_ZONE, tagPathologies } from './patoloji';

/** Bölge patolojileri (content/src/patolojiler.ts, level-gen/src/patoloji.ts; docs/odyoloji-icerik.md "Bölge patolojileri"). */
const levels = HUMAN_JOURNEY.levels.map((l) => generateLevel('insan', l.number));
const strip = (chunks: ChunkSpec[]): ChunkSpec[] => chunks.map((c) => ({
  ...c,
  entities: c.entities.filter((e) => e.props?.kind !== PATOLOJI_ZONE).map((e) => {
    if (!e.props || !('patoloji' in e.props)) return e;
    const { patoloji: _p, ...rest } = e.props; void _p; return { ...e, props: rest };
  }),
}));

describe('bölge patolojileri', () => {
  it('kayıt kamp ekibinin kimlikleriyle birebir aynı; her kaydın adı, terimi, iki cümlesi ve kaynağı var', () => {
    expect([...PATOLOJI_IDS]).toEqual([...PATHOLOGY_IDS]);
    for (const id of PATOLOJI_IDS) {
      const p = PATOLOJILER[id];
      expect(p.id).toBe(id);
      for (const k of ['ad', 'terim', 'sade', 'teknik', 'mekanik', 'kaynak'] as const) expect(p[k].length, `${id}.${k}`).toBeGreaterThan(3);
      expect(p.sade.length, id).toBeLessThanOrEqual(140);
    }
  });
  it('bölge eşlemesi kamp ekibinin REGION_PATHOLOGIES tablosuyla aynı', () => {
    for (const [region, ids] of Object.entries(REGION_PATHOLOGIES)) {
      expect(PATOLOJI_IDS.filter((id) => (PATOLOJILER[id].bolge as string[]).includes(region)).sort(), region).toEqual([...ids].sort());
    }
  });
  it('bölümlerde 18 patolojinin hepsi görünür; her birinin ilk bölümü kayıttaki ilkBolum', () => {
    const first: Record<string, number> = {};
    for (const sp of levels) for (const p of pathologiesIn(sp.chunks)) first[p] ??= sp.number;
    const seen = Object.keys(first);
    expect(seen.length).toBe(PATOLOJI_IDS.length);
    for (const id of seen) expect(PATOLOJI_IDS as readonly string[], id).toContain(id);
    for (const id of PATOLOJI_IDS) expect(first[id] ?? 0, id).toBe(PATOLOJILER[id].ilkBolum);
  });
  it('her bölümün patolojileri kendi bölgesinin (dış kulak ve boss bölümlerinde yok)', () => {
    for (const sp of levels) {
      const ps = pathologiesIn(sp.chunks);
      if (sp.biome === 'dis-kulak' || sp.mechanic === 'boss') { expect(ps, `${sp.number}`).toEqual([]); continue; }
      for (const p of ps) expect(PATOLOJILER[p as keyof typeof PATOLOJILER].bolge as string[], `${sp.number} ${p}`).toContain(sp.biome);
    }
  });
  it('işaretleme yalnız etiket ve çarpışmasız bölge ekler: geometri, zamanlama ve diğer özellikler aynı kalır', () => {
    for (const sp of levels) {
      const bare = strip(sp.chunks);
      expect(tagPathologies(bare, sp.biome), `${sp.number}`).toEqual(sp.chunks);
      bare.forEach((c, i) => expect(c.entities.length, `${sp.number}/${c.id}`).toBe(sp.chunks[i]!.entities.filter((e) => e.props?.kind !== PATOLOJI_ZONE).length));
    }
  });
  it('düşme bölgeleri yalnız düşülen patolojiler için ve en az 40 px', () => {
    for (const sp of levels) for (const c of sp.chunks) for (const e of c.entities) if (e.props?.kind === PATOLOJI_ZONE) {
      expect(['perforasyon', 'zincir-kopuk', 'presbiakuzi', 'noropati', 'merkezi']).toContain(e.props.patoloji);
      expect(e.w ?? 0).toBeGreaterThanOrEqual(40);
    }
  });
  it('patoloji odaları yalnız kendi bölümünde (10 plaklı zar, 11 zar cebi, 14 orta kulak sıvısı)', () => {
    for (const sp of levels) {
      const ids = sp.chunks.map((c) => c.id).filter((id) => ['zr-plak', 'zr-cep', 'km-sivi'].includes(id));
      expect(ids, `${sp.number}`).toEqual(PATHOLOGY_ROOMS[sp.number] ?? []);
    }
  });
  it('Meniere ve akustik nörom için bilerek malzeme yok (hekim süreci); bölümde görünen öteki patolojilerin malzemesi var', () => {
    expect(remediesFor('meniere')).toEqual([]); expect(remediesFor('noroma')).toEqual([]);
    const seen = new Set(levels.flatMap((sp) => pathologiesIn(sp.chunks)));
    for (const id of seen) if (id !== 'meniere' && id !== 'noroma') expect(remediesFor(id).length, id).toBeGreaterThan(0);
  });
});
