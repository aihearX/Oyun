import { DUEL_RULES } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { fmtDate, fmtNum } from '../ui/social';
import { useNav } from '../nav';
import { useEvents } from './store';
import { Countdown, Rewards } from './common';
import { Art, rich } from '../ui/art';
import { Icon } from '../ui/icons';

/** Takım Düellosu: iki takım, canlı skor çubuğu (halat çekme), en çok katkı yapanlar, son 2 saat, sabit ödüller */
export function DuelView() {
  const d = useEvents((s) => s.duel); const me = useNet((s) => s.me); const nav = useNav();
  if (!d) return <div className="card muted">Düello bilgisi yükleniyor…</div>;
  const total = (d.me?.points ?? 0) + (d.rival?.points ?? 0);
  const p = total > 0 ? (d.me?.points ?? 0) / total : 0.5;
  const lead = d.me && d.rival ? d.me.points - d.rival.points : 0;
  return (
    <div className="stack ev-duel" data-testid="duello" data-status={d.status}>
      {d.finalPush && <div className="ev-push" role="status"><Art e="⏰" size="1.15em" className="art-inline" /> Son 2 saat! {lead > 0 ? `${fmtNum(lead)} puan öndeyiz — farkı koru!` : lead < 0 ? `${fmtNum(-lead)} puan gerideyiz — son hamle!` : 'Skor eşit — her yıldız kazandırır!'}</div>}
      {d.status === 'kapali' ? (
        <div className="card ev-intro tone-violet"><b>Sıradaki düello yaklaşıyor</b><span className="muted">Düellolar haftada 2 kez, 48 saat sürer: Pazartesi 00:00 – Çarşamba 00:00 ve Perşembe 00:00 – Cumartesi 00:00.</span><span className="ev-tag">Başlangıç: {fmtDate(d.next.startsAt)}</span><Countdown to={d.next.startsAt} label="başlamasına" /></div>
      ) : (
        <div className="ev-versus" data-tone="violet">
          <div className="row between"><span className="ev-tag">{d.status === 'eslesti' ? 'Düello sürüyor' : 'Rakip aranıyor'}</span>{d.period && <Countdown to={d.period.endsAt} urgentMs={d.finalPushMs} />}</div>
          <div className="ev-vs-row">
            <div className="ev-side me"><span className="ev-emb">{d.me?.emblem}</span><b className="ellipsis">{d.me?.name}</b>{(d.me?.power ?? 0) > 0 && <small><Art e="⚡" size="1.15em" className="art-inline" /> güç {fmtNum(d.me!.power)}</small>}</div>
            <span className="ev-vs">VS</span>
            {d.rival ? <div className="ev-side"><span className="ev-emb">{d.rival.emblem}</span><b className="ellipsis">{d.rival.name}</b>{d.rival.power > 0 && <small><Art e="⚡" size="1.15em" className="art-inline" /> güç {fmtNum(d.rival.power)}</small>}</div>
              : <div className="ev-side searching"><span className="ev-emb"><Art e="🔎" size="1.15em" className="art-inline" /></span><b>Rakip aranıyor</b><small>Gerçek bir takım katılınca eşleşirsin</small></div>}
          </div>
          <div className="ev-tug" data-testid="duello-skor" data-me={d.me?.points ?? 0} data-rival={d.rival?.points ?? 0}>
            <b>{fmtNum(d.me?.points ?? 0)}</b>
            <div className="ev-tug-bar big"><i style={{ width: `${p * 100}%` }} /><span className="ev-tug-knot" style={{ left: `${p * 100}%` }} /></div>
            <b>{d.rival ? fmtNum(d.rival.points) : '—'}</b>
          </div>
          <div className="muted small-note">Senin katkın: <b>{fmtNum(d.myPoints)}</b> puan{d.status === 'araniyor' ? ' · puanlar şimdiden sayılıyor' : ''}</div>
        </div>
      )}
      {d.me && (
        <div className="ev-two">
          <Top emblem={d.me.emblem} title="En çok katkı" list={d.me.top} meId={me?.id} />
          {d.rival && <Top emblem={d.rival.emblem} title="Rakipte" list={d.rival.top} />}
        </div>
      )}
      <div className="card">
        <b>Puan nasıl kazanılır?</b>
        <ul className="ev-rules">
          <li><Art e="⭐" size="1.15em" className="art-inline" /> Her bölüm yıldızı: <b>{DUEL_RULES.starPoints}</b></li>
          <li><Art e="🔥" size="1.15em" className="art-inline" /> Kazanılan ralli: katılan her kişi <b>{60}</b></li>
          <li><Art e="🚩" size="1.15em" className="art-inline" /> Bayrak ayağı: <b>{DUEL_RULES.relayLeg}</b> (süre rekoru {DUEL_RULES.relayImprove})</li>
        </ul>
        <button className="btn small ghost" onClick={() => nav.tab('map')}><Icon name="play" size="0.9em" className="ic-inline" /> Bölüm oyna</button>
      </div>
      <div className="card ev-rw-grid">
        <b>Önceden belli ödüller (her üyeye)</b>
        <Rewards items={d.rewards.win} label="🏆 Kazanan" />
        <Rewards items={d.rewards.tie} label="🤝 Berabere" />
        <Rewards items={d.rewards.lose} label="💪 Teselli" />
      </div>
      {d.last && <div className="card ev-last"><b>Son düello: {rich(d.last.result === 'kazandi' ? '🏆 Kazandınız' : d.last.result === 'kaybetti' ? 'Kaybettiniz' : 'Berabere')}</b><span className="muted">{fmtNum(d.last.mine)} – {fmtNum(d.last.theirs)} · {d.last.rivalEmblem} {d.last.rivalName}</span></div>}
    </div>
  );
}

function Top({ emblem, title, list, meId }: { emblem?: string; title: string; list: { id: string; name: string; points: number }[]; meId?: string }) {
  return (
    <div className="card ev-top">
      <b className="ellipsis">{emblem && <span data-ugc>{emblem}</span>} {title}</b>
      {list.length === 0 ? <div className="muted small-note">Henüz puan yok.</div> : (
        <ol className="rank-list">{list.map((x, i) => <li key={x.id} className={x.id === meId ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis">{x.name}</span><b>{fmtNum(x.points)}</b></li>)}</ol>
      )}
    </div>
  );
}
