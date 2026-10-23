/**
 * Kulak Kampı süslemeleri (docs/14-kamp.md §10): yalnız görünüştür (güç vermez). Kamp Seviyesi, bölge anıtları ve (dışa açık
 * `grantDecoration` ile) kamp görevleri verir. Her süste kısa, doğru bir odyoloji bilgisi vardır; çizimler game-core/camp/decor.ts.
 */

export type DecorSource = 'seviye' | 'anit' | 'gorev';
export interface DecorDef {
  id: string;
  name: string;
  /** dokununca / envanterde görünen kısa bilgi (sade, doğru) */
  plain: string;
  /** kapladığı hücre (1 → 1×1, 2 → 2×2) */
  size: 1 | 2;
  /** nereden gelir (envanter kartında "Nereden?" satırı) */
  from: DecorSource[];
  /** kart ve vurgu rengi */
  color: number;
}

export const DECORATIONS: DecorDef[] = [
  { id: 'diyapazon', name: 'Diyapazon Heykeli', size: 1, from: ['seviye'], color: 0xb9c3d6,
    plain: 'Rinne ve Weber testlerinde 512 Hz’lik diyapazon kullanılır: sapı kemiğe değince ses kemik yoluyla iletilir.' },
  { id: 'odyogram-tarhi', name: 'Odyogram Çiçek Tarhı', size: 1, from: ['seviye'], color: 0xff6f6f,
    plain: 'Odyogramda sağ kulak kırmızı daire (O), sol kulak mavi çarpı (X) ile işaretlenir. Bu tarhta çiçekler de öyle dizilir.' },
  { id: 'stereosilya', name: 'Stereosilya Çimi', size: 1, from: ['seviye'], color: 0x8ef0b0,
    plain: 'Tüy hücrelerinin üstündeki stereosilyalar basamak gibi boy sırasıyla dizilir; eğilince sinyal başlar.' },
  { id: 'kemikcik-banki', name: 'Kemikçik Bankı', size: 1, from: ['seviye', 'anit'], color: 0xf3e2b8,
    plain: 'Çekiç, örs ve üzengi zarın titreşimini oval pencereye taşır. Üzengi vücudun en küçük kemiğidir.' },
  { id: 'otoskop-lamba', name: 'Otoskop Lambası', size: 1, from: ['seviye', 'anit'], color: 0x5fb6d6,
    plain: 'Otoskop, ışığı ve büyüteciyle kulak kanalını ve inci grisi kulak zarını görmemizi sağlar.' },
  { id: 'dalga-cit', name: 'Ses Dalgası Çiti', size: 1, from: ['seviye', 'anit'], color: 0xffc93c,
    plain: 'Ses, havada sıkışma ve seyrelmelerle ilerleyen bir dalgadır; tepeler arası mesafe dalga boyudur.' },
  { id: 'koklea-cesme', name: 'Koklea Çeşmesi', size: 1, from: ['seviye', 'anit'], color: 0x2ee6d6,
    plain: 'Koklea yaklaşık iki buçuk tur döner ve sıvıyla doludur; titreşim bu sıvıda dalga olarak ilerler.' },
  { id: 'kulaklik-salincak', name: 'Kulaklık Salıncağı', size: 1, from: ['seviye'], color: 0x8b6bff,
    plain: 'Saf ses odyometrisinde hava yolu eşikleri kulaklıkla ölçülür; her kulak ayrı ayrı test edilir.' },
  { id: 'kepce-cardak', name: 'Kulak Kepçesi Çardağı', size: 2, from: ['seviye'], color: 0xffb3a7,
    plain: 'Kepçenin heliks ve konka kıvrımları sesi toplar, yüksek frekansları süzerek sesin yukarıdan mı aşağıdan mı geldiğini anlamaya yardım eder.' },
  { id: 'cihaz-saksi', name: 'İşitme Cihazı Saksısı', size: 1, from: ['seviye'], color: 0xd9a0e8,
    plain: 'Kulak arkası işitme cihazında mikrofon sesi alır, işlemci güçlendirir, ses bir hortum ya da kanal içi hoparlörle kulağa iletilir.' },
  { id: 'kanal-heykel', name: 'Yarım Daire Kanalları Heykeli', size: 1, from: ['seviye'], color: 0x7df3ff,
    plain: 'İç kulakta birbirine dik üç yarım daire kanalı başın dönüşünü algılar; denge sistemi işitmenin komşusudur.' },
  { id: 'tuy-lamba', name: 'Tüy Hücresi Lambası', size: 1, from: ['seviye', 'anit'], color: 0xfff0a0,
    plain: 'Kokleada bir sıra iç, üç sıra dış tüy hücresi vardır; dış tüy hücreleri hafif sesleri güçlendirir.' },
  { id: 'tikac-puf', name: 'Kulak Tıkacı Pufu', size: 1, from: ['seviye', 'anit'], color: 0xff9f1c,
    plain: 'Köpük kulak tıkacı sıkıştırılıp kanala yerleştirilir ve genişleyerek kanalı kapatır; doğru takılınca gürültüyü belirgin azaltır.' },
  { id: 'dalga-havuz', name: 'Ses Dalgası Havuzu', size: 2, from: ['seviye'], color: 0x4fc6e0,
    plain: 'Suya atılan taşın halkaları gibi ses de kaynağından her yöne yayılır ve uzaklaştıkça zayıflar.' },
  { id: 'desibel-sutun', name: 'Desibel Sütunları', size: 1, from: ['seviye'], color: 0x3ccf7e,
    plain: 'Desibel logaritmiktir: her 10 dB artış ses şiddetini on kat artırır. 85 dB üstünde uzun süre kalmak kulağı yorar.' },
  { id: 'implant-heykel', name: 'İmplant Bobini Heykeli', size: 1, from: ['seviye', 'anit'], color: 0x5b6bd8,
    plain: 'Koklear implantın dış bobini mıknatısla deri altındaki alıcıya tutunur; elektrotlar işitme sinirini doğrudan uyarır.' },
  { id: 'nota-agaci', name: 'Tonotopi Ağacı', size: 1, from: ['seviye', 'anit'], color: 0xff6f9f,
    plain: 'Kokleanın tabanı ince (tiz), tepesi kalın (pes) seslere yanıt verir; bu sıralamaya tonotopi denir.' },
  { id: 'ostaki-kemer', name: 'Östaki Kemeri', size: 1, from: ['seviye'], color: 0xc2a0ff,
    plain: 'Östaki borusu orta kulağı genize bağlar ve yutkununca açılarak basıncı eşitler.' },
  { id: 'isik-feneri', name: 'Işık Üçgeni Feneri', size: 1, from: ['seviye', 'anit'], color: 0xfff6d0,
    plain: 'Sağlıklı kulak zarına ışık tutunca ön-alt kısımda üçgen bir parıltı (ışık refleksi) görülür.' },
  { id: 'altin-diyapazon', name: 'Altın Diyapazon', size: 1, from: ['seviye'], color: 0xf5c542,
    plain: 'Weber testinde diyapazon alnın ortasına konur; tek taraflı iletim tipi kayıpta ses kötü kulakta daha yüksek duyulur.' },
  { id: 'altin-kulak', name: 'Altın Kulak Heykeli', size: 2, from: ['seviye'], color: 0xf5c542,
    plain: 'İki kulakla duymak sesin yönünü bulmayı ve gürültüde konuşmayı anlamayı kolaylaştırır.' },
  { id: 'heschl-kemer', name: 'Heschl Işık Kemeri', size: 2, from: ['seviye', 'anit'], color: 0xff8fb1,
    plain: 'Birincil işitsel korteks, şakak lobundaki Heschl girusundadır; sesi anlamlı bir kelimeye burada dönüştürürüz.' },
  { id: 'vaka-panosu', name: 'Vaka Panosu', size: 1, from: ['gorev'], color: 0x9fd8ff,
    plain: 'İyi bir vaka değerlendirmesi öyküyle başlar; testler birbirini doğrulayınca karar netleşir.' },
  { id: 'dede-banki', name: 'Tüy Dede Bankı', size: 1, from: ['gorev'], color: 0xffd6a0,
    plain: 'Tüy Dede’nin dinlenme bankı: iyi bir dinleyici sabırla dinler, sonra sorar.' },
];
export const decorById = (id: string): DecorDef | undefined => DECORATIONS.find((d) => d.id === id);
/** bölge anıtı yükselince verilen süs (sunucu bir kez verir) */
export const MONUMENT_DECOR: Record<string, { id: string; n: number }> = {
  'dis-kulak': { id: 'otoskop-lamba', n: 1 },
  kanal: { id: 'tikac-puf', n: 2 },
  zar: { id: 'isik-feneri', n: 1 },
  kemikcikler: { id: 'kemikcik-banki', n: 1 },
  'koklea-1': { id: 'koklea-cesme', n: 1 },
  'koklea-2': { id: 'tuy-lamba', n: 2 },
  'koklea-3': { id: 'nota-agaci', n: 1 },
  sinir: { id: 'implant-heykel', n: 1 },
  'beyin-sapi': { id: 'dalga-cit', n: 3 },
  korteks: { id: 'heschl-kemer', n: 1 },
};
/** envanterde bir süsten en çok */
export const DECOR_INV_CAP = 20;
