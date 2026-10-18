import { useEffect, useState } from 'react';
import type { RaceRoom, RunResult } from '@odi/shared';
import { leaguePointsFor } from '@odi/shared';
import { OdiAvatar } from '../ui/OdiAvatar';
import { platform } from '../platform';
import { errText } from '../net';
import { fmtSec, levelName, placeMedal, raceBonus, raceTimeSec, standings, useRaceNet } from './common';
import { useRaceInvites } from './useRaceInvites';
import './race.css';

/**
 * Yarış sonucu: sunucunun odası tek doğru kaynaktır (her istemcide aynı sıra). Diğerleri bitirene kadar canlı güncellenir.
 * "Rövanş": aynı bölümde yeni oda + odadaki herkese davet → onRematch(yeniOdaId). "Lobiye dön": onLobby().
 */
export function RaceResult({ room: initial, result, onRematch, onLobby }: { room: RaceRoom; result?: RunResult; onRematch: (roomId: string) => void; onLobby: () => void }) {
  const { net, meId } = useRaceNet();
  const [room, setRoom] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { invite, accept, dismiss } = useRaceInvites();
  useEffect(() => { setRoom(initial); }, [initial]);
  useEffect(() => {
    if (!net) return;
    return net.on('race.updated', ({ room: r }) => { if (r.id === initial.id) setRoom(r); });
  }, [net, initial.id]);
  const done = room.status === 'bitti';
  useEffect(() => { if (done) platform().haptic('success'); }, [done]);

  const order = standings(room);
  const me = room.players.find((p) => p.id === meId);
  const myPlace = me?.place ?? null;
  const headline = myPlace === 1 ? '🏆 Birinci oldun!' : myPlace === 2 ? '🥈 İkinci oldun!' : myPlace === 3 ? '🥉 Üçüncü oldun!' : myPlace != null ? `${myPlace}. oldun!` : result && !result.completed ? 'Bu sefer olmadı' : 'Yarış bitti';
  const myLeague = result ? leaguePointsFor({ completed: result.completed, stars: result.stars }, myPlace) : null;
  const rivals = room.players.filter((p) => p.id !== meId);
  const rematchInvite = invite && invite.room.id !== room.id && rivals.some((p) => p.id === invite.from.id) ? invite : null;

  const rematch = async () => {
    if (!net) return;
    setBusy(true); setErr(null);
    try {
      const r = (await net.call('race.create', { level: room.level })).room;
      // rakiplere davet (çevrimdışı/ayrılmış olanlar sessizce atlanır)
      await Promise.all(rivals.map((p) => net.call('race.invite', { friendId: p.id }).catch(() => undefined)));
      onRematch(r.id);
    } catch (e) { setErr(errText(e)); setBusy(false); }
  };

  return (
    <div className="screen fade-in race-screen race-result" data-testid="yaris-sonuc" data-status={room.status}>
      <div className="race-result-top">
        <div className="muted small-note">{room.level}. {levelName(room.level)} · canlı yarış</div>
        <h1>{done ? headline : me?.finishedAt != null ? 'Bitirdin!' : 'Yarış sürüyor'}</h1>
        {!done && <div className="muted race-live"><span className="race-dots" aria-hidden><i /><i /><i /></span> Diğerleri bitiriyor…</div>}
      </div>
      {err && <div className="race-error" role="alert">{err}</div>}
      <ol className="race-standings" aria-label="Sıralama">
        {order.map((p, i) => {
          const t = raceTimeSec(room, p);
          const status = p.place != null ? (t != null ? fmtSec(t) : 'Bitirdi') : p.left ? 'Ayrıldı' : p.finishedAt != null ? 'Bitiremedi' : done ? 'Bitiremedi' : `Yarışta · %${Math.round(p.pct * 100)}`;
          return (
            <li key={p.id} className={`race-row${p.id === meId ? ' me' : ''}${p.place === 1 ? ' first' : ''}`} data-testid="yaris-sonuc-sira" data-name={p.name} data-place={p.place ?? ''}>
              <span className="race-rank">{p.place != null ? <>{placeMedal(p.place) || ''}<b>{p.place}.</b></> : <b>{done ? '–' : `${i + 1}`}</b>}</span>
              <OdiAvatar color={p.color} hat={p.hat} size={40} mood={p.place === 1 ? 'wow' : 'happy'} />
              <span className="race-row-main min0">
                <b className="ellipsis">{p.name}{p.id === meId ? ' (sen)' : ''}</b>
                <small className="muted">{status}{p.score != null ? ` · ${p.score.toLocaleString('tr-TR')} puan` : ''}</small>
              </span>
              <span className="race-league" title="Yarış derecesinin lig bonusu">{p.place != null ? `+${raceBonus(p.place)} lig` : ''}</span>
            </li>
          );
        })}
      </ol>
      {done && myLeague != null && (
        <div className="card race-league-card">
          <b>Bu yarıştan {myLeague} lig puanı</b>
          <small className="muted">Bölüm ({result!.completed ? `${5 + result!.stars * 5}` : '1'}) + yarış derecesi ({raceBonus(myPlace)}). Puanı sunucu hesaplar; parayla alınamaz.</small>
        </div>
      )}
      {rematchInvite && (
        <div className="race-invite inline" data-testid="yaris-rovans-daveti">
          <OdiAvatar color={rematchInvite.from.color} hat={rematchInvite.from.hat} size={40} mood="wow" />
          <div className="ri-body min0"><b className="ellipsis">{rematchInvite.from.name} rövanş istiyor!</b></div>
          <button className="btn small" onClick={() => { const id = accept(); if (id) onRematch(id); }}>Katıl</button>
          <button className="btn ghost small" aria-label="Kapat" onClick={dismiss}>✕</button>
        </div>
      )}
      <div className="race-actions">
        <button className="btn race-big" data-testid="yaris-rovans" disabled={busy || !net} onClick={() => void rematch()}>🔁 Rövanş</button>
        <button className="btn ghost" data-testid="yaris-lobiye" onClick={onLobby}>Lobiye dön</button>
      </div>
    </div>
  );
}
