import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KG_ACILIS, KG_HIKAYE } from '../../../../packages/content/src/kamp-gorev';
import { NARRATOR_LINES, lineText } from './script';
import { FEATURES, TOUR_IDS } from './features';

const src = (f: string) => readFileSync(resolve(__dirname, f), 'utf8');

describe('Tüy Dede: Kamp Görevleri satırları ve turları', () => {
  it('hikâyenin her bölümünün giriş ve bitiş satırı tanımlı; turlarda kullanılan kg- satırları tanımlı', () => {
    for (const c of KG_HIKAYE) { expect(() => lineText(c.intro), c.intro).not.toThrow(); expect(() => lineText(c.outro), c.outro).not.toThrow(); }
    const used = new Set([...`${src('Director.tsx')}\n${src('../camp/gorev/Klinik.tsx')}`.matchAll(/'(kg-[a-z0-9-]+)'/g)].map((m) => m[1]!));
    expect(used.size).toBeGreaterThanOrEqual(7);
    for (const id of used) expect(() => lineText(id), id).not.toThrow();
  });
  it('satırlar kısa, rakamsız, seslendirmede "jeton" yok (yanlış okunuyor), Koklea doğru yazılı', () => {
    const kg = NARRATOR_LINES.filter((l) => l.id.startsWith('kg-'));
    expect(kg.length).toBe(KG_HIKAYE.length * 2 + 7);
    for (const l of kg) {
      expect(l.text.length, l.id).toBeLessThanOrEqual(140);
      expect(/\d/.test(l.text), `${l.id}: rakam yok`).toBe(false);
      expect(/jeton/i.test(l.spoken ?? l.text), `${l.id}: "jeton" seslendirilmez`).toBe(false);
      expect(/salyangoz/i.test(l.text), l.id).toBe(false);
      expect(l.context.length).toBeGreaterThan(10); expect(l.emotion).toBeTruthy();
    }
  });
  it('özellikler adım adım açılır (görevler → oyunlar → vakalar) ve her birinin turu var', () => {
    const at = (id: string) => FEATURES.find((f) => f.id === id)!.at;
    expect(at('gorev')).toBe(KG_ACILIS.gorev); expect(at('kampoyun')).toBe(KG_ACILIS.oyun); expect(at('vaka')).toBe(KG_ACILIS.vaka);
    expect(at('gorev')).toBeGreaterThan(at('camp'));
    for (const id of ['gorev', 'kampoyun', 'vaka']) { expect(TOUR_IDS as readonly string[]).toContain(id); expect(src('Director.tsx')).toContain(`case '${id}':`); }
  });
});
