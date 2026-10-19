import { useEffect, useRef, useState } from 'react';
import { audio } from '@odi/audio';
import { useNet } from '@odi/net/store';
import { fmtNum } from '../ui/social';
import { useNav } from '../nav';
import { useEvents } from './store';
import { Countdown, Rewards } from './common';
import { Art } from '../ui/art';
import { Icon } from '../ui/icons';


/** Ses Avı: dev melodi çubuğu (8 nota kademesi), kademe ödülleri, %100'de takım şarkısı (audio.tone ile çalınır) */
export function HuntView() {
  const h = useEvents((s) => s.hunt); const me = useNet((s) => s.me); const nav = useNav();
  const [playing, setPlaying] = useState(-1); const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);
  if (!h) return <div className="card muted">Ses Avı yükleniyor…</div>;
  const pct = h.target ? h.progress / h.target : 0;
  const play = () => {
    if (!h.song) return;
    audio.unlock();
    for (const t of timers.current) clearTimeout(t);
    timers.current = h.song.map((semi, i) => setTimeout(() => { audio.tone(523.25 * Math.pow(2, semi / 12), i === h.song!.length - 1 ? 0.6 : 0.26, 0.16); setPlaying(i); }, i * 280));
    timers.current.push(setTimeout(() => setPlaying(-1), h.song.length * 280 + 600));
  };
  if (!h.period) return <div className="card ev-intro tone-gold"><b>Ses Avı dinleniyor</b><span className="muted">Av 3 gün sürer: Pazartesi–Perşembe ve Cuma–Pazartesi. Perşembe dinlenme günü.</span><Countdown to={h.next.startsAt} label="yeni ava" /></div>;
  return (
    <div className="stack ev-hunt" data-testid="ses-avi" data-progress={h.progress}>
      <div className="ev-melody" data-tone="gold">
        <div className="row between"><span className="ev-tag"><Art e="♪" size="1.15em" className="art-inline" /> {fmtNum(h.progress)} / {fmtNum(h.target)} nota</span><Countdown to={h.period.endsAt} /></div>
        <div className="ev-staff" aria-label={`Melodi %${Math.round(pct * 100)}`}>
          <div className="ev-staff-fill" style={{ width: `${pct * 100}%` }} />
          {h.tiers.map((t, i) => (
            <span key={i} className={`ev-note-m${t.reached ? ' on' : ''}`} style={{ left: `${((i + 1) / h.tiers.length) * 100}%` }} title={`${fmtNum(t.need)} nota`}><Art name="note" size={16} /></span>
          ))}
        </div>
        <div className="muted small-note">Normal bölümlerde topladığın her jeton bir nota olarak takımın melodisine eklenir.</div>
        <button className="btn small" onClick={() => nav.tab('map')}><Icon name="play" size="0.9em" className="ic-inline" /> Bölüm oyna, nota topla</button>
      </div>
      <div className={`card ev-song${h.song ? ' open' : ''}`} data-testid="takim-sarkisi">
        <b><Art e="🎶" size="1.15em" className="art-inline" /> {h.songName}</b>
        {h.song ? (
          <>
            <div className="ev-song-notes">{h.song.map((n, i) => <i key={i} className={i === playing ? 'on' : ''} style={{ height: `${18 + n * 2}px` }} />)}</div>
            <button className="btn small" onClick={play}><Icon name="play" size="0.9em" className="ic-inline" /> Takım şarkısını çal</button>
          </>
        ) : <span className="muted small-note">Melodi %100 olunca takımınıza özel kısa bir şarkı açılır.</span>}
      </div>
      <div className="card">
        <b>Kademe ödülleri (tüm üyelere takım hediyesi)</b>
        <ul className="ev-tiers">{h.tiers.map((t, i) => <li key={i} className={t.reached ? 'on' : ''}><span className="ev-tier-n"><Art name="note" size="1.1em" className="art-inline" /> {i + 1}</span><span className="grow">{fmtNum(t.need)} nota</span><Rewards items={t.reward} /></li>)}</ul>
      </div>
      <div className="card">
        <b>En çok nota toplayanlar</b>
        {h.contributors.length === 0 ? <div className="muted small-note">İlk notayı sen topla!</div> : <ol className="rank-list">{h.contributors.map((c, i) => <li key={c.id} className={c.id === me?.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis">{c.name}</span><b><Art e="♪" size="1.15em" className="art-inline" /> {fmtNum(c.notes)}</b></li>)}</ol>}
      </div>
    </div>
  );
}
