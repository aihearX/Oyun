# TASLAK — Mağaza Listesi ve Beyanlar

> **TASLAK.** Sahibin onayı olmadan hiçbir mağazaya girilmez. Metinler oyunun bugün yaptığına göre yazıldı; abartı, sahte
> sayı, "milyonlarca oyuncu" gibi doğrulanamayan iddia yoktur (dürüstlük ilkesi).

## Kimlik
- **Ad (30 karakter):** ODİ: Sesin Yolu
- **Alt başlık (iOS, 30):** Kulağın içinde takım macerası
- **Kategori:** Oyun › Macera (ikincil: Eğitim — sahip kararı; Eğitim seçilirse Apple ek inceleme yapabilir)
- **Paket kimliği:** `com.aiheartech.odi` (iOS ve Android)
- **Destek URL'si / gizlilik URL'si:** [sahip — YN-009]

## Kısa açıklama (Google Play, 80 karakter)
Sesi kulaktan beyne taşı: takımını kur, kampını büyüt, kulağın sırlarını öğren.

## Uzun açıklama
Odi bir ses parçacığı. Görevi, her sesi kulağın girişinden beyne kadar taşımak.

- **Kulağın içinden 40 bölüm:** kulak kepçesinden kulak kanalına, kulak zarından Koklea'ya; koşu, trambolin, makine, yüzme, sinir impulsu ve rüya bölümleri, iki boss.
- **Takımınla oyna:** takım kur ya da başvur, Bölge Savaşı, haftalık Baskın, canlı Takım Yarışı ve Takım Ligi.
- **Kulak Kampı:** binaları kur, kampını büyüt, takım arkadaşlarına yardım et.
- **Kamp Görevleri:** kurgusal hasta vakaları, Ton Avı (yalnız sesle) ve Timpanogram Eşleştir.
- **Gerçek odyoloji:** içerikler odyoloji kaynaklarına göre hazırlandı [sahip doğrulamalı: "bir odyoloğun denetiminde" denebilir mi?]; oyun tanı koymaz, tıbbi tavsiye yerine geçmez.
- **Adil:** parayla güç satın alınmaz, ganimet kutusu yok, sahte sayaç yok.

## Yaş derecelendirmesi (öneri)
- Sohbet ve özel mesaj var (oyuncular arası iletişim) → Apple **12+** ("Kullanıcı tarafından üretilen içerik"), Google Play IARC
  anketinde "kullanıcılar etkileşim kurabilir" işaretlenir; beklenen PEGI 12 / USK 12 civarı.
- Hedef kitle: 13 yaş ve üzeri (docs/08 notu). 13 yaş altını hedeflemiyoruz; Google Play "Aileler" programına girilmez.
- Uygulama içi satın alma var (Apple / Google ödeme sistemi; ganimet kutusu yok) → beyan edilir.

## Apple beyanları
- **Hesap silme (5.1.1(v)):** Ayarlar › Her şeyi sıfırla sunucudaki hesabı da siler (YN-004).
- **Kullanıcı içeriği (1.2):** küfür filtresi, şikâyet, engelleme, 3 farklı kişiden şikâyette otomatik susturma; serbest yazı
  8. bölüme kadar kapalı. İletişim adresi: [sahip].
- **Gizlilik etiketi:** Toplanan veri — kullanıcı içeriği (sohbet), kimlik (rastgele oyuncu kimliği), satın alma geçmişi.
  İzleme (tracking): **yok**. Reklam: **yok**.
- **Şifreleme:** `ITSAppUsesNonExemptEncryption: false` (yalnızca standart TLS).

## Google Play beyanları
- **Veri güvenliği formu:** yukarıdakiyle aynı; veriler aktarım sırasında şifrelenir; kullanıcı silme isteyebilir (uygulama içinden).
- **Hedef kitle:** 13+. **Reklam içerir:** hayır. **Uygulama içi satın alma:** evet.

## Ekran görüntüleri (aday set, MK-022)
Aday kareler `tools/harness/vitrin.mjs` ile gerçek oyun durumundan çekilir. Araç gerçek sunucuyu ve web test derlemesini kullanır.
Tohumlama ui-mobile-check ile aynı yoldan yapılır. Yönetici kipi ve önizleme sayfası (`?demo=`) kullanılmaz. Oyuncu adları oyun
temalı kurgusal takma adlardır (Nota Avcısı, Zar Ustası, Örs Kaptan, Salyangoz). Hasta vakaları içerikteki kurgusal hastalardır.

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

- **Öneri (ilk üç kare):** iOS ve Google Play'de ilk üç kare en çok görülür. Sıra önerisi: 1, 3, 2 (oyun, kamp, harita); sonra 5,
  6, 8, 9.
- **Alt yazılar:** 9 ve 10'da "oyun tanı koymaz, tıbbi tavsiye yerine geçmez" notu uzun açıklamada zaten var. Alt yazı "tanı koy"
  dememeli.
- **Bilinen görünüm notları:**
  - Bölüm karesinde oyun tuvali 1:2 oranındadır. iOS karelerinde üstte ve altta, Android karesinde iki yanda koyu bant kalır.
    Cihazdaki görünüm de budur.
  - Bölüm karesinde üst gösterge, iOS durum çubuğunun yerine denk gelir. Çerçeve eklenecekse bu karede durum çubuğu çizilmemeli.
  - Yarış içinden kare yoktur. Bot kipinde yarış tuvali 1x çizilir ve mağaza boyutunda bulanık kalır. Gerçek cihazda tuval en çok 2x
    çizilir. Bu yüzden yarış için oda ekranı seçildi.
