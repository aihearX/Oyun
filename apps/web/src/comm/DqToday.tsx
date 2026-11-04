import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { quizChoiceLabels } from '@odi/content';
import type { DailyQuestion, DqPast, DqState } from '@odi/shared';
import { act } from '../net';
import { platform } from '../platform';
import { useNav } from '../nav';
import { useFeatures } from '../ftue/useFeatures';
import { afterText } from '../ftue/features';
import { Sheet, fmtTime } from '../ui/social';
import { Art } from '../ui/art';
import { openTeamTab } from '../screens/team/teamTabs';
import { refreshDq, useComm } from './state';
import './comm.css';

/** Bugün kartının durum satırı: cevapladın mı, cevap ne zaman açıklanır, açıklandıysa sonuç */
export function dqStatusLine(q: DailyQuestion): string {
  if (!q.revealed) return `${q.myChoice === null ? 'Cevaplamadın' : 'Cevapladın'} · açıklama saati ${fmtTime(q.revealAt)}`;
  if (q.myChoice === null) return 'Cevap açıklandı · bu soruyu cevaplamadın';
  return q.myChoice === q.answer ? 'Cevap açıklandı · doğru bildin' : 'Cevap açıklandı · bu kez olmadı';
}
/** kural satırı: takımda ödül sohbet kartıyla aynı; takımsızda ödül ve takım puanı yok (karar 35) */
export const dqRuleLine = (st: DqState): string => (st.solo
  ? 'Takımın yok: cevabın kaydedilir, akşam açıklanır. Ödül, takım puanı ve lig yalnız takım cevaplarından.'
  : `Takım sohbetindeki soruyla aynı · doğru bilene ${st.reward} jeton`);

const answerText = (choices: string[], i: number) => `${quizChoiceLabels(choices)[i]}) ${choices[i]}`;

function Yesterday({ y }: { y: DqPast }) {
  return (
    <div className="dqb-dun" data-testid="bugun-soru-dun">
      <small className="muted">Dünkü soru</small>
      <b className="dqb-dun-q">{y.text}</b>
      <div className="dqb-dun-a">Doğru cevap: {answerText(y.choices, y.answer)}{y.myChoice === null ? '' : y.myChoice === y.answer ? ' · sen de bildin' : ` · senin cevabın ${quizChoiceLabels(y.choices)[y.myChoice]}`}</div>
      <p className="muted">{y.explain}</p>
    </div>
  );
}

/**
 * Bugün › Günün Sorusu (YN-074, karar 35): soru eskiden yalnız takım sohbetine kart olarak düşüyordu; kalabalık sohbette kart
 * kayboluyor, takımsız oyuncu hiç göremiyordu. Kart her zaman burada: durum, açıklama saati, dünkü sorunun cevabı ve açıklaması;
 * dokununca alt sayfada soru ve şıklar. Takımda sohbet kartıyla aynı soru ve aynı işlem (`dq.answer`; sunucu tek cevabı garanti eder).
 */
export function DqTodayCard() {
  const dq = useComm((x) => x.dq); const status = useNet((x) => x.status); const teamId = useNet((x) => x.team?.id ?? null);
  const f = useFeatures(); const [open, setOpen] = useState(false);
  useEffect(() => { void refreshDq(); }, [status, teamId]);
  const locked = !f.open('soru');
  // takımlıyken gelen durum takımsız kalmış olabilir (ya da tersi): eşleşmeyen durum gösterilmez
  const st = dq && dq.solo === !teamId ? dq : null;
  const q = st?.question ?? null;
  const durum = locked ? 'kilitli' : status !== 'bağlı' ? 'cevrimdisi' : !q ? 'yukleniyor' : q.revealed ? 'aciklandi' : q.myChoice === null ? 'bekliyor' : 'cevapladin';
  return (
    <section className="card dq-bugun" data-testid="bugun-soru" data-durum={durum}>
      <div className="row dqb-head">
        <span className="dqb-icon" aria-hidden><Art name="question" size={40} /></span>
        <div className="grow min0">
          <h2>Günün Sorusu</h2>
          {locked ? <div className="muted">{afterText('soru')} açılır.</div>
            : status !== 'bağlı' ? <div className="muted" data-testid="bugun-soru-cevrimdisi">Bağlanınca gelir: soru her gün sunucudan gelir.</div>
            : !q || !st ? <div className="muted">Yükleniyor…</div>
            : <div className="muted" data-testid="bugun-soru-durum">{dqStatusLine(q)}</div>}
        </div>
      </div>
      {!locked && q && st && <>
        <div className="dqb-q">{q.text}</div>
        <small className="muted dqb-rule" data-testid="bugun-soru-kural">{dqRuleLine(st)}</small>
        <button type="button" className="btn small dqb-btn" data-testid="bugun-soru-ac" onClick={() => setOpen(true)}>{q.revealed || q.myChoice !== null ? 'Soruyu gör' : 'Cevapla'}</button>
        {st.yesterday && <Yesterday y={st.yesterday} />}
      </>}
      {open && st && q && <DqSheet st={st} q={q} onClose={() => setOpen(false)} />}
    </section>
  );
}

function DqSheet({ st, q, onClose }: { st: DqState; q: DailyQuestion; onClose: () => void }) {
  const nav = useNav(); const [busy, setBusy] = useState(false);
  const labels = quizChoiceLabels(q.choices); const my = q.myChoice; const ans = q.answer;
  const answer = async (i: number) => {
    setBusy(true);
    const r = await act('dq.answer', { choice: i });
    setBusy(false);
    if (r) { useComm.setState({ dq: r }); platform().haptic('light'); }
  };
  const toChat = () => { onClose(); openTeamTab('sohbet'); nav.tab('team'); };
  return (
    <Sheet title="Günün Sorusu" onClose={onClose}>
      <div className="dqb-sheet" data-testid="bugun-soru-sayfa">
        <b className="dqb-sheet-q">{q.text}</b>
        <div className="dqb-choices">
          {q.choices.map((c, i) => {
            const cls = q.revealed ? (i === ans ? ' ok' : i === my ? ' bad' : ' dim') : i === my ? ' picked' : '';
            return <button key={i} type="button" className={`dq-opt${cls}`} data-choice={i} disabled={busy || my !== null || q.revealed} onClick={() => void answer(i)}>
              <span className="dq-t"><span className="dq-l">{labels[i]}</span>{c}</span>{q.revealed && i === ans && <Art name="check" size={18} />}{q.revealed && i === my && i !== ans && <Art name="cross" size={18} />}
            </button>;
          })}
        </div>
        {q.revealed && ans !== null ? (
          <div className="dq-exp" data-testid="bugun-soru-aciklama">
            <p>Doğru cevap: {answerText(q.choices, ans)}</p>
            <p className="dqb-exp">{q.explain}</p>
            {q.oneren && <small className="dq-oneren">Öneren: <span data-ugc>{q.oneren}</span></small>}
          </div>
        ) : (
          <div className="muted small-note" data-testid="bugun-soru-bekle">{my !== null ? 'Cevabın kaydedildi.' : 'Bir şık seç.'} Doğru cevap ve açıklama saat {fmtTime(q.revealAt)} itibarıyla burada.{st.solo ? '' : ` Takımdan ${q.answered} kişi cevapladı.`}</div>
        )}
        <small className="muted">{dqRuleLine(st)}</small>
        {!st.solo && <button type="button" className="btn ghost small" data-testid="bugun-soru-sohbet" onClick={toChat}><Art name="chat" size="1.15em" className="art-inline" /> Takım sohbetinde tartış</button>}
      </div>
    </Sheet>
  );
}
