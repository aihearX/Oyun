import type { LevelSpec, RunResult } from '@odi/shared';
import { HUMAN_JOURNEY, TIER_NAMES, achievementById, achievementDesc, cardById, cosmeticById, BIOMES, type RewardItem } from '@odi/content';
import { levelProgress, type RunSummary } from '@odi/meta';
import { audio } from '@odi/audio';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { platform } from '../platform';
import { useStore } from '../store';
import { inviteUrl, type Invite } from '../invite';
import { OdiAvatar } from '../ui/OdiAvatar';
import { RewardChips, prefersReducedMotion } from '../ui/bits';
import { TeamContribution } from '../ui/TeamContribution';
import { ActionButton } from '../ui/Button';
import { celebrate } from '../celebrate';
import { fx } from '../celebrate/fx';
import { useHudCount } from '../celebrate/hud';
import { Art, Glyph, Rich } from '../ui/art';
import { useFeatures } from '../ftue/useFeatures';

interface Props { spec: LevelSpec; result: RunResult; summary: RunSummary; onRetry: () => void; onNext: () => void; onMap: () => void; challenge?: Invite | null; demo?: boolean; runId?: string }

const STAR_AT = 380, STAR_GAP = 380, SCORE_MS = 900;

/** Sayaç: hedefe yumuşakça sayar (azaltılmış harekette anında). */
function useCountUp(from: number, to: number, active: boolean, ms: number, instant: boolean) {
  const [v, setV] = useState(instant ? to : from);
  useEffect(() => {
    if (instant) { setV(to); return; }
    if (!active) return;
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const k = Math.max(0, Math.min(1, (t - t0) / ms)); /* rAF zaman damgası t0dan önce olabilir: negatif ilerleme yok */ const e = 1 - Math.pow(1 - k, 3); setV(Math.round(from + (to - from) * e)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [active, instant, from, to, ms]);
  return v;
}

/** Ödül anı: yıldızlar tek tek uçar, skor sayar, rekor rozeti, XP dolar, jetonlar cüzdana uçar, açılımlar kartla gelir. */
export function ResultScreen({ spec, result, summary, onRetry, onNext, onMap, challenge, demo, runId }: Props) {
  const store = useStore();
  const feat = useFeatures(); const raceOpen = feat.open('race');
  const [toast, setToast] = useState('');
  const reduced = useMemo(prefersReducedMotion, []);
  /** önizleme bayrağı: ?demo=sonuc&kutlama=0 → seviye kutlaması açılmaz (yalnızca ekran görüntüsü için) */
  const demoNoCelebrate = !!demo && new URLSearchParams(location.search).get('kutlama') === '0';
  const S = result.stars; const FINAL = S + 4;
  const title = result.completed ? (S === 3 ? 'Mükemmel!' : S === 2 ? 'Harika!' : 'Geçtin!') : 'Bu sefer olmadı';
  const allUnlocks = buildUnlocks(summary, store.meta.cosmetics.color);
  const [showAll, setShowAll] = useState(false);
  const unlocks = showAll ? allUnlocks : allUnlocks.slice(0, 4); const hidden = allUnlocks.length - unlocks.length;
  const [step, setStep] = useState(reduced ? FINAL : 0);
  const skip = () => setStep(FINAL);
  const done = step >= FINAL;
  const last = spec.number >= HUMAN_JOURNEY.levels.length;

  // zaman çizelgesi
  useEffect(() => {
    if (reduced) return;
    const ts: number[] = [];
    for (let i = 1; i <= S; i++) ts.push(window.setTimeout(() => setStep((s) => Math.max(s, i)), STAR_AT + (i - 1) * STAR_GAP));
    const scoreAt = STAR_AT + S * STAR_GAP + 60;
    ts.push(window.setTimeout(() => setStep((s) => Math.max(s, S + 1)), scoreAt));
    ts.push(window.setTimeout(() => setStep((s) => Math.max(s, S + 2)), scoreAt + SCORE_MS));
    ts.push(window.setTimeout(() => setStep((s) => Math.max(s, S + 3)), scoreAt + SCORE_MS + 900));
    ts.push(window.setTimeout(() => setStep((s) => Math.max(s, S + 4)), scoreAt + SCORE_MS + 1300));
    return () => ts.forEach(clearTimeout);
  }, [reduced, S]);

  // müzik: kazanınca zafer jingle'ı (bölümden devam eder), sonra yumuşakça menü teması
  useEffect(() => { audio.music(result.completed ? 'zafer' : null, { fade: 0.6 }); }, []);
  useEffect(() => { if (!done) return; const h = setTimeout(() => audio.music('menu', { fade: 2 }), reduced ? 300 : 1800); return () => clearTimeout(h); }, [done]);

  // her yıldız: ekranı sallayarak iner + büyüyen çan sesi + titreşim + ışıltı
  const starsRef = useRef<HTMLDivElement>(null); const scoreRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const shake = (px: number) => { try { rootRef.current?.animate([{ transform: 'none' }, { transform: `translate(${-px}px, ${px * 0.6}px)` }, { transform: `translate(${px}px, ${-px * 0.6}px)` }, { transform: `translate(${-px / 2}px, ${px / 3}px)` }, { transform: 'none' }], { duration: 280, easing: 'ease-out' }); } catch { /* yok */ } };
  useEffect(() => {
    if (reduced) return;
    if (step >= 1 && step <= S) {
      audio.play((['star1', 'star2', 'star3'] as const)[step - 1]!); platform().haptic(step === 3 ? 'heavy' : 'medium');
      const t = setTimeout(() => { shake(3 + step * 2); fx.sparkle(starsRef.current?.children[step - 1], 14 + step * 6); if (step === 3) fx.confetti(starsRef.current?.children[1], 60); }, 330);
      return () => clearTimeout(t);
    }
    if (step === S + 2) {
      if (summary.newRecord) { audio.play('newRecord'); platform().haptic('success'); setTimeout(() => fx.confetti(scoreRef.current, 80), 120); }
      if (summary.xpEarned > 0) audio.play('xpFill', { delay: 0.25, vol: 0.8 });
    }
  }, [step]);

  // skor sayarken tık sesi; perde sayaçla birlikte yükselir
  useEffect(() => {
    if (reduced || step !== S + 1 || result.score <= 0) return;
    let i = 0; const n = Math.min(14, Math.max(4, Math.round(result.score / 120)));
    const h = setInterval(() => { audio.play('countTick', { semitones: Math.round((i / n) * 12) }); if (++i >= n) clearInterval(h); }, SCORE_MS / n);
    return () => clearInterval(h);
  }, [step]);

  const score = useCountUp(0, result.score, step >= S + 1, SCORE_MS, reduced);
  // cüzdan: jetonlar uçarken sayaç varışlarla birlikte sayarak artar (sonunda gerçek değer)
  const [coinsFlying, setCoinsFlying] = useState(false);
  const hudCoins = useHudCount('jeton', summary.coinsAfter);
  const coinsShown = reduced || done || coinsFlying ? hudCoins.value : step >= S + 2 && summary.coinsAfter <= summary.coinsBefore ? summary.coinsAfter : summary.coinsBefore;

  // XP çubuğu: seviye atlarsa önce doldur, patlat, sonra yeni seviyede devam et
  const before = levelProgress(summary.xpBefore), after = levelProgress(summary.xpAfter);
  const leveled = after.level > before.level;
  const [xpPhase, setXpPhase] = useState<0 | 1 | 2>(reduced ? 2 : 0);
  useEffect(() => { if (step >= S + 2 && xpPhase === 0) { if (!leveled) setXpPhase(2); else { setXpPhase(1); const h = setTimeout(() => setXpPhase(2), reduced ? 0 : 650); return () => clearTimeout(h); } } }, [step]);
  useEffect(() => { if (done) setXpPhase(2); }, [done]);
  const xpWidth = xpPhase === 0 ? before.pct : xpPhase === 1 ? 1 : (leveled ? after.pct : after.pct);
  const xpLevel = xpPhase === 2 ? after.level : before.level;

  // jetonların cüzdana uçuşu (celebrate.coins: eğrisel yollar, her varışta tık + sayaç zıplar)
  const walletRef = useRef<HTMLDivElement>(null); const coinRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (reduced || step !== S + 2 || summary.coinsAfter <= summary.coinsBefore || coinsFlying) return;
    const a = coinRef.current?.getBoundingClientRect();
    void celebrate.coins({ amount: summary.coinsAfter - summary.coinsBefore, kind: 'jeton', ...(a ? { from: { x: a.left + a.width / 2, y: a.top + a.height / 2 } } : {}) });
    setCoinsFlying(true);
  }, [step]);
  // seviye atladıysa büyük kutlama (XP çubuğu dolup patladıktan sonra); açılan şeyler bu koşuda gerçekten açılanlar
  const leveledShown = useRef(false);
  useEffect(() => {
    if (leveledShown.current || !leveled || xpPhase !== 2 || step < S + 2 || demoNoCelebrate) return;
    leveledShown.current = true;
    levelTimer.current = window.setTimeout(() => void celebrate.levelUp({ level: after.level, unlocks: allUnlocks.slice(0, 4).map((u) => u.title) }), reduced ? 0 : 500);
  }, [xpPhase, step]);
  const levelTimer = useRef(0);
  useEffect(() => () => clearTimeout(levelTimer.current), []);
  // açılım kartları gelirken her biri için ses
  useEffect(() => {
    if (reduced || step !== S + 3) return;
    const ts = unlocks.map((_, i) => setTimeout(() => audio.play('itemReveal', { semitones: Math.min(12, i * 2), vol: 0.8 }), 120 + i * 140));
    return () => ts.forEach(clearTimeout);
  }, [step]);

  const share = async () => {
    const link = inviteUrl({ level: spec.number, score: result.completed ? result.score : 0, stars: result.stars });
    const text = result.completed ? `ODİ: ${spec.number}. bölümü ${'⭐'.repeat(result.stars)} ile ${result.score} puanla geçtim. Kulak kabartır mısın, beni geçebilir misin? ${link}` : `ODİ'de ${spec.number}. bölümde takıldım. Sen geçebilir misin? ${link}`;
    const r = await platform().share(text);
    if (r !== 'cancelled' && !demo) store.recordShare();
    if (r === 'copied') { setToast('Bağlantı kopyalandı'); setTimeout(() => setToast(''), 1500); }
  };


  return (
    <div className={`screen fade-in result-screen${result.completed ? '' : ' lost'}`} ref={rootRef} onClick={() => { if (!done) skip(); }}>
      <div className="result-top">
        <div className="muted ellipsis">{spec.number}. {spec.name}</div>
        <div className={`pill wallet${hudCoins.bump && coinsFlying ? ' hud-pop' : ''}`} ref={walletRef} data-hud="jeton" key={`w${hudCoins.bump}`}><Art name="coin" size={19} className="art-inline" />{coinsShown.toLocaleString('tr-TR')}</div>
      </div>

      <div className="result">
        <h1 className="result-title">{title}</h1>
        <div className={`star-row${result.completed ? '' : ' dim'}`} aria-label={`${S} yıldız`} ref={starsRef}>
          {[0, 1, 2].map((i) => <span key={i} className={`star-slot${i < S && step > i ? ' on' : ''}`} aria-hidden><span className="star-empty"><StarHole /></span><span className="star-full"><Art name="star" size="100%" /></span></span>)}
        </div>
        <div className="score-line" ref={scoreRef}>
          <div className="score">{score.toLocaleString('tr-TR')}</div>
          {summary.newRecord && step >= S + 2 && <div className="badge-record">Yeni rekor!</div>}
          {!summary.newRecord && summary.prevBest > 0 && step >= S + 2 && <div className="muted small-note">Rekorun: {Math.max(summary.prevBest, result.score).toLocaleString('tr-TR')}</div>}
        </div>

        <div className="stats">
          <div className="card" ref={coinRef}><div className="v"><Art name="coin" size={22} className="art-inline" />{result.coins}</div><div className="k">jeton{spec.coinsTotal ? ` / ${spec.coinsTotal}` : ''}</div></div>
          <div className="card"><div className="v"><Art name="timer" size={22} className="art-inline" />{Math.round(result.timeSec)} sn</div><div className="k">par {spec.parTimeSec} sn</div></div>
          <div className="card"><div className="v"><Art name={result.objectiveMet ? 'check' : 'empty'} size={26} /></div><div className="k">{spec.objective.label}</div></div>
        </div>

        <div className={`card xp-card${xpPhase === 1 ? ' burst' : ''}`}>
          <div className="row between"><b>Seviye {xpLevel}</b><span className="muted">+{summary.xpEarned} XP</span></div>
          <div className="bar tone-accent xp"><i style={{ width: `${xpWidth * 100}%`, transition: xpPhase === 2 && leveled && !reduced ? 'none' : undefined }} key={xpPhase === 2 && leveled ? 'n' : 'o'} /></div>
          {leveled && xpPhase >= 1 && <div className="levelup" role="status"><Art name="party" size="1.2em" className="art-inline" /> Seviye {after.level}!</div>}
        </div>

        <div className={`goal-card${result.completed ? '' : ' near'}`} data-show={step >= S + 2 ? 'yes' : 'no'}>
          <span className="gi"><Art name={result.completed ? (summary.goal.kind === 'hazine' ? 'chest' : 'target') : 'ear'} size={30} /></span>
          <span><Rich text={summary.goal.text} /></span>
        </div>

        {runId && step >= S + 3 && <TeamContribution runId={runId} result={result} reduced={reduced} />}

        {challenge && challenge.level === spec.number && challenge.score > 0 && (
          <div className="card" style={{ width: '100%' }}>
            <div className="muted">Meydan okuma</div>
            <h2 className="wrap">{result.completed && result.score > challenge.score ? `Arkadaşını ${(result.score - challenge.score).toLocaleString('tr-TR')} puan geçtin!` : result.completed ? `Arkadaşına ${(challenge.score - result.score).toLocaleString('tr-TR')} puan kaldı` : 'Arkadaşın bu bölümü geçti; bir daha dene'}</h2>
            <div className="muted">Arkadaşın: {challenge.score.toLocaleString('tr-TR')} · Sen: {result.score.toLocaleString('tr-TR')}</div>
          </div>
        )}

        {step >= S + 3 && (summary.quests.length > 0 || allUnlocks.length > 0) && (
          <div className="unlocks">
            {unlocks.map((u, i) => (
              <div className={`unlock-card tone-${u.tone}`} key={i} style={{ animationDelay: `${reduced ? 0 : i * 140}ms` }}>
                <span className="ui"><Glyph e={u.icon} size={32} /></span>
                <span className="ub"><small><Rich text={u.kicker} /></small><b><Rich text={u.title} /></b>{u.text && <span className="muted"><Rich text={u.text} /></span>}{u.chips && <RewardChips items={u.chips} small />}</span>
              </div>
            ))}
            {hidden > 0 && <ActionButton tone="plain" className="more-unlocks" onClick={(e) => { e.stopPropagation(); setShowAll(true); }}>+{hidden} açılım daha göster</ActionButton>}
            {summary.quests.length > 0 && (
              <div className="card quests-mini" style={{ animationDelay: `${reduced ? 0 : unlocks.length * 140}ms` }}>
                <div className="muted">Bugünün görevleri</div>
                {summary.quests.map((q) => (
                  <div className="qm" key={q.id}>
                    <span className="qe"><Glyph e={q.justDone ? '✅' : q.emoji} size={20} /></span>
                    <span className="qt">{q.text}</span>
                    <span className="qn">{q.after}/{q.target}</span>
                    <div className="bar tone-green"><i style={{ width: `${(q.after / q.target) * 100}%` }} /></div>
                  </div>
                ))}
                {summary.quests.some((q) => q.justDone) && <div className="muted small-note">Görev tamam! Ödülün Bugün sekmesinde seni bekliyor.</div>}
              </div>
            )}
          </div>
        )}
        {!result.completed && result.extra?.reason === 'fall' && <div className="muted wrap">İpucu: boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.</div>}

        {!done && <div className="muted skip-hint">Dokun: hızlı geç</div>}
        <div className="result-actions" onClick={(e) => e.stopPropagation()}>
          {result.completed && !last ? (
            <>
              <ActionButton block icon="play" data-act="sonraki" onClick={onNext}>Sonraki</ActionButton>
              <div className="abtn-grid">
                <ActionButton tone="teal" tile icon="retry" data-act="tekrar" onClick={onRetry}>Tekrar</ActionButton>
                {raceOpen ? <ActionButton tone="gold" tile icon="megaphone" data-act="meydan" onClick={share}>Meydan oku</ActionButton> : <ActionButton tone="plain" tile icon="megaphone" data-act="meydan" disabled aria-label={`Meydan oku: ${feat.lock('race')}`}>Meydan oku<small className="act-lock"><Art name="lock" size={12} /> Bölüm {feat.at('race')}</small></ActionButton>}
                <ActionButton tone="plain" tile icon="map" data-act="harita" onClick={onMap}>Harita</ActionButton>
              </div>
            </>
          ) : (
            <>
              <ActionButton block icon="retry" onClick={onRetry}>{result.completed ? 'Tekrar' : 'Tekrar dene'}</ActionButton>
              <div className="abtn-grid">
                {raceOpen ? <ActionButton tone="gold" tile icon="megaphone" data-act="meydan" onClick={share}>Meydan oku</ActionButton> : <ActionButton tone="plain" tile icon="megaphone" data-act="meydan" disabled aria-label={`Meydan oku: ${feat.lock('race')}`}>Meydan oku<small className="act-lock"><Art name="lock" size={12} /> Bölüm {feat.at('race')}</small></ActionButton>}
                <ActionButton tone="plain" tile icon="map" data-act="harita" onClick={onMap}>Harita</ActionButton>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/** boş yıldız yuvası: koyu oyuk (emoji/yazı karakteri yerine) */
function StarHole() { return <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden><path d="M12 2.6l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.65 6.5 19.55l1.05-6.12L3.1 9.1l6.15-.9z" fill="rgba(5,2,20,.5)" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeLinejoin="round" /></svg>; }

interface UnlockView { icon: ReactNode; kicker: string; title: string; text?: string; chips?: RewardItem[]; tone: 'accent' | 'green' | 'gold' | 'coral' | 'silver' | 'bronze' }
function buildUnlocks(s: RunSummary, colorId: string): UnlockView[] {
  const out: UnlockView[] = [];
  if (s.lucky) out.push({ icon: '🍀', kicker: 'Şanslı Nota', title: 'Sürpriz bonus!', chips: s.lucky, tone: 'green' });
  if (s.treasure) out.push({ icon: '🎁', kicker: 'Hazine açıldı', title: `Bölüm ${s.level} hazinesi`, chips: s.treasure, tone: 'gold' });
  for (const a of s.announcements) out.push({ icon: a.kind === 'biyom' ? '🧭' : '🆕', kicker: a.kind === 'biyom' ? 'Kapı aralandı' : 'Yeni hareket', title: a.title, text: a.text, tone: 'accent' });
  const order = { card: 0, cosmetic: 1, albumBadge: 2, achievement: 3 } as const;
  for (const e of [...s.events].sort((a, b) => order[a.kind] - order[b.kind])) {
    if (e.kind === 'card') { const c = cardById(e.id); if (c) out.push({ icon: '🃏', kicker: `Yeni Kulak Kartı · ${BIOMES[c.biome].name}`, title: c.title, text: c.fact, tone: 'green' }); }
    else if (e.kind === 'cosmetic') { const c = cosmeticById(e.id); const col = cosmeticById(colorId)?.color; if (c) out.push({ icon: <OdiAvatar size={40} color={c.kind === 'renk' ? c.color : col} hat={c.hat} />, kicker: 'Dolaba yeni', title: c.name, text: c.desc, tone: 'accent' }); }
    else if (e.kind === 'achievement') { const a = achievementById(e.id); if (a) out.push({ icon: <Glyph e={a.emoji} size={32} />, kicker: `Başarım · ${TIER_NAMES[e.tier]}`, title: a.name, text: achievementDesc(a, e.tier), tone: e.tier === 3 ? 'gold' : e.tier === 2 ? 'silver' : 'bronze' }); }
    else if (e.kind === 'albumBadge') out.push({ icon: '🏅', kicker: 'Albüm rozeti', title: `${BIOMES[e.biome].name} tamamlandı`, tone: 'gold' });
  }
  return out;
}
