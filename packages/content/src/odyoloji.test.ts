import { describe, expect, it } from 'vitest';
import { CARDS } from './cards';
import { QUIZ_QUESTIONS } from './quiz';
import { EAR_NOTES, GLOSSARY } from './odyoloji';

/** bozuk kodlama (mojibake), yer tutucu ve boşluk hataları */
const BAD = /Ã|Ä|Å|Ð|Þ|�|\s{2,}|\s[,.;:!?]|TODO|XXX|lorem/i;
const TR_WORDS = /[a-zçğıöşü]/i;
function sane(s: string, where: string) {
  expect(s.trim(), where).toBe(s);
  expect(s.length, where).toBeGreaterThan(5);
  expect(BAD.test(s), `${where}: “${s}”`).toBe(false);
  expect(TR_WORDS.test(s), where).toBe(true);
  // parantez ve tırnaklar dengeli
  expect((s.match(/\(/g) ?? []).length, `${where} parantez`).toBe((s.match(/\)/g) ?? []).length);
  expect((s.match(/“/g) ?? []).length, `${where} tırnak`).toBe((s.match(/”/g) ?? []).length);
}
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe('odyoloji içeriği', () => {
  it('sözlük: eşsiz kimlik ve terim, sade + teknik tanım, kaynak', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
    expect(dupes(GLOSSARY.map((g) => g.id))).toEqual([]);
    expect(dupes(GLOSSARY.map((g) => g.term.toLocaleLowerCase('tr')))).toEqual([]);
    for (const g of GLOSSARY) {
      sane(g.term, g.id); sane(g.plain, `${g.id}.plain`); sane(g.tech, `${g.id}.tech`);
      expect(g.plain.endsWith('.'), g.id).toBe(true); expect(g.tech.endsWith('.'), g.id).toBe(true);
      expect(g.src.length, g.id).toBeGreaterThan(10);
      expect(g.tech.length, `${g.id}: teknik satır sadeden ayrıntılı olmalı`).toBeGreaterThan(g.plain.length * 0.8);
    }
  });
  it('Tüy Dede notları: eşsiz, tek cümlelik sade satır, teknik ayrıntı, kaynak', () => {
    expect(EAR_NOTES.length).toBeGreaterThanOrEqual(30);
    expect(dupes(EAR_NOTES.map((n) => n.id))).toEqual([]);
    expect(dupes(EAR_NOTES.map((n) => n.plain))).toEqual([]);
    for (const n of EAR_NOTES) {
      sane(n.plain, n.id); sane(n.tech, `${n.id}.tech`);
      expect(n.plain.length, `${n.id}: sade satır kısa olmalı`).toBeLessThanOrEqual(130);
      expect(n.src.length, n.id).toBeGreaterThan(5);
      if (n.spoken) expect(/\d/.test(n.spoken), `${n.id}: okunuşta rakam olmamalı`).toBe(false);
    }
    // her bölgede en az bir not
    for (const r of new Set(GLOSSARY.map((g) => g.region))) expect(EAR_NOTES.some((n) => n.region === r), r).toBe(true);
  });
  it('Kulak Kartları: 50 kart, kimlikler kalıcı (biyom:yuva), sade + teknik satır', () => {
    expect(CARDS.length).toBe(50);
    expect(dupes(CARDS.map((c) => c.id))).toEqual([]);
    expect(dupes(CARDS.map((c) => c.title))).toEqual([]);
    for (const c of CARDS) {
      expect(c.id).toMatch(/^[a-z0-9-]+:(ilk|yildiz|ozel|sandik|usta)$/);
      sane(c.title, c.id); sane(c.fact, `${c.id}.fact`); sane(c.tech, `${c.id}.tech`);
    }
  });
  it('quiz: en az 120 soru, iki düzey, her soruda tek doğru cevap ve açıklama', () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(120);
    const merakli = QUIZ_QUESTIONS.filter((q) => q.level === 'merakli').length;
    const odyo = QUIZ_QUESTIONS.filter((q) => q.level === 'odyoloji').length;
    expect(merakli).toBeGreaterThanOrEqual(60); expect(odyo).toBeGreaterThanOrEqual(55);
    expect(merakli + odyo).toBe(QUIZ_QUESTIONS.length);
    expect(dupes(QUIZ_QUESTIONS.map((q) => q.text))).toEqual([]);
    QUIZ_QUESTIONS.forEach((q, i) => {
      expect(q.id).toBe(i + 1); // kimlik = sıra (yeni sorular yalnız sona)
      sane(q.text, `#${q.id}`); sane(q.explain, `#${q.id}.explain`);
      expect(q.text.endsWith('?'), `#${q.id}`).toBe(true);
      expect(q.choices.length).toBe(4);
      expect(new Set(q.choices.map((c) => c.toLocaleLowerCase('tr'))).size, `#${q.id}: seçenekler farklı olmalı`).toBe(4);
      for (const c of q.choices) expect(c.trim().length, `#${q.id}`).toBeGreaterThan(0);
      expect([0, 1, 2, 3]).toContain(q.answer);
    });
    // doğru cevap konumu dengeli dağılır (hep aynı şık olmasın)
    const pos = [0, 1, 2, 3].map((k) => QUIZ_QUESTIONS.filter((q) => q.answer === k).length);
    for (const n of pos) expect(n).toBeGreaterThan(QUIZ_QUESTIONS.length / 8);
  });
});
