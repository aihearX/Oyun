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
| [`docs/10-sunucu.md`](docs/10-sunucu.md) | Sosyal sunucu, ortam değişkenleri, protokol kuralları, yedek, hesap silme, kodlar |
| [`docs/11-bolum-yeniden-tasarim.md`](docs/11-bolum-yeniden-tasarim.md) | Bölümlerin yeniden tasarımı (v2) |
| [`docs/12-zorluk-egrisi.md`](docs/12-zorluk-egrisi.md) | Ölçülen zorluk eğrisi |
| [`docs/13-iletisim.md`](docs/13-iletisim.md) | Oyuncu iletişimi: takım akışı, hazır sözler, güvenli sohbet |
| [`docs/14-kamp.md`](docs/14-kamp.md) | Kulak Kampı: binalar, Tedavi Odası, kamp seviyesi, bölgeler |
| [`docs/15-siralama.md`](docs/15-siralama.md) | Sıralama: oyuncular ve takımlar |
| [`docs/16-takim-rekabeti.md`](docs/16-takim-rekabeti.md) | Canlı Takım Yarışı, Takım Ligi, takım bulma ve başvuru |
| [`docs/17-kamp-gorevleri.md`](docs/17-kamp-gorevleri.md) | Kamp Görevleri: Hasta Vakaları, Ton Avı, Timpanogram Eşleştir |
| [`docs/odyoloji-icerik.md`](docs/odyoloji-icerik.md) | Odyoloji içeriği (uzman incelemesi için) |
| [`docs/anlatici-metinleri.md`](docs/anlatici-metinleri.md) | Tüy Dede anlatıcı metinleri |
| [`docs/yonetim/durum.md`](docs/yonetim/durum.md) | Proje yöneticisi: güncel durum, test sonuçları, sahip kararları ([iş listesi](docs/yonetim/is-listesi.md)) |

Durum: **Faz 1 (dikey dilim) geliştirmede.** Kod bu repoda; aşağıdaki komutlarla çalışır.

## Çalıştırma
```
npm install --legacy-peer-deps
npm run oyna            # oyun sunucusu + Expo: iPhone'da Expo Go ile QR'ı okut (aynı Wi-Fi)
npm run oyna -- --web   # telefon yerine tarayıcı: http://localhost:5173
npm run typecheck && npm run lint && npm test
node tools/harness/bot.mjs --levels 1-40 --parallel 3            # otomatik oyuncu: tüm bölümler
node tools/harness/bot.mjs --levels 1-40 --idle 1 --parallel 4   # boşta oyuncu: hiçbir bölüm dokunmadan bitmemeli
node tools/harness/social-e2e.mjs   # iki oyunculu takım/sohbet/kamp/mağaza/baskın testi
node tools/harness/race-e2e.mjs     # üç oyunculu canlı yarış testi
```
Arkadaşların başka ağlardan bağlanacaksa sunucuyu internete açmak gerekir: `docs/10-sunucu.md` (Render.com adımları).

## Yapı
- `packages/shared` tipler, sosyal protokol (`social.ts`), ekonomi formülleri
- `packages/content` biyomlar, parçalar, yolculuk, boss, başarımlar, kartlar, kozmetik, günlük görevler
- `packages/level-gen` deterministik bölüm üretimi
- `packages/game-core` Phaser motoru: 6 mekanik + boss, kahraman, varlıklar, bot, canlı yarış katmanı
- `packages/meta` bağlılık sistemlerinin saf mantığı (görev, takvim, başarım, albüm, kozmetik)
- `packages/net` sosyal sunucu istemcisi (yeniden bağlanma, çevrimdışı kuyruk)
- `apps/server` oyun sunucusu: takım, sohbet, kamp, teknoloji, hediyeler, savaş, baskın, yarış, lig, mağaza
- `apps/web` tek arayüz (tarayıcı ve telefon aynı kodu çalıştırır)
- `apps/mobile` Expo kabuğu: web arayüzünü DOM bileşeninde çalıştırır; depolama, titreşim, paylaşım, gerçek mağaza köprüsü
- `tools/harness` otomatik testler
