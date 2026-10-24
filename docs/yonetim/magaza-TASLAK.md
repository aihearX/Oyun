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

## Ekran görüntüleri (hazırlanabilir)
`tools/harness/ui-mobile-check.mjs` 390×844 çıktıları ve `marketing/reels` karelerinden: harita, bölüm içi, kamp, takım, Kamp
Görevleri, sıralama. 6,7" (1290×2796) ve 5,5" iOS boyutları için yeniden çekim gerekir.
