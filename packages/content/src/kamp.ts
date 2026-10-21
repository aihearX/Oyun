import type { BiomeId, BuildingId } from '@odi/shared';
import type { GlossaryTerm } from './odyoloji';
import { REMEDIES } from './remedies';

/**
 * Kulak Kampı içeriği (docs/14-kamp.md): binaların odyolojik işlevi (sade + "Daha fazla" teknik satır), seviye açılımları
 * (kozmetik, Kulak Sözlüğü terimi, çanta yeri, Tedavi Odası tarifi) ve bölge anıtları.
 * Bina kimlikleri kalıcıdır; adlar @odi/shared BUILDINGS içindedir. Kaynaklar docs/odyoloji-icerik.md "Kulak Kampı" bölümünde.
 */

const K = 'Katz, Handbook of Clinical Audiology';
const G = 'Gelfand, Essentials of Audiology';
const E = 'standart KBB kitapları (Cummings Otolaryngology; Scott-Brown’s Otorhinolaryngology)';

export interface BuildingInfo {
  /** gerçek hayattaki karşılığı, tek cümle */
  plain: string;
  /** "Daha fazla": ne ölçer / ne yapar (öğrenci düzeyi) */
  tech: string;
  src: string;
}
export const BUILDING_INFO: Record<BuildingId, BuildingInfo> = {
  merkez: {
    plain: 'Odyoloji; işitme ve dengenin değerlendirilmesi, rehabilitasyonu ve korunmasıyla ilgilenir. Merkez, diğer bütün odaları yönetir.',
    tech: 'Tek bir test tanı koydurmaz: öykü, otoskopi, saf ses ve konuşma odyometrisi, timpanometri, akustik refleks, OAE ve gerekirse ABR bir test bataryası olarak birlikte yorumlanır (çapraz kontrol ilkesi, Jerger ve Hayes, 1976).',
    src: `${K}, giriş ve test bataryası bölümleri` },
  laboratuvar: {
    plain: 'Odyometri odasında ses geçirmez kabinde, her frekansta duyabildiğin en hafif ses ölçülür.',
    tech: 'Saf ses odyometrisinde 250–8000 Hz arasında hava yolu (kulaklık) ve kemik yolu (kemik vibratörü) eşikleri dB HL olarak bulunur; ikisi arasındaki fark (hava–kemik aralığı) iletim tipi kaybı düşündürür. Konuşma odyometrisi (SRT, konuşmayı ayırt etme) testi tamamlar.',
    src: `${K}, saf ses ve konuşma odyometrisi` },
  atolye: {
    plain: 'İşitme cihazları burada ayarlanır: ses, her frekansta kaybın derecesine göre güçlendirilir.',
    tech: 'Cihaz kazancı odyograma göre bir uyum reçetesiyle (NAL-NL2, DSL v5) hesaplanır, gerçek kulak ölçümüyle (REM) doğrulanır. Kulak kalıbı ve havalandırma deliği (vent) sesi ve geri beslemeyi etkiler; düzenli ayar ve danışmanlık başarının parçasıdır.',
    src: `${K}, işitme cihazı seçimi ve uygulaması` },
  depo: {
    plain: 'Kulak kiri (serumen) kanalı korur ve kendiliğinden birikip kendiliğinden dışarı taşınır; depo da jetonu kendiliğinden biriktirir.',
    tech: 'Serumen, kanalın dış kıkırdak bölümündeki seruminöz ve yağ bezlerinin salgısı ile dökülen epitelden oluşur. Kanal derisi zarın merkezinden dışa doğru göç ederek (epitel göçü) kiri dışarı taşır; bu yüzden kulak çoğu zaman kendini temizler.',
    src: `${K}, dış kulak ve otoskopi; ${E}` },
  kule: {
    plain: 'Timpanometri, kanaldaki basıncı değiştirip kulak zarının ne kadar rahat hareket ettiğini ölçer.',
    tech: 'Prob, 226 Hz’lik bir ton verirken kanal basıncını yaklaşık +200 ile −400 daPa arasında değiştirir; admitansın basınçla değişimi timpanogramı çizer. Tip A normal, Tip B düz (sıvı ya da delik; kanal hacmine bakılır), Tip C negatif basınç (Östaki borusu yetersizliği). Aynı cihazla akustik refleks de ölçülür.',
    src: `${K}, timpanometri ve akustik refleks` },
  revir: {
    plain: 'Klinikte sorunu erken fark etmek, onu kolay atlatmanın ilk adımıdır.',
    tech: 'Klinik değerlendirme otoskopi ve öyküyle başlar; tarama programları (yenidoğanda OAE/otomatik ABR, okul taramaları) kaybı erken yakalar. İşitme kaybının derecesi saf ses ortalamasına göre sınıflanır (ör. 26–40 dB HL hafif, 41–55 orta, 56–70 orta-ileri, 71–90 ileri, 90 üstü çok ileri).',
    src: `${K}, tarama ve klinik değerlendirme` },
  tedavi: {
    plain: 'Koruma ve tedavi yöntemlerini öğrendiğin oda: kulak tıkacından koklear implanta kadar.',
    tech: 'Tedavi; sorunun yerine göre seçilir: dış ve orta kulak sorunları çoğu zaman tıbbi ya da cerrahi yolla düzelir (iletim tipi), iç kulak ve sinir kaynaklı kayıplar ise cihaz, implant ve işitsel rehabilitasyonla desteklenir (sensörinöral). Kararı hekim ve odyolog birlikte verir.',
    src: `${E}; ${G}` },
};

// ---------------------------------------------------------------- Kulak Sözlüğü: kampta açılan terimler

export interface CampTerm extends GlossaryTerm { building: BuildingId; level: number }
/** kampta bina seviyesiyle açılan sözlük terimleri (bölge yerine bina; region yalnız çizim için) */
export const CAMP_TERMS: CampTerm[] = [
  { id: 'test-bataryasi', term: 'Odyolojik test bataryası', region: 'dis-kulak', art: 'signal', building: 'merkez', level: 4,
    plain: 'İşitmeyi tek bir testle değil, birbirini doğrulayan birkaç testle değerlendirmek.',
    tech: 'Çapraz kontrol ilkesi (Jerger ve Hayes, 1976): bir testin sonucu başka bir bağımsız testle doğrulanır. Örneğin davranışsal odyogram, timpanometri ve akustik refleks ya da OAE ile birlikte yorumlanır; özellikle küçük çocuklarda tek test yanıltıcı olabilir.',
    src: `${K}, test bataryası yaklaşımı` },
  { id: 'saf-ses-odyometrisi', term: 'Saf ses odyometrisi', region: 'dis-kulak', art: 'signal', building: 'laboratuvar', level: 2,
    plain: 'Farklı frekanslardaki saf tonlarla her kulağın duyabildiği en hafif sesi bulan test.',
    tech: 'Eşik, genellikle “yanıt varsa 10 dB in, yoksa 5 dB çık” kuralıyla (değiştirilmiş Hughson–Westlake yöntemi), sunumların yaklaşık yarısında yanıt alınan en düşük düzey olarak belirlenir; 250–8000 Hz arasında oktav aralıklarıyla test edilir.',
    src: `${K}, saf ses odyometrisi` },
  { id: 'hava-kemik-yolu', term: 'Hava yolu ve kemik yolu', region: 'kanal', art: 'wave', building: 'laboratuvar', level: 5,
    plain: 'Ses kulaklıktan kanal yoluyla (hava yolu) ya da kafatası titreşimiyle doğrudan iç kulağa (kemik yolu) verilebilir.',
    tech: 'Kemik yolu dış ve orta kulağı büyük ölçüde atlar. Hava yolu eşiği kötü, kemik yolu normalse (hava–kemik aralığı yaklaşık 10 dB’den büyük) iletim tipi; ikisi birlikte düşükse sensörinöral; ikisi de düşük ve aralık varsa mikst kayıp düşünülür.',
    src: `${K}, saf ses odyometrisi; ${G}` },
  { id: 'konusma-odyometrisi', term: 'Konuşma odyometrisi (SRT, ayırt etme)', region: 'korteks', art: 'chat', building: 'laboratuvar', level: 9,
    plain: 'Kelimelerle yapılan test: ne kadar hafif konuşmayı duyduğun ve kelimeleri ne kadar doğru anladığın ölçülür.',
    tech: 'Konuşmayı alma eşiği (SRT), iki heceli kelimelerin yarısının doğru tekrarlandığı düzeydir ve saf ses ortalamasıyla uyumlu olmalıdır. Konuşmayı ayırt etme skoru, rahat dinleme düzeyinde tek heceli kelime listesiyle yüzde olarak verilir.',
    src: `${K}, konuşma odyometrisi` },
  { id: 'kulak-kalibi', term: 'Kulak kalıbı', region: 'kanal', art: 'ear', building: 'atolye', level: 3,
    plain: 'Kişinin kulağına göre üretilen, cihazın sesini kanala taşıyan yumuşak parça.',
    tech: 'Kalıp, kulak ölçüsünden üretilir; malzemesi, kanal uzunluğu ve havalandırma deliği (vent) alçak frekans kazancını, tıkanma etkisini (oklüzyon) ve akustik geri beslemeyi (ıslık) etkiler.',
    src: `${K}, kulak kalıpları ve akustik` },
  { id: 'uyum-recetesi', term: 'Uyum reçetesi (NAL-NL2, DSL)', region: 'koklea-3', art: 'signal', building: 'atolye', level: 7,
    plain: 'İşitme cihazının her frekansta ne kadar güçlendireceğini odyogramdan hesaplayan kural.',
    tech: 'NAL-NL2 konuşmanın anlaşılırlığını en çoğa çıkarırken toplam ses yüksekliğini rahat tutmayı, DSL v5 ise (özellikle çocuklarda) konuşmayı duyulabilir aralığa yerleştirmeyi hedefler. Hedefler gerçek kulak ölçümüyle (REM) doğrulanır.',
    src: `${K}, işitme cihazı uygulaması` },
  { id: 'epitel-gocu', term: 'Epitel göçü', region: 'kanal', art: 'wind', building: 'depo', level: 3,
    plain: 'Kulak kanalının derisi içten dışa doğru yavaşça kayarak kiri dışarı taşır.',
    tech: 'Kanal epiteli zarın umbo bölgesinden dışa doğru günde yaklaşık 0,05–0,1 mm hızla göç eder; bu “taşıyıcı bant” serumeni ve dökülen hücreleri dışarı çıkarır. Pamuklu çubuk bu düzeni bozabilir.',
    src: `${E}, dış kulak fizyolojisi` },
  { id: 'timpanogram-tipleri', term: 'Timpanogram tipleri (A, B, C)', region: 'zar', art: 'signal', building: 'kule', level: 2,
    plain: 'Timpanometri sonucu çizilen eğrinin biçimi: tepeli (normal), düz ya da sola kaymış.',
    tech: 'Jerger sınıflaması: Tip A normal basınçta tepe; As sığ (ör. otoskleroz), Ad çok yüksek (ör. zincir kopukluğu ya da gevşek zar); Tip B düz (sıvı, tıkaç ya da delik; kanal hacmine bakılır); Tip C belirgin negatif basınçta tepe (Östaki borusu yetersizliği).',
    src: `${K}, timpanometri` },
  { id: 'kanal-hacmi', term: 'Eşdeğer kulak kanalı hacmi', region: 'zar', art: 'target', building: 'kule', level: 6,
    plain: 'Timpanometrede prob ile zar arasındaki havanın hacmi; deliği ya da açık bir tüpü gösterebilir.',
    tech: 'Yetişkinde yaklaşık 0,6–1,5 ml, çocukta daha küçüktür. Düz bir timpanogramla birlikte büyük hacim zarın delik olduğunu ya da ventilasyon tüpünün açık olduğunu; küçük hacim ise kanalın kir ya da prob temasıyla tıkandığını düşündürür.',
    src: `${K}, timpanometri` },
  { id: 'otoskopi', term: 'Otoskopi', region: 'kanal', art: 'search', building: 'revir', level: 2,
    plain: 'Işıklı bir aletle kulak kanalına ve kulak zarına bakmak.',
    tech: 'Kanal, kepçe yukarı-geri çekilerek düzleştirilir (yetişkinde). Sağlıklı zar inci grisi, yarı saydamdır; ön-alt kadranda ışık refleksi (ışık üçgeni) görülür. Kir, iltihap, delik, sıvı ve retraksiyon değerlendirilir.',
    src: `${K}, otoskopi` },
  { id: 'kayip-derecesi', term: 'İşitme kaybı dereceleri', region: 'sinir', art: 'signal', building: 'revir', level: 6,
    plain: 'Saf ses ortalamasına göre işitme kaybının hafif, orta, ileri gibi adlandırılması.',
    tech: 'Yaygın bir sınıflama (Clark, 1981; ASHA): −10–15 normal, 16–25 çok hafif, 26–40 hafif, 41–55 orta, 56–70 orta-ileri, 71–90 ileri, 91 dB HL üstü çok ileri. Ortalama genellikle 500, 1000, 2000 (ve 4000) Hz eşiklerinden hesaplanır; sınıflamalar arasında küçük farklar vardır.',
    src: `${K}, odyogramın yorumu` },
  { id: 'isitme-koruma', term: 'İşitme koruyucu ve gürültü sınırı', region: 'kanal', art: 'shield', building: 'tedavi', level: 2,
    plain: 'Yüksek seste kulak tıkacı ya da kulaklık tipi koruyucu takmak kalıcı hasarı önler.',
    tech: 'İş yerinde sık kullanılan bir ölçüt 8 saat için 85 dBA’dır; ses düzeyi her 3 dB arttığında güvenli süre yarıya iner (eşit enerji kuralı). Koruyucunun etiketindeki azaltma (NRR/SNR) gerçek kullanımda genellikle daha düşük olur.',
    src: `${K}, gürültü ve işitme koruma` },
  { id: 'timpanostomi', term: 'Timpanostomi (ventilasyon tüpü)', region: 'zar', art: 'wind', building: 'tedavi', level: 5,
    plain: 'Kulak zarına konan küçük tüple orta kulağın havalandırılması.',
    tech: 'Uzun süren orta kulak sıvısı (OME) ya da sık tekrarlayan akut otitte uygulanabilir; tüp Östaki borusunun yerine basıncı eşitler. Tüplü kulakta timpanogram düz, eşdeğer kanal hacmi büyüktür (tüp açık).',
    src: `${E}, otitis media` },
  { id: 'stapedotomi', term: 'Stapedotomi', region: 'kemikcikler', art: 'bolt', building: 'tedavi', level: 8,
    plain: 'Otosklerozda sertleşen üzengi tabanına küçük bir delik açılıp piston protez yerleştirilmesi.',
    tech: 'Örse asılan ince piston, titreşimi oval pencereden iç kulak sıvısına iletir; amaç hava–kemik aralığını kapatmaktır. Ameliyat öncesi odyogramda iletim tipi kayıp ve sıklıkla Carhart çentiği, timpanometride As tipi eğri ve akustik refleks yokluğu görülebilir.',
    src: `${E}, otoskleroz cerrahisi; ${K}` },
];

// ---------------------------------------------------------------- Odi kozmetikleri (kampta açılır; tanımları cosmetics.ts'te)

/** kozmetik kimliği → açan bina seviyesi (cosmetics.ts'teki unlock ile aynı; testler eşitliği denetler) */
export const CAMP_COSMETICS: { id: string; building: BuildingId; level: number }[] = [
  { id: 'renk-sol-kulak', building: 'laboratuvar', level: 3 },
  { id: 'kostum-koruyucu', building: 'tedavi', level: 3 },
  { id: 'renk-klinik', building: 'revir', level: 4 },
  { id: 'renk-tip-a', building: 'kule', level: 5 },
  { id: 'renk-sag-kulak', building: 'laboratuvar', level: 6 },
  { id: 'kostum-diyapazon', building: 'merkez', level: 8 },
  { id: 'kostum-implant', building: 'atolye', level: 9 },
];

// ---------------------------------------------------------------- açılım tablosu (bina paneli "Sv N açar" satırı)

export type CampUnlock =
  | { kind: 'kozmetik'; id: string }
  | { kind: 'terim'; id: string }
  | { kind: 'tarif'; id: string }
  | { kind: 'canta' };
/** bina seviyesine göre açılanlar (kozmetik, sözlük terimi, Tedavi Odası tarifi, çanta yeri) */
export function campUnlocksAt(building: BuildingId, level: number): CampUnlock[] {
  const out: CampUnlock[] = [];
  for (const c of CAMP_COSMETICS) if (c.building === building && c.level === level) out.push({ kind: 'kozmetik', id: c.id });
  for (const t of CAMP_TERMS) if (t.building === building && t.level === level) out.push({ kind: 'terim', id: t.id });
  if (building === 'tedavi') for (const r of REMEDIES) if (r.level === level) out.push({ kind: 'tarif', id: r.id });
  if ((building === 'tedavi' && level === 6) || (building === 'merkez' && level === 12)) out.push({ kind: 'canta' });
  return out;
}
/** bu binada şimdiki seviyeden sonra gelen ilk açılım (panelde "sıradaki ödül") */
export function nextCampUnlock(building: BuildingId, level: number, max = 15): { level: number; items: CampUnlock[] } | null {
  for (let l = level + 1; l <= max; l++) { const items = campUnlocksAt(building, l); if (items.length) return { level: l, items }; }
  return null;
}
/** bina seviyelerine göre açık kamp terimleri */
export function openCampTerms(levelOf: (b: BuildingId) => number): CampTerm[] { return CAMP_TERMS.filter((t) => levelOf(t.building) >= t.level); }
/** bina seviyelerine göre hak edilen kamp kozmetikleri */
export function earnedCampCosmetics(levelOf: (b: BuildingId) => number): string[] { return CAMP_COSMETICS.filter((c) => levelOf(c.building) >= c.level).map((c) => c.id); }

// ---------------------------------------------------------------- bölge anıtları

export interface Monument {
  region: BiomeId;
  /** anıtın adı */
  name: string;
  /** dokununca gösterilen kısa açıklama */
  plain: string;
  /** Tüy Dede'nin satırı (apps/web/src/ftue/script.ts) */
  line: string;
}
/** kulaktan beyne: haritada bölgeye ulaşınca kampta o bölgenin anıtı yükselir */
export const MONUMENTS: Monument[] = [
  { region: 'dis-kulak', name: 'Kulak Kepçesi Heykeli', line: 'anit-dis-kulak', plain: 'Kepçenin kıvrımları sesi toplar ve yönünü anlamamıza yardım eder.' },
  { region: 'kanal', name: 'Kanal Kemeri', line: 'anit-kanal', plain: 'Yaklaşık 2,5 cm’lik kanal, 2,5–3 kHz civarındaki sesleri güçlendirir.' },
  { region: 'zar', name: 'Kulak Zarı Davulu', line: 'anit-zar', plain: 'İnci grisi zar sesle titreşir; ön-alt kısmında ışık üçgeni parlar.' },
  { region: 'kemikcikler', name: 'Üç Kemikçik Anıtı', line: 'anit-kemikcikler', plain: 'Çekiç, örs ve üzengi: vücudumuzun en küçük kemikleri.' },
  { region: 'koklea-1', name: 'Koklea Sarmalı', line: 'anit-koklea-1', plain: 'İki buçuk tur dönen koklea, titreşimi sinir sinyaline hazırlar.' },
  { region: 'koklea-2', name: 'Tüy Hücresi Demeti', line: 'anit-koklea-2', plain: 'Basamak gibi dizilen stereosilya eğilince sinyal başlar.' },
  { region: 'koklea-3', name: 'Tonotopi Arpı', line: 'anit-koklea-3', plain: 'Kokleanın tabanı ince, tepesi kalın seslere yanıt verir.' },
  { region: 'sinir', name: 'Sinir Lifi Feneri', line: 'anit-sinir', plain: 'İşitme siniri sinyali binlerce lifle beyin sapına taşır.' },
  { region: 'beyin-sapi', name: 'İki Kulak Kavşağı', line: 'anit-beyin-sapi', plain: 'İki kulağın sesi beyin sapında buluşur; sesin yönü böyle bulunur.' },
  { region: 'korteks', name: 'Heschl Işığı', line: 'anit-korteks', plain: 'İşitsel korteks sesi anlamlı bir kelimeye, bir ninniye dönüştürür.' },
];
export const monumentOf = (region: string): Monument | undefined => MONUMENTS.find((m) => m.region === region);

// ---------------------------------------------------------------- Tüy Dede: yükseltmede tek satır (dönüşümlü)

/** her bina için 3 satır (apps/web/src/ftue/script.ts: kamp-sv-<bina>-1..3); seviyeye göre sırayla */
export function levelLineId(building: BuildingId, level: number): string { return `kamp-sv-${building}-${((Math.max(1, level) - 1) % 3) + 1}`; }
