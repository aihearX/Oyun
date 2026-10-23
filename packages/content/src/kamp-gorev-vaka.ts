/**
 * Hasta Vakaları (Kamp Kliniği, docs/17-kamp-gorevleri.md): vaka modeli, test kataloğu, tanı ve yönetim seçenekleri,
 * odyogram/timpanogram sınıflandırması, puanlama (sunucu ve istemci aynı işlevi kullanır) ve TIBBİ TUTARLILIK denetimi
 * (vakanın odyogramı, timpanogramı, refleksi, OAE/ABR'si ve konuşma testi tanısıyla uyumlu mu; testler bunu her vaka için sınar).
 *
 * Eğitsel çerçeve: vakalar kurgusaldır (gerçek kişi değildir), ders kitabı ve klinik kılavuz düzeyindedir; oyuncuya ya da gerçek
 * bir kişiye tıbbi öneri değildir. Gerçek hayatta tanı ve tedaviyi hekim ve odyolog birlikte koyar.
 * Kaynaklar: Katz, Handbook of Clinical Audiology; Gelfand, Essentials of Audiology; Jerger (1970) timpanogram sınıflaması;
 * ASHA odyogram sembolleri (1990); ilgili AAO-HNS klinik kılavuzları, JCIH (2019), NIOSH (1998). Her vakada `kaynak` alanı.
 */
import type { PathologyId } from './remedies';

// ---------------------------------------------------------------- testler

export type TestId = 'otoskopi' | 'odyometri' | 'timpanometri' | 'refleks' | 'oae' | 'abr' | 'konusma' | 'islemleme';
export interface TestDef { id: TestId; ad: string; kisa: string; sade: string; teknik: string }
/** test kataloğu (sırası ekrandaki sıradır) */
export const VAKA_TESTLERI: TestDef[] = [
  { id: 'otoskopi', ad: 'Otoskopi', kisa: 'Otoskop', sade: 'Işıklı aletle kanala ve kulak zarına bakılır.', teknik: 'Kanal, zarın rengi, ışık üçgeni, delik, sıvı, retraksiyon ve kir değerlendirilir.' },
  { id: 'odyometri', ad: 'Saf ses odyometrisi', kisa: 'Odyogram', sade: 'Her frekansta duyulan en hafif ses bulunur (hava ve kemik yolu).', teknik: '250–8000 Hz hava yolu, 500–4000 Hz kemik yolu eşikleri (dB HL); hava–kemik aralığı kaybın tipini gösterir.' },
  { id: 'timpanometri', ad: 'Timpanometri', kisa: 'Timpanogram', sade: 'Kanal basıncı değişirken zarın ne kadar rahat hareket ettiği ölçülür.', teknik: '226 Hz prob (6 aydan küçük bebekte 1000 Hz); tepe basıncı (daPa), statik admitans (ml) ve eşdeğer kanal hacmi (ml).' },
  { id: 'refleks', ad: 'Akustik refleks', kisa: 'Refleks', sade: 'Çok yüksek seste orta kulaktaki minik kasın kasılıp kasılmadığına bakılır.', teknik: 'İpsilateral stapedius refleksi; iletim tipi kayıpta ve retrokoklear patolojide kaybolabilir, yorulma (decay) aranabilir.' },
  { id: 'oae', ad: 'Otoakustik emisyon (OAE)', kisa: 'OAE', sade: 'Sağlıklı iç kulağın ürettiği çok hafif yankı sesi kaydedilir.', teknik: 'TEOAE/DPOAE: dış tüy hücresi işlevini gösterir; orta kulak sorunu ve yaklaşık 30–40 dB HL üstü koklear kayıpta alınamaz.' },
  { id: 'abr', ad: 'İşitsel beyin sapı yanıtı (ABR)', kisa: 'ABR', sade: 'Sese karşı işitme sinirinin ve beyin sapının elektrik yanıtı kaydedilir.', teknik: 'Dalga I–V latansları ve eşik; retrokoklear patoloji, bebeklerde eşik tahmini ve işitsel nöropati (koklear mikrofonik) için.' },
  { id: 'konusma', ad: 'Konuşma odyometrisi', kisa: 'Konuşma', sade: 'Kelimelerle ne kadar hafif konuşmayı duyduğu ve ne kadar doğru anladığı ölçülür.', teknik: 'Konuşmayı alma eşiği (SRT, saf ses ortalamasıyla uyumlu olmalı) ve rahat düzeyde konuşmayı ayırt etme skoru (%).' },
  { id: 'islemleme', ad: 'İşitsel işlemleme testleri', kisa: 'İşlemleme', sade: 'Gürültüde konuşma ve iki kulağa farklı sözler verildiğinde anlama sınanır.', teknik: 'Gürültüde konuşma, dikotik dinleme ve zamansal işlemleme (boşluk saptama) testleri; periferik işitme normalken yorumlanır.' },
];
export const testById = (id: string) => VAKA_TESTLERI.find((t) => t.id === id);

/** hava yolu frekansları (Hz) ve kemik yolu frekansları (Hz) */
export const AC_HZ = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000] as const;
export const BC_HZ = [500, 1000, 2000, 4000] as const;
/** kemik yolu frekansının hava yolu dizisindeki sırası */
export const BC_AT = [1, 2, 3, 5] as const;

export type Ear = 'R' | 'L';
export type Kayip = 'normal' | 'iletim' | 'sensorinoral' | 'mikst';
export type TipTimp = 'A' | 'As' | 'Ad' | 'B' | 'C';
export type Otoskopi = 'normal' | 'serumen' | 'odem' | 'eksostoz' | 'perforasyon' | 'efuzyon' | 'icecekik' | 'retraksiyon' | 'plak';
export type Refleks = 'var' | 'yok' | 'yuksek' | 'yorulma';
export type Oae = 'var' | 'yok' | 'kismi' | 'azalmis';
export type Abr = 'normal' | 'gecikmis' | 'cm' | 'yok';
export type Islem = 'normal' | 'zayif';

export interface Timp { tip: TipTimp; /** tepe basıncı (daPa); düz eğride null */ basinc: number | null; /** statik admitans, ml */ uyum: number; /** eşdeğer kanal hacmi, ml */ hacim: number }
export interface Odyogram {
  ac: Record<Ear, number[]>;
  bc: Record<Ear, number[]>;
  /** yanıt yok (cihaz sınırı): hava yolu ve kemik yolu dizisindeki sıra numaraları */
  nr?: Partial<Record<'acR' | 'acL' | 'bcR' | 'bcL', number[]>>;
}
/** test yapılmadıysa ya da bu hastada uygun değilse gerekçesi */
export interface YokTest { yok: string }
export type KulakSonuc<T> = { R: T | null; L: T | null; not?: string };
export interface VakaTestleri {
  otoskopi: KulakSonuc<Otoskopi> & { aciklama?: Partial<Record<Ear, string>> } | YokTest;
  odyometri: Odyogram & { not?: string } | YokTest;
  timpanometri: KulakSonuc<Timp> | YokTest;
  refleks: KulakSonuc<Refleks> | YokTest;
  oae: KulakSonuc<Oae> | YokTest;
  abr: KulakSonuc<Abr> | YokTest;
  konusma: { srt: Record<Ear, number>; sds: Record<Ear, number>; not?: string } | YokTest;
  islemleme: { gurultu: Islem; dikotik: Islem; bosluk: Islem; not?: string } | YokTest;
}
export const isYok = (x: unknown): x is YokTest => !!x && typeof x === 'object' && 'yok' in (x as object);

// ---------------------------------------------------------------- tanı ve hasta

export type VakaKategori = PathologyId | 'normal' | 'tarama' | 'ani';
export interface TaniDef { id: string; sade: string; teknik: string; /** bu tanının ait olduğu kategori (tutarlılık denetimi) */ kat: VakaKategori | 'mikst' | 'aom' }
/** tanı seçenekleri kataloğu: sade (herkes) ve teknik (odyoloji öğrencisi) adlar */
export const TANILAR: TaniDef[] = [
  { id: 'normal', kat: 'normal', sade: 'İşitme normal', teknik: 'Normal işitme (bütün eşikler normal sınırda)' },
  { id: 'serumen', kat: 'serumen-tikaci', sade: 'Kulak kiri tıkacı', teknik: 'Serumen tıkacı (buşon)' },
  { id: 'dis-kulak-iltihabi', kat: 'otitis-eksterna', sade: 'Dış kulak yolu iltihabı', teknik: 'Akut otitis eksterna' },
  { id: 'aom', kat: 'aom', sade: 'Orta kulak iltihabı (ağrılı, akut)', teknik: 'Akut otitis media' },
  { id: 'eksostoz', kat: 'eksostoz', sade: 'Kanalda kemik çıkıntıları', teknik: 'Dış kulak yolu eksostozları' },
  { id: 'perforasyon', kat: 'perforasyon', sade: 'Kulak zarında delik', teknik: 'Timpanik membran perforasyonu' },
  { id: 'timpanoskleroz', kat: 'timpanoskleroz', sade: 'Zarda sertleşme plakları', teknik: 'Timpanoskleroz (miringoskleroz)' },
  { id: 'retraksiyon', kat: 'retraksiyon', sade: 'Zarın içe çökmesi (cep)', teknik: 'Retraksiyon cebi' },
  { id: 'ome', kat: 'otitis-media', sade: 'Orta kulakta sıvı', teknik: 'Efüzyonlu otitis media (OME)' },
  { id: 'ostaki', kat: 'ostaki', sade: 'Östaki borusu çalışmıyor (basınç düşük)', teknik: 'Östaki tüpü disfonksiyonu' },
  { id: 'otoskleroz', kat: 'otoskleroz', sade: 'Üzengi kemiği takılması', teknik: 'Otoskleroz' },
  { id: 'zincir', kat: 'zincir-kopuk', sade: 'Kemikçik zinciri kopukluğu', teknik: 'Kemikçik zinciri diskontinüitesi' },
  { id: 'gurultu', kat: 'gurultu-hasari', sade: 'Gürültüye bağlı işitme kaybı', teknik: 'Gürültüye bağlı sensörinöral işitme kaybı' },
  { id: 'akustik-travma', kat: 'gurultu-hasari', sade: 'Patlama sesiyle iç kulak hasarı', teknik: 'Akut akustik travma' },
  { id: 'presbiakuzi', kat: 'presbiakuzi', sade: 'Yaşa bağlı işitme kaybı', teknik: 'Presbiakuzi' },
  { id: 'ototoks', kat: 'ototoksisite', sade: 'İlaca bağlı iç kulak hasarı', teknik: 'Ototoksisite (ilaca bağlı koklear hasar)' },
  { id: 'meniere', kat: 'meniere', sade: 'Meniere hastalığı', teknik: 'Meniere hastalığı (endolenfatik hidrops)' },
  { id: 'noroma', kat: 'noroma', sade: 'İşitme sinirinde sorun şüphesi', teknik: 'Retrokoklear patoloji şüphesi (vestibüler schwannom)' },
  { id: 'noropati', kat: 'noropati', sade: 'İşitsel nöropati', teknik: 'İşitsel nöropati spektrum bozukluğu (ANSD)' },
  { id: 'tinnitus', kat: 'tinnitus', sade: 'Kulak çınlaması (işitme normal)', teknik: 'Öznel tinnitus, normal işitme' },
  { id: 'pulsatil', kat: 'tinnitus', sade: 'Nabızla uyumlu çınlama', teknik: 'Pulsatil tinnitus' },
  { id: 'merkezi', kat: 'merkezi', sade: 'İşitsel işlemleme bozukluğu', teknik: 'Merkezi işitsel işlemleme bozukluğu' },
  { id: 'ani', kat: 'ani', sade: 'Ani işitme kaybı', teknik: 'Ani sensörinöral işitme kaybı' },
  { id: 'mikst', kat: 'mikst', sade: 'Hem orta hem iç kulak etkilenmiş (karışık kayıp)', teknik: 'Mikst tip işitme kaybı' },
  { id: 'tarama-gecti', kat: 'tarama', sade: 'Tarama geçti', teknik: 'Yenidoğan işitme taraması: geçti' },
  { id: 'tarama-ileri', kat: 'tarama', sade: 'Tarama geçilemedi: ileri test gerekli', teknik: 'Taramada kaldı: tanısal değerlendirme gerekli' },
];
export const taniById = (id: string) => TANILAR.find((t) => t.id === id);

export type YasGrubu = 'bebek' | 'cocuk' | 'genc' | 'yetiskin' | 'yasli';
export interface HastaGorunum {
  /** ten tonu 0–3 */ ten: 0 | 1 | 2 | 3;
  sac: 'kahve' | 'siyah' | 'sari' | 'kizil' | 'gri' | 'beyaz' | 'yok';
  /** resimli aksesuar (kurgusal, gerçekçi olmayan çizim) */
  aks?: 'gozluk' | 'baret' | 'kulaklik' | 'cihaz' | 'emzik' | 'bere' | 'yuzucu' | 'bisiklet' | 'okul' | 'sapka';
}
export interface YonetimSecenek { id: string; sade: string; teknik?: string }

export interface Vaka {
  /** kalıcı kimlik (Vaka Defteri kayıtları buna bağlı) */
  id: string;
  /** zorluk kademesi: Odyoloji Kliniği Sv 1 / 4 / 7 ile açılır */
  kademe: 1 | 2 | 3;
  kat: VakaKategori;
  baslik: string;
  hasta: { ad: string; yas: string; grup: YasGrubu; gorunum: HastaGorunum };
  /** kısa öykü (herkes için) */
  oyku: string;
  belirtiler: string[];
  testler: VakaTestleri;
  /** her kulağın kayıp tipi (odyogram sınıflamasıyla aynı olmalı; test denetler) */
  kayip: Record<Ear, Kayip> | null;
  /** tanıya ulaşmak için yeterli en az test (verimlilik yıldızı: hepsi istenmiş ve toplam ≤ anahtar + 1) */
  anahtar: TestId[];
  /** doğru tanı + yanıltıcı seçenekler (sade düzey ilk iki yanıltıcıyı, odyoloji düzeyi üçünü gösterir) */
  tani: { dogru: string; yanlis: [string, string, string] };
  /** yönetim seçenekleri: ilki doğrudur (ekranda vaka kimliğine göre sabit karıştırılır) */
  yonetim: [YonetimSecenek, YonetimSecenek, YonetimSecenek, YonetimSecenek];
  aciklama: { sade: string; teknik: string };
  /** eşleşen Kulak Sözlüğü terimi (GLOSSARY ya da CAMP_TERMS kimliği) */
  terim: string;
  kaynak: string;
}

// ---------------------------------------------------------------- sınıflama (odyogram, timpanogram)

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
/** saf ses ortalaması (500, 1000, 2000 Hz) */
export const pta3 = (ac: number[]) => avg([ac[1]!, ac[2]!, ac[3]!]);
/** dört frekans ortalaması (500, 1000, 2000, 4000 Hz) */
export const pta4 = (ac: number[]) => avg([ac[1]!, ac[2]!, ac[3]!, ac[5]!]);
/** kayıp derecesi (Clark 1981 / ASHA; docs: kamp terimi "İşitme kaybı dereceleri") */
export function derece(pta: number): string {
  if (pta <= 15) return 'normal';
  if (pta <= 25) return 'çok hafif';
  if (pta <= 40) return 'hafif';
  if (pta <= 55) return 'orta';
  if (pta <= 70) return 'orta-ileri';
  if (pta <= 90) return 'ileri';
  return 'çok ileri';
}
/** hava–kemik aralıkları (kemik yolu frekanslarında; yanıt yok olan kemik yolu atlanır → null) */
export function gaps(o: Odyogram, ear: Ear): (number | null)[] {
  const nrb = o.nr?.[ear === 'R' ? 'bcR' : 'bcL'] ?? [];
  return BC_AT.map((ai, bi) => (nrb.includes(bi) ? null : o.ac[ear][ai]! - o.bc[ear][bi]!));
}
/** bir kulağın kayıp tipi (çapraz kontrol: kemik yolu normal mi, anlamlı hava–kemik aralığı var mı) */
export function kayipTipi(o: Odyogram, ear: Ear): Kayip {
  const ac = o.ac[ear]; const bc = o.bc[ear];
  if (Math.max(...ac) <= 25) return 'normal';
  const nrb = o.nr?.[ear === 'R' ? 'bcR' : 'bcL'] ?? [];
  const g = gaps(o, ear).filter((x): x is number => x !== null);
  const sig = g.filter((x) => x >= 15).length >= 2;
  const bcAbn = bc.some((x, i) => !nrb.includes(i) && x > 25) || nrb.length > 0;
  if (sig) return bcAbn ? 'mikst' : 'iletim';
  return 'sensorinoral';
}
/** eşdeğer kanal hacminin yaşa göre yorumu */
export function hacimSinifi(ml: number, grup: YasGrubu): 'kucuk' | 'normal' | 'buyuk' {
  const [lo, hi, big] = grup === 'bebek' ? [0.2, 0.6, 0.9] : grup === 'cocuk' ? [0.4, 1.0, 1.0] : [0.6, 1.5, 2.0];
  if (ml < lo) return 'kucuk';
  if (ml > big) return 'buyuk';
  if (ml <= hi) return 'normal';
  return 'normal';
}
/** timpanogram değerleri tipine uyuyor mu (Jerger): hata metni ya da null */
export function timpHatasi(t: Timp, grup: YasGrubu): string | null {
  const ecv = hacimSinifi(t.hacim, grup);
  switch (t.tip) {
    case 'A': return t.basinc === null || t.basinc < -100 || t.basinc > 50 ? 'Tip A tepe basıncı −100…+50 daPa olmalı' : t.uyum < 0.3 || t.uyum > 1.7 ? 'Tip A admitansı 0,3–1,7 ml olmalı' : ecv !== 'normal' ? 'Tip A’da kanal hacmi normal olmalı' : null;
    case 'As': return t.basinc === null || t.basinc < -100 || t.basinc > 50 ? 'Tip As tepe basıncı normal olmalı' : t.uyum >= 0.3 || t.uyum < 0.1 ? 'Tip As admitansı 0,1–0,3 ml olmalı' : ecv !== 'normal' ? 'Tip As’de kanal hacmi normal olmalı' : null;
    case 'Ad': return t.basinc === null || t.basinc < -100 || t.basinc > 50 ? 'Tip Ad tepe basıncı normal olmalı' : t.uyum <= 1.7 ? 'Tip Ad admitansı 1,7 ml’den büyük olmalı' : ecv !== 'normal' ? 'Tip Ad’de kanal hacmi normal olmalı' : null;
    case 'B': return t.basinc !== null ? 'Tip B düzdür: tepe basıncı yok' : t.uyum > 0.2 ? 'Tip B admitansı ≤0,2 ml olmalı' : null;
    case 'C': return t.basinc === null || t.basinc >= -100 ? 'Tip C tepesi −100 daPa’dan negatif olmalı' : t.uyum < 0.2 || t.uyum > 1.7 ? 'Tip C admitansı makul olmalı' : ecv !== 'normal' ? 'Tip C’de kanal hacmi normal olmalı' : null;
  }
}

// ---------------------------------------------------------------- seçenekler ve puanlama

/** vaka kimliğinden sabit karıştırma tohumu (aynı vaka her zaman aynı sırayla gösterilir) */
export function vakaTohum(id: string): number { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
function karistir<T>(xs: T[], seed: number): T[] {
  const a = [...xs]; let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export type BilgiDuzeyi = 'genel' | 'odyoloji';
/** ekrandaki tanı seçenekleri: genel düzeyde 3 (doğru + ilk iki yanıltıcı), odyoloji düzeyinde 4 */
export function taniSecenekleri(v: Vaka, duzey: BilgiDuzeyi): TaniDef[] {
  const ids = [v.tani.dogru, ...v.tani.yanlis.slice(0, duzey === 'genel' ? 2 : 3)];
  return karistir(ids, vakaTohum(v.id)).map((id) => taniById(id)!);
}
/** ekrandaki yönetim seçenekleri: genel düzeyde 3, odyoloji düzeyinde 4 */
export function yonetimSecenekleri(v: Vaka, duzey: BilgiDuzeyi): YonetimSecenek[] {
  return karistir(v.yonetim.slice(0, duzey === 'genel' ? 3 : 4), vakaTohum(v.id) ^ 0x5bd1e995);
}
/** konsültasyon kartındaki hazır seçenekler (takım arkadaşları oylar): sade düzeyin üç tanısı */
export const konsultSecenekleri = (v: Vaka) => taniSecenekleri(v, 'genel');

export interface VakaPuan { stars: 0 | 1 | 2 | 3; dxOk: boolean; mgOk: boolean; efficient: boolean; /** istenen ama gereksiz test sayısı */ extra: number }
/**
 * Puanlama: doğru tanı 1 yıldız (vaka çözülür), doğru yönetim +1, verimli test seçimi +1
 * (anahtar testlerin hepsi istendi ve toplam test sayısı ≤ anahtar + 1). Tanı yanlışsa 0 yıldız: vaka bekleme salonunda kalır.
 */
export function vakaPuanla(v: Vaka, a: { tests: string[]; dx: string; mg: string }): VakaPuan {
  const tests = [...new Set(a.tests)].filter((t) => testById(t));
  const dxOk = a.dx === v.tani.dogru;
  const mgOk = a.mg === v.yonetim[0].id;
  const hasKeys = v.anahtar.every((k) => tests.includes(k));
  const efficient = hasKeys && tests.length <= v.anahtar.length + 1;
  const stars = (dxOk ? 1 + (mgOk ? 1 : 0) + (mgOk && efficient ? 1 : 0) : 0) as VakaPuan['stars'];
  return { stars, dxOk, mgOk, efficient, extra: Math.max(0, tests.length - v.anahtar.length) };
}

// ---------------------------------------------------------------- tıbbi tutarlılık denetimi

const ears: Ear[] = ['R', 'L'];
const earName = (e: Ear) => (e === 'R' ? 'sağ' : 'sol');
/**
 * Vakanın bütün bulguları birbiriyle ve tanısıyla tutarlı mı (çapraz kontrol ilkesi). Boş dizi = tutarlı.
 * Kurallar ders kitabı düzeyindedir (Katz; Jerger 1970; ASHA): odyogram sınıfı, timpanogram değerleri, otoskopi ↔ timpanogram,
 * OAE ↔ orta kulak ve eşik, refleks ↔ iletim kaybı, ABR, konuşma eşiği ↔ saf ses ortalaması ve kategoriye özgü örüntüler.
 */
export function vakaTutarsizliklari(v: Vaka): string[] {
  const out: string[] = []; const T = v.testler; const grup = v.hasta.grup;
  const err = (m: string) => out.push(`${v.id}: ${m}`);
  const o = isYok(T.odyometri) ? null : T.odyometri;
  const tp = isYok(T.timpanometri) ? null : T.timpanometri;
  const os = isYok(T.otoskopi) ? null : T.otoskopi;
  const rf = isYok(T.refleks) ? null : T.refleks;
  const oae = isYok(T.oae) ? null : T.oae;
  const abr = isYok(T.abr) ? null : T.abr;
  const sp = isYok(T.konusma) ? null : T.konusma;
  const ip = isYok(T.islemleme) ? null : T.islemleme;
  const dx = taniById(v.tani.dogru);
  if (!dx) err(`bilinmeyen tanı ${v.tani.dogru}`);
  for (const y of v.tani.yanlis) { if (!taniById(y)) err(`bilinmeyen yanıltıcı ${y}`); if (y === v.tani.dogru) err('yanıltıcı doğru tanıyla aynı'); }
  if (new Set(v.tani.yanlis).size !== 3) err('yanıltıcılar eşsiz değil');
  if (new Set(v.yonetim.map((y) => y.id)).size !== 4) err('yönetim kimlikleri eşsiz değil');
  // yanıltıcı tanılar aynı kategoride olmamalı (iki doğru cevap olmasın); "mikst" yalnız odyogramda mikst kulak yoksa yanıltıcıdır
  for (const y of v.tani.yanlis) {
    const d = taniById(y); if (!d) continue;
    if (d.kat === v.kat && d.kat !== 'tarama') err(`yanıltıcı ${y} doğru kategoriyle aynı`);
    if (y === 'mikst' && v.kayip && (v.kayip.R === 'mikst' || v.kayip.L === 'mikst')) err('mikst kulak varken "mikst" yanıltıcı olamaz');
  }
  if (dx && dx.kat !== 'mikst' && dx.kat !== v.kat) err(`tanı kategorisi (${dx.kat}) vaka kategorisiyle (${v.kat}) uyuşmuyor`);
  if (dx?.kat === 'mikst' && !(v.kayip && (v.kayip.R === 'mikst' || v.kayip.L === 'mikst'))) err('mikst tanı ama mikst kulak yok');
  if (!v.anahtar.length) err('anahtar test yok');
  for (const k of v.anahtar) if (isYok(T[k])) err(`anahtar test ${k} yapılmamış`);

  // odyogram
  if (o) {
    if (!v.kayip) err('odyogram var ama kayıp tipi bildirilmemiş');
    for (const e of ears) {
      const ac = o.ac[e]; const bc = o.bc[e];
      if (ac.length !== AC_HZ.length || bc.length !== BC_HZ.length) { err(`${earName(e)} odyogram uzunluğu`); continue; }
      for (const x of [...ac, ...bc]) if (x % 5 !== 0 || x < -10 || x > 120) err(`${earName(e)} eşik 5 dB adımlı ve −10…120 olmalı (${x})`);
      const nrb = o.nr?.[e === 'R' ? 'bcR' : 'bcL'] ?? [];
      BC_AT.forEach((ai, bi) => { if (!nrb.includes(bi) && bc[bi]! > ac[ai]! + 10) err(`${earName(e)} ${BC_HZ[bi]} Hz kemik yolu hava yolundan 10 dB’den fazla kötü olamaz`); });
      if (bc.some((x, bi) => x > [70, 70, 70, 70][bi]!)) err(`${earName(e)} kemik yolu cihaz sınırını (70 dB HL) aşamaz`);
      const k = kayipTipi(o, e);
      if (v.kayip && v.kayip[e] !== k) err(`${earName(e)} kulak odyogramı ${k}, bildirilen ${v.kayip[e]}`);
    }
  } else if (v.kayip) err('kayıp tipi bildirilmiş ama odyogram yok');
  const kay = (e: Ear) => (v.kayip ? v.kayip[e] : null);

  // timpanogram
  if (tp) for (const e of ears) { const t = tp[e]; if (t) { const h = timpHatasi(t, grup); if (h) err(`${earName(e)} timpanogram: ${h}`); } }
  const tip = (e: Ear) => tp?.[e]?.tip ?? null;
  const ecv = (e: Ear) => { const t = tp?.[e]; return t ? hacimSinifi(t.hacim, grup) : null; };

  // otoskopi ↔ timpanogram
  if (os) for (const e of ears) {
    const f = os[e]; const t = tip(e); if (!f) continue;
    if (!t) { if (f !== 'odem' && f !== 'normal' && grup !== 'bebek') err(`${earName(e)} otoskopi ${f} ama timpanogram yok`); continue; }
    const okMap: Record<Otoskopi, TipTimp[]> = { normal: ['A', 'As', 'Ad', 'C'], serumen: ['B'], odem: [], eksostoz: ['A'], perforasyon: ['B'], efuzyon: ['B', 'C'], icecekik: ['C'], retraksiyon: ['C', 'B'], plak: ['A', 'As'] };
    if (!okMap[f].includes(t)) err(`${earName(e)} otoskopi ${f} ile timpanogram ${t} uyuşmuyor`);
    if (f === 'serumen' && ecv(e) !== 'kucuk') err(`${earName(e)} tıkayıcı kirde kanal hacmi küçük olmalı`);
    if (f === 'perforasyon' && ecv(e) !== 'buyuk') err(`${earName(e)} perforasyonda kanal hacmi büyük olmalı`);
    if (f === 'efuzyon' && t === 'B' && ecv(e) !== 'normal') err(`${earName(e)} efüzyonda kanal hacmi normal olmalı`);
    if (t === 'B' && f === 'normal') err(`${earName(e)} düz timpanogram normal otoskopiyle açıklanamaz`);
  }
  // iletim tipi kayıpta orta kulak/kanal bulgusu olmalı (ya da Ad/As)
  for (const e of ears) {
    const k = kay(e); const t = tip(e);
    if ((k === 'iletim' || k === 'mikst') && t === 'A' && os?.[e] === 'normal') err(`${earName(e)} iletim bileşeni var ama otoskopi ve timpanogram normal`);
    if ((k === 'normal' || k === 'sensorinoral') && t === 'B') err(`${earName(e)} düz timpanogram ama iletim bileşeni yok`);
  }

  // OAE
  if (oae) for (const e of ears) {
    const x = oae[e]; if (!x) continue; const t = tip(e); const ac = o?.ac[e];
    const mid = ac ? Math.max(ac[2]!, ac[3]!, ac[5]!) : null; const low = ac ? Math.max(ac[1]!, ac[2]!) : null;
    if (x === 'var' && v.kat !== 'noropati') {
      if (t && t !== 'A') err(`${earName(e)} OAE var ama orta kulak normal değil (${t})`);
      if (mid !== null && mid > 30) err(`${earName(e)} OAE var ama 1–4 kHz eşik ${mid} dB HL`);
    }
    if (x === 'kismi' && !(low !== null && low <= 30 && mid !== null && mid > 25)) err(`${earName(e)} kısmi OAE: alçak-orta frekans iyi, tizde kayıp olmalı`);
    if (x === 'yok' && t === 'A' && mid !== null && mid <= 25 && v.kat !== 'noropati') err(`${earName(e)} OAE yok ama orta kulak ve eşikler normal`);
    if (x === 'azalmis' && !(t === 'C' || t === 'As')) err(`${earName(e)} azalmış OAE yalnız negatif basınç ya da sertlikle açıklanır`);
  }
  // refleks (ipsilateral)
  if (rf) for (const e of ears) {
    const x = rf[e]; if (!x) continue; const k = kay(e); const t = tip(e);
    if (x === 'var' && (k === 'iletim' || k === 'mikst') && (t === 'B' || t === 'Ad' || t === 'As')) err(`${earName(e)} iletim kaybında (${t}) ipsilateral refleks beklenmez`);
    if (x === 'var' && o && Math.max(o.ac[e][2]!, o.ac[e][3]!) > 70) err(`${earName(e)} ileri koklear kayıpta refleks beklenmez`);
    if (x === 'var' && t === 'B') err(`${earName(e)} düz timpanogramda refleks ölçülemez`);
    if (x === 'yok' && k === 'normal' && t === 'A' && !['noropati', 'noroma'].includes(v.kat)) err(`${earName(e)} normal işitme ve normal orta kulakta refleks yok`);
    if (x === 'yorulma' && v.kat !== 'noroma') err('refleks yorulması yalnız retrokoklear vakada');
  }
  // ABR
  if (abr) for (const e of ears) {
    const x = abr[e]; if (!x) continue;
    if (x === 'gecikmis' && v.kat !== 'noroma') err('gecikmiş ABR yalnız retrokoklear vakada');
    if (x === 'cm' && v.kat !== 'noropati') err('yalnız koklear mikrofonik: işitsel nöropati vakasında');
    if (x === 'normal' && kay(e) && kay(e) !== 'normal') err(`${earName(e)} ABR normal ama kayıp var`);
  }
  // konuşma eşiği saf ses ortalamasıyla uyumlu (±10 dB), normal işitmede ayırt etme iyi
  if (sp && o) for (const e of ears) {
    const p = pta3(o.ac[e]);
    if (Math.abs(sp.srt[e] - p) > 10) err(`${earName(e)} SRT ${sp.srt[e]} saf ses ortalamasıyla (${p.toFixed(1)}) uyumsuz`);
    if (kay(e) === 'normal' && sp.sds[e] < 88 && !['merkezi', 'noropati'].includes(v.kat)) err(`${earName(e)} normal işitmede ayırt etme ≥%88 olmalı`);
    if (sp.sds[e] < 0 || sp.sds[e] > 100 || sp.sds[e] % 4 !== 0) err(`${earName(e)} ayırt etme skoru 0–100 ve 4’ün katı (25 kelime) olmalı`);
  }
  if (ip && v.kat !== 'merkezi' && v.kat !== 'noropati') err('işlemleme testi yalnız merkezi/nöropati vakasında');

  // kategoriye özgü örüntüler
  const both = (f: (e: Ear) => boolean) => f('R') && f('L');
  const some = (f: (e: Ear) => boolean) => f('R') || f('L');
  const ac = (e: Ear, hz: number) => o!.ac[e][AC_HZ.indexOf(hz as (typeof AC_HZ)[number])]!;
  const need = (c: boolean, m: string) => { if (!c) err(m); };
  switch (v.kat) {
    case 'normal': need(!!o && both((e) => kay(e) === 'normal') && both((e) => tip(e) === 'A'), 'normal: iki kulak normal, Tip A'); break;
    case 'serumen-tikaci': need(!!os && some((e) => os[e] === 'serumen' && (kay(e) === 'iletim' || kay(e) === 'mikst')), 'serumen: tıkalı kulakta iletim bileşeni'); break;
    case 'otitis-eksterna': need(!!os && some((e) => os[e] === 'odem'), 'otitis eksterna: ödemli kanal'); break;
    case 'eksostoz': need(!!os && some((e) => os[e] === 'eksostoz'), 'eksostoz: otoskopi bulgusu'); break;
    case 'perforasyon': need(!!os && some((e) => os[e] === 'perforasyon' && (kay(e) === 'iletim' || kay(e) === 'mikst')), 'perforasyon: delikli kulakta iletim bileşeni'); break;
    case 'timpanoskleroz': need(!!os && some((e) => os[e] === 'plak' && (tip(e) === 'As' || tip(e) === 'A')), 'timpanoskleroz: plak + A/As'); break;
    case 'retraksiyon': need(!!os && some((e) => os[e] === 'retraksiyon'), 'retraksiyon: otoskopi bulgusu'); break;
    case 'otitis-media': need(some((e) => os?.[e] === 'efuzyon' && tip(e) === 'B' && ecv(e) === 'normal' && kay(e) === 'iletim'), 'OME: efüzyon, Tip B normal hacim, iletim'); break;
    case 'ostaki': need(some((e) => tip(e) === 'C' && (kay(e) === 'normal' || kay(e) === 'iletim')), 'Östaki: Tip C'); break;
    case 'otoskleroz': need(some((e) => (kay(e) === 'iletim' || kay(e) === 'mikst') && (tip(e) === 'As' || tip(e) === 'A') && rf?.[e] === 'yok' && o!.bc[e][2]! >= Math.max(o!.bc[e][0]!, o!.bc[e][1]!) + 5), 'otoskleroz: iletim/mikst, As, refleks yok, Carhart çentiği'); break;
    case 'zincir-kopuk': need(some((e) => kay(e) === 'iletim' && tip(e) === 'Ad' && rf?.[e] === 'yok' && gaps(o!, e).filter((g) => g !== null && g >= 35).length >= 2), 'zincir: büyük iletim kaybı, Ad, refleks yok'); break;
    case 'gurultu-hasari': need(some((e) => kay(e) === 'sensorinoral' && Math.max(ac(e, 3000), ac(e, 4000), ac(e, 6000)) >= ac(e, 8000) + 10 && Math.max(ac(e, 3000), ac(e, 4000), ac(e, 6000)) >= ac(e, 1000) + 20), 'gürültü: 3–6 kHz çentiği, 8 kHz’te iyileşme'); break;
    case 'presbiakuzi': need(both((e) => kay(e) === 'sensorinoral' && ac(e, 8000) >= ac(e, 500) + 30) && AC_HZ.every((_, i) => Math.abs(o!.ac.R[i]! - o!.ac.L[i]!) <= 15) && grup === 'yasli', 'presbiakuzi: yaşlı, iki taraflı simetrik inen SNİK'); break;
    case 'ototoksisite': need(both((e) => kay(e) === 'sensorinoral' && (ac(e, 8000) >= ac(e, 1000) + 30 || pta4(o!.ac[e]) >= 70)), 'ototoksisite: iki taraflı tizden başlayan ya da ileri SNİK'); break;
    case 'meniere': need(some((e) => kay(e) === 'sensorinoral' && ac(e, 500) >= ac(e, 4000) + 15 && kay(e === 'R' ? 'L' : 'R') === 'normal' && tip(e) === 'A'), 'Meniere: tek taraflı alçak frekans SNİK'); break;
    case 'noroma': need(some((e) => kay(e) === 'sensorinoral' && AC_HZ.filter((_, i) => o!.ac[e][i]! - o!.ac[e === 'R' ? 'L' : 'R'][i]! >= 15).length >= 2 && !!sp && sp.sds[e] < 70 && ['yok', 'yorulma', 'yuksek'].includes(rf?.[e] ?? '')), 'nörom: asimetri, orantısız düşük ayırt etme, refleks bozuk'); break;
    case 'noropati': need(some((e) => oae?.[e] === 'var' && (abr?.[e] === 'cm' || abr?.[e] === 'yok') && rf?.[e] === 'yok'), 'nöropati: OAE var, ABR yok/CM, refleks yok'); break;
    case 'tinnitus': need(!!o && both((e) => kay(e) === 'normal'), 'tinnitus vakaları: işitme normal'); break;
    case 'merkezi': need(!!o && both((e) => kay(e) === 'normal') && both((e) => tip(e) === 'A') && !!ip && (ip.gurultu === 'zayif' || ip.dikotik === 'zayif') && grup !== 'bebek', 'merkezi: periferik normal, işlemleme zayıf'); break;
    case 'ani': need(some((e) => kay(e) === 'sensorinoral' && AC_HZ.slice(1, 6).filter((_, i) => o!.ac[e][i + 1]! - o!.ac[e === 'R' ? 'L' : 'R'][i + 1]! >= 30).length >= 3), 'ani: ardışık üç frekansta ≥30 dB SNİK'); break;
    case 'tarama': need(!!oae && grup === 'bebek', 'tarama: bebek ve OAE'); break;
  }
  return out;
}
