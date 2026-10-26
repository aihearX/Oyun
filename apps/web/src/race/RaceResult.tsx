import { useEffect, useRef, useState } from 'react';
import type { RaceRoom, RunResult } from '@odi/shared';
import { leaguePointsFor } from '@odi/shared';
import { OdiAvatar } from '../ui/OdiAvatar';
import { platform } from '../platform';
import { errText } from '../net';
import { useNet } from '@odi/net/store';
import { fmtSec, levelName, newerRoom, placeMedal, raceBonus, raceTimeSec, standings, useRaceNet } from './common';
import { Art, rich, Glyph } from '../ui/art';
import { RaceChat } from './RaceLobby';
import './race.css';

/**
 * Yarış sonucu: sunucunun odası tek doğru kaynaktır (her istemcide aynı sıra). Diğerleri bitirene kadar canlı güncellenir.
 * "Rövanş": aynı bölümde yeni oda + odadaki herkese davet → onRematch(yeniOdaId). "Lobiye dön": onLobby().
 * Rakibin rövanş daveti uygulamanın genel davet kartıyla (RaceInviteBanner) gelir.
 */
export function RaceResult({ room: initial, result, onRematch, onLobby }: { room: RaceRoom; result?: RunResult; onRematch: (roomId: string) => void; onLobby: () => void }) {
  const { net, meId } = useRaceNet();
  const [local, setRoom] = useState(initial);
  // depo (bindNet) her 'race.updated' olayını tutar: bu ekran açılmadan hemen önce gelen son güncelleme de kaçmaz
  const stored = useNet((s) => s.race);
  const room = newerRoom(local, stored) ?? local;
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  /** oda sunucuda yok (sunucu yeniden başlarken kayboldu ya da süresi doldu): sonuç alınamaz, açık ileti (MK-031) */
  const [lost, setLost] = useState(false);
  const netStatus = useNet((s) => s.status);
  useEffect(() => { setRoom(initial); }, [initial]);
  // açılışta ve her yeniden bağlanışta (kopukken kaçan güncellemeler): yarış bitmediyse odanın son hâlini sor
  const doneRef = useRef(false); doneRef.current = newerRoom(local, stored)?.status === 'bitti';
  useEffect(() => {
    if (!net || netStatus !== 'bağlı' || doneRef.current) return;
    let live = true;
    net.call('race.state', { roomId: initial.id }).then(({ room: r }) => { if (live) { setLost(false); setRoom((cur) => newerRoom(cur, r) ?? r); } }, (e: unknown) => {
      if (live && (e as { code?: string }).code === 'YOK') setLost(true);
    });
    return () => { live = false; };
  }, [net, netStatus, initial.id]);
  useEffect(() => {
    if (!net) return;
    const offs = [
      net.on('race.updated', ({ room: r }) => { if (r.id === initial.id) setRoom((cur) => newerRoom(cur, r) ?? r); }),
      // hâlâ koşanların canlı ilerlemesi (konum akışından)
      net.on('race.pos', (p) => setLive((m) => (m[p.id] === p.pct ? m : { ...m, [p.id]: p.pct }))),
    ];
    return () => { for (const o of offs) o(); };
  }, [net, initial.id]);
  const done = room.status === 'bitti';
  const closed = lost && !done;
  useEffect(() => { if (done) platform().haptic('success'); }, [done]);

  const order = standings(room);
  const me = room.players.find((p) => p.id === meId);
  const myPlace = me?.place ?? null;
  const headline = closed ? 'Yarış kapandı' : myPlace === 1 ? '🏆 Birinci oldun!' : myPlace === 2 ? '🥈 İkinci oldun!' : myPlace === 3 ? '🥉 Üçüncü oldun!' : myPlace != null ? `${myPlace}. oldun!` : result && !result.completed ? 'Bu sefer olmadı' : 'Yarış bitti';
  const myLeague = result ? leaguePointsFor({ completed: result.completed, stars: result.stars }, myPlace) : null;
  const rivals = room.players.filter((p) => p.id !== meId);

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
    <div className="screen fade-in race-screen race-result" data-testid="yaris-sonuc" data-status={closed ? 'kapandi' : room.status}>
      <div className="race-result-top">
        <div className="muted small-note">{room.level}. {levelName(room.level)} · canlı yarış</div>
        <h1>{done || closed ? rich(headline) : me?.finishedAt != null ? 'Bitirdin!' : 'Yarış sürüyor'}</h1>
        {!done && !closed && <div className="muted race-live"><span className="race-dots" aria-hidden><i /><i /><i /></span> Diğerleri bitiriyor…</div>}
      </div>
      {closed && <div className="race-error" role="alert" data-testid="yaris-kapandi">Bağlantı koptuğu sırada yarış odası kapandı (sunucu yeniden başlamış olabilir); bu yarışın sıralaması alınamadı. Yeni bir yarışa girebilirsin.</div>}
      {err && <div className="race-error" role="alert">{err}</div>}
      <ol className="race-standings" aria-label="Sıralama">
        {order.map((p, i) => {
          const t = raceTimeSec(room, p);
          const status = p.place != null ? (t != null ? fmtSec(t) : 'Bitirdi') : p.left ? 'Ayrıldı' : p.finishedAt != null ? 'Bitiremedi' : done ? 'Bitiremedi' : closed ? '—' : `Yarışta · %${Math.round(Math.max(p.pct, live[p.id] ?? 0) * 100)}`;
          return (
            <li key={p.id} className={`race-row${p.id === meId ? ' me' : ''}${p.place === 1 ? ' first' : ''}`} data-testid="yaris-sonuc-sira" data-name={p.name} data-place={p.place ?? ''}>
              <span className="race-rank">{p.place != null ? <>{placeMedal(p.place) ? <Glyph e={placeMedal(p.place)} size={20} /> : null}<b>{p.place}.</b></> : <b>{done ? '–' : `${i + 1}`}</b>}</span>
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
      {/* yarış sonrası tek dokunuş: "İyi yarıştı!" (yalnızca bu odadakiler görür) */}
      <RaceChat roomId={room.id} meId={meId} compact />
      <div className="race-actions">
        <button className="btn race-big" data-testid="yaris-rovans" disabled={busy || !net} onClick={() => void rematch()}><Art e="🔁" size="1.15em" className="art-inline" /> Rövanş</button>
        <button className="btn ghost" data-testid="yaris-lobiye" onClick={onLobby}>Lobiye dön</button>
      </div>
    </div>
  );
}
