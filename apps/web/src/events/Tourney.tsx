import { useNet } from '@odi/net/store';
import { fmtNum } from '../ui/social';
import { useEvents } from './store';
import { Countdown, Rewards, eventSpec, levelName } from './common';
import { Board } from './Challenge';
import type { PlayFn } from './EventsScreen';

/** Haftalık Turnuva: haftanın 5 bölümü, bölüm başına en iyi skorların toplamı; 50 kişilik grup sıralaması */
export function TourneyView({ onPlay }: { onPlay: PlayFn }) {
  const t = useEvents((s) => s.tourney); const me = useNet((s) => s.me);
  if (!t) return <div className="card muted">Yükleniyor…</div>;
  return (
    <div className="stack ev-tourney" data-testid="turnuva">
      <div className="ev-ch-hero" data-tone="teal">
        <div className="row between"><span className="ev-tag">Hafta {t.week.split('-W')[1]}</span><Countdown to={t.endsAt} /></div>
        <div className="ev-stat-row"><span><small>Toplam skor</small><b>{fmtNum(t.total)}</b></span><span><small>Grup sıran</small><b>{t.rank ? `${t.rank}.` : '—'}</b></span><span><small>Grup</small><b>{t.group.length}/{t.groupSize}</b></span></div>
      </div>
      <div className="ev-slots">
        {t.levels.map((l) => (
          <button key={l.slot} className={`ev-slot${l.best != null ? ' played' : ''}`} data-testid={`turnuva-${l.slot}`} onClick={() => onPlay(eventSpec(l.level, l.salt), { kind: 'turnuva', slot: l.slot })}>
            <span className="ev-slot-n">{l.level}</span>
            <span className="grow min0"><b className="ellipsis">{levelName(l.level)}</b><small>{l.best != null ? `En iyi: ${fmtNum(l.best)}` : 'Henüz oynanmadı'}</small></span>
            <span className="ev-play">▶</span>
          </button>
        ))}
      </div>
      <h2 className="ev-sec">Grubun</h2>
      <Board rows={t.group} meId={me?.id} empty="Grubunda henüz skor yok." />
      <div className="card ev-rw-grid"><b>Hafta sonu ödülleri (grup sırası)</b>{t.rewards.map((r) => <Rewards key={r.label} items={r.items} label={r.label} />)}</div>
    </div>
  );
}
