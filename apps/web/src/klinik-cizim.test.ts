import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TANILAR, VAKALAR, VAKA_TESTLERI, hacimSinifi, isYok, testYorumu, vakaById, type Odyogram, type Timp } from '@odi/content';
import { OdyogramLejant, OdyogramSvg, TimpanogramSvg } from './camp/gorev/charts';
import { odyoSatir, testSatirlari, yuzdeEki } from './camp/gorev/yorum';

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

describe('Klinik odyogram ve bulgu metinleri (YN-090)', () => {
  const odyOf = (id: string) => vakaById(id)!.testler.odyometri as Odyogram;
  const tek = (s: string) => s.replace(/\u2060/gu, '').replace(/\u00a0/gu, ' ');
  it('sağ hava yolu O içi boş ve X’ten büyük: aynı eşikte X O’nun içinden geçer, O’nun halkası görünür', () => {
    const svg = renderToStaticMarkup(createElement(OdyogramSvg, { o: odyOf('kv06') }));
    const r = [...svg.matchAll(/<circle[^>]*data-ac="R"[^>]*>/gu)].map((m) => m[0]);
    expect(r.length).toBe(8);
    const x = /<path d="M[\d.]+ [\d.]+l([\d.]+) [\d.]+M[^"]*"[^>]*data-ac="L"/u.exec(svg);
    expect(x).not.toBeNull();
    const yariKosegen = (Number(x![1]) / 2) * Math.SQRT2;
    for (const c of r) {
      expect(c).toContain('fill="none"');
      expect(Number(/ r="([\d.]+)"/u.exec(c)![1])).toBeGreaterThan(yariKosegen);
    }
    // sağ kulak (O) solun (X) üstünde çizilir
    expect(svg.indexOf('data-ear="L"')).toBeLessThan(svg.indexOf('data-ear="R"'));
  });
  it('tize doğru inen eğride sade satır biçimi ve iki bandın derecesini söyler; düz ve çentikli eğride bugünkü satır kalır', () => {
    const nuri = tek(odyoSatir(odyOf('kv06'), 'R', 'genel'));
    expect(nuri).toBe('Sağ: yüksek frekanslara doğru inen kayıp: alçak frekanslarda çok hafif, 4–8 kHz’te orta-ileri; iç kulak kaynaklı (hava ve kemik yolu birlikte düşük)');
    expect(tek(odyoSatir(odyOf('kv06'), 'R', 'odyoloji'))).toContain('yüksek frekans ortalaması (4–8 kHz) 63,3 dB HL');
    expect(tek(odyoSatir(odyOf('kv05'), 'R', 'genel'))).not.toContain('inen'); // gürültü çentiği: 8 kHz’te düzelme
    expect(tek(odyoSatir(odyOf('kv11'), 'R', 'genel'))).toBe('Sağ: hafif kayıp, orta kulak/kanal kaynaklı (kemik yolu iyi)');
  });
  it('çentikli eğride sade satır konuşma frekanslarının derecesinin yanında en kötü bölgeyi ve derecesini söyler (YN-101)', () => {
    // İsmail: 250–2000 Hz 10–25, 3 kHz 45, 4 kHz 55, 6 kHz 45, 8 kHz 30 dB HL; bölge ortalaması 48,3 → orta
    expect(tek(odyoSatir(odyOf('kv05'), 'R', 'genel'))).toBe('Sağ: konuşma frekanslarında çok hafif; 3–6 kHz’te orta kayıp, en kötüsü 4 kHz’te (4 kHz çentiği); iç kulak kaynaklı (hava ve kemik yolu birlikte düşük)');
    expect(tek(odyoSatir(odyOf('kv05'), 'L', 'odyoloji'))).toBe('Sol: saf ses ortalaması 18,3 dB HL · en kötü eşik 4 kHz’te 60 dB HL; 8 kHz’te 35 dB HL’ye toparlanıyor (4 kHz çentiği) · hava–kemik aralığı 0–5 dB');
    // sonuç ekranındaki "İstediğin testler" aynı satırı kullanır
    expect(tek(testSatirlari(vakaById('kv05')!, 'odyometri', 'genel')[0]!)).toBe(tek(odyoSatir(odyOf('kv05'), 'R', 'genel')));
    expect(tek(odyoSatir(odyOf('kv31'), 'L', 'genel'))).toContain('3–6 kHz’te orta-ileri kayıp, en kötüsü 4 kHz’te (4 kHz çentiği)');
    // düz eğride bölge yok; ortalama 20 dB'den az aşılırsa satır değişmez
    expect(tek(odyoSatir(odyOf('kv20'), 'R', 'genel'))).toBe('Sağ: orta-ileri kayıp, iç kulak kaynaklı (hava ve kemik yolu birlikte düşük)');
    // sade satır tanı adı söylemez ("işitme normal" tanısı değil, normal eşiklerin sade adı hariç)
    const adlar = TANILAR.flatMap((t) => [t.sade, t.teknik]).map((a) => a.toLocaleLowerCase('tr-TR')).filter((a) => !a.includes('normal'));
    for (const v of VAKALAR) {
      if (isYok(v.testler.odyometri)) continue;
      for (const l of testSatirlari(v, 'odyometri', 'genel')) for (const a of adlar) expect(l.toLocaleLowerCase('tr-TR'), `${v.id}: "${a}"`).not.toContain(a);
    }
  });
  it('konuşma satırı dB HL birimini ve tanımanın rahat duyulan seste ölçüldüğünü söyler', () => {
    const nuri = vakaById('kv06')!;
    expect(tek(testSatirlari(nuri, 'konusma', 'genel')[0]!)).toBe('Sağ: konuşmayı 30 dB HL’de algılamaya başlıyor; rahat duyduğu seste kelimelerin %76’sını doğru tekrarlıyor');
    expect(tek(testSatirlari(nuri, 'konusma', 'odyoloji')[0]!)).toBe('Sağ: SRT 30 dB HL · kelime tanıma %76 (konforlu düzeyde)');
    expect([0, 10, 28, 40, 72, 84, 88, 96, 100].map(yuzdeEki)).toEqual(['%0’ını', '%10’unu', '%28’ini', '%40’ını', '%72’sini', '%84’ünü', '%88’ini', '%96’sını', '%100’ünü']);
    for (const v of VAKALAR) {
      if (isYok(v.testler.konusma)) continue;
      for (const l of testSatirlari(v, 'konusma', 'genel').slice(0, 2)) { expect(l, v.id).toContain('HL'); expect(l, v.id).toContain('rahat duyduğu seste'); }
    }
  });
  it('istenmeyen test yorumları: en az 4 vakada, tek cümle, tanı adı yok', () => {
    const adlar = TANILAR.flatMap((t) => [t.sade, t.teknik]).map((a) => a.toLocaleLowerCase('tr-TR'));
    const vakalar = VAKALAR.filter((v) => VAKA_TESTLERI.some((t) => testYorumu(v, t.id)));
    expect(vakalar.length).toBeGreaterThanOrEqual(4);
    for (const id of ['kv01', 'kv04', 'kv05', 'kv06', 'kv11', 'kv24', 'kv28', 'kv32']) expect(vakalar.map((v) => v.id)).toContain(id);
    for (const v of vakalar) for (const t of VAKA_TESTLERI) {
      const y = testYorumu(v, t.id); if (!y) continue;
      expect(y, `${v.id}/${t.id}`).toMatch(/^[^.]+\.$/u);
      for (const a of adlar) expect(y.toLocaleLowerCase('tr-TR'), `${v.id}/${t.id}: tanı adı "${a}"`).not.toContain(a);
    }
  });
});
