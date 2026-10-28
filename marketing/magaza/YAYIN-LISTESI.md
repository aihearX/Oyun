# Yayın listesi: hesaplardan ilk mağaza gönderimine

Sahip kararları (bu tur): **uygulama içi satın alma ilk sürümde var**; ikon, gizlilik ve mağaza metinlerini ajan ekibi hazırlar,
hesaplar açılınca **yüklemeleri de ajan yapar**; geliştirici hesabı türü (şirket mi kişisel mi) **sahibin şirket türü onayını bekliyor**
(öneri: aiHear Ltd/A.Ş. ise şirket hesabı).

Kim yapar: **[S]** sahip (kimlik, imza, ödeme, banka; ajan yapamaz) · **[A]** ajan. Bir adım ötekini bekliyorsa yazılı.
Gizli değerler (anahtar dosyaları, şifreler, banka) depoya, sohbete ya da iş listesine yazılmaz; ajana güvenli yoldan dosya olarak
verilir ve depo dışında `chmod 600` klasörde durur.

Kit: [`metinler.json`](metinler.json) (liste metinleri) · [`google-play.md`](google-play.md) · [`app-store.md`](app-store.md) ·
[`iap-urunler.md`](iap-urunler.md) · gizlilik [`docs/yonetim/gizlilik.md`](../../docs/yonetim/gizlilik.md) · EAS
[`apps/mobile/README.md`](../../apps/mobile/README.md) "Mağaza derlemesi" ve "Mağazaya gönderim".

## 0. Kararlar (önce)
- [ ] **[S]** Şirket türü ve hesap türü. Şirket hesabının artıları: mağazada yayıncı adı şirket; Google'da kişisel hesaplara
      uygulanan "12 test kullanıcısı × 14 gün kapalı test" şartı yok; Apple'da ekip üyesi eklenebilir. Gerekenler: D-U-N-S, şirket
      web sitesi ve alan adlı e-posta. Kişisel hesapta yayıncı adı sahibin adı olur.
- [ ] **[S]** Herkese açık iletişim e-postası (ör. şirket alan adlı destek adresi), şirket unvanı ve adresi, sunucunun Oracle
      bölgesi → **[A]** `apps/web/src/yasal/ayar.json` (`ILETISIM_EPOSTA`, `YAYINCI_UNVAN`, `YAYINCI_ADRES`, `SUNUCU_BOLGESI`) doldurur,
      `odi-guncelle` sonrası `/gizlilik`, `/en/privacy`, `/hesap-sil` sayfalarını tarayıcıda denetler.
- [ ] **[S]** Avukat okuması (öneri): `docs/yonetim/gizlilik.md` "Açık hukuk konuları" (KVKK m.9 yurt dışı aktarım, VERBİS, yaş).
- [ ] **[S]** İlk yayın ülkeleri (öneri: yalnız Türkiye; oyun fiyatı TL gösteriyor, bkz. `iap-urunler.md`).
- [ ] **[S]** Yaş ekranı kararı (YN-034). İkon tamam (YN-010, kavram A · Odi).

## 1. Kimlik ve hesaplar
- [ ] **[S]** D-U-N-S numarası (şirket hesabı için; Apple ve Google ikisi de ister). Apple'ın D-U-N-S sorgu sayfasından ücretsiz;
      yeni kayıt 5–14 gün sürebilir. Şirket adı ve adresi ticaret siciliyle birebir aynı olmalı.
- [ ] **[S]** Apple Developer Program (yıllık 99 USD): Apple Hesabında iki adımlı doğrulama açık; şirket için yetkili imza
      sahibi başvurur. Onay birkaç gün sürebilir.
- [ ] **[S]** Google Play Console geliştirici hesabı (bir kerelik 25 USD): kimlik doğrulama, şirket için D-U-N-S; geliştirici adı
      `{YAYINCI}`; iletişim e-postası ve telefon doğrulaması.
- [ ] **[S]** Expo hesabı (ücretsiz) → aynı gün **1b** (giriş, `eas init`, ortam değişkenleri, ilk Android APK). `eas init`
      yalnız `app.json > extra.eas.projectId` alanını doldurur; öteki alanlara dokunulmaz.

## 1b. Expo hesabı açıldığı gün: ilk deneme derlemesi (sahip, Windows PowerShell; YN-024)
Amaç: mağazaya gitmeden önce gerçek bir Android telefonda uygulamanın açıldığını ve sunucuya bağlandığını görmek. Yaklaşık bir saat
(derleme sırası beklemesi dahil). Hazırlık (bir kez): [nodejs.org](https://nodejs.org) üzerinden **Node.js 22 LTS** kurulu; depo
bilgisayarda (GitHub Desktop › Clone `aihearX/Oyun`). PowerShell'i açıp depo klasörüne girin ve paketleri kurun:
`cd $HOME\Documents\GitHub\Oyun` (klasör nerede ise) → `npm ci`. İlk `npx` komutu "Ok to proceed?" sorarsa `y` + Enter.
PowerShell "betik çalıştırma devre dışı" (running scripts is disabled) derse komutlarda `npx` yerine `npx.cmd` yazın.

1. [ ] **Giriş:** `npx eas-cli login` → Expo kullanıcı adı ve şifresi. Denetim: `npx eas-cli whoami` hesap adınızı yazar.
2. [ ] **Projeyi bağla:** `cd apps\mobile` → `npx eas-cli init` → "Create a project…?" sorusuna **Yes**. `app.json` içindeki
       `extra.eas.projectId` dolar (gizli değildir). Değişen `app.json`'u GitHub Desktop'ta "EAS proje kimliği" notuyla gönderin
       (ya da ajana söyleyin, o göndersin).
3. [ ] **Gizli olmayan ayarlar (EAS ortam değişkenleri; depoya yazılmaz):** sunucu adresini ve varsa RevenueCat anahtarlarını
       girin. `ALAN-ADI` yerine sunucunun alan adı; RevenueCat henüz yoksa son iki satırı atlayın (uygulama açılır, yalnız satın alma kapalı kalır):
       ```powershell
       npx eas-cli env:create --environment preview --environment production --name EXPO_PUBLIC_ODI_SERVER --value "wss://ALAN-ADI" --visibility plaintext
       npx eas-cli env:create --environment preview --environment production --name EXPO_PUBLIC_REVENUECAT_IOS --value "appl_..." --visibility plaintext
       npx eas-cli env:create --environment preview --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID --value "goog_..." --visibility plaintext
       npx eas-cli env:list --environment preview
       ```
       Son komut girdiğiniz değişkenleri listeler.
4. [ ] **Derle:** (hâlâ `apps\mobile` klasöründe) `npx eas-cli build -p android --profile preview`. "Generate a new Android
       Keystore?" → **Yes** (anahtarı EAS saklar; kaybolmaz). Sürüm numarası sorulursa Enter. Derleme Expo'nun bulutunda 15–40 dk
       sürer (ücretsiz hesapta sıra beklenebilir); bitince ekranda bir bağlantı ve QR kodu çıkar. Hata olursa ekrandaki
       "Build details" bağlantısını ajana iletin.
5. [ ] **Telefonda dene:** Android telefonun kamerasıyla QR'ı okutun (ya da bağlantıyı telefonda açın) → APK'yı indirin →
       "Bilinmeyen uygulamalara izin ver" isterse izin verin → kurun, açın. Bakılacaklar: açılış ekranı ve ikon, ilk bölüm oynanıyor,
       ses geliyor; haritada seviye rozetinin yanındaki nokta **yeşil** (yeşil = sunucuya bağlı, sarı = bağlanıyor, gri = çevrimdışı) ve
       5 bölümden sonra açılan **Takım** sekmesinde bağlantı uyarısı yok. Gri kalırsa 3. adımdaki adresi `env:list` ile denetleyin.
       Sonucu (çalıştı / şu ekranda takıldı + ekran görüntüsü) ajana yazın.

## 2. Banka, vergi, sözleşmeler
- [ ] **[S]** App Store Connect › Sözleşmeler: **Paid Apps** sözleşmesi; banka hesabı (IBAN; şirket hesabı) ve vergi formları
      (şirket için W-8BEN-E; Türkiye–ABD çifte vergilendirme anlaşması). Bu bitmeden uygulama içi ürünler "Hazır" olmaz.
- [ ] **[S]** **Apple Small Business Program** başvurusu (yıllık gelir 1 milyon USD altı → komisyon %15). Paid Apps sözleşmesinden
      sonra; onay sonraki ödeme döneminden başlar.
- [ ] **[S]** Google Play Console › Ödeme profili (Payments profile): şirket bilgileri, banka hesabı, vergi bilgileri. Google'da ilk
      1 milyon USD'ye %15 hizmet bedeli; hesap gruplaması (ilişkili geliştirici hesapları) formu Console'da doldurulur.
- [ ] **[S]** Mali müşavir: Apple/Google'dan gelen gelirin faturalanması ve KDV (Türkiye'de tüketiciye satışta KDV'yi mağaza tahsil
      eder; şirketin kendi beyanı için müşavir teyidi).

## 3. Ajanın yükleme yapabilmesi için sahibin oluşturacağı anahtarlar
- [ ] **[S]** **App Store Connect API anahtarı:** App Store Connect › Kullanıcılar ve Erişim › Entegrasyonlar › App Store Connect API
      › "+" (Takım anahtarı, rol **App Manager**). İndirilen `AuthKey_<KEYID>.p8` (yalnız bir kez indirilebilir), **Key ID** ve
      **Issuer ID** ajana güvenli yoldan verilir. → **[A]** dosyayı depo dışına koyar; `ODI_ASC_API_KEY_PATH`, `ODI_ASC_API_KEY_ID`,
      `ODI_ASC_API_KEY_ISSUER_ID` ortam değişkenleriyle `eas submit` (`apps/mobile/eas.json`). İsteğe bağlı aynı anahtar
      `eas credentials -p ios` ile EAS'a da yüklenir (derlemede sertifika/profil yönetimi için).
- [ ] **[S]** **Google Play hizmet hesabı:** Google Cloud Console'da proje → hizmet hesabı → JSON anahtarı; Play Console › Kullanıcılar
      ve izinler › hizmet hesabının e-postasını davet et, uygulama için **"Sürümleri test kanallarına yayınla"**, **"Sürümleri
      üretime yayınla, cihazları hariç tut ve uygulama imzalamayı kullan"** ve **"Mağaza girişini yönet"** izinleri (finans izni
      gerekmez). JSON ajana güvenli yoldan → **[A]** `ODI_PLAY_SERVICE_ACCOUNT_KEY_PATH`.
- [ ] **[S]** RevenueCat için ayrı kimlikler (bkz. 5): App Store Connect **In-App Purchase anahtarı** (.p8, App Store Connect ›
      Entegrasyonlar › In-App Purchase) ve Play için finans izinli bir hizmet hesabı JSON'u (RevenueCat'in kendi rehberindeki
      izinlerle; yükleme hesabından ayrı tutulması önerilir).
- [ ] **[S]** Expo erişimi: ajanın `eas` komutlarını çalıştırabilmesi için Expo hesabında bir **robot erişim anahtarı**
      (Expo › Account settings › Access tokens) → `EXPO_TOKEN` olarak ajana.

## 4. Mağaza kayıtları (uygulama kabuğu)
- [ ] **[A]** App Store Connect › Uygulamalar › "+": ad `ODİ: Sesin Yolu`, birincil dil Türkçe, Bundle ID `com.aiheartech.odi`
      (Certificates, Identifiers & Profiles'ta yoksa EAS ilk derlemede oluşturur), SKU `odi-ios`. (API anahtarıyla yapılamazsa
      **[S]** web arayüzünden oluşturur.) → uygulama numarası (`ascAppId`) gönderim sırasında yerel `eas.json`a yazılır.
- [ ] **[A]** Play Console › Uygulama oluştur: ad, varsayılan dil Türkçe, Oyun, Ücretsiz; beyanlar (Geliştirici Program Politikaları,
      ABD ihracat yasaları). (Uygulama oluşturma API ile yapılamaz → **[S]** iki dakikalık form; sonrası ajan.)
- [ ] **[A]** Liste metinleri ve görseller: `metinler.json` (TR + EN), ekran görüntüleri `node tools/harness/vitrin.mjs --out …`
      (sahip seçer); Play ikonu `play-ikon-512.png` ve öne çıkan görsel `play-tanitim-1024x500.png` (bu klasörde, YN-010); iOS ikonu derlemeden (`app.json`).
- [ ] **[A]** Beyan formları: Google `google-play.md` (Veri güvenliği, IARC, hedef kitle, reklam, hesap silme adresi, uygulama
      erişimi); Apple `app-store.md` (gizlilik etiketi, yaş, inceleme notları, şifreleme).

## 5. Uygulama içi satın alma (RevenueCat → StoreKit / Play Billing)
- [ ] **[A]** App Store Connect › Uygulama İçi Satın Almalar: 7 ürün, tür **Tüketilebilir**, kimlik/ad/açıklama/fiyat
      `iap-urunler.json`; her birine inceleme ekran görüntüsü ve notu (`iap-urunler.md`). Paid Apps sözleşmesi (2) bitmiş olmalı.
- [ ] **[A]** Play Console › Para kazanma › Uygulama içi ürünler: aynı 7 kimlik (tek seferlik ürün). Play, ürün oluşturmak için
      uygulamada faturalandırma izni olan bir AAB'nin yüklenmiş olmasını ister → önce 6. adımdaki ilk AAB.
- [ ] **[A]** RevenueCat: proje "ODİ"; App Store uygulaması (bundle id, In-App Purchase anahtarı, App Store Connect API anahtarı ile
      ürün içe aktarma) ve Play Store uygulaması (paket adı, hizmet hesabı JSON'u). Ürünleri içe aktar; **Offering/Entitlement gerekmez**
      (kod ürünü kimlikle çeker). İsteğe bağlı: App Store Server Notifications ve Play gerçek zamanlı bildirimleri RevenueCat'e.
- [ ] **[A]** RevenueCat herkese açık SDK anahtarları (`appl_…`, `goog_…`) → `eas env:create … EXPO_PUBLIC_REVENUECAT_IOS/ANDROID`
      (`apps/mobile/README.md`).
- [ ] **[S/A]** RevenueCat **gizli** API anahtarı (v1 REST `GET /v1/subscribers` ile çalışan `sk_…`): **[S]** RevenueCat'te oluşturur,
      sunucuda `sudo` ile `/etc/odi/odi.env` → `REVENUECAT_API_KEY=…` satırını ekler ve `sudo systemctl restart odi` (ajan sunucuya
      erişiyorsa ajan). Sohbete ya da depoya yazılmaz.
- [ ] **[A]** Sandbox / lisanslı test: Apple sandbox test kullanıcısı (App Store Connect › Kullanıcılar ve Erişim › Sandbox) ve Play
      lisans test kullanıcıları (sahibin ve test cihazlarının Google hesapları). TestFlight ve Play iç test derlemesinde her ürün bir
      kez satın alınır: ödeme sayfası, sunucuda `purchases` satırı (`store` app-store/play), içerik teslimi, ikinci kez aynı makbuz
      reddi, `odi.baslangic` ikinci alımda "Alındı", aylık sınır. Özellikle `odi.pass`ın RevenueCat yanıtında `non_subscriptions`
      altında geldiği doğrulanır.

## 6. Derleme ve ilk gönderim
- [ ] **[A]** `eas env:create` ile `EXPO_PUBLIC_ODI_SERVER=wss://<adres>` (preview + production); `eas env:list --environment production`
      üç değişkeni gösterir.
- [ ] **[A]** Sunucu güncel: `sudo odi-guncelle` (yasal sayfalar dahil); Caddyfile'ın yeni `try_files` satırı için bir kez
      `sudo bash tools/sunucu/kur.sh` (o zamana dek index.html yönlendirmesi `/gizlilik`i yine açar). Tarayıcıda `/gizlilik`,
      `/en/privacy`, `/hesap-sil` denetimi.
- [ ] **[A]** `node tools/magaza/denetle.mjs --yayin --adres <alan adı>`: 0 hata (karakter sınırları, katalog ↔ SHOP, boş yasal alan yok).
- [ ] **[A]** Kabul: `npm run kabul` (en az typecheck, lint, vitest, domcheck), `node tools/harness/pwa-e2e.mjs`, ui-mobile-check.
- [ ] **[A]** İlk mağaza derlemesi (YN-024): `eas build -p android --profile production` ve `eas build -p ios --profile production`.
      Cihazda: açılış, bölüm, sunucuya bağlantı (Takım sekmesi "bağlı"), mağaza ekranı gerçek fiyatlarla, Ayarlar › Gizlilik ve hesap.
- [ ] **[S]** Android ilk AAB'yi Play Console › Test › **İç test** kanalına **elle** yükler (Google API ilk sürümü kabul etmez; ajan
      dosyayı ve sürüm notunu hazırlar). Play App Signing'i kabul eder.
- [ ] **[A]** Sonraki Android sürümleri: `eas submit -p android --profile production` (iç test, taslak). Kişisel hesapta üretim için
      12 test kullanıcısı × 14 gün kapalı test şartı (şirket hesabında yok).
- [ ] **[A]** iOS: `eas submit -p ios --profile production` → TestFlight; dahili test (sahip cihazı) → sandbox satın alma (5).
- [ ] **[A]** İncelemeye gönder: Apple (sürüm sayfası: inceleme notları `app-store.md`, 7 uygulama içi ürün sürüme eklenir — ilk
      ürünler sürümle birlikte incelenir), Google (üretim kanalı ya da kapalı test; yayın türü "yönetilen yayın" öneri: onaydan sonra
      sahip "Yayınla" der).
- [ ] **[S]** Son onay: mağaza sayfasını, fiyatları ve ekran görüntülerini gözden geçirir; "Yayınla".

## 7. Yayından sonra (ajan, sürekli)
- Şikâyetler her gün: `kod.mjs sikayetler` (Apple 1.2 "zamanında yanıt"); gerekirse `sustur`.
- E-postayla gelen hesap silme istekleri: `kod.mjs hesap-sil <arkadaş kodu> --onay` (14 gün bağlanmamış), 30 gün içinde yanıt.
- KVKK başvuruları 30 gün içinde (`docs/yonetim/gizlilik.md`).
- Gizlilik metni kodla birlikte: yeni veri ya da süre → `apps/web/src/yasal/metin.ts` + `legal.test.ts` + mağaza beyanları.
