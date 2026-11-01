import { describe, expect, it } from 'vitest';
import { QUICK_PHRASES, phraseById, tipPhrasesFor } from './social';

/** YN-093: "İpucu ver" hazır ipuçları bölüme göre (OT-buyuk-yazi-23, OT-sessiz-oyuncu-10) */
describe('hazır ipuçları bölümün özelliklerine göre', () => {
  it('19. bölüm (kanca + sis + melodi): uyanlar önde, başka mekaniğin ipucu yok, genel ipuçları arkada', () => {
    const { list, fits } = tipPhrasesFor(['makine', 'melody', 'sis']);
    expect(fits).toBe(true);
    expect(list.slice(0, 3).map((p) => p.id).sort()).toEqual(['ipucu-kanca', 'ipucu-melodi', 'ipucu-sis']);
    expect(list.some((p) => p.id === 'ipucu-nefes' || p.id === 'ipucu-ritim')).toBe(false);
    expect(list.some((p) => p.id === 'ipucu-bas')).toBe(true);
  });
  it('uyan ipucu yoksa yalnız genel ipuçları (başlık "genel" der)', () => {
    const { list, fits } = tipPhrasesFor(['kosu', 'reach']);
    expect(fits).toBe(false);
    expect(list.every((p) => !p.when)).toBe(true);
  });
  it('ritim ipucu yalnız sese dayanmaz; her ipucu sunucunun doğruladığı listede ve "ipucu" bağlamında', () => {
    expect(phraseById('ipucu-ritim')?.text).toMatch(/platformların ışığına bak/);
    expect(QUICK_PHRASES.some((p) => /dinle/.test(p.text))).toBe(false);
    for (const p of tipPhrasesFor(['trambolin', 'yuzme', 'boss', 'impuls', 'ruya', 'gece', 'yanki']).list) expect(phraseById(p.id)?.ctx).toContain('ipucu');
    expect(new Set(QUICK_PHRASES.map((p) => p.id)).size).toBe(QUICK_PHRASES.length);
  });
});
