/**
 * Timpanogram Eşleştir (Timpanometri Kulesi) soru bankası. Her turda 5 soru gelir; sorular oyuncunun Bilgi düzeyine göre
 * havuzdan, sunucudaki kişisel desteden (karıştırılmış sıra + imleç) seçilir: havuzun çoğu görülmeden aynı soru tekrar gelmez.
 *
 * Tıbbi ilke: timpanogram tek başına tanı koydurmaz. "Eğri → bulgu" sorularının cevabı yalnız eğrinin gösterdiğini söyler
 * (hareketlilik, tepe basıncı, admitans, kanal hacmi). Olası nedenler yalnız cevaptan sonraki açıklamada, olasılık diliyle geçer.
 * Tanı düzeyinde cevap yalnız kısa öyküde otoskopi bulgusu da verildiğinde (vinyet) kullanılır.
 *
 * Biçimler: eğri → bulgu, bulgu → eğri (3–4 küçük eğriden biri), sayılar → Jerger tipi, mini vinyet (öykü + eğri, gerekirse
 * otoskopi çizimi), sağ/sol karşılaştırma, bilgi (226 / 1000 Hz prob tonu, yaşa göre kanal hacmi, tüp, prob duvarda, akustik refleks).
 * Değerler 226 Hz prob tonuyla, yetişkin ve çocuk normlarına göre yazılmıştır (bebekte 226 Hz eğrisi soru olarak kullanılmaz).
 */
import { hacimSinifi, timpHatasi, type BilgiDuzeyi, type Otoskopi, type Timp, type TipTimp, type YasGrubu } from './kamp-gorev-vaka';

// ---------------------------------------------------------------- bulgu sınıfları (tanı değil)

export type EgriTur = 'A' | 'As' | 'Ad' | 'B-normal' | 'B-buyuk' | 'B-kucuk' | 'C';
/** cevap etiketleri: eğrinin gösterdiği bulgu (tanı değil) */
export const EGRI_ADI: Record<EgriTur, { sade: string; teknik: string }> = {
  'A': { sade: 'Zar rahat hareket ediyor: tepe normal yerde ve normal yükseklikte', teknik: 'Tip A: normal tepe basıncı ve admitans' },
  'As': { sade: 'Tepe normal yerde ama alçak: sert / az hareketli sistem', teknik: 'Tip As (sığ): düşük admitans' },
  'Ad': { sade: 'Tepe çok yüksek: aşırı hareketli sistem', teknik: 'Tip Ad (derin): yüksek admitans' },
  'B-normal': { sade: 'Zar hareket etmiyor (düz eğri), kanal hacmi normal', teknik: 'Tip B, normal hacim' },
  'B-buyuk': { sade: 'Düz eğri + büyük hacim: zarda açıklık ya da açık tüp olabilir', teknik: 'Tip B, büyük hacim' },
  'B-kucuk': { sade: 'Düz eğri + küçük hacim: kanal tıkalı olabilir ya da prob duvara dayanmış', teknik: 'Tip B, küçük hacim' },
  'C': { sade: 'Tepe negatif basınçta: negatif orta kulak basıncı', teknik: 'Tip C: negatif tepe basıncı' },
};
/** cevaptan sonra gösterilen açıklama: olası nedenler yalnız burada ve olasılık diliyle */
export const EGRI_ACIKLAMA: Record<EgriTur, string> = {
  'A': 'Tepe −100…+50 daPa arasında, admitans normal sınırda: zar ve kemikçikler basınç değişimine rahat yanıt veriyor. Normal eğri kokleanın ya da sinirin sağlam olduğunu söylemez; işitme eşiği ayrıca ölçülür.',
  'As': 'Tepe normal basınçta ama alçak: sistem sert. Olası nedenler arasında otoskleroz ve zarda sertleşme (timpanoskleroz) vardır; otoskopi ve odyogramla birlikte yorumlanır.',
  'Ad': 'Tepe normal basınçta ama çok yüksek: sistem fazla gevşek. Kemikçik zinciri kopukluğu ya da zarın ince, gevşek (atrofik) bir bölümü olabilir; işitmenin durumu odyogramla ayırt edilir.',
  'B-normal': 'Eğri düz, kanal hacmi normal: zar basınçla hareket etmiyor ve zarda açıklık beklenmez. En sık nedeni orta kulakta sıvı (efüzyon) olabilir; otoskopi ile doğrulanır.',
  'B-buyuk': 'Eğri düz ve ölçülen hacim büyük: ölçüm kanalın ötesine, orta kulak boşluğuna da uzanıyor olabilir. Zarda delik ya da açık bir ventilasyon tüpü olası nedenlerdir; otoskopiyle bakılır.',
  'B-kucuk': 'Eğri düz ve hacim küçük: ses zara ulaşmıyor olabilir. Kanalı tıkayan kir (serumen) ya da kanal duvarına dayanmış prob olası nedenlerdir; otoskopi yapılır, prob yeniden yerleştirilip ölçüm tekrarlanır.',
  'C': 'Tepe −100 daPa’dan daha negatif: orta kulak basıncı dışarıdan düşük. Çoğu zaman Östaki borusunun basıncı dengeleyememesiyle ilişkilidir; soğuk algınlığı ya da uçuş sonrası görülebilir, izlem ve tekrar ölçüm yapılabilir.',
};
export const egriTipi = (e: EgriTur): TipTimp => (e.startsWith('B') ? 'B' : e as TipTimp);
/** eğrinin bulgu sınıfı (düz eğride yaşa göre kanal hacmi) */
export function egriSinifi(t: Timp, grup: YasGrubu): EgriTur {
  if (t.tip !== 'B') return t.tip;
  const h = hacimSinifi(t.hacim, grup);
  return h === 'buyuk' ? 'B-buyuk' : h === 'kucuk' ? 'B-kucuk' : 'B-normal';
}

// ---------------------------------------------------------------- soru bankası

export type TimpBicim = 'egri-bulgu' | 'bulgu-egri' | 'sayi-tip' | 'vinyet' | 'sag-sol' | 'bilgi';
export const TIMP_BICIM_ADI: Record<TimpBicim, string> = {
  'egri-bulgu': 'Eğri → bulgu', 'bulgu-egri': 'Bulgu → eğri', 'sayi-tip': 'Sayılar → tip', 'vinyet': 'Kısa vaka', 'sag-sol': 'Sağ mı, sol mu?', 'bilgi': 'Bilgi',
};
type SagSolSoru = 'B' | 'A' | 'C' | 'buyuk';
const SAG_SOL_SORU: Record<SagSolSoru, string> = {
  B: 'Hangi kulakta zar hareket etmiyor (düz eğri)?',
  A: 'Hangi kulakta eğri normal (tepe normal yerde ve yükseklikte)?',
  C: 'Hangi kulakta tepe negatif basınçta?',
  buyuk: 'Hangi kulakta düz eğriyle birlikte kanal hacmi yaşına göre büyük?',
};
export const SAG_SOL_SECENEK = ['Sağ', 'Sol', 'İkisi de', 'Hiçbiri'] as const;

interface Ortak { id: string; duzey: BilgiDuzeyi; kaynak: string; grup?: YasGrubu; /** ekranda yaş (ör. "4 yaş") */ yas?: string }
export type TimpSoruDef = Ortak & (
  | { bicim: 'egri-bulgu'; egri: Timp; secenek: EgriTur[] }
  | { bicim: 'bulgu-egri'; bulgu: EgriTur; secenek: Timp[] }
  | { bicim: 'sayi-tip'; egri: Timp; secenek: EgriTur[] }
  | { bicim: 'vinyet'; hikaye: string; egri: Timp; sinif: EgriTur; otoskopi?: Otoskopi; secenek: string[]; aciklama: string }
  | { bicim: 'sag-sol'; sor: SagSolSoru; sag: Timp; sol: Timp }
  | { bicim: 'bilgi'; soru: string; secenek: string[]; aciklama: string }
);

const T = (tip: TipTimp, basinc: number | null, uyum: number, hacim: number): Timp => ({ tip, basinc, uyum, hacim });
const JERGER = 'Jerger J. (1970). Clinical experience with impedance audiometry. Arch Otolaryngol 92:311–324';
const KATZ = 'Katz J. (ed.) Handbook of Clinical Audiology, 7. baskı (2015): timpanometri ve akustik refleks bölümleri';
const MARGOLIS = 'Margolis RH, Heller JW (1987). Screening tympanometry: criteria for medical referral. Audiology 26:197–208';
const ASHA = 'ASHA (1997, 2016). Guidelines for audiologic screening; çocukta orta kulak taraması ölçütleri';
const JCIH = 'JCIH (2019). Year 2019 Position Statement; bebekte 1000 Hz prob tonu önerisi';
const HUNTER = 'Hunter LL, Shahnaz N. (2014). Acoustic Immittance Measures: Basic and Advanced Practice. Plural';
const OME = 'AAO-HNS (2016). Clinical Practice Guideline: Otitis Media with Effusion (Update)';

const GB: EgriTur[] = ['A', 'B-normal', 'C', 'B-buyuk', 'B-kucuk'];
/** eğri → bulgu: doğru + 3 yanıltıcı (sıra soruda karıştırılır) */
const eb = (id: string, duzey: BilgiDuzeyi, egri: Timp, grup: YasGrubu = 'yetiskin', yas?: string, kaynak = JERGER): TimpSoruDef => {
  const dogru = egriSinifi(egri, grup);
  const havuz: EgriTur[] = duzey === 'genel' ? GB : ['A', 'As', 'Ad', 'B-normal', 'B-buyuk', 'B-kucuk', 'C'];
  // yanıltıcılar: aynı tipin öteki hacim sınıfları ve komşu tipler önce (sabit, okunur sıra)
  const yakın: Record<EgriTur, EgriTur[]> = {
    'A': ['As', 'Ad', 'C', 'B-normal'], 'As': ['A', 'Ad', 'B-normal'], 'Ad': ['A', 'As', 'B-buyuk'], 'C': ['A', 'B-normal', 'As', 'B-kucuk'],
    'B-normal': ['B-buyuk', 'B-kucuk', 'C', 'A'], 'B-buyuk': ['B-normal', 'B-kucuk', 'Ad', 'A'], 'B-kucuk': ['B-normal', 'B-buyuk', 'C', 'A'],
  };
  const once = yakın[dogru].filter((x) => havuz.includes(x));
  const yan = [...once, ...havuz.filter((x) => x !== dogru && !once.includes(x))].slice(0, 3);
  return { id, duzey, bicim: 'egri-bulgu', egri, secenek: [dogru, ...yan], grup, yas, kaynak };
};
const st = (id: string, egri: Timp, grup: YasGrubu = 'yetiskin', yas?: string): TimpSoruDef => {
  const dogru = egriSinifi(egri, grup);
  const yan: EgriTur[] = (['A', 'As', 'Ad', 'B-normal', 'B-buyuk', 'B-kucuk', 'C'] as EgriTur[]).filter((x) => x !== dogru);
  // tipe göre en öğretici üç yanıltıcı
  const pick: Record<EgriTur, EgriTur[]> = {
    'A': ['As', 'Ad', 'C'], 'As': ['A', 'Ad', 'B-normal'], 'Ad': ['A', 'As', 'C'], 'C': ['A', 'B-normal', 'As'],
    'B-normal': ['B-buyuk', 'B-kucuk', 'As'], 'B-buyuk': ['B-normal', 'B-kucuk', 'Ad'], 'B-kucuk': ['B-normal', 'B-buyuk', 'As'],
  };
  return { id, duzey: 'odyoloji', bicim: 'sayi-tip', egri, secenek: [dogru, ...pick[dogru].filter((x) => yan.includes(x))], grup, yas, kaynak: grup === 'cocuk' ? MARGOLIS : JERGER };
};

export const TIMP_SORULAR: TimpSoruDef[] = [
  // ---- eğri → bulgu (genel)
  eb('te01', 'genel', T('A', -10, 0.8, 1.1)),
  eb('te02', 'genel', T('A', 15, 1.2, 1.3)),
  eb('te03', 'genel', T('A', -30, 0.5, 0.7), 'cocuk', '5 yaş', MARGOLIS),
  eb('te04', 'genel', T('B', null, 0.1, 1.0)),
  eb('te05', 'genel', T('B', null, 0.08, 0.6), 'cocuk', '4 yaş', MARGOLIS),
  eb('te06', 'genel', T('B', null, 0.1, 3.2)),
  eb('te07', 'genel', T('B', null, 0.05, 1.6), 'cocuk', '6 yaş', MARGOLIS),
  eb('te08', 'genel', T('B', null, 0.05, 0.3)),
  eb('te09', 'genel', T('B', null, 0.04, 0.2), 'cocuk', '7 yaş', MARGOLIS),
  eb('te10', 'genel', T('C', -180, 0.6, 1.2)),
  eb('te11', 'genel', T('C', -250, 0.4, 0.7), 'cocuk', '5 yaş', MARGOLIS),
  eb('te12', 'genel', T('C', -130, 0.9, 1.0)),
  // ---- eğri → bulgu (odyoloji)
  eb('te13', 'odyoloji', T('As', 0, 0.18, 1.1)),
  eb('te14', 'odyoloji', T('As', -20, 0.22, 1.3)),
  eb('te15', 'odyoloji', T('As', 10, 0.15, 0.9)),
  eb('te16', 'odyoloji', T('Ad', -5, 2.4, 1.2)),
  eb('te17', 'odyoloji', T('Ad', 5, 2.9, 1.0)),
  eb('te18', 'odyoloji', T('Ad', -15, 2.0, 1.4)),
  eb('te19', 'odyoloji', T('A', -90, 0.4, 1.0)),
  eb('te20', 'odyoloji', T('C', -120, 0.5, 1.1)),
  eb('te21', 'odyoloji', T('B', null, 0.08, 2.6)),
  eb('te22', 'odyoloji', T('B', null, 0.03, 0.4)),
  eb('te23', 'odyoloji', T('B', null, 0.12, 1.4)),
  eb('te24', 'odyoloji', T('A', 40, 1.5, 1.5)),
  eb('te25', 'odyoloji', T('C', -320, 0.3, 1.0)),
  eb('te26', 'odyoloji', T('A', -60, 0.35, 0.6), 'cocuk', '4 yaş', MARGOLIS),

  // ---- bulgu → eğri
  { id: 'tb01', duzey: 'genel', bicim: 'bulgu-egri', bulgu: 'A', secenek: [T('A', 0, 0.9, 1.1), T('B', null, 0.1, 1.1), T('C', -200, 0.7, 1.1), T('B', null, 0.1, 3.0)], kaynak: JERGER },
  { id: 'tb02', duzey: 'genel', bicim: 'bulgu-egri', bulgu: 'B-normal', secenek: [T('B', null, 0.1, 1.2), T('A', -20, 0.8, 1.2), T('C', -160, 0.6, 1.2)], kaynak: JERGER },
  { id: 'tb03', duzey: 'genel', bicim: 'bulgu-egri', bulgu: 'C', secenek: [T('C', -220, 0.7, 1.0), T('A', 0, 0.7, 1.0), T('B', null, 0.1, 1.0), T('A', 30, 1.1, 1.0)], kaynak: JERGER },
  { id: 'tb04', duzey: 'genel', bicim: 'bulgu-egri', bulgu: 'B-buyuk', secenek: [T('B', null, 0.1, 3.4), T('B', null, 0.1, 1.0), T('B', null, 0.04, 0.3)], kaynak: HUNTER },
  { id: 'tb05', duzey: 'genel', bicim: 'bulgu-egri', bulgu: 'B-kucuk', secenek: [T('B', null, 0.03, 0.3), T('B', null, 0.1, 1.1), T('B', null, 0.1, 2.9), T('C', -150, 0.5, 1.1)], kaynak: HUNTER },
  { id: 'tb06', duzey: 'odyoloji', bicim: 'bulgu-egri', bulgu: 'As', secenek: [T('As', -10, 0.17, 1.1), T('A', -10, 0.9, 1.1), T('Ad', -10, 2.5, 1.1), T('C', -180, 0.5, 1.1)], kaynak: JERGER },
  { id: 'tb07', duzey: 'odyoloji', bicim: 'bulgu-egri', bulgu: 'Ad', secenek: [T('Ad', 0, 2.7, 1.2), T('A', 0, 1.0, 1.2), T('As', 0, 0.2, 1.2), T('B', null, 0.1, 1.2)], kaynak: JERGER },
  { id: 'tb08', duzey: 'odyoloji', bicim: 'bulgu-egri', bulgu: 'C', grup: 'cocuk', yas: '5 yaş', secenek: [T('C', -280, 0.4, 0.7), T('A', -40, 0.5, 0.7), T('B', null, 0.1, 0.7), T('As', -20, 0.2, 0.7)], kaynak: MARGOLIS },
  { id: 'tb09', duzey: 'odyoloji', bicim: 'bulgu-egri', bulgu: 'B-buyuk', grup: 'cocuk', yas: '6 yaş', secenek: [T('B', null, 0.05, 1.5), T('B', null, 0.08, 0.7), T('B', null, 0.03, 0.2), T('Ad', 0, 2.1, 0.8)], kaynak: MARGOLIS },
  { id: 'tb10', duzey: 'odyoloji', bicim: 'bulgu-egri', bulgu: 'A', secenek: [T('A', -30, 1.0, 1.2), T('As', -30, 0.2, 1.2), T('Ad', -30, 2.3, 1.2), T('C', -140, 0.9, 1.2)], kaynak: JERGER },

  // ---- sayılar → Jerger tipi (odyoloji)
  st('tn01', T('A', -20, 0.9, 1.2)),
  st('tn02', T('C', -210, 0.6, 1.0)),
  st('tn03', T('B', null, 0.1, 1.1)),
  st('tn04', T('B', null, 0.1, 3.5)),
  st('tn05', T('B', null, 0.02, 0.3)),
  st('tn06', T('As', 10, 0.19, 1.0)),
  st('tn07', T('Ad', 0, 2.6, 1.3)),
  st('tn08', T('A', -80, 0.7, 1.1)),
  st('tn09', T('C', -140, 0.8, 0.9)),
  st('tn10', T('B', null, 0.1, 0.8), 'cocuk', '4 yaş'),
  st('tn11', T('B', null, 0.1, 1.5), 'cocuk', '7 yaş'),
  st('tn12', T('Ad', -30, 1.9, 1.0)),

  // ---- sağ / sol
  { id: 'ts01', duzey: 'genel', bicim: 'sag-sol', sor: 'B', sag: T('A', -10, 0.8, 1.1), sol: T('B', null, 0.1, 1.1), kaynak: JERGER },
  { id: 'ts02', duzey: 'genel', bicim: 'sag-sol', sor: 'B', sag: T('B', null, 0.1, 0.7), sol: T('B', null, 0.08, 0.6), grup: 'cocuk', yas: '4 yaş', kaynak: OME },
  { id: 'ts03', duzey: 'genel', bicim: 'sag-sol', sor: 'A', sag: T('C', -190, 0.6, 1.0), sol: T('A', 0, 0.9, 1.0), kaynak: JERGER },
  { id: 'ts04', duzey: 'genel', bicim: 'sag-sol', sor: 'C', sag: T('C', -200, 0.6, 1.2), sol: T('A', -10, 0.9, 1.2), kaynak: JERGER },
  { id: 'ts05', duzey: 'genel', bicim: 'sag-sol', sor: 'B', sag: T('A', 10, 1.0, 1.3), sol: T('C', -170, 0.7, 1.3), kaynak: JERGER },
  { id: 'ts06', duzey: 'odyoloji', bicim: 'sag-sol', sor: 'buyuk', sag: T('B', null, 0.1, 3.0), sol: T('B', null, 0.1, 1.1), kaynak: HUNTER },
  { id: 'ts07', duzey: 'odyoloji', bicim: 'sag-sol', sor: 'C', sag: T('A', -50, 0.8, 1.0), sol: T('A', 20, 1.1, 1.1), kaynak: JERGER },
  { id: 'ts08', duzey: 'odyoloji', bicim: 'sag-sol', sor: 'buyuk', sag: T('B', null, 0.05, 1.4), sol: T('B', null, 0.08, 0.7), grup: 'cocuk', yas: '6 yaş', kaynak: MARGOLIS },

  // ---- kısa vaka (otoskopi verildiğinde tanı düzeyinde cevap kullanılabilir)
  { id: 'tv01', duzey: 'genel', bicim: 'vinyet', grup: 'cocuk', yas: '4 yaş', otoskopi: 'efuzyon', sinif: 'B-normal', egri: T('B', null, 0.1, 0.6), kaynak: OME,
    hikaye: 'Ali iki haftadır, soğuk algınlığından beri televizyonun sesini açıyor. Otoskopide zar mat; arkasında sıvı seviyesi görülüyor.',
    secenek: ['Otoskopi ve düz eğri (normal hacim) birlikte orta kulakta sıvıyla uyumlu', 'Zarda delik var', 'Kanal kirle tıkalı', 'Kulak normal'],
    aciklama: 'Düz eğri tek başına sıvı demek değildir; burada otoskopide zarın arkasında sıvı görüldüğü ve kanal hacmi normal olduğu için tablo efüzyonla uyumludur. Çocukta çoğu kendiliğinden geçer; hekim izler.' },
  { id: 'tv02', duzey: 'genel', bicim: 'vinyet', grup: 'cocuk', yas: '7 yaş', sinif: 'B-buyuk', egri: T('B', null, 0.05, 1.5), kaynak: OME,
    hikaye: 'Elif’e altı ay önce ventilasyon tüpü takıldı; bugün kontrol ölçümü yapılıyor.',
    secenek: ['Tüp açık ve çalışıyor olabilir: büyük hacim beklenen bulgu', 'Tüp tıkanmış, kulak sıvıyla dolu', 'Kanal kirle tıkalı', 'Kulakta tüp yok, kulak normal'],
    aciklama: 'Açık bir tüp, kanal ile orta kulak boşluğunu birleştirir; ölçülen hacim yaşına göre büyük çıkar ve eğri düzdür. Tüp kontrolünde bu beklenen bir bulgudur; otoskopiyle tüp görülerek doğrulanır.' },
  { id: 'tv03', duzey: 'genel', bicim: 'vinyet', grup: 'yasli', yas: '68 yaş', otoskopi: 'serumen', sinif: 'B-kucuk', egri: T('B', null, 0.03, 0.3), kaynak: 'AAO-HNS (2017). Clinical Practice Guideline: Earwax (Cerumen Impaction) (Update)',
    hikaye: 'Kemal Bey bir kulağında dolgunluk hissediyor. Otoskopide kanal sarı-kahve kirle tamamen dolu.',
    secenek: ['Kanal kirle (serumen) tıkalı; ölçüm zara ulaşmıyor', 'Orta kulakta sıvı var', 'Zarda delik var', 'Östaki borusu çalışmıyor'],
    aciklama: 'Küçük hacim ve düz eğri, otoskopide görülen tıkaçla uyumludur. Temizlikten sonra ölçüm tekrarlanırsa gerçek orta kulak durumu görülür.' },
  { id: 'tv04', duzey: 'genel', bicim: 'vinyet', grup: 'yetiskin', yas: '25 yaş', otoskopi: 'icecekik', sinif: 'C', egri: T('C', -220, 0.6, 1.1), kaynak: JERGER,
    hikaye: 'Selin uçaktan indikten sonra kulağı tıkalı. Burnu da tıkalı. Otoskopide zar içe çekik görünüyor.',
    secenek: ['Orta kulak basıncı düşük; Östaki borusu basıncı dengeleyememiş olabilir', 'Zarda delik var', 'Kanal kirle tıkalı', 'Kemikçik zinciri kopmuş'],
    aciklama: 'Negatif tepe ve içe çekik zar, orta kulak basıncının dışarıya göre düşük kaldığını gösterir. Uçuş ve burun tıkanıklığı Östaki borusunun açılmasını zorlaştırabilir; çoğu zaman günler içinde düzelir.' },
  { id: 'tv05', duzey: 'genel', bicim: 'vinyet', grup: 'yetiskin', yas: '30 yaş', otoskopi: 'perforasyon', sinif: 'B-buyuk', egri: T('B', null, 0.05, 2.8), kaynak: HUNTER,
    hikaye: 'Murat kulağına sert bir tokat yedi; ağrı ve hafif kanama oldu. Otoskopide zarda yırtık görülüyor.',
    secenek: ['Zardaki açıklık yüzünden kanal ve orta kulak birlikte ölçülüyor (büyük hacim)', 'Orta kulakta sıvı var, zar sağlam', 'Kanal kirle tıkalı', 'Normal kulak'],
    aciklama: 'Zarda açıklık olunca prob kanalla birlikte orta kulak boşluğunu da ölçer; hacim büyük, eğri düz çıkar. Küçük travmatik delikler çoğu zaman kendiliğinden kapanır; hekim izler.' },
  { id: 'tv06', duzey: 'genel', bicim: 'vinyet', grup: 'cocuk', yas: '9 yaş', otoskopi: 'normal', sinif: 'B-kucuk', egri: T('B', null, 0.02, 0.2), kaynak: HUNTER,
    hikaye: 'Deniz ölçüm sırasında çok kıpırdadı. Eğri düz, kanal hacmi 0,2 ml çıktı. Otoskopide kanal temiz, zar normal.',
    secenek: ['Prob kanal duvarına dayanmış olabilir; prob yeniden yerleştirilip ölçüm tekrarlanmalı', 'Orta kulakta kesin sıvı var', 'Zarda delik var', 'Kulak normal, sonuç güvenilir'],
    aciklama: 'Kanal temizken küçük hacimli düz eğri çoğu zaman ölçüm hatasıdır: prob ucu kanal duvarına dayanınca ses zara ulaşmaz. Prob yeniden yerleştirilir ve ölçüm tekrarlanır.' },
  { id: 'tv07', duzey: 'odyoloji', bicim: 'vinyet', grup: 'yetiskin', yas: '34 yaş', otoskopi: 'normal', sinif: 'As', egri: T('As', 0, 0.18, 1.1), kaynak: KATZ,
    hikaye: 'Ayşe Hanım’ın işitmesi son doğumundan beri iki kulakta yavaşça azalıyor. Otoskopi normal; odyogramda iletim tipi kayıp ve kemik yolunda 2 kHz çentiği var.',
    secenek: ['Otosklerozla uyumlu (sert sistem + Carhart çentiği); kesin değerlendirme KBB’de', 'Orta kulakta sıvı', 'Kemikçik zinciri kopukluğu', 'Koklear kayıp, orta kulak normal'],
    aciklama: 'Normal otoskopi, iletim tipi kayıp, 2 kHz kemik yolu çentiği ve sığ eğri birlikte otosklerozu düşündürür. Otosklerozda timpanogram çoğu zaman normal A da olabilir; tek başına ayırt ettirmez.' },
  { id: 'tv08', duzey: 'odyoloji', bicim: 'vinyet', grup: 'yetiskin', yas: '22 yaş', otoskopi: 'normal', sinif: 'Ad', egri: T('Ad', -10, 2.8, 1.2), kaynak: KATZ,
    hikaye: 'Can bisiklet kazasında başını çarptı. Otoskopi normal; odyogramda yaklaşık 40 dB iletim tipi kayıp var.',
    secenek: ['Kemikçik zinciri kopukluğuyla uyumlu (aşırı hareketli sistem + iletim kaybı)', 'Otoskleroz', 'Orta kulakta sıvı', 'Zarda delik'],
    aciklama: 'Sağlam zar, çok yüksek tepe ve belirgin iletim kaybı birlikte zincir kopukluğunu düşündürür; akustik refleks de genellikle alınamaz. Kesin değerlendirme KBB ve görüntülemeyle yapılır.' },
  { id: 'tv09', duzey: 'odyoloji', bicim: 'vinyet', grup: 'cocuk', yas: '6 yaş', otoskopi: 'icecekik', sinif: 'C', egri: T('C', -260, 0.4, 0.6), kaynak: OME,
    hikaye: 'Ece’nin kulak ağrısı yok ama öğretmeni son haftalarda dikkatsiz olduğunu söylüyor. Otoskopide zar içe çekik; matlaşma ya da sıvı seviyesi yok.',
    secenek: ['Negatif orta kulak basıncı; Östaki işlevi yetersiz olabilir, izlem ve tekrar ölçüm uygun', 'Kesin orta kulak sıvısı; hemen tüp', 'Zarda delik', 'Kanal tıkalı'],
    aciklama: 'Negatif tepe ve içe çekik zar orta kulak basıncının düşük olduğunu gösterir. Çocuklarda sıktır; sürerse sıvı birikebileceği için izlem ve tekrar ölçüm yapılır.' },
  { id: 'tv10', duzey: 'odyoloji', bicim: 'vinyet', grup: 'yasli', yas: '72 yaş', otoskopi: 'plak', sinif: 'As', egri: T('As', -10, 0.2, 1.2), kaynak: KATZ,
    hikaye: 'Hüseyin Bey’in çocukken sık kulak iltihabı geçirdiği biliniyor. Otoskopide zarda beyaz, kireç benzeri plaklar var; hafif iletim kaybı.',
    secenek: ['Zardaki sertleşme (timpanoskleroz) sistemin hareketini azaltmış olabilir', 'Kemikçik zinciri kopukluğu', 'Orta kulakta sıvı', 'Zarda delik'],
    aciklama: 'Timpanoskleroz plakları zarı sertleştirebilir; admitans düşer ve sığ eğri görülebilir. Plaklar çoğu zaman işitmeyi az etkiler; odyogramla birlikte yorumlanır.' },
  { id: 'tv11', duzey: 'odyoloji', bicim: 'vinyet', grup: 'yetiskin', yas: '35 yaş', sinif: 'Ad', egri: T('Ad', 0, 2.2, 1.3), kaynak: HUNTER,
    hikaye: 'Mert’in zarında, eski bir delikten kalma ince ve saydam bir iyileşme alanı (atrofik skar) var. Odyogramı normal.',
    secenek: ['Gevşek zar bölümü yüksek admitans verebilir; zincir sağlam olabilir', 'Kemikçik zinciri kesin kopuk', 'Orta kulakta sıvı', 'Kanal tıkalı'],
    aciklama: 'İnce, gevşek bir zar bölümü tepeyi yükseltir. İşitme normalse zincir kopukluğu beklenmez; Ad eğrisi tek başına zincir kopukluğu demek değildir.' },
  { id: 'tv12', duzey: 'odyoloji', bicim: 'vinyet', grup: 'cocuk', yas: '5 yaş', sinif: 'B-normal', egri: T('B', null, 0.05, 0.6), kaynak: OME,
    hikaye: 'Ventilasyon tüpü takılı bir çocukta kontrol ölçümünde eğri düz, kanal hacmi 0,6 ml çıktı.',
    secenek: ['Tüp tıkanmış ya da yerinden çıkmış olabilir; otoskopiyle bakılmalı', 'Tüp açık ve çalışıyor', 'Zarda yeni bir delik var', 'Ölçüm normal, işlem gerekmez'],
    aciklama: 'Açık tüp yaşına göre büyük hacim verir. Hacmin normal kalması tüpün tıkandığını ya da çıktığını düşündürür; otoskopi ile tüpe bakılır.' },

  // ---- bilgi: ölçüm, prob tonu, yaşa göre normlar, akustik refleks
  { id: 'tk01', duzey: 'genel', bicim: 'bilgi', soru: 'Timpanometri neyi ölçer?', kaynak: KATZ,
    secenek: ['Kanal basıncı değişirken zarın ve orta kulağın ne kadar kolay hareket ettiğini', 'İşitme eşiğini (ne kadar kısık sesi duyduğunu)', 'Kokleadaki tüy hücrelerinin sesini', 'İşitme sinirinin hızını'],
    aciklama: 'Timpanometri orta kulak sisteminin hareketliliğini ölçer; işitme eşiğini ölçmez. İşitme eşiği saf ses odyometrisiyle bulunur.' },
  { id: 'tk02', duzey: 'genel', bicim: 'bilgi', soru: 'Timpanometri sırasında kişiden ne beklenir?', kaynak: KATZ,
    secenek: ['Sessizce durması; yanıt vermesi gerekmez', 'Sesi duyunca düğmeye basması', 'Duyduğu kelimeleri tekrar etmesi', 'Yüksek sesle sayı sayması'],
    aciklama: 'Ölçüm nesneldir: kişinin yanıt vermesi gerekmez. Konuşmak, yutkunmak ve kıpırdamak ölçümü bozabildiği için sessiz durması istenir.' },
  { id: 'tk03', duzey: 'genel', bicim: 'bilgi', soru: 'Düz (Tip B) bir eğri tek başına neyi söyler?', kaynak: JERGER,
    secenek: ['Zarın basınçla hareket etmediğini; nedenini kanal hacmi ve otoskopi ayırt eder', 'Kesinlikle orta kulakta sıvı olduğunu', 'İşitme kaybının derecesini', 'Kulağın tamamen sağlıklı olduğunu'],
    aciklama: 'Düz eğri bir bulgudur, tanı değildir: sıvı, delik, tüp, kir tıkacı ya da duvara dayanmış prob benzer eğri verebilir. Kanal hacmi ve otoskopi nedenini ayırt ettirir.' },
  { id: 'tk04', duzey: 'genel', bicim: 'bilgi', soru: 'Ventilasyon tüpü açık ve çalışıyorsa timpanogram nasıl görünür?', kaynak: OME,
    secenek: ['Düz eğri, kanal hacmi büyük', 'Normal tepeli eğri', 'Düz eğri, kanal hacmi küçük', 'Negatif basınçta tepe'],
    aciklama: 'Açık tüp kanalı orta kulağa bağlar; ölçülen hacim büyür ve basınç oluşturulamadığı için eğri düz çıkar.' },
  { id: 'tk05', duzey: 'genel', bicim: 'bilgi', soru: 'Ölçümde prob ucu kanal duvarına dayanırsa ne görülebilir?', kaynak: HUNTER,
    secenek: ['Düz eğri ve yapay olarak küçük kanal hacmi', 'Çok yüksek tepe', 'Negatif basınçta tepe', 'Büyük kanal hacmi'],
    aciklama: 'Duvara dayanan prob sesi zara ulaştıramaz; eğri düz, hacim küçük görünür. Prob yeniden yerleştirilip ölçüm tekrarlanır.' },
  { id: 'tk06', duzey: 'genel', bicim: 'bilgi', soru: 'Kanal çok ağrılı ve şişmişse (dış kulak iltihabı) timpanometri için doğru yaklaşım hangisi?', kaynak: KATZ,
    secenek: ['Genellikle ertelenir; prob ağrıtır ve kanal kapalı olabilir', 'Prob daha sıkı bastırılarak ölçülür', 'Sonuç her zaman normal çıkar, gerek yok', 'Ağrı ölçümün doğru olduğunu gösterir'],
    aciklama: 'Ödemli, ağrılı kanalda prob takmak ağrı verir ve ölçüm güvenilir olmaz; tedaviden sonra ölçülür.' },
  { id: 'tk07', duzey: 'genel', bicim: 'bilgi', soru: 'Akustik refleks nedir?', kaynak: KATZ,
    secenek: ['Yüksek seste orta kulaktaki küçük kasın (stapedius) kasılması', 'Yüksek seste gözün kırpılması', 'Zarın yüksek seste yırtılması', 'Kokleanın kendi sesini üretmesi'],
    aciklama: 'Yüksek bir ses iki taraflı olarak stapedius kasını kastırır; kule cihazı bu kasılmayı admitanstaki küçük düşüş olarak kaydeder.' },
  { id: 'tk08', duzey: 'genel', bicim: 'bilgi', soru: 'Burnu tıkalıyken uçakla iniş sırasında kulak tıkandı. Timpanogramda ne beklenebilir?', kaynak: JERGER,
    secenek: ['Tepe negatif basınca kayabilir (Tip C)', 'Tepe çok yükselir (Tip Ad)', 'Kanal hacmi büyür', 'Eğri hiç değişmez'],
    aciklama: 'Östaki borusu basıncı dengeleyemezse orta kulak basıncı düşük kalır; tepe negatif basınca kayar.' },
  { id: 'tk09', duzey: 'odyoloji', bicim: 'bilgi', soru: '6 aydan küçük bebekte orta kulak değerlendirmesi için önerilen prob tonu hangisi?', kaynak: JCIH,
    secenek: ['1000 Hz', '226 Hz', '678 Hz', '4000 Hz'],
    aciklama: 'Yenidoğanda 226 Hz ile ölçülen eğri yanıltıcı olabilir; JCIH ve ASHA yaklaşık 6 aydan küçüklerde 1000 Hz prob tonunu önerir.' },
  { id: 'tk10', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Yenidoğanda 226 Hz ile alınan tepeli eğri neden yanıltıcı olabilir?', kaynak: HUNTER,
    secenek: ['Yumuşak kanal duvarı hareket eder; efüzyon olsa bile tepe görülebilir', 'Bebekte zar hiç hareket etmez', 'Bebekte kanal hacmi yetişkinden büyüktür', '226 Hz bebekte duyulmaz'],
    aciklama: 'Bebeğin kanal duvarı henüz kemikleşmemiştir ve basınçla hareket eder; bu hareket orta kulakta sıvı olsa bile tepe gibi görünebilir.' },
  { id: 'tk11', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Yetişkinde 226 Hz ile eşdeğer kanal hacmi için yaklaşık normal aralık hangisi?', kaynak: ASHA,
    secenek: ['0,6–1,5 ml', '0,1–0,4 ml', '2,5–4,0 ml', '5–8 ml'],
    aciklama: 'Yetişkinde eşdeğer kanal hacmi yaklaşık 0,6–1,5 ml’dir; düz eğriyle birlikte belirgin büyük hacim (yaklaşık 2 ml üstü) açıklık ya da açık tüpü düşündürür.' },
  { id: 'tk12', duzey: 'odyoloji', bicim: 'bilgi', soru: '3–5 yaş çocukta eşdeğer kanal hacmi için yaklaşık normal aralık hangisi?', kaynak: MARGOLIS,
    secenek: ['0,3–0,9 ml', '1,5–2,5 ml', '0,05–0,1 ml', '3–5 ml'],
    aciklama: 'Çocuğun kanalı küçüktür; yaklaşık 0,3–0,9 ml normaldir. Bu yüzden çocukta yaklaşık 1 ml’nin üstü düz eğriyle birlikte büyük hacim sayılabilir.' },
  { id: 'tk13', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Statik admitans neyi ifade eder?', kaynak: HUNTER,
    secenek: ['Tepe ile kanal (taban) değeri arasındaki fark: orta kulak sisteminin hareketliliği', 'Kanalın uzunluğunu', 'Tepenin hangi basınçta olduğunu', 'Kokleanın duyarlılığını'],
    aciklama: 'Statik admitans, tepe değerinden kanal katkısı çıkarılarak bulunur ve orta kulak sisteminin ne kadar kolay hareket ettiğini gösterir.' },
  { id: 'tk14', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Yaygın kullanımda Tip C için tepe basıncı ölçütü hangisi?', kaynak: JERGER,
    secenek: ['Yaklaşık −100 daPa’dan daha negatif', '+50 daPa’dan daha pozitif', 'Tam 0 daPa', '−20 daPa’dan daha negatif'],
    aciklama: 'Jerger sınıflamasında yaklaşık −100 daPa’dan daha negatif tepe Tip C sayılır; bazı merkezler −150 daPa gibi farklı sınır kullanır.' },
  { id: 'tk15', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Düz eğri ve normal kanal hacmi olan kulakta akustik refleks genellikle nasıldır?', kaynak: KATZ,
    secenek: ['Kaydedilemez (alınamaz)', 'Normal eşikte alınır', 'Daha düşük eşikte alınır', 'Yalnız tiz seslerde alınır'],
    aciklama: 'Orta kulak sistemi hareket etmediğinde kasılmanın oluşturduğu küçük admitans değişimi ölçülemez; ölçüm kulağında refleks alınamaz.' },
  { id: 'tk16', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Akustik refleks yayında insanlarda asıl kasılan kas hangisi?', kaynak: KATZ,
    secenek: ['Stapedius', 'Tensor timpani tek başına', 'Masseter', 'Orbicularis oculi'],
    aciklama: 'İnsanda akustik refleks asıl olarak stapedius kasının kasılmasıdır; uyarı tek kulaktan verilse de iki tarafta oluşur.' },
  { id: 'tk17', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Normal işiten yetişkinde saf ses için akustik refleks eşikleri yaklaşık hangi aralıktadır?', kaynak: KATZ,
    secenek: ['70–100 dB HL', '0–20 dB HL', '30–50 dB HL', '120–140 dB HL'],
    aciklama: 'Normal işitmede refleks eşikleri saf seste yaklaşık 70–100 dB HL’dir; iletim kaybında ölçüm kulağında alınamayabilir, koklear kayıpta eşik ile refleks arası daralabilir.' },
  { id: 'tk18', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Zar sağlamken kemikçik zinciri kopukluğunda en olası timpanogram hangisi?', kaynak: JERGER,
    secenek: ['Normal basınçta çok yüksek tepe (Tip Ad)', 'Düz eğri, büyük hacim', 'Negatif basınçta tepe (Tip C)', 'Düz eğri, küçük hacim'],
    aciklama: 'Zincir kopunca zar daha az yükle hareket eder ve admitans çok yükselir. İletim kaybı ve alınamayan refleksle birlikte kopukluğu düşündürür.' },
  { id: 'tk19', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Otosklerozda timpanogram için en doğru ifade hangisi?', kaynak: KATZ,
    secenek: ['Çoğu zaman normal basınçta alçak tepe (As) ya da normal A görülür', 'Her zaman düz eğri görülür', 'Her zaman negatif basınçta tepe görülür', 'Kanal hacmi her zaman büyüktür'],
    aciklama: 'Stapes fiksasyonu sistemi sertleştirebilir ama birçok hastada eğri normal A’dır. Tanıda odyogram, refleks ve KBB değerlendirmesi birlikte kullanılır.' },
  { id: 'tk20', duzey: 'odyoloji', bicim: 'bilgi', soru: 'Bir kulakta düz eğri ve 3,2 ml hacim, öteki kulakta 1,1 ml hacimle normal eğri var. Ölçüm sonrası ilk adım hangisi?', kaynak: HUNTER,
    secenek: ['Otoskopiyle zarda açıklık ya da tüp aranır', 'Hacim farkı önemsizdir, rapora yazılmaz', 'Ölçüm 1000 Hz ile tekrarlanır, otoskopi gerekmez', 'Tanı kesin efüzyondur'],
    aciklama: 'Tek kulakta belirgin büyük hacim açıklık ya da açık tüp olasılığını gösterir; otoskopiyle doğrulanır ve sonuç hekimle paylaşılır.' },
];

export const timpSoruById = (id: string): TimpSoruDef | undefined => TIMP_SORULAR.find((s) => s.id === id);
/** düzeyin havuzu: genel oyuncuya genel sorular; odyoloji (öğrenci) düzeyine hepsi */
export function timpanoHavuzu(duzey: BilgiDuzeyi): string[] {
  return TIMP_SORULAR.filter((s) => duzey === 'odyoloji' || s.duzey === 'genel').map((s) => s.id);
}

// ---------------------------------------------------------------- tur kurma (istemci ve sunucu aynı sonucu üretir)

/** ekranda bir seçenek: metin ya da küçük eğri; anahtar test/izleme içindir */
export interface TimpSecenek { anahtar: string; metin?: string; teknik?: string; egri?: Timp }
export interface TimpanoBulmaca {
  id: string; bicim: TimpBicim; soru: string; grup: YasGrubu; yas?: string;
  /** tek eğri (eğri→bulgu, vinyet); sayi-tip'te eğri çizilmez, değerleri yazılır */
  egri?: Timp; sag?: Timp; sol?: Timp; otoskopi?: Otoskopi; hikaye?: string; sayilar?: boolean;
  /** bulgu → eğri sorusunda aranan bulgu */
  bulgu?: EgriTur;
  secenek: TimpSecenek[]; dogru: number; aciklama: string; kaynak: string;
}
function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function karistir<T>(xs: readonly T[], r: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const n1 = (v: number) => v.toLocaleString('tr-TR');
const sayiMetni = (t: Timp) => `${t.basinc === null ? 'tepe yok' : `tepe ${t.basinc} daPa`} · admitans ${n1(t.uyum)} ml · kanal hacmi ${n1(t.hacim)} ml`;
function sagSolDogru(sor: SagSolSoru, sag: Timp, sol: Timp, grup: YasGrubu): number {
  const ok = (t: Timp) => sor === 'B' ? t.tip === 'B' : sor === 'A' ? t.tip === 'A' : sor === 'C' ? t.tip === 'C' : egriSinifi(t, grup) === 'B-buyuk';
  const r = ok(sag), l = ok(sol);
  return r && l ? 2 : r ? 0 : l ? 1 : 3;
}
const egriSec = (e: EgriTur): TimpSecenek => ({ anahtar: e, metin: EGRI_ADI[e].sade, teknik: EGRI_ADI[e].teknik });

/** tek bir sorunun ekran hâli; seçenek sırası tur tohumu ve soru kimliğiyle karışır */
export function timpBulmaca(def: TimpSoruDef, seed: number): TimpanoBulmaca {
  const r = rng((seed ^ hash(def.id)) >>> 0);
  const grup = def.grup ?? 'yetiskin';
  const base = { id: def.id, bicim: def.bicim, grup, yas: def.yas, kaynak: def.kaynak };
  const mix = (opts: TimpSecenek[], dogru = 0) => { const idx = karistir(opts.map((_, i) => i), r); return { secenek: idx.map((i) => opts[i]!), dogru: idx.indexOf(dogru) }; };
  switch (def.bicim) {
    case 'egri-bulgu': {
      const s = egriSinifi(def.egri, grup);
      return { ...base, soru: 'Bu eğri ne gösteriyor?', egri: def.egri, ...mix(def.secenek.map(egriSec)), aciklama: EGRI_ACIKLAMA[s] };
    }
    case 'sayi-tip': {
      const s = egriSinifi(def.egri, grup);
      return { ...base, soru: 'Bu değerler hangi Jerger tipine uyar?', egri: def.egri, sayilar: true, ...mix(def.secenek.map((e) => ({ anahtar: e, metin: EGRI_ADI[e].teknik }))), aciklama: `${sayiMetni(def.egri)}. ${EGRI_ACIKLAMA[s]}` };
    }
    case 'bulgu-egri':
      return { ...base, soru: 'Bu bulguyu gösteren eğri hangisi?', bulgu: def.bulgu, ...mix(def.secenek.map((t, i) => ({ anahtar: `e${i}`, egri: t }))), aciklama: EGRI_ACIKLAMA[def.bulgu] };
    case 'vinyet':
      return { ...base, soru: 'Hangi açıklama en uygun?', hikaye: def.hikaye, egri: def.egri, otoskopi: def.otoskopi, ...mix(def.secenek.map((m, i) => ({ anahtar: `v${i}`, metin: m }))), aciklama: def.aciklama };
    case 'sag-sol': {
      const d = sagSolDogru(def.sor, def.sag, def.sol, grup);
      // sağ/sol/ikisi/hiçbiri sırası sabit kalır (okunurluk)
      return { ...base, soru: SAG_SOL_SORU[def.sor], sag: def.sag, sol: def.sol, secenek: SAG_SOL_SECENEK.map((m, i) => ({ anahtar: `k${i}`, metin: m })), dogru: d, aciklama: `Sağ: ${EGRI_ADI[egriSinifi(def.sag, grup)].sade}. Sol: ${EGRI_ADI[egriSinifi(def.sol, grup)].sade}.` };
    }
    case 'bilgi':
      return { ...base, soru: def.soru, ...mix(def.secenek.map((m, i) => ({ anahtar: `b${i}`, metin: m }))), aciklama: def.aciklama };
  }
}
/** kişisel deste yoksa (eski tur ya da test): tohumdan havuzdan n farklı soru */
export function timpanoSecimi(seed: number, duzey: BilgiDuzeyi, n: number): string[] {
  return karistir(timpanoHavuzu(duzey), rng(seed)).slice(0, n);
}
/** sunucu destesi: havuz karıştırılır; son görülenler yeni destenin sonuna konur (destenin başında tekrar gelmesin) */
export function timpanoDestesi(duzey: BilgiDuzeyi, seed: number, sonGorulen: readonly string[] = []): string[] {
  const d = karistir(timpanoHavuzu(duzey), rng(seed));
  const son = new Set(sonGorulen);
  return [...d.filter((x) => !son.has(x)), ...d.filter((x) => son.has(x))];
}

/** içerik denetimi: hata metinleri (testlerde boş olmalı) */
export function timpSoruHatalari(): string[] {
  const out: string[] = []; const ids = new Set<string>();
  const curve = (id: string, t: Timp, g: YasGrubu) => { const e = timpHatasi(t, g); if (e) out.push(`${id}: ${e} ${JSON.stringify(t)}`); };
  for (const s of TIMP_SORULAR) {
    if (ids.has(s.id)) out.push(`${s.id}: kimlik tekrar`); ids.add(s.id);
    const g = s.grup ?? 'yetiskin';
    if (g === 'bebek') out.push(`${s.id}: bebekte 226 Hz eğrisi soru olarak kullanılmaz`);
    switch (s.bicim) {
      case 'egri-bulgu': case 'sayi-tip': {
        curve(s.id, s.egri, g);
        if (s.secenek[0] !== egriSinifi(s.egri, g)) out.push(`${s.id}: cevap değerlere uymuyor`);
        if (new Set(s.secenek).size !== s.secenek.length || s.secenek.length < 3) out.push(`${s.id}: seçenekler`);
        break;
      }
      case 'bulgu-egri': {
        s.secenek.forEach((t) => curve(s.id, t, g));
        const cls = s.secenek.map((t) => egriSinifi(t, g));
        if (cls[0] !== s.bulgu) out.push(`${s.id}: doğru eğri bulguya uymuyor`);
        if (cls.slice(1).includes(s.bulgu)) out.push(`${s.id}: yanıltıcı eğri de bulguya uyuyor`);
        break;
      }
      case 'vinyet': {
        curve(s.id, s.egri, g);
        if (egriSinifi(s.egri, g) !== s.sinif) out.push(`${s.id}: eğri sınıfı ${egriSinifi(s.egri, g)} ≠ ${s.sinif}`);
        if (new Set(s.secenek).size !== s.secenek.length) out.push(`${s.id}: seçenek tekrar`);
        break;
      }
      case 'sag-sol': curve(s.id, s.sag, g); curve(s.id, s.sol, g); break;
      case 'bilgi': if (new Set(s.secenek).size !== s.secenek.length) out.push(`${s.id}: seçenek tekrar`); break;
    }
  }
  return out;
}
