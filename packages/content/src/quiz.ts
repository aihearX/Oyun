/**
 * Kulak Bilgi Yarışması soru havuzu (takım quizi). Genel kabul görmüş, kaynak gerektirmeyen temel odyoloji / akustik
 * bilgileri; sayılar yaklaşık ve yuvarlaktır ("yaklaşık" diye yazılır). Yeni soru eklerken doğruluğu kontrol et.
 * Ham kayıtlarda doğru cevap her zaman ilk seçenektir; yayınlanan seçenek sırası soru numarasına göre sabit biçimde döndürülür.
 */
export interface QuizQuestion { id: number; text: string; choices: [string, string, string, string]; answer: 0 | 1 | 2 | 3; explain: string; topic: 'anatomi' | 'ses' | 'saglik' | 'doga' | 'teknoloji' }

type Raw = [topic: QuizQuestion['topic'], text: string, correct: string, w1: string, w2: string, w3: string, explain: string];
const RAW: Raw[] = [
  ['anatomi', 'Vücudumuzun en küçük kemiği hangisidir?', 'Üzengi', 'Çekiç', 'Örs', 'Serçe parmak kemiği', 'Orta kulaktaki üzengi yaklaşık 3 mm uzunluğundadır; vücudun en küçük kemiğidir.'],
  ['anatomi', 'Orta kulakta kaç tane kemikçik vardır?', '3', '2', '4', '6', 'Çekiç, örs ve üzengi: üç küçük kemik sesi kulak zarından iç kulağa taşır.'],
  ['anatomi', 'Ses dalgalarıyla ilk titreşen ince zar hangisidir?', 'Kulak zarı', 'Oval pencere', 'Göz kapağı', 'Diyafram', 'Kulak zarı gelen sesle titreşir ve bu titreşimi kemikçiklere aktarır.'],
  ['anatomi', 'İç kulaktaki salyangoz biçimli işitme organının adı nedir?', 'Koklea', 'Östaki borusu', 'Kulak kepçesi', 'Gırtlak', 'Koklea (salyangoz) titreşimleri sinir sinyallerine çeviren işitme organıdır.'],
  ['anatomi', 'Kokleada sesi algılayan duyu hücrelerine ne denir?', 'Tüylü (kıl) hücreler', 'Kırmızı kan hücreleri', 'Koni hücreleri', 'Yağ hücreleri', 'Tüylü hücreler sıvıdaki titreşimle eğilir ve elektrik sinyali üretir.'],
  ['anatomi', 'Orta kulağı boğazın arkasına bağlayan kanal hangisidir?', 'Östaki borusu', 'Dış kulak yolu', 'İşitme siniri', 'Gözyaşı kanalı', 'Östaki borusu orta kulaktaki hava basıncını dışarıyla dengeler.'],
  ['saglik', 'Uçak inerken kulak tıkanırsa hangisi yardımcı olur?', 'Yutkunmak ya da esnemek', 'Kulağa pamuk itmek', 'Kulağı sertçe ovmak', 'Nefesi tutup eğilmek', 'Yutkunmak ve esnemek Östaki borusunu açar, basınç dengelenir.'],
  ['anatomi', 'Dengemizle ilgili iç kulak yapıları hangileridir?', 'Yarım daire kanalları', 'Kulak zarı', 'Çekiç kemiği', 'Kulak kepçesi', 'İç kulaktaki yarım daire kanalları başın dönme hareketlerini algılar.'],
  ['ses', 'Sesin şiddeti (yüksekliği) hangi birimle ölçülür?', 'Desibel (dB)', 'Hertz (Hz)', 'Newton', 'Lümen', 'Desibel ses şiddeti için kullanılan logaritmik bir birimdir.'],
  ['ses', 'Sesin frekansı (inceliği-kalınlığı) hangi birimle ölçülür?', 'Hertz (Hz)', 'Desibel (dB)', 'Watt', 'Kilogram', 'Hertz, saniyedeki titreşim sayısıdır.'],
  ['ses', 'Sağlıklı genç bir insan yaklaşık hangi frekans aralığını duyar?', '20 Hz – 20.000 Hz', '1 Hz – 100 Hz', '500 Hz – 2.000 Hz', '50.000 Hz – 100.000 Hz', 'İnsan kulağı yaklaşık 20 Hz ile 20.000 Hz arasını duyar; bu aralık yaşla daralır.'],
  ['ses', 'İnsanın duyabileceğinden daha ince (20.000 Hz üstü) seslere ne denir?', 'Ultrason', 'İnfrason', 'Yankı', 'Fısıltı', 'Ultrason, tıpta görüntüleme için de kullanılır.'],
  ['ses', 'İnsanın duyabileceğinden daha kalın (20 Hz altı) seslere ne denir?', 'İnfrason', 'Ultrason', 'Rezonans', 'Sonar', 'İnfrason çok düşük frekanslı seslerdir; bazı hayvanlar bunları duyabilir.'],
  ['ses', 'Ses hangisinde daha hızlı yayılır?', 'Suda', 'Havada', 'Boşlukta', 'Hepsinde aynı hızda', 'Ses havada yaklaşık 343 m/sn, suda yaklaşık 1.480 m/sn hızla yayılır.'],
  ['ses', 'Ses boşlukta (uzayda) yayılabilir mi?', 'Hayır, yayılmak için bir ortam gerekir', 'Evet, en hızlı orada yayılır', 'Yalnızca gece yayılır', 'Yalnızca bas sesler yayılır', 'Ses, hava, su ya da katı gibi bir ortamın titreşmesiyle yayılır; boşlukta ortam yoktur.'],
  ['ses', 'Ses havada (oda sıcaklığında) yaklaşık hangi hızla ilerler?', 'Saniyede yaklaşık 343 metre', 'Saniyede yaklaşık 3 metre', 'Işık hızında', 'Saniyede yaklaşık 30.000 km', 'Yaklaşık 343 m/sn: bir futbol sahasını üç saniyede birkaç kez geçecek kadar.'],
  ['ses', 'Şimşeği gök gürültüsünden önce görmemizin nedeni nedir?', 'Işık sesten çok daha hızlıdır', 'Ses ışıktan daha hızlıdır', 'Gözler kulaklardan önce uyanır', 'Bulutlar sesi bekletir', 'Işık neredeyse anında gelir, ses ise saniyede yaklaşık 343 metre yol alır.'],
  ['saglik', 'Gürültüye bağlı işitme kaybından korunmanın en iyi yolu hangisidir?', 'Sesi kısmak, uzaklaşmak, kulak koruyucu takmak', 'Sesi sonuna kadar açmak', 'Kulağa pamuklu çubuk sokmak', 'Hiçbir şey yapmamak', 'Gürültüden kaynaklanan işitme kaybı önlenebilir: süreyi ve şiddeti azaltmak en etkili yoldur.'],
  ['saglik', 'Kulaklıkla müzik dinlerken hangisi doğrudur?', 'Sesi orta düzeyde tutup ara vermek', 'En yüksek seste uzun süre dinlemek', 'Gürültüyü bastırmak için sesi hep açmak', 'Uyurken en yüksek seste dinlemek', 'Yaygın bir öneri: ses düzeyini yaklaşık %60\'ın altında tutmak ve düzenli mola vermek.'],
  ['saglik', 'Kulakta dışarıda olmayan bir çınlama ya da uğultu duyulmasına ne denir?', 'Tinnitus (çınlama)', 'Vertigo', 'Miyopi', 'Astım', 'Tinnitus bir belirtidir; sürekli olursa bir uzmana başvurmak gerekir.'],
  ['saglik', 'Etrafın dönüyormuş gibi hissedildiği baş dönmesine ne denir?', 'Vertigo', 'Tinnitus', 'Otoskop', 'Migren', 'Vertigo çoğu zaman iç kulaktaki denge sistemiyle ilgilidir.'],
  ['saglik', 'Yaşa bağlı işitme kaybının tıbbi adı nedir?', 'Presbiakuzi', 'Presbiyopi', 'Astigmatizma', 'Bronşit', 'Presbiakuzi yaşla yavaş yavaş gelişen işitme kaybıdır.'],
  ['saglik', 'Yaşla birlikte genellikle önce hangi sesleri duymak zorlaşır?', 'İnce (tiz) sesler', 'Kalın (bas) sesler', 'Tüm sesler aynı anda', 'Yalnızca fısıltılar kolaylaşır', 'Yaşa bağlı kayıp genellikle yüksek frekanslardan başlar.'],
  ['saglik', 'İşitme testinin sonucunu gösteren grafiğe ne denir?', 'Odyogram', 'Elektrokardiyogram', 'Röntgen', 'Termogram', 'Odyogram, farklı frekanslarda duyulabilen en hafif sesleri gösterir.'],
  ['saglik', 'İşitme testlerini yapan ve işitme cihazı ayarlayan sağlık profesyoneli kimdir?', 'Odyolog', 'Optisyen', 'Diyetisyen', 'Eczacı', 'Odyologlar işitme ve denge değerlendirmesi yapar.'],
  ['teknoloji', 'İleri derecede işitme kaybında kokleaya yerleştirilen elektronik cihaz hangisidir?', 'Koklear implant', 'Kalp pili', 'Kontakt lens', 'Diş teli', 'Koklear implant işitme sinirini elektrikle uyararak ses algısı sağlar.'],
  ['anatomi', 'Kulak kiri (serumen) ne işe yarar?', 'Kanalı korur ve nemli tutar', 'Hiçbir işe yaramaz', 'Sesi yükseltir', 'Kemikleri büyütür', 'Kulak kiri tozu ve mikropları tutar, kanal derisini korur.'],
  ['saglik', 'Pamuklu çubukla ilgili hangisi doğrudur?', 'Kulak kanalına sokulmamalı', 'Her gün derine sokulmalı', 'Kulak zarını güçlendirir', 'Kiri eritir', 'Çubuk kiri daha derine itebilir ve zara zarar verebilir; kulağın dışını silmek yeterlidir.'],
  ['saglik', 'Yenidoğan işitme taramasının amacı nedir?', 'İşitme kaybını erkenden fark etmek', 'Boyu ölçmek', 'Göz rengini belirlemek', 'Uykuyu ölçmek', 'Erken fark edilen işitme kaybında dil gelişimi için zamanında destek sağlanabilir.'],
  ['saglik', 'Dünya İşitme Günü her yıl hangi tarihte kutlanır?', '3 Mart', '14 Şubat', '1 Mayıs', '29 Ekim', 'Dünya Sağlık Örgütü 3 Mart\'ı Dünya İşitme Günü olarak kutlar.'],
  ['ses', 'Sesin hangi yönden geldiğini bulmamıza en çok ne yardım eder?', 'İki kulağımızın olması', 'Burnumuz', 'Saçlarımız', 'Tek gözümüz', 'Beyin, sesin iki kulağa varış zamanı ve şiddet farkından yönü hesaplar.'],
  ['ses', 'Yankı nedir?', 'Sesin bir yüzeyden yansıyıp geri gelmesi', 'Sesin tamamen kaybolması', 'Işığın kırılması', 'Sesin renk değiştirmesi', 'Ses dağ, duvar gibi yüzeylerden yansıyıp gecikmeli olarak geri gelir.'],
  ['doga', 'Yarasalar karanlıkta yollarını çoğunlukla nasıl bulur?', 'Yankıyla konum belirleyerek (ekolokasyon)', 'Yalnızca kokuyla', 'Sıcaklığı hissederek', 'Yıldızlara bakarak', 'Yarasalar çok ince sesler çıkarır ve geri dönen yankıları dinler.'],
  ['teknoloji', 'Gemilerin yankıyla deniz derinliğini ölçtüğü cihaz hangisidir?', 'Sonar', 'Termometre', 'Barometre', 'Pusula', 'Sonar ses dalgası gönderir ve yankının dönüş süresinden uzaklığı hesaplar.'],
  ['anatomi', 'Kulak zarının hemen arkasında hangi bölüm bulunur?', 'Orta kulak', 'Dış kulak', 'Burun boşluğu', 'Beyin sapı', 'Kulak zarı dış kulakla orta kulağı ayırır.'],
  ['anatomi', 'Kulak kepçesi hangi dokudan yapılmıştır?', 'Kıkırdak', 'Kemik', 'Yalnızca kas', 'Diş minesi', 'Kıkırdak kulak kepçesine esnek ama sağlam bir yapı verir.'],
  ['anatomi', 'Yetişkinde dış kulak yolu yaklaşık ne uzunluktadır?', 'Yaklaşık 2,5 cm', 'Yaklaşık 10 cm', 'Yaklaşık 1 mm', 'Yaklaşık 25 cm', 'Dış kulak yolu yaklaşık 2,5 cm uzunluğunda, hafif kıvrımlı bir kanaldır.'],
  ['anatomi', 'İşitme siniri kokleadan gelen sinyalleri nereye taşır?', 'Beyne', 'Kalbe', 'Mideye', 'Akciğerlere', 'Sinyaller beyin sapından geçerek işitme korteksine ulaşır.'],
  ['anatomi', 'Beyinde sesleri anlamlandıran işitme korteksi hangi lobdadır?', 'Şakak (temporal) lob', 'Arka kafa (oksipital) lob', 'Beyincik', 'Omurilik', 'İşitme korteksi şakak lobundadır; görme ise arka kafa lobunda işlenir.'],
  ['ses', 'Konuşma seslerinin çoğu yaklaşık hangi frekans aralığındadır?', '250 – 4.000 Hz', '20.000 – 40.000 Hz', '1 – 10 Hz', '100.000 Hz üstü', 'Konuşmanın anlaşılması için önemli seslerin çoğu bu orta frekanslardadır.'],
  ['saglik', 'Çok gürültülü bir konserden sonra kulakta geçici uğultu olması neyin işaretidir?', 'Kulakların fazla gürültüye maruz kaldığının', 'Kulakların güçlendiğinin', 'Kulak kirinin bittiğinin', 'Hiçbir şeyin', 'Geçici uğultu bir uyarıdır; tekrar tekrar yaşanırsa kalıcı hasar riski artar.'],
  ['ses', 'Bir sesin ince ya da kalın oluşu neye bağlıdır?', 'Frekansına', 'Şiddetine', 'Rengine', 'Ağırlığına', 'Frekans yükseldikçe ses incelir, düştükçe kalınlaşır.'],
  ['ses', 'Kalın (bas) seslerin frekansı nasıldır?', 'Düşüktür', 'Yüksektir', 'Sıfırdır', 'Her zaman 20.000 Hz\'dir', 'Davul gibi kalın sesler düşük frekanslıdır.'],
  ['anatomi', 'Kokleada ince (yüksek frekanslı) sesler hangi bölümde algılanır?', 'Tabanda', 'Tepede (apeks)', 'Kulak zarında', 'Östaki borusunda', 'Koklea tabanı ince, tepesi kalın seslere duyarlıdır (tonotopi).'],
  ['teknoloji', 'İşitme cihazı ne yapar?', 'Sesleri kişiye göre yükseltir ve düzenler', 'Sesi tamamen keser', 'Görmeyi düzeltir', 'Kulak kirini temizler', 'İşitme cihazı, kişinin odyogramına göre ayarlanarak sesleri duyulur hale getirir.'],
  ['saglik', 'İşaret dilleri hakkında hangisi doğrudur?', 'Kendi dilbilgisi olan tam dillerdir', 'Tüm dünyada tek ve aynıdır', 'Yalnızca parmak alfabesinden oluşur', 'Yalnızca çocuklar kullanır', 'İşaret dilleri ülkeden ülkeye değişen, kendi dilbilgisi olan doğal dillerdir.'],
  ['saglik', 'Türkiye\'de kullanılan işaret dilinin adı nedir?', 'Türk İşaret Dili (TİD)', 'Mors alfabesi', 'Braille', 'Amerikan İşaret Dili', 'Türk İşaret Dili Türkiye\'deki işitme engelli topluluğun dilidir.'],
  ['saglik', 'Uzun süre dinlendiğinde işitmeye zarar verebilecek ses düzeyi yaklaşık hangisidir?', '85 dB ve üzeri', '10 dB', '0 dB', '20 dB', 'Yaklaşık 85 dB üzerindeki seslere uzun süre maruz kalmak işitme için risklidir; süre kısaldıkça risk azalır.'],
  ['ses', 'Bir fısıltı yaklaşık kaç desibeldir?', 'Yaklaşık 30 dB', 'Yaklaşık 120 dB', 'Yaklaşık 90 dB', 'Yaklaşık 160 dB', 'Fısıltı yaklaşık 30 dB, normal konuşma yaklaşık 60 dB civarındadır.'],
  ['ses', 'Normal bir sohbet yaklaşık kaç desibeldir?', 'Yaklaşık 60 dB', 'Yaklaşık 5 dB', 'Yaklaşık 140 dB', 'Yaklaşık 110 dB', 'Karşılıklı normal konuşma yaklaşık 60 dB civarındadır.'],
  ['saglik', 'Orta kulak iltihabının tıbbi adı nedir?', 'Otitis media', 'Gastrit', 'Konjonktivit', 'Bronşit', 'Otitis media özellikle çocuklarda sık görülür; ağrı ve ateş varsa hekime gidilmelidir.'],
  ['saglik', 'Kulağa su kaçınca hangisi YAPILMAMALIDIR?', 'Sivri bir cisimle kulağı kurcalamak', 'Başı yana eğip suyu akıtmak', 'Kulağın dışını havluyla kurulamak', 'Biraz beklemek', 'Kulağa sivri cisim sokmak kanala ve zara zarar verebilir.'],
  ['doga', 'Filler çok uzaktaki fillerle hangi tür seslerle iletişim kurabilir?', 'Çok kalın (infrason) seslerle', 'Yalnızca ultrasonla', 'Işık sinyalleriyle', 'Yalnızca kokuyla', 'Fillerin çok düşük frekanslı sesleri kilometrelerce uzağa ulaşabilir.'],
  ['doga', 'Köpekler insanlara göre hangi sesleri duyabilir?', 'Daha ince (yüksek frekanslı) sesleri', 'Yalnızca bas sesleri', 'Hiç ses duymaz', 'İnsanlarla tam olarak aynı sesleri', 'Köpekler insan kulağının duyamadığı yüksek frekansları duyabilir; köpek düdükleri bu yüzden çalışır.'],
  ['doga', 'Peçeli baykuş gibi bazı baykuşların kulakları neden farklı yüksekliktedir?', 'Sesin yönünü daha iyi bulmak için', 'Süs için', 'Daha hızlı uçmak için', 'Isınmak için', 'Asimetrik kulaklar avın yerini karanlıkta bile çok iyi belirlemelerini sağlar.'],
  ['teknoloji', 'Mikrofon ne yapar?', 'Sesi elektrik sinyaline çevirir', 'Işığı sese çevirir', 'Sesi tamamen yok eder', 'Sıcaklığı ölçer', 'Mikrofonun içindeki zar sesle titreşir ve bu titreşim elektrik sinyaline dönüşür.'],
  ['teknoloji', 'Hoparlör ne yapar?', 'Elektrik sinyalini sese çevirir', 'Sesi ışığa çevirir', 'Sesi kaydeder', 'Elektrik üretir', 'Hoparlör zarı elektrik sinyaliyle titreşir ve havayı titreştirerek ses üretir.'],
  ['ses', 'Rezonans nedir?', 'Bir cismin kendi doğal frekansında daha güçlü titreşmesi', 'Sesin tamamen kaybolması', 'Işığın yansıması', 'Suyun kaynaması', 'Kulak kanalı da rezonansla bazı frekansları doğal olarak güçlendirir.'],
  ['saglik', 'Konser ya da maç gibi çok gürültülü bir ortamda ne yapmak doğrudur?', 'Kulak tıkacı takmak ve sessiz yere mola vermek', 'Hoparlöre yaklaşmak', 'Kulaklığı sonuna kadar açmak', 'Daha çok bağırmak', 'Kulak koruyucu ve molalar kulakların dinlenmesine yardım eder.'],
  ['ses', 'Ses havada nasıl bir dalga olarak ilerler?', 'Sıkışma-genleşme (boyuna) dalgası', 'Işık dalgası', 'Elektrik akımı', 'Manyetik alan', 'Ses, havadaki moleküllerin sıkışıp genleşmesiyle ilerleyen mekanik bir dalgadır.'],
  ['ses', 'Sesin yayılması için ne gerekir?', 'Hava, su ya da katı gibi bir ortam', 'Güneş ışığı', 'Elektrik', 'Mıknatıs', 'Ses titreşimle yayılır; titreşecek bir ortam şarttır.'],
  ['anatomi', 'Kokleadaki tüylü hücreler hasar görürse insanda genellikle ne olur?', 'Kendiliğinden yenilenmezler', 'Her gün yenilenirler', 'Kemiğe dönüşürler', 'Kulak kirine dönüşürler', 'İnsanda tüylü hücreler kendiliğinden yenilenmez; bu yüzden işitmeyi korumak önemlidir.'],
  ['anatomi', 'Kulağın bölümleri dıştan içe doğru hangi sıradadır?', 'Dış kulak → orta kulak → iç kulak', 'İç kulak → orta kulak → dış kulak', 'Orta kulak → dış kulak → iç kulak', 'Dış kulak → iç kulak → orta kulak', 'Ses önce kepçe ve kanaldan, sonra zar ve kemikçiklerden, en son kokleadan geçer.'],
  ['anatomi', 'Üzengi kemiği iç kulağın hangi bölümüne dayanır?', 'Oval pencere', 'Kulak zarı', 'Kulak kepçesi', 'Östaki borusu', 'Üzengi tabanı oval pencereye oturur ve titreşimi koklea sıvısına aktarır.'],
  ['saglik', 'Bebekler sesleri ne zamandan itibaren duyabilir?', 'Anne karnındayken, gebeliğin son aylarında', 'Ancak 5 yaşında', 'Okula başlayınca', 'Yalnızca konuşmaya başlayınca', 'Bebekler doğmadan önce de annenin sesini ve çevredeki sesleri duyabilir.'],
  ['ses', 'Sesin şiddeti 10 dB artınca, kulağa yaklaşık nasıl gelir?', 'Yaklaşık iki kat daha yüksek', 'Aynı', 'On kat daha alçak', 'Tamamen sessiz', 'Desibel logaritmiktir: yaklaşık 10 dB artış, kulağa yaklaşık iki kat yüksek gelir.'],
];

/** seçenek sırasını soru numarasına göre sabit döndür (doğru cevap hep aynı yerde durmasın) */
export const QUIZ_QUESTIONS: QuizQuestion[] = RAW.map(([topic, text, correct, w1, w2, w3, explain], i) => {
  const rot = (i * 3 + 1) % 4;
  const base = [correct, w1, w2, w3];
  const choices = [0, 1, 2, 3].map((k) => base[(k + 4 - rot) % 4]!) as QuizQuestion['choices'];
  return { id: i + 1, text, choices, answer: rot as QuizQuestion['answer'], explain, topic };
});
