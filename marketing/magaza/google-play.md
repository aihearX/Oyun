# Google Play: liste ve beyanlar

Liste metinleri (başlık, kısa ve uzun açıklama; TR ve EN) [`metinler.json`](metinler.json) içinde, yapıştırmaya hazır.
Sınırlar `node tools/magaza/denetle.mjs` ile denetlenir (başlık ≤ 30, kısa ≤ 80, uzun ≤ 4000). `<adres>` ve `{ILETISIM_EPOSTA}`
yüklemede doldurulur. Ürünler: [`iap-urunler.md`](iap-urunler.md). Adımlar: [`YAYIN-LISTESI.md`](YAYIN-LISTESI.md).

Bütün cevaplar kodun bugün yaptığına göre verildi; dayanaklar [`docs/yonetim/gizlilik.md`](../../docs/yonetim/gizlilik.md) "Kod karşılığı".
Play Console'daki soru metinleri zamanla değişir: yüklerken soruyu buradaki cevabın anlamıyla eşleştirin, emin olunmayan yerde
daha kapsayıcı (daha çok beyan eden) seçeneği seçin.

## Kimlik

| Alan | Değer |
|---|---|
| Uygulama adı | ODİ: Sesin Yolu |
| Paket adı | `com.aiheartech.odi` |
| Varsayılan dil | Türkçe (tr-TR); ek liste: İngilizce (en-US). Oyunun kendisi yalnız Türkçe; EN açıklama bunu söyler |
| Uygulama mı oyun mu | Oyun |
| Kategori | Macera (Adventure). Alternatif: Aksiyon. "Eğitim" seçilmez (Aileler programına yönlendirme riski) |
| Etiketler (en çok 5, Console listesinden) | Platform oyunu, Koşu, Gündelik, Çok oyunculu (çevrimiçi), Macera. Listede yoksa en yakını |
| Ücretsiz / ücretli | Ücretsiz, uygulama içi satın alma var |
| İletişim e-postası | `{ILETISIM_EPOSTA}` (zorunlu, herkese açık görünür) |
| Web sitesi | `https://<adres>/` (isteğe bağlı) |
| Telefon | boş (isteğe bağlı) |
| Gizlilik politikası | `https://<adres>/gizlilik` (TR); EN listede de aynı alan tek; EN sayfa `https://<adres>/en/privacy` ve TR sayfanın başında bağlantı var |
| Reklam içerir | **Hayır** (reklam SDK'sı yok) |
| Uygulama içi satın alma | **Evet** |
| Hedef ülkeler (öneri) | İlk yayında yalnız Türkiye (GDPR temsilci sorusu ve EN destek yükü ertelenir; sahip kararı) |

## Uygulama içeriği (App content)

### Gizlilik politikası
`https://<adres>/gizlilik`

### Reklamlar
Uygulamanız reklam içeriyor mu? **Hayır.**
Reklam kimliği (Advertising ID) kullanıyor mu? **Hayır.** `com.google.android.gms.permission.AD_ID` izni `app.json` ›
`android.blockedPermissions` ile engelli (bildirimde de yok).

### Uygulama erişimi (App access)
"Bütün işlevler özel erişim gerektirmeden kullanılabilir." Kayıt ya da giriş yok; hesap ilk açılışta kendiliğinden oluşur.
Not alanı (inceleme ekibine, EN):
> No login. The game creates an anonymous account on first launch (random ID; optional nickname). Tap "Yola çık", skip the story
> ("Atla"), choose a nickname or "Sonra". Friends and chat open after 4 cleared levels, the shop after 6, free-text chat after 8
> (before that only preset phrases). Account deletion: Profil › Ayarlar › Hesabı sil.

### İçerik derecelendirmesi (IARC anketi)
Kategori: **Oyun**. E-posta: `{ILETISIM_EPOSTA}`.

| Soru (özet) | Cevap | Gerekçe |
|---|---|---|
| Şiddet | **Evet, çizgi film / fantastik, hafif** | Odi küçük düşmanların üstüne zıplayınca düşman parıltıyla kaybolur ("+50 ezme"); boss bölümlerinde (Serumen Golemi, Gürültü Canavarı) can çubuğu azalır. Kan, silah, insan figürü, gerçekçi şiddet yok |
| Korku | Hayır | Sevimli çizim; ani korkutma (jump scare) yok. Boss "canavar" adlı ama çizgi film üslubunda (sahip görselle teyit etsin) |
| Cinsellik, çıplaklık | Hayır | — |
| Küfür / kaba dil (oyunun kendi içeriği) | Hayır | Oyun metinlerinde yok; oyuncu sohbeti ayrıca "kullanıcı etkileşimi" sorusunda |
| Uyuşturucu, alkol, tütün | Hayır | — |
| Kumar / kumar benzetimi | **Hayır** | Bahis, kart, slot yok |
| Gerçek parayla rastgele öğe (ganimet kutusu) | **Hayır** | Mağazadaki her ürünün içeriği sabit (`packages/shared/src/social.ts` SHOP). Ücretsiz tek şans öğesi: %10 ihtimalli "Şanslı Nota" (25 jeton + 10 XP; satın alınamaz, ihtimal oyunda yazılı) |
| Kullanıcılar etkileşir / içerik paylaşır | **Evet** | Takım ve genel sohbet, arkadaşlar arası özel mesaj, takma ad ve takım adı. Güvenli sohbet: 8 bölüme kadar yalnız hazır sözler; küfür süzgeci, şikâyet, engelleme |
| Konum paylaşımı | Hayır | Konum hiç alınmaz |
| Dijital ürün satın alma | **Evet** | Kristal, hızlandırıcı, Sezon Kartı |
| Kişisel bilgi paylaşımı (üçüncü taraf) | Hayır | Yalnız hizmet sağlayıcılar (barındırma, RevenueCat) |
| Sınırsız internet / tarayıcı | Hayır | Uygulama içinde serbest web gezinmesi yok |

Beklenen sonuç (kesin değil): PEGI 7 (hafif fantastik şiddet) ya da PEGI 3, ek bilgiler "Uygulama İçi Satın Alma",
"Kullanıcılar Etkileşimde"; ESRB E (Fantasy Violence) / E10+; USK 6. Derecelendirme ile hedef kitle (13+) ayrı şeylerdir.

### Hedef kitle ve içerik
- Hedef yaş grupları: **13–15, 16–17, 18 ve üzeri.** 13 yaş altı seçilmez; **Aileler (Families) programına katılınmaz.**
- "Uygulama çocukların ilgisini istemeden çekebilir mi?" Dürüst cevap: **çizgi film üslubu ve masalsı anlatıcı nedeniyle çekebilir.**
  Google bu durumda uygulamayı inceler ve 13 yaş altını hedeflemediğinin gösterilmesini isteyebilir. Hazırlık:
  - liste metni ve ekran görüntüleri çocuğa yönelik dil kullanmaz ("13 yaş ve üzeri içindir" uzun açıklamada yazar);
  - reklam yok, kişisel veri istenmez, sohbet 8 bölüme kadar hazır sözlerle sınırlı;
  - uygulamada yaş sorusu yok: Google isterse nötr bir yaş ekranı gerekir (is-listesi YN-034, sahip kararı).
- Mağaza listesinde "çocuklar için" ifadesi kullanılmaz.

### Haber uygulaması
Hayır.

### COVID-19, sağlık
Sağlık uygulaması değildir. (Odyoloji bilgisi öğretici; "tanı koymaz, tıbbi tavsiye yerine geçmez" uyarısı açıklamada ve oyunda.)

### Devlet uygulaması, finans
Hayır.

### Veri güvenliği (Data safety) formu

**Genel sorular**

| Soru | Cevap |
|---|---|
| Uygulamanız gerekli kullanıcı veri türlerinden herhangi birini topluyor ya da paylaşıyor mu? | **Evet** |
| Toplanan bütün kullanıcı verileri aktarım sırasında şifreleniyor mu? | **Evet** (https/wss; mağaza derlemesinde sunucu adresi `wss://`, bkz. `apps/mobile/README.md`) |
| Uygulamanız hesap oluşturmaya izin veriyor mu? | **Evet → "Diğer"**: kendiliğinden anonim hesap (rastgele kimlik + cihazdaki anahtar), isteğe bağlı takma ad; kullanıcı adı/şifre, e-posta ya da OAuth yok |
| Hesap silme bağlantısı (web) | `https://<adres>/hesap-sil` |
| Kullanıcılar hesaplarını silmeden verilerinin bir kısmının silinmesini isteyebilir mi? | **Hayır** (oyunda yalnız tam silme var; takma ad oyunda değiştirilebilir, sohbet 30 günde kendiliğinden silinir) |
| Bağımsız güvenlik incelemesi | Hayır |
| Aileler politikasına uygunluk taahhüdü | Uygulanmaz (Aileler programında değil) |

**Veri türleri** ("Paylaşılır" hepsinde **Hayır**: Oracle barındırma ve RevenueCat, bizim adımıza işleyen hizmet sağlayıcılardır;
Google'ın tanımında bu aktarım "paylaşım" sayılmaz. Hiçbiri "geçici işleme" (ephemeral) değildir, sunucuda saklanır.)

| Kategori › tür | Toplanır | Zorunlu mu | Amaçlar | Dayanak (kod) |
|---|---|---|---|---|
| Kişisel bilgiler › Ad | Evet | İsteğe bağlı (varsayılan "OdiNNNN") | Uygulama işlevi, Hesap yönetimi | Takma ad (`profile.update`); Google "ad" tanımına takma ad da girer |
| Kişisel bilgiler › Kullanıcı kimlikleri | Evet | Zorunlu | Uygulama işlevi, Hesap yönetimi, Dolandırıcılığı önleme / güvenlik | Rastgele oyuncu kimliği, arkadaş kodu; RevenueCat `appUserID` |
| Kişisel bilgiler › Diğer bilgiler | Evet | Zorunlu | Dolandırıcılığı önleme / güvenlik | IP adresi: bağlantıda bellekte (hesap açma sınırı, en çok ~2 saat), ödül kodu denemesinde 90 gün |
| Finansal bilgiler › Satın alma geçmişi | Evet | İsteğe bağlı | Uygulama işlevi, Dolandırıcılığı önleme / güvenlik | `purchases` tablosu (ürün, zaman, mağaza, tutar, işlem no); RevenueCat |
| Mesajlar › Diğer uygulama içi mesajlar | Evet | İsteğe bağlı | Uygulama işlevi | Takım/genel sohbet (30 gün), özel mesajlar (son 500) |
| Uygulama etkinliği › Kullanıcının oluşturduğu diğer içerik | Evet | İsteğe bağlı | Uygulama işlevi | Takım adı ve açıklaması, takım başvuru notu |
| Uygulama etkinliği › Diğer işlemler | Evet | Zorunlu | Uygulama işlevi | Oyun ilerlemesi: bölüm sonuçları, yıldız, XP, kamp, görevler, etkinlik, lig |
| Uygulama etkinliği › Uygulama etkileşimleri | Hayır | — | — | Dokunma/ekran izlenmez; `/olcum` yalnız kişiye bağlı olmayan günlük toplamlar |
| Uygulama bilgileri ve performansı (çökme günlükleri, teşhis) | Hayır | — | — | Çökme raporu aracı yok (YN-011); sunucu hata günlükleri cihazdan teşhis verisi değildir |
| Cihaz veya diğer kimlikler | Hayır | — | — | Reklam kimliği yok; RevenueCat `collectDeviceIdentifiers` çağrılmaz. **Yüklemeden önce RevenueCat'in güncel "Google Play Data Safety" rehberiyle karşılaştırın** |
| Konum, Kişiler, Takvim, Fotoğraf/video, Ses, Dosyalar, Sağlık, Web geçmişi, E-posta, Telefon, Ödeme bilgisi | Hayır | — | — | İzin isteyen modül yok; ödemeyi Google alır |

### Hesap silme (Account deletion)
- Uygulama içi yol: Profil › Ayarlar › **Hesabı sil** › **Her şeyi sil**.
- Web bağlantısı (zorunlu): `https://<adres>/hesap-sil`. Sayfa uygulama adını ve yayıncıyı ({YAYINCI}) gösterir, uygulama içi adımları ve
  uygulama dışı e-posta yolunu (arkadaş kodu ile; şifre istenmez) anlatır, silinen / tutulan veriyi ve süreleri yazar.
- Tutulan veri: satın alma kaydı 10 yıl (oyuncu kimliği olmadan), şikâyet ve kod denemesi 90 gün, yedekler en geç 7 gün.

### Finansal özellikler, sağlık uygulamaları, VPN, tam ekran bildirim, ön plan hizmeti, konum izni
Yok / uygulanmaz.

## Mağaza ayarları
- Uygulama içi ürünler: [`iap-urunler.md`](iap-urunler.md) (tek seferlik ürünler, hepsi tüketilebilir).
- Fiyatlandırma: uygulama ücretsiz. Ürün fiyatları TRY olarak girilir; diğer ülkeler Console'un dönüştürmesiyle (yalnız Türkiye
  seçilirse gerekmez).
- Ön kayıt: kullanılmaz.
