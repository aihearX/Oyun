# ODİ: Sesin Yolu — mobil kabuk (Expo SDK 57)

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
  tools/make-icons.mjs  ikon/splash üretimi (saf JS PNG yazıcı, bağımlılık yok)
  tools/domcheck.mjs    www.bundle DOM sayfasını Playwright'ta stub köprüyle açıp 1. bölümü botla oynatır
  __tests__/            jest-expo duman testi (harita)
```

## Windows'ta çalıştırma (iPhone + Expo Go SDK 57)
```bat
cd C:\Users\sebah\Desktop\Oyun
git pull
npm install --legacy-peer-deps
cd apps\mobile
npx expo start
```
- Telefonda **Expo Go (SDK 57)** ile QR kodu okut. Telefon ve bilgisayar **aynı Wi-Fi**'da olmalı.
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
4. Mağaza gönderimi: `eas submit --platform ios` (`eas.json > submit.production.ios` alanlarını doldur).
5. Android: `eas build --platform android --profile preview` → APK/AAB.
- Monorepo notu: EAS kökü workspace olarak algılar; `npm install --legacy-peer-deps` için kökte `.npmrc` içine `legacy-peer-deps=true` eklemek gerekebilir (kök dosyalarına dokunulmadığı için şimdilik elle).
- IAP / push gibi native modüller Expo Go'da yok; onlar geldiğinde `eas build --profile development` (dev client) kullanılacak.

## Bilinen sınırlar
- `react` sürümü: kök `apps/web` React 19.3 kullanır; Expo SDK 57 React 19.2.3 ister. npm bunu `apps/mobile/node_modules/react`
  altında ayrı tutar; `metro.config.js` (`nodeModulesPaths` + `disableHierarchicalLookup`) ve jest `moduleNameMapper` tek kopya
  kullanılmasını sağlar. Kökte `npm install` çalıştırırken `--legacy-peer-deps` zorunlu.
- DOM bileşeni ↔ native köprüsü eşzamansızdır; `progress` olayı 500 ms'de bir gelir (bant genişliği için yeterli).
- Phaser WebView'da WebGL ile çalışır; eski/az bellekli cihazlarda ilk açılış yavaş olabilir. Ses, ilk dokunuşla açılır (iOS kuralı).
- Expo Go'da paylaşım (`Share`), haptik ve AsyncStorage çalışır; IAP, push ve derin link doğrulaması Faz 2 (dev client).
- `expo-router` typed routes `.expo/types` altına yazılır; `tsc` bunlar olmadan da temizdir.
- Simülatör/cihaz bu ortamda yok; doğrulama `expo export` + `tools/domcheck.mjs` (gerçek www.bundle, stub köprü) ile yapılır.

## Uygulama içi satın alma (gerçek para)

Gerçek ödeme yalnızca **App Store / Google Play** üzerinden ve **mağaza derlemesinde** (EAS build) çalışır. Expo Go'da gerçek ödeme yoktur; geliştirmede oyun sunucusunun açıkça **TEST MAĞAZASI** etiketli test satın almaları kullanılır (para çekilmez).

Kurulum (bir kez):
1. App Store Connect'te (ve Google Play Console'da) tüketilebilir ürünleri oluştur; kimlikler `packages/shared/src/social.ts` içindeki `SHOP` ile aynı olmalı: `odi.baslangic`, `odi.kristal.1`, `odi.kristal.2`, `odi.kristal.3`, `odi.hiz.1`, `odi.hiz.2`, `odi.pass`.
2. RevenueCat'te proje aç, iOS/Android uygulamalarını bağla, ürünleri içe aktar.
3. Mobil derleme için anahtarlar (EAS ortam değişkeni ya da `.env`): `EXPO_PUBLIC_REVENUECAT_IOS`, `EXPO_PUBLIC_REVENUECAT_ANDROID` (RevenueCat "public SDK key").
4. Oyun sunucusuna gizli anahtar: `REVENUECAT_API_KEY` (RevenueCat "secret API key"). Sunucu her satın almayı RevenueCat'ten doğrular; doğrulanmayan makbuz kabul edilmez.
5. `npm run build:preview -w @odi/mobile` (TestFlight) ile sandbox hesabında dene.

Kurallar: fiyat ve içerik satın almadan önce açıkça gösterilir; aylık harcama sınırı vardır (oyuncu düşürebilir, yükseltme 24 saat sonra geçerli); savaş ve lig puanı satılmaz; ganimet kutusu yoktur.
