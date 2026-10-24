# TASLAK — Gizlilik Politikası ve KVKK Aydınlatma Metni

> **TASLAK.** Bu metin hukuk incelemesinden geçmedi; yayımlanmadan önce bir avukat (KVKK + GDPR) onaylamalıdır.
> Köşeli parantezli alanları sahibi doldurur. Metin, kodun bugün yaptığına göre yazıldı (sunucu: `apps/server`, depolama:
> cihazda AsyncStorage / localStorage). Kod değişirse bu metin de güncellenmelidir.

**Veri sorumlusu:** [aiHear şirket unvanı], [adres], [MERSİS / vergi no], iletişim: [kvkk@… e-posta adresi]
**Yürürlük tarihi:** [gg.aa.yyyy]

## 1. Kısaca
ODİ: Sesin Yolu hesap açarken **ad-soyad, e-posta, telefon, konum, rehber, reklam kimliği istemez**. Oyunda reklam ve
üçüncü taraf izleme/analitik aracı yoktur. Oyunu oynamak için gereken en az veriyi tutarız.

## 2. Hangi verileri işliyoruz?
| Veri | Nerede | Neden | Ne kadar süre |
|---|---|---|---|
| Oyun ilerlemesi, ayarlar, ses tercihleri | Cihazınızda | Oyunun çalışması | Siz silene kadar (Ayarlar › Her şeyi sıfırla) |
| Rastgele oyuncu kimliği ve gizli anahtar (sunucuda yalnızca anahtarın özeti) | Cihaz + sunucu | Hesabınızı tanımak | Hesap silinene kadar |
| Oyuncu adı (takma ad), renk, şapka, arkadaş kodu | Sunucu | Takım, arkadaş, sıralama | Hesap silinene kadar |
| Bölüm sonuçları, yıldız, puan, XP, cüzdan (jeton, kristal) | Sunucu | İlerleme, sıralama, ödüller | Hesap silinene kadar; bölüm kayıtları 30 gün |
| Takım, arkadaşlık, engelleme, şikâyet kayıtları | Sunucu | Sosyal özellikler ve güvenlik | Hesap silinene kadar |
| Takım/genel sohbet mesajları | Sunucu | Sohbet | 30 gün |
| Özel mesajlar | Sunucu | Mesajlaşma | Konuşma başına son 500 mesaj; hesap silinene kadar |
| Kod denemeleri (zaman, oyuncu kimliği, IP adresi) | Sunucu | Kötüye kullanımı önlemek | [süre — öneri: 90 gün] |
| Satın alma makbuzu (Apple / Google üzerinden) | Sunucu + [RevenueCat] | Satın almayı doğrulamak | Yasal saklama süresi |
| Bağlantı kayıtları (bağlandı/ayrıldı, hata) | Sunucu günlüğü | İşletim ve hata ayıklama | [süre — öneri: 14 gün] |

Kart ödeme bilgileriniz bize hiç gelmez; ödemeyi Apple veya Google alır.

## 3. Hukuki sebep (KVKK m.5)
Sözleşmenin kurulması ve ifası (oyunu sunmak), meşru menfaat (güvenlik, kötüye kullanımın önlenmesi), hukuki yükümlülük
(satın alma kayıtları). Pazarlama amaçlı işleme yoktur.

## 4. Aktarım
Veriler [barındırma sağlayıcısı, ülke — ör. Render.com, ABD / AB bölgesi] sunucularında tutulur. Yurt dışı aktarım için
[açık rıza / KVKK m.9 standart sözleşme] dayanağı: **hukuk danışmanı belirlemeli.** Satın alma doğrulaması için
[RevenueCat, ABD]. Başka üçüncü tarafa veri satılmaz, verilmez.

## 5. Çocuklar
Oyun [13] yaş ve üzeri içindir. Serbest yazılı sohbet, 8. bölüm geçilmeden açılmaz; o zamana kadar yalnız hazır sözler
kullanılır. Küfür filtresi, engelleme ve şikâyet vardır. [13 yaş altı için ebeveyn onayı politikası — hukuk danışmanı.]

## 6. Haklarınız (KVKK m.11 / GDPR m.15–22)
Verilerinize erişme, düzeltme, silme, işlemeye itiraz etme ve şikâyet hakkınız vardır.
- **Hesabı silme:** [Ayarlar › Hesabımı sil — henüz yok, bkz. is-listesi.md YN-004]. Silme isteğinden sonra sunucudaki
  adınız, arkadaşlıklarınız, takım üyeliğiniz ve özel mesajlarınız [N] gün içinde silinir.
- Başvuru: [kvkk@… e-posta]. 30 gün içinde yanıtlanır.
- Kişisel Verileri Koruma Kurulu'na şikâyet hakkınız saklıdır.

## 7. Güvenlik
Bağlantı [wss:// (TLS)] ile şifrelenir. Sunucuda gizli anahtarın yalnızca özeti tutulur. Veritabanı yedekleri [şifreli,
N gün] saklanır.

## 8. Değişiklikler
Bu metin değişirse oyunda duyurulur; yürürlük tarihi güncellenir.
