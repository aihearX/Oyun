/**
 * Gizlilik ve hakkında metni (Ayarlar › Gizlilik ve hakkında). docs/yonetim/gizlilik-TASLAK.md'nin kısa hâli; sunucunun bugün
 * yaptığına göre yazıldı. Hukuk onayına kadar TASLAK; herkese açık adres yok. Kod değişirse bu metin ve taslak birlikte güncellenir.
 */
/** uygulama sürümü: apps/mobile/app.json "version" ile aynı olmalı (legal.test.ts denetler) */
export const APP_VERSION = '0.1.0';

export const PRIVACY_DRAFT = true;

export const PRIVACY_SECTIONS: { title: string; items: string[] }[] = [
  { title: 'Kısaca', items: [
    'Ad-soyad, e-posta, telefon, konum, rehber ya da reklam kimliği istemiyoruz.',
    'Oyunda reklam ve üçüncü taraf izleme/analitik aracı yok.',
  ] },
  { title: 'Bu cihazda', items: ['İlerlemen, ayarların ve ses tercihlerin.'] },
  { title: 'Oyun sunucusunda', items: [
    'Rastgele bir oyuncu kimliği ve gizli anahtarının yalnızca özeti.',
    'Takma adın, rengin, arkadaş kodun; bölüm sonuçların, yıldızların ve cüzdanın.',
    'Takım, arkadaşlık, engelleme ve şikâyet kayıtları.',
    'Genel ve takım sohbeti mesajları (30 gün), özel mesajlar (konuşma başına son 500).',
    'Kod denemeleri (zaman, oyuncu kimliği, IP adresi; 90 gün): kötüye kullanımı önlemek için.',
    'Satın almalar Apple ya da Google üzerinden yapılır; kart bilgin bize hiç gelmez.',
  ] },
  { title: 'Silme hakkın', items: [
    'Ayarlar › Her şeyi sıfırla: bu cihazdaki veriyle birlikte sunucudaki hesabın da silinir (ad, takım üyeliği, arkadaşlar, mesajlar).',
  ] },
];
