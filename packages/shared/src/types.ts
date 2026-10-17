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
  | 'text';         // ipucu metni (props: text)

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
}

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
}
