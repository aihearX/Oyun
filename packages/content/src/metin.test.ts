import { describe, expect, it } from 'vitest';
import * as ICERIK from './index';
import * as ODYOLOJI from './odyoloji';
import { bicimsiz, bolunmez } from './metin';
import { VAKALAR } from './kamp-gorev-vakalar';
import { TIMP_SORULAR, timpBulmaca } from './kamp-gorev-timpano';

const NB = '\u00A0'; const WJ = '\u2060';
/** satır sonunda bölünebilecek sayı: "1,1 ml" (düz boşluk), "2,5–3" (tirenin iki yanında WORD JOINER yok) */
const SAYI_BIRIM = /\d (?:dBA|dB|kHz|Hz|daPa|ml|mm|cm|ms|µPa|mV|sn|dk)(?![\p{L}\d])/u;
const ARALIK = /(?:\d|Hz|dB|ml|ms|mm|cm|daPa)[ \u00A0]?(?:–|…)|(?:–|…)[ \u00A0]?[\d−+]/u;
function bolunebilir(s: string): string | null {
  if (SAYI_BIRIM.test(s)) return 'sayı + boşluk + birim';
  for (const m of s.matchAll(new RegExp(ARALIK.source, 'gu'))) {
    const at = m.index! + m[0].search(/[–…]/u);
    const once = s.slice(Math.max(0, at - 2), at); const sonra = s.slice(at + 1, at + 3);
    const solSayi = /[\d\p{L}][ \u00A0]?\u2060?$/u.test(once); const sagSayi = /^\u2060?[ \u00A0]?[\d−+]/u.test(sonra);
    if (solSayi && sagSayi && (s[at - 1] !== WJ || s[at + 1] !== WJ)) return `aralık bölünebilir: “${s.slice(Math.max(0, at - 8), at + 8)}”`;
  }
  return null;
}
function metinler(x: unknown, yol: string, out: [string, string][], seen = new Set<object>()) {
  if (typeof x === 'string') { out.push([yol, x]); return; }
  if (!x || typeof x !== 'object' || seen.has(x)) return;
  seen.add(x);
  for (const [k, v] of Object.entries(x)) if (k !== 'spoken') metinler(v, `${yol}.${k}`, out, seen);
}

describe('satır sonunda bölünmeyen sayılar (YN-069)', () => {
  it('bolunmez: birim önüne U+00A0, aralığın tiresine U+2060; görünür metin aynı, ikinci kez uygulamak bir şey değiştirmez', () => {
    expect(bolunmez('kanal hacmi sağ 1,1 ml, sol 1,1 ml')).toBe(`kanal hacmi sağ 1,1${NB}ml, sol 1,1${NB}ml`);
    expect(bolunmez('rezonansı yaklaşık 2,5–3 kHz civarı')).toBe(`rezonansı yaklaşık 2,5${WJ}–${WJ}3${NB}kHz civarı`);
    expect(bolunmez('yaklaşık 20 Hz–20 kHz arası')).toBe(`yaklaşık 20${NB}Hz${WJ}–${WJ}20${NB}kHz arası`);
    expect(bolunmez('1 Hz – 100 Hz')).toBe(`1${NB}Hz${NB}${WJ}–${WJ}${NB}100${NB}Hz`);
    expect(bolunmez('Tepe −100…+50 daPa arasında')).toBe(`Tepe −100${WJ}…${WJ}+50${NB}daPa arasında`);
    expect(bolunmez('eşik 30 dB HL, 226 Hz’lik prob')).toBe(`eşik 30${NB}dB${NB}HL, 226${NB}Hz’lik prob`);
    // sayı olmayan tireler ve kelimeler dokunulmaz
    for (const s of ['hava–kemik aralığı', 'Hughson–Westlake', 'dalga I–V', 'kv01', '3 yaş', 'Sv 2']) expect(bolunmez(s)).toBe(s);
    for (const s of ['2,5–3 kHz', '1 Hz – 100 Hz', '−100…+50 daPa', 'sol 1,1 ml', `2,5–3${NB}kHz`]) {
      const b = bolunmez(s); expect(bolunmez(b)).toBe(b); expect(bicimsiz(b).replace(/\u00A0/g, ' ')).toBe(s.replace(/\u00A0/g, ' '));
      expect(bolunebilir(s), s).not.toBeNull(); expect(bolunebilir(b), s).toBeNull();
    }
  });
  it('bütün içerik dizelerinde sayı–birim ve aralık satır sonunda bölünmez (sözlük, notlar, kartlar, quiz, kamp, vakalar, Eşleştir)', () => {
    const out: [string, string][] = [];
    for (const [k, v] of Object.entries({ ...ICERIK, ...ODYOLOJI })) metinler(v, k, out);
    // Timpanogram Eşleştir sorularının ekran hâli (sayı satırı turda kurulur)
    for (const d of TIMP_SORULAR) metinler(timpBulmaca(d, 7), `timpBulmaca.${d.id}`, out);
    expect(out.length).toBeGreaterThan(3000);
    const kotu = out.flatMap(([yol, s]) => { const n = bolunebilir(s); return n ? [`${yol}: ${n} · ${s.slice(0, 90)}`] : []; });
    expect(kotu).toEqual([]);
    // vaka metinleri de tarandı
    expect(out.filter(([y]) => y.startsWith('VAKALAR.')).length).toBeGreaterThan(VAKALAR.length * 10);
  });
});
