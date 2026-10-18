/**
 * Oynanış motoru sabitleri (px, sn). Sabit adımlı (1/60 sn) deterministik fizik; bot aynı adımı ileriye simüle eder.
 * Hissi belirleyen değerler tek yerde: koşu hızı, zıplama, yerçekimi, coyote/tampon, duvar kayması, süzülme…
 */
export const DT = 1 / 60;

export const RUN = 260;
export const JUMP_V = 700;
/** yükselirken basılı tutulursa yerçekimi (yüksek zıplama) */
export const G_HOLD = 1500;
/** yükselirken bırakılırsa (değişken zıplama yüksekliği) */
export const G_CUT = 3600;
/** düşüş */
export const G_FALL = 2200;
export const MAX_FALL = 1000;

export const COYOTE = 0.1;
export const JUMP_BUFFER = 0.12;

/** kahraman gövdesi: genişlik/2, boy, kayarken boy */
export const HERO_HW = 15;
export const HERO_H = 42;
export const HERO_SLIDE_H = 22;

export const SLIDE_T = 0.5;
export const SLIDE_LONG_T = 0.9;

/** duvar: değince kısa tırmanış, sonra sürtünmeli kayma */
export const WALL_CLIMB_V = 280;
export const WALL_CLIMB_T = 0.24;
export const WALL_SLIDE_MAX = 150;
export const WALL_JUMP_V = 700;
export const WALL_LOCK_T = 0.15;

/** süzülme: düşüş hızı sınırı */
export const GLIDE_FALL = 115;

/** trambolin: değme anında (±pencere) dokununca güçlü, yoksa sönük sıçrama */
export const TRAMP_STRONG = 1080;
export const TRAMP_WEAK = 560;
export const TRAMP_WINDOW = 0.12;
export const SPRING_V = 900;

/** kanca */
export const HOOK_GRAB = 22;
export const HOOK_MAX_ANGLE = 1.15;

/** yere çakılma */
export const POUND_V = 1400;
export const POUND_RADIUS = 60;

/** yüzme */
export const SWIM_UP = 250;
export const SWIM_SINK = 130;
export const SWIM_SPEED = 0.82;
export const SWIM_EXIT_V = 640;
export const BREATH = 6;

/** ses darbesi (atılma) */
export const DASH_T = 0.22;
export const DASH_MULT = 2.3;
export const DASH_CD = 0.55;
export const ECHO_T = 3.2;

/** düşmanı ezince sıçrama */
export const STOMP_V = 560;
export const STOMP_V_HELD = 740;

export const INVULN_HIT = 1.5;
export const INVULN_SHIELD = 1.0;
export const INVULN_FALL = 1.4;

/** dünya */
export const START_PAD = 220;
export const END_PAD = 260;
export const FALL_Y = 420; // GROUND_Y + FALL_Y altı = düşme
export const BUCKET = 256;

/** ters yerçekimi değiştiricisi: tavan yüksekliği (zeminden) ve çevirme aralığı */
export const CEIL_GAP = 520;
export const MOD_FLIP_EVERY = 8;
