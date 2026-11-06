# 1.0.0 mağaza adayı ek: ürün türleri, geri yükleme, bekleyen ödeme (2026-11-06)

Önceki raporun iki gönderim riski kapatıldı (`0ef3afb`; kart aralığı ve Sezon Kartı metni bu bölümün commit'inde). Bu bölüm aşağıdaki raporun "Satın alma" maddesindeki "yedi ürünün
hepsi tüketilebilir, geri yükleme düğmesi gerekmez" yargısının yerine geçer.

- **Ürün türleri** (`SHOP.storeType` = `iap-urunler.json` `tur`; `denetle.mjs` karşılaştırır, 0 hata): `odi.baslangic` Apple
  **Non-Consumable**, Play tek seferlik ürün + RevenueCat **Non-consumable** (kalıcı şapka, hesap başına bir kez); `odi.pass` Apple
  **Non-Renewing Subscription**, Play tek seferlik ürün (Play'de bu tür yok; RevenueCat Consumable, Entitlement'a bağlanmaz); öteki
  beşi Consumable. Üç tür de RevenueCat `non_subscriptions` altında gelir; sunucu orada arar (App Store işlem numarası sayı gelse de).
  İstemcide ayrıca finish/consume yok: RevenueCat bitirir, Play'de türü panodaki işarete göre tüketir. Tablo ve gerekçe:
  `marketing/magaza/iap-urunler.md` "Ürün türleri".
- **Satın alımları geri yükle** (mağaza ekranının altında, yalnız gerçek mağaza kipinde): RevenueCat `restorePurchases` → sunucu
  `shop.restore`. Hiçbir hesaba işlenmemiş işlem bu hesaba işlenir; bu hesaptaki Başlangıç Paketi / Sezon Kartı "zaten bu hesapta";
  başka ya da silinen hesaba işlenmiş işlem verilmez (sahiplik `purchases.receipt`; RevenueCat "Transfer" işlemi yeni appUserID'ye
  taşısa da). Kristal/hızlandırıcı paketleri geri yüklenmez; kart bunu yazar.
- **YN-285:** makbuz önce cihazdaki kalıcı kuyruğa, sonra sunucuya; bağlanınca/açılışta yeniden gönderilir; sunucu aynı işlemi bir
  kez işler (`already: true` başarı). Makbuzu gelmeyen yarım işlem ve onay bekleyen ödeme için 7 gün sunucu taraması. Doğrulanan
  ödeme sınır yüzünden reddedilmez; sınırlar ödemeden önce `shop.check`. Hata metinleri RevenueCat koduna göre ("Mağaza ödeme almadı"
  yalnız ödeme başlamadan çıkan hatalarda).
- **Testler:** kabul `--yalniz typecheck,lint,vitest,ses,mobil-tsc,jest,expo-doctor,dom-paketi,domcheck,social,codes` hepsi geçti
  (8 dk; vitest 160 dosya / 1208 test, jest 21, expo-doctor 20/20, social 95 sn). Yeni: sunucu 6 test (tür, idempotentlik, yeniden
  deneme ve ödenmiş ürünün sınırla reddedilmemesi, geri yükleme, iki hesap + hesap silme, anahtarsız/RevenueCat düşük), vitest kuyruk
  8, jest geri yükleme + hata türleri + AsyncStorage kuyruğu. ui-mobile `--only profil --magaza-fiyat` (gerçek mağaza kipi, geri
  yükleme kartı ve sonucu) web + dom × Chromium + WebKit × 390/320: 360 ekran 0 sorun; Kart aralığı ve Sezon Kartı metni ("abonelik değildir" → "App Store bunu yenilenmeyen abonelik diye gösterir")
  düzeltildikten sonra dom × Chromium + WebKit × 390/320 yeniden: 184 ekran 0 sorun.
  kopma-e2e `--only cuzdan` (bağlanınca ilk istekler değişti): Chromium + WebKit 156 denetim geçti.
- **Kalan riskler:** (1) gerçek mağazada hiç denenmedi: Sezon Kartı'nın yenilenmeyen abonelik olarak RevenueCat `non_subscriptions`
  altında geldiği TestFlight sandbox'ında doğrulanmalı (YUKLEME-GUNU H4, adımlar yazılı). (2) Hesap kurtarma yok: uygulamayı silip
  kuran oyuncu yeni hesap açar, eski hesaba işlenmiş Başlangıç Paketi yeni hesaba geri yüklenmez (kural gereği); Apple bunu sorarsa
  seçenek yeni hesaba yalnız kalıcı kozmetiği vermek (sahip kararı). (3) RevenueCat panosunda `odi.baslangic` (Android)
  "Non-consumable" işaretlenmezse Play'de tüketilir (sunucu yine bir kez verir). (4) Hesap silme cihazdaki bekleyen kuyruğu da siler;
  hiçbir hesaba işlenmemiş ödeme yeni hesapta "Satın alımları geri yükle" ile işlenir (RevenueCat Transfer varsayılanıyla).

# 1.0.0 mağaza adayı: tam kabul koşusu (2026-11-06)

**Sonuç: yeşil.** Tam kabul `78f7796` üzerinde koştu: 25 takımdan 23'ü ilk denemede geçti. `social` ve `ui-mobile` gerçek
hata verdi; kök nedenleri bulundu ve düzeltildi. Son ağaçta (`5158d04`) hızlı takımlar ve `social` yeniden geçti, `ui-mobile`
ikinci kez tam koştu, düşen iki yapılandırma düzeltmeden sonra tek başına yeniden koşup geçti (aşağıda). Oyun kodunda bulunan
tek gerçek hata: bekleyen ödül bildiriminin her açılışta tekrar çıkması (`ced3f08`). Öteki bulguların hepsi denetim
araçlarındaydı (eskimiş test adımı, bildirim zamanlaması, DOM'da yanlış depo okuması) ya da makinedeydi (disk doldu).

## Hangi kod?
- **Sürüm:** `app.json` `version` **1.0.0** (sahip kararı 20). iOS derleme numarası ve Android `versionCode` EAS'ta
  (`appVersionSource: remote`, production `autoIncrement`); `ios.buildNumber` app.json'dan çıkarıldı (yok sayılıyordu).
  Ayarlar ve yasal metinler (`APP_VERSION`), sunucu `/saglik` (`SERVER_VERSION`) ve `package.json`'lar 1.0.0.
- **Tam kabul ağacı:** `78f7796` (main `b14871e` mağaza kiti + `3be5d74` sürüm ve Expo yamaları, `1f5f6e4` Hertz, `91f0950`
  bekleyen ödül tavanı, `cf0e2bf` mağaza derlemesi denetimi, `78f7796` gizlilik metni).
- **Son ağaç:** `5158d04` = `78f7796` + `c2182ad` (`social-e2e.mjs`) + `ced3f08` (`net.ts` tek satır geri yükleme, test,
  `ui-mobile-check.mjs`) + `ddd256c`, `5158d04` (yalnız `ui-mobile-check.mjs`). Oyun kodu farkı yalnız `net.ts`'teki satır.
- **Makine:** 4 çekirdek; takımlar `nice -n 5`. Aynı makinede eski oyuncu testi sunucusu açıktı (dokunulmadı).

## Takımlar (tam kabul, `78f7796`)

| Takım | Sonuç | Süre | Not |
|---|---|---|---|
| typecheck | geçti | 23 sn | |
| lint | geçti | 15 sn | |
| vitest | geçti | 151 sn | |
| ses (`generate.mjs --check`) | geçti | 0 sn | |
| mobil-tsc | geçti | 16 sn | |
| jest | geçti | 1 sn | |
| expo-doctor | geçti | 5 sn | 20/20. Koşudan önce 19/20 düşüyordu: Expo yeni SDK 58 yamaları → `3be5d74` (YN-039 gibi) |
| dom-paketi (`expo export --platform ios`) | geçti | 15 sn | Android paketi ayrıca: `expo export --platform android` geçti (30 sn) |
| domcheck | geçti | 106 sn | 1. bölüm 3 yıldız, dokunma, kaydırma |
| bot 1–40 | geçti | 1417 sn | |
| bot-bos | geçti | 248 sn | |
| reset (web + dom) | geçti | 151 sn | |
| onboarding (web + dom) | geçti | 4206 sn | sınır 4800 sn, **%88** (önceki aday %69): sınıra yaklaşıyor |
| codes | geçti | 37 sn | |
| team-apply | geçti | 55 sn | |
| teamrace | geçti | 136 sn | |
| comm | geçti | 568 sn | |
| social | **düştü ×2 (gerçek)** | — | aşağıda 1; düzeltme `c2182ad` |
| friends | geçti | 39 sn | |
| events | geçti | 622 sn | |
| race | geçti | 78 sn | |
| kopma | geçti | 885 sn | |
| camp | geçti | 1104 sn | sınır 3600 sn |
| vaka | geçti | 160 sn | |
| ui-mobile (web + dom × Chromium + WebKit × 320/390, kontrastlı) | **düştü (gerçek)** | 11156 sn | 1520 ekran, 11 sorun; sınır 19000 sn, %59. Aşağıda 2 |

## Son ağaçta yeniden koşanlar

| Koşu | Ağaç | Sonuç | Süre | Not |
|---|---|---|---|---|
| kabul `--yalniz typecheck,lint,vitest,ses,mobil-tsc,jest,expo-doctor,dom-paketi,domcheck,social` | `ced3f08` | hepsi geçti | 430 sn | vitest 159 dosya / 1194 test; jest 14; expo-doctor 20/20; social 90 sn, tüm adımlar |
| ui-mobile tam (8 yapılandırma, kontrastlı) | `ced3f08` | düştü | ≈ 3 sa | 1474 ekran, 11 sorun: web-chromium-390 Chromium çöktü (disk doldu, aşağıda 3); dom-webkit-390 iki sonuç ekranında kontrast 10 (bildirim; `ddd256c`). Öteki 6 yapılandırma 0 sorun; `gorev-kamp-dugmeleri` 7 yapılandırmada geçti (`ced3f08` düzeltmesi) |
| ui-mobile web-chromium-390 (tam yapılandırma) | `ddd256c` | geçti | 1879 sn | 197 ekran, 0 sorun, kontrast 0 ihlal |
| ui-mobile dom-webkit-390 (tam yapılandırma) | `5158d04` | geçti | 1790 sn | 183 ekran, 0 sorun, kontrast 0 ihlal (sonuc-kaybetti-yardim, -rahat-teklif, -sis dahil) |
| pwa-e2e (Chromium + WebKit) | `78f7796` | geçti | ≈ 130 sn | 10/10: manifest ve simgeler, ilk kareler koyu, çevrimdışı açılış + 1. bölüm, yasal sayfalar çevrimdışı, yeni sürüm |
| `node tools/magaza/denetle.mjs` | `78f7796` | 0 hata | | 4 uyarı: `ayar.json` yayıncı bilgileri boş (aşağıda) |

`ui-mobile`'ın üçüncü tam koşusu (≈ 3 saat) yapılmadı: ikinci tam koşuda 6 yapılandırma temizdi; düşen ikisi tek başına
yeniden koştu ve son iki commit yalnız denetim aracını değiştirdi.

## Bulunan ve düzeltilen hatalar
1. **social (iki kez düştü):** test eskimişti, oyun doğruydu. 8. adım takım teknolojisine bağışta onay penceresini (YN-073,
   `d13d594`) onaylamıyordu; 10. adım hediyeyi alıcının adıyla arıyordu, karar 39'dan beri hediye adsız. Test güncel arayüze
   uyduruldu; onaydan önce bağışın yazılmadığı ve hediyenin adsız olduğu da denetleniyor (`c2182ad`). Bu takım tur sonu kabul
   alt kümelerinde yoktu; tur sonu PY'ye eklenmesi önerilir.
2. **ui-mobile (11 sorun, bildirim zamanlaması):** (a) `dom-chromium-320 gorev-kamp-dugmeleri` "üst pay: .toast-top top=30 <
   47": kutlama açıkken sırada bekleyen bildirim kutlama kapanınca hemen geliyor, ölçüm giriş animasyonunun ilk karesine denk
   geldi; adım artık kutlamadan sonra bildirimi kapatıp bekliyor (`ced3f08`). (b) `dom-webkit-390` iki sonuç ekranında kontrast
   10 bulgu ("Seviye 3" 1,06): yeni hesabın cihaz jetonu devri bildirimi kontrast turları sırasında geliyor, XP kartı kaydırılınca
   bildirimin altına giriyordu. Sonuç döngüsü ölçümden önce bildirimi kapatıyor (örtme ayrıca ölçülüyor); görüntü alınırken bir
   yazının örtülme durumu değişirse örnek yineleniyor; bildirimin altındaki yazı ölçülmüyor (`ced3f08`, `ddd256c`).
3. **Chromium çökmesi ("Target crashed", SIGSEGV), web-chromium-390:** kök neden diskin dolmasıydı (crashpad "No space left on
   device"; `/` %100). Tek başına beş kez yeniden üretildi (`78f7796`teki `net.ts` ve önceki ölçüm koduyla da), yer açılınca geçti. Yalnız bu
   çalışanın çıktıları ve Node derleme önbelleği (`/tmp/node-compile-cache`) silindi; oyuncu testi çıktılarına dokunulmadı.
   **Not:** makinede yer azdır (`tools/harness/out` 6 GB, `oyuncular` 3,1 GB); uzun koşulardan önce `df -h /` bakılmalı.
4. **DOM'da yüksek görünürlük kaydı (denetim):** `sonuc-kaybetti-sis` kaydı localStorage'dan okuyordu; DOM'da oyun yerel
   köprüye yazar. Yalnız DOM koşan yapılandırmada "kayıtta kapalı" diye düştü (oyun ayarı açıyor ve söylüyordu); köprü deposundan
   okunuyor (`5158d04`).
5. **Bekleyen ödül bildirimi her açılışta (oyun kodu, karar 54):** açılışta son bilinen günlük durum `carry`/`carried` olmadan
   geri yükleniyordu; o gün bekleyenden jeton geçtiyse "Bekleyen ödül hesabında" bildirimi her açılışta tekrar çıkıyordu
   (`ced3f08`; ui-mobile bulgusunu incelerken kod okuyarak bulundu).
6. **expo-doctor 19/20:** Expo SDK 58'in yeni yamaları (expo 58.0.23, expo-router 58.0.30, react-native-safe-area-context 5.11.1
   ve 7 paket); `npx expo install --fix` (`3be5d74`). `@expo/cli`'nin iç zod 3 kopyası kilit dosyasından düştü.

Disk doluyken koşan bir `--only gorev,sonuc` alt kümesinde ayrıca 320 px'te "yardım iste" kartının alt kenarı yapışkan alanın
8 px altında ölçüldü (4 yapılandırma); aynı ekranlar aynı ağaçtaki ikinci tam koşuda 8 yapılandırmanın hepsinde geçti, düğme
ve metin ekranda. Alt kümenin önceki adımları atlaması ekran durumunu değiştiriyor; ayrıca izlenebilir.

## Bu adayda değişenler (kod)
- **Hertz (karar 55):** quiz açıklaması "Frekans, sesin saniyedeki titreşim sayısıdır; birimi hertzdir (Hz)." (`1f5f6e4`).
- **Bekleyen ödül tavanı:** en çok 3.000 jeton (`LOCAL_JETON_CARRY_MAX`); aşan kısım "eklenmedi" diye yazılır; göç 17
  (`local_grants.carried`). Ayrıntı [`ekonomi-olcum.md`](ekonomi-olcum.md) (`91f0950`).
- **Mağaza derlemesi (`cf0e2bf`):** sunucu adresi yalnız `EXPO_PUBLIC_ODI_SERVER`'dan, Metro bilgisayarına düşüş yalnız
  geliştirmede; çevrimdışı kartı oyuncuya göre ("İnternet bağlantını kontrol et", eskiden `npm run server` ipucu); sunucu makbuzu
  doğrulayamıyorsa (`REVENUECAT_API_KEY` yok) `shop.list` `realStore: false` ve uygulama mağaza ödemesini başlatmaz; ödeme
  alınıp işlenemezse dürüst söz ("Ödeme alındı, hesabına işlenemedi").
- **Gizlilik metni (`78f7796`):** şikâyetle gizlenen iletinin göndereni 10 dk susturulur; Bilgi Yarışması'na katılırken bilgi
  düzeyi sunucuya gider; kendi özel mesajını silme (TR + EN).

## Mağaza denetimi (kod okuyarak ve araçlarla)
- **Sunucu adresi:** yalnız EAS ortam değişkeni; yoksa çevrimdışı oyun ve "Çevrimiçi özellikler kapalı"; depoda adres yok.
- **Satın alma:** RevenueCat anahtarı yoksa `createNativeStore` yok → mağaza "bu sürümde kapalı", çökme yok; anahtar varsa ürünler
  kimlikle `getProducts(..., NON_SUBSCRIPTION)`. Katalog = `SHOP` = mobil kod: `node tools/magaza/denetle.mjs` 0 hata
  (4 uyarı: `ayar.json` yayıncı bilgileri boş). Yedi ürünün hepsi tüketilebilir: Apple "Satın alımları geri yükle" düğmesi
  gerekmez (hak sunucuda, hesaba bağlı). `odi.baslangic` (hesap başına bir kez, kalıcı şapka) ve `odi.pass` (28 gün) App Store
  incelemesinde tüketilebilir dışı tür istenirse geri yükleme düğmesi o zaman eklenmeli.
- **Hesap silme** uygulama içinden (Profil › Ayarlar › Hesabı sil › Her şeyi sil → `account.delete`); bağlantı yoksa bunu açıkça söyler.
  **Şikâyet ve engelleme:** sohbet ve özel mesajda şikâyet, profilde engelle.
- **app.json:** `blockedPermissions` (depolama, SYSTEM_ALERT_WINDOW, mikrofon, konum, AD_ID), `privacyManifests`,
  `ITSAppUsesNonExemptEncryption: false`, `supportsTablet: false`. İkon 1024×1024 RGB (alfa yok), adaptive ön/arka/tek renk
  1024×1024, splash 1024×1024. Android hedef API 36, en düşük 24 (RN 0.88 varsayılanı; Play şartını karşılar).
- **Mobil:** `tsc`, jest 14/14, expo-doctor 20/20, `expo export` iOS ve Android hatasız.

## Kalan riskler (mağaza gönderimi)
- **`apps/web/src/yasal/ayar.json` boş alanlar:** `YAYINCI_UNVAN`, `YAYINCI_ADRES`, `ILETISIM_EPOSTA`, `SUNUCU_BOLGESI`. Gizlilik
  sayfası ve uygulama içi metin bunlar yerine "eklenecek" yazar; mağaza incelemesi için doldurulmalı
  (`node tools/magaza/denetle.mjs --yayin --adres <alan adı>` hata vermemeli).
- **İlk EAS derlemesi hiç denenmedi** (YN-024): `eas init` `extra.eas.projectId`'yi yazar; `eas.json` `ascAppId` yer tutucusu.
- **Makbuz yeniden deneme kuyruğu yok** (YN-285): mağaza ödemesi alınıp sunucuya ulaşılamazsa ürün kendiliğinden verilmez.
- **Yarış içi şerit HUD'a biniyor** (YN-284, görsel; dokunulmadı).
- **onboarding süresi** sınırın %88'i.
- Android çökme raporunda derleme numarası boş gelir (`Constants.platform.android.versionCode` yerelde yok); iOS doğru.

## Sahibin yapacakları
- Sunucu: `odi-guncelle` (göç 16 henüz uygulanmadıysa o da; göç 17 `local_grants.carried`, açılışta kendiliğinden).
  `odi.env`'de `REVENUECAT_API_KEY` (yoksa uygulama gerçek ödemeyi başlatmaz), `NODE_ENV=production`, `ODI_TEST_STORE=0`
  (`odi-durum` ikisini de uyarır).
- EAS ortamı (production): `EXPO_PUBLIC_ODI_SERVER` (`wss://…`), `EXPO_PUBLIC_REVENUECAT_IOS`, `EXPO_PUBLIC_REVENUECAT_ANDROID`.
- `ayar.json` yayıncı bilgileri; App Store Connect / Play Console'da yedi tüketilebilir ürün, RevenueCat projesi.

---

# Kapalı beta sürüm adayı: tam kabul koşusu (2026-10-29)

**Sonuç: temiz.** Bütün kabul takımları, PWA, yerel üretim bayraklı sunucuda uzak duman ve 50 oyunculu yük denetimi geçti. Son koşuda hiçbir takım tekrar istemedi.

Bulunan tek gerçek hata `expo-doctor`'du (YN-039). Expo SDK 58'in yeni yama sürümleri yüzünden düştü; ayrı bir commit ile düzeltildi.

## Hangi kod?
- **Test edilen ağaç:** `44fb7e2`. İçeriği:
  - main `b8b2767` (geri bildirim, YN-038);
  - `ff64bce` SDK 58 yama sürümleri (YN-039);
  - beta notları.
- Bu ağaç main'deki `8871159` (yalnız `docs/yonetim`) üzerine yeniden dizildi. **Kodu aynıdır:** `git diff 44fb7e2 f40ca92` yalnız `docs/yonetim/durum.md` ve `is-listesi.md` dosyalarını gösterir.
- **Sürüm alanı:** `app.json` hâlâ `0.1.0`. Beta için önerilen sürüm 0.9.0; karar sahipte (karar 20).
- **Makine:** 4 çekirdek, 16 GB. Komutlar `nice -n 5` ile koştu.
  - 1 dk yük ortalaması çoğunlukla 2–4'tü (en çok ≈ 5).
  - Aynı anda başka bir çalışanın (geribildirim) koşuları da vardı.
- **Koşu düzeni:** kabul, `--yalniz` ile üç parçaya bölündü:
  - `typecheck` … `vaka` (e2e takımları);
  - `bot,bot-bos`;
  - `dom-paketi,domcheck,ui-mobile`.
- **Süre sınırları:** `camp` 3600 sn, `UIM_SURE` 19000 sn (kabul.mjs'teki değerler).

## Takımlar (son koşu, 44fb7e2; hepsi ilk denemede)

| Takım | Sonuç | Süre | Not |
|---|---|---|---|
| typecheck | geçti | 21 sn | |
| lint | geçti | 16 sn | |
| vitest | geçti | 100 sn | 80 dosya, 559 test |
| ses (`generate.mjs --check`) | geçti | 0 sn | 208 satırın kaydı güncel |
| mobil-tsc | geçti | 17 sn | |
| jest | geçti | 2 sn | 4 takım, 13 test |
| expo-doctor | geçti | 7 sn | 20/20. İlk koşuda (ab4fb68) iki kez düştü → YN-039, `ff64bce` |
| dom-paketi | geçti | 18 sn | `expo export --platform ios` |
| domcheck | geçti | 122 sn | 1. bölüm ⭐3, dokunma, kaydırma |
| bot 1–40 (Chromium) | geçti | 1446 sn | 40/40 tamamlandı, 0 hata |
| bot-bos (boşta oyuncu) | geçti | 271 sn | 40/40 bölüm tamamlanmadı (beklenen) |
| reset (web + dom) | geçti | 154 sn | |
| onboarding (web + dom) | geçti | 3305 sn | Sınır 4800 sn; %69'u (ilk koşu 3676 sn, %77) |
| codes | geçti | 42 sn | |
| team-apply | geçti | 58 sn | |
| teamrace | geçti | 123 sn | |
| comm | geçti | 426 sn | |
| social | geçti | 105 sn | 17 adım; çökme raporu (16) ve geri bildirim (17) dahil |
| friends | geçti | 40 sn | |
| events | geçti | 525 sn | 11 denetim |
| race | geçti | 86 sn | |
| kopma (tam `kopma-e2e`) | geçti | 761 sn | 520 denetim, Chromium + WebKit; `--only` yok: odul, kamp, cuzdan (bolum, bolum-kopma, bolum-zaman dahil), sohbet, etkinlik, yaris, yaris-ici |
| camp | geçti | 1151 sn | Sınır 3600 sn |
| vaka | geçti | 223 sn | |
| ui-mobile (web + dom × Chromium + WebKit × 320/390, kontrastlı) | geçti | 6177 sn | 1044 ekran, 0 sorun; ayrıntı aşağıda; sınır 19000 sn, %33'ü |

**ui-mobile kontrast sonucu (WCAG AA):**
- 52 531 metin ölçüldü; 0 ihlal.
- 581 gerekçeli istisna var (devre dışı denetimler).
- 2719 ölçüm sahip kararı 19'u bekliyor (Ö1–Ö7 dolgu önerileri).
- 568 ölçüm yapılamadı.

**Ek koşular (44fb7e2):**

| Koşu | Sonuç | Süre |
|---|---|---|
| `node tools/harness/pwa-e2e.mjs` | 10/10 (Chromium + WebKit: manifest/simgeler, ilk kareler koyu, çevrimdışı açılış + 1. bölüm ⭐3, yasal sayfalar çevrimdışı, v1 → v2 güncelleme) | 105 sn |
| `uzak-duman --sunucu ws://127.0.0.1:<port> --ip-siniri 3`, yerel üretim bayraklı sunucuya karşı (ayrıntı aşağıda) | 37 denetim, 0 hata. D13: 5 × "geçersiz", 6. "çok"; D14: 4. hesap sahte `X-Forwarded-For` ile de `HIZ`. 3 hesap silindi, `/saglik` 0 → 0 | 25 sn |
| Aynı sunucuda uçlar (curl) | `POST /hata {}` → 400. `POST /geri-bildirim`: `{}` → 400, geçerli not → 204. `GET /geri-bildirim` → 405 | — |
| `node tools/sunucu/yuk.mjs --yerel-ornek --oyuncu 50 --sure 120` | Ayrıntı aşağıda. **`D10 ölçütleri: GEÇTİ`** | 126 sn |

**Yerel üretim bayraklı sunucunun ayarları:**
- `NODE_ENV=production`, `HOST=127.0.0.1`;
- `ODI_TEST_STORE` yok;
- `ODI_ADMIN_CODE_HASH`: rastgele, hiçbir yere yazılmamış bir kodun özeti;
- `ODI_NEW_PER_IP_HOUR=3`, `ODI_TRUST_PROXY` yok;
- geçici SQLite.

**Yük denetimi (yuk) sonuçları:**
- 50/50 sanal oyuncu, 3116 istek (24,8/sn).
- Yanıt süresi: p50 1,4 ms, p95 3,3 ms, p99 5,6 ms, en çok 18,3 ms.
- 0 hata, 0 kopma.
- Sunucu işlemcisi ortalama %3,0 (tek çekirdeğe göre).
- Bellek 92,5 → 103,7 MB; ısınmadan sonra +%4,7.

## Düşenler ve düzeltmeler
1. **expo-doctor: gerçek hata, iki kez düştü (ilk koşu, ab4fb68).**
   - **Neden:** 19/20 denetim geçti. "packages match versions required by installed Expo SDK" denetimi düştü: Expo 27 Ekim'de SDK 58 yama sürümleri yayımladı ve denetim kayıt defterine bakıyor. Kod gerilemesi değil.
   - **Düzeltme:** `ff64bce` (YN-039), `npx expo install --fix`. Değişen sürümler:
     - expo 58.0.20 → 58.0.21;
     - expo-linking → 58.0.15;
     - expo-router → 58.0.28;
     - expo-splash-screen → 58.0.12;
     - expo-system-ui → 58.0.7;
     - react-native 0.88.0 → 0.88.1;
     - jest-expo → 58.0.13.
   - **Doğrulama:** typecheck, mobil-tsc, jest, expo-doctor 20/20, dom-paketi ve domcheck hemen geçti. Ardından bütün takımlar yeni ağaçta yeniden koştu (yukarıdaki tablo).
   - Önceki aynı türden iş: 5b21cd7.
2. **ui-mobile: DOM yapılandırmaları düştü (koşu düzeni hatası, ürün hatası değil).**
   - **Ne oldu:** 4 DOM yapılandırması `akış — scrollIntoViewIfNeeded: Timeout 30000ms` ile düştü; web yapılandırmaları geçti.
   - **Neden:** Bu koşuya `dom-paketi` dahil değildi. DOM paketi (`apps/mobile/dist/www.bundle`) önceki parçada, `b8b2767`'ye geçmeden önce kurulmuştu. kabul paket varsa yeniden kurmuyor. Eski pakette "Geri bildirim gönder" kartı yoktu, ui-mobile'ın yeni adımı da onu arıyordu.
   - Tekrar denemesi yarıda durduruldu.
   - **Sonra:** `--yalniz dom-paketi,domcheck,ui-mobile` ile 1044 ekran, 0 sorun.
   - **Not (araç, P3):** kabul'ü `--yalniz` ile bölerken DOM takımları koşan her parçaya `dom-paketi` eklenmeli. Daha iyisi: kabul paketin yaşını HEAD ile karşılaştırsın.
3. **Ötekiler:** Hiçbir takım "tekrarda geçti" olmadı. Yük kanıtı gereken düşüş yok.

## Bilinen sorunlar (beta için)
- **MK-036 artıkları (P3):**
  - Bölüm sonu jetonunun üst çubukta donması ve bir anlık fazla ödül MK-038'de giderildi.
  - Bu koşuda `kopma-e2e` cüzdan senaryoları (bolum, bolum-kopma, bolum-zaman) geçti.
  - Kalan tek risk araç tarafında: kabul'ün süreç temizliği, `ODI_KABUL_RUN` ortam değişkeninin alt süreçlere geçmesine dayanıyor. Bu koşudaki kabul çağrılarından sonra ağaçta artık süreç kalmadı. Elle yarıda durdurulan tekrarın süreçleri, koşu kimliğiyle bulunup elle kapatıldı.
- **ARM'de denenmedi:**
  - `npm ci --ignore-scripts` ARM'de arm64 yerel ikililerini bulacak mı: `@esbuild/linux-arm64`, `@rolldown/binding-linux-arm64-gnu`, `lightningcss-linux-arm64-gnu`.
  - Sunucu x64 kapta denendi; Oracle ARM'de yük ölçümü (D10) yapılmadı.
  - Gerçek DuckDNS, Let's Encrypt ve Security List de denenmedi.
  - Ayrıntı: [`sunucu-dogrulama.md`](sunucu-dogrulama.md) "İlk gerçek kurulumda".
- **Telefon ve tarayıcıdan bekleyen denetimler:**
  - D4: web aynı kökenden, gerçek adreste.
  - D5: uzak duman, gerçek sunucuda. Bu koşuda yalnız yerel üretim bayraklı sunucuya karşı geçti.
  - D6: kopma, gerçek sunucuda.
  - D16: uygulamadan bağlantı (Expo Go ve APK).
  - D14'ün kesin sınaması üretimde geçici olarak sınır 3 ister.
- **İlk EAS/APK derlemesi hiç denenmedi (YN-024):**
  - Bu derlemeye react-native 0.88.1 girecek (YN-039).
  - DOM tek dosya ayarı EAS'ta denenmedi (YN-025).
  - Android sistem yazı boyutu ile Büyük yazı cihazda denenmedi (MK-006).
- **Sunucu güncellemesi sahipte:** sahip `odi-guncelle` ve `kur.sh` çalıştırmalı. Bunlar olmadan:
  - çökme raporu (`/hata`, YN-011) üretimde açılmaz;
  - geri bildirim (`/geri-bildirim`, YN-038) üretimde açılmaz;
  - Caddy satırları üretime girmez.
- **ODY-İLK kodu (YN-037):** sunucuda henüz tanımlı değil; ödül kararı sahipte (karar 21).
- **Bot kapsamı:** kabul'deki bot 1–40 yalnız Chromium'da koştu. WebKit'te son 40/40 sonucu MK-039/MK-040 doğrulamasından.
- **onboarding süresi:** 55–61 dk, sınırın %69–77'si. Yük artarsa sınıra yaklaşır; izlenmeli.
- **Kontrast:** 2719 ölçüm sahip kararı 19'u bekliyor (ihlal değil, öneri).
- **Bağımlılık denetimi (`npm audit --omit=dev`):**
  - 3 yüksek bulgu var. Hepsi Expo derleme aracının kendi iç `zod@3.25.76` kopyasından geliyor (`@expo/cli`, `expo`). 5 düşük bulgu `deepmerge` (`@expo/config`) kaynaklı.
  - Oyun sunucusu ve web `zod@4.6.7` kullanıyor (yamalı).
  - Bulgular derleme zamanı aracında, çalışan oyunda değil.
  - `npm audit fix --force` Expo'yu kırar; Expo'nun bir sonraki yamasında yeniden bakılmalı.
- **Yerel ağ kısıtı (YN-030):** IP başına saatte 20 yeni hesap sınırı, okul ağında ya da CGNAT arkasında toplu kayıtta engel olabilir.

## Sürüm numarası (sahip kararı 20)
- **KARAR (sahip, 2026-11-06): 1.0.0, doğrudan mağaza.** Uygulandı (1.0.0 mağaza adayı, en üstteki bölüm): `app.json` `version`,
  Ayarlar ve yasal metinlerdeki sürüm (`APP_VERSION`), sunucu `/saglik` (`SERVER_VERSION`), kök ve çalışma alanı `package.json`'ları.
- Eski öneri (kapalı beta 0.9.0) uygulanmadı.

## Beta notları
[`marketing/magaza/beta-notlari.md`](../../marketing/magaza/beta-notlari.md) (test edenler için, Türkçe, 8 satır). İçeriği:
- kurulum: iPhone'da Safari ile "Ana Ekrana Ekle", Android'de APK ya da "Uygulamayı yükle";
- bakılacaklar: ilk 10 bölüm, Takım, Kamp;
- çökme raporu: kişisel veri yok;
- Ayarlar › Geri bildirim gönder;
- iletişim: `{ILETISIM_EPOSTA}` yer tutucusu.

Sunucu adresi metinde yok; adres oyunculara ayrıca gönderilir.
