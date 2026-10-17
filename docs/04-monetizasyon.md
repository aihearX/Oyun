# 04 · Monetizasyon

İlke: **oyun ücretsiz ve tamamı oynanabilir; para zaman ve stil satın alır, güç ve şans satın almaz.** Bu, hem App Store/Google Play kurallarıyla, hem AB ve Türkiye tüketici mevzuatıyla, hem de uzun ömürlü oyunların ekonomisiyle uyumludur.

## 1. Ödeme altyapısı
Apple ve Google, dijital içerik için kendi uygulama içi satın alma sistemlerini zorunlu kılar; "Apple Pay" fiziksel ürünler içindir. Dolayısıyla: **StoreKit (iOS) ve Google Play Billing**, RevenueCat ile yönetilir (abonelik, makbuz doğrulama, iade, analitik). Kullanıcı yine Face ID ile iki saniyede öder.

## 2. Ürünler
| Ürün | Tür | Ne verir | Fiyat (TR, taslak) |
|---|---|---|---|
| **Odi Pass** (sezon kartı) | Aylık, yenilenmeyen | Premium ödül yolu: kostümler, yol arkadaşı, hızlandırıcı, sezon rozeti. Ücretsiz yol da var. | ₺149 / sezon |
| **Hızlandırıcı paketi** | Tüketilebilir | 2x deneyim (24 saat), bölüm başı +1 can, mıknatıs başlangıcı. Oyun sonucunu değiştirmez; zamanı kısaltır. | ₺49 / ₺99 / ₺199 |
| **Kostüm setleri** | Kalıcı | Odi şapkaları, izler, zafer animasyonları; yalnızca görünüm | ₺39-₺129 |
| **Yol arkadaşı paketi** | Kalıcı | Belirli (görünür) yol arkadaşı; şans yok | ₺79 |
| **Sonsuz Enerji (ay)** | Abonelik | Can bekleme süresi yok + aylık kostüm | ₺99 / ay |
| **Takım Hediyesi** | Tüketilebilir | Takımdaki herkese 1 gün 2x deneyim; sosyal statü | ₺149 |

## 3. Enerji (can) sistemi, dürüst versiyon
- 5 can, biri 20 dakikada dolar; arkadaş yardımı ve günlük görevle ücretsiz dolar.
- Can bitince bir **"son bir bölüm daha" ücretsiz** hakkı günde bir kez (iyi niyet).
- Can satın alma "kaybetmek üzereyken" pencere olarak çıkmaz; yalnızca mağazada durur.

## 4. Kırmızı çizgiler (yasal ve ahlaki)
- Loot box, gacha, rastgele sandık **yok**; her satın almanın içeriği görünür.
- Sahte kıtlık ve geri sayım yok; indirim varsa gerçek ve tarihli.
- Ödeme duvarı yok; hiçbir bölüm para olmadan geçilemez durumda değildir.
- Satın alma akışında karanlık desen yok (gizli "X", kafa karıştıran butonlar).
- 18 yaş altı için harcama limiti ve aile onayı; harcama özeti ayarlarda.
- Reklam yok (işitme sağlığı markası, sağlık dışı reklam almaz).

## 5. Hedef metrikler
- Dönüşüm (ödeyen/aktif): %3-5 (tür ortalaması %2-4).
- ARPDAU: $0,05-0,10 ilk yıl; gelir ağırlığı Odi Pass'te.
- İade oranı <%1; mağaza puanı 4,7+.
