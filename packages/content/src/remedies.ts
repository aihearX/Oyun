/**
 * Tedavi Odası malzemeleri (Kulak Kampı): koruma ve tedavi "eşyaları". Oyuncu kampta hazırlar, bölüm kartında çantasına koyar;
 * bölümde her adet, `counters` listesindeki bir patoloji engelini BİR KEZ etkisiz kılar (oyun ekibi uygular; sözleşme
 * docs/14-kamp.md). Kullanılmayan malzeme kaybolmaz.
 *
 * Dürüst ve tıbbi öneri olmayan çerçeve: her malzeme gerçek bir koruma/tedavi yöntemine dayanır ama oyunda "öğretmek için"
 * vardır; kartlarda "Gerçek hayatta tedaviyi hekim ve odyolog birlikte belirler" notu gösterilir. Kaynaklar ders kitabı
 * düzeyindedir (Katz; Gelfand; standart KBB kitapları: Cummings Otolaryngology, Scott-Brown's Otorhinolaryngology) ve
 * docs/odyoloji-icerik.md dosyasına da yazılıdır. Kimlikler kalıcıdır (sunucu envanteri bu kimliklerle tutulur).
 *
 * Patoloji kimlikleri oyun ekibinin bölge patolojileriyle eşleşir (geçici liste; hizalanınca aynı kalır):
 * serumen-tikaci, otitis-eksterna, eksostoz, perforasyon, timpanoskleroz, retraksiyon, otitis-media, ostaki, otoskleroz,
 * zincir-kopuk, gurultu-hasari, presbiakuzi, ototoksisite, meniere, noroma, noropati, tinnitus, merkezi.
 */

export const PATHOLOGY_IDS = [
  'serumen-tikaci', 'otitis-eksterna', 'eksostoz', 'perforasyon', 'timpanoskleroz', 'retraksiyon', 'otitis-media', 'ostaki', 'otoskleroz',
  'zincir-kopuk', 'gurultu-hasari', 'presbiakuzi', 'ototoksisite', 'meniere', 'noroma', 'noropati', 'tinnitus', 'merkezi',
] as const;
export type PathologyId = (typeof PATHOLOGY_IDS)[number];

/** patolojilerin kısa Türkçe adları (kartlarda "neye karşı" satırı) */
export const PATHOLOGY_NAMES: Record<PathologyId, string> = {
  'serumen-tikaci': 'kulak kiri tıkacı',
  'otitis-eksterna': 'dış kulak iltihabı',
  'eksostoz': 'kanal kemik çıkıntısı (eksostoz)',
  'perforasyon': 'kulak zarı deliği',
  'timpanoskleroz': 'zar sertleşmesi (timpanoskleroz)',
  'retraksiyon': 'zar çekilmesi (retraksiyon)',
  'otitis-media': 'orta kulak iltihabı / sıvı',
  'ostaki': 'Östaki borusu tıkanıklığı',
  'otoskleroz': 'otoskleroz',
  'zincir-kopuk': 'kemikçik zinciri kopukluğu',
  'gurultu-hasari': 'gürültü hasarı',
  'presbiakuzi': 'yaşa bağlı işitme kaybı',
  'ototoksisite': 'ilaca bağlı iç kulak hasarı',
  'meniere': 'Meniere hastalığı',
  'noroma': 'akustik nörom',
  'noropati': 'işitsel nöropati',
  'tinnitus': 'kulak çınlaması',
  'merkezi': 'işitsel işlemleme bozukluğu',
};

export interface RemedyDef {
  /** kalıcı kimlik */
  id: string;
  /** önce sade Türkçe ad */
  name: string;
  /** teknik terim */
  term: string;
  /** etkisiz kıldığı patoloji engelleri */
  counters: PathologyId[];
  /** herkes için tek cümle */
  plain: string;
  /** "Daha fazla": öğrenci düzeyi */
  tech: string;
  /** kaynak notu (docs/odyoloji-icerik.md ile aynı) */
  src: string;
  /** Tedavi Odası'nın bu malzemeyi hazırlayabildiği en düşük seviye */
  level: number;
  /** bir adetin Sv 1'deki hazırlanma süresi (dakika); seviye arttıkça kısalır (remedyPeriodMs) */
  minutes: number;
  /** kartlardaki renk vurgusu */
  color: string;
}

const K = 'Katz, Handbook of Clinical Audiology';
const G = 'Gelfand, Essentials of Audiology';
const E = 'standart KBB kitapları (Cummings Otolaryngology; Scott-Brown’s Otorhinolaryngology)';

export const REMEDIES: RemedyDef[] = [
  { id: 'kulak-tikaci', name: 'Kulak tıkacı', term: 'İşitme koruyucu (köpük tıkaç, kulaklık tipi koruyucu)', counters: ['gurultu-hasari', 'eksostoz'], level: 1, minutes: 20, color: '#ff9f1c',
    plain: 'Yüksek seste kulağı korur; soğuk suda yüzerken de kanalı korumaya yardım eder.',
    tech: 'Doğru takılan köpük tıkaç gürültüyü yaklaşık 20–30 dB azaltabilir (etiket değeri NRR/SNR; gerçek kullanımda genellikle daha az). Gürültüye bağlı kalıcı işitme kaybının en etkili önlemi korunmadır. Sık soğuk su ve rüzgâra maruz kalmak kanalda kemik çıkıntılarına (eksostoz, “sörfçü kulağı”) yol açabilir; yüzücü tıkaçları önlemde kullanılır.',
    src: `${K}, gürültü ve işitme koruma; ${E}, dış kulak hastalıkları` },
  { id: 'serumen-damlasi', name: 'Kulak kiri yumuşatıcı damla', term: 'Serumenolitik damla', counters: ['serumen-tikaci'], level: 1, minutes: 30, color: '#ffc93c',
    plain: 'Sertleşmiş kulak kirini yumuşatır; temizliği sağlık profesyoneli yapar.',
    tech: 'Serumenolitikler (ör. sodyum bikarbonatlı ya da yağ bazlı damlalar) tıkayıcı kiri birkaç günde yumuşatır; ardından gerekirse yıkama ya da mikroaspirasyonla temizlenir. Kulak zarında delik şüphesi varsa damla ve yıkama uygulanmaz. Pamuklu çubuk kiri çoğu zaman daha derine iter.',
    src: `${K}, otoskopi ve serumen yönetimi; ${E}` },
  { id: 'dis-kulak-damlasi', name: 'Dış kulak damlası', term: 'Topikal (antibiyotikli / steroidli) kulak damlası', counters: ['otitis-eksterna'], level: 2, minutes: 40, color: '#2ee6d6',
    plain: 'Dış kulak yolu iltihabında hekimin verdiği damla kanalı iyileştirir.',
    tech: 'Akut dış kulak yolu iltihabının (otitis eksterna, “yüzücü kulağı”) temel tedavisi topikal damladır; ödemli kanalda damlanın ilerlemesi için fitil kullanılabilir. Kanalın kuru tutulması önerilir. Reçeteli ilaçlar yalnız hekim önerisiyle kullanılır.',
    src: `${E}, dış kulak hastalıkları` },
  { id: 'zar-yamasi', name: 'Zar yaması', term: 'Timpanoplasti / miringoplasti grefti', counters: ['perforasyon'], level: 3, minutes: 60, color: '#ff8fb1',
    plain: 'Kulak zarındaki kendiliğinden kapanmayan deliği kapatan doku yaması.',
    tech: 'Küçük travmatik delikler çoğu zaman kendiliğinden kapanır. Kapanmayan perforasyonlarda zar, çoğunlukla temporal kas fasyası ya da kıkırdaktan alınan greftle onarılır (miringoplasti / timpanoplasti). Timpanometride büyük eşdeğer kanal hacmi perforasyonu düşündürür.',
    src: `${E}, kronik otitis media ve timpanoplasti; ${K}, timpanometri` },
  { id: 'ventilasyon-tupu', name: 'Ventilasyon tüpü', term: 'Timpanostomi tüpü', counters: ['otitis-media', 'ostaki', 'retraksiyon'], level: 4, minutes: 60, color: '#8b6bff',
    plain: 'Kulak zarına konan minicik tüp, orta kulağı havalandırır ve sıvının boşalmasını sağlar.',
    tech: 'Uzun süren seröz otitis media (orta kulakta sıvı) ya da sık tekrarlayan akut otit durumunda zara küçük bir tüp yerleştirilebilir; Östaki borusunun yetmediği havalandırmayı üstlenir. Tüp genellikle aylar içinde kendiliğinden düşer. Tip B (düz) timpanogram sıvıyı, Tip C negatif basıncı düşündürür.',
    src: `${E}, otitis media; ${K}, timpanometri` },
  { id: 'kemikcik-protezi', name: 'Kemikçik protezi', term: 'Kısmi / total kemikçik protezi (PORP / TORP)', counters: ['zincir-kopuk'], level: 6, minutes: 90, color: '#ffd66b',
    plain: 'Kopan kemikçik zincirinin yerine geçen minik protez, titreşimi yeniden iletir.',
    tech: 'Kemikçik zinciri kopukluğu (ör. örsün uzun kolunun erimesi ya da travma) büyük iletim tipi kayba yol açar. Osikuloplastide kısmi (PORP, üzengi üst yapısı sağlamsa) ya da total (TORP, üzengi tabanına) protezlerle zincir yeniden kurulur.',
    src: `${E}, osikuloplasti; ${G}, iletim tipi işitme kaybı` },
  { id: 'stapes-protezi', name: 'Stapes protezi', term: 'Stapedotomi pistonu', counters: ['otoskleroz'], level: 7, minutes: 90, color: '#e4dcff',
    plain: 'Sertleşip kıpırdamayan üzenginin yerine titreşen ince bir piston konur.',
    tech: 'Otosklerozda üzengi tabanı oval pencereye kemikleşerek sabitlenir; iletim tipi kayıp ve sıklıkla 2 kHz civarında kemik yolu çentiği (Carhart çentiği) görülür. Stapedotomide tabana küçük bir delik açılıp örse asılan bir piston protez yerleştirilir. İşitme cihazı da bir seçenektir.',
    src: `${E}, otoskleroz; ${K}, saf ses odyometrisi (Carhart çentiği)` },
  { id: 'isitme-cihazi', name: 'İşitme cihazı', term: 'Kulak arkası işitme cihazı (amplifikasyon)', counters: ['presbiakuzi', 'timpanoskleroz'], level: 8, minutes: 120, color: '#5fe39a',
    plain: 'Sesi her frekansta ayrı ayrı güçlendirerek işitmeyi destekler.',
    tech: 'İşitme cihazı mikrofon, yükselteç (sayısal işlemci) ve alıcıdan oluşur; kazanç odyograma göre bir reçeteyle (ör. NAL-NL2, DSL v5) frekans bandı başına ayarlanır ve gerçek kulak ölçümüyle doğrulanır. Yaşa bağlı işitme kaybında (presbiakuzi) en yaygın rehabilitasyon yoludur.',
    src: `${K}, işitme cihazı seçimi ve uygulaması; ${G}, amplifikasyon` },
  { id: 'ses-ureteci', name: 'Ses üreteci', term: 'Ses terapisi cihazı (tinnitus için)', counters: ['tinnitus'], level: 10, minutes: 90, color: '#7df3ff',
    plain: 'Hafif ve hoş bir arka plan sesi, çınlamayı daha az fark edilir kılar.',
    tech: 'Tinnitus yönetiminde danışmanlık ile birlikte ses terapisi kullanılır: geniş bantlı hafif gürültü ya da doğa sesleri, çınlamayla beynin kurduğu kontrastı azaltır (ör. tinnitus yeniden eğitim terapisi, TRT). İşitme kaybı varsa işitme cihazı çoğu zaman tinnitusu da hafifletir.',
    src: `${K}, tinnitus değerlendirme ve yönetimi` },
  { id: 'uzaktan-mikrofon', name: 'Uzaktan mikrofon', term: 'Uzaktan mikrofon sistemi (FM / dijital)', counters: ['merkezi', 'noropati'], level: 11, minutes: 120, color: '#ff5c8a',
    plain: 'Konuşanın yakınındaki mikrofon, sesi gürültüden ayırıp doğrudan kulağa iletir.',
    tech: 'Uzaktan mikrofon sistemleri sinyal/gürültü oranını belirgin biçimde artırır. İşitsel işlemleme bozukluğu ve işitsel nöropati (ANSD) gibi gürültüde konuşmayı anlamanın zor olduğu durumlarda, özellikle sınıfta, sık önerilir; işitsel eğitimle birlikte kullanılır.',
    src: `${K}, işitsel işlemleme bozukluğu ve işitsel nöropati bölümleri` },
  { id: 'koklear-implant', name: 'Koklear implant', term: 'Koklear implant (elektrot dizisi + konuşma işlemcisi)', counters: ['ototoksisite', 'presbiakuzi'], level: 13, minutes: 240, color: '#ffc93c',
    plain: 'Sesi elektrik sinyaline çevirip işitme sinirini doğrudan uyarır.',
    tech: 'İşitme cihazından yeterli yarar görmeyen ileri–çok ileri sensörinöral kayıplarda koklear implant uygulanır: dıştaki işlemci sesi kodlar, mıknatıslı bobinle deri altındaki alıcıya iletir; koklea içine yerleştirilen elektrot dizisi spiral ganglion hücrelerini tonotopik sırayla uyarır.',
    src: `${K}, koklear implantlar; ${G}` },
];

export const remedyById = (id: string): RemedyDef | undefined => REMEDIES.find((r) => r.id === id);
/** bu patolojiye karşı işe yarayan malzemeler */
export const remediesFor = (pathology: string): RemedyDef[] => REMEDIES.filter((r) => (r.counters as string[]).includes(pathology));

/** kartlarda gösterilen dürüstlük notu */
export const REMEDY_DISCLAIMER = 'Oyundaki malzemeler öğretmek içindir, tıbbi öneri değildir. Gerçek hayatta tedaviyi hekim ve odyolog birlikte belirler.';

// ---------------------------------------------------------------- kurallar (sunucu ve istemci aynı formülü kullanır)

/** bir adetin hazırlanma süresi (ms): her seviye %3 kısaltır, en çok %45. factor: Yenidoğan Tarama Birimi çarpanı (kamp-seviye.ts taramaFactor) */
export function remedyPeriodMs(def: Pick<RemedyDef, 'minutes'>, level: number, factor = 1): number {
  const k = Math.max(0.55, 1 - 0.03 * Math.max(0, level - 1));
  return Math.max(1, Math.round(def.minutes * k * Math.min(1, Math.max(0.5, factor)))) * 60_000;
}
/** rafta bekleyebilecek en çok adet (toplanmazsa üretim durur): 2 + seviye/3 */
export function remedyShelfCap(level: number): number { return level <= 0 ? 0 : 2 + Math.floor(level / 3); }
/** çantada (envanterde) bir malzemeden en çok (taban; Kamp Seviyesiyle artar: kamp-seviye.ts remedyInvCap) */
export const REMEDY_INV_CAP = 9;
/** Tedavi Odası seviyesinde hazırlanabilen malzemeler */
export const remediesAt = (level: number): RemedyDef[] => REMEDIES.filter((r) => r.level <= level);

/**
 * rafta biriken adet (saf): since anından bu yana tamamlanan adetler, raf sınırıyla.
 * nextSince: toplandıktan sonra sayacın yeni başlangıcı (yarım kalan adet korunur; raf doluysa şimdi).
 */
export function remedyShelf(def: Pick<RemedyDef, 'minutes'>, level: number, since: number, now: number, factor = 1): { ready: number; cap: number; nextSince: number; progress: number; periodMs: number } {
  const cap = remedyShelfCap(level); const periodMs = remedyPeriodMs(def, level, factor);
  if (cap <= 0 || periodMs <= 0) return { ready: 0, cap, nextSince: now, progress: 0, periodMs };
  const elapsed = Math.max(0, now - since); const done = Math.floor(elapsed / periodMs);
  const ready = Math.min(cap, done);
  const nextSince = done >= cap ? now : since + ready * periodMs;
  const progress = ready >= cap ? 1 : (elapsed - done * periodMs) / periodMs;
  return { ready, cap, nextSince, progress, periodMs };
}

/** bölüme götürülebilecek toplam malzeme (çanta): 2; Tedavi Odası Sv 6 ile +1, Odyoloji Merkezi Sv 12 ile +1 */
export function carrySlots(levels: { tedavi: number; merkez: number }): number {
  return 2 + (levels.tedavi >= 6 ? 1 : 0) + (levels.merkez >= 12 ? 1 : 0);
}

/**
 * Bölgede karşılaşılabilecek patolojiler (bölüm kartında "bu bölgede işe yarayabilir" ipucu). Oyun ekibinin kaydındaki
 * (`patolojiler.ts` → `bolge`) eşlemenin aynısı; bir bölümde gerçekte hangilerinin çıktığını oyun belirler.
 */
export const REGION_PATHOLOGIES: Record<string, PathologyId[]> = {
  'dis-kulak': [],
  kanal: ['serumen-tikaci', 'otitis-eksterna', 'eksostoz'],
  zar: ['perforasyon', 'timpanoskleroz', 'retraksiyon'],
  kemikcikler: ['otitis-media', 'ostaki', 'otoskleroz', 'zincir-kopuk'],
  'koklea-1': ['gurultu-hasari', 'presbiakuzi', 'ototoksisite', 'meniere'],
  'koklea-2': ['gurultu-hasari', 'presbiakuzi', 'ototoksisite', 'meniere'],
  'koklea-3': ['gurultu-hasari', 'presbiakuzi', 'ototoksisite', 'meniere'],
  sinir: ['noroma', 'noropati'],
  'beyin-sapi': ['noropati'],
  korteks: ['tinnitus', 'merkezi'],
};
/** bu malzeme bu bölgede işe yarayabilir mi */
export const remedyFitsRegion = (r: Pick<RemedyDef, 'counters'>, region: string) => (REGION_PATHOLOGIES[region] ?? []).some((p) => r.counters.includes(p));
