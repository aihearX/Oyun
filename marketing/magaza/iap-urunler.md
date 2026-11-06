# Uygulama içi ürün kataloğu (App Store + Google Play + RevenueCat)

Sürüm 1.0.0 ile birlikte, ilk sürümde açık (sahip kararı, YN-032). Yükleme adımları: [`YUKLEME-GUNU.md`](YUKLEME-GUNU.md) (D, G, H).

Kaynak: `packages/shared/src/social.ts` `SHOP` (sunucu `apps/server/src/shop.ts` bu listeyi satar). Yapıştırmaya hazır adlar ve
açıklamalar: [`iap-urunler.json`](iap-urunler.json). `node tools/magaza/denetle.mjs` kimlik, fiyat ve sınırın kodla aynı olduğunu,
adların (Apple ≤ 30, Google ≤ 55) ve açıklamaların (Apple ≤ 45, Google ≤ 200) sınırda olduğunu denetler.

## Nasıl çalışır (kod)
- İstemci (mağaza derlemesi): `apps/mobile/src/purchases.ts` RevenueCat'i `appUserID = oyuncu kimliği` ile kurar,
  `getProducts([id], NON_SUBSCRIPTION)` + `purchaseStoreProduct`. Ödemeden **önce** sunucu sınırları denetler (`shop.check`: ürün
  sınırı, aylık harcama sınırı); ödeme alınınca işlem numarası önce cihazdaki kalıcı kuyruğa (`apps/web/src/odeme-kuyrugu.ts`),
  sonra sunucuya `shop.purchase` ile gider.
- **finish / consume:** RevenueCat işlemi kendisi bitirir; kodda ayrıca `finishTransaction` ya da `consume` çağrısı yoktur. App
  Store'da bitirilen tüketilebilir ürün makbuzdan düşer; tüketilmeyen ürün ve yenilenmeyen abonelik makbuzda kalır (geri yüklenir).
  Google Play'de tüketme kararını RevenueCat ürün türüne göre verir: **`odi.baslangic` RevenueCat panosunda "Non-consumable"
  işaretlenmelidir** (Android SDK 7.11+; uygulamadaki `react-native-purchases` 10.x bunu destekler), yoksa RevenueCat onu da tüketir ve
  aynı Google hesabı ürünü yeniden satın alabilir (sunucu yine hesap başına bir kez verir).
- Sunucu (`apps/server/src/shop.ts`): RevenueCat REST `GET /v1/subscribers/<oyuncu>` → `non_subscriptions[<ürün>]` içinde aynı işlem
  numarası ve mağaza. Tüketilebilir, tüketilmeyen ürün ve Apple yenilenmeyen aboneliği RevenueCat'te **üçü de `non_subscriptions`
  altında** gelir (RevenueCat yenilenmeyen aboneliğin bitişini bilmediği için abonelik saymaz; süre sunucuda: Sezon Kartı 28 gün).
  İşlem `purchases.receipt` (`<mağaza>:<işlem no>`, tekil) ile **bir kez** işlenir:
  - aynı hesaptan yeniden gelirse ikinci kez verilmez, `already: true` ile başarı döner (bekleyen kuyruk bunu "işlendi" sayar);
  - başka hesaba (ya da silinen hesaba, "silinmis") işlenmişse `BASKA_HESAP`: **aynı mağaza işlemi ikinci bir oyun hesabına verilmez**;
  - doğrulanan ödeme sınır yüzünden reddedilmez (para alınmıştır); sınırlar ödemeden önce `shop.check`'te.
- RevenueCat'te **Offering ve Entitlement gerekmez** (kod ürünü kimliğiyle çeker; hak sunucuda, oyun hesabına bağlı). Yenilenmeyen
  aboneliği bir Entitlement'a **bağlamayın**: RevenueCat onu süresiz açık sayar. Ürünler RevenueCat'e aynı kimlikle eklenir.

### Satın alımları geri yükle (Apple 3.1.1)
- Mağaza ekranında "Satın alımları geri yükle" kartı (yalnız gerçek mağaza kipinde): RevenueCat `restorePurchases` → sunucu
  `shop.restore`. Sunucu bu oyuncunun RevenueCat'teki bütün işlemlerini okur ve **hiçbir hesaba işlenmemiş** olanları bu hesaba
  işler (içerik ve takım hediyesi); bu hesaba işlenmiş Başlangıç Paketi / Sezon Kartı "zaten bu hesapta"; başka hesaba işlenmiş
  olanlar "başka bir oyun hesabına işlenmiş, bu hesaba verilmedi". Kristal ve hızlandırıcı paketleri işlendikten sonra geri
  yüklenmez (harcanmıştır); ekran bunu söyler. Oyuncu başına 10 saniyede bir.
- **RevenueCat geri yükleme davranışı** (Project settings › General › Restore behavior): varsayılan **"Transfer to new App User ID"**
  kalsın. Başka oyun hesabından geri yüklenince RevenueCat işlemi yeni oyuncu kimliğine taşır, ama sahiplik sunucudaki kayıttır:
  işlem ilk hesaba işlenmişse yeni hesaba verilmez. ("Keep with original App User ID" seçilirse SDK hata verir; uygulama bunu da
  "başka bir oyun hesabına bağlı" diye söyler.)
- **Bilinen sınır:** hesap kurtarma yok (cihazdaki anahtar uygulama silinince kaybolur). Uygulamayı silip yeniden kuran oyuncu yeni
  oyun hesabı açar; eski hesaba işlenmiş Başlangıç Paketi (Kâşif Şapkası dahil) ve Sezon Kartı yeni hesaba geri yüklenmez. Geri
  yükleme aynı oyun hesabı içindir (ör. işlenmemiş ödeme, ikinci cihaz kurulumu olmadan). Apple incelemesi bunu sorarsa yanıt
  aşağıdaki inceleme notunda; gerekirse ürün kararı: yeni hesaba yalnız kalıcı kozmetiği (şapka, kostüm) vermek (kristal yok).

### Ödeme alındı ama sunucuya işlenemedi (YN-285)
- İşlem numarası cihazda kalıcı (`odi.magaza.bekleyen`); bağlanınca ve uygulama açılınca kendiliğinden yeniden gönderilir. Mağaza
  ekranı "Ödeme alındı; bağlantı dönünce hesabına işlenecek" kartını ve "Şimdi dene" düğmesini gösterir.
- Makbuzu hiç gelmeyen işlem (ağ koptu, ödeme onay bekliyor: Ask to Buy / Play bekleyen ödeme): RevenueCat SDK'sı bitmemiş işlemi
  kendisi tutar ve uygulama açılınca RevenueCat'e iletir; uygulama 7 gün boyunca bağlanınca (en çok 5 dakikada bir) sunucuya tarama
  ister (`shop.restore`), işlenmemiş işlem bulunursa hesaba geçer. Kuyruk silinse de (Sıfırla) aynı oyun hesabında "Satın alımları
  geri yükle" bulur.

## Katalog

| Ürün kimliği | TR ad | EN ad | İçerik | Sınır | Takım hediyesi | Önerilen fiyat (TRY) |
|---|---|---|---|---|---|---|
| `odi.baslangic` | Başlangıç Paketi | Starter Pack | 300 kristal, 10 × 5 dk hızlandırıcı, Kâşif Şapkası | Hesap başına 1 | Var | 49,99 |
| `odi.kristal.1` | Avuç Kristal | Handful of Crystals | 120 kristal | — | Yok | 29,99 |
| `odi.kristal.2` | Kese Kristal | Pouch of Crystals | 650 kristal (+%8) | — | Var | 149,99 |
| `odi.kristal.3` | Sandık Kristal | Chest of Crystals | 1400 kristal (+%17) | — | Var | 299,99 |
| `odi.hiz.1` | İnşaatçı Paketi | Builder Pack | 10 × 60 dk, 20 × 5 dk hızlandırıcı | — | Var | 79,99 |
| `odi.hiz.2` | Usta İnşaatçı | Master Builder | 5 × 8 saat, 20 × 60 dk hızlandırıcı | — | Var | 199,99 |
| `odi.pass` | Odi Sezon Kartı | Odi Season Card | 28 gün her güne 30 kristal (ödül kutusuna; girilmeyen günlerinki birikir, toplam tam 840) + Altın Koklea kostümü (hemen) | Hesap başına 1 | Var | 99,99 |

### Ürün türleri (mağaza panellerinde seçilecek)

| Ürün kimliği | App Store Connect | Google Play Console | RevenueCat ürün türü (Play) | Geri yükleme |
|---|---|---|---|---|
| `odi.baslangic` | **Non-Consumable** (Tüketilmeyen) | Tek seferlik ürün (uygulama içi ürün) | **Non-consumable** (tüketilmez) | Var |
| `odi.kristal.1` | Consumable (Tüketilebilir) | Tek seferlik ürün | Consumable | Yok (harcanır) |
| `odi.kristal.2` | Consumable | Tek seferlik ürün | Consumable | Yok |
| `odi.kristal.3` | Consumable | Tek seferlik ürün | Consumable | Yok |
| `odi.hiz.1` | Consumable | Tek seferlik ürün | Consumable | Yok |
| `odi.hiz.2` | Consumable | Tek seferlik ürün | Consumable | Yok |
| `odi.pass` | **Non-Renewing Subscription** (Otomatik Yenilenmeyen Abonelik) | Tek seferlik ürün (abonelik **değil**) | Consumable | Var |

Gerekçe:
- **`odi.baslangic` → Non-Consumable.** Kalıcı bir öğe (Kâşif Şapkası) içerir ve hesap başına bir kez satılır; Apple kalıcı içeriği
  tüketilebilir türde kabul etmeyebilir (3.1.1). Kristal ve hızlandırıcı bir kez teslim edilir, geri yüklemede yeniden verilmez.
  Play'de tür seçimi yoktur (tek seferlik ürün); tüketilmemesi RevenueCat'in "Non-consumable" işaretiyle sağlanır. Sonuç: aynı
  App Store / Google hesabı ürünü bir daha satın alamaz (Apple "zaten satın aldınız" deyip ücretsiz yeniden verir, Play
  "zaten sahipsiniz" der); başka bir oyun hesabına bu işlem verilmez.
- **`odi.pass` → Apple'da Non-Renewing Subscription.** 28 gün süren, kendiliğinden yenilenmeyen fayda Apple'ın tanımıyla yenilenmeyen
  aboneliktir; tüketilebilir girilmesi 3.1.2 incelemesinde ret riski taşır. Apple bu türde geri yüklemeyi ve cihazlar arası
  erişimi uygulamaya bırakır: hak sunucuda, oyun hesabında. Yenilenmeyen abonelik makbuzda kalır, RevenueCat `non_subscriptions`
  altında döndürür; süre sunucuda sayılır (`pass_days`). **Play'de yenilenmeyen abonelik türü yoktur:** RevenueCat'in önerisiyle
  tek seferlik ürün; tüketilebilir bırakılır ki sezon sonrasında aynı Google hesabı yeniden alabilsin (bugün sunucu hesap başına bir
  kezle sınırlıyor). Play aboneliği (otomatik yenilenen) seçilmez: kart yenilenmez.
- **Kristal ve hızlandırıcı paketleri → Consumable.** Harcanan oyun içi para birimi; geri yüklenmez (Apple ve Google istemez).

Takım hediyesi (sunucu `teamGiftFor`, fiyata göre sabit): 50 TL altı 20 kristal + 50 jeton, 100 TL altı 50 kristal + 100 jeton,
üstü 100 kristal + 200 jeton; satın alanın takımındaki diğer üyelerin hediye kutusuna düşer. Kristal yalnız kamp inşaatını hemen
bitirmeye harcanır (kalan her dakika 1 kristal); bölüm, savaş, baskın, yarış ya da lig puanı satılmaz. Hızlandırıcıyla büyüyen kamp binaları
yalnız kişisel etki verir (jeton, kalkan, klinik); takım puanlarına ve lige hiç girmez (karar 29); kalkan/Klinik canı korur ama
karşıladığı vuruş yıldız ve lig için hasar sayılır (karar 37). Hediyedeki jeton kampta ve yeteneklerde
harcanır, takım teknolojisine bağışlanamaz (YN-065).

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

### Apple inceleme ekran görüntüsü ve notu (her ürün için)
Her üründe bir "Review Screenshot" (en az 640×920) ve kısa bir inceleme notu istenir. Ekran görüntüsü ürünün oyunda satın alındığı yeri
göstermeli.
- **Hazır kareler:** `node tools/harness/vitrin.mjs --only magaza --out <klasör>` → `<klasör>/iap-inceleme/<ürün kimliği>.png`
  (iOS 6,9" 1320×2868): Profil › Mağaza'da o ürünün satın alma penceresi (ad, liste fiyatı, içerik, Sezon Kartı koşulları, "Mağazada
  satın al"). Kare mağaza derlemesindeki gibi gerçek satın alma kipinde çekilir (TEST şeridi yok); mağaza fiyatı gelmediği için TL liste
  fiyatı ve "Ödeyeceğin tutarı App Store / Google Play kendi onay penceresinde gösterir" notu görünür. Satın alma yapılmaz. Ayrıca
  `harcama-siniri.png` (ilk satın almadan önceki sınır seçimi) ve `12-magaza.png` (liste) aynı çekimde.
- **Daha iyisi (varsa):** TestFlight'ta sandbox satın alma sırasında Apple'ın ödeme penceresi açıkken alınan ekran görüntüsü (gerçek
  fiyat ve "Sandbox" etiketi görünür). Yükleme günü zaman yoksa hazır kareler yeterlidir.
- **İnceleme notu** (her ürüne aynı, EN; ≤ 4.000):
  > The shop opens after 6 cleared levels: tab "Profil" › "Mağaza". Before the first purchase the player chooses a monthly spending
  > limit (choose 500 TRY to test every product). Contents are fixed and shown before purchase; no random items.
  `odi.baslangic` için ek cümle: "Non-consumable, once per game account. Restore: Profil › Mağaza › ‘Satın alımları geri yükle’
  (the hat stays on the game account; crystals and boosters are delivered once)."
  `odi.pass` için ek cümle: "Non-renewing subscription: 30 crystals for each of 28 days go to the in-game inbox (840 in total) plus
  a costume; it does not auto-renew, once per game account. Access is kept on our server for the game account; restore with
  ‘Satın alımları geri yükle’ in the shop."

## İnceleme riskleri

| Ürün | Risk | Düzeyi | Öneri |
|---|---|---|---|
| `odi.pass` Sezon Kartı | Yenilenmeyen abonelik olarak girildi (3.1.2): RevenueCat'in onu `non_subscriptions` altında döndürdüğü **TestFlight sandbox'ında doğrulanmalı** (sunucu orada arar; belgede ve topluluk yanıtlarında böyle, kendi hesabımızda denenmedi) | Orta (işlev) | YUKLEME-GUNU H4: Sezon Kartı satın alınır, kristal ödül kutusuna düşer; sonra "Satın alımları geri yükle" → "Zaten bu hesapta" |
| `odi.pass` | `limit: 1` hesap başına **ömür boyu** bir kez demek: "Sezon" adı her sezon yeniden alınabileceğini düşündürür | Düşük (inceleme), ürün kararı | Ad ve açıklama "hesap başına bir kez" diyor. Her sezon satılacaksa sunucuda sınır sezon başına yapılmalı (ürün sahibine) |
| `odi.baslangic` | Tüketilmeyen ürün: uygulama silinip kurulursa yeni oyun hesabı açılır, geri yükleme eski hesaba işlenmiş paketi yeni hesaba vermez (hesap kurtarma yok) | Orta | İnceleme notu hakkın oyun hesabına bağlı olduğunu söyler; reddedilirse yeni hesaba yalnız kalıcı kozmetiği (şapka) vermek tek satırlık sunucu kararıdır |
| `odi.baslangic` (Play) | RevenueCat'te "Non-consumable" işaretlenmezse RevenueCat ürünü tüketir: aynı Google hesabı yeniden satın alabilir | Düşük | YUKLEME-GUNU D4; sunucu yine hesap başına bir kez verir (ikinci ödeme `shop.check`'te "Alındı" ile engellenir) |
| Hepsi | Mağaza fiyatı alınamazsa (çevrimdışı, ürün RevenueCat'te eksik) oyun TL liste fiyatını gösterir | Düşük | TL fiyatın yanında "Mağaza fiyatı satın alırken gösterilir" notu; ödeme düğmesi tutar yazmaz; ödenen tutarı mağazanın ödeme sayfası gösterir (YN-032) |
| Hepsi | Mağaza 6 bölümden sonra açılıyor: inceleyici ürünleri hemen göremez (2.1) | Orta | İnceleme notunda yol ve süre yazılı (yaklaşık 6–8 dk); her ürüne satın alma penceresinin ekran görüntüsü (`iap-inceleme/`). İstenirse ekran kaydı eklenir |
| Hepsi | Ganimet kutusu / rastgele ücretli öğe | **Yok** | Olasılık beyanı gerekmez. Ücretsiz "Şanslı Nota" ihtimali (%10) oyunda (Profil › Nasıl çalışır?) yazılı |
| Hepsi | Takım hediyesi: satın alma başkalarına ödül verir ("hediye" sayılırsa 3.1.1'de "başka kullanıcıya hediye" kuralı) | Düşük | Hediye oyun içi sabit kristal/jeton; satın alınan ürün devredilmez. Açıklamada yazılı |
| Hepsi | `REVENUECAT_API_KEY` sunucuda yoksa her gerçek satın alma reddedilir; EAS'ta `EXPO_PUBLIC_REVENUECAT_*` yoksa mağaza derlemesi gerçek satın almayı açmaz (TEST mağazası da üretimde kapalı → satın alınamaz) | Yüksek (işlev) | [`YUKLEME-GUNU.md`](YUKLEME-GUNU.md) adım D ve H; TestFlight / iç test kanalında sandbox satın almasıyla uçtan uca denenmeden gönderilmez |
