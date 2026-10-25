import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '@odi/shared';
import { MONUMENTS, levelLineId } from '../../../../packages/content/src/kamp';
import { DISTRICTS } from '../../../../packages/content/src/kamp-arazi';
import { NARRATOR_LINES, lineText } from './script';

describe('Tüy Dede: Kulak Kampı satırları', () => {
  it('her bina ve seviye için yükseltme satırı, her anıt için satır ve Tedavi Odası satırı tanımlı', () => {
    for (const b of BUILDINGS) for (let l = 1; l <= b.maxLevel; l++) expect(() => lineText(levelLineId(b.id, l)), `${b.id} Sv ${l}`).not.toThrow();
    for (const m of MONUMENTS) expect(() => lineText(m.line), m.region).not.toThrow();
    expect(() => lineText('tedavi-al-01')).not.toThrow();
    for (const d of DISTRICTS) expect(() => lineText(`kamp-bolge-${d.id}`), d.id).not.toThrow();
    for (const id of ['kamp-seviye-01', 'kamp-seviye-up', 'kamp-sus-01', 'kamp-ziyaret-01', 'kamp-sira-01']) expect(() => lineText(id), id).not.toThrow();
  });
  it('kamp satırları kısa, tek düşünce, Türkçe (kayıt için bağlam ve duygu yazılı)', () => {
    const camp = NARRATOR_LINES.filter((l) => /^(kamp-sv-|anit-|tedavi-|kamp-bolge-|kamp-seviye|kamp-sus|kamp-ziyaret)/.test(l.id));
    expect(camp.length).toBe(BUILDINGS.length * 3 + MONUMENTS.length + 1 + DISTRICTS.length + 4);
      expect(camp.filter((l) => /^kamp-(bolge|seviye|sus|ziyaret|sv-(kabin|tarama|park|denge|kutuphane))/.test(l.id)).every((l) => !/jeton/i.test(l.text)), 'yeni satırlarda “jeton” yok (seslendirme)').toBe(true);
    for (const l of camp) {
      expect(l.text.length, l.id).toBeLessThanOrEqual(140);
      expect(/\d/.test(l.text), `${l.id}: rakam yok (seslendirme)`).toBe(false);
      expect(l.context.length).toBeGreaterThan(10); expect(l.emotion).toBeTruthy();
    }
  });
});
