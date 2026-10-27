# ODİ: Sesin Yolu — mobil kabuk (Expo SDK 58)

Phaser 3 bölümleri bir **Expo DOM bileşeni** (`'use dom'`, WebView) içinde çalışır; harita, sonuç, yetenekler ve ayarlar
React Native ekranlarıdır (expo-router). Bölüm üretimi (`@odi/level-gen`) native tarafta yapılır, `LevelSpec` JSON olarak
DOM bileşenine prop geçer; oyun olayları (`ready`, `haptic`, `levelComplete`, …) `onEvent` ile native'e döner (haptik, sonuç).

```
apps/mobile/
  app.json            isim "ODİ: Sesin Yolu", slug odi, scheme odi, bundle id com.aiheartech.odi, dikey, açık tema
  metro.config.js     monorepo: kök node_modules paylaşımı, @odi/* → packages/*/src
  src/app/            expo-router ekranları: index (harita), oyun/[n] (bölüm), sonuc, yetenekler, ayarlar
  src/dom/LevelDom.tsx  'use dom' bileşeni: startLevel(...) → Phaser; window.__odi test köprüsü
  src/store/          zustand + persist(AsyncStorage): progress, coins, xp, skills, sounds, haptics, failStreak, recentStars, streak
  src/ui/             tema (apps/web/styles.css ile aynı renkler) ve küçük bileşenler + ErrorBoundary
  (ikon/açılış görseli: kökte `tools/ikon-uret.mjs`, `npm run icons` aynı betiği çağırır)
  tools/domcheck.mjs    www.bundle DOM sayfasını Playwright'ta stub köprüyle açıp 1. bölümü botla oynatır
  __tests__/            jest-expo duman testi (harita)
```

## Windows'ta çalıştırma (iPhone + Expo Go SDK 58)
```bat
cd C:\Users\sebah\Desktop\Oyun
git pull
npm install --legacy-peer-deps
cd apps\mobile
npx expo start
```
- Telefonda **Expo Go (SDK 58)** ile QR kodu okut. Expo Go yalnız kendi SDK'sındaki projeyi açar: telefondaki Expo Go
  SDK 58 ise proje de SDK 58 olmalı (SDK yükseltmesinden sonra `node_modules` silinip yeniden kurulmalı, Metro `-c` ile başlatılmalı). Telefon ve bilgisayar **aynı Wi-Fi**'da olmalı.
- QR açılmıyorsa / "yükleniyor" takılıyorsa: `npx expo start --tunnel` (ngrok; ilk seferde paket kurar, biraz yavaştır).
- Önbellek sorunu: `npx expo start -c`.
- İlk bölüm açılışında WebView Phaser paketini (≈1,5 MB) bilgisayardan çeker: 10-20 sn normaldir. 30 sn'de hazır olmazsa
  kabuk "Oyun yüklenemedi" kartı gösterir; **Tekrar dene** çoğu zaman yeter.
- Windows güvenlik duvarı Node'a LAN izni istiyorsa izin ver (Metro 8081 ve DOM sayfası aynı sunucudan gelir).

## Komutlar (apps/mobile içinde)
| Komut | Ne yapar |
|---|---|
| `npx expo start` | Geliştirme sunucusu (Expo Go) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | jest-expo duman testi |
| `npm run export:ios` | `expo export --platform ios --output-dir dist` → `dist/www.bundle/*.html` (DOM paketi) |
| `PLAYWRIGHT_CHROMIUM=... npm run domcheck -- --level 1 --ts 2` | export edilen DOM sayfasını Chromium'da botla oynatır, `tools/out/domcheck-L01-*.png` |
| `npm run icons` | `assets/` ikon/splash dosyalarını yeniden üretir |

## EAS build (bulut; Mac gerekmez)
1. `npm i -g eas-cli` ve `eas login` (Expo hesabı).
2. `apps/mobile` içinde `eas init` → `app.json > extra.eas.projectId` dolar.
3. iOS: `eas build --platform ios --profile preview` (dahili dağıtım / cihaz kaydı) veya `--profile production` (TestFlight).
   Apple Developer hesabı gerekir; sertifika ve profil EAS tarafından bulutta üretilir, Mac gerekmez.
4. Android: `eas build --platform android --profile preview` → APK; `--profile production` → mağaza için AAB.
- Expo SDK 58 için Node 22.13+ gerekir; `eas.json` bütün profillerde bulut derlemesinin Node sürümünü `22.22.0`'a sabitler (`base` profili).
- Monorepo notu: EAS kökü workspace olarak algılar; kökteki `.npmrc` (`legacy-peer-deps=true`) bulut derlemesinde `npm install`'ın React sürüm uyarısında durmamasını sağlar.

### Mağaza derlemesi: ortam değişkenleri (depoya yazılmaz)
Depo herkese açık: sunucu adresi ve anahtarlar `eas.json`a yazılmaz. Derleme profilleri `environment` alanıyla EAS ortam
değişkenlerini alır (`development`, `preview`, `production`). Bir kez tanımlanır:

```bash
cd apps/mobile
# oyun sunucusu (Caddy arkasındaki adres; bkz. docs/18-sunucu-kurulum.md "Hazır: wss://…")
eas env:create --environment preview --environment production --name EXPO_PUBLIC_ODI_SERVER --value "wss://<adres>" --visibility plaintext
# RevenueCat herkese açık SDK anahtarları (RevenueCat › Project settings › API keys: appl_…, goog_…)
eas env:create --environment preview --environment production --name EXPO_PUBLIC_REVENUECAT_IOS --value "appl_…" --visibility plaintext
eas env:create --environment preview --environment production --name EXPO_PUBLIC_REVENUECAT_ANDROID --value "goog_…" --visibility plaintext
eas env:list --environment production   # derlemeden önce denetim: üç değişken de görünmeli
```

- `EXPO_PUBLIC_*` değerleri uygulama paketine gömülür (gizli değildir); yine de depoya yazılmaz. RevenueCat'in **gizli** anahtarı
  (`sk_…`) uygulamaya hiç girmez: yalnız sunucuda `/etc/odi/odi.env` → `REVENUECAT_API_KEY`.
- `EXPO_PUBLIC_ODI_SERVER` yoksa mağaza uygulaması sosyal sunucuya bağlanamaz (yalnız tek başına oyun); `EXPO_PUBLIC_REVENUECAT_*`
  yoksa gerçek satın alma açılmaz. Önceki `eas.json` yer tutucusu (`wss://SUNUCU-ADRESI-YAZILACAK.invalid`) kaldırıldı:
  `eas.json`daki `env` EAS ortam değişkenini ezerdi.

### Mağazaya gönderim (`eas submit`)
`eas.json > submit.production` anahtar dosyalarını ve kimlikleri **ortam değişkeninden** okur (`$AD` sözdizimi; eas-cli
`ascApiKeyPath`, `ascApiKeyId`, `ascApiKeyIssuerId`, `serviceAccountKeyPath` alanlarında değişkeni açar). Değişken tanımlı
değilse alan boş kalır ve `eas submit` açık bir hatayla durur (yanlış hesaba gönderim olmaz).

| Değişken (gönderimi yapan makinede) | Ne | Nereden |
|---|---|---|
| `ODI_ASC_API_KEY_PATH` | App Store Connect API anahtarı dosyası (`AuthKey_XXXX.p8`) | App Store Connect › Kullanıcılar ve Erişim › Entegrasyonlar › App Store Connect API (rol: App Manager) |
| `ODI_ASC_API_KEY_ID` | Anahtar kimliği (10 karakter) | aynı sayfa |
| `ODI_ASC_API_KEY_ISSUER_ID` | Issuer ID (UUID) | aynı sayfa |
| `ODI_PLAY_SERVICE_ACCOUNT_KEY_PATH` | Google Cloud hizmet hesabı JSON anahtarı | Play Console › Kullanıcılar ve izinler'de bu hesaba "Sürüm yönetimi" izinleri |

- `ascAppId` alanında bilerek geçersiz yer tutucu var (`ASC-UYGULAMA-NO-YAZILACAK`): eas-cli bu alanı ortamdan okumaz; App Store
  Connect'te uygulama kaydı açılınca gönderimi yapan ajan yerel kopyada sayıyla değiştirir (eas-cli rakam dışı değeri reddeder,
  yanlış uygulamaya gönderim olmaz). Değer gizli değildir (mağaza adresinde görünür).
- Anahtar dosyaları depo dışında, `chmod 600` bir klasörde durur (ör. `~/.odi-magaza/`); `.gitignore` bunları zaten dışarıda bırakır
  ama klasör depo içinde olmamalı.
- Android'de ilk AAB Play Console'a **elle** yüklenir (Google API ilk sürümü kabul etmez); sonra `eas submit -p android` iç test
  kanalına taslak olarak gönderir (`track: internal`, `releaseStatus: draft`).
- Sıra ve sahip/ajan işbölümü: `marketing/magaza/YAYIN-LISTESI.md`.

## Bilinen sınırlar
- `react` sürümü: Expo SDK 58 (React Native 0.88) tam olarak React 19.3.0 ister; `apps/web` de aynı tam sürüme (19.3.0) sabitlenmiştir,
  böylece ağaçta tek `react` / `react-dom` kopyası kök `node_modules` altında durur (DOM paketi, native paket ve jest aynı kopyayı
  kullanır). Sürümleri yükseltirken iki uygulamayı birlikte değiştir. Kökte `npm install` çalıştırırken `--legacy-peer-deps` zorunlu.
- DOM bileşeni ↔ native köprüsü eşzamansızdır; `progress` olayı 500 ms'de bir gelir (bant genişliği için yeterli).
- Phaser WebView'da WebGL ile çalışır; eski/az bellekli cihazlarda ilk açılış yavaş olabilir. Ses, ilk dokunuşla açılır (iOS kuralı).
- Expo Go'da paylaşım (`Share`), haptik ve AsyncStorage çalışır; IAP, push ve derin link doğrulaması Faz 2 (dev client).
- `expo-router` typed routes `.expo/types` altına yazılır; `tsc` bunlar olmadan da temizdir.
- Simülatör/cihaz bu ortamda yok; doğrulama `expo export` + `tools/domcheck.mjs` (gerçek www.bundle, stub köprü) ile yapılır.

## Paket bölme (DOM bileşeni)
Web arayüzü ekranları ve Phaser sahnelerini `import()` ile yükler (`apps/web/src/App.tsx` `React.lazy`, `apps/web/src/engine.ts`).
Vite (web) bunları ayrı parçalara böler. DOM paketinde durum şöyle:
- **Dışa aktarma (`expo export`, EAS update, EAS build'deki `export:embed`) tek paket üretir.** `metro.config.js`
  `EXPO_NO_BUNDLE_SPLITTING=1` koyar. Sebep: Expo'nun DOM bileşeni dışa aktarımı (SDK 57 ve 58) parçaları md5 adıyla yeniden
  adlandırıyor, ana paketteki parça yolları eski adda kalıyor → `expo export` "Asset not found: _expo/static/js/web/__common-….js"
  hatasıyla duruyor. Tek pakette `import()` aynı dosyanın içinde çözülür; modüller yine ilk kullanıldıkları anda çalışır
  (başlık ekranında Phaser ve sahneler çalıştırılmaz), yalnız JS ayrıştırması tek dosyada kalır.
- **Geliştirme sunucusu (`expo start`, Expo Go)** DOM bileşenini `lazy=true` ile sunar: `import()` parçayı Metro'dan ayrıca ister
  (Expo'nun desteklediği yol, ek ayar gerekmez).
- Expo bu hatayı düzeltirse `metro.config.js`'teki satırı kaldırmak yeterli; sonra `expo export` + `domcheck` ile doğrula.

## Uygulama içi satın alma (gerçek para)

Gerçek ödeme yalnızca **App Store / Google Play** üzerinden ve **mağaza derlemesinde** (EAS build) çalışır. Expo Go'da gerçek ödeme yoktur; geliştirmede oyun sunucusunun açıkça **TEST MAĞAZASI** etiketli test satın almaları kullanılır (para çekilmez).

Kurulum (bir kez):
1. App Store Connect'te (ve Google Play Console'da) tüketilebilir ürünleri oluştur; kimlikler `packages/shared/src/social.ts` içindeki `SHOP` ile aynı olmalı: `odi.baslangic`, `odi.kristal.1`, `odi.kristal.2`, `odi.kristal.3`, `odi.hiz.1`, `odi.hiz.2`, `odi.pass`.
2. RevenueCat'te proje aç, iOS/Android uygulamalarını bağla, ürünleri içe aktar.
3. Mobil derleme için anahtarlar (EAS ortam değişkeni, yukarıda "Mağaza derlemesi: ortam değişkenleri"): `EXPO_PUBLIC_REVENUECAT_IOS`, `EXPO_PUBLIC_REVENUECAT_ANDROID` (RevenueCat "public SDK key"). Ürün kataloğu ve inceleme riskleri: `marketing/magaza/iap-urunler.md`.
4. Oyun sunucusuna gizli anahtar: `REVENUECAT_API_KEY` (RevenueCat "secret API key"). Sunucu her satın almayı RevenueCat'ten doğrular; doğrulanmayan makbuz kabul edilmez.
5. `npm run build:preview -w @odi/mobile` (TestFlight) ile sandbox hesabında dene.

Kurallar: fiyat ve içerik satın almadan önce açıkça gösterilir; aylık harcama sınırı vardır (oyuncu düşürebilir, yükseltme 24 saat sonra geçerli); savaş ve lig puanı satılmaz; ganimet kutusu yoktur.
