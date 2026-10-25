import { GROUND_Y } from '@odi/shared';
import { cloneState, step, NO_INPUT, type SimInput, type SimState } from './sim';
import { near } from './world';
import type { World } from './world';
import { has } from './sim';

/**
 * Otomatik oyuncu: motorun kendi deterministik adımı üzerinde ileriye bakan arama (alıcı ufuklu planlama).
 *
 * Plan = makro eylemler: { at: adım, kind: 'press' (hold adım basılı) | 'swipe' (aşağı kaydır) | 'dash' (ileri kaydır) | 'turn' (geri kaydır) }.
 * Her adımda kalan plan + girdisiz devam ufuk boyunca simüle edilerek doğrulanır; hasar/düşme görülürse
 * yeniden aranır: önce mevcut plana tek eylem eklenir, olmazsa boş tabandan tek eylem, o da olmazsa en iyi
 * kısmi adayların üstüne ikinci eylem (sınırlı ışın). Puan: ilerleme (x + yükseklik) + nota/koklea/boss ödülü.
 * Simülasyon aynı fonksiyon olduğundan seçilen plan oyunda birebir aynı sonucu verir (kare hızından bağımsız).
 */

export interface Action { at: number; kind: 'press' | 'swipe' | 'dash' | 'turn'; hold: number }

const H_DEF = 114;      // ufuk (adım) ≈ 1,9 sn
const TAIL = 120;       // ufuk sonrası (girdisiz) yere inene kadar: yavaş süzülerek çukura düşüş de yakalansın
const D = 3;            // karar aralığı (adım)
const HOLDS = [2, 7, 12, 18, 26, 40, 60, 90];

export interface SimOutcome { ok: boolean; failAt: number; score: number; end: SimState; states: SimState[] | null; prog: number }

function inputAt(plan: Action[], i: number, out: SimInput): SimInput {
  out.down = false; out.pressed = false; out.released = false; out.swipeDown = false; out.dash = false; out.turn = false;
  for (const a of plan) {
    if (a.kind === 'press') { if (i >= a.at && i < a.at + a.hold) out.down = true; if (i === a.at) out.pressed = true; if (i === a.at + a.hold) out.released = true; }
    else if (a.kind === 'swipe' && i === a.at) out.swipeDown = true;
    else if (a.kind === 'dash' && i === a.at) out.dash = true;
    else if (a.kind === 'turn' && i === a.at) out.turn = true;
  }
  return out;
}

/**
 * planlayıcı tercihleri: greedy notaları kovalar; secrets=false gizli koklealara sapmaz ("ana yol" oyuncusu, testler için).
 * İnsan benzeri oyuncu (play/human.ts) için: `horizon` ileri bakış (adım), `react` tepki gecikmesi (adım; yeni karar ancak bu
 * kadar sonra uygulanabilir, o ana dek planlanmış eylemler değişmez), `motor` yeni seçilen her eylemin elden çıkan hali
 * (zamanlama sapması, geç kalma; null = kaçan girdi).
 */
export interface PlanPrefs { greedy?: boolean; secrets?: boolean; /** testler: bu noktaya (ör. gizli koklea) yaklaşmak ilerlemedir */ goal?: { x: number; y: number }; horizon?: number; react?: number; motor?: (a: Action, releaseOnly: boolean) => Action | null; /** notaya dalan oyuncu (play/human.ts → NOTACI) */ notes?: NoteSeek }

/**
 * Notaya dalan oyuncunun niyeti (play/human.ts → `notaciOf`; docs/12 §2). Görünen (`viewPx` ileride, ekranın sağ kenarı) her
 * GÜVENLİ nota için plan ararken ana yoldan sapmayı tartar: nota ana yol oyuncusunun 40'ına ek `value` değerindedir (ilerleme
 * pikseli cinsinden; koşu başına bir kez). Tehlikeye (diken, gürültü, düşman; hareket kapsamı dahil) `riskPx`'ten yakın nota için
 * ek değer azalır, `riskPx / 2`'den yakında hiç yoktur: oyuncu o notadan vazgeçer, ancak yolu üstündeyse alır.
 */
export interface NoteSeek { value: number; riskPx: number; viewPx: number }
const noteCache = new WeakMap<NoteSeek, { w: World; m: Map<number, number> }>();
/** nota (varlık kimliği) → notaya dalan oyuncunun ek değeri (yalnız > 0 olanlar) */
export function noteWeights(w: World, ns: NoteSeek): Map<number, number> {
  const c = noteCache.get(ns); if (c && c.w === w) return c.m;
  const danger: { l: number; t: number; r: number; b: number }[] = [];
  for (const e of w.ents) {
    if (e.cls === 'hazard') { const dy = Math.abs(Number(e.p.dy ?? 0)); danger.push({ l: e.sl, t: e.t - dy, r: e.sr, b: e.b + dy }); }
    else if (e.cls === 'enemy') { const a = Math.abs(Number(e.p.amp ?? 0)); danger.push({ l: e.sl, t: e.t - a, r: e.sr, b: e.b + a }); }
  }
  const m = new Map<number, number>();
  for (const e of w.ents) {
    if (e.type !== 'coin' && e.type !== 'collect') continue;
    let d = Infinity;
    for (const q of danger) d = Math.min(d, Math.hypot(Math.max(0, q.l - e.x, e.x - q.r), Math.max(0, q.t - e.y, e.y - q.b)));
    const k = Math.max(0, Math.min(1, (d - ns.riskPx / 2) / (ns.riskPx / 2)));
    // büyük nota (5 nota sayılır) daha çekici, ama beş katı değil: oyuncu tek ödül görür
    if (k > 0) m.set(e.id, ns.value * k * (e.type === 'collect' ? 2 : 1));
  }
  noteCache.set(ns, { w, m });
  return m;
}
function potential(w: World, s: SimState, pr: PlanPrefs = {}): number {
  const h = s.hero; const b = s.boss;
  let v = h.x + 0.7 * Math.max(0, GROUND_Y - h.y) + s.coins * (pr.greedy ? 160 : 40) + s.cochleas * (pr.secrets === false ? -200 : 300) + s.opened.size * 1500 + s.broken.size * 60 + s.killed.size * 30 + s.notes * 120;
  if (pr.notes) { const m = noteWeights(w, pr.notes); for (const id of s.collected) v += m.get(id) ?? 0; }
  if (s.finished) v += 1e5;
  if (pr.goal) v += (s.cochleas ? 5e4 : 0) - 3 * Math.hypot(h.x - pr.goal.x, h.y - 20 - pr.goal.y) - h.x;
  // insan: kapının rengini görür — önündeki frekans kapısının rengini taşımak ilerlemedir (bulmacanın amacı)
  if (pr.react && h.color >= 0) for (const id of near(w, h.x - 200, h.x + 900)) { const e = w.ents[id]!; if (e.type === 'freqgate' && (e.x - h.x) * h.dir > -40 && Math.abs(h.color - Number(e.p.color ?? 0)) < 0.08) { v += 700; break; } }
  // geri dönüş anahtarı: kapısı kapalıyken anahtara yakınlık ilerlemedir (oyuncu da kapıya varınca geri döner)
  for (const id of near(w, h.x - 900, h.x + 300)) {
    const e = w.ents[id]!; if (e.type !== 'switch' || e.p.by !== 'temas' || s.opened.has(e.key)) continue;
    v -= Math.abs(h.x - e.x) * 1.3 + Math.max(0, h.y - e.y) * 0.8;
  }
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

/** havadaki kahramanın altında (ilerideki ~120 px dahil) inebileceği bir yüzey var mı */
function groundBelow(w: World, s: SimState): boolean {
  const h = s.hero; const x0 = Math.min(h.x, h.x + h.dir * 120), x1 = Math.max(h.x, h.x + h.dir * 120);
  for (const id of near(w, x0 - 20, x1 + 20)) {
    const e = w.ents[id]!; if (e.cls !== 'solid' && e.cls !== 'oneway' && e.type !== 'water') continue;
    if (e.r < x0 - 15 || e.l > x1 + 15) continue;
    if (e.type === 'water') return true;
    if (e.t >= h.y - 4 && e.t < GROUND_Y + 300) return true;
  }
  return false;
}
/** çakılarak etkileşilecek hedefler (x, y üst yüzey) */
function poundTargets(w: World, s: SimState): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []; const hx = s.hero.x;
  for (const e of w.ents) {
    if (Math.abs(e.x - hx) > 700) continue;
    if (e.type === 'switch' && e.p.by !== 'darbe' && e.p.by !== 'temas' && !s.opened.has(e.key)) out.push({ x: e.x, y: e.y });
  }
  const b = s.boss; if (b) for (const f of b.fists) if (f.st === 'planted') out.push({ x: f.x, y: GROUND_Y - 64 });
  return out;
}

/** planı `s0` durumundan (plan adımı `from`) simüle et; hasar (can kaybı / kalkan / düşüş) = başarısız */
export function simulatePlan(w: World, s0: SimState, plan: Action[], from = 0, keep = false, pr: PlanPrefs = {}): SimOutcome {
  const s = cloneState(s0); const dmg0 = s.damageTaken, sh0 = s.shield, rv0 = s.revir, esc0 = s.escort?.alive, soft0 = s.softHits;
  const states: SimState[] | null = keep ? [] : null;
  let failAt = -1;
  const H = pr.horizon ?? H_DEF;
  const total = H + TAIL;
  for (let i = from; i < total; i++) {
    if (keep && i < H && i % D === 0) states![i / D] = cloneState(s);
    step(w, s, inputAt(plan, i, INP));
    const hurtNow = s.damageTaken !== dmg0 || s.softHits !== soft0 || s.shield !== sh0 || s.revir !== rv0 || !!s.failed || (esc0 && s.escort && !s.escort.alive);
    if (hurtNow) { failAt = i; break; }
    if (s.finished) break;
    if (i >= H && (s.hero.grounded || s.hero.water >= 0 || s.hero.wallId >= 0)) break; // kuyruk: yere bastıysa güvenli
    if (i >= H && pr.react && s.hero.hookId >= 0) break; // insan: ufkun sonunda bir kancada asılıysa güvenli (bırakışa o an karar verir)
  }
  const hh = s.hero;
  if (failAt < 0 && !s.finished && !hh.grounded && hh.water < 0 && hh.wallId < 0 && hh.hookId < 0 && hh.g > 0 && (hh.y > GROUND_Y + 40 || !groundBelow(w, s))) failAt = total;
  const ok = failAt < 0;
  const pe = potential(w, s, pr);
  return { ok, failAt, score: ok ? pe : -1e6 + failAt * 100 + pe * 0.01, end: s, states, prog: pe - potential(w, s0, pr) };
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

  /** greedy: notaları da kovalar (araçlar/testler için "bu nota ulaşılabilir mi" ölçümü; oyundaki bot varsayılanı değil) */
  private greedy: boolean; private pr: PlanPrefs; private turnRooms: boolean;
  constructor(private w: World, prefs: boolean | PlanPrefs = false) { this.pr = typeof prefs === 'boolean' ? { greedy: prefs } : prefs; this.greedy = !!this.pr.greedy; this.turnRooms = w.ents.some((e) => e.type === 'switch' || e.type === 'door' || e.type === 'freqgate'); }

  private needTurn(s: SimState): boolean {
    const h = s.hero;
    // ilk bölümler (dönüş kilitli): geriye bakan kahraman için ileri dönüş hep bir seçenek (anahtardan sonra kapıya dönüş)
    if (this.w.assist.turnGate && h.dir < 0) return true;
    for (const id of near(this.w, h.x - 900, h.x + 600)) {
      const e = this.w.ents[id]!;
      if (e.type === 'switch' && e.p.by === 'temas' && !s.opened.has(e.key)) return true;
      if (e.type === 'freqgate' && Math.abs(e.x - h.x) < 600 && !(h.color >= 0 && Math.abs(h.color - Number(e.p.color ?? 0)) < 0.08)) return true;
    }
    return false;
  }
  /** ufukta (ileride ~600 px) alınmamış nota var mı */
  private coinsAhead(s: SimState): boolean {
    const h = s.hero; const ns = this.pr.notes; const m = ns ? noteWeights(this.w, ns) : null;
    // notaya dalan oyuncu: yalnız ekranda görünen, vazgeçmediği (güvenli) notalar
    const x0 = ns ? Math.min(h.x - 40, h.x + h.dir * ns.viewPx) : h.x - 40, x1 = ns ? Math.max(h.x + 40, h.x + h.dir * ns.viewPx) : h.x + 640;
    for (const id of near(this.w, x0, x1)) { const e = this.w.ents[id]!; if ((e.type === 'coin' || e.type === 'collect') && !s.collected.has(id) && (e.x - h.x) * h.dir > -30 && (!m || m.has(id))) return true; }
    return false;
  }

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
    const r = simulatePlan(this.w, s, this.plan, 0, false, this.pr); this.stats.sims++;
    this.stats.steps += r.end.n - s.n;
    if ((this.greedy || this.pr.notes) && r.ok && s.n - this.poorAt >= 12 && this.coinsAhead(s)) { this.poorAt = s.n; this.search(s, r); return; }
    // boss bağırırken notalar havada: koşarak yaklaşmak "ilerleme" sayılır ama nota zıplamadan alınmaz — düzenli ara
    if (r.ok && s.boss && s.boss.mode === 'scream' && s.n - this.poorAt >= 12) { this.poorAt = s.n; this.search(s, r); return; }
    if (r.ok && (r.prog >= 150 || s.n - this.poorAt < (this.pr.react ? (s.hero.hookId >= 0 ? 6 : 12) : 30))) return;
    if (r.ok) this.poorAt = s.n;
    this.search(s, r);
  }

  /** eylem seçenekleri (yeteneklere göre) */
  private options(s: SimState): Omit<Action, 'at'>[] {
    const o: Omit<Action, 'at'>[] = HOLDS.map((hold) => ({ kind: 'press' as const, hold }));
    if (has(this.w, 'kayma') || has(this.w, 'cakil')) o.push({ kind: 'swipe', hold: 0 });
    if (has(this.w, 'darbe')) o.push({ kind: 'dash', hold: 0 });
    // geri dön: yalnızca geri dönmenin gerektiği yerde aranır (yakında açılmamış dokunma anahtarı, kapalı kapı ya da
    // renk tutmayan frekans kapısı) — her yerde açık olsa bot geride kalan notalar için döner, döngüye girebilir
    if (this.turnRooms && this.needTurn(s)) o.push({ kind: 'turn', hold: 0 });
    return o;
  }

  private search(s: SimState, current: SimOutcome) {
    this.stats.searches++;
    const w = this.w; const opts = this.options(s);
    const H = this.pr.horizon ?? H_DEF;
    // tepki gecikmesi: bu adımdan önce planlanmış eylemler (kesinleşmiş) değişmez; yeni eylem ancak R adım sonra
    const R = this.pr.react ?? 0;
    const committed = R > 0 ? this.plan.filter((a) => a.at < R) : [];
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
      for (let at = Math.ceil(Math.max(startAt, R) / D) * D; at < limit; at += D) {
        const st = run.states?.[at / D]; if (!st) continue;
        for (const o of opts) {
          if (conflicts(base, o, at)) continue;
          const plan = [...base, { ...o, at }].sort((a, b) => a.at - b.at);
          consider(plan, simulatePlan(w, st, plan, at, false, this.pr));
        }
      }
    };
    // 0) insan: süren basılı tutmanın bırakılışı (tepki süresinden sonrası) yeniden zamanlanabilir — kancada salınırken,
    //    süzülürken parmak ne zaman kalkacağına o an karar verir
    if (R > 0) {
      const hold0 = committed.find((a) => a.kind === 'press' && a.at + a.hold >= R);
      if (hold0) {
        const vars: { plan: Action[]; r: SimOutcome; rel: number }[] = [];
        for (let rel = Math.ceil(R / D) * D; rel <= H + 30; rel += D * 2) {
          const hold = rel - hold0.at; if (hold === hold0.hold || hold < 2) continue;
          const plan = committed.map((a) => (a === hold0 ? { ...a, hold } : a));
          const r = simulatePlan(w, s, plan, 0, false, this.pr); consider(plan, r); vars.push({ plan, r, rel });
        }
        // en iyi birkaç bırakılışın ardından tek eylem (ör. kancadan bırak → sonraki kancaya yeniden basılı tut)
        if (!best || (best as { r: SimOutcome }).r.prog < 150) {
          for (const v of vars.sort((a, b) => b.r.score - a.r.score).slice(0, 3)) branch(v.plan, simulatePlan(w, s, v.plan, 0, true, this.pr), v.rel + D);
        }
      }
    }
    // 1) mevcut plana tek eylem ekle  2) boş plandan tek eylem
    const bases: Action[][] = this.plan.length ? (committed.length < this.plan.length ? [this.plan, committed] : [this.plan]) : [[]];
    for (const base of bases) {
      const run = simulatePlan(w, s, base, 0, true, this.pr);
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
        const run = simulatePlan(w, s, sd.plan, 0, true, this.pr);
        const first = sd.plan[sd.plan.length - 1]!;
        branch(sd.plan, run, first.at + D);
        if (best && (best as { r: SimOutcome }).r.prog >= 150) break;
      }
    }
    // 4) çakılma hedefi (anahtar, kalkanlı düşman, saplı yumruk): zıplama yörüngesinde hedefin üstüne gelindiği adımda aşağı kaydır
    if ((!best || (best as { r: SimOutcome }).r.prog < 150) && has(w, 'cakil')) {
      const targets = poundTargets(w, s);
      if (targets.length) {
        for (let at = Math.ceil(R / D) * D; at < H; at += D) for (const hold of [12, 26, 40]) {
          if (conflicts(committed, { kind: 'press', hold }, at)) continue;
          const plan1: Action[] = [...committed, { kind: 'press', at, hold }];
          const run = simulatePlan(w, s, plan1, 0, true, this.pr); this.stats.sims++;
          if (!run.states) continue;
          for (let k = Math.ceil((at + 4) / D); k < run.states.length; k++) {
            const st = run.states[k]!; const hx = st.hero.x;
            if (st.hero.grounded || st.hero.vy < -150) continue;
            if (!targets.some((tg) => Math.abs(tg.x - hx) < 16 && st.hero.y < tg.y - 30)) continue;
            const plan = [...plan1, { kind: 'swipe' as const, at: k * D, hold: 0 }];
            consider(plan, simulatePlan(w, st, plan, k * D, false, this.pr));
            break;
          }
        }
      }
    }
    const chosen: { plan: Action[]; r: SimOutcome } | null = best ?? partial.sort((a, b) => b.r.score - a.r.score)[0] ?? null;
    if (chosen) {
      let plan = chosen.plan;
      // insan oyuncu: yeni seçilen eylemler elden "kusurlu" çıkar (eski eylemler aynı nesnelerdir, yeniden bozulmaz)
      const motor = this.pr.motor;
      if (motor) {
        const old = new Set(this.plan);
        // aynı anda başlamış eski basış: yalnız bırakılışı yeniden zamanlanmıştır (başlangıç zaten olmuş)
        const started = (a: Action) => a.kind === 'press' && this.plan.some((o) => o.kind === 'press' && o.at === a.at && o.at < (this.pr.react ?? 0));
        plan = plan.flatMap((a) => (old.has(a) ? [a] : (motor(a, started(a)) ?? []))).sort((a, b) => a.at - b.at);
      }
      this.plan = plan; this.cursor = 0;
    }
  }
}
