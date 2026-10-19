import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { platform } from '../platform';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Sheet } from '../ui/social';
import { evNet, useEvents } from './store';
import { Countdown, Rewards, errText, eventSpec, fmtSecs, levelName } from './common';
import type { PlayFn } from './EventsScreen';
import { Art, Glyph, rich } from '../ui/art';

const LEG_ICON = ['🏃', '🤸', '⚙️', '🏊'];

/** Bayrak Yarışı: 4 ayaklı parkur, bayrağın yolu ve kim taşıdı, devir, takım sıralaması */
export function RelayView({ onPlay }: { onPlay: PlayFn }) {
  const r = useEvents((s) => s.relay); const me = useNet((s) => s.me); const team = useNet((s) => s.team);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [passOpen, setPassOpen] = useState(false);
  if (!r) return <div className="card muted">Parkur yükleniyor…</div>;
  const meId = me?.id ?? '';
  const done = r.current >= 4;
  const mine = r.carrier?.id === meId;
  const act = async (fn: () => Promise<void>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(errText(e)); platform().haptic('error'); } setBusy(false); };
  const take = () => act(async () => { const x = await evNet()!.call('relay.take', {}); useEvents.setState({ relay: x.relay }); platform().haptic('heavy'); });
  const pass = (to: string) => act(async () => { const x = await evNet()!.call('relay.pass', { to }); useEvents.setState({ relay: x.relay }); setPassOpen(false); });
  const canPass = !done && (mine || (!r.carrier && r.lastRunner?.id === meId));
  const others = (team?.roster ?? []).filter((m) => m.id !== meId);
  const leg = !done ? r.legs[r.current]! : null;

  return (
    <div className="stack ev-relay" data-testid="bayrak" data-current={r.current} data-carrier={r.carrier?.name ?? ''}>
      {err && <div className="ev-err" role="alert">{err}</div>}
      <div className="ev-track" data-tone="teal">
        <div className="row between"><span className="ev-tag">{rich(done ? `🏁 Parkur tamam · ${fmtSecs(r.totalSec ?? 0)}` : `${r.current + 1}. ayak sırada`)}</span><Countdown to={r.period.endsAt} /></div>
        <div className="ev-path">
          {r.legs.map((l, i) => (
            <div key={i} className={`ev-leg${l.firstBy ? ' done' : ''}${i === r.current ? ' cur' : ''}`} data-testid={`bayrak-ayak-${i}`}>
              <span className="ev-leg-dot"><Glyph e={l.firstBy ? '🚩' : LEG_ICON[i] ?? '🏃'} size={20} /></span>
              <div className="min0 grow"><b className="ellipsis">{i + 1}. ayak · {levelName(l.level)}</b>
                <small className="ellipsis">{rich(l.best ? `⏱️ ${fmtSecs(l.best.timeSec)} · ${l.best.name}` : i === r.current && r.carrier ? `🏃 ${r.carrier.name} koşuyor` : 'Henüz koşulmadı')}</small></div>
              {done && <button className="btn small ghost" onClick={() => onPlay(eventSpec(l.level, l.salt), { kind: 'bayrak', leg: i })}><Art e="⏱️" size="1.15em" className="art-inline" /></button>}
            </div>
          ))}
        </div>
      </div>

      {!done && mine && leg && (
        <div className="card ev-carrier tone-teal" data-testid="bayrak-sende">
          <b><Art e="🚩" size="1.15em" className="art-inline" /> Bayrak sende!</b><span className="muted">{r.current + 1}. ayak: {leg.level}. {levelName(leg.level)}. Bitirince bayrağı sıradaki gönüllüye devret.</span>
          {r.carrier && <Countdown to={r.carrier.until} label="bayrak süresi" />}
          <button className="btn teal ev-big" data-testid="bayrak-kos" onClick={() => onPlay(eventSpec(leg.level, leg.salt), { kind: 'bayrak', leg: r.current })}><Art e="🏃" size="1.15em" className="art-inline" /> {r.current + 1}. ayağı koş</button>
        </div>
      )}
      {!done && !r.carrier && (
        <div className="card ev-carrier">
          <b>{r.lastRunner ? `${r.lastRunner.name} ${r.current}. ayağı bitirdi!` : 'Parkur seni bekliyor!'}</b>
          <span className="muted">{r.current + 1}. ayak için bir gönüllü gerekiyor.</span>
          <div className="row">
            <button className="btn teal grow" data-testid="bayrak-al" disabled={busy || (r.lastRunner?.id === meId && others.length > 0)} onClick={() => void take()}><Art e="🚩" size="1.15em" className="art-inline" /> Bayrağı al</button>
            {canPass && others.length > 0 && <button className="btn ghost grow" data-testid="bayrak-devret" onClick={() => setPassOpen(true)}><Art e="🤝" size="1.15em" className="art-inline" /> Devret</button>}
          </div>
        </div>
      )}
      {!done && r.carrier && !mine && <div className="card ev-wait"><OdiAvatar color={0x2ee6d6} size={36} /><b>{r.carrier.name} {r.current + 1}. ayağı koşuyor</b><Countdown to={r.carrier.until} label="bayrak süresi" /></div>}
      {done && <div className="card cream ev-result"><b><Art e="🏁" size="1.15em" className="art-inline" /> Parkur tamam: {fmtSecs(r.totalSec ?? 0)}</b><span>Artık her ayakta en iyi süre geçerli: <Art e="⏱️" size="1.15em" className="art-inline" /> ile istediğin ayağı yeniden koş.</span></div>}

      <div className="card">
        <b>Takımlar arası (toplam süre)</b>
        {r.ranking.length === 0 ? <div className="muted small-note">Bu hafta henüz parkuru bitiren yok.</div> : (
          <ol className="rank-list">{r.ranking.map((t, i) => <li key={t.teamId} className={t.teamId === team?.id ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis"><span data-ugc>{t.emblem}</span> {t.name}</span><b>{t.totalSec != null ? fmtSecs(t.totalSec) : `${t.legs}/4 ayak`}</b></li>)}</ol>
        )}
      </div>
      {r.history.length > 0 && <div className="card"><b>Bayrağı taşıyanlar</b><ul className="ev-feed">{r.history.map((h, i) => <li key={i}><span className="grow ellipsis"><Art e="🚩" size="1.15em" className="art-inline" /> {h.name} · {h.leg + 1}. ayak</span><b>{fmtSecs(h.timeSec)}</b></li>)}</ul></div>}
      <div className="card ev-rw-grid"><b>Hafta sonu ödülleri (ayak koşan herkese)</b><Rewards items={r.rewards.finish} label="🏁 Parkuru bitiren takım" />{r.rewards.podium.map((p, i) => <Rewards key={i} items={p} label={`${['🥇', '🥈', '🥉'][i]} ${i + 1}. takım ek`} />)}</div>
      {passOpen && (
        <Sheet title="Bayrağı kime devredelim?" onClose={() => setPassOpen(false)}>
          <div className="muted small-note">Seçtiğin takım arkadaşına "Bayrak sende!" bildirimi gider.</div>
          {others.map((m) => (
            <button key={m.id} className="ev-pass" data-testid={`bayrak-devret-${m.name}`} disabled={busy} onClick={() => void pass(m.id)}>
              <OdiAvatar color={m.color} hat={m.hat} size={36} /><b className="grow ellipsis">{m.name}</b><span className={`ev-dot${m.online ? ' on' : ''}`} aria-label={m.online ? 'çevrimiçi' : 'çevrimdışı'} /><span><Art e="🚩" size="1.15em" className="art-inline" /></span>
            </button>
          ))}
          {others.length === 0 && <div className="muted">Takımında başka üye yok.</div>}
        </Sheet>
      )}
      <div className="muted small-note">Her ayak sırayla ve farklı bir üyeyle koşulur; bayrak alındıktan sonra koşulmazsa süre bitince serbest kalır.</div>
    </div>
  );
}
