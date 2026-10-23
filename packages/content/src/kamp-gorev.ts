/**
 * Kamp Görevleri ve kamp etkinlikleri (docs/17-kamp-gorevleri.md): Tüy Dede'nin hikâye zinciri "Kampın Hikâyesi", günlük kamp
 * görevleri (3/gün, bir kez değiştirilebilir), haftalık kamp hedefi, başarı basamakları, takım kliniği hedefi, kamp oyunları
 * (Ton Avı, Timpanogram Eşleştir) ve ödül/sınır kuralları. Sunucu (apps/server/src/camp-quests*.ts) ve istemci aynı tanımları okur.
 *
 * Dürüstlük: sahte aciliyet yok (vakalar takvimle gelir ve bekler, süre baskısı yok), ödüller önceden görünür, oyunların ödülü
 * günlük sınırla (sınırdan sonra yalnız eğlence için oynanır). Ödüller ekonomi/kozmetik/bilgi ağırlıklıdır; bölüm zorluğunu
 * bozmaz (jeton az; Kamp XP, süs ve bilgi ağırlıklı). Ton Avı bir işitme testi DEĞİLDİR (ekranda ve Tüy Dede'nin sözünde yazar).
 */
import type { BuildingId, KampOdul } from '@odi/shared';
import { VAKALAR } from './kamp-gorev-vakalar';
import { decorById } from './kamp-susler';
import { type BilgiDuzeyi, type Timp, type TipTimp } from './kamp-gorev-vaka';

export * from './kamp-gorev-vaka';
export * from './kamp-gorev-vakalar';

// ---------------------------------------------------------------- açılış ve kurallar

/** özelliklerin açıldığı geçilen bölüm sayısı (apps/web/src/ftue/features.ts bu sayıları kullanır; sunucu da aynısını uygular) */
export const KG_ACILIS = { gorev: 4, oyun: 6, vaka: 7 } as const;
export type KgOzellik = keyof typeof KG_ACILIS;

export const KG_KURAL = {
  /** her gün kliniğe gelen yeni hasta (bekleme salonu dolu değilse) ve salonun alabileceği en çok hasta */
  vakaGunluk: 3, vakaSalon: 6,
  /** zorluk kademesinin açıldığı Odyoloji Kliniği seviyesi */
  kademeSv: [1, 4, 7] as const,
  /** kamp oyunlarında günde ödüllü tur (sonrası yalnız eğlence) */
  oyunOdulluTur: 5,
  /** bir oyun turu en az bu kadar sürer (ms; sunucu daha kısa turu kabul etmez) */
  oyunEnAzMs: { ton: 8 * 1200, timpano: 5 * 1500 } as const,
  tonDeneme: 8, timpanoBulmaca: 5,
  /** konsültasyon: günde en çok soru; görüş bildirene günde en çok ödüllü oy */
  konsultGunluk: 3, konsultOyOdullu: 5,
  /** günlük görev sayısı ve değiştirme hakkı */
  gunlukGorev: 3, degistirme: 1,
  /** takım kliniği haftalık hedefi (takımca çözülen yeni vaka) */
  takimHedef: 12,
} as const;

/** ödüller (hepsi sabit ve önceden görünür) */
export const KG_ODUL = {
  /** vakanın ilk çözümü: taban + her yıldız; tekrar oynanınca yalnız yeni kazanılan yıldızlar ödüllenir */
  vakaTaban: { jeton: 10, kampXp: 15 } satisfies KampOdul,
  vakaYildiz: { jeton: 5, kampXp: 5 } satisfies KampOdul,
  oyunTur: { jeton: 4, kampXp: 5 } satisfies KampOdul,
  gunluk: { jeton: 15, kampXp: 15 } satisfies KampOdul,
  konsultOy: { jeton: 5, kampXp: 3 } satisfies KampOdul,
  konsultSoran: { jeton: 5, kampXp: 3 } satisfies KampOdul,
  takim: { kristal: 3, kampXp: 40 } satisfies KampOdul,
} as const;

// ---------------------------------------------------------------- ölçütler

/**
 * Sayaçlar (olaydan, sunucuda; toplam + gün + hafta): depo-topla, malzeme, malzeme-kullan, insaat, yardim, vaka (çözüm),
 * vaka-tekrar, vaka-3yildiz, ton, ton-iyi, timpano, oyun (ton + timpano), konsult (soru + oy), bolum, gunluk, dekor-yerlestir, ziyaret.
 * Durum ölçütleri (anlık): bina:<id>, bina-toplam, defter, defter-yildiz, patoloji, bolge, takim, hikaye, kamp-sv, dekor.
 */
export type KgSayac = 'depo-topla' | 'malzeme' | 'malzeme-kullan' | 'insaat' | 'yardim' | 'vaka' | 'vaka-tekrar' | 'vaka-3yildiz'
  | 'ton' | 'ton-iyi' | 'timpano' | 'oyun' | 'konsult' | 'bolum' | 'gunluk' | 'dekor-yerlestir' | 'ziyaret';
export type KgDurum = `bina:${BuildingId}` | 'bina-toplam' | 'defter' | 'defter-yildiz' | 'patoloji' | 'bolge' | 'takim' | 'hikaye' | 'kamp-sv' | 'dekor';
export type KgOlcut = KgSayac | KgDurum;
export const KG_SAYACLAR: KgSayac[] = ['depo-topla', 'malzeme', 'malzeme-kullan', 'insaat', 'yardim', 'vaka', 'vaka-tekrar', 'vaka-3yildiz', 'ton', 'ton-iyi', 'timpano', 'oyun', 'konsult', 'bolum', 'gunluk', 'dekor-yerlestir', 'ziyaret'];
/** kamp büyümesine (Kamp Seviyesi, dekor, ziyaret) bağlı ölçütler: büyüme sistemi yoksa bu adımlar gösterilmez */
export const KG_BUYUME_OLCUT: KgOlcut[] = ['dekor-yerlestir', 'ziyaret', 'kamp-sv', 'dekor'];

/** bir görevin açılma şartı */
export interface KgSart { bina?: [BuildingId, number]; takim?: true; ozellik?: KgOzellik }
/** resimli simge adı (apps/web/src/camp/gorev/art.tsx) */
export type KgArt = 'depo' | 'insaat' | 'klinik' | 'defter' | 'ton' | 'timpano' | 'malzeme' | 'takim' | 'harita' | 'yildiz' | 'dekor' | 'ziyaret' | 'kamp' | 'gorev' | 'bolum';
export interface KgAdim { id: string; text: string; olcut: KgOlcut; need: number; art: KgArt; sart?: KgSart }

// ---------------------------------------------------------------- Kampın Hikâyesi (Tüy Dede)

export interface KgBolumDef {
  no: number; title: string;
  /** Tüy Dede satırları (apps/web/src/ftue/script.ts): bölüm açılınca / ödül alınınca */
  intro: string; outro: string;
  steps: KgAdim[]; reward: KampOdul;
}
const B = (id: BuildingId, need: number, text: string, art: KgArt = 'insaat'): KgAdim => ({ id: `${id}-${need}`, text, olcut: `bina:${id}`, need, art });
export const KG_HIKAYE: KgBolumDef[] = [
  { no: 1, title: 'Kampa Hoş Geldin', intro: 'kg-h1-giris', outro: 'kg-h1-son', reward: { jeton: 80, kampXp: 60, m5: 2 },
    steps: [B('depo', 1, 'Kulak Deposu’nu kur', 'depo'), { id: 'depo-topla', text: 'Kulak Deposu’ndan jeton topla', olcut: 'depo-topla', need: 1, art: 'depo' }, B('merkez', 2, 'Odyoloji Merkezi’ni Sv 2’ye yükselt', 'kamp')] },
  { no: 2, title: 'Klinik Açılıyor', intro: 'kg-h2-giris', outro: 'kg-h2-son', reward: { kristal: 3, kampXp: 80, dekor: 'vaka-panosu' },
    steps: [B('revir', 1, 'Odyoloji Kliniği’ni kur', 'klinik'), B('laboratuvar', 1, 'Odyometri Odası’nı kur', 'ton'), B('kule', 1, 'Timpanometri Kulesi’ni kur', 'timpano')] },
  { no: 3, title: 'Ölçmeyi Öğren', intro: 'kg-h3-giris', outro: 'kg-h3-son', reward: { jeton: 100, kampXp: 100, m60: 1 },
    steps: [
      { id: 'ton', text: 'Odyometri Odası’nda bir tur Ton Avı oyna', olcut: 'ton', need: 1, art: 'ton', sart: { ozellik: 'oyun', bina: ['laboratuvar', 1] } },
      { id: 'timpano', text: 'Kulede bir tur Timpanogram Eşleştir oyna', olcut: 'timpano', need: 1, art: 'timpano', sart: { ozellik: 'oyun', bina: ['kule', 1] } },
      { id: 'bina-toplam-12', text: 'Binalarının seviyeleri toplamı 12 olsun', olcut: 'bina-toplam', need: 12, art: 'kamp' },
    ] },
  { no: 4, title: 'İlk Hastalar', intro: 'kg-h4-giris', outro: 'kg-h4-son', reward: { kristal: 5, kampXp: 120, dekor: 'dede-banki' },
    steps: [
      { id: 'vaka-1', text: 'İlk vakanı çöz', olcut: 'vaka', need: 1, art: 'klinik', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
      { id: 'defter-3', text: 'Vaka Defteri’nde 3 vaka biriktir', olcut: 'defter', need: 3, art: 'defter', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
      { id: 'defter-yildiz-6', text: 'Vaka Defteri’nde 6 yıldız topla', olcut: 'defter-yildiz', need: 6, art: 'yildiz', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
    ] },
  { no: 5, title: 'Koruma Sanatı', intro: 'kg-h5-giris', outro: 'kg-h5-son', reward: { jeton: 120, kampXp: 140, malzeme: 'kulak-tikaci', malzemeN: 2 },
    steps: [
      B('tedavi', 1, 'Tedavi Odası’nı kur', 'malzeme'),
      { id: 'malzeme-3', text: 'Tedavi Odası’ndan 3 malzeme topla', olcut: 'malzeme', need: 3, art: 'malzeme', sart: { bina: ['tedavi', 1] } },
      { id: 'malzeme-kullan', text: 'Bir bölümde malzeme kullan', olcut: 'malzeme-kullan', need: 1, art: 'bolum', sart: { bina: ['tedavi', 1] } },
    ] },
  { no: 6, title: 'Takım Ruhu', intro: 'kg-h6-giris', outro: 'kg-h6-son', reward: { kristal: 5, kampXp: 160, dekor: 'kulaklik-salincak' },
    steps: [
      { id: 'takim', text: 'Bir takıma katıl', olcut: 'takim', need: 1, art: 'takim' },
      { id: 'yardim-3', text: 'Takım arkadaşlarının inşaatına 3 yardım et', olcut: 'yardim', need: 3, art: 'takim', sart: { takim: true } },
      { id: 'konsult-1', text: 'Bir konsültasyon iste ya da görüş bildir', olcut: 'konsult', need: 1, art: 'klinik', sart: { takim: true, ozellik: 'vaka' } },
    ] },
  { no: 7, title: 'Kampını Güzelleştir', intro: 'kg-h7-giris', outro: 'kg-h7-son', reward: { kristal: 5, kampXp: 180, m60: 2 },
    steps: [
      { id: 'dekor-yerlestir', text: 'Kampına bir süs yerleştir', olcut: 'dekor-yerlestir', need: 1, art: 'dekor' },
      { id: 'ziyaret', text: 'Bir arkadaşının ya da takım arkadaşının kampını ziyaret et', olcut: 'ziyaret', need: 1, art: 'ziyaret' },
      { id: 'kamp-sv-3', text: 'Kamp Seviyesi 3’e ulaş', olcut: 'kamp-sv', need: 3, art: 'kamp' },
    ] },
  { no: 8, title: 'Uzman Klinik', intro: 'kg-h8-giris', outro: 'kg-h8-son', reward: { kristal: 8, kampXp: 220, dekor: 'odyogram-tarhi' },
    steps: [
      B('revir', 4, 'Odyoloji Kliniği’ni Sv 4’e yükselt', 'klinik'),
      { id: 'defter-12', text: 'Vaka Defteri’nde 12 vaka biriktir', olcut: 'defter', need: 12, art: 'defter', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
      { id: 'vaka-3yildiz-5', text: '5 vakayı 3 yıldızla çöz', olcut: 'vaka-3yildiz', need: 5, art: 'yildiz', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
    ] },
  { no: 9, title: 'Kulağın Derinlikleri', intro: 'kg-h9-giris', outro: 'kg-h9-son', reward: { kristal: 10, kampXp: 260, m60: 3 },
    steps: [
      { id: 'bolge-5', text: 'Haritada Koklea bölgesine ulaş', olcut: 'bolge', need: 5, art: 'harita' },
      B('kule', 5, 'Timpanometri Kulesi’ni Sv 5’e yükselt', 'timpano'),
      { id: 'patoloji-10', text: 'Vaka Defteri’nde 10 farklı patoloji gör', olcut: 'patoloji', need: 10, art: 'defter', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
    ] },
  { no: 10, title: 'Büyük Kamp', intro: 'kg-h10-giris', outro: 'kg-h10-son', reward: { kristal: 15, kampXp: 400, dekor: 'altin-kulak' },
    steps: [
      B('merkez', 8, 'Odyoloji Merkezi’ni Sv 8’e yükselt', 'kamp'),
      B('revir', 7, 'Odyoloji Kliniği’ni Sv 7’ye yükselt', 'klinik'),
      { id: 'defter-25', text: 'Vaka Defteri’nde 25 vaka biriktir', olcut: 'defter', need: 25, art: 'defter', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
    ] },
];

// ---------------------------------------------------------------- günlük kamp görevleri

export interface KgGunlukDef extends KgAdim { /** havuzda seçilme ağırlığı */ w: number }
export const KG_GUNLUK: KgGunlukDef[] = [
  { id: 'g-depo', text: 'Kulak Deposu’ndan jeton topla', olcut: 'depo-topla', need: 1, art: 'depo', w: 3, sart: { bina: ['depo', 1] } },
  { id: 'g-insaat', text: 'Kampta bir inşaat başlat', olcut: 'insaat', need: 1, art: 'insaat', w: 2 },
  { id: 'g-malzeme', text: 'Tedavi Odası’ndan 2 malzeme topla', olcut: 'malzeme', need: 2, art: 'malzeme', w: 2, sart: { bina: ['tedavi', 1] } },
  { id: 'g-malzeme-kullan', text: 'Bir bölüme malzemeyle çık ve kullan', olcut: 'malzeme-kullan', need: 1, art: 'bolum', w: 1, sart: { bina: ['tedavi', 1] } },
  { id: 'g-vaka', text: 'Klinikte bir vaka çöz', olcut: 'vaka', need: 1, art: 'klinik', w: 4, sart: { ozellik: 'vaka', bina: ['revir', 1] } },
  { id: 'g-vaka-tekrar', text: 'Vaka Defteri’nden bir vakayı yeniden çöz', olcut: 'vaka-tekrar', need: 1, art: 'defter', w: 1, sart: { ozellik: 'vaka', bina: ['revir', 1] } },
  { id: 'g-ton', text: 'Bir tur Ton Avı oyna', olcut: 'ton', need: 1, art: 'ton', w: 3, sart: { ozellik: 'oyun', bina: ['laboratuvar', 1] } },
  { id: 'g-ton-iyi', text: 'Ton Avı’nda 8’de 7 ya da daha iyi yap', olcut: 'ton-iyi', need: 1, art: 'ton', w: 1, sart: { ozellik: 'oyun', bina: ['laboratuvar', 1] } },
  { id: 'g-timpano', text: 'Bir tur Timpanogram Eşleştir oyna', olcut: 'timpano', need: 1, art: 'timpano', w: 3, sart: { ozellik: 'oyun', bina: ['kule', 1] } },
  { id: 'g-yardim', text: 'Takım arkadaşlarının inşaatına 2 yardım et', olcut: 'yardim', need: 2, art: 'takim', w: 2, sart: { takim: true } },
  { id: 'g-bolum', text: 'Haritada bir bölüm geç', olcut: 'bolum', need: 1, art: 'bolum', w: 1 },
  { id: 'g-dekor', text: 'Kampına bir süs yerleştir', olcut: 'dekor-yerlestir', need: 1, art: 'dekor', w: 1 },
  { id: 'g-ziyaret', text: 'Bir arkadaşının ya da takım arkadaşının kampını ziyaret et', olcut: 'ziyaret', need: 1, art: 'ziyaret', w: 1, sart: { takim: true } },
];

// ---------------------------------------------------------------- haftalık kamp hedefi

export interface KgHaftaDef { id: string; text: string; olcut: KgSayac; tiers: [number, number, number]; art: KgArt; sart?: KgSart }
export const KG_HAFTA: KgHaftaDef[] = [
  { id: 'h-gunluk', text: 'Bu hafta günlük kamp görevlerini tamamla', olcut: 'gunluk', tiers: [4, 8, 12], art: 'gorev' },
  { id: 'h-vaka', text: 'Bu hafta klinikte vaka çöz', olcut: 'vaka', tiers: [3, 6, 9], art: 'klinik', sart: { ozellik: 'vaka', bina: ['revir', 1] } },
  { id: 'h-oyun', text: 'Bu hafta kamp oyunlarında tur tamamla', olcut: 'oyun', tiers: [5, 10, 15], art: 'ton', sart: { ozellik: 'oyun', bina: ['laboratuvar', 1] } },
  { id: 'h-malzeme', text: 'Bu hafta Tedavi Odası’ndan malzeme topla', olcut: 'malzeme', tiers: [5, 10, 15], art: 'malzeme', sart: { bina: ['tedavi', 1] } },
];
export const KG_HAFTA_ODUL: [KampOdul, KampOdul, KampOdul] = [
  { jeton: 40, kampXp: 50 },
  { kristal: 3, kampXp: 80 },
  { kristal: 5, kampXp: 120, m60: 1 },
];

// ---------------------------------------------------------------- başarı basamakları

export interface KgBasariDef { id: string; title: string; text: string; olcut: KgOlcut; art: KgArt; tiers: { need: number; reward: KampOdul }[]; sart?: KgSart }
const toplamVaka = VAKALAR.length;
export const KG_BASARI: KgBasariDef[] = [
  { id: 'b-defter', title: 'Vaka Defteri', text: 'Farklı vakaları çöz', olcut: 'defter', art: 'defter', sart: { ozellik: 'vaka', bina: ['revir', 1] },
    tiers: [{ need: 5, reward: { kristal: 3, kampXp: 60 } }, { need: 15, reward: { kristal: 5, kampXp: 120, dekor: 'stereosilya' } }, { need: 25, reward: { kristal: 8, kampXp: 200 } }, { need: toplamVaka, reward: { kristal: 12, kampXp: 300, dekor: 'altin-diyapazon' } }] },
  { id: 'b-yildiz', title: 'Yıldızlı Klinisyen', text: 'Vaka Defteri’nde yıldız topla', olcut: 'defter-yildiz', art: 'yildiz', sart: { ozellik: 'vaka', bina: ['revir', 1] },
    tiers: [{ need: 20, reward: { kristal: 3, kampXp: 60 } }, { need: 50, reward: { kristal: 5, kampXp: 120 } }, { need: toplamVaka * 3, reward: { kristal: 10, kampXp: 250, dekor: 'dalga-havuz' } }] },
  { id: 'b-patoloji', title: 'Kulak Ansiklopedisi', text: 'Vakalarda farklı patolojiler gör', olcut: 'patoloji', art: 'defter', sart: { ozellik: 'vaka', bina: ['revir', 1] },
    tiers: [{ need: 6, reward: { kristal: 3, kampXp: 60 } }, { need: 12, reward: { kristal: 5, kampXp: 120 } }, { need: 18, reward: { kristal: 8, kampXp: 200, dekor: 'kepce-cardak' } }] },
  { id: 'b-ton', title: 'Ton Avcısı', text: 'Ton Avı turu oyna', olcut: 'ton', art: 'ton', sart: { ozellik: 'oyun', bina: ['laboratuvar', 1] },
    tiers: [{ need: 10, reward: { jeton: 40, kampXp: 40 } }, { need: 50, reward: { kristal: 4, kampXp: 100, dekor: 'diyapazon' } }, { need: 150, reward: { kristal: 8, kampXp: 200 } }] },
  { id: 'b-timpano', title: 'Eğri Ustası', text: 'Timpanogram Eşleştir turu oyna', olcut: 'timpano', art: 'timpano', sart: { ozellik: 'oyun', bina: ['kule', 1] },
    tiers: [{ need: 10, reward: { jeton: 40, kampXp: 40 } }, { need: 50, reward: { kristal: 4, kampXp: 100, dekor: 'ostaki-kemer' } }, { need: 150, reward: { kristal: 8, kampXp: 200 } }] },
  { id: 'b-malzeme', title: 'Kampın Eczacısı', text: 'Tedavi Odası’ndan malzeme topla', olcut: 'malzeme', art: 'malzeme', sart: { bina: ['tedavi', 1] },
    tiers: [{ need: 10, reward: { jeton: 40, kampXp: 40 } }, { need: 50, reward: { kristal: 4, kampXp: 100 } }, { need: 200, reward: { kristal: 8, kampXp: 200, dekor: 'tikac-puf' } }] },
  { id: 'b-yardim', title: 'Yardımsever Komşu', text: 'Takım arkadaşlarının inşaatına yardım et', olcut: 'yardim', art: 'takim', sart: { takim: true },
    tiers: [{ need: 10, reward: { jeton: 40, kampXp: 40 } }, { need: 50, reward: { kristal: 4, kampXp: 100 } }, { need: 200, reward: { kristal: 8, kampXp: 200, dekor: 'dalga-cit' } }] },
  { id: 'b-konsult', title: 'Konsey Üyesi', text: 'Konsültasyon iste ya da görüş bildir', olcut: 'konsult', art: 'klinik', sart: { takim: true, ozellik: 'vaka' },
    tiers: [{ need: 3, reward: { jeton: 30, kampXp: 40 } }, { need: 15, reward: { kristal: 4, kampXp: 100 } }, { need: 50, reward: { kristal: 8, kampXp: 200 } }] },
  { id: 'b-depo', title: 'Depo Bekçisi', text: 'Kulak Deposu’ndan jeton topla', olcut: 'depo-topla', art: 'depo', sart: { bina: ['depo', 1] },
    tiers: [{ need: 10, reward: { jeton: 30, kampXp: 30 } }, { need: 100, reward: { kristal: 4, kampXp: 100 } }, { need: 300, reward: { kristal: 8, kampXp: 200 } }] },
  { id: 'b-mimar', title: 'Kamp Mimarı', text: 'Binalarının seviyeleri toplamı', olcut: 'bina-toplam', art: 'kamp',
    tiers: [{ need: 15, reward: { kristal: 3, kampXp: 60 } }, { need: 40, reward: { kristal: 6, kampXp: 150 } }, { need: 80, reward: { kristal: 10, kampXp: 300, dekor: 'kanal-heykel' } }] },
  { id: 'b-hikaye', title: 'Kampın Hikâyesi', text: 'Tüy Dede’nin hikâyesinde bölüm bitir', olcut: 'hikaye', art: 'gorev',
    tiers: [{ need: 3, reward: { kristal: 3, kampXp: 60 } }, { need: 6, reward: { kristal: 6, kampXp: 150 } }, { need: 10, reward: { kristal: 10, kampXp: 300 } }] },
  { id: 'b-gunluk', title: 'Her Gün Kampta', text: 'Günlük kamp görevi tamamla', olcut: 'gunluk', art: 'gorev',
    tiers: [{ need: 10, reward: { jeton: 40, kampXp: 40 } }, { need: 50, reward: { kristal: 5, kampXp: 120 } }, { need: 150, reward: { kristal: 10, kampXp: 250, dekor: 'cihaz-saksi' } }] },
];

// ---------------------------------------------------------------- dekorlar
// Görev ödülü olan dekorlar kamp büyümesi sisteminin süs kataloğundandır (kamp-susler.ts DECORATIONS; yerleştirme orada).

// ---------------------------------------------------------------- yardımcılar (sunucu ve istemci)

/** sabit tohumlu basit rastgele (mulberry32) */
export function kgRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** sabit tohumlu karıştırma (Fisher–Yates; sort'a rastgele karşılaştırıcı vermek motorlar arasında farklı sonuç verir) */
export function kgKaristir<T>(xs: readonly T[], r: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
export function kgHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }

/** Odyoloji Kliniği seviyesine göre açık en yüksek vaka kademesi (0: klinik yok) */
export function vakaKademesi(klinikSv: number): 0 | 1 | 2 | 3 {
  return klinikSv >= KG_KURAL.kademeSv[2] ? 3 : klinikSv >= KG_KURAL.kademeSv[1] ? 2 : klinikSv >= KG_KURAL.kademeSv[0] ? 1 : 0;
}
/** ödülün kısa metni (kartlarda; jeton yazılı, seslendirilmez) */
export function odulMetni(o: KampOdul): string[] {
  const out: string[] = [];
  if (o.jeton) out.push(`${o.jeton} jeton`);
  if (o.kristal) out.push(`${o.kristal} kristal`);
  if (o.kampXp) out.push(`${o.kampXp} Kamp XP`);
  if (o.m5) out.push(`${o.m5} × 5 dk hızlandırıcı`);
  if (o.m60) out.push(`${o.m60} × 60 dk hızlandırıcı`);
  if (o.dekor) out.push(`Süs: ${decorById(o.dekor)?.name ?? 'süs'}`);
  if (o.malzeme) out.push(`${o.malzemeN ?? 1} malzeme`);
  return out;
}

// ---------------------------------------------------------------- Ton Avı (Odyometri Odası) — bir işitme testi DEĞİLDİR

export type TonDeneme =
  | { tur: 'var'; /** bu denemede ses çalınacak mı */ var: boolean; hz: number; /** dinleme penceresinde başlama anı (ms) */ at: number }
  | { tur: 'ince'; a: number; b: number; /** daha ince (yüksek frekanslı) olan: 0 ilk, 1 ikinci */ dogru: 0 | 1 };
const TON_HZ = [500, 750, 1000, 1500, 2000, 3000, 4000];
/** tohumdan bir tur: 8 deneme (yarısı "ses var mı?", yarısı "hangisi daha ince?"); genel düzeyde perde farkı daha büyük */
export function tonTuru(seed: number, duzey: BilgiDuzeyi): TonDeneme[] {
  const r = kgRng(seed); const out: TonDeneme[] = [];
  const kinds = kgKaristir([0, 0, 0, 0, 1, 1, 1, 1], r);
  for (const k of kinds) {
    const hz = TON_HZ[Math.floor(r() * TON_HZ.length)]!;
    if (k === 0) out.push({ tur: 'var', var: r() < 0.6, hz, at: 300 + Math.round(r() * 1200) });
    else {
      const ratio = duzey === 'genel' ? 1.5 + r() * 0.5 : 1.12 + r() * 0.14;
      const up = r() < 0.5; const other = Math.round(up ? hz * ratio : hz / ratio);
      out.push({ tur: 'ince', a: hz, b: other, dogru: other > hz ? 1 : 0 });
    }
  }
  return out;
}
/** cevaplar: "var" için 1 = ses vardı, 0 = yoktu; "ince" için 0/1 */
export function tonPuani(d: TonDeneme[], cevap: number[]): number {
  return d.reduce((n, x, i) => n + ((x.tur === 'var' ? (x.var ? 1 : 0) : x.dogru) === cevap[i] ? 1 : 0), 0);
}

// ---------------------------------------------------------------- Timpanogram Eşleştir (Timpanometri Kulesi)

export type EgriTur = 'A' | 'As' | 'Ad' | 'B-normal' | 'B-buyuk' | 'B-kucuk' | 'C';
export const EGRI_ADI: Record<EgriTur, { sade: string; teknik: string }> = {
  'A': { sade: 'Normal: zar rahat hareket ediyor', teknik: 'Tip A' },
  'As': { sade: 'Sert zar ya da takılı kemikçik', teknik: 'Tip As (sığ)' },
  'Ad': { sade: 'Çok gevşek zar ya da kopuk zincir', teknik: 'Tip Ad (çok yüksek)' },
  'B-normal': { sade: 'Orta kulakta sıvı', teknik: 'Tip B, normal hacim' },
  'B-buyuk': { sade: 'Zarda delik ya da açık tüp', teknik: 'Tip B, büyük hacim' },
  'B-kucuk': { sade: 'Kanal tıkalı (kir)', teknik: 'Tip B, küçük hacim' },
  'C': { sade: 'Basınç düşük (Östaki borusu)', teknik: 'Tip C' },
};
export const egriTipi = (e: EgriTur): TipTimp => (e.startsWith('B') ? 'B' : e as TipTimp);
export interface TimpanoBulmaca { egri: EgriTur; timp: Timp; secenek: EgriTur[]; dogru: number }
const GENEL_EGRI: EgriTur[] = ['A', 'B-normal', 'C', 'B-buyuk'];
const TUM_EGRI: EgriTur[] = ['A', 'As', 'Ad', 'B-normal', 'B-buyuk', 'B-kucuk', 'C'];
/** eğri türünden geçerli bir yetişkin timpanogramı (değerler timpHatasi denetiminden geçer) */
export function egriUret(e: EgriTur, r: () => number): Timp {
  const p = -40 + Math.round(r() * 8) * 10; // −40…+40 daPa
  switch (e) {
    case 'A': return { tip: 'A', basinc: p, uyum: +(0.5 + r() * 0.8).toFixed(2), hacim: +(0.9 + r() * 0.5).toFixed(1) };
    case 'As': return { tip: 'As', basinc: p, uyum: +(0.12 + r() * 0.14).toFixed(2), hacim: +(0.9 + r() * 0.5).toFixed(1) };
    case 'Ad': return { tip: 'Ad', basinc: p, uyum: +(2.0 + r() * 1.0).toFixed(2), hacim: +(0.9 + r() * 0.5).toFixed(1) };
    case 'B-normal': return { tip: 'B', basinc: null, uyum: 0.1, hacim: +(0.9 + r() * 0.5).toFixed(1) };
    case 'B-buyuk': return { tip: 'B', basinc: null, uyum: 0.1, hacim: +(2.5 + r() * 1.5).toFixed(1) };
    case 'B-kucuk': return { tip: 'B', basinc: null, uyum: 0.05, hacim: +(0.2 + r() * 0.3).toFixed(1) };
    case 'C': return { tip: 'C', basinc: -150 - Math.round(r() * 15) * 10, uyum: +(0.4 + r() * 0.6).toFixed(2), hacim: +(0.9 + r() * 0.5).toFixed(1) };
  }
}
/** tohumdan bir tur: 5 bulmaca; her birinde 4 seçenek (genel düzeyde yalnız A, B-normal, C, B-büyük) */
export function timpanoTuru(seed: number, duzey: BilgiDuzeyi): TimpanoBulmaca[] {
  const r = kgRng(seed); const havuz = duzey === 'genel' ? GENEL_EGRI : TUM_EGRI; const out: TimpanoBulmaca[] = [];
  for (let i = 0; i < KG_KURAL.timpanoBulmaca; i++) {
    const egri = havuz[Math.floor(r() * havuz.length)]!;
    const diger = kgKaristir(havuz.filter((x) => x !== egri), r).slice(0, 3);
    const secenek = kgKaristir([egri, ...diger], r);
    out.push({ egri, timp: egriUret(egri, r), secenek, dogru: secenek.indexOf(egri) });
  }
  return out;
}
export function timpanoPuani(b: TimpanoBulmaca[], cevap: number[]): number { return b.reduce((n, x, i) => n + (x.dogru === cevap[i] ? 1 : 0), 0); }

export type KampOyun = 'ton' | 'timpano';
export const KAMP_OYUN: Record<KampOyun, { ad: string; bina: BuildingId; art: KgArt; denemeler: number; plain: string }> = {
  ton: { ad: 'Ton Avı', bina: 'laboratuvar', art: 'ton', denemeler: KG_KURAL.tonDeneme, plain: 'Kısa bir dinleme oyunu: ses var mı, hangisi daha ince? Bir işitme testi değildir.' },
  timpano: { ad: 'Timpanogram Eşleştir', bina: 'kule', art: 'timpano', denemeler: KG_KURAL.timpanoBulmaca, plain: 'Eğriye bak, anlamını bul: zar rahat mı, sıvı mı, delik mi?' },
};
