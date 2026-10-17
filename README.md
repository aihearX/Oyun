# ODİ: Sesin Yolu

**Kulağın içinde geçen, hiç bitmeyen bir macera.** Odi, bir ses parçacığıdır; görevi her sesi kulağın girişinden beyne kadar taşımaktır. Her bölüm kulağın bir yerinde geçer, hiçbir bölüm bir öncekine benzemez ve yolculuk günlerce oynansa da bitmez.

Bu repo, aiHear'ın bağımsız oyun projesidir. aihearX süper uygulamasındaki üç mini oyunun (Koklea Koşusu, Kulak Yolculuğu, Zar Zıplaması) beğenilen özünü alır ve onu büyük, canlı, sosyal bir oyuna dönüştürür.

| Doküman | İçerik |
|---|---|
| [`docs/01-konsept.md`](docs/01-konsept.md) | Vizyon, hedef kitle, karşılaştırmalar, tek cümlelik söz |
| [`docs/02-oyun-tasarimi.md`](docs/02-oyun-tasarimi.md) | Çekirdek döngü, kontrol, sonsuz dünya üretimi, bölüm türleri, zorluk, meta ilerleme |
| [`docs/03-sosyal-ve-canli-operasyon.md`](docs/03-sosyal-ve-canli-operasyon.md) | Arkadaş daveti, takımlar, sohbet, etkinlikler, lig, canlı operasyon takvimi |
| [`docs/04-monetizasyon.md`](docs/04-monetizasyon.md) | Uygulama içi satın alma (Apple/Google), sezon kartı, hızlandırıcılar, fiyatlandırma, kırmızı çizgiler |
| [`docs/05-baglilik-tasarimi.md`](docs/05-baglilik-tasarimi.md) | Araştırma: bağlılık ve alışkanlık mekaniklerinin bilimi, bu oyunda nasıl uygulanacağı, yapmayacaklarımız |
| [`docs/06-teknik-mimari.md`](docs/06-teknik-mimari.md) | 100 kişilik ekip disipliniyle mimari: modüller, sunucu, canlı veri, test, dağıtım |
| [`docs/07-yol-haritasi.md`](docs/07-yol-haritasi.md) | Fazlar, kilometre taşları, ölçütler |
| [`docs/08-onay-sorulari.md`](docs/08-onay-sorulari.md) | Başlamadan önce karar verilmesi gereken sorular |

| [`docs/09-motor-rehberi.md`](docs/09-motor-rehberi.md) | Geliştirici rehberi: mekanik, parça, boss, harness |

Durum: **Faz 1 (dikey dilim) geliştirmede.** Kod bu repoda; aşağıdaki komutlarla çalışır.

## Çalıştırma
```
npm install --legacy-peer-deps
npm run dev          # web: http://localhost:5173 (telefonda aynı Wi-Fi ile LAN adresi)
npm run typecheck && npm run lint && npm test
npm run build:web    # apps/web/dist
node tools/harness/bot.mjs --levels 1-40 --parallel 3 --shots 1   # otomatik oyuncu: tüm bölümleri oynar
```
Mobil (Expo Go, iPhone): `cd apps/mobile && npx expo start` — ayrıntı için `apps/mobile/README.md`.

## Yapı
`packages/shared` tipler · `packages/content` biyomlar, parçalar, yolculuk, boss · `packages/level-gen` deterministik bölüm üretimi · `packages/game-core` Phaser motoru (mekanikler, kahraman, varlıklar, bot) · `apps/web` React kabuk · `apps/mobile` Expo kabuk · `tools/harness` Playwright bot.
