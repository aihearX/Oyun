# Yayın listesi: hesaplardan ilk mağaza gönderimine

**Yükleme günü için adım adım rehber (PowerShell komutları, nerede tıklanır, ne görmelisin):
[`YUKLEME-GUNU.md`](YUKLEME-GUNU.md).** Bu dosya genel durum listesidir; ayrıntı orada.

Kim yapar: **[S]** sahip (kimlik, imza, ödeme, banka; ajan yapamaz) · **[A]** ajan. Gizli değerler (anahtar dosyaları, şifreler,
banka, sunucu IP'si, yönetici kodu) depoya, sohbete ya da iş listesine yazılmaz; ajana ortam ayarlarından verilir
(YUKLEME-GUNU.md "Ajanın yapabilecekleri").

Kit: [`metinler.json`](metinler.json) (liste metinleri, TR + EN, sürüm notu) · [`google-play.md`](google-play.md) ·
[`app-store.md`](app-store.md) (gizlilik etiketi, yaş, inceleme notları) · [`iap-urunler.md`](iap-urunler.md) /
[`iap-urunler.json`](iap-urunler.json) · gizlilik [`docs/yonetim/gizlilik.md`](../../docs/yonetim/gizlilik.md) · ekran görüntüleri
[`docs/yonetim/magaza-ekran.md`](../../docs/yonetim/magaza-ekran.md) · EAS [`apps/mobile/README.md`](../../apps/mobile/README.md).
Denetim: `node tools/magaza/denetle.mjs` (gönderimden önce `--yayin --adres <alan adı> --eposta <adres>`).

## 0. Kararlar
- [x] **Geliştirici hesabı türü: şirket** (Apple Developer ve Google Play Console şirket adına açık). Google'ın kişisel hesaplara
      koyduğu "12 test kullanıcısı × 14 gün kapalı test" şartı yok.
- [x] **Uygulama içi satın alma ilk sürümde açık** (YN-032; RevenueCat → StoreKit / Play Billing).
- [x] **İlk sürüm 1.0.0.** (`apps/mobile/app.json` › `version` bugün `0.1.0`: derlemeden önce 1.0.0 olmalı; kod tarafı.)
- [x] İkon (YN-010, kavram A · Odi); Play ikonu ve öne çıkan görsel bu klasörde, uygulama ikonuyla aynı.
- [x] Çökme raporu: kendi sunucumuz (YN-011).
- [ ] **[S]** Şirket unvanı, adresi, herkese açık iletişim e-postası, sunucunun Oracle bölgesi, alan adı → **[A]**
      `apps/web/src/yasal/ayar.json` (`YAYINCI_UNVAN`, `YAYINCI_ADRES`, `ILETISIM_EPOSTA`, `SUNUCU_BOLGESI`). Boşken
      `denetle.mjs --yayin` hata verir ve `/gizlilik` "eklenecek" yazar.
- [ ] **[S]** Yaş ekranı (YN-034): karar açık; gönderim öneri (a) "şimdilik yok" ile yapılır, Google isterse güncellemeyle eklenir.
- [ ] **[S]** İlk yayın ülkeleri (öneri: yalnız Türkiye; fiyatlar ve harcama sınırı TL).
- [ ] **[S]** Avukat okuması (öneri): `docs/yonetim/gizlilik.md` "Açık hukuk konuları" (KVKK m.9, VERBİS).

## 1. Hesaplar
- [x] **[S]** Apple Developer Program (şirket) · [x] **[S]** Google Play Console (şirket).
- [ ] **[S]** Expo hesabı → `eas init`, ortam değişkenleri (YUKLEME-GUNU A).
- [ ] **[S]** RevenueCat hesabı ve projesi (YUKLEME-GUNU D).
- [ ] **[S]** Apple: Paid Apps sözleşmesi, banka, vergi (W-8BEN-E), Small Business Program (YUKLEME-GUNU B3–B4).
- [ ] **[S]** Google: ödeme profili (banka, vergi) (YUKLEME-GUNU C2).
- [ ] **[S]** Mali müşavir: mağaza gelirlerinin faturalanması ve KDV (mağaza tüketiciden KDV tahsil eder; şirket beyanı için teyit).

## 2. Ajanın yükleme yapabilmesi için erişim (isteğe bağlı; yoksa sahip komutları kendisi çalıştırır)
- [ ] **[S]** `EXPO_TOKEN` (Expo › Access tokens).
- [ ] **[S]** App Store Connect API anahtarı (App Manager): Key ID, Issuer ID, `.p8` (base64).
- [ ] **[S]** Play gönderim hizmet hesabı JSON'u (base64; test ve üretim kanalına sürüm, mağaza girişi; finans izni yok).
- [ ] **[S]** RevenueCat için ayrı kimlikler: App Store **In-App Purchase** anahtarı (.p8) ve finans izinli Play hizmet hesabı (yükleme
      hesabından ayrı).

## 3. Yükleme günü (sıra; ayrıntı YUKLEME-GUNU.md)
- [ ] 0 · Bilgiler `ayar.json`a, bilgisayar hazırlığı, `app.json` sürümü 1.0.0
- [ ] A · Expo hesabı, `eas init`, `EXPO_PUBLIC_ODI_SERVER` / `EXPO_PUBLIC_REVENUECAT_IOS` / `EXPO_PUBLIC_REVENUECAT_ANDROID`
- [ ] B · App Store Connect: Bundle ID `com.aiheartech.odi`, uygulama kaydı (SKU `odi-ios`), Paid Apps, banka, vergi, Small Business, API anahtarları
- [ ] C · Play Console: uygulama oluştur, ödeme profili, uygulama içeriği formları ([`google-play.md`](google-play.md)), mağaza girişi
- [ ] D · RevenueCat: iki uygulama, ürün içe aktarma, SDK anahtarları, sunucuya gizli anahtar (`/etc/odi/odi.env` → `REVENUECAT_API_KEY`, `sudo systemctl restart odi`)
- [ ] E · Sunucu: `sudo odi-guncelle` (yeni göçler dahil), `/gizlilik`, `/en/privacy`, `/hesap-sil` denetimi
- [ ] F · `eas build -p android --profile production` ve `-p ios --profile production`
- [ ] G · Android: ilk AAB İç test kanalına elle, 7 uygulama içi ürün, lisans testi, telefonda deneme
- [ ] H · iOS: `eas submit` → TestFlight, 7 uygulama içi ürün (inceleme görüntüleriyle), TestFlight'ta satın alma denemesi
- [ ] I · Liste metinleri, ekran görüntüleri (`/home/user/magaza-ekranlar.zip`, sahibe verilen), yaş, gizlilik etiketi, Veri güvenliği
- [ ] J · İncelemeye gönder; iki mağazada **yönetilen yayın**; onaydan sonra sahip "Yayınla"

## 4. Gönderimden önce son denetim [A]
- [ ] `node tools/magaza/denetle.mjs --yayin --adres <alan adı> --eposta <adres>`: 0 hata (karakter sınırları, dil kuralları,
      katalog ↔ SHOP, boş yasal alan yok).
- [ ] Kabul (kod tarafının sürüm adayı): `docs/yonetim/surum-adayi.md`.
- [ ] Cihazda üretim derlemesi: açılış, bölüm, sunucu bağlantısı (Takım), mağaza gerçek fiyatlarla, bir sandbox/test satın alması
      sunucuya yansıyor (`purchases` satırı, `store` app-store/play), Başlangıç Paketi ikinci alımda "Alındı", Ayarlar › Gizlilik ve
      hesap silme.
- [ ] İnceleme süresince sunucu açık; `odi-guncelle` yok.

## 5. Yayından sonra (ajan, sürekli)
- Şikâyetler her gün: `kod.mjs sikayetler` (Apple 1.2 "zamanında yanıt"); gerekirse `sustur`.
- E-postayla gelen hesap silme istekleri: `kod.mjs hesap-sil <arkadaş kodu> --onay`, 30 gün içinde yanıt.
- KVKK başvuruları 30 gün içinde (`docs/yonetim/gizlilik.md`).
- Gizlilik metni kodla birlikte: yeni veri ya da süre → `apps/web/src/yasal/metin.ts` + test + mağaza beyanları (`app-store.md`,
  `google-play.md`, `app.json` › `ios.privacyManifests`).
- Sonraki sürümlerde Apple "Yenilikler" alanı açılır (ilk sürümde yok); Google sürüm notu `metinler.json` › `releaseNotes`.
