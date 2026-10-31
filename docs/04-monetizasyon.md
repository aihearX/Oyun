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

## 6. Uygulanan kurallar (sahip kararları 28, 29, 30; 2026-10-31)
Yukarıdaki ürün tablosu ilk taslaktır; satılan ürünler `packages/shared/src/social.ts` `SHOP` ve `marketing/magaza/iap-urunler.md`.

- **Aylık harcama sınırı (karar 28):** varsayılan sınır yok. İlk satın almadan önce oyuncu sınırını kendisi seçer: Satın alma kapalı,
  50, **100 (önerilen)**, 250, 500 TL. Seçilmeden sunucu satın almayı kabul etmez (`SINIR_SEC`). Düşürmek hemen geçerli; yükseltmek
  ikinci bir onay adımı ister (`confirmRaise`) ve 24 saat sonra geçerli olur. Kitle öğrenci ve çocuk olduğu için eski 1.000 TL
  varsayılanı kaldırıldı. Göç 7: sınırını önceden değiştirmiş oyuncu seçmiş sayılır, diğerleri bir sonraki alımdan önce seçer.
- **Pay-to-win yok (karar 29):** hızlandırıcılar yalnız kamp inşaatını kısaltır. Kamp binaları takım rekabetine (savaş, baskın, takım
  yarışı, Takım Ligi) ve bireysel lige hiç yansımaz; yalnız kişisel jeton, kalkan ve klinik şansı verir. Timpanometri Kulesi'nin savaş
  puanı etkisi kişisel bölüm jetonu etkisine çevrildi. Ayrıntı ve kalan dolaylı bağlar: `docs/14-kamp.md` §1.
- **Satın alma hediyesi jetonu bağışlanamaz (karar 29 devamı, YN-065):** takım hediyeli bir paket alınınca diğer üyelere düşen
  50 / 100 / 200 jeton, alan oyuncunun cüzdanında ayrı sayılır (`players.gift_jeton`, göç 9; `Wallet.bagislanamaz`). Bu jeton kampta
  ve yeteneklerde harcanır (önce o harcanır), ama takım teknolojisine (Ortak Kazanç, Savaş Borusu, Baskın Gücü …) bağışlanamaz:
  gerçek para takım gücüne dolaylı yoldan da dönüşmez. Bağış bu yüzden yetmezse oyuncu nedenini görür ("Satın alma hediyesinden
  gelen N jetonun takım teknolojisine bağışlanamaz …"); Teknoloji sekmesi ve hediye kartı da aynı kuralı yazar. Sıraya alınıp
  sıradan çıkarılan inşaat bedeli aynı ayrımla geri döner (aklama yok). Mağazadaki ilke satırı: "Takım hediyesindeki jeton takım
  teknolojisine bağışlanamaz." Göçten önce alınmış hediye jetonu ayırt edilemez ve bağışlanabilir kalır (gerçek para satın alımı
  henüz açılmadı, yalnız test mağazası). Test: `apps/server/test/pay-to-win.test.ts`.
- **Sezon Kartı (karar 30):** 28 gün, her güne 30 kristal, toplam tam 840. Girilmeyen günlerin kristali yanmaz, birikir ve sonraki
  girişte ödül kutusuna toplu gelir; 28. günden sonra hiçbir şey gelmez (eski "29. gün sabahı fazladan 30" hatası da kapandı).
  Tek seferlik alım, kendiliğinden yenilenmez.
