import { GROUND_Y, hashString, mulberry32 } from '@odi/shared';
import * as C from './consts';
import { Planner, type Action, type PlanPrefs } from './planner';
import { enemyAt, hazardAt, lastRect, projectiles, solidAt, step, type SimState } from './sim';
import { near, type World } from './world';

/**
 * İnsan benzeri oyuncu modeli (zorluk ölçümü için; docs/12-zorluk-egrisi.md).
 *
 * Planlayıcı botun "niyeti" + insan eli: aynı deterministik adım üzerinde ileriye bakan arama, ama
 *  - tepki gecikmesi: yeni karar ancak `reactMs` sonra uygulanabilir; o ana dek planlanmış girdiler değişmez (süren basılı
 *    tutmanın bırakılışı ise tepki süresinden sonrası için yeniden zamanlanabilir),
 *  - sınırlı ileri bakış: `lookMs` (~1,2–1,4 sn ≈ ekranın sağ kenarı) — botun 1,9 sn'sinden kısa; boss arenasında uyarı süresi kadar,
 *  - zamanlama sapması: her girdi N(0, `jitterMs`) kadar erken/geç (en çok ±1,5σ); basılı tutma süresi de ±%15–25 sapar,
 *  - ara sıra geç kalma (`lapseP`: +100–200 ms) ve kaçan girdi (`missP`),
 *  - kare-mükemmel numara yok: sapma, dar pencereli her çözümü doğal olarak cezalandırır.
 * Model bir OYUNCU KİTLESİDİR: her koşu (tohum) bir oyuncudur; beceri dört kademede ustadan (USTA) acemiye (NOVICE) dağılır
 * (ortalama: tepki ~230 ms, sapma σ ~80 ms ≈ ±60–100 ms). Tohumlu ve deterministik (aynı bölüm + tohum → aynı sonuç).
 */
export interface HumanParams { reactMs: number; lookMs: number; jitterMs: number; holdJitter: number; lapseP: number; missP: number }
/** kitlenin usta ucu */
export const USTA: HumanParams = { reactMs: 200, lookMs: 1400, jitterMs: 60, holdJitter: 0.15, lapseP: 0.04, missP: 0.01 };
/** kitlenin acemi ucu (oda puanlamasında da kullanılır: tek odada farkları büyütür) */
export const NOVICE: HumanParams = { reactMs: 260, lookMs: 1200, jitterMs: 100, holdJitter: 0.25, lapseP: 0.1, missP: 0.03 };
/** beceri 0 (usta) … 1 (acemi) arası oyuncu */
export function playerAt(skill: number): HumanParams {
  const u = Math.max(0, Math.min(1, skill)); const l = (a: number, b: number) => a + (b - a) * u;
  return { reactMs: l(USTA.reactMs, NOVICE.reactMs), lookMs: l(USTA.lookMs, NOVICE.lookMs), jitterMs: l(USTA.jitterMs, NOVICE.jitterMs), holdJitter: l(USTA.holdJitter, NOVICE.holdJitter), lapseP: l(USTA.lapseP, NOVICE.lapseP), missP: l(USTA.missP, NOVICE.missP) };
}
/** kitlenin k. oyuncusu: beceri dört kademede döner (0, 1/3, 2/3, 1) */
export const playerOf = (k: number): HumanParams => playerAt((((k % 4) + 4) % 4) / 3);
/** kitlenin ortası (tek oyunculuk ölçümler için) */
export const HUMAN: HumanParams = playerAt(0.5);

const F = 1000 / 60;
/** boss arenasında ileri bakış (ms): en kısa uyarı süresi kadar */
export const BOSS_LOOK_MS = 600;
/** ölçümde başlangıç evresinin yayıldığı süre (sn) */
export const PHASE_SPAN = 12;

/** standart normal (Box-Muller), tohumlu */
function gauss(rng: () => number): number { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function humanPrefs(seed: number, p: HumanParams = HUMAN): PlanPrefs {
  const rng = mulberry32(seed >>> 0);
  const motor = (a: Action, releaseOnly: boolean): Action | null => {
    if (releaseOnly) return { ...a, hold: Math.max(2, a.hold + Math.round((Math.max(-1.5, Math.min(1.5, gauss(rng))) * p.jitterMs) / F)) };
    if (rng() < p.missP) return null;
    const err = Math.max(-1.5, Math.min(1.5, gauss(rng))) * p.jitterMs + (rng() < p.lapseP ? 100 + rng() * 100 : 0);
    const at = Math.max(0, a.at + Math.round(err / F));
    const hold = a.kind === 'press' ? Math.max(2, Math.round(a.hold * (1 + (rng() * 2 - 1) * p.holdJitter) + (rng() * 2 - 1) * 2)) : a.hold;
    return { ...a, at, hold };
  };
  return { secrets: false, horizon: Math.round(p.lookMs / F), react: Math.round(p.reactMs / F), motor };
}

export interface HumanRun {
  finished: boolean; failed: string | null; t: number;
  /** kaybedilen can (düşme dahil); bitiremeyen 3 can kaybetmiştir */
  damage: number; deaths: number;
  /** tehlikeye/düşmana 8 px'ten yakın geçiş (hasarsız) + kenara 10 px'ten yakın iniş */
  nearMisses: number;
  searches: number;
}

/** kahraman kutusu ile dikdörtgen arasındaki boşluk (px; çakışmada 0) */
const gap = (hl: number, ht: number, hr: number, hb: number, l: number, t: number, r: number, b: number) => Math.max(0, Math.max(l - hr, hl - r), Math.max(t - hb, ht - b));

/** hazır dünyayı insan modeliyle oyna (dünya + başlangıç durumu dışarıda kurulur) */
export function runHuman(w: World, s: SimState, seed: number, o: { maxT?: number; params?: HumanParams } = {}): HumanRun {
  // boss arenasında saldırıların yönü/türü önceden bilinemez: oyuncu ancak uyarıyı (telegraf) görünce plan yapabilir —
  // ileri bakış uyarı süresiyle sınırlı (planlayıcı geleceği "bilmesin")
  const base = o.params ?? HUMAN; const params = w.boss ? { ...base, lookMs: Math.min(base.lookMs, BOSS_LOOK_MS) } : base;
  const p = new Planner(w, humanPrefs(seed, params)); const maxT = (o.maxT ?? 300);
  // faz: zamanlamalı öğelerin (hareketli platform, düşman, nabız, ritim) varışta hangi evrede olduğu tasarımın değil şansın
  // işidir; ölçüm her tohumda saati rastgele bir evreden başlatır → zorluk evrelere göre beklenen değerdir (boss hariç)
  const t0 = w.boss ? 0 : mulberry32((seed ^ 0x9e3779b9) >>> 0)() * PHASE_SPAN; s.t += t0;
  const close = new Set<number>(); let nearMisses = 0; let wasGrounded = true; const PJ: { x: number; y: number }[] = [];
  while (!s.finished && !s.failed && s.t - t0 < maxT) {
    step(w, s, p.next(s));
    const h = s.hero;
    if (h.invuln > 0) { wasGrounded = h.grounded; continue; }
    const hh = h.slide > 0 ? C.HERO_SLIDE_H : C.HERO_H;
    const hl = h.x - C.HERO_HW, hr = h.x + C.HERO_HW, ht = h.g > 0 ? h.y - hh : h.y, hb = h.g > 0 ? h.y : h.y + hh;
    for (const id of near(w, h.x - 80, h.x + 80)) {
      const e = w.ents[id]!; let d = 99;
      if (e.cls === 'hazard') { if (hazardAt(w, s, e, s.t)) { const r = lastRect(); d = gap(hl, ht, hr, hb, r.l, r.t, r.r, r.b); } }
      else if (e.cls === 'enemy' && !s.killed.has(id)) {
        const q = enemyAt(e, s.t); d = gap(hl, ht, hr, hb, q.x - 15, q.y - 28, q.x + 15, q.y - 2);
        if (e.p.kind === 'atici') { projectiles(e, s.t, s.killed.get(id), PJ); for (const b of PJ) d = Math.min(d, gap(hl, ht, hr, hb, b.x - 8, b.y - 8, b.x + 8, b.y + 8)); }
      } else continue;
      if (d < 8 && !close.has(id)) { close.add(id); nearMisses++; }
    }
    // kenara iniş: ayağın yarısından çoğu boşlukta
    if (h.grounded && !wasGrounded && h.groundId >= 0) {
      const e = w.ents[h.groundId]!;
      if ((e.type === 'platform' || e.type === 'moving' || e.type === 'crumble' || e.type === 'beat') && solidAt(w, s, e, s.t)) {
        const r = lastRect(); if (Math.min(h.x - r.l, r.r - h.x) < 10 && h.y < GROUND_Y + 300) nearMisses++;
      }
    }
    wasGrounded = h.grounded;
  }
  return { finished: s.finished, failed: s.failed, t: s.t - t0, damage: s.finished ? s.damageTaken : Math.max(s.damageTaken, 3), deaths: s.deaths, nearMisses, searches: p.stats.searches };
}

/** tohum: bölüm + koşu numarası */
export const humanSeed = (level: number, k: number) => hashString(`insan:${level}:${k}`);

export interface LevelScore { fin: number; dmg: number; deaths: number; nm: number; nmPerMin: number; t: number; score: number }
/**
 * Bölüm zorluk puanı (0-10, docs/12): 3 × ortalama can kaybı (bitiremeyen 3 can kaybetmiş sayılır) + yakın kaçış yoğunluğu
 * (dakikada 20 yakın kaçış = 1 puan, en çok 1). Hasarsız bölümleri de birbirinden ayırır.
 */
export function scoreRuns(runs: { fin: number | boolean; dmg?: number; damage?: number; deaths: number; nm?: number; nearMisses?: number; t: number }[]): LevelScore {
  const n = Math.max(1, runs.length); const avg = (f: (r: (typeof runs)[number]) => number) => runs.reduce((a, r) => a + f(r), 0) / n;
  const dmg = avg((r) => r.dmg ?? r.damage ?? 0); const fin = avg((r) => (r.fin ? 1 : 0)); const t = avg((r) => r.t); const nm = avg((r) => r.nm ?? r.nearMisses ?? 0);
  const nmPerMin = nm / Math.max(0.2, t / 60);
  return { fin, dmg, deaths: avg((r) => r.deaths), nm, nmPerMin, t, score: 3 * dmg + Math.min(1, nmPerMin / 20) };
}
