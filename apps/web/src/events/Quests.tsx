import { useNav } from '../nav';
import { Bar } from '../ui/bits';
import { useEvents } from './store';
import { Countdown, Rewards } from './common';

const QUEST_ICON: Record<string, string> = { bolum: '🗺️', yildiz: '⭐', uye: '👥', ralli: '🔥', quiz: '🧠', bayrak: '🚩', avi: '🎵' };

/** Günlük takım görevleri: 3 ortak görev, canlı ilerleme, her biri tüm üyelere hediye; üçü birden ortak sandık */
export function QuestsView({ compact }: { compact?: boolean }) {
  const q = useEvents((s) => s.quests); const nav = useNav();
  if (!q) return <div className="card muted">Görevler yükleniyor…</div>;
  return (
    <div className="stack ev-quests" data-testid="takim-gorevleri">
      {!compact && <div className="row between"><span className="ev-tag">Her gün yenilenir</span><Countdown to={q.endsAt} /></div>}
      {q.quests.map((x) => (
        <div key={x.kind} className={`card ev-quest${x.done ? ' done' : ''}`} data-tone="gold">
          <span className="ev-q-ic" aria-hidden>{x.done ? '✅' : QUEST_ICON[x.kind]}</span>
          <div className="grow min0">
            <b>{x.text}</b>
            <div className="row"><Bar value={x.progress / x.need} tone={x.done ? 'green' : 'amber'} label={x.text} /><span className="qn">{x.progress}/{x.need}</span></div>
            {!compact && <Rewards items={x.reward} label="Tüm üyelere" />}
          </div>
        </div>
      ))}
      <div className={`card cream ev-chest${q.allDone ? ' open' : ''}`}><span className="ev-q-ic" aria-hidden>{q.allDone ? '🎁' : '🧰'}</span><div className="grow"><b>{q.allDone ? 'Ortak sandık açıldı!' : 'Üçü de bitince ortak sandık'}</b><Rewards items={q.bonus} /></div></div>
      {!compact && <div className="muted small-note">Ödüller takım hediyesi olarak gelir: Takım → Hediyeler. <button className="linkish" onClick={() => nav.tab('team')}>Takıma git</button></div>}
    </div>
  );
}
