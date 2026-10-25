import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import {
  TEAM_LEAGUE_RULES, TEAM_LEAGUE_TIERS, TEAM_RACE_REACTIONS, TEAM_RACE_RULES as R, type RaceRoom, type RunResult, type TeamLeagueTier, type TeamRaceLobby,
  type TeamRaceResult, type TeamRaceSideId, type TeamRaceSize, type TeamSummary,
} from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { useNav } from '../nav';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Art } from '../ui/art';
import { Sheet, Skeleton, fmtLeft, fmtNum, useNow } from '../ui/social';
import { hatKey } from '../screens/team/TeamMembers';
import { levelName } from '../race/common';
import { refreshLeague, refreshTeamRace, trNet, useTeamRace } from './state';
import '../race/race.css'; // race-big / race-dots / race-live / race-actions: yarış ekranları açılmadan da stilli (YN-026)
import './teamrace.css';

/**
 * Takım › Takım Yarışı: lobi (katıl, Hazırım), lider/yardımcı için rakip ara / dostluk daveti / lobiyi kapat, gelen davetler,
 * son sonuçlar (rövanş). Rakip yoksa bunu açıkça söyler (sahte takım yok). docs/16-takim-rekabeti.md
 */
export function TeamRaceView() {
  const s = useTeamRace((x) => x.state);
  const me = useNet((x) => x.me);
  const status = useNet((x) => x.status);
  const [info, setInfo] = useState(false);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (status === 'bağlı') void refreshTeamRace(); }, [status]);
  if (!s) return <Skeleton rows={3} />;
  const l = s.lobby; const mine = !!l && l.members.some((m) => m.id === me?.id);
  const meReady = !!l?.members.find((m) => m.id === me?.id)?.ready;
  const run = async (f: () => Promise<unknown>) => { setBusy(true); try { await f(); } finally { setBusy(false); void refreshTeamRace(); } };
  const live = s.live;
  return (
    <div className="tyar" data-testid="takim-yarisi" data-status={l?.status ?? 'yok'}>
      <div className="card tr-hero">
        <span className="tr-hero-ic"><Art name="finish" size={34} /></span>
        <span className="grow min0"><b>Canlı Takım Yarışı</b><small>İki takım aynı bölümü aynı anda koşar. Bitiş sırası ve yıldızlar takım puanına eklenir.</small></span>
        <button type="button" className="ibtn sm" aria-label="Takım Yarışı kuralları" onClick={() => setInfo(true)}><Art name="question" size={18} /></button>
      </div>
      {live && (
        <div className="card tr-live" data-testid="tr-suruyor">
          <b>Yarış sürüyor: {live.team?.a.emblem} {live.team?.a.name} – {live.team?.b.name} {live.team?.b.emblem}</b>
          <small className="muted">{live.level}. bölüm · sonuç bitince burada ve takım sohbetinde.</small>
        </div>
      )}
      {!l && !live && (
        s.canLead ? (
          <div className="tr-open">
            <div className="muted small-note">Lobi aç; üyeler katılıp “Hazırım” desin, sonra rakip arayın.</div>
            <div className="row">
              {R.sizes.map((n) => <button key={n} className="btn grow" data-testid={`tr-ac-${n}`} disabled={busy} onClick={() => void run(() => act('trace.open', { size: n }))}><Art name="users" size={20} className="art-inline" /> {n}’e {n} lobi aç</button>)}
            </div>
          </div>
        ) : <div className="card tr-empty"><Art name="flag" size={40} /><b>Açık lobi yok</b><small className="muted">Lider ya da yardımcı bir Takım Yarışı lobisi açınca buradan katılırsın.</small></div>
      )}
      {l && <LobbyCard l={l} meId={me?.id ?? ''} mine={mine} meReady={meReady} canLead={s.canLead} busy={busy} run={run} onPick={() => setPick(true)} searching={s.searching} />}
      {s.recent.length > 0 && (
        <div className="tr-recent">
          <h3>Son yarışlar</h3>
          {s.recent.map((r) => <ResultRow key={r.matchId} r={r} teamId={me?.teamId ?? ''} canLead={s.canLead} />)}
        </div>
      )}
      {pick && <ChallengeSheet onClose={() => setPick(false)} myTeam={me?.teamId ?? ''} />}
      {info && <RulesSheet onClose={() => setInfo(false)} />}
    </div>
  );
}

function LobbyCard({ l, meId, mine, meReady, canLead, busy, run, onPick, searching }: { l: TeamRaceLobby; meId: string; mine: boolean; meReady: boolean; canLead: boolean; busy: boolean; run: (f: () => Promise<unknown>) => Promise<void>; onPick: () => void; searching: number }) {
  const now = useNow(1000);
  const ready = l.members.filter((m) => m.ready && m.online).length;
  const slots = Math.max(l.size, l.members.length);
  const label = l.status === 'ariyor' ? 'Rakip aranıyor' : l.status === 'eslesti' ? 'Eşleşti' : 'Toplanıyor';
  return (
    <div className="card tr-lobby" data-testid="tr-lobi">
      <div className="row between"><b>{l.size}’e {l.size} lobi</b><span className={`pill tr-st ${l.status}`} data-testid="tr-durum">{l.status === 'ariyor' && <i className="tr-pulse" aria-hidden />}{label}</span></div>
      <div className="tr-slots">
        {Array.from({ length: slots }, (_, i) => l.members[i]).map((m, i) => m ? (
          <span key={m.id} className={`tr-slot${m.ready ? ' ready' : ''}${m.online ? '' : ' off'}${m.id === meId ? ' me' : ''}`} data-testid="tr-uye" data-ready={m.ready ? '1' : '0'}>
            <OdiAvatar size={44} color={m.color} hat={hatKey(m.hat)} /><b className="ellipsis">{m.name}</b><small>{m.ready ? 'Hazır' : m.online ? 'Bekliyor' : 'Çevrimdışı'}</small>
          </span>
        ) : <span key={`e${i}`} className="tr-slot empty"><span className="tr-plus">+</span><small>Boş</small></span>)}
      </div>
      <div className="muted small-note">{ready} hazır · en az {R.minPlayers} hazır üyeyle aranır; az kişiyle de yarışılır (denge çarpanı).</div>
      {l.note && <div className="tr-note" role="status" data-testid="tr-not">{l.note}</div>}
      {l.status === 'ariyor' && l.searchingSince != null && <div className="muted small-note">Arama süresi {fmtLeft(Math.max(0, now - l.searchingSince))} · şu an {searching} başka takım arıyor</div>}
      {l.incoming.map((c) => (
        <div key={c.teamId} className="tr-inv" data-testid="tr-davet">
          <span data-ugc className="tr-emb">{c.emblem}</span><span className="grow min0"><b className="ellipsis">{c.name}</b><small>{c.size}’e {c.size} dostluk daveti · {fmtLeft(c.until - now)}</small></span>
          {canLead && <><button className="btn small" disabled={busy} data-testid="tr-kabul" onClick={() => void run(() => act('trace.accept', { teamId: c.teamId }))}>Kabul</button><button className="btn small ghost" disabled={busy} onClick={() => void run(() => act('trace.decline', { teamId: c.teamId }))}>Sonra</button></>}
        </div>
      ))}
      {l.outgoing && <div className="tr-inv out"><span data-ugc className="tr-emb">{l.outgoing.emblem}</span><span className="grow min0"><b className="ellipsis">{l.outgoing.name}</b><small>davet gönderildi · {fmtLeft(l.outgoing.until - now)}</small></span></div>}
      {l.status !== 'eslesti' && (
        <div className="tr-actions">
          {!mine
            ? <button className="btn" data-testid="tr-katil" disabled={busy} onClick={() => void run(() => act('trace.join', {}))}>Lobiye katıl</button>
            : <button className={`btn${meReady ? ' ghost' : ''}`} data-testid="tr-hazir" disabled={busy} onClick={() => { platform().haptic('light'); void run(() => act('trace.ready', { ready: !meReady })); }}>{meReady ? 'Hazır değilim' : 'Hazırım'}</button>}
          {canLead && (l.status === 'ariyor'
            ? <button className="btn ghost" data-testid="tr-ara-dur" disabled={busy} onClick={() => void run(() => act('trace.search', { on: false }))}>Aramayı durdur</button>
            : <button className="btn coral" data-testid="tr-ara" disabled={busy || ready < R.minPlayers} onClick={() => void run(() => act('trace.search', { on: true }))}><Art name="search" size={18} className="art-inline" /> Rakip ara</button>)}
          {canLead && <button className="btn ghost" data-testid="tr-meydan" disabled={busy} onClick={onPick}><Art name="swords" size={18} className="art-inline" /> Takıma meydan oku</button>}
          <div className="row">
            {mine && <button className="linkish" onClick={() => void run(() => act('trace.leave', {}))}>Lobiden ayrıl</button>}
            {canLead && <button className="linkish" onClick={() => void run(() => act('trace.close', {}))}>Lobiyi kapat</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ r, teamId, canLead }: { r: TeamRaceResult; teamId: string; canLead: boolean }) {
  const us: TeamRaceSideId = r.a.teamId === teamId ? 'a' : 'b'; const U = r[us]; const T = r[us === 'a' ? 'b' : 'a'];
  const o = r.winner == null ? 'draw' : r.winner === us ? 'win' : 'lose';
  const [busy, setBusy] = useState(false);
  return (
    <div className={`tr-res ${o}`} data-testid="tr-sonuc">
      <span className="tr-res-o">{o === 'win' ? 'Kazandık' : o === 'draw' ? 'Berabere' : 'Kaybettik'}</span>
      <span className="grow min0"><b className="ellipsis">{U.score} – {T.score} · <span data-ugc>{T.emblem}</span> {T.name}</b><small className="muted">{r.level}. {levelName(r.level)}{r.friendly ? ' · dostluk' : ''}{r.counted ? '' : ' · lige sayılmadı'}</small></span>
      {canLead && <button className="btn small ghost" disabled={busy} data-testid="tr-rovans" onClick={async () => { setBusy(true); const x = await act('trace.rematch', { matchId: r.matchId }); setBusy(false); if (x) toast('🔁', 'Rövanş daveti gönderildi', `${T.name} kabul edince başlar.`, 'green'); void refreshTeamRace(); }}>Rövanş</button>}
    </div>
  );
}

function ChallengeSheet({ onClose, myTeam }: { onClose: () => void; myTeam: string }) {
  const [q, setQ] = useState(''); const [teams, setTeams] = useState<TeamSummary[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    const c = getNet(); if (!c) return; let alive = true;
    const h = setTimeout(() => { c.call('team.list', q.trim() ? { query: q.trim() } : {}).then((r) => { if (alive) { setTeams(r.teams.filter((t) => t.id !== myTeam)); setErr(''); } }, (e) => alive && setErr(errText(e))); }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(h); };
  }, [q]);
  return (
    <Sheet title="Takıma meydan oku" onClose={onClose}>
      <div className="muted small-note">Dostluk daveti 10 dakika geçerli; karşı takımın lideri ya da yardımcısı kabul edince başlar.</div>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Takım adı ara" aria-label="Takım ara" maxLength={30} />
      {err && <div className="chat-err">{err}</div>}
      <div className="tr-pick" data-testid="tr-takimlar">
        {!teams ? <Skeleton rows={3} /> : teams.length === 0 ? <div className="muted">Takım bulunamadı.</div> : teams.slice(0, 20).map((t) => (
          <button key={t.id} className="tr-pick-row" data-testid="tr-takim" data-name={t.name} onClick={async () => { const r = await act('trace.challenge', { teamId: t.id }); if (r) { toast('📨', `${t.name} takımına davet gönderildi`, undefined, 'green'); onClose(); void refreshTeamRace(); } }}>
            <span data-ugc className="tr-emb">{t.emblem}</span><span className="grow min0"><b className="ellipsis">{t.name}</b><small>{t.members} üye</small></span><Art name="swords" size={20} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Takım Yarışı nasıl puanlanır?" onClose={onClose}>
      <ul className="rules">
        <li><Art name="finish" size={18} /> <span>Genel bitiş sırasına göre: {R.placePoints.map((p, i) => `${i + 1}. ${p}`).join(', ')}{'; sonrakiler 1'}. Her yıldız +{R.starPoints}. Bitiremeyen 0.</span></li>
        <li><Art name="users" size={18} /> <span>Takım puanı üyelerin puan toplamı. Az kişili takımın toplamı denge çarpanıyla büyür (ör. 3’e 2: ×1,5).</span></li>
        <li><Art name="search" size={18} /> <span>Benzer güçte takım aranır; pencere 20 saniyede bir genişler. Arayan takım yoksa bunu açıkça söyleriz; dostluk daveti gönderebilirsin.</span></li>
        <li><Art name="crystal" size={18} /> <span>Kazanan: {R.rewards.win.jeton} jeton + {R.rewards.win.kristal} kristal; berabere {R.rewards.draw.jeton} jeton; kaybedende bitirenlere {R.rewards.lose.jeton} jeton (günde {R.rewardRacesPerDay} ödüllü yarış). Takım Ligi: kazanma {R.league.win}, beraberlik {R.league.draw}, kayıp {R.league.lose} puan.</span></li>
        <li><Art name="signal" size={18} /> <span>Bağlantın koparsa {Math.round(R.graceMs / 1000)} sn içinde dönmezsen bitiremedi sayılırsın. Zaman ve sonuç sunucuda tutulur.</span></li>
      </ul>
      <button className="btn" onClick={onClose}>Anladım</button>
    </Sheet>
  );
}

// ------------------------------------------------------------------ yarış içi: takım puan şeridi + tepkiler
const SIDE_COLOR = { us: 0x2ee6d6, them: 0xff5c8a } as const;
/** hayalet görünümü: kendi takımım turkuaz, rakip pembe; adın başında takım amblemi */
export function teamGhost(room: RaceRoom, meId: string, p: { id: string; name: string; color: number; hat: string; side?: TeamRaceSideId }) {
  if (!room.team || !p.side) return { id: p.id, name: p.name, color: p.color, hat: p.hat };
  const mySide = room.players.find((x) => x.id === meId)?.side;
  return { id: p.id, name: `${room.team[p.side].emblem} ${p.name}`, color: p.side === mySide ? SIDE_COLOR.us : SIDE_COLOR.them, hat: p.hat };
}

export function TeamRaceHud({ room }: { room: RaceRoom }) {
  const meId = useNet((x) => x.me?.id ?? '');
  const reactions = useTeamRace((x) => x.reactions);
  const [r, setR] = useState(room);
  const [pct, setPct] = useState<Record<string, number>>({});
  useEffect(() => {
    const c = trNet(); if (!c) return;
    const offs = [c.on('race.updated', ({ room: x }) => { if (x.id === room.id) setR(x); }), c.on('race.pos', (p) => setPct((m) => ({ ...m, [p.id]: p.pct })))];
    return () => { for (const o of offs) o(); };
  }, [room.id]);
  if (!r.team) return null;
  const mySide = r.players.find((p) => p.id === meId)?.side ?? 'a';
  const other: TeamRaceSideId = mySide === 'a' ? 'b' : 'a';
  // canlı (geçici) puan: bitirenlerin sıra puanı × denge çarpanı (yıldızlar sonuçta eklenir)
  const live = (k: TeamRaceSideId) => Math.round(r.players.filter((p) => p.side === k && p.place != null).reduce((a, p) => a + (R.placePoints[p.place! - 1] ?? 1), 0) * r.team![k].mult);
  const prog = (k: TeamRaceSideId) => { const ps = r.players.filter((p) => p.side === k && !p.left); return ps.length ? ps.reduce((a, p) => a + (p.place != null ? 1 : Math.max(p.pct, pct[p.id] ?? 0)), 0) / ps.length : 0; };
  const U = r.team[mySide]; const T = r.team[other];
  return (
    <div className="tr-hud" data-testid="tr-hud" aria-live="polite">
      <div className="tr-bar">
        <span className="tr-side us"><span data-ugc>{U.emblem}</span><b>{live(mySide)}</b></span>
        <span className="tr-track" aria-label={`İlerleme: biz %${Math.round(prog(mySide) * 100)}, rakip %${Math.round(prog(other) * 100)}`}>
          <i className="us" style={{ width: `${Math.round(prog(mySide) * 50)}%` }} /><i className="them" style={{ width: `${Math.round(prog(other) * 50)}%` }} />
        </span>
        <span className="tr-side them"><b>{live(other)}</b><span data-ugc>{T.emblem}</span></span>
      </div>
      <div className="tr-reacts" role="group" aria-label="Takım arkadaşlarına tepki">
        {TEAM_RACE_REACTIONS.map((e) => <button key={e} type="button" onClick={() => { platform().haptic('light'); void trNet()?.call('trace.react', { emoji: e }).catch(() => undefined); }} aria-label={`Tepki ${e}`}>{e}</button>)}
      </div>
      <div className="tr-floats">{reactions.map((x) => <span key={x.id} className="tr-float"><b>{x.emoji}</b> {x.name}</span>)}</div>
    </div>
  );
}

// ------------------------------------------------------------------ sonuç ekranı
export function TeamRaceResultScreen({ room, result: run }: { room: RaceRoom; result?: RunResult }) {
  const nav = useNav();
  const meId = useNet((x) => x.me?.id ?? '');
  const res = useTeamRace((x) => (room.team ? x.results[room.team.matchId] ?? null : null));
  const canLead = useTeamRace((x) => x.state?.canLead ?? false);
  useEffect(() => {
    if (res || !room.team) return;
    const c = trNet(); if (!c) return;
    // sonuç, son bitirenin yıldızı gelince (en geç 15 sn) yazılır: arada bir sor
    const ask = () => c.call('trace.result', { matchId: room.team!.matchId }).then((x) => { if (x.result) useTeamRace.setState((s) => ({ results: { ...s.results, [x.result!.matchId]: x.result! } })); }, () => undefined);
    void ask(); const h = setInterval(ask, 3000);
    return () => clearInterval(h);
  }, [res, room.team?.matchId]);
  if (!room.team) return null;
  const mySide: TeamRaceSideId = room.players.find((p) => p.id === meId)?.side ?? 'a';
  const other: TeamRaceSideId = mySide === 'a' ? 'b' : 'a';
  const o = res ? (res.winner == null ? 'draw' : res.winner === mySide ? 'win' : 'lose') : null;
  return (
    <div className="screen fade-in tr-result" data-testid="tr-sonuc-ekrani" data-outcome={o ?? 'bekliyor'}>
      <div className="tr-result-top">
        <div className="muted small-note">{room.level}. {levelName(room.level)} · Takım Yarışı{room.team.friendly ? ' · dostluk' : ''}</div>
        <h1>{o === 'win' ? 'Kazandınız!' : o === 'draw' ? 'Berabere!' : o === 'lose' ? 'Bu sefer olmadı' : 'Sonuç hesaplanıyor…'}</h1>
        {run && <div className="muted">{run.completed ? `Bitirdin · ${run.stars} yıldız` : 'Bitiremedin'}</div>}
      </div>
      <div className="tr-score card">
        <span className="tr-ts us"><span data-ugc className="tr-emb big">{room.team[mySide].emblem}</span><b className="ellipsis">{room.team[mySide].name}</b><strong data-testid="tr-skor-biz">{res ? res[mySide].score : '…'}</strong>{room.team[mySide].mult !== 1 && <small>×{room.team[mySide].mult.toLocaleString('tr-TR')}</small>}</span>
        <span className="tr-vs">–</span>
        <span className="tr-ts them"><span data-ugc className="tr-emb big">{room.team[other].emblem}</span><b className="ellipsis">{room.team[other].name}</b><strong data-testid="tr-skor-rakip">{res ? res[other].score : '…'}</strong>{room.team[other].mult !== 1 && <small>×{room.team[other].mult.toLocaleString('tr-TR')}</small>}</span>
      </div>
      {!res ? <div className="muted race-live"><span className="race-dots" aria-hidden><i /><i /><i /></span> Herkesin yıldızı geliyor…</div> : (
        <>
          <ol className="tr-rows" aria-label="Bireysel puanlar">
            {res.rows.map((p) => (
              <li key={p.id} className={`tr-row ${p.side === mySide ? 'us' : 'them'}${p.id === meId ? ' me' : ''}`} data-testid="tr-satir" data-name={p.name}>
                <b className="tr-place">{p.place ?? '–'}</b><OdiAvatar size={34} color={p.color} hat={hatKey(p.hat)} />
                <span className="grow min0"><b className="ellipsis">{p.name}{p.id === meId ? ' (sen)' : ''}</b><small className="muted">{p.place != null ? `${p.timeSec?.toLocaleString('tr-TR') ?? '–'} sn · ${p.stars} yıldız` : p.left ? 'Ayrıldı' : 'Bitiremedi'}</small></span>
                <b className="tr-pts">+{p.points}</b>
              </li>
            ))}
          </ol>
          <div className="muted small-note">{res.counted ? `Takım Ligi: ${o === 'win' ? `+${R.league.win}` : o === 'draw' ? `+${R.league.draw}` : `+${R.league.lose}`} puan. Ödüller ödül kutusunda.` : 'Bu yarış lige ve ödüle sayılmadı (günlük sınır ya da bitiren yok).'}</div>
        </>
      )}
      <div className="race-actions">
        {res && canLead && <button className="btn race-big" data-testid="tr-rovans-sonuc" onClick={async () => { const x = await act('trace.rematch', { matchId: res.matchId }); if (x) { toast('🔁', 'Rövanş daveti gönderildi', undefined, 'green'); nav.tab('team'); } }}><Art name="refresh" size={20} className="art-inline" /> Rövanş</button>}
        <button className="btn ghost" data-testid="tr-takima-don" onClick={() => nav.tab('team')}>Takıma dön</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Takım Ligi
const tierDef = (t: TeamLeagueTier) => TEAM_LEAGUE_TIERS.find((x) => x.id === t)!;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
export function TierEmblem({ emblem, tier, size = 44 }: { emblem: string; tier: TeamLeagueTier; size?: number }) {
  return <span className="tl-emb" data-tier={tier} style={{ width: size, height: size, fontSize: Math.round(size * 0.55), borderColor: hex(tierDef(tier).color), boxShadow: `0 0 12px ${hex(tierDef(tier).color)}55` }} data-ugc>{emblem}</span>;
}

export function TeamLeagueView() {
  const s = useTeamRace((x) => x.league);
  const team = useNet((x) => x.team);
  const status = useNet((x) => x.status);
  const now = useNow(60_000);
  const [info, setInfo] = useState(false);
  useEffect(() => { if (status === 'bağlı') void refreshLeague(); }, [status]);
  if (!s) return <Skeleton rows={4} />;
  const t = tierDef(s.tier); const n = s.rows.length;
  const S = TEAM_LEAGUE_RULES.sources;
  return (
    <div className="tlig" data-testid="takim-ligi" data-tier={s.tier}>
      <div className="card tl-head">
        <TierEmblem emblem={team?.emblem ?? '🛡️'} tier={s.tier} size={56} />
        <span className="grow min0"><b>{t.name} kademesi · {s.season.no}. sezon</b><small>{fmtLeft(s.season.endsAt - now)} kaldı · grupta {n} takım{s.badge ? ` · geçen sezon ${s.badge.rank}. 🏅` : ''}</small></span>
        <button type="button" className="ibtn sm" aria-label="Takım Ligi kuralları" onClick={() => setInfo(true)}><Art name="question" size={18} /></button>
      </div>
      <ol className="tl-rows" aria-label="Grup sıralaması">
        {s.rows.map((r, i) => {
          const zone = i < s.promoteTop && r.points > 0 ? 'up' : i >= n - s.demoteBottom && i >= s.promoteTop ? 'down' : '';
          return (
            <li key={r.teamId} className={`tl-row ${zone}${r.me ? ' me' : ''}`} data-testid="tl-satir" data-rank={r.rank}>
              <b className="tl-rank">{r.rank}</b><span data-ugc className="tr-emb">{r.emblem}</span>
              <span className="grow min0 ellipsis"><b>{r.name}{r.me ? ' (biz)' : ''}</b></span>
              {zone && <span className={`tl-zone ${zone}`} aria-label={zone === 'up' ? 'yükselme bölgesi' : 'düşme bölgesi'}><Art name={zone === 'up' ? 'up' : 'down'} size={14} /></span>}
              <b className="tl-pts">{fmtNum(r.points)}</b>
            </li>
          );
        })}
      </ol>
      <div className="muted small-note">İlk {s.promoteTop || '–'} takım bir üst kademeye çıkar{s.demoteBottom ? `, son ${s.demoteBottom} takım bir alta iner` : ''}. Sezon sonunda puanı olan takımların her üyesine kristal.</div>
      <div className="card tl-mine" data-testid="tl-puanlarimiz">
        <b>Puanlarımız: {fmtNum(s.mine.total)}</b>
        {([['war', 'swords'], ['raid', 'monster'], ['quiz', 'bulb'], ['duel', 'shield'], ['race', 'finish']] as const).map(([k, a]) => (
          <div key={k} className="tl-src"><Art name={a} size={20} /><span className="grow min0"><b>{S[k].label}</b><small>{S[k].desc}</small></span><b>{fmtNum(s.mine[k])}</b></div>
        ))}
      </div>
      {s.history.length > 0 && (
        <div className="tl-hist">
          <h3>Geçmiş sezonlar</h3>
          {s.history.map((h) => <div key={h.season} className="tl-h"><TierEmblem emblem={team?.emblem ?? '🛡️'} tier={h.tier} size={30} /><span className="grow">{h.no}. sezon · {tierDef(h.tier).name} · {h.groupSize} takımda {h.rank}.</span><small>{h.outcome === 'yukseldi' ? 'Yükseldi' : h.outcome === 'dustu' ? 'Düştü' : 'Kaldı'}</small></div>)}
        </div>
      )}
      {info && (
        <Sheet title="Takım Ligi nasıl işler?" onClose={() => setInfo(false)}>
          <ul className="rules">
            <li><Art name="calendar" size={18} /> <span>Sezon {TEAM_LEAGUE_RULES.seasonWeeks} hafta (Pazartesi 00:00, İstanbul). Kademeler: {TEAM_LEAGUE_TIERS.map((x) => x.name).join(' → ')}. Grupta en çok {TEAM_LEAGUE_RULES.groupSize} takım.</span></li>
            {(['war', 'raid', 'quiz', 'duel', 'race'] as const).map((k) => <li key={k}><Art name="check" size={18} /> <span><b>{S[k].label}:</b> {S[k].desc}.</span></li>)}
            <li><Art name="up" size={18} /> <span>Sezon sonunda ilk {TEAM_LEAGUE_RULES.promote} yükselir, son {TEAM_LEAGUE_RULES.demote} düşer (küçük gruplarda üçte biri). Puanı 0 olan yükselmez.</span></li>
            <li><Art name="crystal" size={18} /> <span>Ödül (üye başına, bir kez): kademe tabanı ({Object.entries(TEAM_LEAGUE_RULES.rewardBase).map(([k, v]) => `${tierDef(k as TeamLeagueTier).name} ${v}`).join(', ')}) × 1. 3, 2. 2, 3. 1,5, diğer puanlı takımlar 1 kristal.</span></li>
          </ul>
          <button className="btn" onClick={() => setInfo(false)}>Anladım</button>
        </Sheet>
      )}
    </div>
  );
}

export type { TeamRaceSize };
