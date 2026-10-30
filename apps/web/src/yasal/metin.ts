/**
 * Yasal metinler: TEK kaynak (oyun içi sayfalar + herkese açık /gizlilik, /en/privacy, /hesap-sil). Ortak yapı: yasal.ts.
 *
 * Her cümle kodun bugün yaptığına göre yazıldı; dayanakları docs/yonetim/gizlilik.md "Kod karşılığı" tablosunda.
 * Kod değişirse (yeni veri, yeni süre, yeni hizmet sağlayıcı) bu dosya ve o tablo birlikte güncellenir.
 * Sayılar kodla eşleşir: `yasal.test.ts` sohbet (30 gün), şikâyet (90 gün), kod denemesi (90 gün), özel mesaj (500), yedek
 * (28 kopya = 7 gün), serbest yazı eşiği (8. bölüm), satın alma (10 yıl), çökme raporu (30 gün), geri bildirim (90 gün; saatte 5, günde 20; 500 karakter) değerlerini sunucu sabitleriyle karşılaştırır.
 */
import type { Belge } from './yasal';

// ------------------------------------------------------------------ Gizlilik politikası ve KVKK aydınlatma metni (TR)
export const GIZLILIK_TR: Belge = {
  dil: 'tr', yol: '/gizlilik', dosya: 'gizlilik.html',
  baslik: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
  ozet: 'ODİ: Sesin Yolu hangi verileri neden işler, ne kadar saklar; haklarınız ve hesabınızı nasıl silersiniz.',
  bloklar: [
    { t: 'p', x: '**ODİ: Sesin Yolu** (oyun) · yürürlük tarihi: {YURURLUK} · [English version](/en/privacy)' },
    { t: 'not', x: 'Kısaca: Oyun sizden **gerçek ad, e-posta, telefon, konum, rehber, fotoğraf ya da reklam kimliği istemez.** Oyunda **reklam yoktur**, kullanım analizi ya da reklam izleme aracı yoktur. Oyunu oynamak için gereken en az veriyi tutarız. Hesabınızı oyunun içinden istediğiniz an silebilirsiniz.' },

    { t: 'h2', x: '1. Veri sorumlusu ve iletişim', id: 'sorumlu' },
    { t: 'p', x: 'Veri sorumlusu: **{YAYINCI_UNVAN}** ("{YAYINCI}", "biz"). Adres: {YAYINCI_ADRES}.' },
    { t: 'p', x: 'Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m.10 uyarınca aydınlatma metnidir. Sorularınız ve başvurularınız için: [{ILETISIM_EPOSTA}](mailto:{ILETISIM_EPOSTA}).' },

    { t: 'h2', x: '2. Hesabınız nasıl oluşur', id: 'hesap' },
    { t: 'ul', x: [
      'Kayıt formu yoktur. Oyun internete ilk bağlandığında sunucu size **rastgele bir oyuncu kimliği** ve **gizli bir anahtar** verir. Anahtar yalnızca cihazınızda saklanır; sunucuda anahtarın kendisi değil, yalnızca geri çevrilemeyen özeti tutulur.',
      'Bir **takma ad** seçebilirsiniz (seçmezseniz "Odi" ve dört rakam). Gerçek adınızı yazmak zorunda değilsiniz; yazmamanızı öneririz.',
      'İnternetsiz oynarsanız sunucuya hiçbir şey gitmez; ilerlemeniz yalnızca cihazınızda kalır.',
    ] },

    { t: 'h2', x: '3. Hangi verileri, neden ve ne kadar süre işliyoruz', id: 'veriler' },
    { t: 'p', x: 'Hukuki sebepler KVKK m.5/2: (c) sözleşmenin kurulması ve ifası, yani oyunu size sunmak; (ç) hukuki yükümlülüğümüz; (f) temel hak ve özgürlüklerinize zarar vermemek kaydıyla meşru menfaatimiz (güvenlik, kötüye kullanımın önlenmesi, oyuncuların korunması). Açık rızaya dayanan bir işleme ve pazarlama amaçlı işleme yoktur.' },
    { t: 'tablo', bas: ['Veri', 'Neden', 'Hukuki sebep', 'Saklama süresi'], satir: [
      ['**Cihazınızda:** ilerleme, jetonlar, ayarlar, ses tercihleri, oyuncu anahtarı, gönderilmeyi bekleyen işlemler', 'Oyunun çalışması', 'Bize gelmez', 'Siz silene kadar (Hesabı sil ya da uygulamayı kaldırma)'],
      ['Rastgele oyuncu kimliği, anahtarın özeti, arkadaş kodu', 'Hesabınızı tanımak, arkadaş eklemek', 'm.5/2-c', 'Hesap silinene kadar'],
      ['Takma ad, renk, şapka ve kostüm', 'Oyunda ve sıralamada görünmek', 'm.5/2-c', 'Hesap silinene kadar'],
      ['Oyun verisi: bölüm sonuçları, yıldız, puan, XP, cüzdan (jeton, kristal, hızlandırıcı), kamp, görevler, etkinlik, lig ve sıralama kayıtları', 'İlerlemeniz, ödüller, sıralamalar, hile önleme', 'm.5/2-c', 'Hesap silinene kadar; tek tek bölüm gönderim kayıtları 30 gün'],
      ['Takım üyeliği; kurduysanız takım adı ve açıklaması; arkadaşlıklar, istekler, engellemeler', 'Takım ve arkadaş özellikleri, güvenlik', 'm.5/2-c ve f', 'Hesap silinene kadar'],
      ['Rozet ve unvanlar (Kurucu Yolcu, Hata Avcısı) ve alındığı zaman; çerçeve ve "Adım listede görünsün" seçiminiz', 'Kapalı betaya ve hata bulmaya katkıyı oyunda göstermek (yalnız görünüş)', 'm.5/2-c', 'Hesap silinene kadar'],
      ['Takım ve genel sohbet mesajları', 'Sohbet', 'm.5/2-c', '30 gün; hesabınızı silince yazdıklarınız hemen'],
      ['Özel mesajlar (arkadaşlar arası)', 'Mesajlaşma', 'm.5/2-c', 'Her konuşmada son 500 mesaj; siz ya da karşı taraf hesabını silince konuşma silinir'],
      ['Şikâyet kayıtları (şikâyet eden, şikâyet edilen, ileti, neden, zaman)', 'Moderasyon, oyuncuların korunması', 'm.5/2-f', '90 gün, sonra otomatik silinir'],
      ['Ödül kodu denemeleri (zaman, oyuncu kimliği, IP adresi)', 'Kod tahminini ve kötüye kullanımı önlemek', 'm.5/2-f', '90 gün, sonra otomatik silinir'],
      ['Bağlantı sırasında IP adresi', 'Bağlantının kurulması, aynı adresten kısa sürede çok sayıda hesap açılmasını sınırlamak', 'm.5/2-f', 'Diske yazılmaz; yalnız sunucu belleğinde, bağlantı süresince ve hesap açma sınırı için en çok 2 saat'],
      ['Satın alma kaydı: ürün, zaman, mağaza (App Store / Google Play), tutar, mağaza işlem numarası', 'Satın almayı doğrulamak, aynı makbuzun iki kez kullanılmasını önlemek, aylık harcama sınırı', 'm.5/2-c ve ç (vergi ve ticaret hukuku)', '10 yıl (işlemin yapıldığı yılın sonundan başlayarak), sonra otomatik silinir; hesabınızı silince kayıttaki oyuncu kimliği kaldırılır'],
      ['Sunucu günlükleri (oyuncu kimliğiyle bağlantı kapanışı, hata kayıtları)', 'Sunucuyu işletmek, hataları bulmak', 'm.5/2-f', '30 gün'],
      ['Çökme raporları (hesabınıza bağlı değil; ayrıntı aşağıda)', 'Oyunun çöktüğü ya da boş ekranda kaldığı hataları bulup düzeltmek', 'm.5/2-f', '30 gün, sonra otomatik silinir'],
      ['Geri bildirim notları (yalnız siz yazarsanız; hesabınıza bağlı değil; ayrıntı aşağıda)', 'Oyuncuların takıldığı yerleri ve önerilerini öğrenip oyunu düzeltmek', 'm.5/2-f', '90 gün, sonra otomatik silinir'],
      ['Veritabanı yedekleri', 'Veri kaybına karşı geri yükleme', 'm.5/2-f', '6 saatte bir alınır, en yeni 28 kopya (7 gün) tutulur'],
    ] },
    { t: 'p', x: 'Sunucu ayrıca kişiye bağlı olmayan günlük toplam sayaçlar tutar (ör. bir günde gönderilen hazır söz sayısı). Bunlar kişisel veri değildir.' },
    { t: 'p', x: '**Çökme raporları:** Oyun bir hatayla karşılaşırsa (çökme, boş ekran) yalnızca kendi sunucumuza kısa bir rapor gider: hatanın adı ve iletisi (e-posta adresleri, uzun sayılar, bağlantı adreslerinin sorgu kısmı ve anahtar ya da kimlik benzeri metinler çıkarılarak), hatanın koddaki yeri (dosya adı ve satır), uygulama sürümü, platform (web, iOS, Android) ve işletim sisteminin ana sürümü, hatanın olduğu ekranın adı ve dakikaya yuvarlanmış zaman. Rapor **oyuncu kimliğinizi, takma adınızı, anahtarınızı, sohbet metinlerini ya da bir cihaz kimliğini içermez** ve hesabınızla eşleştirilemez. Aynı hata bir oturumda bir kez, bir oturumda en çok 5 rapor gönderilir. IP adresiniz kaydedilmez; kötüye kullanımı sınırlamak için (dakikada 10, günde 100 rapor) yalnızca tuzlanmış bir özeti en çok bir gün sunucu belleğinde tutulur. Raporlar başka bir şirkete gönderilmez ve 30 gün sonra otomatik silinir.' },
    { t: 'p', x: '**Geri bildirim:** Profil › Ayarlar › **Geri bildirim gönder** ile isterseniz bize kısa bir not yazabilirsiniz. Yalnızca kendi sunucumuza şunlar gider: seçtiğiniz konu (Hata, Zorluk, Öneri, Diğer), yazdığınız metin (en çok 500 karakter; e-posta adresleri, telefon numaraları ve uzun sayılar hem cihazınızda hem sunucuda çıkarılarak), Ayarlar\'a gelmeden önceki ekranın adı, uygulama sürümü ve platform (web, iOS, Android). Not **oyuncu kimliğinizi, takma adınızı, anahtarınızı ya da bir cihaz kimliğini içermez** ve hesabınızla eşleştirilemez. Lütfen notunuza adınızı, telefonunuzu ya da e-postanızı yazmayın. IP adresiniz kaydedilmez; kötüye kullanımı sınırlamak için (saatte 5, günde 20 not) yalnızca tuzlanmış bir özeti en çok bir gün sunucu belleğinde tutulur. Notlar başka bir şirkete gönderilmez ve 90 gün sonra otomatik silinir.' },
    { t: 'p', x: '**Kurucu Yolcu rozeti, Kurucular listesi ve "Öneren":** Kapalı betaya katılanlara kişiye özel, tek kullanımlık bir kod verilir; kodu Kod gir\'e yazınca hesabınıza kalıcı **Kurucu Yolcu** rozeti eklenir (hata bulanlara da **Hata Avcısı** unvanı verilebilir). Bunun için sizden **hiçbir kişisel bilgi istenmez**; rozet yalnızca görünüştür, güç, ödül ya da sıralama avantajı vermez. Rozetiniz ve seçtiğiniz çerçeve, takma adınız gibi profilinizde ve takım listesinde görünür. Profil › **Kurucular** ekranında takma adınız **yalnızca siz "Adım listede görünsün" seçeneğini açarsanız** görünür; bu seçenek baştan kapalıdır ve Ayarlar\'dan ya da Kurucular ekranından istediğiniz an kapatılabilir. Bir bilgi yarışması sorusu ya da Kulak Kartı önerdiyseniz oyunda "Öneren: takma ad" yazabilir; bunu **yalnızca siz açıkça izin verirseniz** yaparız (izin kaydını biz tutarız) ve gerçek adınızı asla yazmayız. Hesabınızı silince rozetleriniz ve listedeki yeriniz de silinir.' },
    { t: 'p', x: '**İşlemediklerimiz:** gerçek ad, e-posta, telefon, konum, rehber, fotoğraf, kamera, mikrofon, reklam kimliği, kart bilgisi (geri bildirim notuna da bunları yazmamanızı isteriz; e-posta ve telefon numaraları nottan otomatik çıkarılır). Oyun çerez kullanmaz; web sürümü yalnızca tarayıcının yerel depolamasını ve çevrimdışı açılış için önbelleği kullanır. Kart ve ödeme bilgileriniz bize hiç gelmez: ödemeyi Apple ya da Google alır.' },

    { t: 'h2', x: '4. Kimlere aktarıyoruz', id: 'aktarim' },
    { t: 'p', x: 'Verilerinizi satmayız, reklam için kimseyle paylaşmayız. Yalnızca oyunu sunmak için şu hizmet sağlayıcılarla çalışırız:' },
    { t: 'ul', x: [
      '**Oracle (Oracle Cloud Infrastructure):** oyun sunucusu ve veritabanı bu bulut altyapısında çalışır. Veri merkezi: {SUNUCU_BOLGESI}.',
      '**RevenueCat, Inc. (ABD):** mağaza uygulamasında satın almayı doğrular. RevenueCat\'e rastgele oyuncu kimliğiniz, satın alınan ürün, mağaza işlem bilgisi (zaman, fiyat, para birimi, ülke) ve RevenueCat kitaplığının gönderdiği teknik bilgiler (işletim sistemi, uygulama sürümü) gider. Web sürümünde RevenueCat yoktur.',
      '**Apple ve Google:** uygulamayı dağıtır ve ödemeyi alır. Bu şirketler satın alma ve ödeme bilgilerini kendi gizlilik politikalarına göre işler.',
      'Kanunen zorunlu olduğunda yetkili kurum ve kuruluşlar.',
    ] },
    { t: 'p', x: 'Bu hizmet sağlayıcıların sunucuları Türkiye dışında olabilir; bu aktarım KVKK m.9 kapsamındadır. Aktarımın dayanağı ve güvenceleri hakkında bilgi almak için bize yazabilirsiniz.' },

    { t: 'h2', x: '5. Çocuklar ve sohbet güvenliği', id: 'cocuklar' },
    { t: 'ul', x: [
      'Oyun **13 yaş ve üzeri** içindir. 13 yaşından küçük bir kullanıcıya ait olduğunu öğrendiğimiz hesabı sileriz.',
      'Serbest yazılı sohbet ve özel mesaj, oyunda **8 bölüm geçilene kadar kapalıdır**; o zamana kadar yalnızca hazır sözler ve emoji kullanılır. Bu kısıt kaldırılamaz.',
      'Sohbette ve özel mesajlarda küfür süzgeci vardır; takma adlar ve takım adları da süzülür.',
      'Her oyuncu bir iletiyi ya da oyuncuyu **şikâyet edebilir** ve **engelleyebilir**. Üç farklı oyuncunun şikâyet ettiği ileti gizlenir; bir gün içinde üç farklı oyuncunun şikâyet ettiği oyuncu bir süre mesaj gönderemez. Şikâyetleri inceler, gerekirse hesabın mesaj göndermesini uzun süre kapatırız.',
      'Mesajlar uçtan uca şifreli değildir; kötüye kullanım incelemesi için şikâyet edilen iletileri görebiliriz.',
      'Mağazada aylık harcama sınırı vardır (varsayılan 1000 TL). Sınırı düşürmek hemen, yükseltmek 24 saat sonra geçerli olur.',
    ] },

    { t: 'h2', x: '6. Haklarınız (KVKK m.11)', id: 'haklar' },
    { t: 'p', x: 'Bize başvurarak şunları isteyebilirsiniz: kişisel verinizin işlenip işlenmediğini öğrenmek; işlenmişse bilgi istemek; işleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenmek; yurt içinde ya da yurt dışında aktarıldığı üçüncü kişileri bilmek; eksik ya da yanlışsa düzeltilmesini, KVKK m.7 şartlarıyla silinmesini ya da yok edilmesini ve bu işlemlerin aktarılan kişilere bildirilmesini istemek; yalnızca otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etmek; kanuna aykırı işleme nedeniyle zarara uğradıysanız zararın giderilmesini istemek.' },
    { t: 'ul', x: [
      '**Nasıl başvurulur:** [{ILETISIM_EPOSTA}](mailto:{ILETISIM_EPOSTA}) adresine yazın. Hesabınızı bulabilmemiz için oyundaki **arkadaş kodunuzu** (Profil sayfasında) ve takma adınızı ekleyin. Gizli anahtarınızı hiçbir zaman istemeyiz.',
      'Başvurunuzu en geç **30 gün** içinde, ücretsiz yanıtlarız (KVKK m.13).',
      'Yanıtımızı yetersiz bulursanız Kişisel Verileri Koruma Kurulu\'na şikâyette bulunabilirsiniz (KVKK m.14).',
      'Takma adınızı oyunda Profil sayfasından kendiniz değiştirebilirsiniz.',
    ] },

    { t: 'h2', x: '7. Hesabınızı silme', id: 'silme' },
    { t: 'p', x: '**Oyunun içinden:** Profil › Ayarlar › **Hesabı sil** › onaylayın. İnternet bağlantısı gerekir. Hesabınız sunucuda hemen silinir ve cihazdaki bütün oyun verisi temizlenir. Oyunu açamıyorsanız silme isteğinizi e-postayla iletebilirsiniz: [hesap silme sayfası](/hesap-sil).' },
    { t: 'p', x: '**Uygulamayı kaldırmak hesabınızı silmez;** yalnızca cihazdaki anahtar kaybolur ve hesaba bir daha girilemez. Hesabın silinmesi için yukarıdaki yollardan birini kullanın.' },
    { t: 'p', x: 'Silme tek işlemde yapılır. Sunucuda:' },
    { t: 'ul', x: [
      '**Silinir:** ilerleme, cüzdan, kamp, görevler, etkinlik ve turnuva kayıtlarınız, sıralama ve lig satırlarınız, ödül kutunuz, arkadaşlıklarınız, istekleriniz, engellemeleriniz, özel mesajlarınız, sohbette yazdıklarınız ve sizin hakkınızdaki takım kartları, yardım istekleriniz, takım başvurularınız, rozet ve unvanlarınız ile Kurucular listesindeki yeriniz, ayarlarınız. Takımın son üyesiyseniz takım ve takımın bütün kayıtları da silinir.',
      '**Anonimleşir** (yalnızca başka oyuncuların puanları bozulmasın diye): takımınızın toplam puanına yaptığınız katkılar, geçen haftanın son sıralamasındaki yeriniz, takıma gönderdiğiniz hediye. Bu kayıtlar hiçbir anahtarla eşleşmeyen anonim bir kimliğe bağlanır; adınız her yerde "Silinmiş Oyuncu" olur.',
      '**Gerekçeyle tutulur:** satın alma kaydı (10 yıl, oyuncu kimliği olmadan), şikâyet kayıtları (90 gün), kod denemeleri (90 gün) ve hesabın silindiği bilgisi (rastgele kimlik ve zaman; silinen hesabın sıralamada ve aramada görünmemesi için, ad ya da iletişim bilgisi yok). Çökme raporları ve geri bildirim notları hesabınıza bağlı olmadığı için hesapla birlikte bulunup silinemez; çökme raporları 30, geri bildirim notları 90 günde kendiliğinden silinir.',
      '**Yedekler:** yedekteki eski kopyalar tek tek silinmez; yedekler 7 günde yenilendiği için silinen hesabın verisi en geç 7 gün içinde yedeklerden de çıkar.',
    ] },
    { t: 'p', x: 'Silinen hesaptaki satın alımlar geri getirilemez. İade için Apple ya da Google\'ın iade yollarını kullanabilirsiniz.' },

    { t: 'h2', x: '8. Güvenlik', id: 'guvenlik' },
    { t: 'ul', x: [
      'Oyun ile sunucu arasındaki bağlantı TLS ile şifrelenir (https ve wss).',
      'Sunucuda gizli anahtarınızın kendisi değil, yalnızca özeti tutulur.',
      'Veritabanı ve yedekler yalnızca oyun sunucusunun erişebildiği bir klasördedir; sunucuya yönetici erişimi sınırlıdır.',
    ] },

    { t: 'h2', x: '9. Değişiklikler', id: 'degisiklik' },
    { t: 'p', x: 'Bu metni değiştirdiğimizde yürürlük tarihini güncelleriz; önemli değişiklikleri oyunda da duyururuz.' },
    { t: 'p', x: 'Oyundaki odyoloji bilgileri öğreticidir; tanı koymaz, tıbbi tavsiye yerine geçmez.' },
  ],
};

// ------------------------------------------------------------------ Privacy policy (EN, for the stores)
export const GIZLILIK_EN: Belge = {
  dil: 'en', yol: '/en/privacy', dosya: 'en/privacy.html',
  baslik: 'Privacy Policy',
  ozet: 'What data ODİ: Sesin Yolu processes, why, and for how long; your rights and how to delete your account.',
  bloklar: [
    { t: 'p', x: '**ODİ: Sesin Yolu** (the game) · effective date: {YURURLUK} · [Türkçe sürüm](/gizlilik)' },
    { t: 'not', x: 'In short: the game **does not ask for your real name, e-mail, phone number, location, contacts, photos or advertising ID.** There are **no ads** and no analytics or ad-tracking tools. We keep the minimum data needed to play. You can delete your account inside the game at any time.' },

    { t: 'h2', x: '1. Who we are', id: 'controller' },
    { t: 'p', x: 'Data controller: **{YAYINCI_UNVAN}** ("{YAYINCI}", "we"). Address: {YAYINCI_ADRES}. Contact: [{ILETISIM_EPOSTA}](mailto:{ILETISIM_EPOSTA}).' },
    { t: 'p', x: 'This notice is given under the Turkish Personal Data Protection Law No. 6698 (KVKK). The Turkish version is the binding text.' },

    { t: 'h2', x: '2. How your account is created', id: 'account' },
    { t: 'ul', x: [
      'There is no sign-up form. When the game first goes online, the server gives you a **random player ID** and a **secret key**. The key is stored only on your device; the server keeps only a one-way hash of it.',
      'You may choose a **nickname** (otherwise "Odi" plus four digits). Please do not use your real name.',
      'If you play offline, nothing is sent to the server; your progress stays on your device.',
    ] },

    { t: 'h2', x: '3. What we process, why, and for how long', id: 'data' },
    { t: 'p', x: 'Legal bases (KVKK art. 5/2): (c) performing our contract with you, i.e. providing the game; (ç) our legal obligations; (f) our legitimate interests (security, preventing abuse, protecting players), provided they do not override your rights. We do not rely on consent and we do not process data for marketing.' },
    { t: 'tablo', bas: ['Data', 'Purpose', 'Legal basis', 'Retention'], satir: [
      ['**On your device:** progress, coins, settings, sound preferences, player key, actions waiting to be sent', 'Running the game', 'Not sent to us', 'Until you delete it (Delete account, or uninstalling)'],
      ['Random player ID, hash of the key, friend code', 'Recognising your account, adding friends', 'art. 5/2-c', 'Until the account is deleted'],
      ['Nickname, colour, hat and costume', 'Showing you in the game and in rankings', 'art. 5/2-c', 'Until the account is deleted'],
      ['Game data: level results, stars, score, XP, wallet (coins, crystals, boosters), camp, quests, events, league and ranking records', 'Your progress, rewards, rankings, anti-cheat', 'art. 5/2-c', 'Until the account is deleted; individual level submission records 30 days'],
      ['Team membership; team name and description if you created one; friendships, requests, blocks', 'Team and friend features, safety', 'art. 5/2-c and f', 'Until the account is deleted'],
      ['Badges and titles (Founding Traveller, Bug Hunter) and when they were given; your frame and "Show my name in the list" choice', 'Showing your contribution to the closed beta and to finding bugs in the game (cosmetic only)', 'art. 5/2-c', 'Until the account is deleted'],
      ['Team and public chat messages', 'Chat', 'art. 5/2-c', '30 days; your own messages immediately when you delete your account'],
      ['Private messages (between friends)', 'Messaging', 'art. 5/2-c', 'Last 500 messages per conversation; the conversation is deleted when either side deletes their account'],
      ['Reports (reporter, reported player, message, reason, time)', 'Moderation, protecting players', 'art. 5/2-f', '90 days, then deleted automatically'],
      ['Reward code attempts (time, player ID, IP address)', 'Preventing code guessing and abuse', 'art. 5/2-f', '90 days, then deleted automatically'],
      ['IP address while connected', 'Establishing the connection, limiting mass account creation from one address', 'art. 5/2-f', 'Not written to disk; kept in server memory only while connected and for at most 2 hours for the account-creation limit'],
      ['Purchase record: product, time, store (App Store / Google Play), amount, store transaction ID', 'Verifying purchases, preventing receipt reuse, monthly spending limit', 'art. 5/2-c and ç (tax and commercial law)', '10 years (from the end of the year of the transaction), then deleted automatically; the player ID is removed from the record when you delete your account'],
      ['Server logs (connection close with player ID, error records)', 'Operating the server, finding bugs', 'art. 5/2-f', '30 days'],
      ['Crash reports (not linked to your account; details below)', 'Finding and fixing errors that crash the game or leave a blank screen', 'art. 5/2-f', '30 days, then deleted automatically'],
      ['Feedback notes (only if you write one; not linked to your account; details below)', 'Learning where players get stuck and what they suggest, and fixing the game', 'art. 5/2-f', '90 days, then deleted automatically'],
      ['Database backups', 'Restoring data after a failure', 'art. 5/2-f', 'Taken every 6 hours; the latest 28 copies (7 days) are kept'],
    ] },
    { t: 'p', x: 'The server also keeps daily totals that are not linked to any person (e.g. how many quick phrases were sent in a day). These are not personal data.' },
    { t: 'p', x: '**Crash reports:** if the game hits an error (a crash or a blank screen), a short report is sent to our own server only: the error name and message (with e-mail addresses, long numbers, the query part of web addresses and key- or ID-like strings removed), where the error happened in the code (file name and line), the app version, the platform (web, iOS, Android) and the major version of the operating system, the name of the screen and the time rounded to the minute. A report **does not contain your player ID, nickname, key, chat text or any device identifier** and cannot be matched to your account. The same error is sent once per session, with at most 5 reports per session. Your IP address is not stored; to limit abuse (10 reports a minute, 100 a day) only a salted hash of it is held in server memory for at most one day. Reports are not sent to any other company and are deleted automatically after 30 days.' },
    { t: 'p', x: '**Founding Traveller badge, Founders list and "Suggested by":** closed-beta testers receive a personal, single-use code; entering it under Kod gir (Enter code) adds a permanent **Kurucu Yolcu** (Founding Traveller) badge to your account (bug finders may also receive the **Hata Avcısı** (Bug Hunter) title). We **do not ask for any personal information** for this; the badge is cosmetic only and gives no power, reward or ranking advantage. Your badge and chosen frame are shown on your profile and in team lists, like your nickname. Your nickname appears on the Profile › **Kurucular** (Founders) screen **only if you turn on "Adım listede görünsün" (Show my name in the list)**; this is off by default and you can turn it off at any time in Settings or on the Founders screen. If you suggested a quiz question or an Ear Card, the game may show "Öneren: nickname" (Suggested by); we do this **only with your explicit permission** (we keep the record of it) and never use your real name. Deleting your account also deletes your badges and your place in the list.' },
    { t: 'p', x: '**Feedback:** if you want, you can send us a short note from Profile › Settings › **Geri bildirim gönder** (Send feedback). Only this goes to our own server: the topic you choose (Bug, Difficulty, Suggestion, Other), the text you write (at most 500 characters, with e-mail addresses, phone numbers and long numbers removed both on your device and on the server), the name of the screen you came from, the app version and the platform (web, iOS, Android). A note **does not contain your player ID, nickname, key or any device identifier** and cannot be matched to your account. Please do not write your name, phone number or e-mail address in it. Your IP address is not stored; to limit abuse (5 notes an hour, 20 a day) only a salted hash of it is held in server memory for at most one day. Notes are not sent to any other company and are deleted automatically after 90 days.' },
    { t: 'p', x: '**What we do not collect:** real name, e-mail, phone number, location, contacts, photos, camera, microphone, advertising ID, card details (please do not write these in a feedback note either; e-mail addresses and phone numbers are removed from notes automatically). The game uses no cookies; the web version only uses the browser\'s local storage and a cache for offline start. Payment details never reach us: Apple or Google takes the payment.' },

    { t: 'h2', x: '4. Who receives data', id: 'recipients' },
    { t: 'p', x: 'We do not sell your data or share it for advertising. We use these service providers only to run the game:' },
    { t: 'ul', x: [
      '**Oracle (Oracle Cloud Infrastructure):** hosts the game server and database. Data centre: {SUNUCU_BOLGESI}.',
      '**RevenueCat, Inc. (USA):** verifies purchases in the store app. RevenueCat receives your random player ID, the product purchased, store transaction details (time, price, currency, country) and technical data sent by its library (operating system, app version). The web version does not use RevenueCat.',
      '**Apple and Google:** distribute the app and take payments under their own privacy policies.',
      'Competent authorities, where the law requires it.',
    ] },
    { t: 'p', x: 'These providers may store data outside Türkiye; such transfers fall under KVKK art. 9. Contact us for information on the basis and safeguards of these transfers.' },

    { t: 'h2', x: '5. Children and chat safety', id: 'children' },
    { t: 'ul', x: [
      'The game is intended for players **aged 13 and over**. If we learn that an account belongs to a child under 13, we delete it.',
      'Free-text chat and private messages stay **locked until 8 levels are cleared**; before that only preset phrases and emoji are available. This cannot be switched off.',
      'Chat and private messages pass a profanity filter; nicknames and team names are filtered too.',
      'Every player can **report** a message or a player and **block** players. A message reported by three different players is hidden; a player reported by three different players within a day cannot send messages for a while. We review reports and can disable an account\'s messaging for a long period.',
      'Messages are not end-to-end encrypted; we can see reported messages to review abuse.',
      'The shop has a monthly spending limit (1000 TRY by default). Lowering it takes effect immediately; raising it takes effect after 24 hours.',
    ] },

    { t: 'h2', x: '6. Your rights', id: 'rights' },
    { t: 'p', x: 'Under KVKK art. 11 you may ask whether we process your data and for information about it; learn the purpose and whether data is used accordingly; know the recipients in Türkiye or abroad; ask for correction, or for deletion under art. 7, and for recipients to be notified; object to an outcome against you that results solely from automated analysis; and claim compensation for damage caused by unlawful processing. If you are in the EU/EEA or the UK, you also have the corresponding GDPR rights.' },
    { t: 'ul', x: [
      '**How to apply:** e-mail [{ILETISIM_EPOSTA}](mailto:{ILETISIM_EPOSTA}). Include your in-game **friend code** (on the Profile page) and nickname so we can find your account. We will never ask for your secret key.',
      'We answer free of charge within **30 days** (KVKK art. 13).',
      'If you are not satisfied with our answer, you may complain to the Turkish Personal Data Protection Board (KVKK art. 14) or to your local data protection authority.',
      'You can change your nickname yourself on the Profile page.',
    ] },

    { t: 'h2', x: '7. Deleting your account', id: 'deletion' },
    { t: 'p', x: '**In the game:** Profile › Settings › **Delete account** (Hesabı sil) › confirm. This needs an internet connection. Your account is deleted on the server immediately and all game data on the device is wiped. If you can no longer open the game, you can request deletion by e-mail: [account deletion page](/hesap-sil#english).' },
    { t: 'p', x: '**Uninstalling the app does not delete your account;** it only loses the key on the device, so nobody can sign in to it again. Use one of the ways above to have it deleted.' },
    { t: 'ul', x: [
      '**Deleted:** progress, wallet, camp, quests, event and tournament records, ranking and league rows, reward inbox, friendships, requests, blocks, private messages, your chat messages and team cards about you, help requests, team applications, badges and titles and your place in the Founders list, settings. If you are the last member of a team, the team and all its records are deleted too.',
      '**Anonymised** (only so other players\' scores stay correct): your contributions to your team\'s totals, last week\'s final ranking position, a gift you sent to your team. These are linked to an anonymous ID that matches no key; your name becomes "Silinmiş Oyuncu" (Deleted Player) everywhere.',
      '**Kept for a stated reason:** purchase records (10 years, without your player ID), reports (90 days), code attempts (90 days), and the fact that an account was deleted (random ID and time, so it stays out of rankings and search; no name or contact data). Crash reports and feedback notes are not linked to your account, so they cannot be found and deleted with it; crash reports are deleted automatically after 30 days, feedback notes after 90 days.',
      '**Backups:** old copies are not edited one by one; backups rotate every 7 days, so deleted data leaves the backups within 7 days.',
    ] },
    { t: 'p', x: 'Purchases in a deleted account cannot be restored. For refunds, use Apple\'s or Google\'s refund process.' },

    { t: 'h2', x: '8. Security', id: 'security' },
    { t: 'ul', x: [
      'Traffic between the game and the server is encrypted with TLS (https and wss).',
      'The server stores only a hash of your secret key, never the key itself.',
      'The database and backups sit in a folder only the game server can access; administrative access to the server is restricted.',
    ] },

    { t: 'h2', x: '9. Changes', id: 'changes' },
    { t: 'p', x: 'When we change this notice we update the effective date; we also announce important changes in the game.' },
    { t: 'p', x: 'The audiology information in the game is educational; it does not diagnose and is not medical advice.' },
  ],
};

// ------------------------------------------------------------------ Hesap silme (Google Play "hesap silme" adresi; TR + kısa EN)
export const HESAP_SIL: Belge = {
  dil: 'tr', yol: '/hesap-sil', dosya: 'hesap-sil.html',
  baslik: 'Hesap silme',
  ozet: 'ODİ: Sesin Yolu hesabınızı oyunun içinden ya da e-postayla nasıl silersiniz; neler silinir, neler kalır.',
  bloklar: [
    { t: 'p', x: '**ODİ: Sesin Yolu** · yayıncı: {YAYINCI} · [Gizlilik politikası](/gizlilik)' },
    { t: 'not', x: 'Hesabınızı **oyunun içinden hemen** silebilirsiniz. Oyunu artık açamıyorsanız silme isteğinizi **e-postayla** gönderin.' },

    { t: 'h2', x: '1. Oyunun içinden (hemen)', id: 'oyun-ici' },
    { t: 'ol', x: [
      'Oyunu açın, alttaki **Profil** sekmesine dokunun.',
      '**Ayarlar**\'ı açın, aşağı kaydırın.',
      '**Hesabı sil** düğmesine dokunun.',
      'Ne silineceğini okuyun ve **Her şeyi sil** ile onaylayın.',
    ] },
    { t: 'p', x: 'İnternet bağlantısı gerekir. Hesabınız sunucuda hemen silinir, cihazdaki bütün oyun verisi temizlenir ve oyun en baştan başlar. Bağlantı yoksa yalnızca cihaz sıfırlanır; bu durumda sunucudaki hesabın silinmesi için aşağıdaki e-posta yolunu kullanın.' },

    { t: 'h2', x: '2. Oyunu açamıyorsanız (e-postayla)', id: 'eposta' },
    { t: 'p', x: '[{ILETISIM_EPOSTA}](mailto:{ILETISIM_EPOSTA}?subject=Hesap%20silme) adresine **"Hesap silme"** konulu bir e-posta gönderin ve şunları yazın:' },
    { t: 'ul', x: [
      '**Arkadaş kodunuz** (oyunda Profil sayfasında "Arkadaş kodun" olarak görünür; Ayarlar › Hesabı sil sayfasında da yazar). Bilmiyorsanız takma adınızı ve varsa takımınızın adını yazın.',
      'Takma adınız ve yaklaşık son oynadığınız tarih.',
    ] },
    { t: 'p', x: 'Şifre ya da gizli anahtar **istemeyiz**; e-postanıza da yazmayın.' },
    { t: 'p', x: '**Nasıl doğrularız:** Hesaplarda e-posta ya da şifre olmadığı için, başkası sizin adınıza silme isteyemesin diye hesabın **son 14 gün içinde oyuna bağlanmamış** olmasını bekleriz. Koşul sağlanınca hesabı sileriz; en geç **30 gün** içinde sonucu e-postayla bildiririz. Hesap bu sürede oyuna bağlanırsa, hesap sizdeyse oyunun içindeki yolu kullanmanızı rica ederiz.' },

    { t: 'h2', x: '3. Neler silinir, neler kalır', id: 'neler' },
    { t: 'ul', x: [
      '**Silinir:** takma adınız, ilerlemeniz, cüzdanınız, kampınız, görevleriniz, takım üyeliğiniz, arkadaşlıklarınız, engellemeleriniz, özel mesajlarınız, sohbette yazdıklarınız, ödül kutunuz, sıralama ve lig kayıtlarınız, rozet ve unvanlarınız, Kurucular listesindeki yeriniz.',
      '**Anonimleşir:** takımınızın toplam puanına yaptığınız katkı gibi başka oyuncuların puanını oluşturan satırlar; adınız "Silinmiş Oyuncu" olur.',
      '**Belirli süre tutulur:** satın alma kayıtları 10 yıl (vergi ve ticaret hukuku; oyuncu kimliği olmadan), şikâyet kayıtları 90 gün, ödül kodu denemeleri 90 gün. Yedeklerdeki kopyalar en geç 7 gün içinde çıkar. Çökme raporları hesaba bağlı değildir; 30 günde kendiliğinden silinir. Geri bildirim notları da hesaba bağlı değildir; 90 günde kendiliğinden silinir.',
    ] },
    { t: 'p', x: 'Uygulamayı kaldırmak hesabı silmez. Silinen hesaptaki satın alımlar geri getirilemez; iade için Apple ya da Google\'ın iade yollarını kullanın. Ayrıntılar: [Gizlilik politikası, Hesabınızı silme](/gizlilik#silme).' },

    { t: 'h2', x: 'English: deleting your account', id: 'english' },
    { t: 'p', x: '**In the game (immediate):** Profile › Settings › **Hesabı sil** (Delete account) › **Her şeyi sil** (Delete everything). Needs an internet connection; the account is deleted on the server at once.' },
    { t: 'p', x: '**If you cannot open the game:** e-mail [{ILETISIM_EPOSTA}](mailto:{ILETISIM_EPOSTA}?subject=Account%20deletion) with the subject "Account deletion", your **friend code** (Profile page) or nickname and team name. We never ask for a password or key. To stop others from deleting your account, we delete it once it has not connected for 14 days and confirm within 30 days.' },
    { t: 'p', x: 'Deleted: nickname, progress, wallet, camp, team membership, friends, blocks, private and chat messages, rankings, badges and your place in the Founders list. Anonymised: rows that make up other players\' team scores. Kept: purchase records for 10 years (without player ID), reports and code attempts for 90 days. Crash reports and feedback notes are not linked to the account and are deleted after 30 and 90 days. Backups clear within 7 days. Uninstalling the app does not delete the account. Details: [Privacy Policy](/en/privacy#deletion).' },
  ],
};

/** herkese açık sayfalar (vite build bunları dist'e yazar; service worker önden önbelleğe alır) */
export const YASAL_SAYFALAR: Belge[] = [GIZLILIK_TR, GIZLILIK_EN, HESAP_SIL];

// ------------------------------------------------------------------ Hakkında ve iletişim (yalnız oyun içi)
export const HAKKINDA: Belge = {
  dil: 'tr', yol: '', dosya: '',
  baslik: 'Hakkında ve iletişim',
  ozet: '',
  bloklar: [
    { t: 'p', x: '**ODİ: Sesin Yolu** · sürüm {SURUM}' },
    { t: 'p', x: 'Yayıncı: **{YAYINCI_UNVAN}**' },
    { t: 'p', x: 'İletişim ve destek: [{ILETISIM_EPOSTA}](mailto:{ILETISIM_EPOSTA})' },
    { t: 'p', x: 'Oyundaki odyoloji bilgileri öğreticidir; tanı koymaz, tıbbi tavsiye yerine geçmez. İşitmenle ilgili bir endişen varsa bir odyoloğa ya da kulak burun boğaz hekimine başvur.' },
    { t: 'p', x: 'Anlatıcı sesi: Chatterbox Multilingual (Resemble AI, MIT) · temel tını Kokoro-82M (Apache-2.0) · sentetik ses. Oyun motoru: Phaser (MIT).' },
  ],
};
