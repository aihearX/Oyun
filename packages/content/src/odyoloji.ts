import type { BiomeId } from '@odi/shared';

/**
 * Odyoloji katmanı: Kulak Sözlüğü terimleri ve "Tüy Dede'nin Notu" bilgileri.
 * Her madde iki derinliktedir: herkes için sade bir cümle (plain) + isteyene teknik ayrıntı (tech, "Daha fazla").
 * Yalnızca ders kitabı düzeyinde yerleşik bilgiler (Gelfand, Hearing; Katz, Handbook of Clinical Audiology; Pickles,
 * An Introduction to the Physiology of Hearing); sayılar yaklaşık ve aralık olarak verilir. Uzman incelemesi için her
 * maddenin kaynak notu docs/odyoloji-icerik.md dosyasına da yazılır (src alanı). Emin olunmayan bilgi eklenmez.
 * Kimlikler kalıcıdır (kayıtlar ve ses dosyaları bu kimlikle eşleşir).
 */
export interface GlossaryTerm {
  id: string;
  /** önce sade Türkçe ad, sonra terim: "Kulak zarı (timpanik membran)" */
  term: string;
  /** bu terimin açıldığı bölge (o bölgeye ulaşınca sözlükte görünür) */
  region: BiomeId;
  /** küçük çizim (ui/art adı) */
  art: string;
  plain: string;
  tech: string;
  src: string;
}
export interface EarNote {
  id: string;
  region: BiomeId;
  /** herkes için tek cümle (seslendirilir) */
  plain: string;
  /** "Daha fazla": teknik ayrıntı (öğrenci düzeyi) */
  tech: string;
  src: string;
  /** seslendirme için okunuş (rakam, kısaltma varsa) */
  spoken?: string;
}

const G = 'Gelfand, Hearing: An Introduction to Psychological and Physiological Acoustics';
const K = 'Katz, Handbook of Clinical Audiology';
const P = 'Pickles, An Introduction to the Physiology of Hearing';

export const GLOSSARY: GlossaryTerm[] = [
  // ---- dış kulak
  { id: 'aurikula', term: 'Kulak kepçesi (aurikula, pinna)', region: 'dis-kulak', art: 'ear',
    plain: 'Kulağın dışta görünen, kıkırdaktan yapılmış kıvrımlı kısmı; sesi toplayıp kanala yönlendirir.',
    tech: 'Elastik kıkırdak iskeletlidir (heliks, antiheliks, tragus, konka). Kıvrımları özellikle yüksek frekanslarda yöne bağlı spektral ipuçları üretir; sesin yukarıdan mı aşağıdan mı geldiğini anlamaya yardım eder.',
    src: `${G}, dış kulak bölümü` },
  { id: 'dis-kulak-yolu', term: 'Dış kulak yolu (meatus acusticus externus)', region: 'dis-kulak', art: 'ear',
    plain: 'Kepçeden kulak zarına uzanan, yetişkinde yaklaşık 2,5 cm uzunluğundaki kanal.',
    tech: 'Hafif S biçimlidir; dış üçte biri kıkırdak, iç üçte ikisi kemiktir. Bir ucu kapalı tüp gibi rezonans yapar ve yaklaşık 2,5–3 kHz bölgesindeki sesleri güçlendirir.',
    src: `${G}, dış kulak bölümü` },
  // temel kavramlar (ilk bölgede açılır)
  { id: 'frekans', term: 'Frekans (hertz, Hz)', region: 'dis-kulak', art: 'wave',
    plain: 'Sesin saniyedeki titreşim sayısı; frekans arttıkça ses incelir.',
    tech: 'Perde algısı frekansla ilişkilidir ama doğrusal değildir. Genç ve sağlıklı kulak yaklaşık 20 Hz–20 kHz arasını duyar; saf ses odyometrisinde genellikle 250–8000 Hz arası test edilir.',
    src: `${G}, fiziksel akustik ve mutlak eşikler` },
  { id: 'desibel', term: 'Desibel (dB)', region: 'dis-kulak', art: 'signal',
    plain: 'Sesin şiddetini anlatan logaritmik birim.',
    tech: 'dB SPL, 20 µPa referanslı ses basıncı düzeyidir; odyogramda kullanılan dB HL ise her frekansta normal işitenlerin ortalama eşiğine göre ayarlanır. 10 dB artış ses şiddetini (enerjiyi) on katına çıkarır.',
    src: `${G}, fiziksel akustik; ${K}, saf ses odyometrisi` },
  { id: 'odyogram', term: 'Odyogram', region: 'dis-kulak', art: 'signal',
    plain: 'İşitme testinin sonucunu gösteren grafik: her frekansta duyulabilen en hafif ses.',
    tech: 'Yatay eksende frekans (Hz), dikey eksende işitme düzeyi (dB HL) yer alır. Hava yolu ve kemik yolu eşikleri ayrı simgelerle işaretlenir; yaygın gösterimde sağ kulak kırmızı daire, sol kulak mavi çarpıdır.',
    src: `${K}, saf ses odyometrisi (ASHA simgeleri)` },
  { id: 'odyolog', term: 'Odyolog', region: 'dis-kulak', art: 'users',
    plain: 'İşitme ve dengeyi değerlendiren, işitme cihazı ve implant uygulamalarında görev alan sağlık profesyoneli.',
    tech: 'Odyoloji; işitme ve dengenin değerlendirilmesi, rehabilitasyonu ve korunmasıyla ilgilenen bilim dalıdır. Türkiye’de lisans düzeyinde odyoloji eğitimi verilmektedir.',
    src: `${K}, giriş bölümü` },
  // ---- kanal
  { id: 'serumen', term: 'Kulak kiri (serumen)', region: 'kanal', art: 'shield',
    plain: 'Kanalı nemli tutan, toza ve mikroplara karşı koruyan doğal salgı.',
    tech: 'Kanalın dış, kıkırdak bölümündeki seruminöz ve yağ bezlerinin salgısı ile dökülen deri hücrelerinden oluşur. Kanal derisinin dışa doğru göçüyle kendiliğinden dışarı taşınır; tıkayıcı birikimi iletim tipi işitme kaybı yapabilir.',
    src: `${K}, dış kulak ve otoskopi bölümü` },
  { id: 'rezonans', term: 'Kulak kanalı rezonansı', region: 'kanal', art: 'wave',
    plain: 'Kulak kanalı, bir ucu kapalı bir boru gibi çınlar: konuşmada önemli 2–3 kHz civarındaki sesleri kendiliğinden güçlendirir.',
    tech: 'Bir ucu kapalı yaklaşık 2,5 cm’lik tüp gibi davranır; rezonansı yaklaşık 2,5–3 kHz civarındadır ve bu bölgede sesi yaklaşık 10–15 dB artırır. Kepçe ve baş ile birlikte konuşma için önemli bir bölgeyi öne çıkarır.',
    src: `${G}, dış kulak aktarım işlevi` },
  // ---- zar / orta kulak
  { id: 'timpanik-membran', term: 'Kulak zarı (timpanik membran)', region: 'zar', art: 'target',
    plain: 'Dış kulakla orta kulağı ayıran ince zar; gelen sesle titreşir.',
    tech: 'Yaklaşık 8–10 mm çapında, yaklaşık 0,1 mm kalınlığındadır ve üç katmanlıdır (dış epitel, orta fibröz, iç mukoza). Gergin kısım (pars tensa) ve gevşek kısım (pars flaccida) olarak ikiye ayrılır; çekiç sapı zara yapışıktır (umbo).',
    src: `${G}, orta kulak bölümü` },
  { id: 'ostaki', term: 'Östaki borusu (tuba auditiva)', region: 'zar', art: 'wind',
    plain: 'Orta kulağı burun-boğaz bölgesine bağlayan ve basıncı eşitleyen kanal.',
    tech: 'Normalde kapalıdır; yutkunma ve esneme sırasında açılarak orta kulak basıncını dış basınçla eşitler ve havalandırır. Çocuklarda daha kısa ve daha yataydır; orta kulak iltihabına yatkınlığın nedenlerinden biridir.',
    src: `${K}, orta kulak ve immitans bölümü` },
  { id: 'timpanometri', term: 'Timpanometri', region: 'zar', art: 'signal',
    plain: 'Kulak zarının ne kadar rahat hareket ettiğini ölçen kısa ve ağrısız test.',
    tech: 'Kanaldaki basınç değiştirilirken orta kulak sisteminin kabul ettiği enerji (admitans) ölçülür. Jerger sınıflaması: A normal; As sertleşmiş sistem; Ad aşırı hareketli sistem; B düz eğri (ör. orta kulakta sıvı ya da zar delinmesi; kanal hacmine bakılır); C negatif orta kulak basıncı.',
    src: `${K}, timpanometri bölümü (Jerger sınıflaması)` },
  // ---- kemikçikler
  { id: 'malleus', term: 'Çekiç (malleus)', region: 'kemikcikler', art: 'bolt',
    plain: 'Kulak zarına yapışık ilk kemikçik.',
    tech: 'Sapı (manubrium) kulak zarına gömülüdür; başı örsle eklem yapar. Zarın titreşimini kemikçik zincirine aktarır.',
    src: `${G}, orta kulak bölümü` },
  { id: 'inkus', term: 'Örs (inkus)', region: 'kemikcikler', art: 'bolt',
    plain: 'Çekiçle üzengi arasındaki orta kemikçik.',
    tech: 'Gövdesi çekiç başıyla, uzun kolu (lentiküler çıkıntı) üzengi başıyla eklem yapar. Çekiçle birlikte bir kaldıraç gibi çalışır.',
    src: `${G}, orta kulak bölümü` },
  { id: 'stapes', term: 'Üzengi (stapes)', region: 'kemikcikler', art: 'bolt',
    plain: 'Vücudun en küçük kemiği; tabanı iç kulağın oval penceresine oturur.',
    tech: 'Tabanı (footplate) oval pencereye anüler ligamanla tutunur ve titreşimi koklea sıvısına aktarır. Stapedius kası üzengiye bağlanır.',
    src: `${G}, orta kulak bölümü` },
  { id: 'oval-pencere', term: 'Oval pencere', region: 'kemikcikler', art: 'door',
    plain: 'Üzengi tabanının oturduğu, iç kulağa açılan pencere.',
    tech: 'Üzengi tabanının itmesiyle skala vestibulideki perilenfte basınç dalgası başlar. Orta kulak, havadaki sesi sıvıya bu küçük pencereden yükselterek aktarır.',
    src: `${G}, orta kulak aktarımı` },
  { id: 'akustik-refleks', term: 'Akustik refleks (stapedius refleksi)', region: 'kemikcikler', art: 'shield',
    plain: 'Çok yüksek seste orta kulaktaki minik bir kasın kasılarak iletimi azaltması.',
    tech: 'Yüksek şiddetli uyaranla stapedius kası iki taraflı kasılır; normal işitenlerde tipik refleks eşikleri yaklaşık 70–100 dB HL arasındadır. İletimi özellikle düşük frekanslarda azaltır; klinikte immitans ölçümüyle değerlendirilir.',
    src: `${K}, akustik refleks bölümü` },
  // ---- koklea 1
  { id: 'koklea', term: 'Koklea', region: 'koklea-1', art: 'shell',
    plain: 'İç kulaktaki sarmal işitme organı; titreşimi sinir sinyaline çevirir.',
    tech: 'Kemik bir eksen (modiolus) çevresinde yaklaşık 2,5–2,75 tur kıvrılır. İçinde üç sıvı dolu bölme bulunur: skala vestibuli, skala media (koklear kanal) ve skala timpani.',
    src: `${P}, koklea anatomisi` },
  { id: 'yuvarlak-pencere', term: 'Yuvarlak pencere', region: 'koklea-1', art: 'door',
    plain: 'Kokleadaki ikinci pencere; sıvının hareket edebilmesine izin verir.',
    tech: 'Skala timpaninin tabanındaki zarlı açıklıktır. Oval pencere içe itildiğinde dışa doğru esneyerek sıkıştırılamayan perilenfin yer değiştirmesini sağlar.',
    src: `${G}, iç kulak bölümü` },
  { id: 'skalalar', term: 'Koklear bölmeler (skala vestibuli, media, timpani)', region: 'koklea-1', art: 'wave',
    plain: 'Kokleanın içindeki, üst üste duran üç sıvı dolu kanal.',
    tech: 'Skala vestibuli ile skala timpani perilenf içerir ve kokleanın tepesindeki helikotremada birleşir. Aradaki skala media endolenf içerir; Reissner zarı ve baziler membran onu diğer iki bölmeden ayırır.',
    src: `${P}, koklea anatomisi` },
  { id: 'endolenf', term: 'Perilenf ve endolenf', region: 'koklea-1', art: 'wave',
    plain: 'İç kulağın birbirinden farklı iki sıvısı.',
    tech: 'Perilenf hücre dışı sıvıya benzer ve sodyumdan zengindir; endolenf ise potasyumdan zengindir. Skala medianın yaklaşık +80 mV’luk endokoklear potansiyeli tüy hücrelerinin uyarılmasını kolaylaştırır.',
    src: `${P}, koklear sıvılar ve endokoklear potansiyel` },
  // ---- koklea 2
  { id: 'corti', term: 'Corti organı', region: 'koklea-2', art: 'note',
    plain: 'Baziler zarın üstünde duran ve tüy hücrelerini taşıyan asıl işitme duyu organı.',
    tech: 'Bir sıra iç tüy hücresi, üç sıra dış tüy hücresi, destek hücreleri ve üstünü örten tektoryal membrandan oluşur.',
    src: `${P}, Corti organı` },
  { id: 'ic-tuy', term: 'İç tüy hücreleri', region: 'koklea-2', art: 'note',
    plain: 'Sesi işitme sinirine ileten asıl algılayıcı hücreler.',
    tech: 'Bir kulakta yaklaşık 3.500 tane, tek sıra hâlindedir. İşitme siniri afferent liflerinin büyük çoğunluğu (yaklaşık %90–95) iç tüy hücrelerinden bilgi taşır.',
    src: `${P}, koklear innervasyon` },
  { id: 'dis-tuy', term: 'Dış tüy hücreleri', region: 'koklea-2', art: 'note',
    plain: 'Hafif sesleri güçlendiren, sesle birlikte boyu uzayıp kısalan hücreler.',
    tech: 'Bir kulakta yaklaşık 12.000 tane, üç sıra hâlindedir. Prestin proteiniyle elektromotilite gösterirler ve koklear amplifikatör olarak duyarlılığı ve frekans seçiciliğini artırırlar; otoakustik emisyonların kaynağıdırlar.',
    src: `${P}, dış tüy hücresi elektromotilitesi` },
  { id: 'stereosilya', term: 'Stereosilya', region: 'koklea-2', art: 'wind',
    plain: 'Tüy hücrelerinin üstündeki minik tüy demetleri; eğilince sinyal başlar.',
    tech: 'Basamaklı sıralar hâlinde dizilirler. Demet uzun sıraya doğru eğildiğinde uç bağlantıları (tip link) mekanoelektrik iletim kanallarını açar; endolenften K+ girişiyle hücre depolarize olur.',
    src: `${P}, mekanoelektrik iletim` },
  { id: 'oae', term: 'Otoakustik emisyon (OAE)', region: 'koklea-2', art: 'wave',
    plain: 'Sağlıklı iç kulağın ürettiği, kulak kanalında ölçülebilen çok hafif ses.',
    tech: 'Dış tüy hücrelerinin etkin işleminin yan ürünüdür; kanala yerleştirilen hassas bir prob mikrofonla kaydedilir. Hızlı ve ağrısız olduğu için yenidoğan işitme taramasında yaygın kullanılır.',
    src: `${K}, otoakustik emisyonlar bölümü` },
  // ---- koklea 3
  { id: 'baziler', term: 'Baziler membran', region: 'koklea-3', art: 'wave',
    plain: 'Kokleanın tabanından tepesine uzanan ve her sese göre farklı yerinde en çok titreşen zar.',
    tech: 'Tabanda (baz) dar ve sert, tepede (apeks) geniş ve esnektir. İlerleyen dalga tabandan tepeye yayılır ve her frekans için belirli bir noktada en büyük genliğe ulaşır.',
    src: `${G}, koklear mekanik (ilerleyen dalga)` },
  { id: 'tonotopi', term: 'Tonotopi', region: 'koklea-3', art: 'signal',
    plain: 'Her frekansın kokleada ve işitme yolunda kendi yerinin olması.',
    tech: 'Koklea tabanı yüksek, tepesi alçak frekansları kodlar. Bu frekans haritası işitme siniri, beyin sapı çekirdekleri ve işitsel kortekste de korunur.',
    src: `${G}, tonotopik düzen` },
  { id: 'stria', term: 'Stria vaskülaris', region: 'koklea-3', art: 'bolt',
    plain: 'Kokleanın yan duvarında, iç kulağın “pili” gibi çalışan doku.',
    tech: 'Endolenfin potasyumdan zengin bileşimini ve endokoklear potansiyeli üretir. Yaşa bağlı işitme kaybının striyal (metabolik) tipinde etkilendiği düşünülür.',
    src: `${P}, stria vaskülaris` },
  { id: 'helikotrema', term: 'Helikotrema', region: 'koklea-3', art: 'shell',
    plain: 'Kokleanın tepesinde iki sıvı kanalını birleştiren küçük açıklık.',
    tech: 'Skala vestibuli ile skala timpaniyi apekste birleştirir; çok düşük frekanslarda basınç farkının dengelenmesine katkıda bulunur.',
    src: `${G}, iç kulak bölümü` },
  // ---- sinir
  { id: 'isitme-siniri', term: 'İşitme siniri (VIII. kafa sinirinin koklear dalı)', region: 'sinir', art: 'bolt',
    plain: 'Kokleadan beyin sapına sinyal taşıyan sinir.',
    tech: 'Yaklaşık 30.000 lif içerir; hücre gövdeleri spiral gangliondadır. Vestibüler dalla birlikte vestibülokoklear siniri (VIII. kafa siniri) oluşturur ve iç kulak yolundan geçerek beyin sapına girer.',
    src: `${P}, işitme siniri` },
  { id: 'spiral-ganglion', term: 'Spiral ganglion', region: 'sinir', art: 'star',
    plain: 'İşitme siniri hücrelerinin gövdelerinin toplandığı yer.',
    tech: 'Modiolus içinde yer alır. Tip I nöronlar iç tüy hücrelerini, daha az sayıdaki tip II nöronlar dış tüy hücrelerini innerve eder.',
    src: `${P}, koklear innervasyon` },
  { id: 'abr', term: 'İşitsel beyin sapı yanıtı (ABR)', region: 'sinir', art: 'signal',
    plain: 'Sese karşı işitme siniri ve beyin sapından kaydedilen küçük elektrik dalgaları.',
    tech: 'Uyarandan sonraki ilk yaklaşık 10 ms içinde I–V dalgaları görülür. I. dalga işitme sinirinin distal kısmından, V. dalga lateral lemniskus ve inferior kollikulus bölgesinden kaynaklanır; V. dalga eşik tahmininde en çok izlenen dalgadır.',
    src: `${K}, ABR bölümü` },
  // ---- beyin sapı
  { id: 'koklear-cekirdek', term: 'Koklear çekirdek', region: 'beyin-sapi', art: 'target',
    plain: 'İşitme sinirinin beyin sapındaki ilk durağı.',
    tech: 'Ponsla medulla oblongatanın birleştiği bölgededir; ventral ve dorsal bölümleri vardır. İşitme siniri lifleri burada aynı taraftaki nöronlarla sinaps yapar.',
    src: `${P}, merkezî işitme yolları` },
  { id: 'superior-oliver', term: 'Superior oliver kompleks', region: 'beyin-sapi', art: 'users',
    plain: 'İki kulaktan gelen bilgiyi ilk kez birleştiren merkez.',
    tech: 'Medial superior olive çoğunlukla iki kulak arasındaki zaman farkını (ITD), lateral superior olive şiddet farkını (ILD) işler. Akustik refleks yolunda da yer alır.',
    src: `${P}, iki kulakla işitme` },
  { id: 'lateral-lemniskus', term: 'Lateral lemniskus', region: 'beyin-sapi', art: 'wind',
    plain: 'Beyin sapında yukarı doğru uzanan işitme yolu demeti.',
    tech: 'Koklear çekirdek ve superior oliver kompleksten gelen yükselen lifleri inferior kollikulusa taşır; yol boyunca kendi çekirdekleri de vardır.',
    src: `${P}, merkezî işitme yolları` },
  { id: 'inferior-kollikulus', term: 'İnferior kollikulus', region: 'beyin-sapi', art: 'target',
    plain: 'Orta beyindeki büyük işitme kavşağı.',
    tech: 'Yükselen işitme yollarının neredeyse tamamı burada sinaps yapar; farklı çekirdeklerden gelen bilgi burada bütünleşir ve talamusa iletilir.',
    src: `${P}, merkezî işitme yolları` },
  // ---- korteks
  { id: 'mgb', term: 'Medial genikulat cisim', region: 'korteks', art: 'star',
    plain: 'Talamustaki işitme istasyonu; sinyali beyin kabuğuna aktarır.',
    tech: 'Talamusun işitsel çekirdeğidir; inferior kollikulustan gelen lifleri alır ve işitsel radyasyonla işitsel kortekse iletir.',
    src: `${P}, talamus ve işitsel korteks` },
  { id: 'isitsel-korteks', term: 'İşitsel korteks (Heschl girusu)', region: 'korteks', art: 'bulb',
    plain: 'Beynin sesleri algılayıp anlamlandıran bölgesi.',
    tech: 'Birincil işitsel korteks, temporal lobun üst yüzündeki transvers temporal girusta (Heschl girusu) yer alır ve tonotopik düzenlidir. Çevresindeki işitsel ilişkilendirme alanları konuşma ve müzik gibi karmaşık seslerin işlenmesine katılır.',
    src: `${P}, işitsel korteks` },
  { id: 'wernicke', term: 'Wernicke alanı', region: 'korteks', art: 'chat',
    plain: 'Konuşmayı anlamada önemli rol oynayan dil bölgesi.',
    tech: 'Çoğu kişide sol hemisferde, üst temporal girusun arka kısmında yer alır; işitsel kortekse komşudur.',
    src: `${P}, işitsel korteks ve dil` },
];

export const EAR_NOTES: EarNote[] = [
  { id: 'kepce-yon', region: 'dis-kulak', plain: 'Kulak kepçesinin kıvrımları, sesin yukarıdan mı aşağıdan mı geldiğini anlamamıza yardım eder.',
    tech: 'Kepçe, sesin geliş açısına göre yüksek frekanslarda farklı tepe ve çentikler oluşturur; beyin bu spektral ipuçlarını dikey yön ve ön-arka ayrımı için kullanır.', src: `${G}, ses kaynağının yerini belirleme` },
  { id: 'hz', region: 'dis-kulak', plain: 'Hertz, sesin saniyedeki titreşim sayısıdır; çok titreşen ses ince duyulur.',
    tech: 'Genç ve sağlıklı insan kulağı yaklaşık 20 Hz–20 kHz arasını duyar ve yaklaşık 1–4 kHz arasında en duyarlıdır. Perde algısı frekansla ilişkilidir ama doğrusal değildir.', src: `${G}, mutlak eşikler` },
  { id: 'db', region: 'dis-kulak', plain: 'Desibel ölçeği logaritmiktir: küçük bir sayı artışı büyük bir enerji artışı demektir.',
    tech: 'Ses basıncı düzeyi = 20·log10(p/p0), p0 = 20 µPa. 6 dB artış ses basıncını yaklaşık iki katına, 20 dB artış on katına çıkarır; 10 dB artış ses şiddetini (enerjiyi) on katına çıkarır.', src: `${G}, fiziksel akustik` },
  { id: 'kanal-rezonans', region: 'kanal', plain: 'Kulak kanalı, bir ucu kapalı bir boru gibi çınlar: konuşmada önemli 2–3 kHz civarındaki sesleri kendiliğinden güçlendirir.',
    spoken: 'Kulak kanalı, bir ucu kapalı bir boru gibi çınlar: konuşmada önemli iki-üç kilohertz civarındaki sesleri kendiliğinden güçlendirir.',
    tech: 'Bir ucu kapalı yaklaşık 2,5 cm’lik tüp gibi davranır; rezonansı yaklaşık 2,5–3 kHz civarındadır ve bu bölgede sesi yaklaşık 10–15 dB artırır.', src: `${G}, dış kulak aktarım işlevi` },
  { id: 'serumen-temiz', region: 'kanal', plain: 'Kulak kendi kendini temizler; pamuklu çubuk kiri çoğu zaman daha derine iter.',
    tech: 'Kanal derisi epitel göçüyle kiri dışa taşır. Tıkayıcı serumen iletim tipi kayba yol açabilir; çıkarılması gerektiğinde bu işlem sağlık profesyonelince yapılmalıdır.', src: `${K}, otoskopi ve serumen yönetimi` },
  { id: 'gurultu-sure', region: 'kanal', plain: 'Ses ne kadar yüksekse, güvenle dinleyebileceğimiz süre o kadar kısalır.',
    tech: 'NIOSH önerisine göre 85 dB(A)’de 8 saatlik maruziyet sınırdır ve her 3 dB artış güvenli süreyi yarıya indirir (eşit enerji ilkesi): 88 dB(A)’de yaklaşık 4 saat.', src: 'NIOSH, Occupational Noise Exposure (1998)' },
  { id: 'empedans', region: 'zar', plain: 'Orta kulak, havadaki sesi iç kulak sıvısına aktarırken onu güçlendiren bir yükseltici gibi çalışır.',
    tech: 'Hava ile sıvı arasındaki empedans farkı yüzünden enerjinin çoğu yansırdı. Kulak zarı ile üzengi tabanı arasındaki alan oranı (yaklaşık 17:1) ve kemikçik kaldıracı (yaklaşık 1,3:1) basıncı yaklaşık 20 kat, yani yaklaşık 25–30 dB artırır.', src: `${G}, orta kulak empedans uyumu` },
  { id: 'timpanometri', region: 'zar', plain: 'Timpanometri, kulak zarının ne kadar rahat hareket ettiğini ölçen kısa ve ağrısız bir testtir.',
    tech: 'Jerger sınıflaması: A normal; As sertleşmiş sistem (ör. otoskleroz); Ad aşırı hareketli sistem (ör. kemikçik zinciri kopukluğu); B düz eğri (ör. orta kulakta sıvı ya da zar delinmesi; kanal hacmi ayırt ettirir); C negatif orta kulak basıncı.', src: `${K}, timpanometri bölümü` },
  { id: 'ome', region: 'zar', plain: 'Çocuklarda orta kulakta sıvı birikmesi sık görülür ve işitmeyi geçici olarak azaltabilir.',
    tech: 'Efüzyonlu otitis mediada timpanogram tipik olarak B tipidir ve hafif-orta derecede iletim tipi işitme kaybı görülebilir; çoğu kendiliğinden düzelir, uzun sürenler izlenir.', src: `${K}, orta kulak bozuklukları` },
  { id: 'akustik-refleks', region: 'kemikcikler', plain: 'Çok yüksek seste orta kulaktaki minik bir kas kasılır ve kulağı biraz korur.',
    tech: 'Stapedius refleksi iki taraflıdır; normal işitenlerde tipik eşikler yaklaşık 70–100 dB HL arasındadır. Belli bir gecikmeyle devreye girdiği için ani darbe seslerine karşı koruması sınırlıdır.', src: `${K}, akustik refleks bölümü` },
  { id: 'otoskleroz', region: 'kemikcikler', plain: 'Bazı kişilerde üzengi kemiği sertleşip hareketini kaybedebilir; buna otoskleroz denir.',
    tech: 'Üzengi tabanının fiksasyonu ilerleyici iletim tipi kayba yol açar. Odyogramda yaklaşık 2 kHz’te kemik yolunda Carhart çentiği görülebilir; timpanogram çoğunlukla As tipidir ve akustik refleks alınamayabilir.', src: `${K}, otoskleroz` },
  { id: 'kemik-yolu', region: 'kemikcikler', plain: 'Sesi kafatası kemikleri yoluyla da duyarız; kendi sesimizi kayıtta farklı bulmamızın bir nedeni budur.',
    tech: 'Kemik yolu testinde vibratör mastoide konur ve doğrudan kokleayı uyarır. Hava ve kemik yolu eşikleri arasındaki fark (hava-kemik aralığı) iletim tipi işitme kaybını gösterir.', src: `${K}, kemik yolu odyometrisi` },
  { id: 'dalga', region: 'koklea-1', plain: 'Kokleadaki dalga tabandan tepeye doğru ilerler; her ses kendi noktasında en büyük olur.',
    tech: 'Georg von Békésy, ilerleyen dalgayı gözlemlediği çalışmalarıyla 1961 Nobel Fizyoloji veya Tıp Ödülü’nü aldı. Canlı kulakta dış tüy hücrelerinin katkısıyla tepe çok daha keskindir.', src: `${G}, koklear mekanik` },
  { id: 'pil', region: 'koklea-1', plain: 'Kokleanın içinde, küçük bir pil gibi bir elektrik gerilimi vardır.',
    tech: 'Skala medianın yaklaşık +80 mV’luk endokoklear potansiyeli stria vaskülaris tarafından korunur ve tüy hücrelerine K+ girişini kolaylaştırır.', src: `${P}, endokoklear potansiyel` },
  { id: 'denge', region: 'koklea-1', plain: 'İç kulak yalnızca işitmez, dengemizi de sağlar.',
    tech: 'Üç yarım daire kanalı açısal ivmeyi, utrikül ve sakkül (otolit organları) doğrusal ivmeyi ve yerçekimini algılar; bilgi VIII. kafa sinirinin vestibüler dalıyla taşınır.', src: `${K}, vestibüler sistem` },
  { id: 'oae-not', region: 'koklea-2', plain: 'Sağlıklı bir kulak kendi çok hafif sesini üretir; bebeklerin işitmesi bununla taranabilir.',
    tech: 'Otoakustik emisyonlar dış tüy hücrelerinin etkin işleminin yan ürünüdür ve kanalda prob mikrofonla ölçülür. Dış tüy hücresi işlevi bozulduğunda genellikle kaydedilemez.', src: `${K}, otoakustik emisyonlar` },
  { id: 'prestin', region: 'koklea-2', plain: 'Dış tüy hücreleri sesle birlikte dans eder ve hafif sesleri güçlendirir.',
    tech: 'Prestin proteini sayesinde dış tüy hücreleri elektriksel uyarıyla boy değiştirir (elektromotilite). Bu koklear amplifikatör, hafif seslere duyarlılığı ve frekans seçiciliğini artırır.', src: `${P}, dış tüy hücresi elektromotilitesi` },
  { id: 'rekrutman', region: 'koklea-2', plain: 'İç kulak kaynaklı işitme kaybında sesler bir noktadan sonra hızla fazla yüksek gelebilir.',
    tech: 'Gürlük toplanması (rekrütman): koklear kayıpta eşik yükselirken rahatsız edici gürlük düzeyi pek değişmez, dinamik aralık daralır. İşitme cihazlarında sıkıştırma (kompresyon) bu yüzden kullanılır.', src: `${K}, koklear kayıp ve gürlük` },
  { id: 'presbiakuzi', region: 'koklea-3', plain: 'Yaşla birlikte genellikle önce ince seslerin duyulması azalır.',
    tech: 'Presbiakuzi çoğunlukla iki taraflı, simetrik ve yüksek frekanslardan başlayan sensörinöral işitme kaybıdır; konuşmayı özellikle gürültüde anlamakta güçlük yaygındır.', src: `${K}, presbiakuzi` },
  { id: 'gurultu-centik', region: 'koklea-3', plain: 'Uzun süre yüksek sese maruz kalmak tüy hücrelerine kalıcı zarar verebilir.',
    tech: 'Gürültüye bağlı işitme kaybında odyogramda tipik olarak 3–6 kHz bölgesinde, sıklıkla 4 kHz civarında bir çentik görülür ve 8 kHz’te kısmi düzelme olur.', src: `${K}, gürültüye bağlı işitme kaybı` },
  { id: 'implant', region: 'koklea-3', plain: 'Koklear implant, sesi elektrik sinyaline çevirip işitme sinirini doğrudan uyarır.',
    tech: 'Elektrot dizisi genellikle skala timpaniye yerleştirilir; tonotopiye uygun olarak bazal elektrotlar yüksek, apikal elektrotlar alçak frekansları temsil eder.', src: `${K}, koklear implantlar` },
  { id: 'ototoksik', region: 'koklea-3', plain: 'Bazı ilaçlar iç kulağa zarar verebilir; bu yüzden hekim kontrolünde kullanılırlar.',
    tech: 'Aminoglikozid antibiyotikler ve sisplatin gibi ilaçlar ototoksik olabilir; hasar genellikle yüksek frekanslardan başlar. İzlemde yüksek frekans odyometrisi ve OAE kullanılabilir.', src: `${K}, ototoksisite izlemi` },
  { id: 'abr-not', region: 'sinir', plain: 'Uyuyan bir bebeğin bile işitmesi, beyin sapından gelen minik elektrik dalgalarıyla değerlendirilebilir.',
    tech: 'ABR’de ilk yaklaşık 10 ms içinde I–V dalgaları görülür: I. dalga işitme sinirinin distal kısmından, V. dalga lateral lemniskus/inferior kollikulus bölgesinden kaynaklanır. V. dalga eşik tahmininde en çok izlenen dalgadır.', src: `${K}, ABR bölümü` },
  { id: 'kayip-turleri', region: 'sinir', plain: 'İşitme kaybı, sorunun kulağın hangi bölümünde olduğuna göre adlandırılır.',
    tech: 'İletim tipi: dış ya da orta kulak; sensörinöral: koklea ya da işitme siniri; mikst: ikisi birlikte. Odyogramda hava ve kemik yolu eşikleri karşılaştırılarak ayrılır.', src: `${K}, odyogram yorumu` },
  { id: 'hl-spl', region: 'sinir', plain: 'Odyogramdaki 0 dB “hiç ses yok” demek değildir; genç ve sağlıklı kulakların ortalama duyma eşiğidir.', spoken: 'Odyogramdaki sıfır desibel, hiç ses yok demek değildir; genç ve sağlıklı kulakların ortalama duyma eşiğidir.',
    tech: 'dB HL, her frekansta normal işitenlerin ortalama eşiğine göre kalibre edilir; dB SPL ise mutlak ses basıncıdır (20 µPa referans). Bu yüzden 0 dB HL farklı frekanslarda farklı dB SPL değerlerine karşılık gelir.', src: `${K}, saf ses odyometrisi` },
  { id: 'tarama', region: 'sinir', plain: 'Yenidoğan işitme taraması, işitme kaybını erken fark edip erken desteklemeyi sağlar.',
    tech: 'Taramada OAE ve/veya otomatik ABR kullanılır. Uluslararası 1-3-6 ilkesi (JCIH): bir ayda tarama, üç ayda tanı, altı ayda müdahale.', src: 'Joint Committee on Infant Hearing (JCIH), Position Statement' },
  { id: 'yon', region: 'beyin-sapi', plain: 'İki kulağımız sayesinde sesin nereden geldiğini buluruz.',
    tech: 'Düşük frekanslarda iki kulak arasındaki zaman farkı (ITD), yüksek frekanslarda kafa gölgesinin yarattığı şiddet farkı (ILD) daha baskındır (dupleks kuramı). İlk karşılaştırma superior oliver komplekste yapılır.', src: `${G}, iki kulakla işitme ve yön bulma` },
  { id: 'maskeleme', region: 'beyin-sapi', plain: 'Bir ses başka bir sesi bastırabilir; buna maskeleme denir.',
    tech: 'Klinikte test edilmeyen kulağın teste karışmasını (çapraz işitme) önlemek için o kulağa maskeleme gürültüsü verilir. Supra-aural kulaklıkla hava yolunda interaural attenüasyon en az yaklaşık 40 dB, kemik yolunda yaklaşık 0 dB kabul edilir.', src: `${K}, klinik maskeleme` },
  { id: 'rinne-weber', region: 'beyin-sapi', plain: 'Diyapazon testleri, basit bir çatalla işitme kaybının türü hakkında ipucu verir.',
    tech: 'Rinne testinde normalde hava yolu kemik yolundan daha uzun duyulur (pozitif); iletim tipi kayıpta bu tersine döner. Weber testinde ses, tek taraflı iletim kaybında etkilenen kulağa, sensörinöral kayıpta sağlam kulağa lateralize olur.', src: `${K}, diyapazon testleri` },
  { id: 'konusma-muzu', region: 'korteks', plain: 'Konuşma seslerinin odyogramda kapladığı alan muza benzediği için “konuşma muzu” denir.',
    tech: 'Ünlüler daha alçak frekanslarda ve daha güçlüdür; /s/, /ş/, /f/ gibi sessizler yüksek frekanslarda ve daha zayıftır. Yüksek frekans kaybında bu sessizler ilk kaçırılanlardır.', src: `${K}, konuşma odyometrisi` },
  { id: 'kokteyl', region: 'korteks', plain: 'Beyin, kalabalık bir odada tek bir konuşmaya odaklanabilir.',
    tech: '“Kokteyl parti etkisi”: iki kulakla işitme, ses kaynaklarının uzamsal ayrımı ve dikkat, gürültüde konuşmayı anlamaya katkıda bulunur; işitme kaybında ilk zorlaşan durumlardan biridir.', src: `${G}, iki kulakla işitme` },
  { id: 'cihaz', region: 'korteks', plain: 'İşitme cihazları sesi her frekans için ayrı ayrı ayarlayarak yükseltir.',
    tech: 'Cihaz kazancı odyograma göre reçete formülleriyle (ör. NAL-NL2, DSL v5) belirlenir ve gerçek kulak ölçümüyle doğrulanır.', src: `${K}, işitme cihazı uygulaması` },
  { id: 'tinnitus', region: 'korteks', plain: 'Kulak çınlaması, dışarıda bir ses yokken ses duyma hissidir ve oldukça yaygındır.',
    tech: 'Tinnitus sıklıkla işitme kaybıyla birliktedir. Değerlendirmede odyolojik testler ve rahatsızlık ölçekleri kullanılır; danışmanlık ve ses terapisi yaygın yaklaşımlardır.', src: `${K}, tinnitus` },
];

export const glossaryById = (id: string) => GLOSSARY.find((g) => g.id === id);
