import { describe, expect, it } from 'vitest';
import { CARDS } from './cards';
import { QUIZ_QUESTIONS, QUIZ_ROUND, pickQuizQuestions } from './quiz';
import { EAR_NOTES, GLOSSARY } from './odyoloji';
import { BILGI_YAKIN, BILIYOR_MUYDUN, biliyorMuydun, biliyorMuydunSatiri } from './biliyor-muydun';
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
  it('quiz: hiçbir şık A–D rozetleriyle karışmaz (tek harf ya da "Ad", "As" gibi; "B tipi" yazılır) (YN-118)', () => {
    for (const q of QUIZ_QUESTIONS) for (const c of q.choices) {
      expect(/^\p{L}$/u.test(c.trim()), `#${q.id}: “${c}”`).toBe(false);
      expect(/^[A-Da-d]\p{Ll}?$/u.test(c.trim()), `#${q.id}: “${c}”`).toBe(false);
    }
  });

  it('quiz seçimi (karar 41, YN-109): canlı yarışmada öğrenci 6 öğrenci + 4 genel; Pratik\'te öğrenci 10/10 öğrenci; Genel hep genel', () => {
    let seed = 1;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const lv = (qs: number[]) => qs.map((i) => QUIZ_QUESTIONS[i]!.level);
    for (let k = 0; k < 50; k++) {
      for (const opts of [undefined, { mode: 'canli' as const }]) {
        const canli = pickQuizQuestions('odyoloji', rnd, QUIZ_ROUND, opts);
        expect(new Set(canli).size).toBe(QUIZ_ROUND);
        expect(lv(canli).filter((l) => l === 'odyoloji')).toHaveLength(6);
        expect(lv(canli).filter((l) => l === 'merakli')).toHaveLength(4);
      }
      const pratik = pickQuizQuestions('odyoloji', rnd, QUIZ_ROUND, { mode: 'pratik' });
      expect(new Set(pratik).size).toBe(QUIZ_ROUND);
      expect(lv(pratik).every((l) => l === 'odyoloji')).toBe(true);
      for (const mode of ['canli', 'pratik'] as const) {
        const genel = pickQuizQuestions('genel', rnd, QUIZ_ROUND, { mode });
        expect(new Set(genel).size).toBe(QUIZ_ROUND);
        expect(lv(genel).every((l) => l === 'merakli')).toBe(true);
      }
    }
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

  it('Biliyor muydun? tekrarda biyomun öteki satırlarından sıradakini verir (YN-127)', () => {
    const biyom = (no: number) => HUMAN_JOURNEY.levels.find((l) => l.number === no)!.biome;
    for (const b of BILIYOR_MUYDUN) {
      const ayni = BILIYOR_MUYDUN.filter((x) => biyom(x.bolum) === biyom(b.bolum));
      expect(biliyorMuydun(b.bolum, 'genel', 0)).toBe(b.genel);
      const goru = [0, 1, 2].map((k) => biliyorMuydun(b.bolum, 'genel', k));
      // biyomda birden çok satır varsa art arda iki oynayış aynı satırı göstermez; hepsi biyomun onaylı satırlarından
      if (ayni.length > 1) expect(goru[1], `${b.bolum}`).not.toBe(goru[0]);
      for (const t of goru) expect(ayni.map((x) => x.genel)).toContain(t);
      // sıradaki: bölüm sırasıyla bir sonraki satır (başa sararak); odyoloji düzeyi de aynı bölümün satırı
      const i = ayni.indexOf(b); const sonraki = ayni[(i + 1) % ayni.length]!;
      expect(biliyorMuydun(b.bolum, 'genel', 1)).toBe(sonraki.genel);
      expect(biliyorMuydun(b.bolum, 'odyoloji', 1)).toBe(sonraki.odyoloji);
      // biyomun bütün satırları dönünce başa döner
      expect(biliyorMuydun(b.bolum, 'genel', ayni.length)).toBe(b.genel);
    }
  });

  it('Biliyor muydun? son gösterilen satırı (onceki) biyomda başka satır varsa tekrar etmez (YN-175)', () => {
    const biyom = (no: number) => HUMAN_JOURNEY.levels.find((l) => l.number === no)!.biome;
    // oyuncu testi: Bölüm 13 tekrarı Bölüm 14'ün satırını gösterdi, ardından Bölüm 14'ün ilk geçişi aynı satırı
    const tekrar13 = biliyorMuydunSatiri(13, 1)!;
    expect(tekrar13.bolum).toBe(14);
    expect(biliyorMuydunSatiri(14, 0, tekrar13.bolum)!.bolum).not.toBe(14);
    for (const b of BILIYOR_MUYDUN) {
      const ayni = BILIYOR_MUYDUN.filter((x) => biyom(x.bolum) === biyom(b.bolum));
      for (const t of [0, 1, 2]) for (const x of ayni) {
        const s = biliyorMuydunSatiri(b.bolum, t, x.bolum)!;
        expect(ayni).toContain(s);
        if (ayni.length > 1) expect(s.bolum, `${b.bolum}/${t}/${x.bolum}`).not.toBe(x.bolum);
        // önceki başka bir satırsa kural değişmez
        if (biliyorMuydunSatiri(b.bolum, t)!.bolum !== x.bolum) expect(s).toBe(biliyorMuydunSatiri(b.bolum, t));
      }
      expect(biliyorMuydun(b.bolum, 'odyoloji', 0, b.bolum)).toBe(biliyorMuydunSatiri(b.bolum, 0, b.bolum)!.odyoloji);
    }
  });

  it('Biliyor muydun? yakın zamanda gösterilen satırları tekrar etmez: 24 → 25 → 26, 13 tekrarı → 14 (YN-212)', () => {
    const biyom = (no: number) => HUMAN_JOURNEY.levels.find((l) => l.number === no)!.biome;
    /** sonuç ekranları sırayla: kayıttaki son BILGI_YAKIN satırı gibi tutulur; dizide hiçbir satır yakındakilerden biri değil */
    const oyna = (dizi: [number, number][]) => {
      const son: number[] = []; const out: number[] = [];
      for (const [bolum, tekrar] of dizi) {
        const s = biliyorMuydunSatiri(bolum, tekrar, son)!;
        expect(son, `${dizi.map((d) => d.join('/')).join(' ')}: ${bolum}/${tekrar}`).not.toContain(s.bolum);
        out.push(s.bolum); son.splice(0, son.length, ...[...son.filter((x) => x !== s.bolum), s.bolum].slice(-BILGI_YAKIN));
      }
      return out;
    };
    // oyuncu testi: 24 sonucu, 25 sonucu, 26 (tekrar) sonucu 24'ün satırını kelimesi kelimesine yeniden gösterdi
    for (const t24 of [0, 1, 2, 3]) for (const t25 of [0, 1, 2, 3]) for (const t26 of [0, 1, 2, 3]) {
      const g = oyna([[24, t24], [25, t25], [26, t26]]);
      expect(new Set(g).size).toBe(3);
      for (const x of g) expect(biyom(x)).toBe('koklea-2');
    }
    expect(oyna([[13, 1], [14, 0]])).toEqual([14, 15]);
    // biyomda gösterilmemiş satır kalmadıysa önceki biyomdan (Koklea · Orta Kıvrım'dan önce Koklea · Taban)
    const s = biliyorMuydunSatiri(26, 0, [24, 25, 26])!;
    expect(biyom(s.bolum)).toBe('koklea-1');
    // eski kayıt: tek sayı da kabul edilir (YN-175 kuralı)
    expect(biliyorMuydunSatiri(14, 0, 14)!.bolum).toBe(biliyorMuydunSatiri(14, 0, [14])!.bolum);
    // uzun ve karışık oynayışta (tekrarlar, geri dönüşler) yakındaki satır hiç tekrar etmez
    let x = 7;
    const r = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    const dizi: [number, number][] = Array.from({ length: 400 }, () => [1 + Math.floor(r() * BILIYOR_MUYDUN.length), Math.floor(r() * 4)]);
    oyna(dizi);
  });
});
