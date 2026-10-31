import { describe, expect, it } from 'vitest';
import { CARDS } from './cards';
import { QUIZ_QUESTIONS } from './quiz';
import { EAR_NOTES, GLOSSARY } from './odyoloji';
import { BILIYOR_MUYDUN, biliyorMuydun } from './biliyor-muydun';
import { HUMAN_JOURNEY } from './journeys';

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
      // YN-044: kart resmi çizili ikon adıdır, hiçbir alanda emoji yok
      expect(c.art, c.id).toMatch(/^[a-z]+$/);
      for (const t of [c.title, c.fact, c.tech]) expect(/\p{Extended_Pictographic}/u.test(t), `${c.id}: emoji`).toBe(false);
    }
  });
  it('sayı ile birim arasında bölünmez boşluk (U+00A0): satır sonunda "20" / "Hz" diye ayrılmaz', () => {
    const texts = [...GLOSSARY.flatMap((g) => [g.plain, g.tech]), ...EAR_NOTES.flatMap((n) => [n.plain, n.tech]), ...CARDS.flatMap((c) => [c.fact, c.tech])];
    for (const t of texts) expect(/\d (?:Hz|kHz|dB|cm|mm|ms|ml|daPa)(?![\p{L}\d])/u.test(t), t).toBe(false);
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

  it('Biliyor muydun? (karar 31): her bölümde bir satır, iki düzey, kısa, tek cümle, tekrar yok', () => {
    const n = HUMAN_JOURNEY.levels.length;
    expect(BILIYOR_MUYDUN.map((b) => b.bolum)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    const all = BILIYOR_MUYDUN.flatMap((b) => [b.genel, b.odyoloji]);
    expect(dupes(all)).toEqual([]);
    // Tüy Dede notları, sözlük ve Kulak Kartlarıyla kelimesi kelimesine aynı değil
    const eski = [...EAR_NOTES.flatMap((x) => [x.plain, x.tech]), ...GLOSSARY.flatMap((g) => [g.plain, g.tech]), ...CARDS.flatMap((c) => [c.fact, c.tech])];
    for (const b of BILIYOR_MUYDUN) {
      expect(b.src.length, `${b.bolum}`).toBeGreaterThan(10);
      for (const t of [b.genel, b.odyoloji]) {
        sane(t, `bölüm ${b.bolum}`);
        expect(t.length, `${b.bolum}: “${t}”`).toBeLessThanOrEqual(120);
        expect(t.endsWith('.'), t).toBe(true);
        // tek cümle: cümle sonu yalnız en sonda (kısaltma/ondalık yok sayılır)
        expect(/[.!?]\s+\p{Lu}/u.test(t.slice(0, -1)), `tek cümle: ${t}`).toBe(false);
        expect(eski.includes(t), `tekrar: ${t}`).toBe(false);
        expect(/salyangoz/i.test(t), t).toBe(false);
        expect(/\p{Extended_Pictographic}/u.test(t), t).toBe(false);
        // sayı ile birim arasında bölünmez boşluk
        expect(/\d (?:Hz|kHz|dB|cm|mm|ms|ml|mM|daPa|km|m\/sn|°C)(?![\p{L}\d])/u.test(t), t).toBe(false);
        // tanı/tedavi önerisi yok: oyuncuya "doktora git", "ilaç kullan", "tanın" gibi yönlendirme yazılmaz
        expect(/hekime git|doktora git|tedavi ol|ilaç kullan|tanın |sende .* var/i.test(t), t).toBe(false);
      }
      // timpanogramdan söz eden satır, tek başına tanı koydurmadığını söyler
      if (/timpanogram/i.test(b.odyoloji)) expect(b.odyoloji).toMatch(/tek başına tanı koydurmaz/);
    }
    expect(biliyorMuydun(1, 'genel')).toBe(BILIYOR_MUYDUN[0]!.genel);
    expect(biliyorMuydun(1, 'odyoloji')).toBe(BILIYOR_MUYDUN[0]!.odyoloji);
    expect(biliyorMuydun(n + 1, 'genel')).toBeNull();
  });
});
