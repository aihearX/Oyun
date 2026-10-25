import { openProfile } from '../friends/state';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChatMessage, LevelSpec, PublicProfile, RaceRoom } from '@odi/shared';
import { SOCIAL_LIMITS } from '@odi/shared';
import { HUMAN_JOURNEY } from '@odi/content';
import { useNet } from '@odi/net/store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { platform } from '../platform';
import { errText } from '../net';
import { fmtClock, hexColor, levelName, raceSpec, useRaceNet } from './common';
import { chunkFailed, loadLevelGen } from '../engine';
import './race.css';
import { IconButton } from '../ui/Button';
import { Art } from '../ui/art';
import { PhraseStrip } from '../comm/Cards';
import { Icon } from '../ui/icons';

type View = 'menu' | 'pick' | 'code' | 'room' | 'busy';

/**
 * Canlı yarış lobisi: Hızlı yarış (yalnızca gerçek oyuncular), Oda kur (açık bölümlerden), Kodla katıl, arkadaş daveti,
 * oyuncu kartları + "Hazırım", odaya özel küçük sohbet ('race:<odaId>'). Geri sayım başlayınca onPlay(spec, room).
 */
export function RaceLobby({ onPlay, onClose, inviteRoomId }: { onPlay: (spec: LevelSpec, room: RaceRoom) => void; onClose: () => void; inviteRoomId?: string }) {
  const { net, online, meId } = useRaceNet();
  const me = useNet((s) => s.me);
  const [view, setView] = useState<View>(inviteRoomId ? 'busy' : 'menu');
  const [room, setRoom] = useState<RaceRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const played = useRef<string | null>(null);
  const roomRef = useRef<RaceRoom | null>(null); roomRef.current = room;
  // bölüm üreticisi lobide önden yüklenir: geri sayım başlayınca bölüm beklemeden kurulur
  const alive = useRef(true);
  useEffect(() => { alive.current = true; void loadLevelGen().catch(() => undefined); return () => { alive.current = false; }; }, []);

  const enter = (r: RaceRoom) => { setRoom(r); setView('room'); setError(null); };
  const run = async (fn: () => Promise<RaceRoom | null>) => {
    if (!net) return;
    setView('busy'); setError(null);
    try { const r = await fn(); if (r) enter(r); else setView('menu'); } catch (e) { setError(errText(e)); setView(roomRef.current ? 'room' : 'menu'); }
  };

  // davetle gelindiyse odaya katıl (zaten odadaysa sunucu aynı odayı döndürür)
  useEffect(() => {
    if (!inviteRoomId || !online || !net) return;
    void run(async () => (await net.call('race.join', { roomId: inviteRoomId })).room);
  }, [inviteRoomId, online]);

  // oda güncellemeleri
  useEffect(() => {
    if (!net) return;
    return net.on('race.updated', ({ room: r }) => {
      const cur = roomRef.current; if (!cur || r.id !== cur.id) return;
      if (r.status === 'bitti' && cur.status === 'lobi') { setRoom(null); setView('menu'); setError('Oda uzun süre başlamadığı için kapandı.'); return; }
      setRoom(r);
    });
  }, [net]);

  // geri sayım başladı → bölüme gir (oyun içinde 3-2-1, herkes aynı anda başlar)
  useEffect(() => {
    if (!room || (room.status !== 'geri-sayim' && room.status !== 'yarista') || played.current === room.id) return;
    if (!room.players.some((p) => p.id === meId && !p.left)) return;
    played.current = room.id;
    platform().haptic('heavy');
    const r = room;
    raceSpec(r).then((spec) => { if (alive.current) onPlay(spec, r); }, (e: unknown) => {
      played.current = null; if (alive.current) setError('Bölüm yüklenemedi; bağlantını kontrol et.');
      try { chunkFailed(e); } catch { /* yenileniyor ya da çevrimdışı */ }
    });
  }, [room?.status, room?.id]);

  const leave = async () => {
    const r = roomRef.current;
    setRoom(null); setView('menu');
    if (r && net) { try { await net.call('race.leave', {}); } catch { /* bağlantı yoksa sunucu kopunca zaten çıkarır */ } }
  };
  const close = () => { if (roomRef.current) void leave(); onClose(); };

  if (!net) return <Shell title="Canlı yarış" onBack={onClose}><div className="card race-empty"><div className="ph-icon" aria-hidden><Art e="📡" size="1.15em" className="art-inline" /></div><h2>Sunucu yok</h2><div className="muted">Canlı yarış için sosyal sunucuya bağlanmak gerekiyor.</div></div></Shell>;
  if (!online) return <Shell title="Canlı yarış" onBack={close}><div className="card race-empty"><div className="ph-icon" aria-hidden><Art e="⏳" size="1.15em" className="art-inline" /></div><h2>Bağlanıyor…</h2><div className="muted">Bağlantı gelince yarış odaları açılır.</div></div></Shell>;

  if (view === 'room' && room) return <RoomView room={room} meId={meId} error={error} onLeave={leave} onBack={close} />;

  return (
    <Shell title="Canlı yarış" onBack={close}>
      {error && <div className="race-error" role="alert">{error}</div>}
      {view === 'busy' && <div className="card race-empty"><div className="ph-icon race-spin" aria-hidden><Art e="🏁" size="1.15em" className="art-inline" /></div><div className="muted">Yarış odası hazırlanıyor…</div></div>}
      {view === 'menu' && (
        <>
          <div className="card race-hero">
            <div className="race-hero-odis" aria-hidden><OdiAvatar color={me?.color ?? 0x6c4cf1} hat={me?.hat} size={56} /><span><Art e="⚡" size="1.15em" className="art-inline" /></span><OdiAvatar color={0x0e9c98} size={44} /><OdiAvatar color={0xf0567a} size={44} /></div>
            <h2>Arkadaşlarınla aynı anda koş!</h2>
            <div className="muted">Herkes aynı bölümü oynar, birbirinizi yarı saydam görürsünüz. Rakiplerin hepsi gerçek oyuncu.</div>
          </div>
          <button className="btn race-big" data-testid="yaris-hizli" onClick={() => void run(async () => (await net.call('race.quick', {})).room)}><Art e="⚡" size="1.15em" className="art-inline" /> Hızlı yarış</button>
          <div className="row">
            <button className="btn ghost grow" data-testid="yaris-oda-kur" onClick={() => setView('pick')}><Art e="🏗️" size="1.15em" className="art-inline" /> Oda kur</button>
            <button className="btn ghost grow" data-testid="yaris-kod-gir" onClick={() => setView('code')}><Art e="🔑" size="1.15em" className="art-inline" /> Kodla katıl</button>
          </div>
          <div className="muted small-note race-note">En çok {SOCIAL_LIMITS.raceMax} oyuncu. Herkes "Hazırım" deyince {Math.round(SOCIAL_LIMITS.raceCountdownMs / 1000)} sn içinde başlar. Derecen haftalık lig puanına eklenir.</div>
        </>
      )}
      {view === 'pick' && (
        <>
          <div className="row between"><h2>Bölüm seç</h2><button className="linkish" onClick={() => setView('menu')}>Vazgeç</button></div>
          <div className="muted">Yalnızca açtığın bölümlerde oda kurabilirsin.</div>
          <div className="race-levels">
            {HUMAN_JOURNEY.levels.filter((l) => l.number <= Math.max(1, me?.highest ?? 1)).map((l) => (
              <button key={l.number} className="race-level" data-testid={`yaris-seviye-${l.number}`} onClick={() => void run(async () => (await net.call('race.create', { level: l.number })).room)}>
                <b>{l.number}</b><small>{l.name}</small>{l.mechanic === 'boss' && <i aria-label="boss"><Art e="👾" size="1.15em" className="art-inline" /></i>}
              </button>
            ))}
          </div>
        </>
      )}
      {view === 'code' && (
        <form className="card race-code-form" onSubmit={(e) => { e.preventDefault(); const id = code.trim(); if (id) void run(async () => (await net.call('race.join', { roomId: id })).room); }}>
          <h2>Oda koduyla katıl</h2>
          <input className="race-input" data-testid="yaris-kod-input" value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''))} placeholder="Oda kodu" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={40} />
          <div className="row"><button type="button" className="btn ghost grow" onClick={() => setView('menu')}>Vazgeç</button><button className="btn grow" data-testid="yaris-kod-katil" disabled={!code.trim()}>Katıl</button></div>
        </form>
      )}
    </Shell>
  );
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="screen fade-in race-screen">
      <div className="screen-head"><IconButton icon="back" label="Geri" onClick={onBack} /><h1>{title}</h1><span /></div>
      {children}
    </div>
  );
}

function RoomView({ room, meId, error, onLeave, onBack }: { room: RaceRoom; meId: string | null; error: string | null; onLeave: () => void; onBack: () => void }) {
  const { net } = useRaceNet();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const players = room.players.filter((p) => !p.left);
  const mine = players.find((p) => p.id === meId);
  const alone = players.length < 2;
  useEffect(() => { if (!alone) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [alone]);
  useEffect(() => { setErr(error); }, [error]);

  const ready = async () => {
    if (!net || !mine) return;
    setBusy(true); setErr(null);
    try { await net.call('race.ready', { ready: !mine.ready }); platform().haptic('light'); } catch (e) { setErr(errText(e)); }
    setBusy(false);
  };
  const share = async () => {
    const r = await platform().share(`ODİ canlı yarışına gel! ${room.level}. bölüm · Oda kodu: ${room.id}`);
    if (r === 'copied') setErr(null);
  };
  const slots = Array.from({ length: Math.max(0, room.max - players.length) });
  const counting = room.status === 'geri-sayim';

  return (
    <div className="screen fade-in race-screen">
      <div className="screen-head"><IconButton icon="back" label="Geri" onClick={onBack} /><h1>Yarış odası</h1><span /></div>
      {err && <div className="race-error" role="alert">{err}</div>}
      <div className="card race-room-head">
        <div className="min0">
          <div className="muted small-note">Bölüm</div>
          <b className="ellipsis">{room.level}. {levelName(room.level)}</b>
        </div>
        <button className="race-code" onClick={() => void share()} data-testid="yaris-kod" data-code={room.id} aria-label={`Oda kodu ${room.id}, paylaş`}>
          <small>Oda kodu</small><code>{room.id}</code>
        </button>
      </div>

      <div className="race-players">
        {players.map((p) => (
          <div key={p.id} className={`race-player${p.ready ? ' ready' : ''}${p.id === meId ? ' me' : ''}`} data-testid="yaris-oyuncu" data-name={p.name} style={{ ['--pc' as string]: hexColor(p.color) }}>
            <OdiAvatar color={p.color} hat={p.hat} size={52} mood={p.ready ? 'wow' : 'happy'} />
            <b className="ellipsis" onClick={() => { if (p.id !== meId) openProfile(p.id); }} role={p.id !== meId ? 'button' : undefined}>{p.name}{p.id === meId ? ' (sen)' : ''}</b>
            <span className={`race-state${p.ready ? ' on' : ''}`}>{p.ready ? 'Hazır ✓' : 'Bekliyor'}</span>
            {p.id === room.hostId && <i className="race-host" aria-label="oda kurucusu"><Art e="👑" size="1.15em" className="art-inline" /></i>}
          </div>
        ))}
        {slots.map((_, i) => <div key={`bos-${i}`} className="race-player empty"><span aria-hidden>＋</span><small>Boş yer</small></div>)}
      </div>

      {alone && (
        <div className="card race-wait" data-testid="yaris-bekleme">
          <div className="race-wait-top"><span className="race-dots" aria-hidden><i /><i /><i /></span><b>Rakip bekleniyor</b><span className="pill">{fmtClock(now - joinedAt)}</span></div>
          <div className="muted small-note">Burada yalnızca gerçek oyuncular yarışır. Biri katılınca "Hazırım" de, yarış başlasın.</div>
          <button className="btn small" data-testid="yaris-bekleme-davet" onClick={() => setInviteOpen(true)}><Art e="👋" size="1.15em" className="art-inline" /> Arkadaşını davet et</button>
        </div>
      )}
      {!alone && !inviteOpen && players.length < room.max && room.status === 'lobi' && <button className="linkish" data-testid="yaris-davet-ac" onClick={() => setInviteOpen(true)}>+ Arkadaşını davet et</button>}
      {inviteOpen && room.status === 'lobi' && <InviteList room={room} onClose={() => setInviteOpen(false)} />}

      <RaceChat roomId={room.id} meId={meId} />

      <div className="race-actions">
        {counting
          ? <div className="race-go" role="status"><Art e="🏁" size="1.15em" className="art-inline" /> Geri sayım başladı!</div>
          : <button className={`btn race-big${mine?.ready ? ' ghost' : ''}`} data-testid="yaris-hazir" disabled={busy || !mine} onClick={() => void ready()}>{mine?.ready ? 'Hazırım ✓ (vazgeç)' : 'Hazırım'}</button>}
        <div className="row between">
          <span className="muted small-note">{alone ? `En az 2 oyuncu gerekli` : `${players.filter((p) => p.ready).length}/${players.length} hazır · herkes hazır olunca başlar`}</span>
          <button className="linkish" onClick={onLeave} data-testid="yaris-ayril">Odadan çık</button>
        </div>
      </div>
    </div>
  );
}

function InviteList({ room, onClose }: { room: RaceRoom; onClose: () => void }) {
  const { net } = useRaceNet();
  const presence = useNet((s) => s.presence);
  const [friends, setFriends] = useState<PublicProfile[] | null>(null);
  const [sent, setSent] = useState<Record<string, 'ok' | string>>({});
  useEffect(() => { if (!net) return; net.call('friends.list', {}).then((r) => setFriends(r.friends), () => setFriends([])); }, [net]);
  const inRoom = new Set(room.players.filter((p) => !p.left).map((p) => p.id));
  const list = (friends ?? []).filter((f) => (presence[f.id] ?? f.online) && !inRoom.has(f.id));
  const invite = async (f: PublicProfile) => {
    if (!net) return;
    try { await net.call('race.invite', { friendId: f.id }); setSent((s) => ({ ...s, [f.id]: 'ok' })); platform().haptic('light'); }
    catch (e) { setSent((s) => ({ ...s, [f.id]: errText(e) })); }
  };
  return (
    <div className="card race-invites" data-testid="yaris-davet-listesi">
      <div className="row between"><b>Çevrimiçi arkadaşlar</b><button className="linkish" onClick={onClose}>Kapat</button></div>
      {friends == null && <div className="muted">Yükleniyor…</div>}
      {friends != null && !list.length && <div className="muted small-note">Şu an çevrimiçi arkadaşın yok. Oda kodunu paylaşarak da çağırabilirsin.</div>}
      {list.map((f) => (
        <div key={f.id} className="race-friend">
          <OdiAvatar color={f.color} hat={f.hat} size={36} />
          <b className="grow ellipsis">{f.name}</b>
          {sent[f.id] === 'ok'
            ? <span className="race-state on">Gönderildi <Icon name="check" size="1.1em" className="ic-inline" /></span>
            : <button className="btn small" data-testid={`yaris-davet-${f.name}`} onClick={() => void invite(f)}>Davet et</button>}
          {sent[f.id] && sent[f.id] !== 'ok' && <small className="race-error-inline">{sent[f.id]}</small>}
        </div>
      ))}
    </div>
  );
}

const QUICK = ['👋', '🔥', '😄', '🏁', '👍'];

/** Odaya özel küçük sohbet: yalnızca bu yarış odasındakiler görür (takım/genel sohbetten ayrı). */
export function RaceChat({ roomId, meId, compact }: { roomId: string; meId: string | null; compact?: boolean }) {
  const { net } = useRaceNet();
  const room = `race:${roomId}`;
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!net) return;
    let live = true;
    const off = net.on('chat', ({ msg }) => { if (msg.room === room) setMsgs((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg].slice(-40))); });
    net.call('chat.join', { room }).then((r) => { if (live) setMsgs((m) => { const ids = new Set(r.history.map((x) => x.id)); return [...r.history, ...m.filter((x) => !ids.has(x.id))].slice(-40); }); }, () => undefined);
    return () => { live = false; off(); void net.call('chat.leave', { room }).catch(() => undefined); };
  }, [net, room]);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length]);
  const send = async (t: string, kind: 'text' | 'emoji' | 'hazir' = 'text') => {
    const clean = t.trim(); if (!clean || !net) return;
    setErr(null);
    try { await net.call('chat.send', { room, text: clean, kind }); if (kind === 'text') setText(''); } catch (e) { setErr(errText(e)); }
  };
  const shown = useMemo(() => msgs.slice(-30), [msgs]);
  return (
    <div className={`card race-chat${compact ? ' compact' : ''}`} data-testid={compact ? 'yaris-sonuc-sohbet' : 'yaris-sohbet'}>
      <div className="race-chat-list" ref={listRef} aria-live="polite">
        {!shown.length && <div className="muted small-note">Rakiplerine bir merhaba de <Art e="👋" size="1.15em" className="art-inline" /></div>}
        {shown.map((m) => (
          <div key={m.id} className={`race-msg${m.from === meId ? ' mine' : ''}${m.kind === 'emoji' ? ' emoji' : ''}`}>
            {m.from !== meId && <b style={{ color: hexColor(m.color), cursor: 'pointer' }} onClick={() => openProfile(m.from)}>{m.name}</b>}<span>{m.text}</span>
          </div>
        ))}
      </div>
      <PhraseStrip ctx={['yaris']} ids={compact ? ['iyi-yaris', 'bir-daha', 'harika', 'az-kaldi', 'tebrik', 'gorusuruz'] : ['selam', 'iyi-sans', 'hazirim', 'harika', 'gorusuruz']} onPick={(id) => void send(id, 'hazir')} label="Yarış sözleri" />
      {!compact && <div className="race-quick">{QUICK.map((e) => <button key={e} className="race-emoji" aria-label={`${e} gönder`} onClick={() => void send(e, 'emoji')}>{e}</button>)}</div>}
      {!compact && <form className="race-chat-form" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <input className="race-input" data-testid="yaris-sohbet-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yaz…" maxLength={SOCIAL_LIMITS.chatMax} />
        <button className="btn small" data-testid="yaris-sohbet-gonder" disabled={!text.trim()}>Gönder</button>
      </form>}
      {err && <small className="race-error-inline">{err}</small>}
    </div>
  );
}
