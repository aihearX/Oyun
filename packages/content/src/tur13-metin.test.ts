// Oyuncu testi tur 13 (YN-220, YN-221): otoskleroz sorusu, İşitme Siniri ve Beyin Sapı kartı, "par" kelimesi, meydan oku görevi.
import { describe, expect, it } from 'vitest';
import * as ICERIK from './index';
import { ACHIEVEMENTS, BIOMES, QUESTS, QUIZ_QUESTIONS, achievementDesc } from './index';
import * as ODYOLOJI from './odyoloji';

/** oyuncuya görünen yazılar: dışa açılan içerikteki bütün dizgiler, kimlik (`id`) alanları hariç */
function metinler(x: unknown, yol: string, out: [string, string][], seen = new Set<object>()) {
  if (typeof x === 'string') { out.push([yol, x]); return; }
  if (!x || typeof x !== 'object' || seen.has(x)) return;
  seen.add(x);
  for (const [k, v] of Object.entries(x)) if (k !== 'id') metinler(v, `${yol}.${k}`, out, seen);
}

describe('tıbbi kesinlik (YN-220)', () => {
  it('otoskleroz sorusu "çoğunlukla" demiyor; açıklama A tipinin de çıkabildiğini ve timpanogramın tek başına tanı koydurmadığını söyler', () => {
    const q = QUIZ_QUESTIONS.filter((x) => /otoskleroz/i.test(x.text) && /timpanogram/i.test(x.text));
    expect(q).toHaveLength(1);
    expect(q[0]!.text).toBe('Otosklerozda görülebilen klasik (sığ) timpanogram tipi hangisidir?');
    expect(q[0]!.text).not.toMatch(/çoğunlukla/);
    expect(q[0]!.choices[q[0]!.answer]).toBe('As tipi');
    expect([...q[0]!.choices].sort()).toEqual(['Ad tipi', 'As tipi', 'B tipi', 'C tipi']);
    expect(q[0]!.explain).toContain('normal A');
    expect(q[0]!.explain).toContain('tek başına tanı koydurmaz');
  });
  it('İşitme Siniri kartı: işitme siniri VIII. kafa sinirinin koklear dalı', () => {
    expect(BIOMES.sinir.blurb).toContain('koklear dalı');
    expect(BIOMES.sinir.blurb).not.toMatch(/VIII\. kafa siniri:/);
  });
});

describe('oyuncu metinleri (YN-221)', () => {
  it('Beyin Sapı kartının alt başlığı seslendirilmiş Tüy Dede notunu (not-yon) tekrar etmez', () => {
    const yon = ODYOLOJI.EAR_NOTES.find((x) => x.id === 'yon')!;
    expect(yon.region).toBe('beyin-sapi');
    expect(BIOMES['beyin-sapi'].blurb).not.toContain('nereden geldiğini');
    expect(BIOMES['beyin-sapi'].blurb).toContain('zaman ve şiddet farkı');
  });
  it('"par" kelimesi oyuncuya görünen içerikte yok; ölçüt underPar aynı', () => {
    const out: [string, string][] = []; metinler(ICERIK, 'ICERIK', out); metinler(ODYOLOJI, 'ODYOLOJI', out);
    expect(out.length).toBeGreaterThan(1000);
    expect(out.filter(([, s]) => /(?<![\p{L}\d])par(?![\p{L}\d])/iu.test(s))).toEqual([]);
    const ach = ACHIEVEMENTS.find((a) => a.id === 'ses-hizinda')!;
    expect(ach.metric).toBe('underPar');
    expect(achievementDesc(ach, 1)).toBe('1 kez süre bonusu alarak bitir (tekrarlar da sayılır)');
    const q = QUESTS.find((x) => x.id === 'par-1')!;
    expect(q).toMatchObject({ metric: 'underPar', target: 1, text: 'Bir bölümü süre bonusu alarak bitir' });
  });
  it('meydan oku görevi yapılanı söyler (bağlantı gönderilir); kural aynı', () => {
    expect(QUESTS.find((x) => x.id === 'meydan-1')).toMatchObject({ metric: 'share', target: 1, after: 8, text: 'Bir arkadaşına meydan okuma bağlantısı gönder' });
  });
  it('içerikte "Salyangoz" yok', () => {
    const out: [string, string][] = []; metinler(ICERIK, 'ICERIK', out); metinler(ODYOLOJI, 'ODYOLOJI', out);
    expect(out.filter(([, s]) => s.includes('Salyangoz'))).toEqual([]);
  });
});
