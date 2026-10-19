/**
 * Kutlama katmanı: sandık, jeton uçuşu, seviye atlama, biyom canlandı, şerit.
 * Kuyruklu (aynı anda tek kutlama), dokununca hızlanır, prefers-reduced-motion'da kısa ve parçacıksız.
 * Dürüstlük: gösterilen içerik = verilen içerik (çağıranın verdiği öğeler aynen gösterilir); gizli olasılık yok.
 */
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { audio } from '@odi/audio';
import { BIOMES, cardById, cosmeticById } from '@odi/content';
import type { BiomeId } from '@odi/shared';
import { celebrate as celebrateRef, registerCelebrations, type RewardItem, type ScreenPoint } from './index';
import { Particles } from './particles';
import { hud, type HudKind } from './hud';
import { setFxEngine } from './fx';
import { platform } from '../platform';
import { useStore } from '../store';
import { Toasts } from '../ui/Toasts';
import { prefersReducedMotion } from '../ui/bits';
import { Art, Glyph, Rich } from '../ui/art';
import './celebrate.css';

type Tier = 'bronz' | 'gumus' | 'altin';
type Scene =
  | { kind: 'chest'; title: string; items: RewardItem[]; tier: Tier; phase: 'drop' | 'shake' | 'open' | 'reveal' | 'collect' | 'out'; shake: number; shown: number }
  | { kind: 'levelUp'; level: number; unlocks: string[]; phase: 'burst' | 'list' | 'out'; shown: number }
  | { kind: 'biome'; biome: string; name: string; reward: RewardItem[]; phase: 'rise' | 'title' | 'reward' | 'out'; shown: number };

interface Job { run: () => Promise<void>; done: () => void }

/** ödül öğesinin görünümü (ikon, ad, miktar) */
export function itemView(it: RewardItem): { icon: string; name: string; amount: number | null; tone: string } {
  switch (it.kind) {
    case 'jeton': return { icon: '🪙', name: it.label ?? 'Jeton', amount: it.amount, tone: 'gold' };
    case 'kristal': return { icon: '💎', name: it.label ?? 'Kristal', amount: it.amount, tone: 'teal' };
    case 'xp': return { icon: '✨', name: it.label ?? 'XP', amount: it.amount, tone: 'violet' };
    case 'koruyucu': return { icon: '🛡️', name: it.label ?? 'Seri koruyucu', amount: it.amount, tone: 'violet' };
    case 'kalkan': return { icon: '🛡️', name: it.label ?? 'Kalkan', amount: it.amount, tone: 'violet' };
    case 'hizlandirici': return { icon: '⏩', name: it.label ?? 'Hızlandırıcı', amount: it.amount, tone: 'teal' };
    case 'kozmetik': { const c = cosmeticById(it.ref ?? ''); return { icon: c?.kind === 'renk' ? '🎨' : '🎩', name: it.label ?? c?.name ?? 'Kozmetik', amount: null, tone: 'coral' }; }
    case 'kart': { const c = cardById(it.ref ?? ''); return { icon: '🃏', name: it.label ?? c?.title ?? 'Kulak Kartı', amount: null, tone: 'lime' }; }
  }
}
const currency = (it: RewardItem): HudKind | null => (it.kind === 'jeton' || it.kind === 'kristal' ? it.kind : null);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const center = (el: Element | null | undefined): ScreenPoint | null => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

export function CelebrationLayer({ toasts = true }: { toasts?: boolean }) {
  const [scene, setScene] = useState<Scene | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); const flyRef = useRef<HTMLDivElement>(null); const chestRef = useRef<HTMLDivElement>(null); const cardsRef = useRef<HTMLDivElement>(null);
  const fx = useRef<Particles | null>(null);
  const queue = useRef<Job[]>([]); const busy = useRef(false);
  const skipFn = useRef<(() => void) | null>(null); const waitBtn = useRef<(() => void) | null>(null);
  const reduced = useRef(prefersReducedMotion());

  // ---------------------------------------------------------------- yardımcılar
  /** bekle; dokunuş bekleyişi kısaltır (hızlandırma). Azaltılmış harekette çok kısa. */
  const wait = (ms: number) => new Promise<void>((res) => {
    const d = reduced.current ? Math.min(ms, 120) : ms;
    const h = setTimeout(() => { skipFn.current = null; res(); }, d);
    skipFn.current = () => { clearTimeout(h); skipFn.current = null; res(); };
  });
  /** düğmeye basılmasını bekle (ya da üst sınır süre) */
  const waitTap = (maxMs = 9000) => new Promise<void>((res) => {
    const h = setTimeout(() => { waitBtn.current = null; res(); }, maxMs);
    waitBtn.current = () => { clearTimeout(h); waitBtn.current = null; res(); };
  });
  const enqueue = (run: () => Promise<void>) => new Promise<void>((done) => { queue.current.push({ run, done }); void pump(); });
  const pump = async () => {
    if (busy.current) return; busy.current = true;
    while (queue.current.length) {
      const j = queue.current.shift()!;
      try { await j.run(); } catch { /* kutlama hatası oyunu durdurmasın */ }
      setScene(null); j.done();
    }
    busy.current = false;
  };
  const P = () => (reduced.current ? null : fx.current);

  /** jeton/kristal uçuşu: kaynaktan eğrisel yollarla HUD sayacına; her varışta tık + sayaç zıplar */
  const flyCoins = async (amount: number, kind: HudKind, from: ScreenPoint | null, held: boolean) => {
    if (amount <= 0) return;
    if (!held) hud.hold(kind, amount);
    const tEl = hud.target(kind); const to = center(tEl) ?? { x: window.innerWidth - 48, y: 28 };
    const src = from ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
    const layer = flyRef.current;
    if (reduced.current || !layer || typeof Element.prototype.animate !== 'function') { hud.arrive(kind, amount); audio.play('coin'); return; }
    const n = Math.min(20, Math.max(Math.min(amount, 8), Math.round(Math.sqrt(amount) * 2.2)));
    const base = Math.floor(amount / n); let extra = amount - base * n;
    audio.play(n >= 10 ? 'coinBurst' : 'pop', { vol: 0.8 });
    const flights: Promise<void>[] = [];
    for (let i = 0; i < n; i++) {
      const chunk = base + (extra-- > 0 ? 1 : 0);
      const el = document.createElement('div'); el.className = kind === 'kristal' ? 'cel-gem' : 'cel-coin'; layer.appendChild(el);
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6; const rad = 30 + Math.random() * 50;
      const sx = src.x + Math.cos(ang) * rad, sy = src.y + Math.sin(ang) * rad * 0.7;
      const cx = (sx + to.x) / 2 + (Math.random() - 0.5) * 220, cy = Math.min(sy, to.y) - 60 - Math.random() * 120;
      const frames: Keyframe[] = [{ transform: `translate(${src.x}px,${src.y}px) scale(.3)`, opacity: 0, offset: 0 }, { transform: `translate(${sx}px,${sy}px) scale(1.15)`, opacity: 1, offset: 0.22 }];
      for (let s = 1; s <= 10; s++) { const k = s / 10; const x = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * cx + k * k * to.x; const y = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * cy + k * k * to.y; frames.push({ transform: `translate(${x}px,${y}px) scale(${1.1 - k * 0.45}) rotate(${k * 300}deg)`, opacity: 1, offset: 0.22 + k * 0.78 }); }
      const anim = el.animate(frames, { duration: 820 + Math.random() * 160, delay: i * 55, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
      flights.push(anim.finished.then(() => {
        el.remove(); hud.arrive(kind, chunk);
        audio.play('coin', { semitones: Math.min(12, Math.floor((i / n) * 13)), vol: 0.7 });
        if (i % 3 === 0) P()?.sparkle(to.x, to.y, 6, 20);
        if (i === n - 1) { P()?.ring(to.x, to.y, '#ffe08a', 14); platform().haptic('light'); }
      }, () => { el.remove(); hud.arrive(kind, chunk); }));
    }
    await Promise.all(flights);
    hud.release(kind);
  };

  // ---------------------------------------------------------------- kutlamalar
  const runChest = async (o: { title: string; items: RewardItem[]; tier?: Tier }) => {
    const items = o.items; const tier = o.tier ?? 'bronz';
    for (const it of items) { const k = currency(it); if (k) hud.hold(k, it.amount); }
    const base = { kind: 'chest' as const, title: o.title, items, tier, shake: 0, shown: 0 };
    audio.duck(6, 0.35);
    setScene({ ...base, phase: 'drop' }); audio.play('whoosh', { vol: 0.8 }); await wait(700);
    for (let i = 0; i < 3; i++) { setScene({ ...base, phase: 'shake', shake: i + 1 }); audio.play('chestShake', { semitones: i * 2 }); platform().haptic(i === 2 ? 'heavy' : 'medium'); await wait(560); }
    setScene({ ...base, phase: 'open', shake: 3 }); audio.play('chestOpen'); platform().haptic('success');
    const c = center(chestRef.current) ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    P()?.confetti(c.x, c.y, 110, 1.1); P()?.ring(c.x, c.y, '#fff6e5', 30); P()?.sparkle(c.x, c.y, 24, 90);
    await wait(650);
    for (let k = 1; k <= items.length; k++) { setScene({ ...base, phase: 'reveal', shake: 3, shown: k }); audio.play('itemReveal', { semitones: Math.min(12, (k - 1) * 2) }); platform().haptic('light'); await wait(420); }
    setScene({ ...base, phase: 'collect', shake: 3, shown: items.length });
    await waitTap(15000);
    // topla: para birimleri sayaca uçar, diğerleri yukarı süzülür
    const cards = Array.from(cardsRef.current?.querySelectorAll<HTMLElement>('.cel-card') ?? []);
    setScene({ ...base, phase: 'out', shake: 3, shown: items.length });
    audio.play('whoosh', { vol: 0.6 });
    await Promise.all(items.map(async (it, i) => { const k = currency(it); if (k) await flyCoins(it.amount, k, center(cards[i]), true); }));
    await sleep(reduced.current ? 0 : 150);
  };

  const runLevelUp = async (o: { level: number; unlocks?: string[] }) => {
    const unlocks = o.unlocks ?? [];
    audio.duck(3, 0.3);
    setScene({ kind: 'levelUp', level: o.level, unlocks, phase: 'burst', shown: 0 });
    audio.play('levelUp'); platform().haptic('success');
    const cx = window.innerWidth / 2, cy = window.innerHeight * 0.38;
    P()?.ring(cx, cy, '#ffc93c', 40); P()?.confetti(cx, cy, 120, 1.2); setTimeout(() => P()?.rain(60), 300);
    await wait(1100);
    for (let k = 1; k <= unlocks.length; k++) { setScene({ kind: 'levelUp', level: o.level, unlocks, phase: 'list', shown: k }); audio.play('unlock', { semitones: (k - 1) * 2, vol: 0.8 }); await wait(380); }
    setScene({ kind: 'levelUp', level: o.level, unlocks, phase: 'list', shown: unlocks.length });
    await waitTap(7000);
    setScene({ kind: 'levelUp', level: o.level, unlocks, phase: 'out', shown: unlocks.length }); await sleep(reduced.current ? 0 : 220);
  };

  const runBiome = async (o: { biome: string; name: string; reward?: RewardItem[] }) => {
    const reward = o.reward ?? [];
    for (const it of reward) { const k = currency(it); if (k) hud.hold(k, it.amount); }
    const base = { kind: 'biome' as const, biome: o.biome, name: o.name, reward, shown: 0 };
    audio.duck(5, 0.3);
    setScene({ ...base, phase: 'rise' }); audio.play('biomeAwaken'); platform().haptic('medium');
    const cx = window.innerWidth / 2;
    await wait(900);
    setScene({ ...base, phase: 'title' }); P()?.notes(cx, window.innerHeight * 0.55, 18); P()?.confetti(cx, window.innerHeight * 0.35, 80, 1); platform().haptic('success');
    await wait(1200);
    for (let k = 1; k <= reward.length; k++) { setScene({ ...base, phase: 'reward', shown: k }); audio.play('itemReveal', { semitones: (k - 1) * 2 }); await wait(400); }
    setScene({ ...base, phase: 'reward', shown: reward.length });
    await waitTap(9000);
    const cards = Array.from(cardsRef.current?.querySelectorAll<HTMLElement>('.cel-card') ?? []);
    setScene({ ...base, phase: 'out', shown: reward.length });
    await Promise.all(reward.map(async (it, i) => { const k = currency(it); if (k) await flyCoins(it.amount, k, center(cards[i]), true); }));
  };

  useEffect(() => {
    if (canvasRef.current) { fx.current = new Particles(canvasRef.current); setFxEngine(fx.current); }
    const onResize = () => fx.current?.resize(); addEventListener('resize', onResize);
    registerCelebrations({
      chest: (o) => enqueue(() => runChest(o)),
      coins: (o) => enqueue(() => flyCoins(o.amount, o.kind ?? 'jeton', o.from ?? null, false)),
      levelUp: (o) => enqueue(() => runLevelUp(o)),
      biomeRestored: (o) => enqueue(() => runBiome(o)),
      banner: (o) => { const tone = o.tone === 'coral' ? 'coral' : o.tone === 'green' ? 'green' : o.tone === 'gold' ? 'gold' : 'accent'; useStore.setState((s) => ({ toasts: [...s.toasts, { id: Date.now() + Math.random(), icon: o.icon, title: o.title, text: o.body, tone }] })); },
    });
    // test/önizleme için (yalnızca ?demo / ?kutlama varken)
    if (/[?&](demo|kutlama)=/.test(location.search)) (window as unknown as { __celebrate?: unknown }).__celebrate = { ...celebrateRef };
    return () => { removeEventListener('resize', onResize); fx.current?.destroy(); setFxEngine(null); registerCelebrations({ async chest() {}, async coins() {}, async levelUp() {}, async biomeRestored() {}, banner() {} }); };
  }, []);

  const tapStage = () => { if (skipFn.current) skipFn.current(); else if (scene?.kind === 'levelUp' && waitBtn.current) waitBtn.current(); };

  return (
    <>
      {toasts && <Toasts />}
      <div className={`cel-root${scene ? ' on' : ''}`} aria-live="polite">
        {scene && <div className={`cel-back${scene.phase === 'out' ? ' out' : ''}${scene.kind === 'biome' ? ' biome' : ''}`} style={scene.kind === 'biome' ? biomeVars(scene.biome) : undefined} onClick={tapStage} />}
        {scene?.kind === 'chest' && <ChestScene s={scene} chestRef={chestRef} cardsRef={cardsRef} onTap={tapStage} onCollect={() => waitBtn.current?.()} />}
        {scene?.kind === 'levelUp' && <LevelUpScene s={scene} onTap={tapStage} onOk={() => waitBtn.current?.()} />}
        {scene?.kind === 'biome' && <BiomeScene s={scene} cardsRef={cardsRef} onTap={tapStage} onOk={() => waitBtn.current?.()} />}
        <canvas ref={canvasRef} className="cel-canvas" aria-hidden />
        <div ref={flyRef} className="cel-fly" aria-hidden />
      </div>
    </>
  );
}

function biomeVars(id: string): CSSProperties {
  const b = BIOMES[id as BiomeId]; const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  return b ? { ['--b1' as string]: hex(b.palette.accent), ['--b2' as string]: hex(b.palette.groundDark) } : {};
}

function tierOf(items: RewardItem[]): Tier { return items.some((i) => i.kind === 'kozmetik' || i.kind === 'kart') ? 'altin' : items.reduce((a, i) => a + (i.kind === 'jeton' ? i.amount : 0), 0) >= 100 ? 'gumus' : 'bronz'; }
export { tierOf as chestTierFor };

function Card({ it, i, show }: { it: RewardItem; i: number; show: boolean }) {
  const v = itemView(it);
  return (
    <div className={`cel-card tone-${v.tone}${show ? ' in' : ''}`} style={{ ['--i' as string]: i }}>
      <div className="cc-icon" aria-hidden><Glyph e={v.icon} size={46} /></div>
      {v.amount != null && <CountUp to={v.amount} run={show} prefix={it.kind === 'xp' ? '+' : '×'} />}
      <div className="cc-name">{v.name}</div>
    </div>
  );
}
function CountUp({ to, run, prefix = '' }: { to: number; run: boolean; prefix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return; if (prefersReducedMotion()) { setV(to); return; }
    let raf = 0; const t0 = performance.now(); const ms = Math.min(700, 250 + to * 4);
    const f = (t: number) => { const k = Math.max(0, Math.min(1, (t - t0) / ms)); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <div className="cc-amt">{prefix}{v.toLocaleString('tr-TR')}</div>;
}

function ChestScene({ s, chestRef, cardsRef, onTap, onCollect }: { s: Extract<Scene, { kind: 'chest' }>; chestRef: RefObject<HTMLDivElement | null>; cardsRef: RefObject<HTMLDivElement | null>; onTap: () => void; onCollect: () => void }) {
  const opened = s.phase === 'open' || s.phase === 'reveal' || s.phase === 'collect' || s.phase === 'out';
  return (
    <div className={`cel-stage chest-stage ph-${s.phase}`} onClick={onTap} role="dialog" aria-label={s.title}>
      <div className="cel-title">{s.title}</div>
      <div className={`cel-chest tier-${s.tier}${opened ? ' opened' : ''}`} ref={chestRef} data-shake={s.shake} key={`sh${s.shake}`}>
        <div className="cc-rays" aria-hidden /><div className="cc-glow" aria-hidden />
        <div className="cc-lid"><i className="cc-band" /><i className="cc-band r" /></div>
        <div className="cc-body"><i className="cc-band" /><i className="cc-band r" /><i className="cc-lock" /></div>
        {opened && <div className="cc-burst" aria-hidden />}
      </div>
      <div className={`cel-cards n${Math.min(6, s.items.length)}`} ref={cardsRef}>
        {opened && s.items.map((it, i) => <Card key={i} it={it} i={i} show={i < s.shown} />)}
      </div>
      <div className="cel-cta">
        {s.phase === 'collect' ? <button className="btn gold big-cta" onClick={(e) => { e.stopPropagation(); onCollect(); }}>Topla</button>
          : s.phase !== 'out' && <div className="cel-hint">Dokun: hızlandır</div>}
      </div>
    </div>
  );
}

function LevelUpScene({ s, onTap, onOk }: { s: Extract<Scene, { kind: 'levelUp' }>; onTap: () => void; onOk: () => void }) {
  return (
    <div className={`cel-stage lvl-stage ph-${s.phase}`} onClick={onTap} role="dialog" aria-label={`Seviye ${s.level}`}>
      <div className="lvl-rays" aria-hidden />
      <div className="lvl-badge"><span className="lb-k">SEVİYE</span><span className="lb-n">{s.level}</span><span className="lb-star" aria-hidden><Art name="star" size={30} /></span></div>
      <div className="cel-title big">Seviye {s.level}!</div>
      {s.unlocks.length > 0 && (
        <div className="lvl-list">
          {s.unlocks.map((u, i) => <div key={i} className={`lvl-item${i < s.shown ? ' in' : ''}`}><span aria-hidden><Art name="unlock" size={20} /></span><b><Rich text={u} /></b></div>)}
        </div>
      )}
      <div className="cel-cta">{s.phase !== 'burst' && <button className="btn gold big-cta" onClick={(e) => { e.stopPropagation(); onOk(); }}>Harika!</button>}</div>
    </div>
  );
}

function BiomeScene({ s, cardsRef, onTap, onOk }: { s: Extract<Scene, { kind: 'biome' }>; cardsRef: RefObject<HTMLDivElement | null>; onTap: () => void; onOk: () => void }) {
  const titled = s.phase !== 'rise';
  return (
    <div className={`cel-stage biome-stage ph-${s.phase}`} onClick={onTap} role="dialog" aria-label={`${s.name} yeniden canlandı`}>
      <div className="bm-wave" aria-hidden><i /><i /><i /></div>
      {titled && <div className="bm-name">{s.name}</div>}
      {titled && <div className="bm-sub">yeniden canlandı!</div>}
      <div className={`cel-cards n${Math.min(6, s.reward.length)}`} ref={cardsRef}>
        {s.reward.map((it, i) => <Card key={i} it={it} i={i} show={i < s.shown} />)}
      </div>
      <div className="cel-cta">{(s.phase === 'reward') && <button className="btn gold big-cta" onClick={(e) => { e.stopPropagation(); onOk(); }}>{s.reward.length ? 'Topla' : 'Devam'}</button>}</div>
    </div>
  );
}

