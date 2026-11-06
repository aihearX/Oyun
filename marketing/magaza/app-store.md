# App Store: liste, gizlilik etiketi, yaş derecelendirmesi, inceleme notları

Liste metinleri (ad ≤ 30, alt başlık ≤ 30, tanıtım metni ≤ 170, anahtar sözcükler ≤ 100, açıklama ≤ 4000; TR ve EN)
[`metinler.json`](metinler.json) içinde (`apple`). Açıklama Google uzun açıklamasıyla aynıdır (`@google…` referansı). Denetim:
`node tools/magaza/denetle.mjs`. Ürünler: [`iap-urunler.md`](iap-urunler.md). Adımlar: [`YAYIN-LISTESI.md`](YAYIN-LISTESI.md).

## Uygulama bilgileri

| Alan | Değer |
|---|---|
| Ad | ODİ: Sesin Yolu |
| Sürüm | **1.0.0** (ilk sürüm; `apps/mobile/app.json` › `version`, derleme numarasını EAS verir: `appVersionSource: remote`). "Bu sürümdeki yenilikler" alanı ilk sürümde App Store Connect'te görünmez |
| Bundle ID | `com.aiheartech.odi` |
| SKU | `odi-ios` (öneri; herkese görünmez) |
| Birincil dil | Türkçe; ek yerelleştirme İngilizce (ABD). Uygulamanın arayüzü yalnız Türkçe (EN tanıtım metni ve açıklama bunu söyler) |
| Kategori | Oyunlar › Macera; ikincil: Oyunlar › Aksiyon (Eğitim seçilmez) |
| Destek URL'si | `https://<adres>/gizlilik#sorumlu` (iletişim e-postası orada; şirketin bir destek sayfası varsa o yazılır) |
| Pazarlama URL'si | boş |
| Gizlilik politikası URL'si | TR: `https://<adres>/gizlilik` · EN: `https://<adres>/en/privacy` |
| Telif hakkı | `2026 {YAYINCI_UNVAN}` |
| Fiyat | Ücretsiz; uygulama içi satın alma var |
| Şifreleme | `ITSAppUsesNonExemptEncryption: false` (app.json; yalnız standart TLS) |
| Ekran görüntüleri | `node tools/harness/vitrin.mjs --out <klasör>` (iOS 6,9" 1320×2868 ve 6,5" 1284×2778; en çok 10 kare). iPad yok (`supportsTablet: false`). Seçim ve sıra: [`docs/yonetim/magaza-ekran.md`](../../docs/yonetim/magaza-ekran.md) |

## Uygulama gizliliği ("besin etiketi")

**Veri toplama:** Evet, veri topluyoruz. **İzleme (tracking): Hayır** — hiçbir veri başka şirketlerin uygulama/sitelerinden gelen
veriyle birleştirilmez, veri aracısına verilmez; ATT izni istenmez. **Reklam: yok.**

Çökme verisi dışındaki bütün türler **kullanıcıya bağlıdır** (rastgele oyuncu kimliğiyle; ad/e-posta olmasa da Apple tanımında
"linked"); çökme verisi **kullanıcıya bağlı değildir** (oyuncu kimliği, takma ad, cihaz kimliği taşımaz; hesapla eşleştirilemez).
Beta geri bildirimi notu da kendi başına kullanıcıya bağlı değildir (oyuncu kimliği yok); ama Apple bağlılığı **tür başına tek cevapla**
sorar ve aynı tür (Diğer Kullanıcı İçeriği: takma ad, takım adı) bağlı olduğu için tür "bağlı" beyan edilir (daha kapsayıcı cevap).
Hiçbiri **izleme için kullanılmaz**. Apple, bizim adımıza veri işleyen SDK'ların (RevenueCat) topladığını da bizim beyanımız sayar.

| Apple türü | Toplanır | Kullanıcıya bağlı | İzleme | Amaç | Ne |
|---|---|---|---|---|---|
| Tanımlayıcılar › Kullanıcı Kimliği | Evet | Evet | Hayır | Uygulama İşlevi | Rastgele oyuncu kimliği, arkadaş kodu; RevenueCat `appUserID` |
| Satın Almalar › Satın Alma Geçmişi | Evet | Evet | Hayır | Uygulama İşlevi, Analiz | Ürün, zaman, tutar, işlem no (sunucu + RevenueCat; RevenueCat panosunda satış raporları) |
| Kullanıcı İçeriği › E-postalar veya Metin Mesajları | Evet | Evet | Hayır | Uygulama İşlevi | Arkadaşlar arası özel mesajlar, takım ve genel sohbet |
| Kullanıcı İçeriği › Oyun İçeriği | Evet | Evet | Hayır | Uygulama İşlevi | İlerleme, bölüm sonuçları, cüzdan (bekleyen jeton dahil), kamp ve Klinik vakaları, etkinlik kayıtları (Günün Meydan Okuması, Haftalık Turnuva, Günün Sorusu cevabı, canlı Bilgi Yarışması'na katılırken seçili bilgi düzeyi: Genel / Odyoloji öğrencisi), takım yarışı ve lig kayıtları, rozet ve unvanlar (Kurucu Yolcu, Hata Avcısı) |
| Kullanıcı İçeriği › Diğer Kullanıcı İçeriği | Evet | Evet | Hayır | Uygulama İşlevi | Takma ad, takım adı ve açıklaması, başvuru notu, "Adım listede görünsün" seçimi (Kurucular listesi; baştan kapalı); beta geri bildirimi notu (Ayarlar › Geri bildirim gönder: konu, temizlenmiş metin ≤ 500 karakter, geldiği ekranın adı, sürüm, platform; kendi sunucumuzda 90 gün; oyuncu kimliği yok, hesapla eşleştirilemez) |
| Diğer Veriler › Diğer Veri Türleri | Evet | Evet | Hayır | Uygulama İşlevi (güvenlik, kötüye kullanımın önlenmesi) | IP adresi: ödül kodu denemesi kaydında 90 gün; bağlantıda yalnız bellekte (çökme raporu hız sınırı: tuzlu özeti bellekte en çok 1 gün) |
| Teşhis › Çökme Verileri | Evet | Hayır | Hayır | Uygulama İşlevi (çökmeleri azaltmak) | Çökme raporu (YN-011): hata adı ve temizlenmiş iletisi, yığın satırları (dosya:satır), uygulama sürümü ve derleme, platform ve işletim sistemi ana sürümü, ekran adı, dakikaya yuvarlanmış zaman; kendi sunucumuzda 30 gün. Oyuncu kimliği, takma ad, anahtar, sohbet metni, cihaz kimliği yok; IP yalnız hız sınırı için bellekte |
| İletişim Bilgileri, Sağlık ve Fitness, Finansal Bilgi (ödeme), Konum, Hassas Bilgiler, Kişiler, Tarama/Arama Geçmişi, Kullanım Verileri, Teşhis › Performans Verileri ve Diğer Teşhis Verileri | **Hayır** | — | — | — | İstenmez, toplanmaz; dış çökme/analiz aracı yok |

Notlar:
- **Yeniden denetim (2026-11-06, sürüm 1.0.0):** ekim sonundan beri sunucuya eklenen göçler (`apps/server/src/migrations.ts`:
  rozetler, lig bölüm tekrarı, harcama sınırı seçimi, Sezon Kartı birikimi, satın alma hediye jetonu, savaş bölge/takım payı, adsız
  takım hediyesi, lider devri kartı, bilgi yarışması katılan düzeyi `ev_quiz_player.level`, bekleyen ödül jetonu `players.carry_jeton`)
  ve yeni tablolar (Günün Sorusu cevapları, İkili Görev, Usta–Çırak, Klinik, kamp oyunları) yeni bir Apple veri **türü** getirmiyor:
  hepsi Oyun İçeriği ya da Diğer Kullanıcı İçeriği altında, kullanıcıya bağlı, izleme yok. Yeni bir izin, SDK, bildirim (push) ya da
  cihaz kimliği yok. `app.json` › `ios.privacyManifests` bu yüzden değişmedi.
- "Kullanım Verileri › Ürün Etkileşimi" seçilmez: dokunma/ekran izlenmez; sunucudaki `/olcum` yalnız kişiye bağlı olmayan günlük toplamlar.
  Çökme raporundaki ekran adı yalnız hatanın olduğu ekrandır; geri bildirimdeki ekran adı yalnız oyuncunun notu yazmadan önceki
  ekranıdır (ikisi de etkileşim kaydı değil).
- **Beta geri bildirimi:** oyuncu isterse yazar (Ayarlar › Geri bildirim gönder); dış servis yok, not kendi sunucumuza
  (`POST /geri-bildirim`) gider, IP başına saatte 5 / günde 20 ile sınırlı, 90 günde silinir. Ad, telefon, e-posta istenmez
  ("Adını, telefonunu ya da e-postanı yazma." uyarısı); e-posta, telefon ve uzun rakam dizileri cihazda ve sunucuda çıkarılır.
  Apple türü: Kullanıcı İçeriği › Diğer Kullanıcı İçeriği, amaç Uygulama İşlevi (destek). Not kendi başına kullanıcıya bağlı değil;
  tür takma ad yüzünden zaten "bağlı" beyanlı. Kod: `packages/shared/src/geribildirim.ts`, `apps/server/src/geribildirim.ts`.
- **Çökme verisi (YN-011):** dış servis yok; rapor kendi sunucumuza (`POST /hata`) gider, IP başına dakikada 10 / günde 100 ile
  sınırlı, 30 günde silinir. Kod: `packages/shared/src/hata.ts` (temizleyici, alanlar), `apps/server/src/hata.ts` (katı şema: fazla
  alan reddedilir). Uygulama sürümü ve işletim sistemi sürümü bu raporun parçasıdır; ayrıca "Diğer Teşhis Verileri" toplanmaz.
- RevenueCat'in güncel "App Privacy" rehberine yüklemeden önce bakın; RevenueCat yeni bir tür ekliyorsa (ör. cihaz kimliği) bu tablo,
  gizlilik metni ve `apps/mobile/app.json` › `ios.privacyManifests` birlikte güncellenir.
- **Gizlilik bildirimi (PrivacyInfo.xcprivacy):** `app.json` › `ios.privacyManifests` bu tablonun birebir karşılığıdır
  (`NSPrivacyCollectedDataTypes`: UserID, PurchaseHistory, EmailsOrTextMessages, GameplayContent, OtherUserContent, OtherDataTypes
  linked; CrashData linked değil; hepsinde tracking yok; `NSPrivacyTracking: false`). Mobil jest testi `__tests__/yapilandirma.test.ts`
  tabloyu (tür, amaç, bağlılık, izleme) okuyup karşılaştırır: biri değişip öteki değişmezse test düşer. Gerekçe isteyen API'ler (`NSPrivacyAccessedAPITypes`): UserDefaults `CA92.1`; dosya zamanı
  `C617.1`, `0A2A.1`, `3B52.1`; açılıştan beri geçen süre `35F9.1`; disk alanı `E174.1`, `85F4.1` (React Native, AsyncStorage,
  expo-constants, expo-file-system ve RevenueCat'in kendi bildirimlerindeki gerekçelerin birleşimi; statik bağlanan CocoaPods
  bildirimleri her zaman birleştirilmediği için uygulama düzeyinde de yazılı).

## Yaş derecelendirmesi

Apple'ın 2025 sonrası ankette (4+, 9+, 13+, 16+, 18+) cevaplar:

| Soru | Cevap | Gerekçe |
|---|---|---|
| Çizgi film veya fantastik şiddet | **Seyrek / hafif** | Düşmanın üstüne zıplama, boss can çubuğu; kan ve silah yok |
| Gerçekçi şiddet, uzun süreli/grafik şiddet | Yok | — |
| Küfür veya kaba mizah | Yok | Oyun metinlerinde yok (oyuncu sohbeti ayrıca "mesajlaşma" yeteneğinde) |
| Olgun/müstehcen temalar, cinsellik, çıplaklık | Yok | — |
| Korku/dehşet temaları | Yok | Çizgi film üslubu (sahip boss görselleriyle teyit etsin) |
| Tıbbi veya tedaviye yönelik bilgi | **Seyrek / hafif** | Öğretici odyoloji bilgisi, kurgusal hasta vakaları; "tanı koymaz" uyarısı |
| Sağlık veya esenlik konuları | **Evet** | İşitme sağlığı bilgisi (öğretici) |
| Alkol, tütün, uyuşturucu | Yok | — |
| Kumar benzetimi | Yok | — |
| Yarışmalar (gerçek ödüllü) | Yok | Günün Meydan Okuması, Haftalık Turnuva, Bilgi Yarışması ve ligin ödülleri yalnız oyun içi jeton/kristal/rozet; gerçek ödül, para ya da çekiliş yok |
| Sınırsız web erişimi | Hayır | — |
| Kullanıcı tarafından oluşturulan içerik | **Evet** | Takma ad, takım adı, sohbet |
| Mesajlaşma ve sohbet | **Evet** | Takım/genel sohbet, arkadaşlar arası özel mesaj |
| Reklam | Hayır | — |
| Uygulama içi kontroller (ebeveyn denetimi / yaş doğrulama) | Hayır | Aylık harcama sınırı var ama ebeveyn denetimi değil |

Hesaplanan sınıf 13+'tan düşük çıkarsa **"Yaş derecelendirmesini geçersiz kıl" ile 13+** seçin: gizlilik metni ve hedef kitle 13+.
Kids kategorisi seçilmez.

## Uygulama İnceleme bilgileri (Review notes)

App Store Connect › sürüm sayfası › **App Review Information**:
- **Sign-in required:** kapalı (oturum açma yok). Kullanıcı adı/şifre alanları boş.
- **İletişim:** ad, soyad ve telefon `{INCELEME_ILETISIM}` (sahibin vereceği, inceleme ekibinin aradığı kişi; depoya yazılmaz),
  e-posta `{ILETISIM_EPOSTA}`.
- **Notes:** aşağıdaki İngilizce metin (Apple ekibi İngilizce okur). Türkçesi sahibin kendi denetimi içindir, yapıştırılmaz.
- **Ek (isteğe bağlı):** mağaza ve satın alma penceresinin ekran görüntüleri `magaza-ekranlar/iap-inceleme/` (vitrin aracı) ya da
  TestFlight'ta sandbox satın alma ekran kaydı.

Yapıştırılacak metin (EN, ~3.400 karakter; App Store Connect notes alanı 4.000 karakter):

> **No account or login is needed.** On first launch the game creates an anonymous account (random ID stored on the device; an
> optional nickname). No name, e-mail, phone, location or contacts are asked for. The game UI is in Turkish.
>
> **Quick tour:** tap "Yola çık" (Start) → the short story → "Atla" (Skip) → choose a nickname or tap "Sonra" (Later) → level 1.
> Levels take about one minute. The first levels teach the controls; features unlock as levels are cleared: Camp after 3 levels,
> Friends and private messages after 4, Team after 5, **Shop after 6** (tab "Profil" › "Mağaza"), events after 7, live races and
> free-text chat after 8. Levels work offline; teams, chat, live races, events and purchases use our game server, which stays online
> during review.
>
> **In-app purchases** (7 products): five consumables (crystal packs, two camp booster packs), the **Starter Pack (non-consumable,
> once per game account)** and the **Odi Season Card (non-renewing subscription**: 30 crystals for each of 28 days plus a costume;
> it does not auto-renew). Contents are fixed and listed before purchase; there are no loot boxes or random paid items. Purchases
> belong to the game account and are kept on our server; **"Satın alımları geri yükle" (Restore Purchases)** at the bottom of the
> shop restores them, and also delivers any paid purchase that could not reach our server. Crystal and booster packs are consumed
> and are not restored.
> Crystals only speed up camp construction; levels, team points and
> league points cannot be bought. Purchases go through StoreKit via RevenueCat and are verified on our server. **Before the first
> purchase the player must choose a monthly spending limit** (100 TRY suggested, 50/250/500 TRY, or "purchases off"). To test: clear
> 6 levels → Profil › Mağaza → tap a price → choose a limit → "Sınırı kaydet" → tap "Mağazada satın al" → the App Store sheet opens
> (sandbox). Lowering the limit applies at once; raising needs a second confirmation and applies after 24 hours ("Sınırı ayarla").
>
> **User-generated content (Guideline 1.2):** until the player has cleared 8 levels, chat and private messages allow only preset
> phrases and reactions. After that, free text, nicknames and team names pass a profanity filter. Players can report a message
> (long-press › "Şikâyet et"), report or block a player (player card › "Şikâyet et" / "Engelle"). A message reported by three players
> is hidden automatically and its sender is muted; a player reported by three players within a day is muted. We review reports daily
> and can mute an account for longer. Contact: {ILETISIM_EPOSTA}.
>
> **Account deletion (5.1.1(v)):** Profil › Ayarlar › "Hesabı sil" › "Her şeyi sil". The account is deleted on the server
> immediately and all local data is wiped. Web instructions: https://<adres>/hesap-sil
>
> **Medical content:** the game teaches how hearing works (hearing science notes, fictional patient cases, a tone game). It is
> educational only: it does not diagnose, it is not a hearing test and it is not medical advice; the game and the privacy policy say
> so. It collects no health data.
>
> **Privacy:** no ads, no tracking, no third-party analytics or crash-reporting SDK. Crash reports (error name, scrubbed message,
> stack lines, app/OS version, screen name) go only to our own server, are not linked to the player and are deleted after 30 days.

Türkçesi (sahip için):

> **Hesap ya da giriş gerekmez.** İlk açılışta oyun anonim bir hesap açar (cihazda rastgele kimlik; isteğe bağlı takma ad). Ad,
> e-posta, telefon, konum, rehber istenmez. Oyunun arayüzü Türkçedir.
>
> **Kısa yol:** "Yola çık" → kısa hikâye → "Atla" → takma ad seç ya da "Sonra" → 1. bölüm. Bölümler yaklaşık bir dakika. Özellikler
> geçilen bölümle açılır: Kamp 3, Arkadaşlar ve özel mesaj 4, Takım 5, **Mağaza 6** (Profil › Mağaza), etkinlikler 7, canlı yarış ve
> serbest yazı 8. Bölümler internetsiz oynanır; takım, sohbet, canlı yarış, etkinlikler ve satın alma oyun sunucumuzu kullanır,
> sunucu inceleme boyunca açık kalır.
>
> **Uygulama içi satın alma** (7 ürün): beş tüketilebilir (kristal paketleri, iki hızlandırıcı paketi), **Başlangıç Paketi
> (tüketilmeyen, oyun hesabı başına bir kez)** ve **Odi Sezon Kartı (otomatik yenilenmeyen abonelik**: 28 günün her birine 30 kristal
> + kostüm; kendiliğinden yenilenmez). İçerik sabit ve satın almadan önce yazılı; ganimet kutusu yok. Satın almalar oyun hesabına
> bağlı ve sunucumuzda tutulur; mağazanın altındaki **"Satın alımları geri yükle"** bunları geri yükler, sunucumuza ulaşamamış ödenmiş
> satın almayı da işler. Kristal ve hızlandırıcı paketleri harcanır, geri yüklenmez.
> Kristal yalnız kamp inşaatını hızlandırır; bölüm, takım ya da lig puanı satılmaz. Satın alma
> RevenueCat üzerinden StoreKit ile yapılır, sunucumuzda doğrulanır. **İlk satın almadan önce oyuncu aylık harcama sınırı seçer**
> (önerilen 100 TL; 50/250/500 TL ya da "satın alma kapalı"). Deneme: 6 bölüm geç → Profil › Mağaza → bir fiyata dokun → sınırı seç →
> "Sınırı kaydet" → "Mağazada satın al" → App Store penceresi (sandbox). Düşürmek hemen; yükseltmek ikinci onayla ve 24 saat sonra.
>
> **Kullanıcı içeriği (1.2):** 8 bölüm geçilene kadar sohbette ve özel mesajda yalnız hazır sözler ve tepkiler. Sonra serbest yazı,
> takma ad ve takım adı küfür süzgecinden geçer. İleti uzun basılıp "Şikâyet et"; oyuncu kartından "Şikâyet et" / "Engelle". Üç
> oyuncunun şikâyet ettiği ileti kendiliğinden gizlenir ve göndereni susturulur; bir günde üç oyuncunun şikâyet ettiği oyuncu
> susturulur. Şikâyetler her gün incelenir.
>
> **Hesap silme:** Profil › Ayarlar › "Hesabı sil" › "Her şeyi sil"; web: https://<adres>/hesap-sil
>
> **Tıbbi içerik:** öğreticidir; tanı koymaz, işitme testi değildir, tıbbi tavsiye yerine geçmez. Sağlık verisi toplanmaz.
>
> **Gizlilik:** reklam, izleme, üçüncü taraf analiz ya da çökme SDK'sı yok. Çökme raporu yalnız kendi sunucumuza, oyuncuya bağlı
> değil, 30 günde silinir.

Notlar:
- Açılış eşikleri `apps/web/src/ftue/features.ts` (Kamp 3, Arkadaşlar 4, Takım 5, Mağaza 6, Etkinlikler 7, Canlı yarış ve serbest
  yazı 8); serbest yazı eşiği `COMM_RULES.freeTextLevel` (8); şikâyet eşikleri `apps/server/src/chat.ts` `REPORTS_TO_HIDE` (3) ve
  `FRIEND_LIMITS.reportsToMute` (3). Kod değişirse bu notlar da değişir.
- İlk sınır seçenekleri `SPEND_LIMIT_FIRST_CHOICES` (0, 50, 100, 250, 500 TL). Sandbox denemesinde 500 TL seçilirse 7 ürünün hepsi
  sınırın altında kalır (en pahalısı 299,99 TL).
- Uygulama içi ürünlerin her birine ayrıca kısa inceleme notu ve ekran görüntüsü girilir: [`iap-urunler.md`](iap-urunler.md).
- İnceleme sırasında sunucu kapalı ya da güncelleniyorsa inceleyici takım/sohbet/mağazada "Sunucuya bağlı değilsin" görür ve
  2.1 (eksik uygulama) reddi gelebilir: inceleme süresince `odi-guncelle` çalıştırılmaz.

## Diğer beyanlar
- **Dışa aktarım uyumluluğu:** şifreleme yalnız standart TLS → muaf (`ITSAppUsesNonExemptEncryption: false`).
- **İçerik hakları:** üçüncü taraf içerik yok; anlatıcı sesi açık lisanslı modellerle üretildi (Ayarlar'da künye).
- **Reklam tanımlayıcısı (IDFA):** kullanılmaz.
- **Sign in with Apple (4.8):** gerekmez (üçüncü taraf giriş yok).
