/**
 * Kutlama katmanı: sandık, jeton uçuşu, seviye atlama, biyom canlandı, şerit.
 * Kuyruklu (aynı anda tek kutlama), dokununca hızlanır, prefers-reduced-motion'da kısa ve parçacıksız.
 * Pencereler kendiliğinden kapanmaz: oyuncu düğmeye (ya da seviye penceresinde sahneye) dokununca kapanır (WCAG 2.2.1, OT-buyuk-yazi-19).
 * Dürüstlük: gösterilen içerik = verilen içerik (çağıranın verdiği öğeler aynen gösterilir); gizli olasılık yok.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { audio } from '@odi/audio';
import { BIOMES, cardById, cosmeticById } from '@odi/content';
import type { BiomeId } from '@odi/shared';
import { celebrate as celebrateRef, registerCelebrations, useCelebrating, type RecapRow, type RewardItem, type ScreenPoint } from './index';
import { Particles } from './particles';
import { hud, type HudKind } from './hud';
import { setFxEngine } from './fx';
import { platform } from '../platform';
import { useStore } from '../store';
import { Toasts } from '../ui/Toasts';
import { CosmeticThumb, prefersReducedMotion, RewardChips } from '../ui/bits';
import { Art, Glyph, Rich } from '../ui/art';
import './celebrate.css';

type Tier = 'bronz' | 'gumus' | 'altin';
type Scene =
  | { kind: 'chest'; title: string; items: RewardItem[]; tier: Tier; phase: 'drop' | 'shake' | 'open' | 'reveal' | 'collect' | 'out'; shake: number; shown: number; granted: boolean; note?: string }
  | { kind: 'levelUp'; level: number; unlocks: string[]; phase: 'burst' | 'list' | 'out'; shown: number; title?: string; kicker?: string }
  | { kind: 'biome'; biome: string; name: string; reward: RewardItem[]; phase: 'rise' | 'title' | 'reward' | 'out'; shown: number }
  | { kind: 'recap'; title: string; sub?: string; note?: string; rows: RecapRow[]; phase: 'list' | 'out'; shown: number; all?: boolean };

/** interactive: tam ekran sahne (sandık, seviye, biyom); kapanınca alttaki ekran kısa bir süre dokunuş almaz */
interface Job { run: () => Promise<void>; done: () => void; interactive: boolean }
/** sahne kapandıktan sonra alttaki ekranın dokunuş almadığı süre (ms) */
const SHIELD_MS = 400;

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
  // sahne kapanırken pencerenin düğmesine giden dokunuş alttaki ekrana (ör. "Takıma gönder") geçmesin (OT-ekonomi-denetci-14)
  const [shield, setShield] = useState(false); const shieldT = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null); const flyRef = useRef<HTMLDivElement>(null); const chestRef = useRef<HTMLDivElement>(null); const cardsRef = useRef<HTMLDivElement>(null);
  const fx = useRef<Particles | null>(null);
  const queue = useRef<Job[]>([]); const busy = useRef(false);
  const skipFn = useRef<(() => void) | null>(null); const waitBtn = useRef<(() => void) | null>(null); const early = useRef(false);
  const reduced = useRef(prefersReducedMotion());

  // ---------------------------------------------------------------- yardımcılar
  /** bekle; dokunuş bekleyişi kısaltır (hızlandırma). Azaltılmış harekette çok kısa. */
  const wait = (ms: number) => new Promise<void>((res) => {
    if (early.current) { res(); return; }
    const d = reduced.current ? Math.min(ms, 120) : ms;
    const h = setTimeout(() => { skipFn.current = null; res(); }, d);
    skipFn.current = () => { clearTimeout(h); skipFn.current = null; res(); };
  });
  /** düğmeye basılmasını bekle. Süre sınırı yok: yavaş okuyan oyuncu açılanları okumadan pencere kapanmasın (OT-buyuk-yazi-19) */
  const waitTap = () => new Promise<void>((res) => {
    if (early.current) { early.current = false; res(); return; }
    waitBtn.current = () => { waitBtn.current = null; res(); };
  });
  /** pencerenin düğmesi: açılanlar sıralanırken basılırsa sıralama kısalır ve pencere beklemeden kapanır */
  const ok = () => { if (waitBtn.current) { waitBtn.current(); return; } early.current = true; skipFn.current?.(); };
  const enqueue = (run: () => Promise<void>, interactive = true) => new Promise<void>((done) => { queue.current.push({ run, done, interactive }); void pump(); });
  const pump = async () => {
    if (busy.current) return; busy.current = true;
    while (queue.current.length) {
      const j = queue.current.shift()!; early.current = false;
      try { await j.run(); } catch { /* kutlama hatası oyunu durdurmasın */ }
      setScene(null); j.done();
      if (j.interactive) { setShield(true); clearTimeout(shieldT.current); shieldT.current = window.setTimeout(() => setShield(false), SHIELD_MS); }
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
  const runChest = async (o: { title: string; items: RewardItem[]; tier?: Tier; granted?: boolean; note?: string }) => {
    const items = o.items; const tier = o.tier ?? 'bronz'; const granted = !!o.granted;
    // granted: içerik cüzdana zaten girdi ve sayaç onu saydı (sonuç ekranı): sayaç yeniden saymaz, jeton uçmaz (OT-sinav-adayi-17)
    if (!granted) for (const it of items) { const k = currency(it); if (k) hud.hold(k, it.amount); }
    const base = { kind: 'chest' as const, title: o.title, items, tier, shake: 0, shown: 0, granted, ...(o.note ? { note: o.note } : {}) };
    audio.duck('kutlama', 6, 0.35);
    setScene({ ...base, phase: 'drop' }); audio.play('whoosh', { vol: 0.8 }); await wait(700);
    for (let i = 0; i < 3; i++) { setScene({ ...base, phase: 'shake', shake: i + 1 }); audio.play('chestShake', { semitones: i * 2 }); platform().haptic(i === 2 ? 'heavy' : 'medium'); await wait(560); }
    setScene({ ...base, phase: 'open', shake: 3 }); audio.play('chestOpen'); platform().haptic('success');
    const c = center(chestRef.current) ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    P()?.confetti(c.x, c.y, 110, 1.1); P()?.ring(c.x, c.y, '#fff6e5', 30); P()?.sparkle(c.x, c.y, 24, 90);
    await wait(650);
    for (let k = 1; k <= items.length; k++) { setScene({ ...base, phase: 'reveal', shake: 3, shown: k }); audio.play('itemReveal', { semitones: Math.min(12, (k - 1) * 2) }); platform().haptic('light'); await wait(420); }
    setScene({ ...base, phase: 'collect', shake: 3, shown: items.length });
    await waitTap();
    // topla: para birimleri sayaca uçar, diğerleri yukarı süzülür
    const cards = Array.from(cardsRef.current?.querySelectorAll<HTMLElement>('.cel-card') ?? []);
    setScene({ ...base, phase: 'out', shake: 3, shown: items.length });
    audio.play('whoosh', { vol: 0.6 });
    if (!granted) await Promise.all(items.map(async (it, i) => { const k = currency(it); if (k) await flyCoins(it.amount, k, center(cards[i]), true); }));
    await sleep(reduced.current ? 0 : granted ? 300 : 150);
  };

  const runLevelUp = async (o: { level: number; unlocks?: string[]; title?: string; kicker?: string }) => {
    const unlocks = o.unlocks ?? [];
    // başlık ve rozet yazısı (ör. "Kamp Seviyesi 5!") her evrede korunur; yalnız ilk evrede değil (OT-ekonomi-denetci-27)
    const base = { kind: 'levelUp' as const, level: o.level, unlocks, title: o.title, kicker: o.kicker };
    audio.duck('kutlama', 3, 0.3);
    setScene({ ...base, phase: 'burst', shown: 0 });
    audio.play('levelUp'); platform().haptic('success');
    const cx = window.innerWidth / 2, cy = window.innerHeight * 0.38;
    P()?.ring(cx, cy, '#ffc93c', 40); P()?.confetti(cx, cy, 120, 1.2); setTimeout(() => P()?.rain(60), 300);
    await wait(1100);
    for (let k = 1; k <= unlocks.length; k++) { setScene({ ...base, phase: 'list', shown: k }); audio.play('unlock', { semitones: (k - 1) * 2, vol: 0.8 }); await wait(380); }
    setScene({ ...base, phase: 'list', shown: unlocks.length });
    await waitTap();
    setScene({ ...base, phase: 'out', shown: unlocks.length }); await sleep(reduced.current ? 0 : 220);
  };

  const runBiome = async (o: { biome: string; name: string; reward?: RewardItem[] }) => {
    const reward = o.reward ?? [];
    for (const it of reward) { const k = currency(it); if (k) hud.hold(k, it.amount); }
    const base = { kind: 'biome' as const, biome: o.biome, name: o.name, reward, shown: 0 };
    audio.duck('kutlama', 5, 0.3);
    setScene({ ...base, phase: 'rise' }); audio.play('biomeAwaken'); platform().haptic('medium');
    const cx = window.innerWidth / 2;
    await wait(900);
    setScene({ ...base, phase: 'title' }); P()?.notes(cx, window.innerHeight * 0.55, 18); P()?.confetti(cx, window.innerHeight * 0.35, 80, 1); platform().haptic('success');
    await wait(1200);
    for (let k = 1; k <= reward.length; k++) { setScene({ ...base, phase: 'reward', shown: k }); audio.play('itemReveal', { semitones: (k - 1) * 2 }); await wait(400); }
    setScene({ ...base, phase: 'reward', shown: reward.length });
    await waitTap();
    const cards = Array.from(cardsRef.current?.querySelectorAll<HTMLElement>('.cel-card') ?? []);
    setScene({ ...base, phase: 'out', shown: reward.length });
    await Promise.all(reward.map(async (it, i) => { const k = currency(it); if (k) await flyCoins(it.amount, k, center(cards[i]), true); }));
  };

  /** birikmiş kutlamalar tek pencerede (haritaya dönüş: hazineler, canlanan bölgeler; her biri satır) */
  const runRecap = async (o: { title: string; sub?: string; note?: string; rows: RecapRow[] }) => {
    const base = { kind: 'recap' as const, title: o.title, sub: o.sub, note: o.note, rows: o.rows };
    audio.duck('kutlama', 3, 0.3);
    setScene({ ...base, phase: 'list', shown: 0 }); audio.play('biomeAwaken'); platform().haptic('success');
    const cx = window.innerWidth / 2; P()?.confetti(cx, window.innerHeight * 0.3, 90, 1);
    await wait(500);
    for (let k = 1; k <= o.rows.length; k++) { setScene({ ...base, phase: 'list', shown: k }); audio.play('unlock', { semitones: (k - 1) * 2, vol: 0.8 }); await wait(380); }
    setScene({ ...base, phase: 'list', shown: o.rows.length });
    // giriş animasyonu bitti: bütün satırlar animasyondan bağımsız görünür (üst satırdaki sayı = görünen satır; OT-sinav-adayi-23)
    await wait(500); setScene({ ...base, phase: 'list', shown: o.rows.length, all: true });
    await waitTap();
    setScene({ ...base, phase: 'out', shown: o.rows.length, all: true }); await sleep(reduced.current ? 0 : 220);
  };

  useEffect(() => {
    if (canvasRef.current) { fx.current = new Particles(canvasRef.current); setFxEngine(fx.current); }
    const onResize = () => fx.current?.resize(); addEventListener('resize', onResize);
    registerCelebrations({
      chest: (o) => enqueue(() => runChest(o)),
      coins: (o) => enqueue(() => flyCoins(o.amount, o.kind ?? 'jeton', o.from ?? null, false), false),
      levelUp: (o) => enqueue(() => runLevelUp(o)),
      biomeRestored: (o) => enqueue(() => runBiome(o)),
      recap: (o) => enqueue(() => runRecap(o)),
      banner: (o) => { const tone = o.tone === 'coral' ? 'coral' : o.tone === 'green' ? 'green' : o.tone === 'gold' ? 'gold' : 'accent'; useStore.setState((s) => ({ toasts: [...s.toasts, { id: Date.now() + Math.random(), icon: o.icon, title: o.title, text: o.body, tone }] })); },
    });
    // test/önizleme için (yalnızca ?demo / ?kutlama varken)
    if (/[?&](demo|kutlama)=/.test(location.search)) (window as unknown as { __celebrate?: unknown }).__celebrate = { ...celebrateRef };
    return () => { clearTimeout(shieldT.current); removeEventListener('resize', onResize); fx.current?.destroy(); setFxEngine(null); registerCelebrations({ async chest() {}, async coins() {}, async levelUp() {}, async biomeRestored() {}, async recap() {}, banner() {} }); };
  }, []);

  // anlatıcı turu kutlama süresince duraklar (ftue/Coach.tsx); kuyruktaki art arda kutlamalar arasında boşluk yok (aynı karede değişir)
  const on = scene !== null;
  useLayoutEffect(() => { useCelebrating.setState({ on }); }, [on]);
  useEffect(() => () => useCelebrating.setState({ on: false }), []);

  const tapStage = () => { if (skipFn.current) skipFn.current(); else if (scene?.kind === 'levelUp' && waitBtn.current) waitBtn.current(); };

  return (
    <>
      {toasts && <Toasts />}
      {/* biyom sahnesinde parçacıklar (notalar, konfeti) yazının arkasında kalır (OT-sessiz-oyuncu-11) */}
      <div className={`cel-root${scene ? ' on' : ''}${scene?.kind === 'biome' ? ' fx-back' : ''}`} aria-live="polite">
        {scene && <div className={`cel-back${scene.phase === 'out' ? ' out' : ''}${scene.kind === 'biome' ? ' biome' : ''}`} style={scene.kind === 'biome' ? biomeVars(scene.biome) : undefined} onClick={tapStage} />}
        {scene?.kind === 'chest' && <ChestScene s={scene} chestRef={chestRef} cardsRef={cardsRef} onTap={tapStage} onCollect={ok} />}
        {scene?.kind === 'levelUp' && <LevelUpScene s={scene} onTap={tapStage} onOk={ok} />}
        {scene?.kind === 'biome' && <BiomeScene s={scene} cardsRef={cardsRef} onTap={tapStage} onOk={ok} />}
        {scene?.kind === 'recap' && <RecapScene s={scene} onTap={tapStage} onOk={ok} />}
        {shield && !scene && <div className="cel-shield" data-testid="kutlama-kalkan" aria-hidden />}
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
      <div className="cc-icon" aria-hidden>{it.kind === 'kozmetik' && cosmeticById(it.ref ?? '') ? <CosmeticThumb id={it.ref} size={56} /> : <Glyph e={v.icon} size={46} />}</div>
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
      {s.granted && (s.phase === 'collect' || s.phase === 'out') && <div className="cel-note">{s.note ?? 'Cüzdanına eklendi'}</div>}
      <div className="cel-cta">
        {s.phase === 'collect' ? <button className="btn gold big-cta" onClick={(e) => { e.stopPropagation(); onCollect(); }}>{s.granted ? 'Tamam' : 'Topla'}</button>
          : s.phase !== 'out' && <div className="cel-hint">Dokun: hızlandır</div>}
      </div>
    </div>
  );
}

function LevelUpScene({ s, onTap, onOk }: { s: Extract<Scene, { kind: 'levelUp' }>; onTap: () => void; onOk: () => void }) {
  return (
    <div className={`cel-stage lvl-stage ph-${s.phase}`} onClick={onTap} role="dialog" aria-label={s.title ?? `Seviye ${s.level}`}>
      <div className="lvl-rays" aria-hidden />
      <div className="lvl-badge"><span className="lb-k">{s.kicker ?? 'SEVİYE'}</span><span className="lb-n">{s.level}</span><span className="lb-star" aria-hidden><Art name="star" size={30} /></span></div>
      <div className="cel-title big">{s.title ?? `Seviye ${s.level}!`}</div>
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
      {titled && <div className="bm-sub"><span>yeniden canlandı!</span></div>}
      <div className={`cel-cards n${Math.min(6, s.reward.length)}`} ref={cardsRef}>
        {s.reward.map((it, i) => <Card key={i} it={it} i={i} show={i < s.shown} />)}
      </div>
      <div className="cel-cta">{(s.phase === 'reward') && <button className="btn gold big-cta" onClick={(e) => { e.stopPropagation(); onOk(); }}>{s.reward.length ? 'Topla' : 'Devam'}</button>}</div>
    </div>
  );
}


function RecapScene({ s, onTap, onOk }: { s: Extract<Scene, { kind: 'recap' }>; onTap: () => void; onOk: () => void }) {
  return (
    <div className={`cel-stage recap-stage ph-${s.phase}${s.all ? ' all' : ''}`} onClick={onTap} role="dialog" aria-label={s.sub ? `${s.title}: ${s.sub}` : s.title}>
      <div className="cel-title">{s.title}</div>
      {s.sub && <div className="rc-sub">{s.sub}</div>}
      <div className="lvl-list">
        {s.rows.map((r, i) => (
          <div key={i} className={`lvl-item${i < s.shown ? ' in' : ''}`}>
            <span aria-hidden><Glyph e={r.icon} size={24} /></span>
            <span className="min0"><b><Rich text={r.text} /></b>{r.items && r.items.length > 0 && <RewardChips items={r.items} small />}</span>
          </div>
        ))}
      </div>
      {s.note && <div className="cel-note">{s.note}</div>}
      <div className="cel-cta"><button className="btn gold big-cta" onClick={(e) => { e.stopPropagation(); onOk(); }}>Tamam</button></div>
    </div>
  );
}
