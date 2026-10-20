import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Art, rich, type ArtName } from '../ui/art';
import { Icon } from '../ui/icons';
import { useStore } from '../store';
import { speakLine, stopVoice } from './voice';
import { audio } from '@odi/audio';
import { TuyDede, NARRATOR_NAME } from './Narrator';
import './ftue.css';

/**
 * Anlatıcı turu (Coach): Tüy Dede konuşur (yazı + ses), gerekirse ekranı karartıp bir öğeyi parlak bir halkayla
 * gösterir ve oyuncu o öğeye dokunana / bir şey olana kadar bekler. Yeniden kullanılabilir adım dili:
 *   say      — söylenecek cümle (altyazı her zaman, ses ayarı açıksa sesli)
 *   target   — vurgulanacak öğe: CSS seçici ya da (tuval içi bina gibi) ekran dikdörtgeni döndüren işlev
 *   wait     — 'next' (İleri / ekrana dokun), 'tap' (vurgulanan yere dokun), { el } (öğe belirene dek), { until } (koşul)
 *   art/kicker — yeni açılan yer için büyük rozet ("Yeni yer açıldı")
 */
export type Target = string | (() => Element | DOMRect | null);
export interface CoachStep {
  /** satır kimliği (script.ts): kayıtlı ses dosyası bununla bulunur */
  id?: string;
  say: string;
  target?: Target;
  wait?: 'next' | 'tap' | { el: string } | { until: () => boolean };
  art?: ArtName; kicker?: string;
  mood?: 'happy' | 'wow' | 'wink';
  /** dokunulacak yer için kısa yönerge (varsayılan: "Parlayan yere dokun") */
  hint?: string;
  /** adım açılınca bir kez çalışır (ör. kamp kamerasını binaya çevir) */
  enter?: () => void;
  /** hedef 1,5 sn içinde bulunmazsa adım atlanır (ör. ödül zaten alınmışsa) */
  optional?: boolean;
}
export interface Tour { id: string; steps: CoachStep[]; onDone?: (skipped: boolean) => void }

interface CoachState { tour: Tour | null; step: number; start(t: Tour): void; next(): void; end(skipped: boolean): void }
export const useCoach = create<CoachState>((set, get) => ({
  tour: null, step: 0,
  start(t) { if (get().tour) return; set({ tour: t, step: 0 }); },
  next() { const { tour, step } = get(); if (!tour) return; if (step + 1 >= tour.steps.length) get().end(false); else set({ step: step + 1 }); },
  end(skipped) { const t = get().tour; set({ tour: null, step: 0 }); stopVoice(); if (t) { useStore.getState().ftueTourDone(t.id); t.onDone?.(skipped); } },
}));

/** sesli okuma: kayıtlı ses (varsa) ya da cihaz sesi; genel ses ve "Anlatıcı sesi" açıksa (bkz. voice.ts) */
export function sayAloud(text: string, id?: string) { speakLine(text, id); }
export { stopVoice };

function resolve(t: Target | undefined): DOMRect | null {
  if (!t) return null;
  try {
    const v = typeof t === 'string' ? document.querySelector(t) : t();
    if (!v) return null;
    const r = v instanceof DOMRect ? v : (v as Element).getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    return r;
  } catch { return null; }
}
const targetEl = (t: Target | undefined): Element | null => { if (typeof t !== 'string') return null; try { return document.querySelector(t); } catch { return null; } };
/** CSS güvenli alan değişkeninin piksel değeri (--sat/--sab; max()/env() çözülmüş) */
export function insetPx(v: '--sat' | '--sab'): number {
  try {
    const d = document.createElement('div'); d.style.cssText = `position:absolute;visibility:hidden;padding-top:var(${v})`;
    document.body.appendChild(d); const n = parseFloat(getComputedStyle(d).paddingTop) || 0; d.remove(); return n;
  } catch { return 0; }
}
/** kısa ekran: anlatıcı kompakt çizilir (portre panelin içinde, yazı biraz küçük) */
export const shortScreen = () => typeof innerHeight === 'number' && innerHeight < 720;

/** hedef ekranın görünür bandında değilse (üst çubuk / alt sekme çubuğu arkasında ya da dışarıda) kaydırılabilir atasını kaydır */
function bringIntoView(t: Target | undefined) {
  let el: Element | null = targetEl(t);
  if (!el && typeof t === 'function') { try { const v = t(); if (v instanceof Element) el = v; } catch { /* yok */ } }
  if (!el) return;
  const r = el.getBoundingClientRect(); const H = innerHeight;
  const top = 64, bottom = H - 96; // üst çubuk ve sekme çubuğu payı
  if (r.top >= top && r.bottom <= bottom) return;
  // sabit konumlu katmanların (alt sayfa, kutlama, sekme çubuğu) içindekiler kaydırılmaz
  for (let q: Element | null = el; q; q = q.parentElement) { if (q.id === 'root') break; if (getComputedStyle(q).position === 'fixed') return; }
  let sc: Element | null = el.parentElement;
  while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
  if (!sc) return;
  // hedefin üstünü üstteki anlatıcı panelinin hemen altına getir (panel üste yerleşir; uzun hedefin alt ucu kırpılır, başı görünür)
  const ph = (document.querySelector('.coach-panel') as HTMLElement | null)?.offsetHeight ?? 190;
  const want = Math.min(H * 0.5, insetPx('--sat') + 12 + ph + 18);
  sc.scrollBy({ top: r.top - want, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/** daktilo: metni harf harf açar (azaltılmış harekette anında) */
export function useTypewriter(text: string, key: unknown) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) { setN(text.length); return; }
    setN(0); let i = 0;
    const h = setInterval(() => { i += 2; setN(Math.min(text.length, i)); if (i >= text.length) clearInterval(h); }, 28);
    return () => clearInterval(h);
  }, [key, text]);
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setN(text.length) };
}

/** anlatıcı konuşma paneli: koyu cam, portre, daktilo yazı, İleri, Atla, ilerleme noktaları */
export function SpeechPanel({ text, typed, typing, place = 'bottom', index, total, onNext, onSkip, waiting, hint, mood, extra, compact, tuck, panelRef }: {
  text: string; typed: string; typing: boolean; place?: 'top' | 'bottom' | 'center'; index: number; total: number;
  onNext?: () => void; onSkip?: () => void; waiting?: boolean; hint?: string; mood?: 'happy' | 'wow' | 'wink'; extra?: ReactNode;
  /** kısa ekran: küçük portre panelin içinde */ compact?: boolean;
  /** portre panelden taşmasın (hemen üstte vurgulanan hedef var) */ tuck?: boolean;
  panelRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={panelRef} className={`coach-panel ${place}${compact ? ' compact' : ''}${tuck ? ' tuck' : ''}`} role="dialog" aria-label={`${NARRATOR_NAME} anlatıyor`} data-testid="anlatici" data-say={text} onClick={(e) => e.stopPropagation()}>
      <div className="cp-portrait"><TuyDede size={84} talking={typing} mood={mood} /></div>
      <div className="cp-body">
        <div className="cp-name">{NARRATOR_NAME}</div>
        {extra}
        <p className="cp-text" aria-live="polite"><span className="cp-typed">{rich(typed)}</span><span className="cp-ghost" aria-hidden>{text.slice(typed.length)}</span></p>
        <div className="cp-foot">
          {total > 1 && <span className="cp-dots" aria-label={`${index + 1}/${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i === index ? 'on' : i < index ? 'past' : ''} />)}</span>}
          <span className="grow" />
          {onSkip && <button type="button" className="cp-skip" onClick={onSkip}>Atla</button>}
          {waiting
            ? <span className="cp-hint" data-testid="anlatici-ipucu"><i aria-hidden /> {hint ?? 'Parlayan yere dokun'}</span>
            : onNext && <button type="button" className="abtn primary cp-next" data-testid="anlatici-ileri" onClick={onNext}><span className="lbl">{typing ? 'Devam' : 'İleri'}</span><Icon name="chevron" size={20} /></button>}
        </div>
      </div>
    </div>
  );
}

/** kökte bir kez: etkin tur varsa çizer */
export function CoachHost() {
  const tour = useCoach((s) => s.tour); const step = useCoach((s) => s.step);
  if (!tour) return null;
  // gövdeye taşınır: #root sabit konumlu (kendi yığın bağlamı) ve alt sayfalar (bina paneli) gövdeye taşındığı için üstte kalmalı
  const v = <CoachView key={`${tour.id}:${step}`} tour={tour} index={step} />;
  return typeof document !== 'undefined' ? createPortal(v, document.body) : v;
}

function CoachView({ tour, index }: { tour: Tour; index: number }) {
  const st = tour.steps[index]!;
  const wait = st.wait ?? 'next';
  const tw = useTypewriter(st.say, `${tour.id}:${index}`);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [nudge, setNudge] = useState(0);
  const next = useCoach((s) => s.next); const end = useCoach((s) => s.end);
  const advanced = useRef(false);
  const go = () => { if (advanced.current) return; advanced.current = true; stopVoice(); audio.play('tap'); next(); };

  // ses: adım açılınca okunur, kapanınca susar
  useEffect(() => { try { st.enter?.(); } catch { /* yok */ } sayAloud(st.say, st.id); return () => stopVoice(); }, [tour.id, index]);
  // hedef görünmüyorsa görünür banda kaydır (küçük ekranlar)
  useEffect(() => { const h = setTimeout(() => bringIntoView(st.target), 120); return () => clearTimeout(h); }, [tour.id, index]);
  // hedefin konumu: her karede izlenir (kaydırma, animasyon, sahne kamerası)
  useLayoutEffect(() => {
    let raf = 0; let last = '';
    const loop = () => {
      const r = resolve(st.target); const k = r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : '';
      if (k !== last) { last = k; setRect(r); }
      raf = requestAnimationFrame(loop);
    };
    loop(); return () => cancelAnimationFrame(raf);
  }, [tour.id, index]);
  // isteğe bağlı adım: hedef yoksa geç
  useEffect(() => {
    if (!st.optional) return;
    const h = setTimeout(() => { if (!resolve(st.target)) go(); }, 1500);
    return () => clearTimeout(h);
  }, [tour.id, index]);
  // bekleme: öğe belirdi / koşul sağlandı
  useEffect(() => {
    if (typeof wait !== 'object') return;
    const h = setInterval(() => {
      const ok = 'el' in wait ? !!document.querySelector(wait.el) : wait.until();
      if (ok) { clearInterval(h); setTimeout(go, 250); }
    }, 200);
    return () => clearInterval(h);
  }, [tour.id, index]);
  // "dokun": vurgulanan yere dokunulunca (dokunuş alttaki öğeye geçer, sonra ilerlenir)
  useEffect(() => {
    if (wait !== 'tap') return;
    const on = (e: MouseEvent) => {
      const el = targetEl(st.target); const t = e.target as Node | null;
      const r = resolve(st.target);
      const inside = (el && t && el.contains(t)) || (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
      if (inside) setTimeout(go, 60);
    };
    document.addEventListener('click', on, true);
    return () => document.removeEventListener('click', on, true);
  }, [tour.id, index]);

  const passThrough = wait !== 'next' && !!rect; // delikten dokunuş alttaki öğeye geçer
  const pad = 8;
  const hole = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  const W = typeof innerWidth === 'number' ? innerWidth : 390, H = typeof innerHeight === 'number' ? innerHeight : 844;
  const [insetSab] = useState(() => insetPx('--sab'));
  // yerleşim: hedefin üstünde/altında hangi tarafta daha çok boş yer varsa panel oraya
  const place: 'top' | 'bottom' | 'center' = st.art && !hole ? 'center' : hole && hole.y > H - (hole.y + hole.h) ? 'top' : 'bottom';
  const compact = shortScreen();
  // alttaki panelin taşan portresi hedefin üstüne binecekse portre panelin içine alınır
  const panelRef = useRef<HTMLDivElement>(null);
  const [ph, setPh] = useState(0);
  useLayoutEffect(() => { const h = panelRef.current?.offsetHeight ?? 0; if (h && h !== ph) setPh(h); });
  const tuck = !compact && place === 'bottom' && !!hole && hole.y + hole.h > H - insetSab - 14 - (ph || 190) - 52;
  const onBack = () => { if (!tw.done) { tw.finish(); return; } if (wait === 'next') go(); else setNudge((n) => n + 1); };

  return (
    <div className={`coach${hole ? ' has-hole' : ''}`} data-testid="anlatici-tur" data-tour={tour.id} data-step={index}>
      <svg className="coach-dim" width={W} height={H} aria-hidden>
        <defs><mask id="coach-mask"><rect width={W} height={H} fill="#fff" />{hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="18" fill="#000" />}</mask></defs>
        <rect width={W} height={H} fill="rgba(8,4,26,.74)" mask="url(#coach-mask)" />
      </svg>
      {passThrough && hole ? <>
        <div className="coach-block" style={{ left: 0, top: 0, width: W, height: Math.max(0, hole.y) }} onClick={onBack} />
        <div className="coach-block" style={{ left: 0, top: hole.y + hole.h, width: W, height: Math.max(0, H - hole.y - hole.h) }} onClick={onBack} />
        <div className="coach-block" style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} onClick={onBack} />
        <div className="coach-block" style={{ left: hole.x + hole.w, top: hole.y, width: Math.max(0, W - hole.x - hole.w), height: hole.h }} onClick={onBack} />
      </> : <div className="coach-block" style={{ inset: 0 }} onClick={onBack} />}
      {hole && <div className="coach-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
      {hole && wait !== 'next' && <PointHand key={nudge} hole={hole} H={H} />}
      {st.art && <div className={`coach-unlock${hole ? ' small' : ''}`}><span className="cu-burst" /><Art name={st.art} size={hole ? 54 : 96} />{st.kicker && <b>{st.kicker}</b>}</div>}
      <SpeechPanel text={st.say} typed={tw.shown} typing={!tw.done} place={place} index={index} total={tour.steps.length} mood={st.mood} compact={compact} tuck={tuck} panelRef={panelRef}
        waiting={wait !== 'next' && tw.done} hint={st.hint} onNext={() => { if (!tw.done) tw.finish(); else go(); }} onSkip={() => end(true)} />
    </div>
  );
}

/** "Şuraya dokun" eli: hedefin altından (ya da üstünden) yukarı/aşağı doğru dürter */
function PointHand({ hole, H }: { hole: { x: number; y: number; w: number; h: number }; H: number }) {
  const below = hole.y + hole.h + 70 < H - 20;
  const x = hole.x + hole.w / 2 - 22; const y = below ? hole.y + hole.h - 6 : hole.y - 58;
  return (
    <div className={`coach-hand${below ? '' : ' up'}`} style={{ left: x, top: y }} aria-hidden>
      <svg width="44" height="58" viewBox="0 0 44 58">
        <path d="M18 4c2.6 0 4.4 2 4.4 4.6V24l2.2-1.2c2.4-1.2 5.2-.4 6.4 2l.8 1.6 1.4-.4c2.6-.6 5 1 5.6 3.6l1.6 9.4c1 6.2-1.4 11.8-6.8 15H17.6c-3.4-2.6-6-6.4-7.6-10.6L6.4 33c-.8-2.4.4-5 2.8-5.8 2-.6 4 .2 5 2l.8 1.4V8.6C15 6 15.6 4 18 4z" fill="#fff6e5" stroke="#a35a00" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M22.4 24v8M30 26v6M36.6 29.4V34" stroke="#d6b98a" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17.6 54h17.4" stroke="#ffc93c" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
