# 07 · Yol Haritası

| Faz | Süre | Çıktı | Başarı ölçütü |
|---|---|---|---|
| **0 · Konsept onayı** | tamam | Bu dokümanlar | Onay ✅ |
| **1 · Dikey dilim** | 4 hafta | İnsan kulağı yolculuğu (40 bölüm, 6 mekanik, 2 boss), harita, Odi yetenek ağacı v1, juice, bot oyuncu, web davet linki | 20 kişilik kapalı test: D1 %45, "bir bölüm daha" oranı %70 |
| **2 · Sosyal çekirdek** | 4 hafta | Hesap, arkadaş, davet ödülü, hayaletler, can yardımı, günlük görev, seri, paylaşım kartları, lig v1 | Davet başına kurulum %15 |
| **3 · Takımlar** | 4 hafta | Takım, sohbet, haftalık keşif, boss, moderasyon, bildirimler | Takıma katılım %40, D7 %20 |
| **4 · Ekonomi ve mağaza** | 3 hafta | RevenueCat IAP, Odi Pass, kostümler, hızlandırıcılar, harcama limiti, sağlıklı oyun katmanı | Dönüşüm %3, iade <%1 |
| **5 · İçerik hattı** | 3 hafta | Admin paneli, level editor, 2. ve 3. yolculuk (Yarasa, Balina), uzaktan yapılandırma, kademeli yayın | Haftada bir yolculuk ritmi |
| **6 · Yumuşak lansman** | 4 hafta | Türkiye TestFlight/Play açık beta, A/B deneyleri, dengeleme | D30 %10, mağaza puanı 4,7 |
| **7 · Lansman** | — | App Store + Google Play + web (bağımsız uygulama); 3 Mart Dünya İşitme Günü etkinliği | İlk ay 50.000 kurulum |
| Sürekli | haftalık | Yeni yolculuk/parça, sezon, etkinlik, dengeleme | Tutma ve gelir eğrileri |

Fazlar sırayla ama örtüşerek ilerler; her faz sonunda oynanabilir sürüm ve test raporu vardır.

## Faz 1 durumu (dikey dilim)

Kodda hazır ve otomatik oyuncuyla doğrulanmış olanlar:

- **40 bölümlük İnsan Kulağı yolculuğu**: 10 biyom, 6 mekanik (koşu, trambolin, makine, yüzme, impuls, rüya), 2 boss (Serumen Golemi, Gürültü Canavarı), 8 hedef türü, 8 değiştirici.
- **Parça kütüphanesi**: koşu 38, yüzme 25, trambolin 17, makine 17, impuls 18, rüya 18 parça; deterministik üretici, ritim eğrisi, dinamik zorluk.
- **Juice**: parçacıklar, iniş tozu, jeton serisi, kıl payı bonusu, ilerleme çubuğu, titreşim, tonotopi renkleri ve sesleri.
- **Web kabuğu**: açılış, harita, sonuç ve paylaşım, yetenek ağacı, ayarlar, gün sayacı, PWA.
- **Mobil kabuk (Expo SDK 57)**: aynı motor DOM bileşeninde; Expo Go ile iPhone'da çalışır.
- **Bot harness**: 40 bölümün hepsi Chromium'da botla tamamlanıyor; her mekanikten bir bölüm ve iki boss WebKit'te de geçiyor.

Faz 1'de kalanlar: web davet linki (hayalet yarışı Faz 2 ile birlikte), 20 kişilik kapalı test ve ölçüm.

## Durum güncellemesi: ittifak çekirdeği

Kullanıcı geri bildirimiyle sıra değişti: Faz 2 (sosyal), Faz 3 (takımlar) ve Faz 4'ün mağaza kısmı öne alındı ve kodda hazır.

- **Takım (ittifak):** kurma, katılma, roller, takım sohbeti, bölüm yardımı.
- **Kulak Kampı:** süreli inşaat, "Herkese yardım et" ile hızlanma, hızlandırıcılar, depo.
- **Takım teknolojisi:** bağışla ortak bonuslar.
- **Takım hediyeleri ve haftalık takım hedefleri.**
- **Bölge Savaşı ve Baskın:** 12 bölgeli haftalık Bölge Savaşı; ortak can barlı haftalık Baskın.
- **Canlı yarış:** gerçek oyuncu hayaletleri ve oda sohbeti.
- **Sosyal:** arkadaşlar, 1-1 sohbet ve genel sohbet; haftalık lig.
- **Mağaza:** RevenueCat ile App Store / Google Play; geliştirmede açıkça etiketli test mağazası; harcama sınırı.
- **Bağlılık:** günlük görevler, 7 gün takvimi, 42 başarım, 50 Kulak Kartı, kozmetikler, hazine düğümleri, seri çarpanı, Şanslı Nota.

Kalanlar:
- push bildirimleri
- sunucunun kalıcı veritabanıyla internete açılması
- App Store Connect ürünlerinin ve RevenueCat anahtarlarının girilmesi
- 20 kişilik kapalı test
