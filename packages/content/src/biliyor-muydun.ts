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
import type { BiomeId } from '@odi/shared';
import { HUMAN_JOURNEY } from './journeys';
import { bolunmezYap } from './metin';

export interface BiliyorMuydun {
  /** bölüm numarası (1–40, HUMAN_JOURNEY) */
  bolum: number;
  /** herkes için */
  genel: string;
  /** Odyoloji öğrencisi düzeyi */
  odyoloji: string;
  src: string;
  /** uzman incelemesi için not (oyunda gösterilmez; docs/odyoloji-icerik.md tablosunda satırın yanında) */
  inceleme?: string;
}

const G = 'Gelfand, Hearing: An Introduction to Psychological and Physiological Acoustics';
const K = 'Katz, Handbook of Clinical Audiology';
const P = 'Pickles, An Introduction to the Physiology of Hearing';
const KBB = 'Cummings Otolaryngology; Scott-Brown’s Otorhinolaryngology';

export const BILIYOR_MUYDUN: BiliyorMuydun[] = /* @__PURE__ */ bolunmezYap([
  { bolum: 1, genel: 'Ses, hava, su ya da kemik gibi bir ortamda ilerleyen basınç dalgalarıdır; uzay gibi boşlukta yayılamaz.',
    odyoloji: 'Ses havada 20 °C’de yaklaşık 343 m/sn hızla ilerler; suda bu hız yaklaşık dört kat fazladır.',
    src: `${G}, fiziksel akustik` },
  { bolum: 2, genel: 'Kulak kepçesi kıkırdaktan yapılmıştır; ama kulak memesinde kıkırdak yoktur.',
    odyoloji: 'Kepçenin en derin çukuru konkadır; konka rezonansı yaklaşık 5 kHz civarındadır.',
    src: `${G}, dış kulak aktarım işlevi` },
  { bolum: 3, genel: 'Kanal girişindeki ince kıllar ve kulak kiri (serumen), toz ile küçük böceklerin içeri ilerlemesini zorlaştırır.',
    odyoloji: 'Kıllar, yağ ve serumen bezleri yalnız kanalın dış, kıkırdak bölümünde bulunur; kemik bölümde bez yoktur.',
    src: `${KBB}, dış kulak anatomisi` },
  { bolum: 4, genel: 'Şimşeği görünce saymaya başla: yaklaşık her 3 saniye, yıldırımın 1 km uzakta olduğunu gösterir.',
    odyoloji: 'İnsan, tam önden gelen seslerde yaklaşık 1 derecelik yön farkını ayırt edebilir (en küçük duyulabilir açı).',
    src: `${G}, fiziksel akustik; ses kaynağının yerini belirleme` },
  { bolum: 5, genel: 'Bebeklerde kulak kanalı kısa ve düzdür; yetişkindeki S biçimli kıvrım büyüdükçe oluşur.',
    odyoloji: 'Kepçenin yön ipuçları çoğunlukla 4 kHz üstündedir, çünkü yalnız bu kısa dalga boyları kıvrımlarla etkileşir.',
    src: `${KBB}, dış kulak gelişimi; ${G}, ses kaynağının yerini belirleme` },
  { bolum: 6, genel: 'Kulak kanalının iç üçte ikisi kemik içinden geçer; oradaki deri çok ince ve dokunmaya çok duyarlıdır.',
    odyoloji: 'Kanalın arka duvarının duyusunu vagus sinirinin bir dalı (Arnold siniri) taşır; dokunmak bazı kişilerde öksürtür.',
    src: `${KBB}, dış kulak yolunun sinirleri` },
  { bolum: 7, genel: 'Kulak kirinin ıslak ve kuru olmak üzere iki tipi vardır; hangisi olacağını büyük ölçüde genler belirler.',
    odyoloji: 'Serumen tipini ABCC11 genindeki tek bir varyant belirler; kuru tip Doğu Asya’da yaygındır.',
    src: `${KBB}, serumen; Yoshiura ve ark. (2006), Nature Genetics` },
  { bolum: 8, genel: 'Kulağa çok soğuk ya da sıcak su girmesi, iç kulaktaki denge organını uyarıp baş döndürebilir.',
    odyoloji: 'Kalorik testte kanala vücut ısısının biraz altında ve üstünde su (30, 44 °C) verilir; yatay yarım daire kanalı uyarılır.',
    inceleme: 'tur 9 düzeltmesi: hava kaloriği sıcaklığı çıkarıldı',
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
    odyoloji: 'Yükselen işitme liflerinin neredeyse tamamı inferior kollikulusta sinaps yapar; yolun ana aktarma istasyonudur.',
    src: `${P}, merkezi işitme yolları` },
  { bolum: 37, genel: 'Bebekler doğduklarında birçok dilin seslerini ayırt edebilir; ilk yıl içinde ana dillerinin seslerine uzmanlaşır.',
    odyoloji: 'Sağ elini kullananların yaklaşık %95’inde dil işlevleri ağırlıklı olarak sol yarıkürededir.',
    src: `${G}, konuşma algısının gelişimi; standart nöroanatomi (dil lateralizasyonu)` },
  { bolum: 38, genel: 'Yenidoğanlar annelerinin sesini başka kadın seslerinden ayırt edebilir ve onu tercih eder.',
    odyoloji: 'Kortikal işitsel uyarılmış potansiyeller ABR’den çok daha geç olgunlaşır; yetişkin biçimine ergenlikte ulaşır.',
    src: `DeCasper ve Fifer (1980), Science; ${K}, kortikal işitsel uyarılmış potansiyeller`,
    inceleme: 'YN-236: önceki odyoloji satırı (ABR latanslarının olgunlaşması) beyin sapı konusu olduğu için Beyin Sapı ek satırına taşındı' },
  { bolum: 39, genel: 'Müzik dinlerken beynin yalnızca işitme bölgeleri değil, hareket ve duygu bölgeleri de çalışır.',
    odyoloji: 'Koklear implanttan sonra beyin yeni sinyale alışır; konuşmayı anlama genellikle aylar içinde gelişir.',
    src: `${K}, koklear implant ve işitsel rehabilitasyon` },
  { bolum: 40, genel: 'Gürültüde konuşmayı anlamak sessizde anlamaktan daha çok çaba ister; işitme kaybında bu çaba artar.',
    odyoloji: 'SNR, konuşma ile gürültü düzeyi arasındaki farktır; işitme kaybında aynı anlama için daha yüksek SNR gerekir.',
    src: `${K}, gürültüde konuşma testleri` },
]);

/**
 * Bölüme bağlı olmayan biyom ek satırları (YN-236, OT-ogrenci-birinci-50, OT-uzman-odyolog-42): küçük biyom havuzlarını büyütür
 * (Beyin Sapı 3, İşitme Korteksi 4 bölüm). Bölüm satırlarıyla aynı kurallar (tek cümle, en çok 120 karakter, kaynak); sahip onayı
 * bekliyor (karar 31).
 */
export interface BiyomEkSatiri {
  biyom: BiomeId;
  genel: string;
  odyoloji: string;
  src: string;
  inceleme?: string;
}

export const BIYOM_EK: BiyomEkSatiri[] = /* @__PURE__ */ bolunmezYap([
  { biyom: 'beyin-sapi', genel: 'Bebeklerin işitme yollarındaki sinir lifleri doğumdan sonra da olgunlaşır; sinyaller zamanla hızlanır.',
    odyoloji: 'ABR dalga latansları yaklaşık 2 yaşına kadar kısalarak yetişkin değerlerine ulaşır.',
    src: `${K}, işitsel beyin sapı yanıtının gelişimi` },
  { biyom: 'beyin-sapi', genel: 'İki kulaktan gelen sinyaller ilk kez beyin sapında buluşur; sesin yönü orada hesaplanmaya başlar.',
    odyoloji: 'Medial superior olive ağırlıklı olarak zaman farkını (ITD), lateral superior olive şiddet farkını (ILD) işler.',
    src: `${P}, superior oliver kompleks ve iki kulakla yön bulma` },
  { biyom: 'beyin-sapi', genel: 'Yüksek seste orta kulaktaki küçük kasın kasılmasını sağlayan refleks devresi beyin sapında tamamlanır.',
    odyoloji: 'Akustik refleks arkı: VIII. sinir, koklear çekirdek, superior oliver kompleks, VII. sinir ve stapedius kası.',
    src: `${K}, akustik refleks yolu` },
  { biyom: 'beyin-sapi', genel: 'Gürültünün içindeki bir sesi iki kulakla dinleyince fark etmek, tek kulakla dinlemekten kolaydır.',
    odyoloji: 'Maskeleme düzeyi farkı (MLD): gürültü iki kulakta aynı, ton ters fazdaysa alçak frekansta eşik yaklaşık 15 dB düşer.',
    src: `${G}, maskeleme düzeyi farkı` },
  { biyom: 'korteks', genel: 'Beynin işitme bölgesinde de kokleadaki gibi her frekansın kendine ait bir yeri vardır.',
    odyoloji: 'Heschl girusundaki primer işitsel korteks tonotopik düzenlidir; frekanslar komşu şeritlerde sıralanır.',
    src: `${P}, işitsel korteks` },
  { biyom: 'korteks', genel: 'Konuşmayı duymak ile anlamak ayrı işlerdir; anlamada beynin özel bir dil bölgesi rol oynar.',
    odyoloji: 'Wernicke alanı, üst temporal girusun arka bölümündedir ve konuşmayı anlamada rol oynar.',
    src: `${G}, konuşma algısı; standart nöroanatomi (dil alanları)` },
]);

/**
 * sonuç ekranında gösterilen satır: bölüm satırı ya da biyom ek satırı. `no` kayıttaki kimliği (apps/web store `bilgiSonlar`):
 * bölüm satırında bölüm numarası, ek satırda EK_NO + BIYOM_EK sırası (101, 102, …)
 */
export interface BilgiSatiri {
  no: number;
  biyom: BiomeId;
  genel: string;
  odyoloji: string;
  src: string;
  /** bölüm satırının bölümü; ek satırda yok */
  bolum?: number;
}
const EK_NO = 100;
/** oyunun son bölümü (final): kendi satırı yalnız kazanılınca gelir */
const FINAL = HUMAN_JOURNEY.levels.length;

const biyomu = (bolum: number) => HUMAN_JOURNEY.levels.find((l) => l.number === bolum)?.biome;
/** biyomların havuzu: o biyomun bölüm satırları (bölüm sırasıyla), ardından biyomun ek satırları */
const HAVUZ = /* @__PURE__ */ (() => {
  const m = new Map<BiomeId, BilgiSatiri[]>();
  const ekle = (s: BilgiSatiri) => { const l = m.get(s.biyom) ?? []; l.push(s); m.set(s.biyom, l); };
  for (const x of BILIYOR_MUYDUN) { const b = biyomu(x.bolum); if (b) ekle({ no: x.bolum, biyom: b, genel: x.genel, odyoloji: x.odyoloji, src: x.src, bolum: x.bolum }); }
  BIYOM_EK.forEach((x, i) => ekle({ no: EK_NO + i + 1, biyom: x.biyom, genel: x.genel, odyoloji: x.odyoloji, src: x.src }));
  return m;
})();
/** bölümün biyom havuzu (bölüm satırları + ek satırlar); listede olmayan bölümde boş */
export const bilgiHavuzu = (bolum: number): readonly BilgiSatiri[] => { const b = biyomu(bolum); return b ? HAVUZ.get(b) ?? [] : []; };

/**
 * kayıtta tutulan son gösterilen satır sayısı (apps/web store `bilgiSonlar`; YN-212, YN-222): en büyük biyom havuzu kadar, böylece
 * bir biyomun bütün satırları dönmeden hiçbiri yeniden gelmez (ek satırlarla Beyin Sapı 7 satır; art arda 5 sonuçta da tekrar yok)
 */
export const BILGI_YAKIN = /* @__PURE__ */ Math.max(...[...HAVUZ.values()].map((h) => h.length));

/**
 * bölümün "Biliyor muydun?" satırı oyuncunun Bilgi düzeyine göre; listede olmayan bölümde (ör. üretilmiş bölüm) null.
 * Kazançta da kayıpta da satır bölümün biyom havuzundan gelir (YN-222, OT-uzman-odyolog-40: Apeks'in infrases satırı İşitme
 * Siniri'nin kaybında yeniden geliyordu); havuz bölüm satırları ile biyomun ek satırlarıdır (YN-236).
 * `tekrar`: aynı bölümün kaçıncı tekrarı (0 = ilk oynayış). Tekrarda hep aynı satır çıkmasın diye (YN-127) havuzun sıradaki
 * satırı gelir (havuz sırasıyla, başa sararak).
 * `onceki`: yakın zamanda sonuç ekranında gösterilen satırların kimlikleri (`no`), eskiden yeniye (kayıtta, apps/web store
 * `bilgiSonlar`, en çok BILGI_YAKIN; tek sayı da olur). Seçilen satır bunlardan biriyse havuzun sıradaki gösterilmemiş satırı gelir
 * (YN-175, YN-212). Havuzun hepsi yakında gösterildiyse havuzdan en önce gösterilen gelir: son gösterilen art arda gelmez, başka
 * biyomun satırına geçilmez.
 * `kazanildi`: son bölüm (40, oyunun finali) kazanılınca o bölümün kendi satırı gelir (YN-236, OT-takim-kaptani-41: 37'nin satırı
 * finalde yeniden çıkıyordu); bu yüzden finalin satırı başka sonuçlarda (40'ın kaybı, 37–39) havuzdan çıkarılır. Finalin satırı
 * yakında gösterildiyse (final yeniden kazanıldı) havuzun öteki satırları gibi seçilir.
 */
export function biliyorMuydunSatiri(bolum: number, tekrar = 0, onceki?: number | readonly number[], kazanildi = false): BilgiSatiri | null {
  const h = bilgiHavuzu(bolum);
  const b = h.find((x) => x.bolum === bolum);
  if (!b) return null;
  const yakin = onceki == null ? [] : typeof onceki === 'number' ? [onceki] : onceki;
  const fin = h.find((x) => x.bolum === FINAL);
  if (bolum === FINAL && kazanildi && !yakin.includes(b.no)) return b;
  const sira = fin && h.length > 1 ? h.filter((x) => x !== fin) : h;
  const i = Math.max(0, sira.indexOf(b)) + Math.max(0, Math.floor(tekrar));
  for (let k = 0; k < sira.length; k++) { const t = sira[(i + k) % sira.length]!; if (!yakin.includes(t.no)) return t; }
  return sira.reduce((a, x) => (yakin.indexOf(x.no) < yakin.indexOf(a.no) ? x : a));
}

/** satırın metni Bilgi düzeyine göre (seçim kuralı: biliyorMuydunSatiri) */
export function biliyorMuydun(bolum: number, duzey: 'genel' | 'odyoloji', tekrar = 0, onceki?: number | readonly number[], kazanildi = false): string | null {
  const s = biliyorMuydunSatiri(bolum, tekrar, onceki, kazanildi);
  return s ? (duzey === 'odyoloji' ? s.odyoloji : s.genel) : null;
}
