import { GROUND_Y } from '@odi/shared';
import { cloneState, step, NO_INPUT, type SimInput, type SimState } from './sim';
import type { World } from './world';
import { has } from './sim';

/**
 * Otomatik oyuncu: motorun kendi deterministik adımı üzerinde ileriye bakan arama (alıcı ufuklu planlama).
 *
 * Plan = makro eylemler: { at: adım, kind: 'press' (hold adım basılı) | 'swipe' (aşağı kaydır) | 'dash' (ileri kaydır) }.
 * Her adımda kalan plan + girdisiz devam ufuk boyunca simüle edilerek doğrulanır; hasar/düşme görülürse
 * yeniden aranır: önce mevcut plana tek eylem eklenir, olmazsa boş tabandan tek eylem, o da olmazsa en iyi
 * kısmi adayların üstüne ikinci eylem (sınırlı ışın). Puan: ilerleme (x + yükseklik) + nota/koklea/boss ödülü.
 * Simülasyon aynı fonksiyon olduğundan seçilen plan oyunda birebir aynı sonucu verir (kare hızından bağımsız).
 */

export interface Action { at: number; kind: 'press' | 'swipe' | 'dash'; hold: number }

const H = 114;          // ufuk (adım) ≈ 1,9 sn
const TAIL = 120;       // ufuk sonrası (girdisiz) yere inene kadar: yavaş süzülerek çukura düşüş de yakalansın
const D = 3;            // karar aralığı (adım)
const HOLDS = [2, 7, 12, 18, 26, 40, 60, 90];

export interface SimOutcome { ok: boolean; failAt: number; score: number; end: SimState; states: SimState[] | null; prog: number }

function inputAt(plan: Action[], i: number, out: SimInput): SimInput {
  out.down = false; out.pressed = false; out.released = false; out.swipeDown = false; out.dash = false;
  for (const a of plan) {
    if (a.kind === 'press') { if (i >= a.at && i < a.at + a.hold) out.down = true; if (i === a.at) out.pressed = true; if (i === a.at + a.hold) out.released = true; }
    else if (a.kind === 'swipe' && i === a.at) out.swipeDown = true;
    else if (a.kind === 'dash' && i === a.at) out.dash = true;
  }
  return out;
}

function potential(w: World, s: SimState): number {
  const h = s.hero; const b = s.boss;
  let v = h.x + 0.7 * Math.max(0, GROUND_Y - h.y) + s.coins * 40 + s.cochleas * 300 + s.opened.size * 1500 + s.broken.size * 60 + s.killed.size * 30 + s.notes * 120;
  if (s.finished) v += 1e5;
  if (b) {
    v = (b.maxHp - b.hp) * 2000 + b.notes.filter((n) => n.got).length * 500 + (b.mode === 'stun' ? 800 : 0) + s.coins * 10;
    // boss: kalbe/yumruğa yakın olmak iyi
    if (b.core) v -= Math.abs(h.x - b.core.x) * 2;
    const f = b.fists.find((q) => q.st === 'planted'); if (f) v -= Math.abs(h.x - f.x) * 1.5;
    const n = b.notes.find((q) => !q.got); if (n) v -= Math.hypot(h.x - n.x, h.y - 20 - n.y) * 1.5;
    if (b.defeated) v += 1e5;
  }
  if (w.spec.objective.id === 'escort' && s.escort && !s.escort.alive) v -= 3000;
  return v;
}

const INP: SimInput = { ...NO_INPUT };

/** çakılarak etkileşilecek hedefler (x, y üst yüzey) */
function poundTargets(w: World, s: SimState): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []; const hx = s.hero.x;
  for (const e of w.ents) {
    if (Math.abs(e.x - hx) > 700) continue;
    if (e.type === 'switch' && e.p.by !== 'darbe' && !s.opened.has(e.key)) out.push({ x: e.x, y: e.y });
  }
  const b = s.boss; if (b) for (const f of b.fists) if (f.st === 'planted') out.push({ x: f.x, y: GROUND_Y - 64 });
  return out;
}

/** planı `s0` durumundan (plan adımı `from`) simüle et; hasar (can kaybı / kalkan / düşüş) = başarısız */
export function simulatePlan(w: World, s0: SimState, plan: Action[], from = 0, keep = false): SimOutcome {
  const s = cloneState(s0); const dmg0 = s.damageTaken, sh0 = s.shield, rv0 = s.revir, esc0 = s.escort?.alive;
  const states: SimState[] | null = keep ? [] : null;
  let failAt = -1;
  const total = H + TAIL;
  for (let i = from; i < total; i++) {
    if (keep && i < H && i % D === 0) states![i / D] = cloneState(s);
    step(w, s, inputAt(plan, i, INP));
    const hurtNow = s.damageTaken !== dmg0 || s.shield !== sh0 || s.revir !== rv0 || !!s.failed || (esc0 && s.escort && !s.escort.alive);
    if (hurtNow) { failAt = i; break; }
    if (s.finished) break;
    if (i >= H && (s.hero.grounded || s.hero.water >= 0 || s.hero.wallId >= 0)) break; // kuyruk: yere bastıysa güvenli
  }
  const hh = s.hero;
  if (failAt < 0 && !s.finished && !hh.grounded && hh.water < 0 && hh.wallId < 0 && hh.g > 0 && hh.y > GROUND_Y + 40) failAt = total;
  const ok = failAt < 0;
  const pe = potential(w, s);
  return { ok, failAt, score: ok ? pe : -1e6 + failAt * 100 + pe * 0.01, end: s, states, prog: pe - potential(w, s0) };
}

export class Planner {
  plan: Action[] = [];
  /** plan başlangıcından bu yana geçen adım */
  private cursor = 0;
  private sinceVerify = 0;
  /** ilerlemesiz plan araması en son ne zaman yapıldı (sık tekrarlanmasın) */
  private poorAt = -999;
  stats = { searches: 0, sims: 0, steps: 0 };
  /** studio/harness: son kararın görünür hali */
  last: SimInput = { ...NO_INPUT };

  constructor(private w: World) {}

  /** bu adımın girdisi (her sim adımından önce çağrılır) */
  next(s: SimState): SimInput {
    if (this.sinceVerify <= 0) { this.sinceVerify = D * 2; this.verify(s); }
    this.sinceVerify--;
    const inp = inputAt(this.plan, this.cursor, { ...NO_INPUT });
    this.cursor++;
    // tamamlanmış eylemleri at
    if (this.cursor > 400) this.rebase();
    this.last = inp;
    return inp;
  }

  private rebase() {
    const c = this.cursor; this.plan = this.plan.filter((a) => a.at + (a.kind === 'press' ? a.hold : 0) >= c).map((a) => ({ ...a, at: a.at - c })); this.cursor = 0;
  }

  private verify(s: SimState) {
    this.rebase();
    const r = simulatePlan(this.w, s, this.plan); this.stats.sims++;
    this.stats.steps += r.end.n - s.n;
    if (r.ok && (r.prog >= 150 || s.n - this.poorAt < 30)) return;
    if (r.ok) this.poorAt = s.n;
    this.search(s, r);
  }

  /** eylem seçenekleri (yeteneklere göre) */
  private options(s: SimState): Omit<Action, 'at'>[] {
    const o: Omit<Action, 'at'>[] = HOLDS.map((hold) => ({ kind: 'press' as const, hold }));
    if (has(this.w, 'kayma') || has(this.w, 'cakil')) o.push({ kind: 'swipe', hold: 0 });
    if (has(this.w, 'darbe')) o.push({ kind: 'dash', hold: 0 });
    void s; return o;
  }

  private search(s: SimState, current: SimOutcome) {
    this.stats.searches++;
    const w = this.w; const opts = this.options(s);
    let best: { plan: Action[]; r: SimOutcome } | null = null;
    const partial: { plan: Action[]; r: SimOutcome }[] = [];
    const oks: { plan: Action[]; r: SimOutcome }[] = [];
    const consider = (plan: Action[], r: SimOutcome) => {
      this.stats.sims++;
      if (r.ok) { if (!best || r.score > best.r.score) best = { plan, r }; if (plan.length) oks.push({ plan, r }); }
      else if (plan.length) partial.push({ plan, r });
    };
    const conflicts = (plan: Action[], o: Omit<Action, 'at'>, at: number) => plan.some((a) => Math.abs(a.at - at) < D || (a.kind === 'press' && o.kind === 'press' && at <= a.at + a.hold && at + o.hold >= a.at));
    /** tabanın yörüngesindeki ara durumlardan dallanarak tek eylem ekle */
    const branch = (base: Action[], run: SimOutcome, startAt: number) => {
      const limit = run.ok ? H : Math.min(H, run.failAt + 1);
      for (let at = Math.ceil(startAt / D) * D; at < limit; at += D) {
        const st = run.states?.[at / D]; if (!st) continue;
        for (const o of opts) {
          if (conflicts(base, o, at)) continue;
          const plan = [...base, { ...o, at }].sort((a, b) => a.at - b.at);
          consider(plan, simulatePlan(w, st, plan, at));
        }
      }
    };
    // 1) mevcut plana tek eylem ekle  2) boş plandan tek eylem
    const bases: Action[][] = this.plan.length ? [this.plan, []] : [[]];
    for (const base of bases) {
      const run = simulatePlan(w, s, base, 0, true);
      if (base !== this.plan || current.ok) consider(base, run);
      branch(base, run, 0);
      if (best && (best as { r: SimOutcome }).r.prog >= 150) break;
    }
    // 3) ikinci eylem: en uzun yaşayan (ya da ilerlemesi zayıf) adayların üstüne
    const poor = !best || (best as { r: SimOutcome }).r.prog < 150;
    if (poor) {
      partial.sort((a, b) => b.r.score - a.r.score);
      const okSeeds = oks.sort((a, b) => b.r.score - a.r.score).filter((x) => x.plan.length).slice(0, 4);
      const seeds = [...partial.slice(0, best ? 2 : 6), ...okSeeds];
      for (const sd of seeds) {
        const run = simulatePlan(w, s, sd.plan, 0, true);
        const first = sd.plan[sd.plan.length - 1]!;
        branch(sd.plan, run, first.at + D);
        if (best && (best as { r: SimOutcome }).r.prog >= 150) break;
      }
    }
    // 4) çakılma hedefi (anahtar, kalkanlı düşman, saplı yumruk): zıplama yörüngesinde hedefin üstüne gelindiği adımda aşağı kaydır
    if ((!best || (best as { r: SimOutcome }).r.prog < 150) && has(w, 'cakil')) {
      const targets = poundTargets(w, s);
      if (targets.length) {
        for (let at = 0; at < H; at += D) for (const hold of [12, 26, 40]) {
          const plan1: Action[] = [{ kind: 'press', at, hold }];
          const run = simulatePlan(w, s, plan1, 0, true); this.stats.sims++;
          if (!run.states) continue;
          for (let k = Math.ceil((at + 4) / D); k < run.states.length; k++) {
            const st = run.states[k]!; const hx = st.hero.x;
            if (st.hero.grounded || st.hero.vy < -150) continue;
            if (!targets.some((tg) => Math.abs(tg.x - hx) < 16 && st.hero.y < tg.y - 30)) continue;
            const plan = [...plan1, { kind: 'swipe' as const, at: k * D, hold: 0 }];
            consider(plan, simulatePlan(w, st, plan, k * D));
            break;
          }
        }
      }
    }
    const chosen: { plan: Action[]; r: SimOutcome } | null = best ?? partial.sort((a, b) => b.r.score - a.r.score)[0] ?? null;
    if (chosen) { this.plan = chosen.plan; this.cursor = 0; }
  }
}
