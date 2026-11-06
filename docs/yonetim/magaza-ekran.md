# Mağaza: ekran görüntüleri (MK-022)

> Liste metinleri, beyanlar (Veri güvenliği, IARC, App Privacy, yaş), ürün kataloğu ve yayın adımları artık
> [`marketing/magaza/`](../../marketing/magaza/) altında, yapıştırmaya hazır: [`YAYIN-LISTESI.md`](../../marketing/magaza/YAYIN-LISTESI.md),
> [`google-play.md`](../../marketing/magaza/google-play.md), [`app-store.md`](../../marketing/magaza/app-store.md),
> [`iap-urunler.md`](../../marketing/magaza/iap-urunler.md), [`metinler.json`](../../marketing/magaza/metinler.json).
> Bu dosyada yalnız ekran görüntüsü seti kaldı.

## Ekran görüntüleri (aday set, MK-022)
Aday kareler `tools/harness/vitrin.mjs` ile gerçek oyun durumundan çekilir. Araç gerçek sunucuyu ve web test derlemesini kullanır.
Tohumlama ui-mobile-check ile aynı yoldan yapılır. Yönetici kipi ve önizleme sayfası (`?demo=`) kullanılmaz. Oyuncu adları oyun
temalı kurgusal takma adlardır (Nota Avcısı, Zar Ustası, Örs Kaptan, Koklea Yolcusu). Hasta vakaları içerikteki kurgusal hastalardır.

- **Boyutlar:**
  - iOS 6,9": 1320×2868;
  - iOS 6,5": 1284×2778;
  - Android: 1080×1920.
- **Yazı ve çerçeve:** karelere yazı ya da cihaz çerçevesi eklenmez. Alt yazılar mağaza panelinde ayrıca girilir; marka kararı sahibin.
- **Seçim:** sahip seçer. PNG'ler depoda tutulmaz. Yeniden çekmek için: `node tools/harness/vitrin.mjs --out <klasör>`.
- **Dosya adları:** her boyutta aynıdır, `<boyut-klasörü>/<dosya>`. Klasörler `ios-6.9-1320x2868/`, `ios-6.5-1284x2778/`,
  `android-1080x1920/`.

| # | Dosya | Ekran | Alt yazı önerisi |
|---|---|---|---|
| 1 | `01-bolum.png` | Bölüm oynanışı (25. bölüm, Koklea): Odi, notalar ve bir düşman aynı karede | Kulağın içinde koş: notaları topla, engelleri aş. |
| 2 | `02-harita.png` | Yaşayan Kulak Haritası (24. bölüm; geçilen bölgeler canlanmış) | Kulak kepçesinden beyne 40 bölüm. |
| 3 | `03-kamp.png` | Kulak Kampı (Merkez Sv 16, Kamp Seviyesi 18, süren inşaat) | Kulak Kampı'nı kur, binalarını büyüt. |
| 4 | `04-hikaye.png` | Kampın Hikâyesi (Görevler paneli, 4. bölüm) | Kampın Hikâyesi: ödülü baştan belli görevler. |
| 5 | `05-sohbet.png` | Takım sohbeti: yalnız hazır sözler ve takımın akış kartları | Takımınla oyna, hazır sözlerle güvenle konuş. |
| 6 | `06-yaris.png` | Canlı yarış odası: üç oyuncu, hazır durumları, hazır sözlerle oda sohbeti | Arkadaşlarınla canlı yarış: rakiplerin gerçek oyuncu. |
| 7 | `07-sonuc.png` | Sonuç ekranı, 3 yıldız (botun gerçekten oynadığı bölüm) | Üç yıldızın peşinde. |
| 8 | `08-tuy-dede.png` | Yeni bölge tanıtımı ve Tüy Dede'nin Notu | Tüy Dede'den gerçek kulak bilgisi. |
| 9 | `09-vaka.png` | Klinik: kurgusal hasta vakası, timpanogram ve odyogram | Kurgusal hasta vakalarında odyogram oku. |
| 10 | `10-defter.png` | Vaka Defteri (on vaka çözülmüş) | Vaka Defteri'ni doldur, yıldızları topla. |
| 11 | `11-yaris-ici.png` | Canlı yarış içi | **Elendi** (2026-11-06): iki çekimde de rakip hayaletleri karede görünmedi, solda kesik "Kontrol noktası" yazısı, yarış şeridi "Nota x/7" göstergesinin üstüne biniyor. Set ve zip'te yok |
| 12 | `12-magaza.png` | Profil › Mağaza (mağaza derlemesindeki kip: TL liste fiyatı + "ödeyeceğin tutarı App Store / Google Play gösterir" notu, aylık harcama sınırı kartı) | Mağaza: içerik önceden yazılı, şans yok. (Vitrin için değil; asıl kullanım App Store inceleme görüntüsü) |

**App Store inceleme görüntüleri (uygulama içi ürünler):** aynı çekimde `iap-inceleme/` klasörüne, yalnız iOS 6,9" boyutunda:
her ürünün satın alma penceresi (`odi.baslangic.png` … `odi.pass.png`) ve ilk satın almadan önceki sınır seçimi
(`harcama-siniri.png`). Hangi ürüne hangi dosya: dosya adı ürün kimliğidir ([`iap-urunler.md`](../../marketing/magaza/iap-urunler.md)).

**2026-11-06 seti (sürüm 1.0.0 gönderimi için):** `node tools/harness/vitrin.mjs --out /home/user/magaza-ekranlar` (main 5f7c3df),
sahibe `/home/user/magaza-ekranlar.zip`. 11 kare × 3 boyut + 8 inceleme karesi = 41 PNG; hepsi RGB (saydamlık yok, Apple'ın istediği
gibi). Kareler tek tek gözle denetlendi: boş, test yazısı, gerçek kişi adı, "yönetici" ya da hata içeren kare yok. Küçük notlar:
Android 07'de alttaki "Seviye 21!" yazısı kaydırma kenarında yarım görünüyor (iOS boyutlarında yok); 06'da oda kodu oyunun gerçek
oda kimliği (uzun harf-rakam dizisi) olarak görünüyor.

- **Öneri (ilk üç kare):** iOS ve Google Play'de ilk üç kare en çok görülür. Sıra önerisi: 1, 3, 2 (oyun, kamp, harita); sonra 5,
  6, 8, 9, 7, 10 (en çok 10 kare; 12 yalnız inceleme için). Google Play telefon için en az 2, en çok 8 kare: 1, 3, 2, 5, 6, 8, 9, 7.
- **Alt yazılar:** 9 ve 10'da "oyun tanı koymaz, tıbbi tavsiye yerine geçmez" notu uzun açıklamada zaten var. Alt yazı "tanı koy"
  dememeli.
- **Bilinen görünüm notları:**
  - Bölüm karesinde oyun tuvali 1:2 oranındadır. iOS karelerinde üstte ve altta, Android karesinde iki yanda koyu bant kalır.
    Cihazdaki görünüm de budur.
  - Bölüm karesinde üst gösterge, iOS durum çubuğunun yerine denk gelir. Çerçeve eklenecekse bu karede durum çubuğu çizilmemeli.
  - Yarış içi kare (11) araçta var ama bu sette elendi (yukarıda). Yarış için oda ekranı (06) kullanılır.
