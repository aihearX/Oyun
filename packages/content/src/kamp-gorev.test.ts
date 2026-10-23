import { describe, expect, it } from 'vitest';
import {
  AC_HZ, EGRI_ADI, KAMP_OYUN, KG_ACILIS, KG_BASARI, KG_BUYUME_OLCUT, KG_GUNLUK, KG_HAFTA, KG_HAFTA_ODUL, KG_HIKAYE, KG_KURAL, KG_SAYACLAR,
  TANILAR, VAKALAR, VAKA_TESTLERI, egriTipi, egriUret, isYok, kayipTipi, kgRng, odulMetni, taniSecenekleri, timpHatasi, timpanoPuani, timpanoTuru,
  tonPuani, tonTuru, vakaKademesi, vakaPuanla, vakaTutarsizliklari, yonetimSecenekleri, type Vaka,
} from './kamp-gorev';
import { PATHOLOGY_IDS, REMEDIES } from './remedies';
import { GLOSSARY } from './odyoloji';
import { CAMP_TERMS } from './kamp';
import { DECORATIONS, decorById } from './kamp-susler';

/** bozuk kodlama, yer tutucu ve boşluk hataları (kamp.test.ts ile aynı ölçüt) */
const BAD = /Ã|Ä|Å|Ð|Þ|�|\s{2,}|\s[,.;:!?]|TODO|XXX|lorem/i;
function sane(s: string, where: string) {
  expect(s.trim(), where).toBe(s);
  expect(s.length, where).toBeGreaterThan(2);
  expect(BAD.test(s), `${where}: “${s}”`).toBe(false);
  expect(/[a-zçğıöşü]/i.test(s), where).toBe(true);
  expect((s.match(/\(/g) ?? []).length, `${where} parantez`).toBe((s.match(/\)/g) ?? []).length);
  expect((s.match(/“/g) ?? []).length, `${where} tırnak`).toBe((s.match(/”/g) ?? []).length);
  // "Koklea" (asla "Salyangoz"); Türkçe karakter yerine ASCII yazılmış sık hatalar
  expect(/salyangoz/i.test(s), `${where}: Koklea yazılmalı`).toBe(false);
  expect(/\b(isitme|kulagi|odyolojı|sinir sistemı|kayıp tıpi)\b/i.test(s), `${where}: Türkçe karakter`).toBe(false);
}
const dupes = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
const vakaMetinleri = (v: Vaka): [string, string][] => [
  [v.baslik, 'baslik'], [v.hasta.ad, 'ad'], [v.hasta.yas, 'yas'], [v.oyku, 'oyku'], ...v.belirtiler.map((b, i) => [b, `belirti${i}`] as [string, string]),
  [v.aciklama.sade, 'sade'], [v.aciklama.teknik, 'teknik'], [v.kaynak, 'kaynak'],
  ...v.yonetim.flatMap((y) => [[y.sade, `yonetim:${y.id}`], ...(y.teknik ? [[y.teknik, `yonetim:${y.id}.teknik`]] : [])] as [string, string][]),
];

describe('Hasta Vakaları: içerik', () => {
  it('en az 30 vaka, eşsiz kalıcı kimlik, kademeler dolu', () => {
    expect(VAKALAR.length).toBeGreaterThanOrEqual(30);
    expect(dupes(VAKALAR.map((v) => v.id))).toEqual([]);
    expect(dupes(VAKALAR.map((v) => v.baslik))).toEqual([]);
    for (const v of VAKALAR) expect(v.id).toMatch(/^kv\d\d$/);
    for (const k of [1, 2, 3]) expect(VAKALAR.filter((v) => v.kademe === k).length, `kademe ${k}`).toBeGreaterThanOrEqual(8);
    // ilk vakalar kolay: kademe sırası bozulmaz (yeni vaka yalnız sona eklenir)
    expect(VAKALAR.map((v) => v.kademe)).toEqual([...VAKALAR.map((v) => v.kademe)].sort());
  });
  it('kapsam: 18 patolojinin hepsi + normal işitme + yenidoğan taraması + ani kayıp; iletim, sensörinöral ve mikst kayıp; çocuk, bebek, yaşlı', () => {
    for (const p of PATHOLOGY_IDS) expect(VAKALAR.some((v) => v.kat === p), `patoloji ${p}`).toBe(true);
    for (const k of ['normal', 'tarama', 'ani'] as const) expect(VAKALAR.some((v) => v.kat === k), k).toBe(true);
    const types = new Set(VAKALAR.flatMap((v) => (v.kayip ? [v.kayip.R, v.kayip.L] : [])));
    for (const t of ['normal', 'iletim', 'sensorinoral', 'mikst']) expect(types.has(t as never), t).toBe(true);
    for (const g of ['bebek', 'cocuk', 'genc', 'yetiskin', 'yasli']) expect(VAKALAR.some((v) => v.hasta.grup === g), g).toBe(true);
    expect(VAKALAR.filter((v) => v.kat === 'tarama' || (v.hasta.grup === 'bebek')).length).toBeGreaterThanOrEqual(3);
  });
  it('TIBBİ TUTARLILIK: her vakanın odyogramı, timpanogramı, refleksi, OAE/ABR’si ve konuşma testi tanısıyla uyumlu', () => {
    const all = VAKALAR.flatMap(vakaTutarsizliklari);
    expect(all).toEqual([]);
  });
  it('denetleyici gerçekten yakalıyor: bozulmuş vakalar hata verir', () => {
    const v = structuredClone(VAKALAR.find((x) => x.id === 'kv02')!);
    // serumen kulağında kemik yolunu bozmak → mikst olur, bildirilen "iletim" ile uyuşmaz
    if (!isYok(v.testler.odyometri)) v.testler.odyometri.bc.R = [35, 35, 30, 30];
    expect(vakaTutarsizliklari(v).length).toBeGreaterThan(0);
    const w = structuredClone(VAKALAR.find((x) => x.id === 'kv10')!);
    // perforasyonda küçük kanal hacmi tutarsızdır
    if (!isYok(w.testler.timpanometri)) w.testler.timpanometri.L = { tip: 'B', basinc: null, uyum: 0.1, hacim: 0.3 };
    expect(vakaTutarsizliklari(w).join(' ')).toMatch(/perforasyon/);
    const x = structuredClone(VAKALAR.find((y) => y.id === 'kv05')!);
    // gürültü çentiği 8 kHz'te iyileşmezse gürültü örüntüsü değildir
    if (!isYok(x.testler.odyometri)) { x.testler.odyometri.ac.R[7] = 70; x.testler.odyometri.ac.L[7] = 70; }
    expect(vakaTutarsizliklari(x).join(' ')).toMatch(/çentiği/);
  });
  it('Türkçe metinler, sözlük terimi, kaynak; seçenek kimlikleri', () => {
    const terms = new Set([...GLOSSARY.map((g) => g.id), ...CAMP_TERMS.map((t) => t.id)]);
    for (const v of VAKALAR) {
      for (const [s, w] of vakaMetinleri(v)) sane(s, `${v.id}.${w}`);
      expect(v.oyku.length, `${v.id}: öykü kısa olmalı`).toBeLessThanOrEqual(280);
      expect(v.aciklama.sade.length, `${v.id}: sade açıklama`).toBeLessThanOrEqual(420);
      expect(v.aciklama.teknik.length).toBeGreaterThan(80);
      expect(terms.has(v.terim), `${v.id}: sözlük terimi ${v.terim}`).toBe(true);
      expect(v.kaynak.length).toBeGreaterThan(10);
      expect(v.belirtiler.length).toBeGreaterThanOrEqual(2);
      for (const y of v.yonetim) expect(y.id).toMatch(/^[a-z-]+$/);
    }
    for (const t of TANILAR) { sane(t.sade, `tani:${t.id}`); sane(t.teknik, `tani:${t.id}.teknik`); }
    expect(dupes(TANILAR.map((t) => t.id))).toEqual([]);
    for (const t of VAKA_TESTLERI) { sane(t.ad, t.id); sane(t.sade, t.id); sane(t.teknik, t.id); }
  });
  it('seçenekler: genel düzeyde 3, odyoloji düzeyinde 4; doğru cevap hep içinde; sıra sabit', () => {
    for (const v of VAKALAR) {
      const g = taniSecenekleri(v, 'genel'); const o = taniSecenekleri(v, 'odyoloji');
      expect(g.length).toBe(3); expect(o.length).toBe(4);
      expect(g.map((x) => x.id)).toContain(v.tani.dogru); expect(o.map((x) => x.id)).toContain(v.tani.dogru);
      expect(taniSecenekleri(v, 'genel').map((x) => x.id)).toEqual(g.map((x) => x.id));
      const yg = yonetimSecenekleri(v, 'genel'); const yo = yonetimSecenekleri(v, 'odyoloji');
      expect(yg.length).toBe(3); expect(yo.length).toBe(4);
      expect(yg.map((x) => x.id)).toContain(v.yonetim[0].id);
    }
    // karıştırma gerçekten karıştırıyor (doğru cevap hep ilk sırada değil)
    expect(VAKALAR.filter((v) => taniSecenekleri(v, 'odyoloji')[0]!.id === v.tani.dogru).length).toBeLessThan(VAKALAR.length / 2);
  });
  it('puanlama: tanı → 1 yıldız, yönetim → 2, verimli test seçimi → 3; yanlış tanı 0', () => {
    const v = VAKALAR.find((x) => x.id === 'kv03')!; // anahtar: otoskopi + timpanometri
    const mg = v.yonetim[0].id; const bad = v.yonetim[1].id;
    expect(vakaPuanla(v, { tests: ['otoskopi', 'timpanometri'], dx: 'ome', mg }).stars).toBe(3);
    expect(vakaPuanla(v, { tests: ['otoskopi', 'timpanometri', 'odyometri'], dx: 'ome', mg }).stars).toBe(3);
    expect(vakaPuanla(v, { tests: ['otoskopi', 'timpanometri', 'odyometri', 'oae'], dx: 'ome', mg })).toMatchObject({ stars: 2, efficient: false, extra: 2 });
    expect(vakaPuanla(v, { tests: ['odyometri'], dx: 'ome', mg })).toMatchObject({ stars: 2, efficient: false });
    expect(vakaPuanla(v, { tests: ['otoskopi', 'timpanometri'], dx: 'ome', mg: bad }).stars).toBe(1);
    expect(vakaPuanla(v, { tests: ['otoskopi', 'timpanometri'], dx: 'ostaki', mg }).stars).toBe(0);
    // aynı test iki kez sayılmaz, bilinmeyen test yok sayılır
    expect(vakaPuanla(v, { tests: ['otoskopi', 'otoskopi', 'timpanometri', 'yok-boyle'], dx: 'ome', mg }).stars).toBe(3);
  });
  it('odyogram sınıflaması (hava–kemik aralığı)', () => {
    const o = (ac: number[], bc: number[]) => ({ ac: { R: ac, L: ac }, bc: { R: bc, L: bc } });
    expect(kayipTipi(o([10, 10, 10, 10, 10, 10, 10, 10], [5, 5, 5, 5]), 'R')).toBe('normal');
    expect(kayipTipi(o([40, 40, 40, 40, 40, 40, 40, 40], [10, 10, 10, 10]), 'R')).toBe('iletim');
    expect(kayipTipi(o([40, 40, 40, 40, 40, 40, 40, 40], [35, 40, 40, 40]), 'R')).toBe('sensorinoral');
    expect(kayipTipi(o([70, 70, 70, 70, 70, 70, 70, 70], [40, 40, 40, 40]), 'R')).toBe('mikst');
    expect(AC_HZ.length).toBe(8);
  });
  it('kademe Odyoloji Kliniği seviyesine bağlı', () => {
    expect([0, 1, 3, 4, 6, 7, 15].map(vakaKademesi)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('Kamp Görevleri: tanımlar', () => {
  const lineIds = KG_HIKAYE.flatMap((c) => [c.intro, c.outro]);
  it('hikâye: 10 bölüm, her biri 3 adım, eşsiz kimlik, Tüy Dede satır kimliği biçimi, Türkçe metin', () => {
    expect(KG_HIKAYE.map((c) => c.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(dupes(lineIds)).toEqual([]);
    for (const id of lineIds) expect(id).toMatch(/^kg-h\d+-(giris|son)$/);
    for (const c of KG_HIKAYE) {
      sane(c.title, `bolum${c.no}`);
      expect(c.steps.length).toBe(3);
      expect(dupes(c.steps.map((s) => s.id))).toEqual([]);
      for (const s of c.steps) { sane(s.text, `${c.no}.${s.id}`); expect(s.need).toBeGreaterThan(0); }
    }
    // büyüme sistemine bağlı adımı olmayan bölümler büyüme olmadan da bitirilebilir
    expect(KG_HIKAYE.filter((c) => c.steps.every((s) => KG_BUYUME_OLCUT.includes(s.olcut))).length).toBe(1);
  });
  it('günlük, haftalık ve başarı tanımları: eşsiz, Türkçe, geçerli ölçüt', () => {
    expect(dupes(KG_GUNLUK.map((g) => g.id))).toEqual([]);
    expect(dupes(KG_HAFTA.map((g) => g.id))).toEqual([]);
    expect(dupes(KG_BASARI.map((g) => g.id))).toEqual([]);
    for (const g of KG_GUNLUK) { sane(g.text, g.id); expect(g.w).toBeGreaterThan(0); }
    // şartsız en az iki günlük görev var: yeni oyuncu da 3 görev alır
    expect(KG_GUNLUK.filter((g) => !g.sart && !KG_BUYUME_OLCUT.includes(g.olcut)).length).toBeGreaterThanOrEqual(2);
    for (const h of KG_HAFTA) { sane(h.text, h.id); expect(KG_SAYACLAR).toContain(h.olcut); expect(h.tiers[0]).toBeLessThan(h.tiers[2]); }
    expect(KG_HAFTA.some((h) => !h.sart)).toBe(true);
    for (const b of KG_BASARI) {
      sane(b.title, b.id); sane(b.text, b.id);
      for (let i = 1; i < b.tiers.length; i++) expect(b.tiers[i]!.need).toBeGreaterThan(b.tiers[i - 1]!.need);
    }
  });
  it('ödüller: dekor ve malzeme kimlikleri geçerli; ödül metni Türkçe; jeton ölçülü (bölüm zorluğunu bozmaz)', () => {
    const rewards = [...KG_HIKAYE.map((c) => c.reward), ...KG_HAFTA_ODUL, ...KG_BASARI.flatMap((b) => b.tiers.map((t) => t.reward))];
    for (const r of rewards) {
      if (r.dekor) expect(decorById(r.dekor), r.dekor).toBeTruthy();
      if (r.malzeme) expect(REMEDIES.some((m) => m.id === r.malzeme)).toBe(true);
      for (const t of odulMetni(r)) sane(t, 'odul');
      expect(r.jeton ?? 0).toBeLessThanOrEqual(150);
      expect(r.kristal ?? 0).toBeLessThanOrEqual(15);
    }
    // görevlere özel süslerin ikisi de bir görev ödülü (kamp büyümesi kataloğu: from 'gorev')
    for (const d of DECORATIONS.filter((x) => x.from.includes('gorev'))) expect(rewards.some((r) => r.dekor === d.id), d.id).toBe(true);
    // günlük jeton tavanı: 3 görev + 3 yeni vaka (3 yıldız) + iki oyunun ödüllü turları
    const vaka = 3 * (10 + 3 * 5); const oyun = 2 * KG_KURAL.oyunOdulluTur * 4; const gunluk = 3 * 15;
    expect(vaka + oyun + gunluk).toBeLessThanOrEqual(200);
  });
  it('açılış sırası: görevler → oyunlar → vakalar', () => {
    expect(KG_ACILIS.gorev).toBeLessThan(KG_ACILIS.oyun);
    expect(KG_ACILIS.oyun).toBeLessThan(KG_ACILIS.vaka);
  });
});

describe('Kamp oyunları', () => {
  it('Ton Avı: tohumdan aynı tur; 8 deneme (4 "ses var mı?", 4 "hangisi ince?"); puanlama', () => {
    const a = tonTuru(12345, 'genel'); const b = tonTuru(12345, 'genel');
    expect(a).toEqual(b);
    expect(a.length).toBe(KG_KURAL.tonDeneme);
    expect(a.filter((d) => d.tur === 'var').length).toBe(4);
    for (const d of a) if (d.tur === 'ince') { expect(d.a).not.toBe(d.b); expect(d.dogru).toBe(d.b > d.a ? 1 : 0); }
    const right = a.map((d) => (d.tur === 'var' ? (d.var ? 1 : 0) : d.dogru));
    expect(tonPuani(a, right)).toBe(8);
    expect(tonPuani(a, right.map((x) => 1 - x))).toBe(0);
    // genel düzeyde perde farkı odyoloji düzeyinden büyük
    const ratio = (ds: ReturnType<typeof tonTuru>) => Math.min(...ds.filter((d) => d.tur === 'ince').map((d) => (d.tur === 'ince' ? Math.max(d.a, d.b) / Math.min(d.a, d.b) : 9)));
    expect(ratio(tonTuru(7, 'genel'))).toBeGreaterThan(1.45);
    expect(ratio(tonTuru(7, 'odyoloji'))).toBeLessThan(1.3);
  });
  it('Timpanogram Eşleştir: üretilen bütün eğriler Jerger değerleriyle tutarlı; 4 seçenek, doğru içinde', () => {
    const r = kgRng(1);
    for (const e of Object.keys(EGRI_ADI) as (keyof typeof EGRI_ADI)[]) for (let i = 0; i < 30; i++) {
      const t = egriUret(e, r); expect(timpHatasi(t, 'yetiskin'), `${e} ${JSON.stringify(t)}`).toBeNull(); expect(t.tip).toBe(egriTipi(e));
    }
    for (const duzey of ['genel', 'odyoloji'] as const) for (let s = 1; s < 40; s++) {
      const tur = timpanoTuru(s, duzey);
      expect(tur.length).toBe(KG_KURAL.timpanoBulmaca);
      for (const b of tur) { expect(b.secenek.length).toBe(4); expect(new Set(b.secenek).size).toBe(4); expect(b.secenek[b.dogru]).toBe(b.egri); }
      expect(timpanoPuani(tur, tur.map((b) => b.dogru))).toBe(tur.length);
    }
    expect(timpanoTuru(5, 'genel')).toEqual(timpanoTuru(5, 'genel'));
    for (const k of Object.values(EGRI_ADI)) { sane(k.sade, 'egri'); sane(k.teknik, 'egri'); }
    for (const o of Object.values(KAMP_OYUN)) { sane(o.ad, 'oyun'); sane(o.plain, 'oyun'); }
    expect(KAMP_OYUN.ton.plain).toMatch(/işitme testi değildir/);
  });
});
