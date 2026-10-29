# App Store: liste, gizlilik etiketi, yaş derecelendirmesi, inceleme notları

Liste metinleri (ad ≤ 30, alt başlık ≤ 30, tanıtım metni ≤ 170, anahtar sözcükler ≤ 100, açıklama ≤ 4000; TR ve EN)
[`metinler.json`](metinler.json) içinde (`apple`). Açıklama Google uzun açıklamasıyla aynıdır (`@google…` referansı). Denetim:
`node tools/magaza/denetle.mjs`. Ürünler: [`iap-urunler.md`](iap-urunler.md). Adımlar: [`YAYIN-LISTESI.md`](YAYIN-LISTESI.md).

## Uygulama bilgileri

| Alan | Değer |
|---|---|
| Ad | ODİ: Sesin Yolu |
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
| Ekran görüntüleri | `node tools/harness/vitrin.mjs --out <klasör>` (iOS 6,9" 1320×2868 ve 6,5" 1284×2778); seçim sahipte |

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
| Kullanıcı İçeriği › Oyun İçeriği | Evet | Evet | Hayır | Uygulama İşlevi | İlerleme, bölüm sonuçları, kamp, takım yarışı kayıtları |
| Kullanıcı İçeriği › Diğer Kullanıcı İçeriği | Evet | Evet | Hayır | Uygulama İşlevi | Takma ad, takım adı ve açıklaması, başvuru notu; beta geri bildirimi notu (Ayarlar › Geri bildirim gönder: konu, temizlenmiş metin ≤ 500 karakter, geldiği ekranın adı, sürüm, platform; kendi sunucumuzda 90 gün; oyuncu kimliği yok, hesapla eşleştirilemez) |
| Diğer Veriler › Diğer Veri Türleri | Evet | Evet | Hayır | Uygulama İşlevi (güvenlik, kötüye kullanımın önlenmesi) | IP adresi: ödül kodu denemesi kaydında 90 gün; bağlantıda yalnız bellekte (çökme raporu hız sınırı: tuzlu özeti bellekte en çok 1 gün) |
| Teşhis › Çökme Verileri | Evet | Hayır | Hayır | Uygulama İşlevi (çökmeleri azaltmak) | Çökme raporu (YN-011): hata adı ve temizlenmiş iletisi, yığın satırları (dosya:satır), uygulama sürümü ve derleme, platform ve işletim sistemi ana sürümü, ekran adı, dakikaya yuvarlanmış zaman; kendi sunucumuzda 30 gün. Oyuncu kimliği, takma ad, anahtar, sohbet metni, cihaz kimliği yok; IP yalnız hız sınırı için bellekte |
| İletişim Bilgileri, Sağlık ve Fitness, Finansal Bilgi (ödeme), Konum, Hassas Bilgiler, Kişiler, Tarama/Arama Geçmişi, Kullanım Verileri, Teşhis › Performans Verileri ve Diğer Teşhis Verileri | **Hayır** | — | — | — | İstenmez, toplanmaz; dış çökme/analiz aracı yok |

Notlar:
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
| Yarışmalar (gerçek ödüllü) | Yok | Oyun içi ödüller gerçek değer taşımaz |
| Sınırsız web erişimi | Hayır | — |
| Kullanıcı tarafından oluşturulan içerik | **Evet** | Takma ad, takım adı, sohbet |
| Mesajlaşma ve sohbet | **Evet** | Takım/genel sohbet, arkadaşlar arası özel mesaj |
| Reklam | Hayır | — |
| Uygulama içi kontroller (ebeveyn denetimi / yaş doğrulama) | Hayır | Aylık harcama sınırı var ama ebeveyn denetimi değil |

Hesaplanan sınıf 13+'tan düşük çıkarsa **"Yaş derecelendirmesini geçersiz kıl" ile 13+** seçin: gizlilik metni ve hedef kitle 13+.
Kids kategorisi seçilmez.

## Uygulama İnceleme bilgileri (Review notes)

İletişim: sahibin adı, telefonu ve `{ILETISIM_EPOSTA}`. **Oturum açma gerekmez** ("Sign-in required" kapalı). Notlar (EN):

> **No account or login is needed.** On first launch the game creates an anonymous account (random ID stored on the device;
> optional nickname). The game UI is in Turkish.
>
> **Quick tour:** tap "Yola çık" → the short story → "Atla" (skip) → choose a nickname (or "Sonra") → level 1 starts. Levels take
> about one minute. Features unlock by cleared levels: Friends, private messages and public chat after 4 levels; Team after 5;
> **Shop after 6 levels** (Profil › Mağaza); free-text chat after 8 levels.
>
> **In-app purchases** (all consumable): crystal packs, camp booster packs, a one-time Starter Pack and the Odi Season Card
> (28 days of daily crystals, does not auto-renew). Contents are fixed and listed before purchase; there are no loot boxes or
> random paid items. Purchases are verified on our server through RevenueCat. A monthly spending limit (default 1000 TRY) can be
> lowered at once and raised only after 24 hours (Mağaza › harcama sınırı).
>
> **User-generated content (1.2):** chat is limited to preset phrases and emoji until the player has cleared 8 levels; free text and
> nicknames pass a profanity filter. Players can report a message (long-press › "Şikâyet et") or a player and block them (player
> card › "Engelle"). A message reported by three players is hidden automatically; a player reported by three players within a day is
> muted. We review reports daily and can mute an account for longer. Contact: {ILETISIM_EPOSTA}.
>
> **Account deletion (5.1.1(v)):** Profil › Ayarlar › "Hesabı sil" › "Her şeyi sil". The account is deleted on the server immediately
> and all local data is wiped. Web instructions: https://<adres>/hesap-sil
>
> **Privacy:** no ads, no tracking, no analytics or crash-reporting SDK; no name, e-mail, phone, location or contacts are requested.
> Crash reports (error name, scrubbed message, stack lines, app/OS version, screen name) go only to our own server, are not linked
> to the player and are deleted after 30 days.
> The audiology content is educational and does not diagnose.

Ek: inceleme için gerekirse 6 bölümü geçmiş bir cihazın ekran kaydı (mağaza ve satın alma sayfası) eklenir (`tools/harness/vitrin.mjs`
kareleri ya da TestFlight kaydı).

## Diğer beyanlar
- **Dışa aktarım uyumluluğu:** şifreleme yalnız standart TLS → muaf (`ITSAppUsesNonExemptEncryption: false`).
- **İçerik hakları:** üçüncü taraf içerik yok; anlatıcı sesi açık lisanslı modellerle üretildi (Ayarlar'da künye).
- **Reklam tanımlayıcısı (IDFA):** kullanılmaz.
- **Sign in with Apple (4.8):** gerekmez (üçüncü taraf giriş yok).
