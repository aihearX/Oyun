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
| Bölüm sonuçları, yıldız, puan, XP, cüzdan (jeton, kristal), kamp, görevler, etkinlik katılımı | Sunucu | İlerleme, sıralama, ödüller | Hesap silinene kadar; bölüm kayıtları 30 gün |
| Takım, arkadaşlık, engelleme kayıtları | Sunucu | Sosyal özellikler ve güvenlik | Hesap silinene kadar |
| Şikâyet kayıtları (şikâyet eden, şikâyet edilen, neden) | Sunucu | Güvenlik, moderasyon | Hesap silindikten sonra 90 gün |
| Takım/genel sohbet mesajları | Sunucu | Sohbet | 30 gün; hesap silinince sizin yazdıklarınız hemen |
| Özel mesajlar | Sunucu | Mesajlaşma | Konuşma başına son 500 mesaj; hesap silinene kadar |
| Kod denemeleri (zaman, oyuncu kimliği, IP adresi) | Sunucu | Kötüye kullanımı önlemek | 90 gün (sonra otomatik silinir) |
| Satın alma makbuzu (Apple / Google üzerinden) | Sunucu + [RevenueCat] | Satın almayı doğrulamak, yasal yükümlülük | Yasal saklama süresi [hukuk danışmanı; ör. TTK m.82: 10 yıl]; hesap silinince makbuzdaki oyuncu kimliği "silinmiş" işaretiyle değişir |
| Veritabanı yedekleri | Sunucu | Veri kaybına karşı geri yükleme | 6 saatte bir, en çok 28 kopya (7 gün) |
| Bağlantı kayıtları (bağlandı/ayrıldı, hata) | Sunucu günlüğü | İşletim ve hata ayıklama | [süre — öneri: 14 gün] |

### Hesabınızı silince sunucuda ne olur
Hangi kaydın silindiği, anonimleştiği ya da gerekçeyle tutulduğu kodda tek bir tabloda yazılıdır (`apps/server/src/account-veri.ts`);
yeni bir kayıt türü eklenince karar vermeden geçilemez (otomatik test). Silme tek işlemde, hemen yapılır:
- **Silinir:** ilerleme, cüzdan, kamp (binalar, süsler, Kamp XP'si), görevler ve vakalar, etkinlik ve turnuva kayıtlarınız, sıralama
  ve lig satırlarınız, ödül kutunuz, arkadaşlıklarınız, istekleriniz, engellemeleriniz, özel mesajlarınız, sohbette yazdıklarınız ve
  sizin hakkınızdaki takım kartları, yardım istekleriniz, takım başvurularınız, ayarlarınız. Takımın son üyesiyseniz takım ve takıma
  ait bütün kayıtlar da silinir.
- **Anonimleşir** (yalnız başkalarının verisi bozulmasın diye): takımınızın toplam puanını oluşturan katkılarınız (düello puanı, takım
  yarışı yıldızı, ralli katılımı, takım kliniği), geçen haftanın son sıralamasındaki yeriniz, takıma gönderdiğiniz hediye. Bu
  kayıtlar artık hiçbir anahtarla eşleşmeyen anonim bir kimliğe bağlıdır; adınız her yerde "Silinmiş Oyuncu" olur. Sistem
  iletilerinde ve başkalarının ödül kutusundaki notlarda geçen adınız da silinir.
- **Gerekçeyle tutulur:** satın alma makbuzu (yasal saklama; oyuncu kimliği yerine "silinmiş" işareti), şikâyet kayıtları
  (moderasyon; 90 gün), kod denemeleri (güvenlik; 90 gün), hesabın silindiği bilgisi (kimlik + zaman; silinen hesabın sıralama
  ve aramada görünmemesi için).
- **Yedekler:** yedeklerdeki eski kopyalar tek tek silinmez; yedekler 7 günde döndüğü için silinen hesabın verisi en geç 7 gün
  sonra yedeklerden de çıkar.

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
- **Hesabı silme:** Ayarlar › Her şeyi sıfırla. Cihazdaki veriyle birlikte sunucudaki hesabınız hemen silinir (§2 "Hesabınızı
  silince sunucuda ne olur"); yedeklerdeki kopyalar en geç 7 gün içinde döner.
- Başvuru: [kvkk@… e-posta]. 30 gün içinde yanıtlanır.
- Kişisel Verileri Koruma Kurulu'na şikâyet hakkınız saklıdır.

## 7. Güvenlik
Bağlantı [wss:// (TLS)] ile şifrelenir. Sunucuda gizli anahtarın yalnızca özeti tutulur. Veritabanı yedekleri 7 gün saklanır
[şifreleme: sahip/hukuk danışmanı belirler].

## 8. Değişiklikler
Bu metin değişirse oyunda duyurulur; yürürlük tarihi güncellenir.
