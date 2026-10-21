/** ODİ: Sesin Yolu — ortak tipler. Oyun çekirdeği, içerik, üretici ve arayüz bu dosyayı paylaşır. */

export type MechanicId = 'kosu' | 'yuzme' | 'trambolin' | 'makine' | 'impuls' | 'ruya' | 'boss';

export type BiomeId =
  | 'dis-kulak' | 'kanal' | 'zar' | 'kemikcikler'
  | 'koklea-1' | 'koklea-2' | 'koklea-3'
  | 'sinir' | 'beyin-sapi' | 'korteks';

export type ObjectiveId = 'reach' | 'collect-all' | 'timed' | 'escort' | 'boss' | 'secret' | 'no-damage' | 'melody';

export type ModifierId = 'ters-yercekimi' | 'sis' | 'yanki' | 'hiz' | 'tek-can' | 'ayna' | 'gece' | 'cihaz-kapali';

export type EntityType =
  | 'platform'      // katı zemin/platform (w,h)
  | 'moving'        // hareketli platform (props: dx, dy, period)
  | 'spike'         // ölümcül diken (w)
  | 'hazard'        // ölümcül alan (w,h) — gürültü bulutu, damla alanı
  | 'coin'          // ses jetonu
  | 'note'          // melodi notası (props: order)
  | 'enemy'         // düşman (props: kind, dx)
  | 'powerup'       // güçlendirme (props: kind: shield|magnet|life|speed)
  | 'spring'        // kıl hücresi yay (props: power)
  | 'trampoline'    // kulak zarı (props: power)
  | 'gear'          // kemikçik dişlisi (props: r, speed)
  | 'current'       // koklea akıntısı (w,h, props: vx, vy)
  | 'bubble'        // hava kabarcığı (yüzme: nefes)
  | 'lane'          // impuls şeridi engeli (props: lane 0-2)
  | 'flip'          // yerçekimi çevirici (rüya)
  | 'checkpoint'
  | 'secret'        // altın koklea
  | 'escortee'      // eskort edilen fısıltı başlangıcı
  | 'gate'          // bölüm sonu kapısı
  | 'decor'         // görsel (props: kind)
  | 'text'          // ipucu metni (props: text)
  // ---- v2 (docs/11): yetenek ve ses mekanikleri
  | 'wall'          // dikey, tırmanılabilir yüzey (w,h) — duvar zıplaması
  | 'hook'          // kanca (props: r ip uzunluğu)
  | 'crumble'       // çatlak zemin: basınca 0,4 sn sonra düşer, çakılmayla kırılır (w)
  | 'barrier'       // gürültü duvarı: ses darbesiyle kırılır (w,h)
  | 'switch'        // anahtar (props: id) — çakılma/darbe ile tetiklenir
  | 'door'          // kapı (props: id, open) — anahtarla açılır (w,h)
  | 'fork'          // diyapazon (props: color 0..1 tonotopi)
  | 'freqgate'      // frekans kapısı (props: color): aynı renk diyapazon taşıyana açık (w,h)
  | 'beat'          // ritim platformu (props: pattern '1010', mode 'belir'|'kay', dx)
  | 'echo'          // yankı platformu: yalnızca ses darbesinden sonra birkaç saniye katı (w)
  | 'launcher'      // fırlatıcı (props: vx, vy)
  | 'water'         // sıvı bölgesi (w,h): yüzme fiziği
  | 'gravzone'      // yerçekimi çevirme bölgesi (w,h)
  | 'lift'          // üstünde durunca yükselen platform (w, props: dy)
  | 'collect'       // büyük nota (5 nota değerinde)
  | 'tutor';        // öğretici an tetikleyicisi (props: ability, w)

/** Yetenekler (docs/11 §2): yolculukta sırayla açılır. */
export type AbilityId = 'zipla' | 'don' | 'kayma' | 'duvar' | 'suzul' | 'trambolin' | 'kanca' | 'cakil' | 'yuz' | 'darbe' | 'cevir';

export interface Entity {
  type: EntityType;
  x: number;  // parça içi x (px)
  y: number;  // dünya y (px, 0 üst; zemin GAME_H - 80 civarı)
  w?: number;
  h?: number;
  props?: Record<string, number | string | boolean>;
}

export interface ChunkSpec {
  id: string;
  mechanic: MechanicId;
  /** 1 kolay … 5 çok zor */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** parçanın genişliği (px) */
  length: number;
  entities: Entity[];
  /** giriş ve çıkış zemin yüksekliği (dünya y) — parçalar birbirine bağlanırken eşleşmeli */
  entryY: number;
  exitY: number;
  tags: string[];
  /** yalnızca belirli biyomlarda (boşsa hepsi) */
  biomes?: BiomeId[];
  /** üretici bu parçayı "nefes" parçası olarak kullanabilir */
  rest?: boolean;
  /** parçanın gerektirdiği yetenekler (boşsa varlıklardan çıkarılır) */
  needs?: AbilityId[];
  /** elle tasarlanmış gösteri parçası (biyom başına 1-2) */
  setPiece?: boolean;
}

/** Bölüm-içi bölüm (giriş → gelişim → final); `start` dünya x'i (kapı dahil değil) */
export interface LevelSection { name: string; start: number; end: number }

export interface ObjectiveSpec {
  id: ObjectiveId;
  /** timed: saniye; collect-all: jeton sayısı; melody: nota sayısı */
  target?: number;
  label: string;
}

export interface BossSpec {
  id: string;
  name: string;
  hp: number;
  phases: number;
  biome: BiomeId;
  /** zorluk düğmeleri: uyarı (telegraf) süresi çarpanı (1 = varsayılan) ve saldırı temposu çarpanı (>1 daha sık) */
  warn?: number;
  tempo?: number;
}

export interface LevelSpec {
  id: string;
  number: number;
  journey: string;
  name: string;
  biome: BiomeId;
  mechanic: MechanicId;
  objective: ObjectiveSpec;
  modifiers: ModifierId[];
  seed: number;
  chunks: ChunkSpec[];
  lengthPx: number;
  parTimeSec: number;
  coinsTotal: number;
  intro?: string;
  boss?: BossSpec;
  /** ilk kez görülen mekanik: öğretici ipuçları açık */
  tutorial?: boolean;
  /** bu bölümde kullanılabilen yetenekler (yolculuk ilerlemesine göre) */
  abilities?: AbilityId[];
  /** bu bölümde ilk kez açılan yetenekler (öğretici an) */
  newAbilities?: AbilityId[];
  /** 3 bölüm-içi bölüm; parça dizisindeki sınır indeksleri (chunks[i] i ≥ sectionStarts[k]) */
  sectionStarts?: number[];
  /** gizli altın koklea sayısı (3) */
  cochleasTotal?: number;
  /** ilk bölümlerin bağışlayıcılığı (docs/12 §4): yoksa motorun varsayılanları */
  assist?: LevelAssist;
}

/** İlk bölümlerin yardımları — bölüm düğmesi; motor deterministik kalır (aynı bölüm + girdi → aynı sonuç). */
export interface LevelAssist {
  /** otomatik koşu hızı (px/sn; varsayılan 260) */
  run: number;
  /** kenardan düştükten sonra zıplanabilen süre ve erken dokunuşun saklandığı süre (sn) */
  coyote: number; buffer: number;
  /** can kaybettirmeyen düşüş sayısı (bölümün ilk N çukuru) */
  freeFalls: number;
  /** geri dönüş yalnız gerektiği yerde (kapalı kapı/anahtar ya da frekans kapısı yakınken): kazara yatay kaydırma döndürmez */
  turnOnlyWhenNeeded: boolean;
  /** yatay kaydırmanın sayıldığı en kısa mesafe (px; varsayılan 42) */
  swipePx: number;
}

export interface RunResult {
  levelId: string;
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  score: number;
  coins: number;
  timeSec: number;
  deaths: number;
  damageTaken: number;
  objectiveMet: boolean;
  secretFound: boolean;
  /** melodi/eskort gibi hedeflerin ayrıntısı */
  extra?: Record<string, number | string | boolean>;
  /** Tedavi Odası: bu koşuda kullanılan malzemeler (LevelOptions.remedies'ten; sunucu envanterden düşer). docs/14-kamp.md */
  remediesUsed?: { id: string; count: number }[];
}

export interface PlayerSkills {
  doubleJump: boolean;
  longSlide: boolean;
  magnet: number;     // 0-3
  shield: number;     // 0-2 (bölüm başı kalkan)
  breath: number;     // 0-3 yüzme nefesi
  echoSight: boolean; // gece/sis bölümlerinde görüş
}

export interface InputState {
  /** birincil dokunuş (zıpla/yüksel/sıçra) */
  primaryDown: boolean;
  primaryPressed: boolean; // bu karede basıldı
  primaryReleased: boolean;
  /** aşağı kaydırma / ikincil (kay) */
  secondaryPressed: boolean;
  /** şerit/yön (impuls): -1,0,1 */
  dir: -1 | 0 | 1;
  pointerX: number; // 0-1
  /** yatay kaydırma (ses darbesi / atılma) bu karede */
  dashPressed?: boolean;
  /** bu karedeki yatay kaydırmanın oyun yönü (-1 sol, 1 sağ; ayna değiştiricisi uygulanmış), yoksa 0.
   *  Koşu yönünün tersi = geri dön; koşu yönü = ses darbesi (açıksa) */
  swipeX?: -1 | 0 | 1;
}
