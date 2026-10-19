import type { BiomeId, MechanicId, ObjectiveId } from '@odi/shared';

/** Bir yolculuk = sıralı bölüm planı. Üretici bu planı parçalarla doldurur. */
export interface LevelPlan {
  number: number; biome: BiomeId; mechanic: MechanicId; objective: ObjectiveId; name: string; intro?: string; tutorial?: boolean; boss?: string; targetChunks?: number;
  /** bölümün karakteri: üretici bu etiketli odaları öne çıkarır (her bölüm farklı hissettirsin) */
  focus?: string[];
  /** gösteri parçasını zorla */
  setPiece?: boolean;
}
export interface Journey { id: string; name: string; blurb: string; levels: LevelPlan[] }

const L = (number: number, biome: BiomeId, mechanic: MechanicId, objective: ObjectiveId, name: string, extra: Partial<LevelPlan> = {}): LevelPlan => ({ number, biome, mechanic, objective, name, ...extra });

/** İnsan kulağı: 40 bölüm. Mekanikler sırayla tanıtılır, sonra karışır. */
export const HUMAN_JOURNEY: Journey = {
  id: 'insan',
  name: 'İnsan Kulağı',
  blurb: 'Bir ninninin beyne yolculuğu.',
  levels: [
    L(1, 'dis-kulak', 'kosu', 'reach', 'İlk Adım', { tutorial: true, intro: 'Odi, küçük bir ses. Görevi: annenin ninnisini beyne ulaştırmak.', targetChunks: 4, focus: ['bosluk', 'jeton'] }),
    L(2, 'dis-kulak', 'kosu', 'collect-all', 'Kepçenin Kıvrımı', { targetChunks: 5, focus: ['platform', 'yay', 'jeton'] }),
    L(3, 'dis-kulak', 'kosu', 'reach', 'Kıl Ormanı', { targetChunks: 6, focus: ['kayma', 'kil-ormani'] }),
    L(4, 'dis-kulak', 'kosu', 'timed', 'Rüzgârla Yarış', { targetChunks: 6, focus: ['hiz', 'firlatici', 'bosluk'] }),
    L(5, 'dis-kulak', 'kosu', 'secret', 'Gizli Kıvrım', { targetChunks: 7, focus: ['gizli', 'platform'] }),
    L(6, 'kanal', 'kosu', 'reach', 'Tünele Giriş', { intro: 'Kanal dar ve sıcak. Serumen her yerde.', targetChunks: 6, focus: ['duvar'] }),
    L(7, 'kanal', 'kosu', 'no-damage', 'Yapışkan Yol', { targetChunks: 6, focus: ['yapiskan', 'hareketli', 'tirmanis'] }),
    L(8, 'kanal', 'kosu', 'collect-all', 'Damlalar', { targetChunks: 7, focus: ['hareketli', 'jeton', 'tirmanis'] }),
    L(9, 'zar', 'trambolin', 'reach', 'Zarın Üstünde', { tutorial: true, intro: 'Kulak zarı dev bir trambolin. Doğru anda dokun.', targetChunks: 5, focus: ['zar', 'suzul'] }),
    L(10, 'zar', 'trambolin', 'collect-all', 'Titreşim', { targetChunks: 6, focus: ['ritim', 'zar'] }),
    L(11, 'zar', 'trambolin', 'timed', 'Rezonans', { targetChunks: 6, focus: ['ritim', 'suzul', 'hiz'] }),
    L(12, 'zar', 'trambolin', 'melody', 'Zar Melodisi', { targetChunks: 6, focus: ['zar', 'ritim'] }),
    L(13, 'kemikcikler', 'makine', 'reach', 'Çekiç', { tutorial: true, intro: 'Üç küçük kemik, dev bir makine. Dişlilere tutun.', targetChunks: 5, focus: ['kanca'] }),
    L(14, 'kemikcikler', 'makine', 'collect-all', 'Örs', { targetChunks: 6, focus: ['kanca', 'asansor'] }),
    L(15, 'kemikcikler', 'makine', 'no-damage', 'Üzengi', { targetChunks: 6, focus: ['cakil', 'ufalanan'] }),
    L(16, 'kemikcikler', 'makine', 'secret', 'Kayıp Dişli', { targetChunks: 7, focus: ['anahtar', 'gizli'] }),
    L(17, 'kanal', 'kosu', 'escort', 'Fısıltıyı Taşı', { targetChunks: 7, focus: ['duvar', 'yapiskan', 'tirmanis'] }),
    L(18, 'kemikcikler', 'trambolin', 'timed', 'Kemik Trambolini', { targetChunks: 7, focus: ['zar', 'kanca'] }),
    L(19, 'kemikcikler', 'makine', 'melody', 'Makine Melodisi', { targetChunks: 7, focus: ['anahtar', 'asansor', 'disli'] }),
    L(20, 'kanal', 'boss', 'boss', 'Serumen Golemi', { boss: 'serumen-golemi', intro: 'Kanalın sonunda serumenden bir dev. Yolu kapatıyor.' }),
    L(21, 'koklea-1', 'yuzme', 'reach', 'Suya Dalış', { tutorial: true, intro: 'Oval pencereden koklea sıvısına. Burada yüzeceksin.', targetChunks: 5, focus: ['su'] }),
    L(22, 'koklea-1', 'yuzme', 'collect-all', 'İnce Sesler', { targetChunks: 6, focus: ['su', 'jeton'] }),
    L(23, 'koklea-1', 'yuzme', 'timed', 'Akıntı', { targetChunks: 6, focus: ['akinti', 'su'] }),
    L(24, 'koklea-2', 'yuzme', 'melody', 'Konuşma Kıvrımı', { targetChunks: 7, focus: ['frekans'] }),
    L(25, 'koklea-2', 'kosu', 'no-damage', 'Kıl Hücresi Tarlası', { targetChunks: 7, focus: ['ritim', 'dusman'] }),
    L(26, 'koklea-2', 'yuzme', 'secret', 'Derin Kıvrım', { targetChunks: 7, focus: ['gizli', 'su', 'ufalanan'] }),
    L(27, 'koklea-3', 'yuzme', 'reach', 'Bas Diyarı', { targetChunks: 7, focus: ['ufalanan', 'frekans'] }),
    L(28, 'koklea-3', 'yuzme', 'escort', 'Ninni Derinlerde', { targetChunks: 7, focus: ['su'] }),
    L(29, 'koklea-3', 'trambolin', 'collect-all', 'Apeks Sıçrayışı', { targetChunks: 7, focus: ['zar', 'firlatici', 'yay'] }),
    L(30, 'koklea-3', 'yuzme', 'timed', 'Son Kıvrım', { targetChunks: 8, focus: ['su', 'akinti', 'frekans'] }),
    L(31, 'sinir', 'impuls', 'reach', 'Elektrik', { tutorial: true, intro: 'Artık bir impulsusun. Koşu yönüne kaydır, ses darbesiyle atıl.', targetChunks: 6, focus: ['darbe'] }),
    L(32, 'sinir', 'impuls', 'collect-all', 'Lif Yolu', { targetChunks: 7, focus: ['yanki', 'jeton'] }),
    L(33, 'sinir', 'impuls', 'timed', 'Işık Hızı', { targetChunks: 7, focus: ['hiz', 'darbe'] }),
    L(34, 'beyin-sapi', 'impuls', 'no-damage', 'Çapraz Yollar', { targetChunks: 8, focus: ['gurultu', 'dusman', 'atici'] }),
    L(35, 'beyin-sapi', 'ruya', 'reach', 'Ters Dünya', { tutorial: true, intro: 'Yerçekimi senin elinde. Dokun ve çevir.', targetChunks: 6, focus: ['cevir'] }),
    L(36, 'beyin-sapi', 'ruya', 'collect-all', 'Tavanın Altı', { targetChunks: 7, focus: ['cevir', 'diken'] }),
    L(37, 'korteks', 'ruya', 'secret', 'Anlam Bahçesi', { targetChunks: 7, focus: ['gizli', 'yanki'] }),
    L(38, 'korteks', 'ruya', 'melody', 'Ninni Hatırlanıyor', { targetChunks: 8, focus: ['ritim', 'cevir'] }),
    L(39, 'korteks', 'impuls', 'timed', 'Son Koşu', { targetChunks: 8, focus: ['hiz', 'karma'] }),
    L(40, 'korteks', 'boss', 'boss', 'Gürültü Canavarı', { boss: 'gurultu-canavari', intro: 'Büyük Sessizlik\'in bekçisi. Ninniyi susturmak istiyor.' }),
  ],
};

export const JOURNEYS: Journey[] = [HUMAN_JOURNEY];
export const journeyById = (id: string) => JOURNEYS.find((j) => j.id === id);
