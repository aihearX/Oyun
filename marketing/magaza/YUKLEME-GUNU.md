# Yükleme günü: ODİ: Sesin Yolu 1.0.0'ı App Store ve Google Play'e gönderme

Durum (2026-11-06): **şirket geliştirici hesapları açık** (Apple Developer, Google Play Console). **Expo ve RevenueCat hesapları
bugün açılacak.** **Uygulama içi satın alma ilk sürümde açık.** **Sürüm 1.0.0.**

**Gerçekçi beklenti.** "Yarın yüklemek" = yarın **incelemeye göndermek**. Yayın, mağazaların onayından sonradır:
- Apple incelemesi çoğu zaman 1–2 gün sürer (bazen birkaç saat, bazen daha uzun). İlk uygulama içi ürünler sürümle birlikte incelenir;
  ürünlerden biri reddedilirse sürüm de bekler.
- Google'da yeni uygulamanın ilk incelemesi birkaç gün sürebilir (7 güne kadar uzayabilir).
- "Yönetilen yayın" açık olursa iki mağazada da onaydan sonra uygulama siz **Yayınla** deyene kadar görünmez.
- Gün içinde en uzun bekleyişler: Expo bulut derleme sırası (ücretsiz hesapta 15–60 dk ve daha fazla), Apple'ın derlemeyi işlemesi
  (TestFlight'a düşmesi 10–30 dk), Paid Apps sözleşmesinin "Etkin" olması (banka/vergi girildikten sonra saatler, bazen günler) ve
  RevenueCat'in Google hizmet hesabını tanıması (Google tarafında 36 saate kadar sürebilir).

Bağlantılar: liste metinleri [`metinler.json`](metinler.json) · Google beyanları [`google-play.md`](google-play.md) · Apple beyanları
ve inceleme notları [`app-store.md`](app-store.md) · ürünler [`iap-urunler.md`](iap-urunler.md) / [`iap-urunler.json`](iap-urunler.json) ·
ekran görüntüleri [`docs/yonetim/magaza-ekran.md`](../../docs/yonetim/magaza-ekran.md) · genel liste [`YAYIN-LISTESI.md`](YAYIN-LISTESI.md).

İşaretler: **[S]** sahip yapar (kimlik, imza, ödeme; ajan yapamaz) · **[A]** ajan yapabilir (aşağıdaki erişim verilirse) ·
**[S/A]** ikisinden biri.

> Kural: anahtar dosyaları (.p8, .json), şifreler, gizli API anahtarları, sunucu IP'si ve yönetici kodu **depoya, sohbete, iş
> listesine yazılmaz**. Komutlardaki `ALAN-ADI`, `appl_...`, `goog_...`, `C:\odi-anahtarlar\...` yer tutucudur; kendi değerinizi
> yalnız kendi bilgisayarınızda yazın.

---

## 0. Başlamadan önce (15 dk)

**[S] Ajana verilecek, depoya yazılacak bilgiler** (herkese açık sayfalarda görünür; gizli değildir). Bunlar gelmeden `/gizlilik`
sayfasında "eklenecek" yazar ve mağaza formları eksik kalır:

| Bilgi | Nerede kullanılır | Yer tutucu |
|---|---|---|
| Şirket unvanı (ticaret sicilindeki gibi) | gizlilik sayfası, telif (`2026 {YAYINCI_UNVAN}`) | `{YAYINCI_UNVAN}` |
| Şirket adresi | gizlilik sayfası | `{YAYINCI_ADRES}` |
| Herkese açık iletişim e-postası (kişisel e-posta değil; ör. destek@şirket-alanı) | gizlilik, hesap silme sayfası, iki mağazanın iletişim alanı | `{ILETISIM_EPOSTA}` |
| Sunucunun Oracle bölgesi (ör. "Frankfurt, Almanya") | gizlilik sayfası § 4 | `{SUNUCU_BOLGESI}` |
| Sunucu adresi (alan adı) | mağaza formlarındaki bağlantılar, EAS ortam değişkeni | `ALAN-ADI` / `<adres>` |

→ **[A]** `apps/web/src/yasal/ayar.json` alanlarını doldurur, gönderir; sonra `node tools/magaza/denetle.mjs --yayin --adres ALAN-ADI
--eposta ...` 0 hata vermelidir (bugün yasal alanlar boş olduğu için `--yayin` hata verir; bu beklenen).

**[S] Ayrıca sizin elinizde olacaklar (depoya yazılmaz):** Apple inceleme ekibinin arayacağı kişi (ad, telefon), şirket banka
hesabı (IBAN), vergi bilgileri, Apple ve Google hesaplarının iki adımlı doğrulama telefonu.

**[S] Bilgisayar hazırlığı (Windows, bir kez):**
1. [nodejs.org](https://nodejs.org) › **Node.js 22 LTS** kurun (kurulumda varsayılanlar).
2. Depo: GitHub Desktop › File › Clone repository › `aihearX/Oyun` (zaten varsa **Fetch origin** › **Pull**).
3. **PowerShell**'i açın (Başlat › "PowerShell"). Depo klasörüne girip paketleri kurun:
   ```powershell
   cd $HOME\Documents\GitHub\Oyun
   npm ci
   ```
   Görmeniz gereken: birkaç dakika sonra "added … packages". `npx` ilk kez "Ok to proceed?" derse `y` + Enter.
   PowerShell "running scripts is disabled" derse bütün komutlarda `npx` yerine `npx.cmd` yazın.
4. Anahtar dosyaları için depo **dışında** bir klasör: `mkdir C:\odi-anahtarlar` (GitHub klasörünün içine koymayın).

**[S] Sürüm denetimi:** `apps\mobile\app.json` içinde `"version": "1.0.0"` olmalı (2026-11-06'da depoda hâlâ `0.1.0`; 1.0.0'a
geçişi kod tarafı yapıyor; GitHub Desktop'ta **Pull** sonrası denetleyin, değilse ajana söyleyin). Derleme numarasını EAS kendisi verir.

---

## A. Expo hesabı, `eas init`, ortam değişkenleri (30 dk) [S, sonra A]

1. **[S]** [expo.dev/signup](https://expo.dev/signup) › hesap açın (e-posta doğrulaması). İsterseniz bir **Organization** açın (şirket
   adına; ekip üyesi eklenebilir). Ücretsiz plan yeter; derleme sırası uzunsa o ay için ücretli plan sırayı kısaltır (isteğe bağlı).
2. **[S]** PowerShell'de giriş ve proje bağlama:
   ```powershell
   cd $HOME\Documents\GitHub\Oyun\apps\mobile
   npx eas-cli login
   npx eas-cli whoami
   npx eas-cli init
   ```
   `whoami` hesap adınızı yazar. `init` "Create a project for @hesap/odi?" diye sorar → **Yes**. Görmeniz gereken: `app.json`
   içinde `extra.eas.projectId` dolar (gizli değildir). GitHub Desktop'ta bu değişikliği "EAS proje kimliği" notuyla **Commit** ›
   **Push** (ya da ajana söyleyin).
3. **[S/A]** Ortam değişkenleri (depoya yazılmaz; EAS'ta durur). `ALAN-ADI` yerine sunucu alan adı. RevenueCat anahtarları D
   adımında çıkar; şimdilik yalnız ilk satırı girin, D'den sonra son iki satırı:
   ```powershell
   npx eas-cli env:create --environment preview --environment production --name EXPO_PUBLIC_ODI_SERVER --value "wss://ALAN-ADI" --visibility plaintext
   npx eas-cli env:create --environment preview --environment production --name EXPO_PUBLIC_REVENUECAT_IOS --value "appl_..." --visibility plaintext
   npx eas-cli env:create --environment preview --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID --value "goog_..." --visibility plaintext
   npx eas-cli env:list --environment production
   ```
   Görmeniz gereken: son komut üç değişkeni listeler. **Üçü de yokken üretim derlemesi almayın:** sunucu adresi yoksa takım/sohbet
   çalışmaz, RevenueCat anahtarı yoksa mağaza "bu sürümde kapalı" der ve Apple ürünleri bulamadığı için reddeder.
4. **[S]** Ajanın derleme yapabilmesi için (isteğe bağlı): expo.dev › Account settings › **Access tokens** › Create (ad: `odi-ajan`).
   Belirteci sohbete yazmayın; bkz. "Ajanın yapabilecekleri".

## B. App Store Connect: uygulama kaydı, sözleşme, banka, vergi (45 dk) [S]

1. **Bundle ID:** [developer.apple.com](https://developer.apple.com/account) › Certificates, Identifiers & Profiles › **Identifiers**
   › "+" › App IDs › App › Description `ODI Sesin Yolu`, **Explicit** Bundle ID `com.aiheartech.odi` › Capabilities'de **In-App
   Purchase** işaretli (varsayılan) › Continue › Register. (Atlanırsa ilk `eas build -p ios` da oluşturur.)
2. **Uygulama kaydı:** [appstoreconnect.apple.com](https://appstoreconnect.apple.com) › **Uygulamalar** › "+" › **Yeni Uygulama**:
   Platform **iOS** · Ad `ODİ: Sesin Yolu` · Birincil dil **Türkçe** · Bundle ID `com.aiheartech.odi` · SKU `odi-ios` · Kullanıcı
   erişimi **Tam erişim** › Oluştur. Ad başkası tarafından alınmışsa hata verir: o zaman `ODİ: Sesin Yolu - Kulak` gibi bir ad deneyin
   ve ajana haber verin (metinler buna göre güncellenir).
   Görmeniz gereken: uygulama sayfası açılır; **Uygulama Bilgileri** › Genel Bilgiler › **Apple Kimliği** (10 haneli sayı). Bu sayı
   gizli değildir: `apps\mobile\eas.json` içindeki `ASC-UYGULAMA-NO-YAZILACAK` yerine yazılır (siz ya da ajan).
3. **Sözleşmeler:** App Store Connect › **İş** (Business; eski adı "Anlaşmalar, Vergi ve Bankacılık") › **Paid Apps** sözleşmesi ›
   kabul (hesap sahibi rolü gerekir). Sonra **Banka hesabı** (şirket IBAN'ı, hesap sahibi adı şirket unvanıyla aynı) ve **Vergi
   formları** (şirket için W-8BEN-E; Türkiye–ABD vergi anlaşması). Görmeniz gereken: Paid Apps durumu önce "İşleniyor", sonra
   **"Etkin"**. Etkin olmadan uygulama içi ürünler "Gönderilmeye Hazır" olmaz ve TestFlight'ta satın alma denenemez.
4. **Small Business Program:** [developer.apple.com/app-store/small-business-program](https://developer.apple.com/app-store/small-business-program/)
   › Enroll (yıllık gelir 1 milyon USD altı → komisyon %15). Paid Apps sözleşmesinden sonra; gönderimi beklemez.
5. **Kullanıcılar ve Erişim** › **Entegrasyonlar** › **App Store Connect API** › Takım Anahtarları › "+" (ad `odi-gonderim`, rol
   **App Manager**). `AuthKey_XXXXXXXXXX.p8` dosyasını indirin (**yalnız bir kez** indirilebilir) → `C:\odi-anahtarlar\`. Sayfadaki
   **Key ID** ve **Issuer ID**'yi not edin (gizli tutun). Aynı sayfada **In-App Purchase** sekmesinden ikinci bir anahtar (RevenueCat
   için, D adımı) oluşturup indirin.

## C. Play Console: uygulama oluşturma, ödeme profili, uygulama içeriği (60 dk) [S, formlar S/A]

1. [play.google.com/console](https://play.google.com/console) › **Uygulama oluştur**: ad `ODİ: Sesin Yolu` · varsayılan dil
   **Türkçe – tr-TR** · **Oyun** · **Ücretsiz** · beyanlar (Geliştirici Program Politikaları, ABD ihracat yasaları) işaretli ›
   Uygulama oluştur. Görmeniz gereken: uygulamanın **Kontrol paneli**.
2. **Ödeme profili:** Console › Ayarlar › **Ödeme profili** (Payments profile): şirket bilgileri, banka hesabı, vergi bilgileri.
   Profil yoksa uygulama içi ürün oluşturulamaz. Hizmet bedeli ilk 1 milyon USD için %15 (hesap gruplaması formu Console'da).
3. **Uygulama içeriği** (Kontrol paneli › "Uygulamanızı ayarlayın"; her biri **Kaydet** › "Tamamlandı" yeşil). Cevapların hepsi
   [`google-play.md`](google-play.md) içinde, soru sırasıyla:
   - Gizlilik politikası: `https://ALAN-ADI/gizlilik`
   - Uygulama erişimi: "Bütün işlevler özel erişim gerektirmeden kullanılabilir" + İngilizce not (google-play.md "Uygulama erişimi")
   - Reklamlar: **Hayır**
   - İçerik derecelendirmesi (IARC): kategori **Oyun**, cevaplar tablosu google-play.md; e-posta `{ILETISIM_EPOSTA}`
   - Hedef kitle: **13–15, 16–17, 18+**; 13 yaş altı seçilmez; Aileler programı yok. (Yaş ekranı kararı YN-034 hâlâ açık; bu
     gönderim "şimdilik yok" varsayımıyla yapılır.)
   - Haber uygulaması **Hayır** · Devlet uygulaması **Hayır** · Finansal özellikler **yok** · Sağlık uygulaması **değil**
   - Veri güvenliği: google-play.md "Veri güvenliği" tabloları (Önizleme'de "Toplanan veriler" listesi tabloyla aynı olmalı)
   - Hesap silme: `https://ALAN-ADI/hesap-sil`
   - Reklam kimliği: **Hayır**
4. **Mağaza ayarları:** Kategori **Macera**, etiketler (google-play.md), iletişim e-postası `{ILETISIM_EPOSTA}`, web sitesi isteğe bağlı.
5. **Ana mağaza girişi** (Büyüme › Mağazada varlık): ad, kısa ve tam açıklama `metinler.json` › `google` › `tr-TR`; uygulama simgesi
   `marketing\magaza\play-ikon-512.png`; öne çıkan görsel `marketing\magaza\play-tanitim-1024x500.png`; telefon ekran görüntüleri
   `magaza-ekranlar.zip` › `android-1080x1920\` (2–8 kare; sıra önerisi magaza-ekran.md: 01, 03, 02, 05, 06, 08, 09, 07).
   **Dil ekle** › İngilizce (ABD) › `metinler.json` › `google` › `en-US` (aynı görseller).
6. **Yayın ayarları:** Yayınlama özeti › **Yönetilen yayın** açık. Ülkeler (Üretim › Ülkeler/bölgeler): öneri yalnız **Türkiye**.

## D. RevenueCat kurulumu (45 dk; Google kısmı 36 saate kadar bekleyebilir) [S, sonra A]

1. **[S]** [app.revenuecat.com](https://app.revenuecat.com) › hesap › **Project** oluştur: `ODİ`.
2. **[S]** Project › **Apps** › "+" › **App Store**: ad `ODİ iOS`, Bundle ID `com.aiheartech.odi`; **In-App Purchase Key**: B5'teki
   ikinci .p8 dosyası + Key ID + Issuer ID; **App Store Connect API**: B5'teki ilk anahtar (ürünleri içe aktarmak için). Kaydet.
3. **[S]** "+" › **Play Store**: ad `ODİ Android`, paket `com.aiheartech.odi`; **Service Account credentials JSON**: RevenueCat'in
   kendi rehberindeki adımlarla (Google Cloud › hizmet hesabı › JSON; Play Console › Kullanıcılar ve izinler › davet: finans
   verilerini görüntüleme, siparişleri ve abonelikleri yönetme). Görmeniz gereken: "Valid credentials" (Google'da hemen değil;
   saatler sürebilir; beklerken devam edin).
4. **[S/A]** Ürünler: G adımında mağazalarda oluşturulduktan sonra RevenueCat › Product catalog › **Products** › **Import**
   (iki mağaza). 7 kimlik: `odi.baslangic`, `odi.kristal.1`, `odi.kristal.2`, `odi.kristal.3`, `odi.hiz.1`, `odi.hiz.2`, `odi.pass`.
   **Offering ve Entitlement gerekmez** (oyun ürünü kimlikle çeker); Sezon Kartı'nı bir Entitlement'a **bağlamayın** (RevenueCat
   yenilenmeyen aboneliği süresiz açık sayar). **Play ürün türü:** Products listesinde Android `odi.baslangic` › tür **Non-consumable**
   (RevenueCat tüketmez); öteki altı Android ürünü **Consumable** kalır (Sezon Kartı dahil). iOS ürünlerinin türü App Store'dan gelir
   (H2). Tablo: [`iap-urunler.md`](iap-urunler.md) "Ürün türleri".
   **Restore behavior** (Project settings › General): varsayılan **Transfer to new App User ID** kalsın (sahipliği sunucu belirler).
5. **[S]** **Herkese açık SDK anahtarları:** Project settings › **API keys**: `appl_...` (iOS) ve `goog_...` (Android) → A3'teki son
   iki komut.
6. **[S]** **Gizli anahtar (sunucu):** API keys › **+ New secret API key** › API sürümü **V1** (sunucu `GET /v1/subscribers` kullanır)
   › ad `odi-sunucu`. Anahtarı (`sk_...`) yalnız sunucuya yazın, sohbete değil. Sunucuya SSH ile bağlanın (Oracle konsolundaki
   kullanıcı ve IP; burada yazılmaz):
   ```powershell
   ssh KULLANICI@SUNUCU-ADRESI
   ```
   Sunucuda:
   ```bash
   sudo nano /etc/odi/odi.env
   ```
   En alta tek satır ekleyin: `REVENUECAT_API_KEY=sk_...` → Ctrl+O, Enter, Ctrl+X. Sonra:
   ```bash
   sudo systemctl restart odi
   sudo odi-durum
   ```
   Görmeniz gereken: `odi-durum` servisi "çalışıyor" gösterir. (Satır `odi-guncelle` ve `kur.sh` sonrasında korunur.)

## E. Sunucuyu güncelle ve yasal sayfaları denetle (20 dk) [S/A]

Önce 0. adımdaki bilgiler `ayar.json`a yazılmış ve main'e gönderilmiş olmalı. Sunucuda:
```bash
sudo odi-guncelle
sudo odi-durum
```
Görmeniz gereken: `odi-guncelle` derler, testleri çalıştırır, yeni göçleri (veritabanı değişiklikleri; ekim sonundan beri eklenenler) uygular
ve "yeni sürüm" der; bir şey düşerse eski sürüm çalışmaya devam eder (hata metnini ajana iletin). Sonra tarayıcıda:
- `https://ALAN-ADI/gizlilik` · `https://ALAN-ADI/en/privacy` · `https://ALAN-ADI/hesap-sil`: hiçbir yerde "eklenecek" yazmamalı;
  unvan, adres, e-posta ve bölge doğru.
- **İnceleme süresince** (gönderimden yayına kadar) `odi-guncelle` çalıştırmayın: inceleyici sunucuya bağlanamazsa "eksik uygulama"
  reddi gelebilir.

## F. Üretim derlemeleri (bulutta 30–90 dk) [S/A]

```powershell
cd $HOME\Documents\GitHub\Oyun\apps\mobile
npx eas-cli env:list --environment production
npx eas-cli build -p android --profile production
npx eas-cli build -p ios --profile production
```
- Android: "Generate a new Android Keystore?" → **Yes** (anahtarı EAS saklar). Bitince ekranda `.aab` bağlantısı.
- iOS: "Do you want to log in to your Apple account?" → **Yes** → Apple Kimliği, şifre, iki adımlı kod → takım olarak **şirket
  ekibini** seçin → "Generate a new Apple Distribution Certificate?" **Yes** → "Generate a new Apple Provisioning Profile?" **Yes**.
  Bitince `.ipa` bağlantısı.
- Görmeniz gereken: expo.dev › proje › **Builds** sayfasında iki derleme "Finished", sürüm **1.0.0**. Hata olursa derleme
  sayfasının bağlantısını ajana iletin.

## G. Android: ilk AAB'yi İç test kanalına elle yükle, ürünleri oluştur (45 dk) [S, ürünler S/A]

1. expo.dev › Builds › Android derlemesi › **Download** (`.aab`).
2. Play Console › **Test** › **Dahili test** › **Yeni sürüm oluştur** › Play Uygulama İmzalama'yı **kabul** › `.aab` dosyasını
   sürükleyin › sürüm adı `1.0.0 (…)` kendiliğinden › sürüm notu: `metinler.json` › `google` › `tr-TR` › `releaseNotes` › **Sonraki**
   › **Kaydet ve yayınla**. Test kullanıcıları sekmesinde bir e-posta listesi (kendi Google hesabınız) › "Bağlantıyı kopyala".
   (İlk AAB'yi Google'ın API'si kabul etmez; bu yüzden elle. Sonrakileri `eas submit -p android` gönderebilir.)
3. **Uygulama içi ürünler:** Para kazanma › **Ürünler** › **Uygulama içi ürünler** (Console "Tek seferlik ürünler" diyebilir) ›
   **Ürün oluştur**, 7 kez: kimlik, ad, açıklama `iap-urunler.json` (`id`, `tr.ad`, `tr.uzun`), fiyat **TRY** (`fiyatTry`) ›
   **Etkinleştir**. Console "satın alma seçeneği" isterse tür "Satın al", fiyat aynı. Ürün kimliği sonradan değiştirilemez: harfi
   harfine `iap-urunler.json`. Yedisi de **tek seferlik ürün** (Sezon Kartı dahil; **Abonelikler** sayfasında oluşturulmaz: Play'de
   yenilenmeyen abonelik yok). Tüketilip tüketilmemesi Play'de değil RevenueCat'te seçilir (D4: yalnız `odi.baslangic` Non-consumable).
4. **Lisans testi:** Ayarlar › **Lisans testi** › kendi Google hesabınızı ekleyin (gerçek para çekilmez).
5. Telefonda 2. maddedeki test bağlantısını açın › "Test kullanıcısı ol" › Play'den kurun. Denetim: açılış, 1. bölüm, haritada
   bağlantı noktası **yeşil**, 6 bölüm sonra Profil › Mağaza'da fiyatlar, bir ürün satın alma (test kartı) → kristal hesapta.

## H. iOS: `eas submit` → TestFlight, satın alma denemesi (60 dk) [S/A]

1. `apps\mobile\eas.json` içinde `ASC-UYGULAMA-NO-YAZILACAK` yerine B2'deki Apple Kimliği (sayı). Sonra PowerShell'de (yollar ve
   kimlikler sizin; bu üç satır yalnız açık pencerede geçerli, hiçbir yere kaydedilmez):
   ```powershell
   $env:ODI_ASC_API_KEY_PATH = "C:\odi-anahtarlar\AuthKey_XXXXXXXXXX.p8"
   $env:ODI_ASC_API_KEY_ID = "XXXXXXXXXX"
   $env:ODI_ASC_API_KEY_ISSUER_ID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   cd $HOME\Documents\GitHub\Oyun\apps\mobile
   npx eas-cli submit -p ios --profile production --latest
   ```
   Görmeniz gereken: "Submitted your app to Apple App Store Connect"; 10–30 dk sonra App Store Connect › **TestFlight** sekmesinde
   derleme "İşleniyor" → "Test edilmeye hazır". Şifreleme sorusu sorulmaz (`ITSAppUsesNonExemptEncryption: false`).
2. **Uygulama içi ürünler** (App Store Connect › uygulama › **Uygulama İçi Satın Almalar** › "+"), 7 kez. **Tür** (`iap-urunler.json`
   › `tur`; sonradan değiştirilemez): `odi.baslangic` **Tüketilmeyen** (Non-Consumable); `odi.pass` **Otomatik Yenilenmeyen Abonelik**
   (Non-Renewing Subscription; App Store Connect bunu da Uygulama İçi Satın Almalar sayfasında "+" ile açar, Abonelikler sayfasında
   değil); öteki beşi **Tüketilebilir** (Consumable). Referans adı = TR ad, Ürün Kimliği `iap-urunler.json` › `id`; **Fiyat**: temel ülke Türkiye, `fiyatTry`'ye en yakın nokta;
   **Yerelleştirme** Türkçe (`tr.ad`, `tr.aciklama`) ve İngilizce (`en.ad`, `en.aciklama`); **İnceleme bilgileri**: ekran görüntüsü
   `magaza-ekranlar.zip` › `iap-inceleme\<ürün kimliği>.png`, not `iap-urunler.md` "Apple inceleme ekran görüntüsü ve notu".
   Görmeniz gereken: her ürün **"Gönderilmeye Hazır"** (Paid Apps sözleşmesi Etkin değilse "Eksik Meta Veri" kalır).
3. **TestFlight dahili test:** TestFlight › Dahili Test › "+" grup › kendinizi ekleyin. iPhone'da **TestFlight** uygulaması › ODİ ›
   Yükle. TestFlight'ta satın almalar ücretsizdir (Apple hesabınızla, "Sandbox" ortamı); ayrı sandbox hesabı gerekmez.
4. Denetim (her ürün bir kez, en az Başlangıç Paketi ve Sezon Kartı): 6 bölüm › Profil › Mağaza → fiyatlar mağazadan gelir (TL
   işaretiyle, "liste fiyatı" notu yok) → bir fiyata dokun → aylık sınır **500 TL** → "Sınırı kaydet" → ödeme penceresi
   ("[Environment: Sandbox]") → onay → "… hesabında" ve kristal artar. İkinci kez Başlangıç Paketi düğmesi **"Alındı"**. Satın alma
   sunucuya yansımazsa (kristal gelmezse) D6 eksiktir. Sezon Kartı'ndan sonra ödül kutusunda 30 kristal olmalı (yenilenmeyen
   abonelik RevenueCat'te `non_subscriptions` altında; gelmezse ajana iletin). Sonra mağazanın altındaki **"Satın alımları geri
   yükle"** → "Zaten bu hesapta: Başlangıç Paketi, Odi Sezon Kartı" yazmalı, kristal artmamalı. Yeniden deneme denetimi (isteğe
   bağlı): uçak kipinde değil, telefon bağlıyken sunucu kapalıysa ödeme sonrası "Ödeme alındı; bağlantı dönünce hesabına işlenecek"
   kartı çıkar, sunucu dönünce ürün kendiliğinden gelir. Sonucu ve ekran görüntüsünü ajana iletin.

## I. Liste metinleri, ekran görüntüleri, beyanlar (Apple, 45 dk) [S/A]

App Store Connect › uygulama › **1.0 Gönderime Hazırlanıyor** sürümü (sürüm adı **1.0.0** yazın):
- **Ekran görüntüleri:** 6,9" ekran → `ios-6.9-1320x2868\` (en çok 10; sıra magaza-ekran.md: 01, 03, 02, 05, 06, 08, 09, 07, 10);
  6,5" ekran → `ios-6.5-1284x2778\` (aynı sıra). iPad yok. `12-magaza.png` vitrine konmaz.
- **Tanıtım metni, Açıklama, Anahtar kelimeler, Destek URL'si:** `metinler.json` › `apple` › `tr` (açıklama = Google TR uzun
  açıklaması; `<adres>` ve `{ILETISIM_EPOSTA}` doldurulmuş). Sağ üstten **İngilizce (ABD)** yerelleştirme ekleyip `en-US` alanları.
- **Derleme:** "Derleme ekle" › H1'deki derleme. **Uygulama İçi Satın Almalar ve Abonelikler** bölümünde 7 ürünü seçin (ilk ürünler
  sürümle birlikte gönderilir).
- **Uygulama İnceleme bilgileri:** oturum açma **gerekmez**; iletişim adı/telefonu/e-posta; Notes = `app-store.md` İngilizce metin.
- **Sürüm yayını:** **"Bu sürümü elle yayınla"** (yönetilen yayın).
- **Uygulama Bilgileri** (sol menü): Kategori Oyunlar › Macera (ikincil Aksiyon); İçerik hakları: üçüncü taraf içerik yok;
  **Yaş derecelendirmesi** anketi `app-store.md` tablosu (sonuç 13+'tan düşükse "geçersiz kıl" ile 13+); telif `2026 {YAYINCI_UNVAN}`.
- **Uygulama Gizliliği:** gizlilik politikası URL'si + "veri türleri" `app-store.md` tablosu (izleme yok) › **Yayınla**.
- **Fiyatlandırma ve Kullanılabilirlik:** Ücretsiz; ülkeler (öneri yalnız Türkiye).

## J. İncelemeye gönder (15 dk) [S]

- **Apple:** sürüm sayfası › sağ üstte **İncelemeye Ekle** › **İncelemeye Gönder**. Görmeniz gereken: durum "İnceleme Bekleniyor".
  Onaylanınca "Geliştirici Yayınını Bekliyor" → hazır olduğunuzda **Bu sürümü yayınla**.
- **Google:** Test › Dahili test sürümünü **Üretim**'e yükselt (Sürüm › "Sürümü yükselt" › Üretim) ya da Üretim › Yeni sürüm
  (aynı AAB) › ülkeler › **İncelemeye gönder** (Yayınlama özeti › "Değişiklikleri incelemeye gönder"). Şirket hesabında "12 test
  kullanıcısı × 14 gün kapalı test" şartı yok. Görmeniz gereken: "İnceleniyor". Onaydan sonra yönetilen yayında **Yayınla**.
- Reddedilirse: ret metnini olduğu gibi ajana iletin (kimlik/ödeme bilgisi varsa onları çıkarıp); cevap ve düzeltme ajan işi.

---

## Ajanın yapabilecekleri ve bunun için gereken erişim

Ajan (Claude) şu adımları sizin yerinize yapabilir: **A3** ortam değişkenleri, **F** derlemeler, **H1** `eas submit` (iOS) ve
sonraki Android gönderimleri, **I** liste metinleri/ekran görüntüleri/yerelleştirme, **H2** uygulama içi ürünlerin App Store
tarafı (API ile), ürün içe aktarma, `ayar.json` ve `eas.json` (`ascAppId`) değişiklikleri, reddedilme cevapları. Ajan **yapamaz**:
hesap açma, sözleşme/banka/vergi, kimlik doğrulama, Play'de uygulama oluşturma ve ilk AAB yüklemesi, RevenueCat'te Google hizmet
hesabı izinleri, sunucuya gizli anahtar yazma (sunucu erişimi verilmediyse), son "Yayınla".

Erişim **sohbete yapıştırılmaz**. Claude oturumunun ortam ayarlarından (oturum başlığındaki ortam menüsü › Düzenle › ortam
değişkenleri / ağ gizlileri) eklenir; yeni oturumda geçerli olur:

| Değişken | Ne | Nereden |
|---|---|---|
| `EXPO_TOKEN` | Expo erişim belirteci | A4 |
| `ODI_ASC_API_KEY_ID`, `ODI_ASC_API_KEY_ISSUER_ID` | App Store Connect API anahtarı kimlikleri | B5 |
| `ODI_ASC_API_KEY_P8_B64` | .p8 dosyasının base64 hâli (ajan oturumda depo dışına `chmod 600` dosya olarak açar) | aşağıdaki komut |
| `ODI_PLAY_SA_JSON_B64` | Play gönderim hizmet hesabı JSON'unun base64 hâli (izinler: test kanallarına ve üretime sürüm, mağaza girişi; finans gerekmez) | Google Cloud › hizmet hesabı › JSON; Play Console › Kullanıcılar ve izinler |

Dosyayı base64'e çevirip panoya almak (PowerShell; çıktıyı ekrana yazmaz):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\odi-anahtarlar\AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard
```
Sonra panodakini ortam ayarındaki değer kutusuna yapıştırın. Ajanın ortamının `expo.dev`, `api.expo.dev`, `api.appstoreconnect.apple.com`
ve `androidpublisher.googleapis.com` adreslerine çıkabilmesi gerekir (ortamın ağ ayarı). Erişim gelmezse ajan bu adımları sizin
çalıştıracağınız komutlar olarak hazırlar.

## Yarın için kalan riskler (kısa)
- Paid Apps sözleşmesi "Etkin" olmazsa uygulama içi ürünler gönderilemez → seçenek: o gün yalnız TestFlight + Play iç test, gönderim
  ertesi gün.
- RevenueCat Google kimliği geç tanınırsa Android satın alma denemesi gecikir; iOS etkilenmez.
- `app.json` sürümü 1.0.0 değilse mağazada yanlış sürüm görünür (derlemeden önce denetleyin).
- Ad çakışması (App Store'da "ODİ: Sesin Yolu" alınmış olabilir) → B2.
- İnceleme sırasında sunucu kapalı/güncelleniyor → 2.1 reddi (E).
- Google "çocukların ilgisini çekebilir" incelemesi yaş ekranı isteyebilir (YN-034) → güncellemeyle eklenir.
