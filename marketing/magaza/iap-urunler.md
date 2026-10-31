# Uygulama içi ürün kataloğu (App Store + Google Play + RevenueCat)

Kaynak: `packages/shared/src/social.ts` `SHOP` (sunucu `apps/server/src/shop.ts` bu listeyi satar). Yapıştırmaya hazır adlar ve
açıklamalar: [`iap-urunler.json`](iap-urunler.json). `node tools/magaza/denetle.mjs` kimlik, fiyat ve sınırın kodla aynı olduğunu,
adların (Apple ≤ 30, Google ≤ 55) ve açıklamaların (Apple ≤ 45, Google ≤ 200) sınırda olduğunu denetler.

## Nasıl çalışır (kod)
- İstemci (mağaza derlemesi): `apps/mobile/src/purchases.ts` RevenueCat'i `appUserID = oyuncu kimliği` ile kurar,
  `getProducts([id], NON_SUBSCRIPTION)` + `purchaseStoreProduct`; işlem numarasını sunucuya `shop.purchase` ile yollar.
- Sunucu: `verifyReceipt` RevenueCat REST `GET /v1/subscribers/<oyuncu>` → `non_subscriptions[<ürün>]` içinde aynı işlem
  numarası ve mağaza; aynı makbuz ikinci kez kullanılamaz; ürün sınırı ve aylık harcama sınırı; içerik hemen teslim edilir.
- RevenueCat'te **Offering ve Entitlement gerekmez** (kod ürünü kimliğiyle çeker; tüketilebilir ürünlerde yetki yok). Ürünler
  RevenueCat'e aynı kimlikle eklenir (App Store / Play'den içe aktarma).
- Geri yükleme (Restore) düğmesi yok: tüketilebilir ürünlerde Apple ve Google istemez. Silinen hesaptaki ürünler geri gelmez
  (gizlilik ve hesap silme sayfaları bunu söyler).

## Katalog

Tür: **hepsi tüketilebilir** (Apple "Consumable", Google Play "tek seferlik ürün", RevenueCat'te tüketilebilir olarak işaretlenir;
Play Billing'de satın alma onaylanıp tüketilir, bunu RevenueCat SDK'sı yapar).

| Ürün kimliği | TR ad | EN ad | İçerik | Sınır | Takım hediyesi | Önerilen fiyat (TRY) |
|---|---|---|---|---|---|---|
| `odi.baslangic` | Başlangıç Paketi | Starter Pack | 300 kristal, 10 × 5 dk hızlandırıcı, Kaşif şapkası | Hesap başına 1 | Var | 49,99 |
| `odi.kristal.1` | Avuç Kristal | Handful of Crystals | 120 kristal | — | Yok | 29,99 |
| `odi.kristal.2` | Kese Kristal | Pouch of Crystals | 650 kristal (+%8) | — | Var | 149,99 |
| `odi.kristal.3` | Sandık Kristal | Chest of Crystals | 1400 kristal (+%17) | — | Var | 299,99 |
| `odi.hiz.1` | İnşaatçı Paketi | Builder Pack | 10 × 60 dk, 20 × 5 dk hızlandırıcı | — | Var | 79,99 |
| `odi.hiz.2` | Usta İnşaatçı | Master Builder | 5 × 8 saat, 20 × 60 dk hızlandırıcı | — | Var | 199,99 |
| `odi.pass` | Odi Sezon Kartı | Odi Season Card | 28 gün her güne 30 kristal (ödül kutusuna; girilmeyen günlerinki birikir, toplam tam 840) + Altın Koklea kostümü (hemen) | Hesap başına 1 | Var | 99,99 |

Takım hediyesi (sunucu `teamGiftFor`, fiyata göre sabit): 50 TL altı 20 kristal + 50 jeton, 100 TL altı 50 kristal + 100 jeton,
üstü 100 kristal + 200 jeton; satın alanın takımındaki diğer üyelerin hediye kutusuna düşer. Kristal yalnız kamp inşaatını hemen
bitirmeye harcanır (kalan her dakika 1 kristal); bölüm, savaş, baskın, yarış ya da lig puanı satılmaz. Hızlandırıcıyla büyüyen kamp binaları
yalnız kişisel etki verir (jeton, kalkan, klinik); takım puanlarına ve lige hiç girmez (karar 29).

### Fiyat
- **App Store:** fiyat noktası seçilir. Temel ülke **Türkiye** seçilip yukarıdaki TRY değerine en yakın nokta seçilir; diğer ülkeler
  Apple'ın eşdeğeriyle dolar (ilk yayında yalnız Türkiye önerilir). Apple KDV'yi kendisi tahsil eder; görünen fiyat KDV dahildir.
- **Google Play:** varsayılan fiyat TRY olarak girilir (KDV dahil); diğer ülkeler "fiyatları dönüştür".
- **Oyunda gösterilen fiyat (YN-032):** mağaza derlemesinde oyun her ürünün fiyatını RevenueCat'ten (`getProducts` →
  `priceString`, mağazanın kendi biçimi: vergi, kur ve ülke dahil) alır ve kartta, onay sayfasında, "… öde" düğmesinde onu
  gösterir (`apps/mobile/src/purchases.ts` → köprü `storePrices` → `apps/web/src/shopPrice.ts`). Yanlış para birimi gösterilmez:
  listedeki her ürünün fiyatı (hepsi aynı para biriminde) gelmezse hepsi TL liste fiyatına (`SHOP.priceTry`) düşer. Mağaza fiyatı
  yoksa (web, Expo Go, çevrimdışı, RevenueCat anahtarı yok) gösterilen tek fiyat TL liste fiyatıdır ve yanında "Mağaza fiyatı
  satın alırken gösterilir" notu durur; gerçek satın almada onay düğmesi tutar yazmaz ("Mağazada satın al"), tutarı mağazanın ödeme
  sayfası gösterir. **Aylık harcama sınırı** sunucuda TL liste fiyatıyla sayılır (değişmedi) ve oyunda "TL liste fiyatıyla" diye
  etiketlidir; Türkiye dışında ödenen tutar sınıra kur çevrimiyle değil liste fiyatıyla girer. İlk yayında yine **yalnız Türkiye**
  ve mağaza fiyatı tablodaki TRY değerine en yakın nokta önerilir (sınır ve geçmiş tutarları ödenenle aynı kalsın).

### Apple inceleme ekran görüntüsü (her ürün için)
Her üründe bir "Review Screenshot" (en az 640×920) istenir: ürünün oyunda satın alındığı yer.
- Kare: Profil › **Mağaza** ekranı, ürünün kartı görünür (ad, içerik, fiyat, takım hediyesi satırı) ve aynı ürünün satın alma sayfası.
- Üretim: `ui-mobile-check --only profil` mağaza karesi (`profil-mağaza`) ya da TestFlight derlemesinde sandbox hesabıyla ekran görüntüsü.
  Sandbox'ta Apple'ın ödeme sayfası çıkınca ekran görüntüsü alınır (gerçek fiyat ve "Sandbox" etiketi görünür).
- İnceleme notu (her ürün, EN): "Shop opens after 6 cleared levels: Profil › Mağaza. Contents are fixed and shown before purchase."

## İnceleme riskleri

| Ürün | Risk | Düzeyi | Öneri |
|---|---|---|---|
| `odi.pass` Sezon Kartı | 28 gün süren fayda: Apple "süreli erişim" sayıp **otomatik yenilenmeyen abonelik** (Non-Renewing Subscription) isteyebilir. Ayrıca kalıcı kostüm içerir. Oyunlarda günlük kristal veren kartlar yaygın olarak tüketilebilir girilir | Orta | Tüketilebilir olarak gönder; açıklamada "otomatik yenilenmez, 28 gün boyunca her gün 30 kristal ödül kutusuna" yaz. Reddedilirse Non-Renewing Subscription olarak yeniden oluştur: istemci kodu değişmez (iOS'ta `getProducts` türden bağımsız), ama RevenueCat'in bu satın almayı `non_subscriptions` altında döndürdüğü **sandbox'ta doğrulanmalı** (sunucu orada arar) |
| `odi.pass` | `limit: 1` hesap başına **ömür boyu** bir kez demek: "Sezon" adı her sezon yeniden alınabileceğini düşündürür | Düşük (inceleme), ürün kararı | Ad ve açıklama "hesap başına bir kez" diyor. Her sezon satılacaksa sunucuda sınır sezon başına yapılmalı (ürün sahibine) |
| `odi.baslangic` | Kalıcı şapka içeren tüketilebilir ürün: inceleyici "geri yüklenebilir (non-consumable) olmalı" diyebilir | Düşük–orta | İçeriğin çoğu harcanır (kristal, hızlandırıcı); hesap kayıt sistemi olmadığından yeni cihaza geri yükleme yapılamaz. Açıklama "hesap başına bir kez" diyor; gerekirse inceleme notunda açıklanır |
| Hepsi | Mağaza fiyatı alınamazsa (çevrimdışı, ürün RevenueCat'te eksik) oyun TL liste fiyatını gösterir | Düşük | TL fiyatın yanında "Mağaza fiyatı satın alırken gösterilir" notu; ödeme düğmesi tutar yazmaz; ödenen tutarı mağazanın ödeme sayfası gösterir (YN-032) |
| Hepsi | Mağaza 6 bölümden sonra açılıyor: inceleyici ürünleri hemen göremez (2.1) | Orta | İnceleme notunda yol ve süre yazılı (yaklaşık 6–8 dk). İstenirse ekran kaydı eklenir |
| Hepsi | Ganimet kutusu / rastgele ücretli öğe | **Yok** | Olasılık beyanı gerekmez. Ücretsiz "Şanslı Nota" ihtimali (%10) oyunda (Profil › Nasıl çalışır?) yazılı |
| Hepsi | Takım hediyesi: satın alma başkalarına ödül verir ("hediye" sayılırsa 3.1.1'de "başka kullanıcıya hediye" kuralı) | Düşük | Hediye oyun içi sabit kristal/jeton; satın alınan ürün devredilmez. Açıklamada yazılı |
| Hepsi | `REVENUECAT_API_KEY` sunucuda yoksa her gerçek satın alma reddedilir; EAS'ta `EXPO_PUBLIC_REVENUECAT_*` yoksa mağaza derlemesi gerçek satın almayı açmaz (TEST mağazası da üretimde kapalı → satın alınamaz) | Yüksek (işlev) | YAYIN-LISTESI R1–R6; TestFlight / iç test kanalında sandbox satın almasıyla uçtan uca denenmeden gönderilmez |
