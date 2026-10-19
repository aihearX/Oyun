import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import { audio } from '@odi/audio';
import { platform } from '../platform';
import { fmtDate, fmtNum } from '../ui/social';
import { evNet, useEvents } from './store';
import { Countdown, Rewards, errText, hexColor, useSrvNow } from './common';
import { Art, rich } from '../ui/art';
import { Icon } from '../ui/icons';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Kulak Bilgi Yarışması: lobi → 10 soru × 15 sn (herkese aynı anda) → cevap + kısa açıklama → takım ortalaması */
export function QuizView() {
  const q = useEvents((s) => s.quiz); const info = useEvents((s) => s.quizInfo); const me = useNet((s) => s.me); const team = useNet((s) => s.team);
  const now = useSrvNow(200);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const lastPhase = useRef('');
  const meId = me?.id ?? '';
  const joined = !!q?.players.some((p) => p.id === meId);
  const key = q ? `${q.phase}:${q.question?.index ?? -1}` : '';
  useEffect(() => {
    if (!q || key === lastPhase.current) return; lastPhase.current = key;
    if (q.phase === 'soru') { audio.play('countdownGo', { vol: 0.6 }); platform().haptic('light'); }
    if (q.phase === 'cevap' && q.question) { const ok = q.question.myChoice === q.question.answer; if (joined) { audio.play(ok ? 'perfect' : 'error', { vol: 0.7 }); platform().haptic(ok ? 'success' : 'error'); } }
  }, [key]);
  const call = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(errText(e)); } setBusy(false); };
  const start = () => call(async () => { const r = await evNet()!.call('quiz.start', {}); useEvents.setState({ quiz: r.quiz }); });
  const join = () => call(async () => { const r = await evNet()!.call('quiz.join', { quizId: q!.id }); useEvents.setState({ quiz: r.quiz }); platform().haptic('medium'); });
  const go = () => call(async () => { const r = await evNet()!.call('quiz.go', { quizId: q!.id }); useEvents.setState({ quiz: r.quiz }); });
  const answer = (i: number) => call(async () => { const r = await evNet()!.call('quiz.answer', { quizId: q!.id, index: q!.question!.index, choice: i }); useEvents.setState({ quiz: r.quiz }); audio.play('tap'); });

  if (!q) return (
    <div className="stack ev-quiz" data-testid="quiz" data-phase="yok">
      {err && <div className="ev-err" role="alert">{err}</div>}
      <div className="ev-quiz-hero" data-tone="lime">
        <span className="ev-art big" aria-hidden><Art e="🧠" size="1.15em" className="art-inline" /></span>
        <b>Kulağını ne kadar tanıyorsun?</b>
        <span className="muted">10 soru, her biri 15 saniye. Tüm takım aynı anda cevaplar; takımın puanı katılanların ortalaması. Her cevaptan sonra kısa bir açıklama!</span>
        {info?.canStart ? <button className="btn ev-big" data-testid="quiz-baslat" disabled={busy} onClick={() => void start()}><Art e="🧠" size="1.15em" className="art-inline" /> Yarışmayı başlat</button>
          : <div className="ev-tag">Sabit saat: {info ? fmtDate(info.nextSlotAt) : '13:00 / 20:00'}</div>}
        {info && !info.slotOpen && <Countdown to={info.nextSlotAt} label="sabit saate" />}
        {info && <small className="muted">Lider ve yardımcılar her an başlatabilir · bugün kalan: {info.startsLeft}</small>}
      </div>
      <QuizRewards />
      <Ranking />
    </div>
  );

  const qv = q.question;
  const canGo = q.phase === 'lobi' && q.players.length > 0 && (q.startedBy === meId || q.startedBy === 'sistem' || team?.roster.find((m) => m.id === meId)?.role !== 'uye');
  const timeLeft = qv ? Math.max(0, qv.endsAt - now) : 0;
  return (
    <div className="stack ev-quiz" data-testid="quiz" data-phase={q.phase} data-index={qv?.index ?? -1}>
      {err && <div className="ev-err" role="alert">{err}</div>}
      {q.phase === 'lobi' && (
        <div className="ev-quiz-hero" data-tone="lime">
          <span className="ev-art big" aria-hidden><Art e="🧠" size="1.15em" className="art-inline" /></span>
          <b>Yarışma birazdan başlıyor!</b>
          <Countdown to={q.lobbyEndsAt} label="başlamasına" />
          <div className="ev-qp">{q.players.map((p) => <span key={p.id} className="ev-chip-p" style={{ ['--pc' as string]: hexColor(p.color) }}>{p.name}</span>)}{q.players.length === 0 && <small className="muted">Henüz katılan yok</small>}</div>
          {!joined && <button className="btn ev-big" data-testid="quiz-katil" disabled={busy} onClick={() => void join()}><Art e="🙋" size="1.15em" className="art-inline" /> Katıl</button>}
          {joined && canGo && <button className="btn ghost" data-testid="quiz-hemen" disabled={busy} onClick={() => void go()}><Art e="⚡" size="1.15em" className="art-inline" /> Hemen başlat</button>}
          {joined && !canGo && <small className="muted">Hazırsın! Süre bitince ilk soru gelir.</small>}
        </div>
      )}
      {(q.phase === 'soru' || q.phase === 'cevap') && qv && (
        <div className={`ev-question ${q.phase}`} data-tone="lime">
          <div className="row between"><span className="ev-tag">Soru {qv.index + 1}/{qv.total}</span><span className="ev-tag">{qv.answered}/{q.players.length} cevapladı</span></div>
          {q.phase === 'soru' && <div className="ev-timer" aria-label={`${Math.ceil(timeLeft / 1000)} saniye`}><i style={{ width: `${(timeLeft / q.questionMs) * 100}%` }} /><b>{Math.ceil(timeLeft / 1000)}</b></div>}
          <h2 className="ev-q-text">{qv.text}</h2>
          <div className="ev-choices">
            {qv.choices.map((c, i) => {
              const cls = q.phase === 'cevap' ? (i === qv.answer ? ' right' : i === qv.myChoice ? ' wrong' : ' dim') : qv.myChoice === i ? ' picked' : qv.myChoice != null ? ' dim' : '';
              return <button key={i} className={`ev-choice${cls}`} data-testid={`quiz-secenek-${i}`} disabled={!joined || q.phase !== 'soru' || qv.myChoice != null || busy} onClick={() => void answer(i)}><span className="ev-letter">{LETTERS[i]}</span><span className="grow">{c}</span>{q.phase === 'cevap' && i === qv.answer && <span><Icon name="check" size="1.1em" className="ic-inline" /></span>}</button>;
            })}
          </div>
          {q.phase === 'soru' && qv.myChoice != null && <div className="ev-note"><Art e="🔒" size="1.15em" className="art-inline" /> Cevabın kilitlendi — süre bitince açıklanır.</div>}
          {q.phase === 'cevap' && qv.explain && <div className="card cream ev-explain"><b>{rich(qv.myChoice === qv.answer ? '🎉 Doğru!' : qv.myChoice == null ? '⏰ Süre doldu' : '💡 Doğru cevap: ' + LETTERS[qv.answer!])}</b><span>{qv.explain}</span></div>}
          {!joined && <button className="btn small" data-testid="quiz-katil" onClick={() => void join()}><Art e="🙋" size="1.15em" className="art-inline" /> Sonraki sorudan katıl</button>}
        </div>
      )}
      {q.phase === 'bitti' && (
        <div className="ev-quiz-hero done" data-tone="lime">
          <span className="ev-art big" aria-hidden><Art e="🏆" size="1.15em" className="art-inline" /></span>
          <b>Takım ortalaması</b>
          <span className="ev-big-num" data-testid="quiz-ortalama">{fmtNum(q.teamAvg)}</span>
          {joined && (() => { const c = q.players.find((p) => p.id === meId)?.correct ?? 0; return <span className="muted">Sen: {c}/10 doğru{rich(c > 0 ? ` · 🪙 ${c * 10} ödül kutunda` : ' · bir dahaki yarışmada!')}</span>; })()}
          <button className="btn ghost small" onClick={() => useEvents.setState({ quiz: null })}>Tamam</button>
        </div>
      )}
      {q.players.length > 0 && (
        <div className="card">
          <b>Skor tablosu</b>
          <ol className="rank-list">{q.players.map((p, i) => <li key={p.id} className={p.id === meId ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis">{p.name} {rich(p.lastCorrect === true ? '✅' : p.lastCorrect === false ? '❌' : q.phase === 'soru' && p.answered ? '🔒' : '')}</span><small>{p.correct} doğru</small><b>{fmtNum(p.score)}</b></li>)}</ol>
          <div className="muted small-note">Takım ortalaması: <b>{fmtNum(q.teamAvg)}</b></div>
        </div>
      )}
      {q.phase === 'bitti' && <Ranking />}
    </div>
  );
}

function QuizRewards() {
  const info = useEvents((s) => s.quizInfo);
  if (!info) return null;
  return <div className="card ev-rw-grid"><b>Ödüller (görünür, sabit)</b><span className="muted small-note">Her doğru cevap <Art e="🪙" size="1.15em" className="art-inline" /> {info.rewards.perCorrect} · takım ortalaması {info.rewards.bonusAvg}+ ise herkese:</span><Rewards items={info.rewards.bonus} /><small className="muted">Doğru = 100 puan + hız bonusu (en çok 50).</small></div>;
}
function Ranking() {
  const info = useEvents((s) => s.quizInfo); const team = useNet((s) => s.team);
  if (!info) return null;
  return (
    <div className="card">
      <b>Bugünün takım sıralaması</b>
      {info.ranking.length === 0 ? <div className="muted small-note">Bugün henüz yarışma bitiren takım yok.</div> : <ol className="rank-list">{info.ranking.map((t, i) => <li key={t.teamId} className={t.teamId === team?.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis"><span data-ugc>{t.emblem}</span> {t.name}</span><b>{fmtNum(t.avg)}</b></li>)}</ol>}
    </div>
  );
}
