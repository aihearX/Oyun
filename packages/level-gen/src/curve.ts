import type { LevelAssist, ModifierId } from '@odi/shared';

/**
 * Zorluk eğrisi ve bölüm başına düğmeler (docs/12-zorluk-egrisi.md).
 *
 * Eğri, haritanın ana bölgelerine (biyom bölgeleri; 17 ve 20 kemikçik bölgesinde kalır) göre "testere dişi" biçimindedir:
 * bölgenin ilk bölümü yeni yeteneği yumuşakça öğretir (nefes), sonra zorluk tırmanır, bölgenin son normal bölümü o bölgenin
 * sınavıdır (final). Her bölgenin girişi bir öncekinin girişinden, finali bir öncekinin finalinden yüksektir. Boss'lar (20, 40)
 * büyük doruklardır; 40 en zorudur. Boss'tan sonra kısa bir nefes.
 *
 * Hedef birimi "beklenen can kaybı" (λ): insan benzeri oyuncu modelinin (game-core `play/human.ts`) bölümde kaybettiği
 * ortalama can (bitiremeyen 3). Grafikteki puan = 3·λ + yakın kaçış yoğunluğu (≤ 1); hedef puan ≈ 3·λ + 0,5.
 */
export interface CurveZone { name: string; short: string; from: number; to: number; /** bölgenin finali (son normal bölüm) */ peak: number; /** giriş ve final hedefleri (λ) */ lo: number; hi: number;
  /** finalin üretici bütçe çarpanı (ölçülerek): oda puanlarının toplamı sınav odalı finallerin zorluğunu bölgeye göre eksik/fazla
   *  tahmin eder; hedef (hi) değişmez, yalnız finalde üreticiye verilen λ = hi × gain */ gain?: number }

export const CURVE_ZONES: CurveZone[] = [
  { name: 'Dış Kulak', short: 'Dış Kulak', from: 1, to: 5, peak: 5, lo: 0.01, hi: 0.2 },
  { name: 'Kulak Kanalı', short: 'Kanal', from: 6, to: 8, peak: 8, lo: 0.08, hi: 0.55, gain: 0.65 },
  { name: 'Kulak Zarı', short: 'Zar', from: 9, to: 12, peak: 12, lo: 0.2, hi: 0.85 },
  { name: 'Kemikçikler', short: 'Kemikçikler', from: 13, to: 20, peak: 19, lo: 0.3, hi: 1.0 },
  { name: 'Koklea · Taban', short: 'Koklea 1', from: 21, to: 23, peak: 23, lo: 0.35, hi: 1.1 },
  { name: 'Koklea · Orta', short: 'Koklea 2', from: 24, to: 26, peak: 26, lo: 0.45, hi: 1.2 },
  { name: 'Koklea · Apeks', short: 'Koklea 3', from: 27, to: 30, peak: 30, lo: 0.5, hi: 1.3 },
  { name: 'İşitme Siniri', short: 'Sinir', from: 31, to: 33, peak: 33, lo: 0.55, hi: 1.4 },
  { name: 'Beyin Sapı', short: 'Beyin Sapı', from: 34, to: 36, peak: 36, lo: 0.6, hi: 1.5 },
  { name: 'İşitme Korteksi', short: 'Korteks', from: 37, to: 40, peak: 39, lo: 0.8, hi: 1.6 },
];
/** boss hedefleri (λ): 20 kendinden önceki her bölümden, 40 her bölümden zor */
export const BOSS_LAMBDA: Record<number, number> = { 20: 1.6, 40: 2.0 };

export const zoneOf = (n: number): CurveZone => CURVE_ZONES.find((z) => n >= z.from && n <= z.to) ?? CURVE_ZONES[CURVE_ZONES.length - 1]!;
/** bölgedeki konum: 0 giriş … 1 final */
export function zonePos(n: number): number { const z = zoneOf(n); return z.peak === z.from ? 1 : Math.max(0, Math.min(1, (n - z.from) / (z.peak - z.from))); }

/** hedef beklenen can kaybı (λ) */
export function targetLambda(n: number): number {
  const b = BOSS_LAMBDA[n]; if (b !== undefined) return b;
  const z = zoneOf(n); const u = zonePos(n);
  // giriş nefesi düz başlar, finale doğru hızlanır (u^1.3)
  return z.lo + (z.hi - z.lo) * Math.pow(u, 1.3);
}
/** grafikteki hedef puan */
export const TARGET_CURVE: number[] = Array.from({ length: 40 }, (_, i) => Math.round((3 * targetLambda(i + 1) + 0.5) * 100) / 100);

/** Bir bölümün somut, ayarlanabilir düğmeleri (üretici ve motor bunları uygular). */
export interface LevelKnobs {
  /** hedef beklenen can kaybı (λ) */
  lambda: number;
  /** oda puanı hedefi (0-10, `level-gen/rooms.ts`): bölüm-içi bölümler ×0,7 / ×1 / ×1,25 */
  roomTarget: number;
  /** normal oda sayısı (bölüm uzunluğu; öğretici, kontrol noktası, mikro ve doruk odaları hariç) */
  rooms: number;
  /** tek odanın en yüksek puanı (çok zor odayı erken bölümden uzak tutar) */
  roomMax: number;
  /** bir odada en çok kaç mekanik ailesi birleşebilir (kombinasyon) */
  maxFamilies: number;
  /** izinli düşman türleri */
  enemies: string[];
  /** en geniş zemin boşluğu (px) ve boşluk üstündeki en dar iniş (px) */
  maxGap: number; minLanding: number;
  /** sıkılık 0 (en bağışlayıcı) … 1 (en sıkı): zamanlama ve geometri düğmeleri bundan türer (`tuningAt`) */
  tight: number;
  /** zamanlama penceresi düğmeleri: motor (sim) bunları varlık özelliklerinden okur */
  timing: LevelTiming;
  /** geometri düğmeleri: üretici odaların varlıklarına uygular (oda tanımı değişmez) */
  geom: LevelGeom;
  /** sabit değiştiriciler: yalnızca ileri bölümlerde ve finallerde */
  modifiers: ModifierId[];
  /** uyarlanabilir yardım kademesi (0 yok; her kademe finalden bir sınav odası eksiltir) */
  ease: number;
  /** ilk bölümlerin motor yardımları (koşu hızı, coyote/tampon, bedava düşüş, geri dönüş kilidi, kaydırma eşiği) */
  assist?: LevelAssist;
  /** ilk bölümlerin içerik kısıtları: diken/düşman/tehlike yok (1. bölümde hiç; 2-3'te öğretici odası dışında; 4-12'de kontrol noktası odalarında), en geniş çukur
   *  (px), hareketli/ufalanan basamak yok (1-3), her odada kontrol noktası (1-8) */
  early: { noHazards: 'hepsi' | 'ogretici-disi' | 'kontrol' | false; maxPit: number; noMoving: boolean; cpEveryRoom: boolean;
    /** 6-12: zemindeki serumen/perde tehlikeleri daralır (×0,7) ve serumen alçalır — ilk kez oynayanın Kanal/Zar yükü */ softHazards: boolean };
}
export interface LevelGeom {
  /** diken genişliği çarpanı (genişleyen diken daha uzun/kesin zıplama ister) */
  spike: number;
  /** zemin çukuru genişliği çarpanı (yalnız içi boş çukurlar; en çok 190 px) */
  gap: number;
  /** basamak genişliği çarpanı (hareketli, ritim, ufalanan ve yankı basamakları: iniş payı) */
  landing: number;
}
export interface LevelTiming {
  /** ufalanan zeminin basıldıktan sonra düşme gecikmesi (sn; motor varsayılanı 0,4) */
  crumble: number;
  /** zar dokunuş penceresi (sn; varsayılan 0,12) */
  tramp: number;
  /** düşman hızı ve atıcı ateş temposu çarpanı (1 = oda yazıldığı gibi) */
  enemy: number;
  /** hareketli platform ve sürüklenen tehlike hızı çarpanı */
  moving: number;
  /** boss: uyarı (telegraf) süresi çarpanı ve can */
  bossWarn: number; bossHp?: number;
  /** boss: saldırı temposu çarpanı (>1 daha sık) */
  bossTempo?: number;
}

/** sıkılıktan zamanlama ve geometri düğmeleri (0 = bölge girişi ve ilk bölümler, 1 = son finaller) */
export function tuningAt(tight: number): { timing: LevelTiming; geom: LevelGeom } {
  const r = (x: number, k = 100) => Math.round(x * k) / k;
  return {
    timing: { crumble: r(lerp(0.7, 0.36, tight)), tramp: r(lerp(0.17, 0.11, tight), 1000), enemy: r(lerp(0.75, 1.15, tight)), moving: r(lerp(0.8, 1.12, tight)), bossWarn: 1 },
    geom: { spike: r(lerp(0.75, 1.5, tight)), gap: r(lerp(0.8, 1.2, tight)), landing: r(lerp(1.25, 0.8, tight)) },
  };
}

/** değiştiriciler yalnızca ileri bölgelerde, çoğunlukla finallerde (tek can ve ters yerçekimi yolculukta yok) */
const MODS: Record<number, ModifierId[]> = {
  19: ['sis'], 23: ['sis'], 26: ['gece'], 29: ['sis'], 30: ['hiz', 'yanki'], 32: ['gece'], 33: ['hiz', 'yanki'], 35: ['sis'], 36: ['yanki'], 38: ['gece'], 39: ['hiz', 'gece'],
};
const ENEMY_FROM: Record<string, number> = { devriye: 3, ucan: 4, ziplayan: 9, atici: 13, kalkanli: 15 };

/**
 * İlk bölümlerin yardımları (gerçek cihazda ilk kez oynayan oyuncu için; docs/12 §4): koşu 190 → 260 px/sn'ye 7. bölümde
 * ulaşır (8. bölüm 260 ama diğer yardımlar sürer); 1-3'te coyote 0,16 / tampon 0,20 sn, 4-5'te 0,13 / 0,15; 1-2. bölümlerin ilk iki, 3-8'in ilk çukuru can götürmez; 6-8'de coyote 0,12 / tampon 0,14 sn; 1-5'te geri dönüş
 * yalnız gerektiği yerde ve yatay kaydırma eşiği 64 px.
 */
const EARLY_RUN: Record<number, number> = { 1: 190, 2: 205, 3: 220, 4: 235, 5: 242, 6: 248, 7: 255, 8: 260, 9: 260, 10: 260, 11: 260, 12: 260 };
export function assistFor(n: number): LevelAssist | undefined {
  const run = EARLY_RUN[n]; if (run === undefined) return undefined;
  return {
    run, coyote: n <= 3 ? 0.16 : n <= 5 ? 0.13 : 0.12, buffer: n <= 3 ? 0.2 : n <= 5 ? 0.15 : 0.14,
    freeFalls: n <= 2 || (n >= 7 && n <= 8) ? 2 : 1, turnOnlyWhenNeeded: n <= 5, swipePx: n <= 5 ? 64 : 42,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

/**
 * Bölüm düğmeleri. `ease`: uyarlanabilir yardım (takılan oyuncu için 1-2 kademe kolaylaştırma; asla zorlaştırmaz).
 * `bonus`: usta oyuncuya küçük ek (yalnızca ilk bölge dışında, final ve boss değilken).
 */
export function knobsFor(n: number, o: { ease?: number; bonus?: number } = {}): LevelKnobs {
  const z = zoneOf(n); const u = zonePos(n); const zi = CURVE_ZONES.indexOf(z);
  const ease = Math.max(0, o.ease ?? 0);
  // genel ilerleme 0 (1. bölüm) … 1 (40. bölüm)
  const g = (n - 1) / 39;
  let lambda = targetLambda(n) * Math.pow(0.72, ease) + (o.bonus ?? 0);
  if (n <= 3) lambda = Math.min(lambda, 0.1);
  const finale = n === z.peak; const onboarding = n <= 3;
  if (finale && z.gain) lambda *= z.gain;
  // 4-6: ilk kez oynayan için kısa bölümler (iki oda eksik)
  const rooms = Math.round(Math.min(11, 3 + (n <= 2 ? n : 2 + zi * 0.45 + u * 2.2) + (finale ? 1 : 0) - ease - (n >= 4 && n <= 6 ? 2 : 0)));
  const roomTarget = Math.round((0.4 + 4.4 * lambda) * 100) / 100;
  const roomMax = onboarding ? 1.5 : Math.round((roomTarget + 2.5 + (finale ? 1 : 0)) * 100) / 100;
  const maxFamilies = onboarding ? 2 : finale ? 9 : Math.min(9, 2 + Math.floor(zi * 0.6 + u * 2));
  const enemies = Object.keys(ENEMY_FROM).filter((k) => ENEMY_FROM[k]! <= n);
  const maxGap = onboarding ? 160 : n <= 8 ? 230 : 9999;
  const minLanding = onboarding ? 100 : n <= 8 ? 60 : 0;
  // zamanlama: bölge girişinde ve ilk bölgelerde bağışlayıcı, finallerde ve sonda sıkı
  const tight = Math.max(0, Math.min(1, 0.55 * g + 0.45 * u - 0.15 * ease));
  const { timing, geom } = tuningAt(tight);
  // 9-12: zar penceresi en az 0,16 sn (ilk kez oynayan için; "Mükemmel" sıçrayış ödül olarak kalır, gerekmez)
  if (n >= 9 && n <= 12) timing.tramp = Math.max(timing.tramp, 0.16);
  // 6-12: zemin dikenleri en çok ×0,8 genişlik (kısa zıplama yeter)
  if (n >= 6 && n <= 12) geom.spike = Math.min(geom.spike, 0.8);
  // boss'lar (ölçüyle ayarlı): golem 14 can, uyarı ×1,0, tempo ×1,2 · canavar 32 can, uyarı ×0,8, tempo ×1,8
  if (n === 20) { timing.bossHp = 14; timing.bossWarn = 1.0; timing.bossTempo = 1.2; }
  if (n === 40) { timing.bossHp = 32; timing.bossWarn = 0.8; timing.bossTempo = 1.8; }
  const modifiers = ease > 0 ? (MODS[n] ?? []).filter((m) => m === 'sis' || m === 'gece') : (MODS[n] ?? []);
  const early = { noHazards: n === 1 ? 'hepsi' as const : n <= 3 ? 'ogretici-disi' as const : n <= 12 ? 'kontrol' as const : false as const, maxPit: n <= 2 ? 70 : n === 3 ? 90 : 9999, noMoving: n <= 3, cpEveryRoom: n <= 12, softHazards: n >= 6 && n <= 12 };
  return { lambda, roomTarget, rooms, roomMax, maxFamilies, enemies, maxGap, minLanding, tight, timing, geom, modifiers, ease, assist: assistFor(n), early };
}
