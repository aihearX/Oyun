import type { BiomeId } from '@odi/shared';

/**
 * Kulak Kartları albümü: her biyom için 5 bilgi kartı; her kartta herkes için sade bir cümle (fact) ve öğrenci düzeyi teknik
 * ayrıntı (tech) var. Yalnız ders kitabı düzeyinde yerleşik bilgiler; sayılar yaklaşık (bkz. docs/odyoloji-icerik.md).
 * Kimlikler biyom:yuva biçimindedir ve kalıcıdır (kayıtlı albümler bozulmaz).
 *
 * Açılma yolları (oyunda yazılı):
 *  ilk     — biyomda ilk bölümü bitir
 *  yildiz  — biyomda bir bölümde 3 yıldız al
 *  ozel    — biyomda gizli altın koklea bul (gizli bölümü olan biyomlar) ya da hasarsız bitir (diğerleri)
 *  sandik  — günlük sandıktan gelir (içeriği sandıkta önceden yazılı)
 *  usta    — biyomdaki tüm bölümleri bitir
 */
export type CardSlot = 'ilk' | 'yildiz' | 'ozel' | 'sandik' | 'usta';
export interface CardDef { id: string; biome: BiomeId; slot: CardSlot; title: string; fact: string; emoji: string; /** öğrenci düzeyi teknik ayrıntı (albümde "Daha fazla") */ tech: string;
  /** kartı öneren oyuncunun takma adı; albümde "Öneren: <takma ad>". YALNIZ açık izinli takma ad (izin kaydı sahipte; docs/yonetim/gizlilik.md "Öneren") */
  oneren?: string }

const SLOTS: CardSlot[] = ['ilk', 'yildiz', 'ozel', 'sandik', 'usta'];
/** oneren: kartı öneren oyuncunun izinli takma adı (isteğe bağlı) */
type Raw = [emoji: string, title: string, fact: string, tech: string, oneren?: string];
const RAW: Record<BiomeId, Raw[]> = {
  'dis-kulak': [
    ['👂', 'Kıvrımlı Pusula', 'Kulak kepçesinin kıvrımları, sesin yukarıdan mı aşağıdan mı geldiğini anlamamıza yardım eder.', 'Aurikula (pinna) elastik kıkırdaktandır; yüksek frekanslarda geliş açısına bağlı spektral tepe ve çentikler oluşturarak dikey yön ve ön-arka ayrımına ipucu verir.'],
    ['📢', 'Doğal Megafon', 'Kepçe ve kulak kanalı birlikte, konuşma için önemli olan orta-tiz sesleri güçlendirir.', 'Baş, kepçe ve kanalın birleşik aktarım işlevi yaklaşık 2–4 kHz bölgesinde belirgin kazanç sağlar; kanal rezonansı tek başına yaklaşık 2,5–3 kHz civarındadır.'],
    ['↔️', 'Milisaniye Yarışı', 'Yandan gelen ses bir kulağa diğerinden biraz önce varır; beyin bu farkla yön bulur.', 'En büyük iki kulak arası zaman farkı (ITD) yetişkin başında yaklaşık 0,6–0,7 ms’dir; düşük frekanslarda yön bulmanın baskın ipucudur.'],
    ['🎚️', 'Hertz Nedir?', 'Hertz, sesin saniyedeki titreşim sayısıdır; çok titreşen ses ince duyulur.', 'Genç ve sağlıklı kulak yaklaşık 20 Hz–20 kHz arasını duyar ve yaklaşık 1–4 kHz arasında en duyarlıdır (mutlak eşik eğrisi).'],
    ['📐', 'Desibel Merdiveni', 'Desibel ölçeği logaritmiktir: küçük bir sayı artışı büyük bir enerji artışıdır.', 'SPL = 20·log10(p/p0), p0 = 20 µPa. Ses basıncı iki katına çıkınca yaklaşık 6 dB, on katına çıkınca 20 dB artış olur.'],
  ],
  'kanal': [
    ['📏', '2,5 Santimlik Tünel', 'Yetişkinde dış kulak yolu yaklaşık 2,5 cm uzunluğundadır ve hafif S biçiminde kıvrılır.', 'Dış üçte biri kıkırdak, iç üçte ikisi kemiktir; bir ucu kapalı tüp gibi yaklaşık 2,5–3 kHz civarında rezonans yapar (yaklaşık 10–15 dB kazanç).'],
    ['🛡️', 'Kulak Kiri Kahramandır', 'Kulak kiri (serumen) kanalı nemli tutar, toza ve mikroplara karşı korur.', 'Serumen, kanalın kıkırdak bölümündeki seruminöz ve yağ bezlerinin salgısı ile dökülen deri hücrelerinden oluşur; hafif asidiktir ve koruyucu özellik taşır.'],
    ['🚫', 'Çubuk Yok!', 'Pamuklu çubuk kiri çoğu zaman daha derine iter; kulağın dışını silmek yeterlidir.', 'Tıkayıcı serumen iletim tipi işitme kaybına yol açabilir; çıkarılması gerektiğinde işlem sağlık profesyonelince yapılmalıdır.'],
    ['🚶', 'Yürüyen Bant', 'Kanal derisi içten dışa doğru çok yavaş kayar ve kiri kendiliğinden dışarı taşır.', 'Kanal epitelinin kulak zarından dışa doğru göçü (epitel migrasyonu) kanalın kendini temizlemesini sağlar.'],
    ['⏱️', 'Süre ile Şiddet', 'Ses ne kadar yüksekse güvenle dinleyebileceğimiz süre o kadar kısalır.', 'NIOSH önerisi: 85 dB(A)’de 8 saat; 3 dB değiş tokuş oranıyla 88 dB(A)’de yaklaşık 4 saat, 91 dB(A)’de yaklaşık 2 saat.'],
  ],
  'zar': [
    ['🥁', 'İncecik Davul', 'Kulak zarı, bir kâğıt yaprağı kadar ince ve yaklaşık bir tırnak büyüklüğündedir.', 'Timpanik membran yaklaşık 8–10 mm çapında, yaklaşık 0,1 mm kalınlığında ve üç katmanlıdır; pars tensa ve pars flaccida bölümleri vardır.'],
    ['⚛️', 'Atomdan Küçük Titreşim', 'Duyabildiğimiz en hafif seslerde kulak zarı, bir atomun çapından da küçük bir mesafe kadar titreşir.', 'Eşik düzeyindeki seslerde zar yer değiştirmesi nanometrenin altındadır; bu, işitme sisteminin olağanüstü duyarlılığını gösterir.'],
    ['🩹', 'Kendini Onaran Zar', 'Küçük kulak zarı yırtıkları çoğu zaman birkaç hafta içinde kendiliğinden iyileşir.', 'Travmatik küçük perforasyonların çoğu kendiliğinden kapanır; kapanmayanlarda cerrahi onarım (timpanoplasti) seçeneği vardır.'],
    ['✈️', 'Uçak Kulağı', 'Östaki borusu orta kulağı boğaza bağlar; yutkunmak ya da esnemek basıncı eşitler.', 'Tuba normalde kapalıdır ve yutkunmada açılır; çocuklarda daha kısa ve yataydır. İşlev bozukluğunda timpanogram C tipi (negatif basınç) olabilir.'],
    ['📊', 'Zarın Hareket Testi', 'Timpanometri, kulak zarının ne kadar rahat hareket ettiğini ölçen kısa ve ağrısız bir testtir.', 'Jerger tipleri: A normal; As sertleşmiş; Ad aşırı hareketli; B düz (sıvı ya da perforasyon, kanal hacmine bakılır); C negatif orta kulak basıncı.'],
  ],
  'kemikcikler': [
    ['🔨', 'Üçlü Makine', 'Çekiç, örs ve üzengi vücudun en küçük üç kemiğidir ve sesi zardan iç kulağa taşır.', 'Malleus, inkus ve stapes bir kaldıraç zinciri kurar; stapes tabanı oval pencereye anüler ligamanla tutunur.'],
    ['🔬', 'En Küçük Kemik', 'Üzengi, yaklaşık 3 mm boyuyla vücuttaki en küçük kemiktir.', 'Stapes başı, iki kolu (krus) ve tabandan (footplate) oluşur; tabanın titreşimi skala vestibulideki perilenfe aktarılır.'],
    ['📈', 'Basınç Yükseltici', 'Orta kulak, havadaki sesi iç kulak sıvısına aktarırken onu yaklaşık 20 kat güçlendirir.', 'Empedans uyumu: zar/stapes tabanı alan oranı yaklaşık 17:1, kemikçik kaldıracı yaklaşık 1,3:1; toplam kazanç yaklaşık 25–30 dB.'],
    ['💪', 'Minik Koruyucu Kas', 'Üzengiye bağlı stapedius, vücudun en küçük iskelet kasıdır; çok yüksek seste kasılır.', 'Akustik (stapedius) refleks iki taraflıdır; normal işitenlerde tipik eşikler yaklaşık 70–100 dB HL. Stapedius fasiyal sinirden, tensor timpani trigeminal sinirden dal alır.'],
    ['🦴', 'Sertleşen Kemik', 'Bazı kişilerde üzengi kemiği sertleşip hareketini kaybedebilir; buna otoskleroz denir.', 'Stapes fiksasyonu ilerleyici iletim tipi kayba yol açar; yaklaşık 2 kHz’te kemik yolunda Carhart çentiği ve As tipi timpanogram görülebilir.'],
  ],
  'koklea-1': [
    ['🐌', 'Koklea Kıvrımı', 'Koklea yaklaşık iki buçuk tur kıvrılan sarmal bir kanaldır; adı Latincede “salyangoz kabuğu” anlamına gelir.', 'Kemik eksen (modiolus) çevresinde yaklaşık 2,5–2,75 tur kıvrılır; içinde skala vestibuli, skala media ve skala timpani bulunur.'],
    ['🌊', 'Sıvı Dalgası', 'Üzengi oval pencereyi ittiğinde koklea sıvısında bir dalga yayılır.', 'Sıvı sıkıştırılamadığı için yuvarlak pencere dışa doğru esner; basınç farkı baziler membranda tabandan tepeye ilerleyen dalgayı başlatır.'],
    ['🔋', 'Kulaktaki Pil', 'Kokleanın içinde küçük bir pil gibi elektrik gerilimi vardır.', 'Skala media potasyumdan zengin endolenf içerir; stria vaskülarisin ürettiği yaklaşık +80 mV endokoklear potansiyel tüy hücresi uyarımını kolaylaştırır.'],
    ['⚖️', 'Denge de Burada', 'İç kulak yalnızca işitmez, dengemizi de sağlar.', 'Yarım daire kanalları açısal ivmeyi, utrikül ve sakkül doğrusal ivmeyi ve yerçekimini algılar; bilgi VIII. kafa sinirinin vestibüler dalıyla taşınır.'],
    ['🫛', 'Bezelye Boyunda', 'Koklea bir bezelye tanesi kadardır; ama içindeki kanal açılsa yaklaşık 3,5 cm uzunluğunda olurdu.', 'Baziler membranın uzunluğu insanda yaklaşık 3–3,5 cm’dir; bu uzunluk boyunca frekanslar tonotopik olarak dizilir.'],
  ],
  'koklea-2': [
    ['🧮', 'Binlerce Tüy Hücresi', 'Bir kulakta yaklaşık 3.500 iç ve 12.000 dış tüy hücresi bulunur.', 'Corti organında bir sıra iç, üç sıra dış tüy hücresi vardır; afferent liflerin yaklaşık %90–95’i iç tüy hücrelerinden bilgi taşır.'],
    ['🕺', 'Dans Eden Hücreler', 'Dış tüy hücreleri sesle birlikte boyca uzayıp kısalır ve hafif sesleri güçlendirir.', 'Prestin proteinine dayalı elektromotilite koklear amplifikatörü oluşturur; duyarlılığı ve frekans seçiciliğini artırır.'],
    ['📡', 'Kulağın Yankısı', 'Sağlıklı bir kulak kendi çok hafif seslerini üretir; bebeklerin işitmesi bununla taranabilir.', 'Otoakustik emisyonlar dış tüy hücresi işlevinin yan ürünüdür; prob mikrofonla ölçülür ve yenidoğan taramasında otomatik ABR ile birlikte kullanılır.'],
    ['🌾', 'Stereosilya', 'Tüy hücrelerinin üstünde minik tüy demetleri vardır; eğildiklerinde sinir sinyali başlar.', 'Basamaklı stereosilyaları bağlayan uç bağlantıları (tip link) gerilince mekanoelektrik iletim kanalları açılır ve endolenften K+ girer.'],
    ['🔊', 'Hızla Yükselen Sesler', 'İç kulak kaynaklı kayıpta sesler bir noktadan sonra hızla fazla yüksek gelebilir.', 'Gürlük toplanması (rekrütman): koklear kayıpta eşik yükselir ama rahatsız edici gürlük düzeyi pek değişmez; dinamik aralık daralır.'],
  ],
  'koklea-3': [
    ['🎺', 'Bas Diyarı', 'Kokleanın tepesinde baziler zar geniş ve esnektir; kalın sesler burada en çok titreşim yaratır.', 'Baziler membran bazda dar ve sert, apekste geniş ve esnektir; ilerleyen dalga her frekansta belirli bir yerde en büyük genliğe ulaşır.'],
    ['🎹', 'Tonotopi', 'Her frekansın kokleada kendi adresi vardır; tıpkı piyano tuşları gibi.', 'Baz yüksek, apeks alçak frekansları kodlar; tonotopik düzen işitme siniri, beyin sapı çekirdekleri ve işitsel kortekste korunur.'],
    ['🌱', 'Geri Gelmeyen Hücreler', 'İnsanda hasar gören tüy hücreleri yeniden çoğalmaz; bu yüzden yüksek sesten korunmak çok değerlidir.', 'Memelilerde koklear tüy hücresi kaybı kalıcıdır; gürültüye bağlı kayıpta odyogramda sıklıkla 4 kHz civarında (3–6 kHz) çentik görülür.'],
    ['👴', 'Yaşla Gelen', 'Yaşla birlikte genellikle önce ince seslerin duyulması azalır.', 'Presbiakuzi çoğunlukla iki taraflı, simetrik ve yüksek frekanslardan başlayan sensörinöral kayıptır; gürültüde konuşmayı anlamak zorlaşır.'],
    ['⚡', 'Koklear İmplant', 'Koklear implant, sesi elektrik sinyaline çevirip işitme sinirini doğrudan uyarır.', 'Elektrot dizisi genellikle skala timpaniye yerleştirilir; bazal elektrotlar yüksek, apikal elektrotlar alçak frekansları temsil eder.'],
  ],
  'sinir': [
    ['🧵', '30.000 Lif', 'İşitme siniri yaklaşık 30.000 sinir lifinden oluşur.', 'Hücre gövdeleri spiral gangliondadır; tip I nöronlar iç, tip II nöronlar dış tüy hücrelerini innerve eder.'],
    ['🔗', 'Sekizinci Sinir', 'İşitme siniri, denge siniriyle birlikte sekizinci kafa sinirini oluşturur.', 'Vestibülokoklear sinir (VIII) iç kulak yolundan geçerek ponto-medüller bileşkede beyin sapına girer.'],
    ['📶', 'Şiddetin Kodu', 'Sesin şiddeti, liflerin ne kadar sık sinyal gönderdiği ve kaç lifin birlikte çalıştığıyla kodlanır.', 'Ateşleme hızı ve yayılım (komşu frekans liflerinin katılımı) şiddet kodlamasına katkıda bulunur; lifler farklı eşik ve dinamik aralıklara sahiptir.'],
    ['😴', 'Uyurken Test', 'İşitme siniri ve beyin sapının sese yanıtı, bebek uyurken bile ölçülebilir.', 'ABR’de ilk yaklaşık 10 ms içinde I–V dalgaları görülür; I. dalga işitme sinirinin distalinden, V. dalga lateral lemniskus/inferior kollikulus bölgesinden kaynaklanır.'],
    ['📋', 'Odyogramdaki Sıfır', 'Odyogramdaki 0 dB “hiç ses yok” demek değildir; sağlıklı gençlerin ortalama duyma eşiğidir.', 'dB HL her frekansta normal işitenlerin ortalama eşiğine göre kalibre edilir; dB SPL ise 20 µPa referanslı mutlak ses basıncıdır.'],
  ],
  'beyin-sapi': [
    ['⏱️', 'Mikrosaniye Hakemi', 'Beyin sapı, sesin iki kulağa varış zamanı arasındaki çok küçük farkları karşılaştırır.', 'Medial superior olive çoğunlukla iki kulak arası zaman farkını (ITD) işler; insanlar yaklaşık 10–20 mikrosaniyelik farkları bile ayırt edebilir.'],
    ['🌗', 'Kafanın Gölgesi', 'İnce seslerde kafanın yarattığı “ses gölgesi”, sesin yönünü bulmaya yardım eder.', 'Dupleks kuramı: düşük frekanslarda ITD, yüksek frekanslarda kafa gölgesine bağlı iki kulak arası şiddet farkı (ILD) baskındır; ILD lateral superior olivede işlenir.'],
    ['🚉', 'İlk Durak', 'İşitme sinirinin beyin sapındaki ilk durağı koklear çekirdektir.', 'İşitme siniri lifleri aynı taraftaki koklear çekirdekte sinaps yapar; buradan superior oliver kompleks ve lateral lemniskus yoluyla inferior kollikulusa ulaşılır.'],
    ['🍴', 'Diyapazon İpuçları', 'Basit bir diyapazon, işitme kaybının türü hakkında ipucu verebilir.', 'Rinne: normalde hava yolu kemik yolundan uzun duyulur; iletim tipi kayıpta tersine döner. Weber: iletim tipi kayıpta etkilenen, sensörinöral kayıpta sağlam kulağa lateralize olur.'],
    ['👥', 'İki Kulak Bir Takım', 'İki kulakla duymak, gürültülü ortamda konuşmayı anlamayı kolaylaştırır.', 'Binoral avantajlar: baş gölgesi etkisi, binoral toplanma ve sıkışmayı açma (squelch); gürültüde konuşmayı anlamaya katkıda bulunur.'],
  ],
  'korteks': [
    ['🧠', 'Şakaktaki Merkez', 'İşitme korteksi, beynin şakak lobunda, kulaklarımıza yakın bir yerde bulunur.', 'Birincil işitsel korteks temporal lobun üst yüzündeki transvers temporal girusta (Heschl girusu) yer alır; talamustaki medial genikulat cisimden girdi alır.'],
    ['🗺️', 'Beyindeki Piyano', 'İşitme korteksinin de frekans haritası vardır: farklı frekanslar farklı bölgeleri uyarır.', 'Birincil işitsel korteks tonotopik düzenlidir; çevresindeki ilişkilendirme alanları konuşma ve müzik gibi karmaşık seslerin işlenmesine katılır.'],
    ['🍹', 'Kokteyl Parti Etkisi', 'Beyin, kalabalık bir odada tek bir konuşmaya odaklanabilir.', 'Uzamsal ayrım, iki kulakla işitme ve dikkat gürültüde konuşmayı anlamaya katkıda bulunur; işitme kaybında ilk zorlaşan durumlardan biridir.'],
    ['🍌', 'Konuşma Muzu', 'Konuşma seslerinin odyogramda kapladığı alan muza benzediği için “konuşma muzu” denir.', 'Ünlüler alçak frekanslı ve güçlü, /s/, /ş/, /f/ gibi sessizler yüksek frekanslı ve zayıftır; yüksek frekans kaybında ilk kaçırılanlar bu sessizlerdir.'],
    ['🔔', 'Kulak Çınlaması', 'Kulak çınlaması (tinnitus), dışarıda bir ses yokken ses duyma hissidir ve oldukça yaygındır.', 'Tinnitus sıklıkla işitme kaybıyla birliktedir; değerlendirmede odyolojik testler ve rahatsızlık ölçekleri, yönetimde danışmanlık ve ses terapisi kullanılır.'],
  ],
};

export const CARDS: CardDef[] = (Object.keys(RAW) as BiomeId[]).flatMap((biome) => RAW[biome].map(([emoji, title, fact, tech, oneren], i) => ({ id: `${biome}:${SLOTS[i]!}`, biome, slot: SLOTS[i]!, title, fact, emoji, tech, ...(oneren ? { oneren } : {}) })));
export const cardById = (id: string) => CARDS.find((c) => c.id === id);

export function cardSlotText(slot: CardSlot, biomeHasSecret: boolean): string {
  switch (slot) {
    case 'ilk': return 'Biyomda ilk bölümü bitir';
    case 'yildiz': return 'Biyomda bir bölümde 3 yıldız al';
    case 'ozel': return biomeHasSecret ? 'Biyomda gizli altın kokleayı bul' : 'Biyomda bir bölümü hasarsız bitir';
    case 'sandik': return 'Günlük sandıktan çıkar';
    case 'usta': return 'Biyomdaki tüm bölümleri bitir';
  }
}
