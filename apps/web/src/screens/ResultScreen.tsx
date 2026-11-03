import type { LevelSpec, MechanicId, RunResult } from '@odi/shared';
import { HUMAN_JOURNEY, MECHANICS, TIER_NAMES, achievementById, achievementDesc, achievementName, cardById, cosmeticById, modifierNames, BIOMES, type RewardItem } from '@odi/content';
import { RAHAT_TEXT, damageNote, earnLines, levelProgress, lossView, runTimeSec, star2View, star3View, sureYazi, type RunSummary } from '@odi/meta';
import { audio } from '@odi/audio';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { platform } from '../platform';
import { useStore } from '../store';
import { inviteUrl, type Invite } from '../invite';
import { useSocial } from '../net';
import { OdiAvatar } from '../ui/OdiAvatar';
import { RewardChips, prefersReducedMotion } from '../ui/bits';
import { TeamContribution } from '../ui/TeamContribution';
import { ActionButton } from '../ui/Button';
import { Toasts } from '../ui/Toasts';
import { celebrate } from '../celebrate';
import { fx } from '../celebrate/fx';
import { useHudCount } from '../celebrate/hud';
import { Art, Glyph, Rich } from '../ui/art';
import { NoteCard, useNote } from '../ftue/Notes';
import { biliyorMuydun } from '@odi/content/biliyor-muydun';
import { useCoach } from '../ftue/Coach';
import { useFeatures } from '../ftue/useFeatures';
import { mapIntroView, type MapReveal } from '../ftue/map-intro';
import { TuyDede } from '../ftue/Narrator';
import { ResultComm } from '../comm/ResultComm';
import { odiLook } from '../look';

interface Props {
  spec: LevelSpec; result: RunResult; summary: RunSummary; onRetry: () => void; onNext: () => void; onMap: () => void; challenge?: Invite | null; demo?: boolean; runId?: string;
  /** haritaya gelinince kendiliğinden başlayacak anlatıcı turları (ftue/map-intro.ts mapIntroQueue): doluysa "Sonraki" yerine "Haritaya dön" */
  mapIntro?: readonly string[];
  /** haritanın dönüş sahnesinde bekleyen bölge canlanması, çiçeklenmesi / hazine (ftue/map-intro.ts mapRevealPending): doluysa da "Haritaya dön" (YN-114, YN-136) */
  reveal?: MapReveal | null;
  /** bu denemenin kolaylaştırma satırı ve kayıpta sonraki denemenin (level-gen easeLine / easeNextLine; YN-113) */
  ease?: string; easeNext?: string;
  /**
   * Rahat deneme (sahip kararı 42, YN-110): kayıpta teklif açık mı (canavar bölümü, aynı bölümde 3 kayıp; meta rahatOffer) ve
   * oyuncu seçerse sonraki denemeyi Rahat başlatan geri çağrı. "Tekrar dene" her zaman normal denemedir.
   */
  rahatOffer?: boolean; onRahat?: () => void;
}

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
export function ResultScreen({ spec, result, summary, onRetry, onNext, onMap, challenge, demo, runId, mapIntro, reveal, ease, easeNext, rahatOffer, onRahat }: Props) {
  const store = useStore();
  const feat = useFeatures(); const raceOpen = feat.open('race');
  // Tüy Dede'nin Notu: ara sıra (ilk bölümde anlatıcı turu var; sıklık sınırı pickNote'ta), tamamlanınca altta
  const note = useNote(spec.biome, 'result', !demo && result.completed && spec.number >= 2 && !useCoach.getState().tour && Math.random() < (store.knowledge === 'odyoloji' ? 0.8 : 0.45), spec.number + result.score);
  const [toast, setToast] = useState('');
  const reduced = useMemo(prefersReducedMotion, []);
  /** önizleme bayrağı: ?demo=sonuc&kutlama=0 → seviye kutlaması açılmaz (yalnızca ekran görüntüsü için) */
  const demoNoCelebrate = !!demo && new URLSearchParams(location.search).get('kutlama') === '0';
  const S = result.stars; const FINAL = S + 4;
  const title = result.completed ? (S === 3 ? 'Mükemmel!' : S === 2 ? 'Harika!' : 'Geçtin!') : 'Bu sefer olmadı';
  const odiColor = odiLook(store).color;
  const allUnlocks = buildUnlocks(summary, odiColor);
  const [showAll, setShowAll] = useState(false);
  const unlocks = showAll ? allUnlocks : allUnlocks.slice(0, 4); const hidden = allUnlocks.length - unlocks.length;
  const [step, setStep] = useState(reduced ? FINAL : 0);
  const skip = () => setStep(FINAL);
  const done = step >= FINAL;
  const last = spec.number >= HUMAN_JOURNEY.levels.length;
  // yeni yer açıldıysa ya da Tüy Dede'nin haritada anlatacağı bir şey varsa ileri düğmesi haritaya götürür (bölüme atlatmaz; YN-066);
  // bölge canlanması, hedef kutusunun söz verdiği çiçeklenme ya da hazine sandığı haritada bekliyorsa da (son bölümde de: Ninni Merkezi
  // orada yanar; YN-114, YN-136)
  const intro = result.completed ? mapIntroView(last ? [] : mapIntro ?? [], reveal) : null;
  // "Bu bölümden" dökümü: bu koşunun ödül defteri (bölüm, Şanslı Nota, hazine, başarım); çevrimiçiyse bölüm jetonu sunucunun
  // yazdığı kadar (kamp/takım bonusu dahil, onaydan). Toplam = cüzdana giren (YN-042).
  const ackJeton = useSocial((s) => (runId && s.lastRun?.runId === runId && s.lastRun.state === 'tamam' ? s.lastRun.ack?.jeton : undefined));
  const earn = useMemo(() => earnLines(summary, ackJeton === undefined ? 0 : ackJeton - result.coins), [summary, ackJeton, result.coins]);
  const earnTotal = earn.reduce((a, l) => a + l.jeton, 0);
  const timed = spec.objective.id === 'timed';
  // ipucu bölümün kendi zorluğuna göre; aynı bölümde her denemede sıradaki cümle (OT-ilk-kez-oyun-19). Deneme sayısı ekran
  // açılırken bir kez okunur (kayıt sonradan değişse de ipucu ekranda yer değiştirmez)
  const [attempt] = useState(() => store.progress[spec.number]?.plays ?? 1);
  const loss = result.completed ? null : lossView(result, spec, attempt);
  // "Biliyor muydun?" (karar 31): her bölümün tek satırı, Bilgi düzeyine göre (genel / odyoloji öğrencisi); yalnız yazı. Aynı bölümün
  // tekrarında biyomun öteki onaylı satırlarından sıradaki (YN-127)
  const bilgi = biliyorMuydun(spec.number, store.knowledge, attempt - 1);
  const lossDetail = loss ? guardedDetail(loss.detail, result) : '';
  // 1★: 3. yıldızın koşulları yanıltır (2★ yok); kartta 2. yıldızın koşulları (OT-buyuk-yazi-16, OT-ogrenci-birinci-11)
  // Rahat denemeyle geçişte yıldız 1'de kalır: sıradaki yıldızın kartı yerine Rahat kartı (karar 42)
  const rahat = !!result.rahat;
  const offerRahat = !result.completed && !!rahatOffer && !!onRahat;
  const starNext = !result.completed || rahat ? null : S === 1 ? { n: 2, v: star2View(spec, result) } : { n: 3, v: star3View(spec, result) };
  // bölümün değiştiricileri adıyla (YN-102: "Değiştirici: Hız, Yankı"); sis/gece kaybında Yüksek görünürlük ayarına tek satır yönlendirme
  const mods = modifierNames(spec.modifiers ?? []);
  const dark = !result.completed && !store.highVis && (spec.modifiers ?? []).some((m) => m === 'sis' || m === 'gece');

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
  // "Biliyor muydun?" ilk ekranda (YN-145, OT-sinav-adayi-28): satır sıradaki yıldızın kartının (kayıpta kutuların) hemen altında;
  // orada yapışkan düğmelerin altında kalıyorsa düğme alanının üstünde tek satırlık kısa hâli, dokununca tamamı. Ölçü kaydırmadan
  // bağımsız (satırın sayfadaki yeri, düğmenin ekrandaki yeri); kartlar büyüyünce (yardım kartı, yazı tipi) yeniden ölçülür
  const bilgiRef = useRef<HTMLElement>(null); const actRef = useRef<HTMLDivElement>(null);
  const [bilgiKisa, setBilgiKisa] = useState(false); const [bilgiAcik, setBilgiAcik] = useState(false);
  useLayoutEffect(() => {
    const el = bilgiRef.current; const act = actRef.current; const page = rootRef.current;
    if (!el || !act || !page) return;
    const olc = () => {
      const btn = act.querySelector(':scope > :not([data-testid="biliyor-muydun-kisa"])'); if (!btn) return;
      let kayma = 0; for (let p = page.parentElement; p; p = p.parentElement) kayma += p.scrollTop;
      // kısa hâle geçince üst bölüm sıkışır (styles.css .bilgi-kisa); satır o yüzden sığar görünse de kısa kalır (gidip gelmesin)
      if (el.getBoundingClientRect().bottom - kayma > btn.getBoundingClientRect().top + 1) setBilgiKisa(true);
    };
    olc();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(olc); ro.observe(page); ro.observe(el);
    return () => ro.disconnect();
  }, [bilgi]);
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

  // Rahat denemenin skoru meydan okumaya gitmez (rekabet puanı yok; karar 42)
  const meydan = rahat ? null : raceOpen ? <ActionButton tone="gold" tile icon="megaphone" data-act="meydan" onClick={share}>Meydan oku</ActionButton> : <ActionButton tone="plain" tile icon="megaphone" data-act="meydan" disabled aria-label={`Meydan oku: ${feat.lock('race')}`}>Meydan oku<small className="act-lock"><Art name="lock" size={12} /> Bölüm {feat.at('race')}</small></ActionButton>;
  async function share() {
    const link = inviteUrl({ level: spec.number, score: result.completed ? result.score : 0, stars: result.stars });
    // uygulama dışına giden metin: emoji yok (OT-rekabetci-14)
    const text = result.completed ? `ODİ: ${spec.number}. bölümü ${result.stars} yıldızla, ${result.score} puanla geçtim. Kulak kabartır mısın, beni geçebilir misin? ${link}` : `ODİ'de ${spec.number}. bölümde takıldım. Sen geçebilir misin? ${link}`;
    const r = await platform().share(text);
    if (r !== 'cancelled' && !demo) store.recordShare();
    if (r === 'copied') { setToast('Bağlantı kopyalandı: arkadaşına yapıştır, skorunu geçmeye çalışsın.'); setTimeout(() => setToast(''), 3200); }
  }


  return (
    <>
      <div className={`screen fade-in result-screen${result.completed ? '' : ' lost'}${bilgi && bilgiKisa ? ' bilgi-kisa' : ''}`} ref={rootRef} onClick={() => { if (!done) skip(); }}>
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
            {!summary.newRecord && summary.prevBest > 0 && step >= S + 2 && <div className="muted small-note">Rekorun: {Math.max(summary.prevBest, rahat ? 0 : result.score).toLocaleString('tr-TR')}</div>}
          </div>

          {mods && <div className="result-mods" data-testid="sonuc-degistirici">Değiştirici: {mods}</div>}
          {/* gizli kolaylaştırma yok (YN-113): yardım bu denemede devredeyse ve kayıpta sonraki deneme kolaylaşacaksa tek satır */}
          {ease && <div className="result-mods" data-testid="sonuc-kolay">{ease}</div>}
          {easeNext && <div className="result-mods" data-testid="sonuc-kolay-sonraki">{easeNext}</div>}
          {/* Rahat denemeyle kaybedildiyse bu deneme de açıkça söylenir (karar 42) */}
          {rahat && !result.completed && <div className="result-mods" data-testid="sonuc-rahat-kayip">{RAHAT_TEXT.lostNote}</div>}

          {/* kayıpta neden + ipucu ve (3 kayıpta) yardım kartı sayfa akışında, kutulardan ÖNCE: yapışkan düğme alanında büyüyüp
              kutuların üstüne binmesin (OT-ilk-kez-oyun-20), ilk ekranda görünsün (OT-ilk-kez-oyun-15) ve "Yardım iste" düğmesi
              yapışkan "Tekrar dene" çubuğunun arkasında yarım kalmasın (OT-ilk-kez-oyun-25) */}
          {loss && (
            <div className="card result-obj result-why" data-testid="sonuc-neden">
              <small className="result-obj-h">Neden olmadı?</small>
              <span className="result-why-l"><b className="result-why-t">{loss.title}</b>{lossDetail && <span className="result-why-d" data-testid="sonuc-neden-hasar">{lossDetail}</span>}</span>
              {loss.tip && <span className="result-why-tip"><Art name="bulb" size={20} className="rwt-art" /><span>{loss.tip}</span></span>}
              {dark && <span className="result-why-hv" data-testid="sonuc-gorunurluk"><Art name="gear" size={16} className="art-inline" />Zor mu görüyorsun? Ayarlar › Yüksek görünürlük</span>}
            </div>
          )}
          {/* Rahat deneme teklifi (karar 42): yalnız canavar bölümünde 3 kayıptan sonra, açıkça; oyuncu her seferinde kendisi seçer.
              Kart sayfa akışında anlatır, "Rahat dene" düğmesi yapışkan alanda (320 px'te de ilk ekranda; üstünde ne değiştiği yazar) */}
          {offerRahat && (
            <div className="card result-obj result-rahat" data-testid="rahat-teklif" onClick={(e) => e.stopPropagation()}>
              <small className="result-obj-h">{RAHAT_TEXT.title}</small>
              <span className="result-rahat-t">{RAHAT_TEXT.offer(Math.max(3, store.progress[spec.number]?.fails ?? 3))}</span>
              <span className="result-rahat-l"><Art name="heart" size={20} className="art-inline" /><span><b>{RAHAT_TEXT.what}</b> {RAHAT_TEXT.rules}</span></span>
            </div>
          )}
          {!result.completed && <ResultComm level={spec.number} completed={false} demo={demo} />}

          {/* sonuç ekranı açılırken gelen başarım bildirimi kutuların altında durur: başlığı, yıldızları, skoru ve nota/süre kutularını
              örtmez; yapışkan düğmelere kadar yer yoksa bekler (ui/Toasts.tsx; OT-buyuk-yazi-37, OT-buyuk-yazi-42) */}
          <div className="stats has-wide" data-toast-under>
            {/* notasız (canavar) bölümde hasar: kalp değil (oyun boyunca kalp "can" demek; OT-buyuk-yazi-41 "2 can kaldı" okudu) */}
            {spec.coinsTotal > 0
              ? <div className="card"><div className="v"><Art name="note" size={20} className="art-inline" /><span>{result.coins}<span className="result-of">/{spec.coinsTotal}</span></span></div><div className="k">nota</div></div>
              : <div className="card" data-testid="sonuc-hasar"><div className="v"><Art name="boom" size={20} className="art-inline" />{result.damageTaken}</div><div className="k">hasar</div></div>}
            {/* süreli bölümde yıldızı hedef süresi belirler; par (günlük görev/başarım ölçüsü) yan yana çelişmesin diye yazılmaz */}
            <div className="card"><div className="v"><Art name="timer" size={20} className="art-inline" />{sureYazi(runTimeSec(spec, result))} sn</div><div className="k">{timed ? 'süre' : `par ${spec.parTimeSec} sn`}</div></div>
            {/* kazançta sıradaki yıldızın tam koşulu ve her yarının ilerlemesi (YN-070); kayıpta neden kartı "Tekrar dene"nin üstünde */}
            {rahat && result.completed && (
              <div className="card result-obj result-rahat" data-testid="sonuc-rahat">
                <small className="result-obj-h">{RAHAT_TEXT.title}</small>
                <b className="result-rahat-t">{RAHAT_TEXT.passed}</b>
                <span className="result-rahat-l">{RAHAT_TEXT.passedNote}</span>
              </div>
            )}
            {starNext && (
              <div className={`card result-obj${starNext.v.done ? ' met' : ''}`} data-testid={`sonuc-yildiz${starNext.n}`}>
                <small className="result-obj-h">{starNext.n}. yıldız{starNext.v.rows.length > 1 ? ' · biri yeter' : ''}{starNext.v.done ? ' · tamam' : ''}</small>
                <ul className="result-star3">
                  {starNext.v.rows.map((row, i) => (
                    <li key={i} className={`${row.done ? 'met' : ''}${row.parts ? ' two' : ''}`}>
                      <Art name={row.done ? 'check' : 'empty'} size={16} className="art-inline" />
                      <span className="rs3-t">{i > 0 && <small className="rs3-or">ya da </small>}{row.text}</span>
                      {/* iki parçalı koşulda tutan parça işaretli: "60 nota tamam · 2/3 altın koklea" (OT-rekabetci-17) */}
                      <span className={`rs3-n${row.parts ? ' parts' : ''}`}>{row.done ? 'tamam' : row.parts ? row.parts.map((p, j) => <span key={j} className={`rs3-p${p.done ? ' ok' : ''}`}>{j > 0 && <span className="rs3-sep" aria-hidden> · </span>}{p.done && <Art name="check" size={13} className="art-inline" />}{p.text}</span>) : row.note || 'yapılmadı'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {bilgi && (
            <aside className="result-bilgi" ref={bilgiRef} data-show={step >= S + 2 ? 'yes' : 'no'} data-testid="biliyor-muydun" data-bolum={spec.number} data-kisa={bilgiKisa ? '1' : undefined} aria-label="Biliyor muydun?">
              <Art name="bulb" size={26} className="rb-art" />
              <span className="rb-body"><small>Biliyor muydun?</small><span>{bilgi}</span></span>
            </aside>
          )}

          <div className={`card xp-card${xpPhase === 1 ? ' burst' : ''}`}>
            <div className="row between"><b>Seviye {xpLevel}</b><span className="muted">+{summary.xpAfter - summary.xpBefore} XP</span></div>
            <div className="bar tone-accent xp"><i style={{ width: `${xpWidth * 100}%`, transition: xpPhase === 2 && leveled && !reduced ? 'none' : undefined }} key={xpPhase === 2 && leveled ? 'n' : 'o'} /></div>
            {leveled && xpPhase >= 1 && <div className="levelup" role="status"><Art name="party" size="1.2em" className="art-inline" /> Seviye {after.level}!</div>}
          </div>

          <div className="card result-earn" ref={coinRef} data-show={step >= S + 2 ? 'yes' : 'no'}>
            <div className="result-earn-head"><span>Bu bölümden{earn.length > 1 ? ' toplam' : ''}</span><b><Art name="coin" size={20} className="art-inline" />+{earnTotal.toLocaleString('tr-TR')} jeton</b></div>
            {(earn.length > 1 || earn.some((l) => l.items || l.note)) && (
              <ul className="result-earn-list" data-testid="sonuc-kazanc">
                {earn.map((l, i) => (
                  <li key={i} className={l.items ? 'has-sub' : undefined}>
                    <span className="rel-l"><span>{l.label}</span>{l.note && <small>{l.note}</small>}</span><b>{fmtJeton(l.jeton)}</b>
                    {/* birden çok başarım: adları, kademeleri, koşulları ve tek tek ödülleri (OT-ekonomi-denetci-17) */}
                    {l.items && <ul className="result-earn-sub">{l.items.map((x, j) => <li key={j}><span className="rel-l"><span>{x.label}</span>{x.note && <small>{x.note}</small>}</span><b>{fmtJeton(x.jeton)}</b></li>)}</ul>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`goal-card${result.completed ? '' : ' near'}`} data-show={step >= S + 2 ? 'yes' : 'no'}>
            <span className="gi"><Art name={result.completed ? (summary.goal.kind === 'hazine' ? 'chest' : 'target') : 'ear'} size={30} /></span>
            <span><Rich text={summary.goal.text} /></span>
          </div>

          {runId && step >= S + 3 && <TeamContribution runId={runId} reduced={reduced} />}
          {result.completed && !rahat && step >= S + 3 && <ResultComm level={spec.number} completed demo={demo} />}

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

          {!done && <div className="muted skip-hint">Dokun: hızlı geç</div>}
          <div className="result-actions" ref={actRef} data-toast-floor onClick={(e) => e.stopPropagation()}>
            {bilgi && bilgiKisa && (
              <button type="button" className={`result-bilgi-kisa${bilgiAcik ? ' acik' : ''}`} data-testid="biliyor-muydun-kisa" aria-expanded={bilgiAcik} onClick={() => setBilgiAcik((a) => !a)}>
                <Art name="bulb" size={18} className="rbk-art" />
                <span className="rbk-t"><b>Biliyor muydun?</b> {bilgi}</span>
              </button>
            )}
            {intro ? (
              <>
                <div className="result-anlatim" data-testid="anlatim-bekliyor" data-tours={last ? '' : (mapIntro ?? []).join(' ')} data-harita={reveal ? [...reveal.zones, ...reveal.grows.map((g) => `${g.zone}-${g.to}`), ...reveal.treasures.map((n) => `hazine-${n}`)].join(' ') : ''}>
                  <span className="ra-td" aria-hidden><TuyDede size={44} mood="wink" /></span>
                  <span className="ra-body"><b>{intro.title}</b><small>{intro.note}</small></span>
                  <Art name={intro.art} size={30} className="ra-art" />
                </div>
                <ActionButton block icon="map" data-act="harita" data-anlatim="1" onClick={onMap}>{intro.button}</ActionButton>
                <div className="abtn-grid">
                  <ActionButton tone="teal" tile icon="retry" data-act="tekrar" onClick={onRetry}>Tekrar</ActionButton>
                  {meydan}
                </div>
              </>
            ) : result.completed && !last ? (
              <>
                <ActionButton block icon="play" data-act="sonraki" onClick={onNext}>Sonraki</ActionButton>
                <div className="abtn-grid">
                  <ActionButton tone="teal" tile icon="retry" data-act="tekrar" onClick={onRetry}>Tekrar</ActionButton>
                  {meydan}
                  <ActionButton tone="plain" tile icon="map" data-act="harita" onClick={onMap}>Harita</ActionButton>
                </div>
              </>
            ) : (
              <>
                <ActionButton block icon="retry" onClick={onRetry}>{result.completed ? 'Tekrar' : 'Tekrar dene'}</ActionButton>
                <div className="abtn-grid">
                  {offerRahat ? <ActionButton tone="teal" tile icon="play" data-testid="rahat-dene" data-act="rahat" onClick={onRahat}>{RAHAT_TEXT.button}<small className="act-lock act-rahat">{RAHAT_TEXT.short}</small></ActionButton> : meydan}
                  <ActionButton tone="plain" tile icon="map" data-act="harita" onClick={onMap}>Harita</ActionButton>
                </div>
              </>
            )}
          </div>
          {done && note && <NoteCard note={note} />}
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
      {/* başarım bildirimleri bu ekranla aynı anda çizilir (App'teki kutlama katmanı sonuçta bildirim göstermez): kutuların altında,
          hiçbir yazıyı örtmeden; seviye penceresi açıkken bekler (OT-buyuk-yazi-37, -42). Ekranın dışında: sallanma dönüşümü sabit konumu kaydırmasın */}
      <Toasts />
    </>
  );
}

/** boş yıldız yuvası: koyu oyuk (emoji/yazı karakteri yerine) */
function StarHole() { return <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden><path d="M12 2.6l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.65 6.5 19.55l1.05-6.12L3.1 9.1l6.15-.9z" fill="rgba(5,2,20,.5)" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeLinejoin="round" /></svg>; }

interface UnlockView { icon: ReactNode; kicker: string; title: string; text?: string; chips?: RewardItem[]; tone: 'accent' | 'green' | 'gold' | 'coral' | 'silver' | 'bronze' }
function buildUnlocks(s: RunSummary, odiColor: number): UnlockView[] {
  const out: UnlockView[] = [];
  if (s.lucky) out.push({ icon: '🍀', kicker: 'Şanslı Nota', title: 'Sürpriz bonus!', chips: s.lucky, tone: 'green' });
  if (s.treasure) out.push({ icon: '🎁', kicker: 'Hazine açıldı', title: `Bölüm ${s.level} hazinesi`, chips: s.treasure, tone: 'gold' });
  // yeni hareketin kendi simgesi (canavarda hedef: korkutucu yüz değil; OT-ilk-kez-oyun-22)
  for (const a of s.announcements) { const icon = a.kind === 'mekanik' ? MECHANICS[a.id as MechanicId]?.icon : undefined; out.push({ icon: a.kind === 'biyom' ? '🧭' : icon ?? '🆕', kicker: a.kind === 'biyom' || a.id === 'boss' ? 'Kapı aralandı' : 'Yeni hareket', title: a.title, text: a.text, tone: 'accent' }); }
  const order = { card: 0, cosmetic: 1, albumBadge: 2, achievement: 3 } as const;
  for (const e of [...s.events].sort((a, b) => order[a.kind] - order[b.kind])) {
    if (e.kind === 'card') { const c = cardById(e.id); if (c) out.push({ icon: '🃏', kicker: `Yeni Kulak Kartı · ${BIOMES[c.biome].name}`, title: c.title, text: c.fact, tone: 'green' }); }
    else if (e.kind === 'cosmetic') { const c = cosmeticById(e.id); const col = odiColor; if (c) out.push({ icon: <OdiAvatar size={40} color={c.kind === 'renk' ? c.color : col} hat={c.hat} />, kicker: 'Dolaba yeni', title: c.name, text: c.desc, tone: 'accent' }); }
    else if (e.kind === 'achievement') { const a = achievementById(e.id); const g = s.grants.find((x) => x.reason === `basarim:${e.id}:${e.tier}`); if (a) out.push({ icon: <Glyph e={a.emoji} size={32} />, kicker: `Başarım · ${TIER_NAMES[e.tier]}`, title: achievementName(a, e.tier), text: achievementDesc(a, e.tier), ...(g ? { chips: g.items } : {}), tone: e.tier === 3 ? 'gold' : e.tier === 2 ? 'silver' : 'bronze' }); }
    else if (e.kind === 'albumBadge') out.push({ icon: '🏅', kicker: 'Albüm rozeti', title: `${BIOMES[e.biome].name} tamamlandı`, tone: 'gold' });
  }
  return out;
}

/**
 * Kayıpta hasar cümlesi: kalkan ya da Klinik koruması bir vuruşu karşıladıysa kazançtaki satırla aynı söz (damageNote, karar 37;
 * OT-sessiz-oyuncu-18: kalkanla başlanan kayıpta yalnız "3 kez hasar aldın" yazıyordu). "…, en son dikene değdin." kısmı kalır.
 */
function guardedDetail(detail: string, r: RunResult): string {
  const g = r.extra?.guarded; const note = damageNote(r);
  if (!(typeof g === 'number' && g > 0) || !note) return detail;
  const head = `${r.damageTaken} kez hasar aldın`;
  return detail.startsWith(head) ? `${note}${detail.slice(head.length)}` : [detail, `${note}.`].filter(Boolean).join(' ');
}

const fmtJeton = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('tr-TR')}`;
