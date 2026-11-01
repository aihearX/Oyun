import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VAKALAR, hacimSinifi, isYok, type Odyogram, type Timp } from '@odi/content';
import { OdyogramLejant, OdyogramSvg, TimpanogramSvg } from './camp/gorev/charts';
import { testSatirlari } from './camp/gorev/yorum';

const ml = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ml`;
const timpOf = (v: (typeof VAKALAR)[number]) => { const x = v.testler.timpanometri; return isYok(x) ? null : (x as { R: Timp | null; L: Timp | null; not?: string }); };

describe('Klinik çizimleri (YN-069)', () => {
  it('her vakanın timpanogramında eşdeğer kanal hacmi yazılı (iki kulak) ve kutu "yetişkin normu" diye etiketli', () => {
    let n = 0;
    for (const v of VAKALAR) {
      const t = timpOf(v); if (!t) continue; n++;
      const svg = renderToStaticMarkup(createElement(TimpanogramSvg, { R: t.R, L: t.L }));
      expect(svg, v.id).toContain('Kanal hacmi:');
      if (t.R) expect(svg, `${v.id} sağ`).toContain(`sağ ${ml(t.R.hacim)}`);
      if (t.L) expect(svg, `${v.id} sol`).toContain(`sol ${ml(t.L.hacim)}`);
      expect(svg, v.id).toContain('Kutu: yetişkin normu');
    }
    expect(n).toBeGreaterThan(20);
  });
  it('açıklama kanal hacmine dayanıyorsa veri var, çizimde görünüyor ve sınıfı açıklamayla aynı (32 vaka)', () => {
    expect(VAKALAR.length).toBe(32);
    for (const v of VAKALAR) {
      const metin = `${v.aciklama.sade} ${v.aciklama.teknik} ${timpOf(v)?.not ?? ''}`;
      if (!/kanal hacm|hacim/i.test(metin)) continue;
      const t = timpOf(v);
      expect(t, `${v.id}: açıklama kanal hacmine dayanıyor ama timpanometri yok`).not.toBeNull();
      const ears = [t!.R, t!.L].filter((x): x is Timp => !!x);
      expect(ears.length, v.id).toBeGreaterThan(0);
      const svg = renderToStaticMarkup(createElement(TimpanogramSvg, { R: t!.R, L: t!.L }));
      for (const e of ears) expect(svg, v.id).toContain(ml(e.hacim));
      const iddia = /kanal hacmi (normal|küçük|büyük)|(normal|küçük|büyük) kanal hacmi/u.exec(v.aciklama.sade);
      if (iddia) {
        const sinif = { normal: 'normal', küçük: 'kucuk', büyük: 'buyuk' }[(iddia[1] ?? iddia[2]) as 'normal' | 'küçük' | 'büyük'];
        const duz = ears.filter((e) => e.tip === 'B'); const bak = duz.length ? duz : ears;
        const siniflar = bak.map((e) => hacimSinifi(e.hacim, v.hasta.grup));
        if (sinif === 'normal') expect(siniflar, `${v.id}: "${iddia[0]}"`).toEqual(bak.map(() => 'normal'));
        else expect(siniflar, `${v.id}: "${iddia[0]}"`).toContain(sinif);
      }
    }
  });
  it('odyogramda "normal bölge" yazısı grafiğin içinde değil lejantta (hiçbir eşikte sembolle çakışmaz)', () => {
    for (const v of VAKALAR) {
      const o = v.testler.odyometri; if (isYok(o)) continue;
      const svg = renderToStaticMarkup(createElement(OdyogramSvg, { o: o as Odyogram, normalBand: true }));
      expect(svg.toLocaleLowerCase('tr-TR'), v.id).not.toContain('normal bölge');
    }
    expect(renderToStaticMarkup(createElement(OdyogramLejant, { normal: true }))).toContain('Normal bölge');
    expect(renderToStaticMarkup(createElement(OdyogramLejant, {}))).not.toContain('Normal bölge');
  });
  it('test sonuç satırlarında sayı ile birim ve aralıklar satır sonunda bölünmez', () => {
    for (const v of VAKALAR) for (const id of ['odyometri', 'timpanometri', 'konusma']) for (const d of ['genel', 'odyoloji'] as const) {
      for (const l of testSatirlari(v, id, d)) {
        expect(/\d (?:dB|ml|daPa|Hz|kHz)(?![\p{L}\d])/u.test(l), l).toBe(false);
        expect(/\d–|–\d/u.test(l.replace(/\u2060–\u2060/gu, '')), l).toBe(false);
      }
    }
  });
});
