/**
 * Tüy Dede'nin bütün sözleri: tek kaynak. Hikâye, turlar ve açılış duyuruları buradan okunur.
 * Her satırın kalıcı bir kimliği var; kayıtlı ses dosyaları bu kimlikle eşleşir (apps/web/public/voice/<id>.mp3).
 * Metin değişirse textHash değişir ve eski kayıt kullanılmaz (altyazıyla uyuşmayan ses çalınmaz; cihaz sesi devreye girer).
 * Bu dosya içe aktarma yapmaz: tools/voice/generate.mjs de Node ile doğrudan okur.
 */
export interface NarratorLine {
  /** dosya adı da budur: <id>.mp3 */
  id: string;
  text: string;
  /** seslendiren için: satırın nerede, ne olurken söylendiği */
  context: string;
  /** önerilen duygu / ton */
  emotion: string;
  /** seslendirme için yazım (yalnız gerekirse): model q/w/x, rakam ve kısaltma okuyamaz → okunduğu gibi yazılır */
  spoken?: string;
}

/** seslendirme yönergesi (oyuncuya / TTS hizmetine) */
export const VOICE_DIRECTION =
  'Tüy Dede: iç kulağın en yaşlı tüy hücresi; bilge, sıcak, şefkatli bir erkek anlatıcı. Akıcı ve doğal hızda ' +
  '(yavaş değil), gülümseyerek konuşur; sesi yaşlandırılmaz (titreme, boğukluk yok). Çocuklara (7-12 yaş) masal anlatır gibi; ' +
  'heyecanlı yerlerde canlanır ama asla bağırmaz. Noktalama işaretlerinde doğal duraklar. Türkçe, İstanbul ağzı, net diksiyon.';

export const NARRATOR_LINES: readonly NarratorLine[] = [
  // ---- hikâye girişi (ilk açılış, resimli 7 sahne)
  { id: 'hikaye-01', text: 'Merhaba! Ben Tüy Dede, iç kulağın en yaşlı tüy hücresiyim. Seni bekliyordum.', context: 'Hikâye 1/7: Tüy Dede kendini tanıtır', emotion: 'sıcak, karşılayıcı (warm, welcoming)' },
  { id: 'hikaye-02', text: 'Bu Odi: minik bir ses. Annesinin ninnisini taşıyor.', context: 'Hikâye 2/7: kahraman Odi tanıtılır', emotion: 'şefkatli (tender)' },
  { id: 'hikaye-03', text: 'Ninni kulaktan girer, kanalı geçer, kulak zarına ve kemikçiklere ulaşır; kokleadan işitme siniriyle beyne gider.', context: 'Hikâye 3/7: kulaktan beyne yolculuk haritası', emotion: 'anlatıcı, merak uyandıran (storytelling)' },
  { id: 'hikaye-04', text: 'Ama Büyük Sessizlik geliyor! Gürültü canavarları kulağın ışıklarını söndürüyor.', context: 'Hikâye 4/7: tehlike, karanlık sahne', emotion: 'gizemli, endişeli (ominous, hushed)' },
  { id: 'hikaye-05', text: 'Senin görevin: her bölümü geç, yıldızları topla, bölgeleri yeniden ışıt ve ninniyi beyne ulaştır.', context: 'Hikâye 5/7: oyunun hedefi', emotion: 'kararlı, cesaret veren (determined)' },
  { id: 'hikaye-06', text: 'Yalnız değilsin: arkadaşların ve takımın yardım eder. Her yeni yeri ben sana tek tek göstereceğim.', context: 'Hikâye 6/7: arkadaşlar ve takım', emotion: 'güven veren, göz kırpan (reassuring)' },
  { id: 'hikaye-07', text: 'Hadi, ilk bölüme! Ekrana dokun: Odi zıplar. Basılı tutarsan daha uzağa gider. Notaları topla!', context: 'Hikâye 7/7: 1. bölüm başlamadan, nasıl oynanır', emotion: 'heyecanlı (excited)' },

  // ---- 1. bölüm sonucu
  { id: 'sonuc-01', text: 'Bravo! İlk bölümü geçtin. Ninni bir adım daha yol aldı.', context: '1. bölüm sonuç ekranı, yıldızlar parlarken', emotion: 'gururlu, sevinçli (proud)' },
  { id: 'sonuc-02', text: 'Yıldızlar bölümü ne kadar iyi geçtiğini gösterir: notaların çoğunu topla, hızlı ol, hiç düşme. Üç yıldız en iyisi!', context: 'Sonuç: yıldızlar açıklanır', emotion: 'öğretici, sıcak (explaining)' },
  { id: 'sonuc-03', text: 'Topladığın notalar jetona dönüşür. Jetonla yetenek alır, kampını büyütürsün.', context: 'Sonuç: nota ve jeton açıklanır', emotion: 'öğretici (explaining)' },
  { id: 'sonuc-04', text: 'Şimdi yolculuğun haritasına bakalım. Harita düğmesine dokun.', context: 'Sonuç: Harita düğmesi gösterilir (oyuncu dokunur)', emotion: 'davet eden (inviting)' },

  // ---- harita turu
  { id: 'harita-01', text: 'İşte yolun: kulak kepçesinden beyne uzanır. Her bölüm seni biraz daha ileri götürür.', context: 'Harita ilk kez açılınca', emotion: 'hayranlık (wonder)' },
  { id: 'harita-02', text: 'Üstte seviyen, yıldızların ve jetonların var.', context: 'Harita: üst bilgi çubuğu vurgulanır', emotion: 'sakin, öğretici (calm)' },
  { id: 'harita-03', text: 'Aşağıdaki yerler kilitli. Bölüm geçtikçe tek tek açılır; her yenisini sana ben göstereceğim.', context: 'Harita: kilitli alt sekmeler', emotion: 'gizemli, söz veren (promising)' },
  { id: 'harita-04', text: 'Sıradaki bölüm burada. Dokun ve devam et!', context: 'Harita: sıradaki bölüm düğmesi (oyuncu dokunur)', emotion: 'cesaret veren, göz kırpan (encouraging)' },

  // ---- alt sekmeye dokun (her açılış turunda gerekirse)
  { id: 'sekme-bugun', text: 'Aşağıdaki Bugün düğmesine dokun.', context: 'Alt sekme çubuğunda Bugün vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-kamp', text: 'Aşağıdaki Kamp düğmesine dokun.', context: 'Alt sekme çubuğunda Kamp vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-profil', text: 'Aşağıdaki Profil düğmesine dokun.', context: 'Alt sekme çubuğunda Profil vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-takim', text: 'Aşağıdaki Takım düğmesine dokun.', context: 'Alt sekme çubuğunda Takım vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-harita', text: 'Aşağıdaki Harita düğmesine dokun.', context: 'Alt sekme çubuğunda Harita vurgulanır', emotion: 'yönlendiren (guiding)' },

  // ---- Bugün (2. bölümden sonra açılır)
  { id: 'bugun-01', text: 'Yeni bir yer açıldı: Bugün! Her gün uğra; takvim ödülü, üç görev ve günlük sandık seni bekler.', context: 'Açılış kutlaması: Bugün', emotion: 'coşkulu (celebratory)' },
  { id: 'bugun-02', text: 'Bugünün takvim ödülü hazır. Al’a dokun ve topla!', context: 'Bugün: takvim ödülü (oyuncu dokunur)', emotion: 'neşeli (cheerful)' },
  { id: 'bugun-03', text: 'İşte ödülün! Topla’ya dokun, jetonlar cebine girsin.', context: 'Bugün: ödül kutlaması açık (oyuncu dokunur)', emotion: 'sevinçli (delighted)' },
  { id: 'bugun-04', text: 'Bunlar günlük görevler. Oynadıkça dolar; bitince ödülünü buradan alırsın. Üçü de bitince sandık açılır.', context: 'Bugün: günlük görevler listesi', emotion: 'öğretici (explaining)' },

  // ---- Kamp (3. bölümden sonra) ve kamp öğreticisi
  { id: 'kamp-01', text: 'Yeni bir yer açıldı: Kulak Kampı! Burada binalar kurarsın; sen oyundayken bile çalışırlar.', context: 'Açılış kutlaması: Kamp', emotion: 'coşkulu (celebratory)' },
  { id: 'kamp-insa-01', text: 'Burası senin kampın. Binalar jeton üretir, kalkan şansı verir, takımına güç katar.', context: 'Kamp öğreticisi: kamp ilk kez açılınca', emotion: 'gururlu, sıcak (proud)' },
  { id: 'kamp-insa-02-depo', text: 'İlk işimiz: Kulak Deposu. Binaya dokun.', context: 'Kamp öğreticisi: Kulak Deposu arsası vurgulanır (oyuncu dokunur)', emotion: 'yönlendiren (guiding)' },
  { id: 'kamp-insa-02', text: 'İlk işimiz: parlayan bina. Binaya dokun.', context: 'Kamp öğreticisi: depo kuruluysa başka bir bina vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'kamp-insa-03', text: 'Bu panelde binanın şimdi ne yaptığı ve bir sonraki seviyede ne olacağı yazar.', context: 'Kamp öğreticisi: bina panelinde etki satırı', emotion: 'öğretici (explaining)' },
  { id: 'kamp-insa-04', text: 'Bedeli ve süresi burada. Şimdi düğmeye dokun ve inşaatı başlat!', context: 'Kamp öğreticisi: Kur düğmesi (oyuncu dokunur)', emotion: 'cesaret veren (encouraging)' },
  { id: 'kamp-insa-05', text: 'Harika, inşaat başladı! Süre dolunca hazır olur. Takımın olunca arkadaşların tek dokunuşla hızlandırır.', context: 'Kamp öğreticisi: inşaat başladı', emotion: 'sevinçli, göz kırpan (delighted)' },

  // ---- Arkadaşlar (4. bölümden sonra)
  { id: 'arkadas-01', text: 'Yeni: Arkadaşlar ve mesajlar! Arkadaşını kodla ekle, mesajlaş, her gün hediye gönder.', context: 'Açılış kutlaması: Arkadaşlar', emotion: 'coşkulu (celebratory)' },
  { id: 'arkadas-02', text: 'Arkadaşlar burada. Arkadaş kodunu paylaş; birlikte daha hızlı ilerlersiniz.', context: 'Profil: Arkadaşlar kutucuğu vurgulanır', emotion: 'sıcak (warm)' },

  // ---- Kulak Sözlüğü (4. bölümden sonra, arkadaşlardan hemen sonra)
  { id: 'sozluk-01', text: 'Yeni: Kulak Sözlüğü! Ulaştığın her bölgenin terimleri burada: önce sade anlatım, istersen odyoloji ayrıntısı.', context: 'Açılış kutlaması: Kulak Sözlüğü', emotion: 'bilge, meraklandıran (wise, curious)' },
  { id: 'sozluk-02', text: 'Sözlük burada, Profil’in içinde. Dokun ve bir bak!', context: 'Profil: Kulak Sözlüğü kutucuğu (oyuncu dokunur)', emotion: 'davet eden (inviting)' },
  { id: 'sozluk-03', text: 'Her terimin sade bir tanımı var. Daha fazla’ya dokunursan odyoloji öğrencileri için ayrıntı açılır.', context: 'Kulak Sözlüğü: ilk terim kartı', emotion: 'öğretici, sıcak (explaining)' },

  // ---- Takım (5. bölümden sonra)
  { id: 'takim-01', text: 'Yeni: Takım! Takımda birbirinize yardım edersiniz: inşaatlar hızlanır, kalkan gelir.', context: 'Açılış kutlaması: Takım', emotion: 'coşkulu (celebratory)' },
  { id: 'takim-02', text: 'Birlikte Bölge Savaşı’nda yer kaparsınız ve Gürültü Canavarı’na hep beraber vurursunuz.', context: 'Takım: takım avantajları', emotion: 'heyecanlı, cesur (rousing)' },
  { id: 'takim-03', text: 'Bir takıma kodla katılabilir ya da kendi takımını kurabilirsin. Karar senin!', context: 'Takım: kodla katıl / takım kur', emotion: 'göz kırpan (playful)' },

  // ---- Mağaza (6. bölümden sonra)
  { id: 'magaza-01', text: 'Yeni: Mağaza, Dolap ve Ödül kutusu! Odi’ye şapka ve renk seç, ödüllerini topla.', context: 'Açılış kutlaması: Mağaza ve Dolap', emotion: 'coşkulu (celebratory)' },
  { id: 'magaza-02', text: 'Dolap burada: Odi’yi istediğin gibi giydir. Kazandığın kozmetikler hep buraya gelir.', context: 'Profil: Dolap kutucuğu vurgulanır', emotion: 'neşeli (cheerful)' },

  // ---- Etkinlikler (7. bölümden sonra)
  { id: 'etkinlik-01', text: 'Yeni: Etkinlikler! Ralli, düello, bayrak yarışı ve quiz: takımca oynanır, ödülleri büyüktür.', context: 'Açılış kutlaması: Etkinlikler', emotion: 'coşkulu (celebratory)', spoken: 'Yeni: Etkinlikler! Ralli, düello, bayrak yarışı ve kuiz: takımca oynanır, ödülleri büyüktür.' },
  { id: 'etkinlik-02', text: 'Etkinlik çadırı haritanın sağında. Dokun ve bir bak!', context: 'Harita: etkinlik çadırı (oyuncu dokunur)', emotion: 'merak uyandıran (intriguing)' },

  // ---- Canlı yarış (8. bölümden sonra)
  { id: 'yaris-01', text: 'Yeni: Canlı yarış ve meydan okuma! Arkadaşınla aynı bölümü aynı anda koş; kim önde bitirecek?', context: 'Açılış kutlaması: Canlı yarış', emotion: 'heyecanlı, meydan okuyan (competitive)' },

  // ---- İletişim (docs/13-iletisim.md) — kayıtlı ses yok: tools/voice/generate.mjs ile yeniden üretilmeli (o zamana dek altyazı / cihaz sesi)
  { id: 'yazi-01', text: 'Sekiz bölümü geçtin! Artık sohbette kendi sözlerinle de yazabilirsin.', context: 'Açılış kutlaması: serbest yazı (8. bölümden sonra; öncesinde yalnız hazır sözler)', emotion: 'gururlu, sıcak (proud, warm)' },
  { id: 'yazi-02', text: 'Birkaç kural: nazik ol ve kişisel bilgini paylaşma. Kötü sözler yıldızlanır; üç kişinin şikâyet ettiği mesaj gizlenir.', context: 'Serbest yazı kuralları (bir kez gösterilir)', emotion: 'bilge, şefkatli (wise, caring)' },
  { id: 'akis-01', text: 'Yeni: Takım Akışı! Takım arkadaşın bölüm geçince, canavar yenince ya da altın koklea bulunca sohbette bir kart belirir.', context: 'Açılış kutlaması: Takım Akışı (6. bölümden sonra)', emotion: 'coşkulu (celebratory)' },
  { id: 'akis-02', text: 'Karta bir tepki bırak ya da Tebrik et’e dokun. Hazır sözlerle tek dokunuşta konuşursun; takılırsan takımından yardım iste!', context: 'Takım sohbeti: akış kartı ve hazır sözler vurgulanır', emotion: 'sıcak, cesaret veren (warm, encouraging)' },
  // ---- Sıralama (docs/15-siralama.md, 5. bölümden sonra) — kayıtlı ses yok: tools/voice/generate.mjs ile üretilmeli
  { id: 'sira-01', text: 'Yeni: Sıralama! En güçlü oyuncular ve takımlar burada sıralanır; her pazartesi yeni bir hafta başlar.', context: 'Açılış kutlaması: Sıralama (5. bölümden sonra)', emotion: 'heyecanlı, meydan okuyan (competitive)' },
  { id: 'sira-02', text: 'Profildeki Sıralama’ya dokun. Puanlar yalnızca gerçekten oynadığın bölümlerden gelir; nasıl hesaplandığını soru işaretinde anlatırım.', context: 'Profil: Sıralama kutucuğu vurgulanır', emotion: 'sıcak, açıklayıcı (warm, explaining)' },
  { id: 'sira-03', text: 'Senin satırın hep en altta durur. Oklar dünden beri kaç sıra yükseldiğini gösterir; haftanın ilk sıralarına kristal var!', context: 'Sıralama: kendi satırı vurgulanır', emotion: 'göz kırpan, cesaret veren (playful, encouraging)' },
  // ---- Takım rekabeti (docs/16-takim-rekabeti.md) — kayıtlı ses yok: tools/voice/generate.mjs ile üretilmeli
  { id: 'tlig-01', text: 'Yeni: Takım Ligi! Takımın iki haftalık sezonlarda benzer takımlarla bir grupta yarışır. İlk üç bir üst kademeye çıkar.', context: 'Açılış kutlaması: Takım Ligi (6. bölümden sonra)', emotion: 'heyecanlı (excited)' },
  { id: 'tlig-02', text: 'Lig puanı savaştan, baskından, bilgi sorularından, düellodan ve takım yarışından gelir. Takım sekmesindeki Lig’e bak.', context: 'Takım: Lig sekmesi vurgulanır', emotion: 'açıklayıcı, sıcak (explaining, warm)' },
  { id: 'tyaris-01', text: 'Yeni: Canlı Takım Yarışı! İki takım aynı bölümü aynı anda koşar; bitiş sıran ve yıldızların takımına puan olur.', context: 'Açılış kutlaması: Canlı Takım Yarışı (9. bölümden sonra)', emotion: 'coşkulu, meydan okuyan (celebratory, competitive)' },
  { id: 'tyaris-02', text: 'Lider lobi açar, sen katılıp Hazırım dersin. Rakip takımlar gerçek oyunculardır; kimse yoksa bunu açıkça söylerim.', context: 'Takım: Takım Yarışı sekmesi vurgulanır', emotion: 'bilge, dürüst (wise, honest)' },
  { id: 'soru-01', text: 'Yeni: Günün Sorusu! Her gün takım sohbetine bir kulak sorusu bırakırım. Akşam sekizde cevabını ve açıklamasını söylerim; birlikte tartışın!', context: 'Açılış kutlaması: Günün Sorusu (9. bölümden sonra)', emotion: 'bilge, meraklandıran (wise, curious)' },
  { id: 'soru-02', text: 'İşte bugünün sorusu. Bir şık seç; doğru bilene jeton var.', context: 'Takım sohbeti: Günün Sorusu kartı vurgulanır', emotion: 'göz kırpan (playful)' },
  { id: 'ikili-01', text: 'Yeni: İkili Görev! Bir arkadaşınla haftalık ortak hedef seçin; ikinizin notaları birlikte sayılır, sandığı birlikte açarsınız.', context: 'Açılış kutlaması: İkili Görev (10. bölümden sonra)', emotion: 'coşkulu (celebratory)' },
  { id: 'ikili-02', text: 'Birlikte burada, Profil’in içinde. Arkadaşını seç ve davet et.', context: 'Profil: Birlikte kutucuğu vurgulanır', emotion: 'davet eden (inviting)' },
  { id: 'usta-01', text: 'Artık bir ustasın! Yeni başlayan bir arkadaşına çırak teklif et; o ilerledikçe ikiniz de ödül alırsınız.', context: 'Açılış kutlaması: Usta–Çırak (11. bölümden sonra)', emotion: 'gururlu, sıcak (proud, warm)' },
  // ---- Kulak Kampı: bina yükselince tek satır (bina başına üç, sırayla), Tedavi Odası, bölge anıtları (docs/14-kamp.md) — kayıtlı ses yok: tools/voice ile üretilmeli
  { id: 'kamp-sv-merkez-1', text: 'Merkez büyüdükçe kampın da büyür. Odyolojide tek bir test yetmez; testler birbirini doğrular.', context: 'Kamp: Odyoloji Merkezi yükseldi (Sv 1, 4, 7, 10, 13)', emotion: 'gururlu, bilge (proud, wise)' },
  { id: 'kamp-sv-merkez-2', text: 'Bir odyolog işitmeyi de dengeyi de değerlendirir. Merkezin artık diğer binalara daha yüksek kat açıyor.', context: 'Kamp: Odyoloji Merkezi yükseldi (Sv 2, 5, 8, 11, 14)', emotion: 'sıcak, öğretici (warm, explaining)' },
  { id: 'kamp-sv-merkez-3', text: 'Erken tanı, erken destek demektir. Merkezin büyüdü; şimdi diğer binaları da yükseltebilirsin.', context: 'Kamp: Odyoloji Merkezi yükseldi (Sv 3, 6, 9, 12, 15)', emotion: 'cesaret veren (encouraging)' },
  { id: 'kamp-sv-laboratuvar-1', text: 'Odyometride her frekansta duyabildiğin en hafif sesi ararız. Ölçtükçe daha çok öğrenir, daha çok jeton kazanırsın.', context: 'Kamp: Odyometri Odası yükseldi (Sv 1, 4, 7, 10, 13)', emotion: 'neşeli, öğretici (cheerful, explaining)' },
  { id: 'kamp-sv-laboratuvar-2', text: 'Kulaklıkla verilen ses hava yolunu, kulağın arkasındaki titreşim kemik yolunu ölçer.', context: 'Kamp: Odyometri Odası yükseldi (Sv 2, 5, 8, 11, 14)', emotion: 'öğretici (explaining)' },
  { id: 'kamp-sv-laboratuvar-3', text: 'Ses geçirmez kabin, dışarının gürültüsü testi bozmasın diye vardır. Odan bir kat daha iyi ölçüyor!', context: 'Kamp: Odyometri Odası yükseldi (Sv 3, 6, 9, 12, 15)', emotion: 'gururlu (proud)' },
  { id: 'kamp-sv-atolye-1', text: 'İşitme cihazı sesi her frekansta ayrı ayrı güçlendirir. İyi ayarlanmış cihaz, zor anda kalkan gibi destek olur.', context: 'Kamp: İşitme Cihazı Atölyesi yükseldi (Sv 1, 4, 7, 10, 13)', emotion: 'sıcak, öğretici (warm, explaining)' },
  { id: 'kamp-sv-atolye-2', text: 'Cihaz ayarı odyograma göre yapılır; kazanç, her frekansta kaybın derecesine göre seçilir.', context: 'Kamp: İşitme Cihazı Atölyesi yükseldi (Sv 2, 5, 8, 11, 14)', emotion: 'öğretici (explaining)' },
  { id: 'kamp-sv-atolye-3', text: 'Kulak kalıbı cihazın sesini kanala taşır ve o tiz ıslığı, yani geri beslemeyi azaltır.', context: 'Kamp: İşitme Cihazı Atölyesi yükseldi (Sv 3, 6, 9, 12, 15)', emotion: 'göz kırpan (playful)' },
  { id: 'kamp-sv-depo-1', text: 'Kulak kiri kendiliğinden birikir ve kendiliğinden dışarı taşınır. Deponda da jeton böyle kendiliğinden birikir.', context: 'Kamp: Kulak Deposu yükseldi (Sv 1, 4, 7, 10, 13)', emotion: 'göz kırpan (playful)' },
  { id: 'kamp-sv-depo-2', text: 'Kulak kiri kanalı korur ve nemli tutar. Kulağını pamuklu çubukla kurcalama; deponu ise sık sık topla!', context: 'Kamp: Kulak Deposu yükseldi (Sv 2, 5, 8, 11, 14)', emotion: 'şefkatli, şakacı (caring, playful)' },
  { id: 'kamp-sv-depo-3', text: 'Kanal derisi içten dışa doğru yavaşça kayar ve kiri dışarı taşır. Deponun kapasitesi arttı.', context: 'Kamp: Kulak Deposu yükseldi (Sv 3, 6, 9, 12, 15)', emotion: 'öğretici (explaining)' },
  { id: 'kamp-sv-kule-1', text: 'Timpanometri, kanaldaki basıncı değiştirip kulak zarının ne kadar rahat hareket ettiğini ölçer.', context: 'Kamp: Timpanometri Kulesi yükseldi (Sv 1, 4, 7, 10, 13)', emotion: 'öğretici, merak uyandıran (curious)' },
  { id: 'kamp-sv-kule-2', text: 'Düz bir timpanogram çoğu zaman orta kulakta sıvıyı düşündürür. Kulen artık takımının sesini daha uzağa taşıyor.', context: 'Kamp: Timpanometri Kulesi yükseldi (Sv 2, 5, 8, 11, 14)', emotion: 'kararlı (determined)' },
  { id: 'kamp-sv-kule-3', text: 'Çok yüksek seste minicik stapedius kası kasılır. Bu akustik refleks de aynı cihazla ölçülür.', context: 'Kamp: Timpanometri Kulesi yükseldi (Sv 3, 6, 9, 12, 15)', emotion: 'hayranlık (wonder)' },
  { id: 'kamp-sv-revir-1', text: 'Klinikte ilk iş, ışıklı bir aletle kanala ve kulak zarına bakmaktır. Erken fark edilen sorun kolay atlatılır.', context: 'Kamp: Odyoloji Kliniği yükseldi (Sv 1, 4, 7, 10, 13)', emotion: 'şefkatli (caring)' },
  { id: 'kamp-sv-revir-2', text: 'Yenidoğan işitme taraması, işitme kaybını erken bulup erken desteklemeyi sağlar.', context: 'Kamp: Odyoloji Kliniği yükseldi (Sv 2, 5, 8, 11, 14)', emotion: 'sıcak, öğretici (warm, explaining)' },
  { id: 'kamp-sv-revir-3', text: 'Klinik büyüdü! İlk darbeyi yok sayma şansın arttı; tıpkı erken tanının koruması gibi.', context: 'Kamp: Odyoloji Kliniği yükseldi (Sv 3, 6, 9, 12, 15)', emotion: 'gururlu (proud)' },
  { id: 'kamp-sv-tedavi-1', text: 'Tedavi Odası koruma ve tedavi malzemesi hazırlar. Bir tarif seç; raf dolunca topla.', context: 'Kamp: Tedavi Odası yükseldi (Sv 1, 4, 7, 10, 13)', emotion: 'neşeli, yönlendiren (cheerful, guiding)' },
  { id: 'kamp-sv-tedavi-2', text: 'Yeni bir tarif açılmış olabilir! Malzemeyi bölüme yanında götür; uygun engeli bir kez etkisiz kılar.', context: 'Kamp: Tedavi Odası yükseldi (Sv 2, 5, 8, 11, 14)', emotion: 'heyecanlı (excited)' },
  { id: 'kamp-sv-tedavi-3', text: 'Unutma: gerçek hayatta tedaviyi hekim ve odyolog birlikte seçer. Burada ise oynayarak öğreniriz.', context: 'Kamp: Tedavi Odası yükseldi (Sv 3, 6, 9, 12, 15)', emotion: 'bilge, şefkatli (wise, caring)' },
  { id: 'tedavi-al-01', text: 'Malzemelerin çantanda! Haritada bir bölüm kartı aç, Çanta’ya dokun ve götürmek istediklerini seç. Kullanmadığın kaybolmaz.', context: 'Kamp: Tedavi Odası rafı ilk kez toplandı', emotion: 'sıcak, yönlendiren (warm, guiding)' },
  { id: 'anit-dis-kulak', text: 'Dış Kulak anıtı kampına geldi! Kulak kepçesi sesi toplar ve kanala yönlendirir.', context: 'Kamp: bölge anıtı yükseldi (Dış Kulak)', emotion: 'coşkulu (celebratory)' },
  { id: 'anit-kanal', text: 'Kanal anıtı yükseldi! Kulak kanalı bazı sesleri, şişe ağzına üflemek gibi güçlendirir.', context: 'Kamp: bölge anıtı yükseldi (Kanal)', emotion: 'coşkulu (celebratory)' },
  { id: 'anit-zar', text: 'Kulak Zarı anıtı geldi! Zar, gelen sesle titreşir ve titreşimi kemikçiklere verir.', context: 'Kamp: bölge anıtı yükseldi (Zar)', emotion: 'coşkulu (celebratory)' },
  { id: 'anit-kemikcikler', text: 'Kemikçikler anıtı kuruldu: çekiç, örs ve üzengi! Vücudumuzun en küçük kemikleri.', context: 'Kamp: bölge anıtı yükseldi (Kemikçikler)', emotion: 'hayranlık (wonder)' },
  { id: 'anit-koklea-1', text: 'Koklea anıtı parlıyor! Salyangoz biçimli koklea, titreşimi sinir sinyaline hazırlar.', context: 'Kamp: bölge anıtı yükseldi (Koklea 1)', emotion: 'hayranlık (wonder)' },
  { id: 'anit-koklea-2', text: 'Tüy hücresi anıtı geldi! Benim akrabalarım: sesle eğilir ve elektrik sinyalini başlatırlar.', context: 'Kamp: bölge anıtı yükseldi (Koklea 2)', emotion: 'gururlu, duygulu (proud, touched)' },
  { id: 'anit-koklea-3', text: 'Tonotopi anıtı kuruldu! Kokleanın tabanı ince seslere, tepesi kalın seslere yanıt verir.', context: 'Kamp: bölge anıtı yükseldi (Koklea 3)', emotion: 'öğretici, coşkulu (explaining, celebratory)' },
  { id: 'anit-sinir', text: 'İşitme siniri anıtı yandı! Sinyaller binlerce lifle beyin sapına koşar.', context: 'Kamp: bölge anıtı yükseldi (Sinir)', emotion: 'heyecanlı (excited)' },
  { id: 'anit-beyin-sapi', text: 'Beyin Sapı anıtı kuruldu! İki kulaktan gelen sesler burada buluşur; sesin yönünü böyle buluruz.', context: 'Kamp: bölge anıtı yükseldi (Beyin Sapı)', emotion: 'bilge (wise)' },
  { id: 'anit-korteks', text: 'Korteks anıtı tamam! İşitsel korteks sesi anlamlı bir kelimeye, bir ninniye dönüştürür.', context: 'Kamp: bölge anıtı yükseldi (Korteks)', emotion: 'duygulu, gururlu (touched, proud)' },
  // ---- Bölüm içi (GameEvent 'hint'; ftue/hints.ts): yalnız seçilmiş ipuçları, oyuncu başına bir kez — ekrandaki yazıyla aynı anlamda kısa cümle
  { id: 'ipucu-tazele-kayma', text: 'Hatırla: aşağı kaydır, perdenin altından kay!', context: '5. bölüm: kayma tazeleme anı (ilk perdeden önce, bir kez)', emotion: 'sıcak, hatırlatan (warm, reminding)' },
  { id: 'ipucu-perde-kay', text: 'Kıl perdesi alçak. Aşağı kaydır, altından kay!', context: '3-8. bölüm: ilk kıl perdesinin önünde (oyuncu başına bir kez)', emotion: 'sakin, yol gösteren (calm, guiding)' },
  { id: 'ipucu-ogret-zipla', text: 'Ekrana dokun, zıpla! Basılı tutarsan daha yükseğe çıkarsın.', context: '1. bölüm: Zıpla öğretici anı', emotion: 'neşeli, cesaret veren (cheerful, encouraging)' },
  { id: 'ipucu-ogret-don', text: 'Geri dönmek için parmağını koşunun tersine kaydır.', context: '2. bölüm: Geri Dön öğretici anı', emotion: 'sakin, yol gösteren (calm, guiding)' },
  { id: 'ipucu-ogret-kayma', text: 'Aşağı kaydır: alçak engelin altından kayarsın!', context: '3. bölüm: Kayma öğretici anı', emotion: 'neşeli, yol gösteren (cheerful, guiding)' },
  { id: 'ipucu-ogret-duvar', text: 'Duvara değdiğin an dokun: karşı duvara zıplarsın!', context: '6. bölüm: Duvar Zıplaması öğretici anı', emotion: 'heyecanlı (excited)' },
  { id: 'ipucu-ogret-suzul', text: 'Havada basılı tut: ses kanatlarınla süzülürsün.', context: '9. bölüm: Süzülme öğretici anı', emotion: 'yumuşak, hayran (soft, admiring)' },
  { id: 'ipucu-ogret-trambolin', text: 'Zara değdiğin an dokun: güçlü bir sıçrayış!', context: '9. bölüm: Zar Sıçrayışı öğretici anı', emotion: 'heyecanlı (excited)' },
  { id: 'ipucu-ogret-kanca', text: 'Kancanın yanında basılı tut ve sallan; bırakınca fırlarsın!', context: '13. bölüm: Kanca öğretici anı', emotion: 'heyecanlı, yol gösteren (excited, guiding)' },
  { id: 'ipucu-ogret-cakil', text: 'Havada aşağı kaydır: çatlak zemini kır, anahtara bas!', context: '15. bölüm: Yere Çakılma öğretici anı', emotion: 'kararlı (determined)' },
  { id: 'ipucu-ogret-yuz', text: 'Sıvıda basılı tut, yüksel; bırakınca dalarsın.', context: '21. bölüm: Yüzme öğretici anı', emotion: 'sakin (calm)' },
  { id: 'ipucu-ogret-darbe', text: 'Koşu yönüne kaydır: ses darbesiyle gürültü duvarını kır!', context: '31. bölüm: Ses Darbesi öğretici anı', emotion: 'güçlü, coşkulu (strong, rousing)' },
  { id: 'ipucu-ogret-cevir', text: 'Mor bölgede dokun: yerçekimi ters döner!', context: '35. bölüm: Yerçekimi Çevirme öğretici anı', emotion: 'gizemli, heyecanlı (mysterious, excited)' },
];

const BY_ID = new Map(NARRATOR_LINES.map((l) => [l.id, l]));

/** satırın metni (bilinmeyen kimlik bir yazım hatasıdır: hemen fark edilsin) */
/** bu kimlikte bir satır var mı */
export const hasLine = (id: string): boolean => BY_ID.has(id);
export function lineText(id: string): string {
  const l = BY_ID.get(id);
  if (!l) throw new Error(`Tüy Dede satırı yok: ${id}`);
  return l.text;
}

/** metnin kısa parmak izi (FNV-1a 32 bit): kayıt bu metinle mi yapıldı? Boşluk farkları sayılmaz. */
export function textHash(text: string): string {
  const s = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
