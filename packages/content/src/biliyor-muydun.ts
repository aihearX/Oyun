/**
 * "Biliyor muydun?" — her bölümün sonuç ekranında tek satırlık bilgi (sahip kararı 31, YN-059; durum: SAHİP ONAYI BEKLİYOR,
 * metinler yayında ama sahip listeyi gözden geçirecek). Bölüm başına iki derinlik: `genel` herkes için, `odyoloji` Bilgi düzeyi
 * "Odyoloji öğrencisi" seçen için (Ayarlar › Bilgi düzeyi; Tüy Dede notlarının "Daha fazla" satırıyla aynı ayrım). Her satır tek
 * cümle, en çok 120 karakter; seslendirilmez (yalnız yazı).
 *
 * İlke (docs/odyoloji-icerik.md): yalnız ders kitabı düzeyinde yerleşik bilgi, sayılar yaklaşık ve standart değerler. Oyuncuya tanı
 * ya da tedavi önerisi yok; timpanogram tek başına tanı koydurmaz; iç kulak organının adı her yerde "Koklea". Tüy Dede notlarını ve
 * Kulak Kartlarını kelimesi kelimesine tekrar etmez (birim testi). Sayı ile birim arasında bölünmez boşluk (U+00A0).
 */

export interface BiliyorMuydun {
  /** bölüm numarası (1–40, HUMAN_JOURNEY) */
  bolum: number;
  /** herkes için */
  genel: string;
  /** Odyoloji öğrencisi düzeyi */
  odyoloji: string;
  src: string;
}

const G = 'Gelfand, Hearing: An Introduction to Psychological and Physiological Acoustics';
const K = 'Katz, Handbook of Clinical Audiology';
const P = 'Pickles, An Introduction to the Physiology of Hearing';
const KBB = 'Cummings Otolaryngology; Scott-Brown’s Otorhinolaryngology';

export const BILIYOR_MUYDUN: BiliyorMuydun[] = [
  { bolum: 1, genel: 'Ses, havadaki basınç dalgalarıdır; uzay gibi havasız bir boşlukta ses yayılamaz.',
    odyoloji: 'Ses havada 20 °C’de yaklaşık 343 m/sn hızla ilerler; suda bu hız yaklaşık dört kat fazladır.',
    src: `${G}, fiziksel akustik` },
  { bolum: 2, genel: 'Kulak kepçesi kıkırdaktan yapılmıştır; ama kulak memesinde kıkırdak yoktur.',
    odyoloji: 'Kepçenin en derin çukuru konkadır; konka rezonansı yaklaşık 5 kHz civarındadır.',
    src: `${G}, dış kulak aktarım işlevi` },
  { bolum: 3, genel: 'Kanal girişindeki ince kıllar ve kir, toz ile küçük böceklerin içeri ilerlemesini zorlaştırır.',
    odyoloji: 'Kıllar, yağ ve serumen bezleri yalnız kanalın dış, kıkırdak bölümünde bulunur; kemik bölümde bez yoktur.',
    src: `${KBB}, dış kulak anatomisi` },
  { bolum: 4, genel: 'Şimşeği görünce saymaya başla: yaklaşık her 3 saniye, yıldırımın 1 km uzakta olduğunu gösterir.',
    odyoloji: 'İnsan, tam önden gelen seslerde yaklaşık 1 derecelik yön farkını ayırt edebilir (en küçük duyulabilir açı).',
    src: `${G}, fiziksel akustik; ses kaynağının yerini belirleme` },
  { bolum: 5, genel: 'Bebeklerde kulak kanalı kısa ve düzdür; yetişkindeki S biçimli kıvrım büyüdükçe oluşur.',
    odyoloji: 'Kepçenin yön ipuçları çoğunlukla 4 kHz üstündedir; ancak bu kısa dalga boyları kıvrımlarla etkileşir.',
    src: `${KBB}, dış kulak gelişimi; ${G}, ses kaynağının yerini belirleme` },
  { bolum: 6, genel: 'Kulak kanalının iç üçte ikisi kemik içinden geçer; oradaki deri çok ince ve dokunmaya çok duyarlıdır.',
    odyoloji: 'Kanalın arka duvarını vagus sinirinin bir dalı (Arnold siniri) duyurur; dokunmak bazı kişilerde öksürtür.',
    src: `${KBB}, dış kulak yolunun sinirleri` },
  { bolum: 7, genel: 'Kulak kirinin ıslak ve kuru olmak üzere iki tipi vardır; hangisi olacağını büyük ölçüde genler belirler.',
    odyoloji: 'Serumen tipini ABCC11 genindeki tek bir varyant belirler; kuru tip Doğu Asya’da yaygındır.',
    src: `${KBB}, serumen; Yoshiura ve ark. (2006), Nature Genetics` },
  { bolum: 8, genel: 'Kulağa çok soğuk ya da sıcak su girmesi, iç kulaktaki denge organını uyarıp baş döndürebilir.',
    odyoloji: 'Kalorik test bu ilkeyi kullanır: kanala 30 ve 44 °C su ya da hava verilerek yatay yarım daire kanalı uyarılır.',
    src: `${K}, vestibüler değerlendirme (kalorik test)` },
  { bolum: 9, genel: 'Kulak zarı yarı saydamdır; ışık tutulunca üzerinde parlak bir üçgen yansıma görülür.',
    odyoloji: 'Sağlıklı zarda ışık konisi umbodan ön-alt bölüme uzanır: sağ kulakta saat 5, sol kulakta saat 7 yönünde.',
    src: `${K}, otoskopi` },
  { bolum: 10, genel: 'Kulak zarı dümdüz değildir; ortası içe doğru çekik, sığ bir huni biçimindedir.',
    odyoloji: 'Pars tensanın orta fibröz katmanı ışınsal ve dairesel liflerden oluşur; zara gerginlik ve dayanıklılık verir.',
    src: `${G}, orta kulak anatomisi` },
  { bolum: 11, genel: 'Her nesnenin en kolay titreştiği bir frekansı vardır; buna o nesnenin rezonans frekansı denir.',
    odyoloji: 'Yetişkin orta kulağının rezonans frekansı genellikle yaklaşık 800–1200 Hz arasındadır.',
    src: `${G}, rezonans; ${K}, çok frekanslı timpanometri` },
  { bolum: 12, genel: 'Uçak inerken kulak tıkanabilir: dışarıdaki basınç artar, orta kulaktaki basınç bir süre geride kalır.',
    odyoloji: 'Timpanogramda tepe basıncı normalde yaklaşık −100 ile +50 daPa arasındadır; eğri tek başına tanı koydurmaz.',
    src: `${G}, orta kulak; ${K}, timpanometri` },
  { bolum: 13, genel: 'Kulak kemikçikleri doğduğumuzda neredeyse yetişkin boyutundadır; büyürken pek değişmezler.',
    odyoloji: 'Kemikçikler birbirine vücudun en küçük eklemleriyle bağlanır: inkudomalleal ve inkudostapedial eklem.',
    src: `${G}, orta kulak anatomisi` },
  { bolum: 14, genel: 'Örs kemiğinin adı, demircilerin üzerinde metal dövdüğü örse benzemesinden gelir.',
    odyoloji: 'İnkusun uzun kolu ince kanlanır; kronik orta kulak hastalığında en sık aşınan kemikçik bölümüdür.',
    src: `${G}, orta kulak anatomisi; ${KBB}, kronik otitis media` },
  { bolum: 15, genel: 'Üzengi kemiğinin adı, ata binerken ayağın konduğu üzengiye benzemesinden gelir.',
    odyoloji: 'Stapes tabanı oval pencereye anüler ligamanla tutunur; taban alanı yaklaşık 3 mm²’dir.',
    src: `${G}, orta kulak anatomisi` },
  { bolum: 16, genel: 'Kemikçik zinciri bir yerden koparsa ses iç kulağa zor ulaşır; bu, iletim tipi işitme kaybına yol açar.',
    odyoloji: 'Zar sağlamken kemikçik zinciri kopukluğu, en büyük iletim tipi kayba (yaklaşık 60 dB) yol açabilir.',
    src: `${K}, iletim tipi işitme kaybı` },
  { bolum: 17, genel: 'Fısıltı yaklaşık 30 dB, karşılıklı sakin konuşma ise yaklaşık 60 dB düzeyindedir.',
    odyoloji: 'Fısıltıda ses telleri titreşmez; bu yüzden fısıltının perdesi yoktur, ünlüler bile gürültüyle üretilir.',
    src: `${G}, konuşma akustiği` },
  { bolum: 18, genel: 'Kemik yolu cihazları sesi kafatasına titreşim olarak verir; titreşim doğrudan kokleaya ulaşır.',
    odyoloji: 'Kemik yolunda iki kulak arası zayıflama çok azdır (yaklaşık 0–10 dB); bu yüzden maskeleme sık gerekir.',
    src: `${K}, kemik yolu odyometrisi ve maskeleme` },
  { bolum: 19, genel: 'Orta kulakta iki minik kas vardır: stapedius ve tensor timpani; ikisi de kemikçiklere tutunur.',
    odyoloji: 'Stapedius yüz siniriyle (VII), tensor timpani trigeminal sinirin mandibüler dalıyla (V3) uyarılır.',
    src: `${G}, akustik refleks` },
  { bolum: 20, genel: 'Kulak kiri, kanalı neredeyse tamamen tıkamadıkça işitmeyi genellikle pek etkilemez.',
    odyoloji: 'Kanalı tamamen tıkayan serumen, frekansa göre yaklaşık 5–40 dB iletim tipi kayba yol açabilir.',
    src: `${KBB}, serumen (AAO-HNS serumen kılavuzu, 2017)` },
  { bolum: 21, genel: 'Koklea, kafatasının en sert kemik bölgesi olan şakak kemiğinin taşlı (petröz) kısmında korunur.',
    odyoloji: 'Kemik labirent (otik kapsül) doğumda yetişkin boyutundadır ve yaşam boyunca çok az yeniden yapılanır.',
    src: `${P}, kokleanın anatomisi` },
  { bolum: 22, genel: 'Kokleanın tabanı ince (tiz) seslere duyarlıdır; yaşla en önce etkilenen bölge de çoğunlukla burasıdır.',
    odyoloji: 'Genişletilmiş yüksek frekans odyometrisi 8 kHz üstünü ölçer; ototoksisite izleminde kullanılır.',
    src: `${K}, saf ses odyometrisi ve ototoksisite izlemi` },
  { bolum: 23, genel: 'Kokleadaki iki sıvıdan endolenf potasyumdan, perilenf ise sodyumdan zengindir.',
    odyoloji: 'Endolenfte K+ yaklaşık 150 mM’dir; perilenfin bileşimi beyin-omurilik sıvısına benzer (Na+ yaklaşık 140 mM).',
    src: `${P}, koklear sıvılar` },
  { bolum: 24, genel: 'Konuşmayı anlamak için en önemli frekanslar kabaca 500 ile 4000 Hz arasındadır.',
    odyoloji: 'Saf ses ortalaması (SSO) çoğunlukla 500, 1000 ve 2000 Hz hava yolu eşiklerinin ortalamasıdır.',
    src: `${K}, saf ses odyometrisi` },
  { bolum: 25, genel: 'Tüy hücrelerinin “tüyleri” gerçek tüy değildir; mikroskobik, çubuk biçimli uzantılardır.',
    odyoloji: 'Stereosilyalar aktin dolu uzantılardır; dış tüy hücrelerinin en uzun stereosilyaları tektoryal zara gömülüdür.',
    src: `${P}, tüy hücreleri` },
  { bolum: 26, genel: 'Koklea ile denge organı aynı sıvı dolu labirentin parçalarıdır ve birbirine bağlıdır.',
    odyoloji: 'Koklear kanal, ductus reuniens ile sakküle bağlanır; böylece endolenf boşlukları süreklidir.',
    src: `${P}, kokleanın anatomisi` },
  { bolum: 27, genel: 'Çok kalın sesleri yalnızca kulakla değil, vücudumuzdaki titreşimle de hissederiz.',
    odyoloji: '20 Hz altındaki seslere infrases denir; çok yüksek düzeylerde işitilebilir ya da titreşim gibi hissedilebilir.',
    src: `${G}, mutlak eşikler` },
  { bolum: 28, genel: 'Bebekler doğmadan önce, gebeliğin yaklaşık 25. haftasından itibaren sese tepki vermeye başlar.',
    odyoloji: 'Rahim ve anne dokuları yüksek frekansları daha çok zayıflatır; içeriye en çok kalın sesler ulaşır.',
    src: `${K}, pediatrik odyoloji (fetal işitme)` },
  { bolum: 29, genel: 'Bir piyanonun en kalın tuşu yaklaşık 27,5 Hz, en ince tuşu yaklaşık 4186 Hz’dir.',
    odyoloji: 'Alçak frekanslarda sinir lifleri dalganın fazına kilitlenir; memelilerde bu yaklaşık 4–5 kHz’e kadar gözlenir.',
    src: `eşit tamperaman (A4 = 440 Hz); ${P}, faz kilitlenmesi` },
  { bolum: 30, genel: 'Kulak, 1000 Hz civarında yalnızca birkaç hertzlik perde farkını ayırt edebilir.',
    odyoloji: '1 kHz’te frekans ayırt etme eşiği yaklaşık 2–3 Hz’tir; bu, yaklaşık %0,2–0,3’lük bir farktır.',
    src: `${G}, frekans ayırt etme` },
  { bolum: 31, genel: 'Her iç tüy hücresine yaklaşık 10–20 sinir lifi bağlanır; beyne giden sinyallerin çoğu buradan çıkar.',
    odyoloji: 'İç tüy hücresi sinapsında temel nörotransmitter glutamattır; şerit (ribbon) sinaps hızlı ve sürekli salım sağlar.',
    src: `${P}, işitme siniri ve iç tüy hücresi sinapsı` },
  { bolum: 32, genel: 'Bazen iç kulak çalışsa da sinir sinyali düzgün taşıyamaz; buna işitsel nöropati denir.',
    odyoloji: 'İşitsel nöropati spektrum bozukluğunda OAE ya da koklear mikrofonik vardır ama ABR yoktur ya da çok bozuktur.',
    src: `${K}, işitsel nöropati spektrum bozukluğu` },
  { bolum: 33, genel: 'Sinir sinyalleri ışıktan çok yavaştır; en hızlı sinir liflerinde bile saniyede yaklaşık 100 metreyi bulur.',
    odyoloji: 'ABR’de I. ve V. dalga arası süre (I–V aralığı) yetişkinde yaklaşık 4 ms’dir.',
    src: `standart sinir fizyolojisi; ${K}, işitsel beyin sapı yanıtı` },
  { bolum: 34, genel: 'Her kulaktan gelen sinyal beynin iki yarısına da ulaşır; ama çoğu karşı tarafa geçer.',
    odyoloji: 'Koklear çekirdekten çıkan liflerin önemli bir kısmı trapezoid cisimde karşı tarafa geçer.',
    src: `${P}, merkezi işitme yolları` },
  { bolum: 35, genel: 'Ses duvarlardan yansıyıp yeniden gelse de beyin, yönü ilk ulaşan sese göre belirler.',
    odyoloji: 'Öncelik (Haas) etkisi: kısa gecikmeyle gelen yansımalar ayrı yankı gibi değil, ilk sesle birleşik duyulur.',
    src: `${G}, öncelik etkisi` },
  { bolum: 36, genel: 'Ani ve yüksek bir seste irkilmemiz, beyin sapındaki çok hızlı bir refleks yolu sayesinde olur.',
    odyoloji: 'İnferior kollikulus, yükselen işitme yollarının neredeyse hepsinin uğradığı zorunlu aktarma durağıdır.',
    src: `${P}, merkezi işitme yolları` },
  { bolum: 37, genel: 'Bebekler doğduklarında birçok dilin seslerini ayırt edebilir; ilk yıl içinde ana dillerinin seslerine uzmanlaşır.',
    odyoloji: 'Sağ elini kullananların yaklaşık %95’inde dil işlevleri ağırlıklı olarak sol yarıkürededir.',
    src: `${G}, konuşma algısının gelişimi; standart nöroanatomi (dil lateralizasyonu)` },
  { bolum: 38, genel: 'Yenidoğanlar annelerinin sesini başka kadın seslerinden ayırt edebilir ve onu tercih eder.',
    odyoloji: 'ABR dalga latansları yaklaşık 2 yaşına kadar kısalarak yetişkin değerlerine ulaşır.',
    src: `DeCasper ve Fifer (1980), Science; ${K}, işitsel beyin sapı yanıtının gelişimi` },
  { bolum: 39, genel: 'Müzik dinlerken beynin yalnızca işitme bölgeleri değil, hareket ve duygu bölgeleri de çalışır.',
    odyoloji: 'Koklear implanttan sonra beyin yeni sinyale alışır; konuşmayı anlama genellikle aylar içinde gelişir.',
    src: `${K}, koklear implant ve işitsel rehabilitasyon` },
  { bolum: 40, genel: 'Gürültüde konuşmayı anlamak sessizde anlamaktan daha çok çaba ister; işitme kaybında bu çaba artar.',
    odyoloji: 'SNR, konuşma ile gürültü düzeyi arasındaki farktır; işitme kaybında aynı anlama için daha yüksek SNR gerekir.',
    src: `${K}, gürültüde konuşma testleri` },
];

/** bölümün "Biliyor muydun?" satırı oyuncunun Bilgi düzeyine göre; listede olmayan bölümde (ör. üretilmiş bölüm) null */
export function biliyorMuydun(bolum: number, duzey: 'genel' | 'odyoloji'): string | null {
  const b = BILIYOR_MUYDUN.find((x) => x.bolum === bolum);
  return b ? (duzey === 'odyoloji' ? b.odyoloji : b.genel) : null;
}
