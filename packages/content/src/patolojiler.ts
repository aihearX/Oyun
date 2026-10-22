import type { BiomeId } from '@odi/shared';

/**
 * Bölge patolojileri (kulak hastalıkları): Odi'nin geçtiği bölgeye özgü, OYNANIŞTA karşılaşılan okunur engeller. Her biri ilk
 * görüldüğünde adıyla etiketlenir ve Tüy Dede'nin kısa bir cümlesiyle tanıtılır (oyun içi: `LevelScene` → `pathology` olayı;
 * arayüz/ses ekibi not, sözlük ve seslendirmeyi bu kayıt ve olaydan ekler).
 *
 * Eğitsel ve korkutmayan dil; tıbbi öneri yok ("Gerçek hayatta tanı ve tedaviyi hekim ve odyolog birlikte koyar").
 * Kaynaklar ders kitabı düzeyindedir: Katz, Handbook of Clinical Audiology; Gelfand, Essentials of Audiology; Cummings
 * Otolaryngology; Scott-Brown's Otorhinolaryngology (ayrıntı: docs/odyoloji-icerik.md → "Bölge patolojileri").
 *
 * Kimlikler kalıcıdır ve kamp ekibinin Tedavi Odası malzemeleriyle (content/src/remedies.ts → `counters`) aynıdır.
 * `mekanik`: oyundaki karşılığı (üretici `level-gen/src/patoloji.ts` bu öğeleri `props.patoloji` ile işaretler).
 */
export const PATOLOJI_IDS = [
  'serumen-tikaci', 'otitis-eksterna', 'eksostoz', 'perforasyon', 'timpanoskleroz', 'retraksiyon', 'otitis-media', 'ostaki', 'otoskleroz',
  'zincir-kopuk', 'gurultu-hasari', 'presbiakuzi', 'ototoksisite', 'meniere', 'noroma', 'noropati', 'tinnitus', 'merkezi',
] as const;
export type PatolojiId = (typeof PATOLOJI_IDS)[number];

export interface Patoloji {
  id: PatolojiId;
  /** sade Türkçe ad (oyun içi etiket) */
  ad: string;
  /** teknik terim */
  terim: string;
  /** göründüğü bölge(ler) */
  bolge: BiomeId[];
  /** ilk göründüğü bölüm (insan yolculuğu; üretici testi denetler); 0 = henüz bölümlerde yok */
  ilkBolum: number;
  /** Tüy Dede'nin ilk karşılaşmadaki tek cümlesi (herkes için) */
  sade: string;
  /** "Daha fazla": öğrenci düzeyi tek cümle */
  teknik: string;
  /** oyundaki karşılığı ve nasıl geçileceği */
  mekanik: string;
  /** kaynak notu */
  kaynak: string;
}

const K = { katz: 'Katz, Handbook of Clinical Audiology', gelfand: 'Gelfand, Essentials of Audiology', kbb: 'Cummings Otolaryngology; Scott-Brown\'s Otorhinolaryngology' };

export const PATOLOJILER: Record<PatolojiId, Patoloji> = {
  'serumen-tikaci': {
    id: 'serumen-tikaci', ad: 'Kulak kiri tıkacı', terim: 'Serumen tıkacı (buşon)', bolge: ['kanal'], ilkBolum: 6,
    sade: 'Kulak kiri normalde kendiliğinden dışarı çıkar; birikip tıkaç olursa sesin yolunu kapatır. Üstünden atla!',
    teknik: 'Kanalı tıkayan serumen iletim tipi hafif-orta işitme kaybı yapabilir; temizliği hekim yapar, pamuklu çubuk iteleyebilir.',
    mekanik: 'Zeminde kehribar renkli kir yığını: kısa bir zıplamayla aşılır.', kaynak: `${K.kbb}; ${K.gelfand}`,
  },
  'otitis-eksterna': {
    id: 'otitis-eksterna', ad: 'Dış kulak iltihabı', terim: 'Otitis eksterna', bolge: ['kanal'], ilkBolum: 7,
    sade: 'İltihaplanan kanal derisi şişer ve geçit daralır. Altından kayarak geç!',
    teknik: 'Çoğunlukla bakteriyel; kanal ödemi ve ağrı yapar, sık "yüzücü kulağı" olarak görülür; tedavisi hekimle.',
    mekanik: 'Tavandan sarkan şişkin doku perdesi: aşağı kaydırıp altından kayılır.', kaynak: K.kbb,
  },
  eksostoz: {
    id: 'eksostoz', ad: 'Kanal kemik çıkıntısı', terim: 'Eksostoz ("sörfçü kulağı")', bolge: ['kanal'], ilkBolum: 6,
    sade: 'Soğuk suyla sık karşılaşan kanalda küçük kemik çıkıntıları büyüyebilir. Sivri çıkıntının üstünden zıpla!',
    teknik: 'Dış kulak yolu kemik duvarında iyi huylu, geniş tabanlı çıkıntılar; büyürse kir ve su tutulmasını kolaylaştırır.',
    mekanik: 'Kanal tabanındaki kırmızı, sivri kemik çıkıntısı (diken): zıplayarak aşılır; 6-12. bölümlerde odadaki ilk değiş can götürmez.', kaynak: K.kbb,
  },
  perforasyon: {
    id: 'perforasyon', ad: 'Kulak zarı deliği', terim: 'Timpanik membran perforasyonu', bolge: ['zar'], ilkBolum: 9,
    sade: 'Zarda delik olursa orası titreşmez: deliğin üstünden zıplayıp karşıya geç!',
    teknik: 'Enfeksiyon, basınç ya da travmayla oluşur; çoğu kendiliğinden kapanır, kapanmazsa onarılabilir (timpanoplasti).',
    mekanik: 'Zarın yırtık kenarlı boşluğu: sekmez, düşülür; zıplayarak aşılır.', kaynak: `${K.kbb}; ${K.katz}`,
  },
  timpanoskleroz: {
    id: 'timpanoskleroz', ad: 'Zar sertleşmesi', terim: 'Timpanoskleroz', bolge: ['zar'], ilkBolum: 10,
    sade: 'Zarda beyaz, tebeşir gibi plaklar oluşursa zar sertleşir ve daha az titreşir.',
    teknik: 'Geçirilmiş orta kulak iltihaplarından sonra zar ve orta kulakta hiyalin/kalsiyum birikimi; çoğu zaman az kayıp yapar.',
    mekanik: 'Beyaz plaklı zar: güçlü sıçrayış ×0,8 — alçak blok yine aşılır, üst nota rafı yalnız sağlam zarla ya da işitme cihazıyla.', kaynak: K.kbb,
  },
  retraksiyon: {
    id: 'retraksiyon', ad: 'Zar çekilmesi', terim: 'Retraksiyon cebi', bolge: ['zar'], ilkBolum: 11,
    sade: 'Orta kulak basıncı düşük kalırsa zar içeri doğru çekilip bir cep oluşturabilir.',
    teknik: 'Kronik Östaki işlev bozukluğunda zarın gevşek bölümü içe çöker; izlenmesi gerekir.',
    mekanik: 'Çukurun üstündeki gevşek zar cebi üstünde durana çöker (en çok 120 px); düşürmez, zıplayarak çıkılır.', kaynak: K.kbb,
  },
  'otitis-media': {
    id: 'otitis-media', ad: 'Orta kulakta sıvı', terim: 'Seröz otitis media', bolge: ['kemikcikler'], ilkBolum: 14,
    sade: 'Orta kulakta sıvı birikirse kemikçikler rahat titreşemez; çocuklarda sık görülür ve çoğu kendiliğinden geçer.',
    teknik: 'Efüzyonlu otitis media iletim tipi kayıp yapar; uzun sürerse ventilasyon tüpü düşünülebilir.',
    mekanik: 'Alçak çanakta yükselip çekilen sıvı (nabızlı; 0,65 sn önce parlar): çekilince çanaktan geç ya da üstteki raftan atla.', kaynak: `${K.kbb}; ${K.katz}`,
  },
  ostaki: {
    id: 'ostaki', ad: 'Östaki borusu tıkanıklığı', terim: 'Östaki tüpü disfonksiyonu', bolge: ['kemikcikler'], ilkBolum: 13,
    sade: 'Östaki borusu yutkununca açılır ve basıncı eşitler. Geçit kapalıysa "yutkunma" anahtarına dokun!',
    teknik: 'Boru açılamazsa orta kulakta negatif basınç, kulak dolgunluğu ve sıvı birikimi olabilir.',
    mekanik: 'Kapalı basınç kapısı: geri dönüp anahtara dokununca açılır.', kaynak: `${K.kbb}; ${K.gelfand}`,
  },
  otoskleroz: {
    id: 'otoskleroz', ad: 'Üzengi kemiği takılması', terim: 'Otoskleroz', bolge: ['kemikcikler'], ilkBolum: 15,
    sade: 'Üzengi kemiği oval pencerede takılırsa titreşim iç kulağa geçmez. Yere çakılıp serbest bırak!',
    teknik: 'Otik kapsülde anormal kemik yapımı üzengi tabanını sabitler; işitme cihazı ya da stapedotomi seçenektir.',
    mekanik: 'Takılı kapı: çakılma anahtarıyla açılır.', kaynak: `${K.kbb}; ${K.katz}`,
  },
  'zincir-kopuk': {
    id: 'zincir-kopuk', ad: 'Kemikçik zinciri kopukluğu', terim: 'Kemikçik zinciri diskontinüitesi', bolge: ['kemikcikler'], ilkBolum: 19,
    sade: 'Kemikçiklerden biri ayrılırsa titreşim zincirden geçmez. Gidip gelen köprüyle boşluğu aş!',
    teknik: 'Travma ya da kronik iltihapla örs-üzengi eklemi ayrılabilir; büyük iletim tipi kayıp yapar, cerrahiyle onarılabilir.',
    mekanik: 'Hareketli köprülü boşluk: köprü gelince üstüne at.', kaynak: K.kbb,
  },
  'gurultu-hasari': {
    id: 'gurultu-hasari', ad: 'Gürültü hasarı', terim: 'Gürültüye bağlı işitme kaybı', bolge: ['koklea-1', 'koklea-2', 'koklea-3'], ilkBolum: 21,
    sade: 'Çok yüksek ses tüy hücrelerini yorar. Gürültü bulutuna değmeden geç!',
    teknik: 'Kalıcı hasar çoğunlukla 3-6 kHz bölgesinde ("4 kHz çentiği") başlar; korunmanın yolu sesi kısmak ve süreyi azaltmak.',
    mekanik: 'Durgun gürültü bulutu: üstünden atla ya da altından kay.', kaynak: `${K.katz}; ${K.gelfand}`,
  },
  presbiakuzi: {
    id: 'presbiakuzi', ad: 'Yaşa bağlı işitme kaybı', terim: 'Presbiakuzi', bolge: ['koklea-1', 'koklea-2', 'koklea-3'], ilkBolum: 21,
    sade: 'Yıllar geçtikçe kokleanın tabanındaki (tiz sesler) tüy hücreleri seyrelir. Seyrek basamaklarda oyalanma!',
    teknik: 'Yaşla birlikte çoğunlukla iki kulakta simetrik, tiz frekanslardan başlayan sensörinöral kayıp.',
    mekanik: 'Basınca ufalanan seyrek basamaklar: hızla geç.', kaynak: `${K.katz}; ${K.gelfand}`,
  },
  ototoksisite: {
    id: 'ototoksisite', ad: 'İlaca bağlı iç kulak hasarı', terim: 'Ototoksisite', bolge: ['koklea-1', 'koklea-2', 'koklea-3'], ilkBolum: 23,
    sade: 'Bazı ilaçlar iç kulağa zarar verebilir; bu yüzden hekimler izler. Düşen zehirli damlalardan kaç!',
    teknik: 'Aminoglikozitler ve sisplatin gibi ilaçlarda tiz frekanslardan başlayan kayıp izlenir (odyolojik izlem).',
    mekanik: 'Gidip gelen zehirli damlalar: arasındaki boşluktan geç.', kaynak: `${K.katz}; ${K.kbb}`,
  },
  meniere: {
    id: 'meniere', ad: 'Meniere hastalığı', terim: 'Endolenfatik hidrops', bolge: ['koklea-1', 'koklea-2', 'koklea-3'], ilkBolum: 23,
    sade: 'İç kulakta sıvı fazlalaşınca denge ve işitme dalgalanır; bu zemin yalpalıyor, zamanla bin!',
    teknik: 'Ataklar hâlinde baş dönmesi, dalgalı alçak frekans kaybı, çınlama ve dolgunlukla seyreder.',
    mekanik: 'Yalpalayan, gidip gelen platformlar ve asansörler: doğru anda üstüne bin.', kaynak: `${K.kbb}; ${K.katz}`,
  },
  noroma: {
    id: 'noroma', ad: 'İşitme siniri tümörü', terim: 'Vestibüler schwannom (akustik nörinom)', bolge: ['sinir'], ilkBolum: 31,
    sade: 'İşitme sinirinde yavaş büyüyen, iyi huylu bir doku yolu daraltabilir. Ses darbesiyle geçidi aç!',
    teknik: 'Tek taraflı sensörinöral kayıp ve çınlamada MR ile araştırılır; izlem, radyocerrahi ya da cerrahi seçenektir.',
    mekanik: 'Yolu kapatan doku duvarı: ses darbesiyle (ileri kaydır) kırılır.', kaynak: `${K.kbb}; ${K.katz}`,
  },
  noropati: {
    id: 'noropati', ad: 'İşitsel nöropati', terim: 'İşitsel nöropati spektrum bozukluğu', bolge: ['sinir', 'beyin-sapi'], ilkBolum: 35,
    sade: 'Ses kulağa ulaşır ama sinirde zamanlaması bozulur. Basamaklar ritimden kayıyor: gözünle izle!',
    teknik: 'Otoakustik emisyonlar var ama işitsel beyin sapı yanıtı bozuk; konuşmayı anlamak işitme eşiğinden daha zordur.',
    mekanik: 'Ritim basamakları: belirdiğinde bas (müziğe değil görüntüye güven).', kaynak: `${K.katz}; ${K.gelfand}`,
  },
  tinnitus: {
    id: 'tinnitus', ad: 'Kulak çınlaması', terim: 'Tinnitus', bolge: ['korteks'], ilkBolum: 37,
    sade: 'Çınlama, dışarıda olmayan bir sesi duymaktır. Bu bulut aralıklarla çınlıyor: sustuğu anda geç!',
    teknik: 'Çoğu zaman işitme kaybına eşlik eder; ses terapisi ve danışmanlıkla yönetilir, kaynağı hekimle araştırılır.',
    mekanik: 'Nabızlı (zamanlı) bulut: parlayıp titreyerek uyarır, sonra yanar; söndüğünde geçilir.', kaynak: `${K.katz}; ${K.kbb}`,
  },
  merkezi: {
    id: 'merkezi', ad: 'İşitsel işlemleme bozukluğu', terim: 'Merkezi işitsel işlemleme bozukluğu', bolge: ['korteks'], ilkBolum: 37,
    sade: 'Kulak iyi duysa da beyin sesi düzenlemekte zorlanabilir. Yankı yolu karışık: her basamağı ses darbesiyle uyandır!',
    teknik: 'Gürültüde konuşmayı anlama ve ses sıralamada güçlük; odyolojik test bataryasıyla değerlendirilir.',
    mekanik: 'Yankı basamakları: ancak ses darbesinden sonra katılaşır.', kaynak: `${K.katz}; ${K.gelfand}`,
  },
};

/** oyuncunun ilk karşılaşmasını kalıcı yapan anahtar (meta.firsts) */
export const patolojiKey = (id: PatolojiId) => `patoloji:${id}`;
