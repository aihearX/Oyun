import { Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNet } from '@odi/net/store';
import { DM_REACTIONS, DM_STICKERS, FRIEND_LIMITS, type DmMessage, type PublicProfile } from '@odi/shared';
import { act, errText, toast } from '../net';
import { platform } from '../platform';
import { useNav } from '../nav';
import { Sheet } from '../ui/social';
import { Av, Sticker, dayLabel, lastSeenText, openInvite, raceWith, useOnline } from './common';
import { applyMsg, friendsNet, loadConvo, openProfile, readActive, sendDm, useFriends } from './state';
import './friends.css';

const EMOJIS = ['😀', '😂', '🥰', '😎', '🤩', '😮', '😢', '😡', '👍', '👏', '🙏', '💪', '🔥', '🎉', '❤️', '💜', '⭐', '🏆', '🏁', '🎵', '👂', '🐚', '👋', '😴'];
const EMPTY: DmMessage[] = [];

/** klavye açılınca görünür alanın yüksekliği (mobil WebView): giriş alanı hep görünür kalsın */
function useViewportHeight(): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const on = () => { setH(vv.height); window.scrollTo(0, 0); };
    on();
    vv.addEventListener('resize', on); vv.addEventListener('scroll', on);
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on); };
  }, []);
  return h;
}

function useTyping(id: string): boolean {
  const until = useFriends((s) => s.typing[id] ?? 0);
  const [, tick] = useState(0);
  useEffect(() => { const left = until - Date.now(); if (left <= 0) return; const h = setTimeout(() => tick((x) => x + 1), left + 30); return () => clearTimeout(h); }, [until]);
  return until > Date.now();
}

/** Birebir sohbet: baloncuklar, gün ayraçları, yazıyor…, görüldü tikleri, uzun bas: tepki/sil/şikâyet, emoji + Odi çıkartmaları, davet kartları. */
export function DmScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const nav = useNav();
  const me = useNet((s) => s.me);
  const conv = useFriends((s) => s.convos[id]);
  const msgs = conv?.messages ?? EMPTY;
  const other = useFriends((s) => s.people[id] ?? null);
  const isFriend = useFriends((s) => (s.friends ?? []).some((f) => f.id === id));
  const typing = useTyping(id);
  const online = useOnline(other);
  const vh = useViewportHeight();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState<'' | 'emoji' | 'odi'>('');
  const [menu, setMenu] = useState<DmMessage | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const restore = useRef<{ h: number; top: number } | null>(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    useFriends.setState({ activeDm: id });
    loadConvo(id).then(() => readActive(id), (e) => setErr(errText(e)));
    const vis = () => { if (document.visibilityState === 'visible') readActive(id); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); if (useFriends.getState().activeDm === id) useFriends.setState({ activeDm: null }); };
  }, [id]);

  // kaydırma: eski mesajlar yüklenince konumu koru; yeni mesajda (alttaysan) aşağı in
  useLayoutEffect(() => {
    const el = list.current; if (!el) return;
    if (restore.current) { el.scrollTop = el.scrollHeight - restore.current.h + restore.current.top; restore.current = null; return; }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, typing, vh, panel]);

  const onScroll = () => {
    const el = list.current; if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && conv?.hasMore && !loadingOlder) {
      setLoadingOlder(true);
      restore.current = { h: el.scrollHeight, top: el.scrollTop };
      loadConvo(id, true).catch(() => { restore.current = null; }).finally(() => setLoadingOlder(false));
    }
  };

  const send = async (body: string, kind: DmMessage['kind'] = 'text') => {
    const clean = body.trim(); if (!clean) return;
    setErr('');
    try {
      stick.current = true;
      await sendDm(id, clean, kind);
      if (kind === 'text') setText('');
      platform().haptic('light');
    } catch (e) { setErr(errText(e)); }
  };
  const onType = (v: string) => {
    setText(v);
    const c = friendsNet(); const t = Date.now();
    if (c && v.trim() && t - lastTyping.current > 2500) { lastTyping.current = t; c.fire('dm.typing', { to: id }); }
  };
  const pickEmoji = (e: string) => { if (text.trim()) { setText((t) => t + e); input.current?.focus(); } else void send(e, 'emoji'); };

  const lastMine = [...msgs].reverse().find((m) => m.from === me?.id && !m.deleted);
  const peerRead = conv?.peerReadSeq ?? 0;
  const canMessage = conv ? conv.canMessage : true;
  const name = other?.name ?? 'Sohbet';

  return (
    <div className="dm-screen fade-in" style={vh ? { height: vh } : undefined} data-testid="dm-ekrani">
      <header className="dm-head">
        <button className="btn ghost small icon-btn" onClick={onBack} aria-label="Geri">←</button>
        <button className="dm-head-who min0" onClick={() => openProfile(id)} aria-label={`${name} profili`}>
          {other && <Av p={other} size={40} />}
          <span className="min0">
            <b className="ellipsis">{name}</b>
            <small className={`ellipsis${typing ? ' dm-typing-txt' : online ? ' fr-on' : ''}`} data-testid="dm-durum">{typing ? 'yazıyor…' : other ? lastSeenText(other, online) : ''}</small>
          </span>
        </button>
        {isFriend && other && <button className="btn coral small icon-btn" onClick={() => void raceWith(other, nav)} aria-label={`${name} ile yarış`}>🏁</button>}
      </header>

      <div className="dm-list" ref={list} onScroll={onScroll} aria-live="polite">
        {conv?.hasMore && <div className="dm-older">{loadingOlder ? 'Eski mesajlar yükleniyor…' : '↑ Daha eski mesajlar için kaydır'}</div>}
        {!conv?.loaded && !err && <div className="dm-older">Yükleniyor…</div>}
        {conv?.loaded && msgs.length === 0 && (
          <div className="dm-hello">
            {other && <Av p={other} size={88} dot={false} mood="wow" />}
            <b>{name} ile sohbetin burada başlıyor</b>
            <span className="muted small-note">Bir “merhaba” ya da bir Odi çıkartması gönder!</span>
            <div className="dm-hello-row">{DM_STICKERS.slice(0, 3).map((s) => <button key={s.id} className="dm-st-btn" onClick={() => void send(s.id, 'sticker')} aria-label={`Çıkartma gönder: ${s.label}`}><Sticker id={s.id} color={me?.color ?? 0x8b6bff} hat={me?.hat ?? ''} size={64} /></button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]; const next = msgs[i + 1];
          const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
          const mine = m.from === me?.id;
          const groupEnd = !next || next.from !== m.from || next.at - m.at > 5 * 60_000 || dayLabel(next.at) !== dayLabel(m.at);
          return (
            <Fragment key={m.id}>
              {newDay && <div className="dm-day"><span>{dayLabel(m.at)}</span></div>}
              <Bubble m={m} mine={mine} tail={groupEnd} seen={mine && m.seq <= peerRead} sender={mine ? me : other} meId={me?.id ?? ''} onMenu={() => setMenu(m)} onInvite={() => openInvite(m.meta, nav)} />
              {mine && lastMine?.id === m.id && (
                <div className={`dm-receipt${m.seq <= peerRead ? ' seen' : ''}`} data-testid="dm-gorundu">{m.seq <= peerRead ? '✓✓ Görüldü' : '✓ Gönderildi'}</div>
              )}
            </Fragment>
          );
        })}
        {typing && <div className="dm-row theirs"><div className="dm-bubble dm-typing" aria-label={`${name} yazıyor`}><i /><i /><i /></div></div>}
      </div>

      {err && <div className="chat-err dm-err" role="alert">{err}</div>}
      {canMessage ? (
        <div className="dm-bottom">
          {panel && (
            <div className="dm-panel" role="dialog" aria-label="Emoji ve çıkartmalar">
              <div className="dm-panel-tabs">
                <button className={panel === 'emoji' ? 'on' : ''} onClick={() => setPanel('emoji')}>😊 Emoji</button>
                <button className={panel === 'odi' ? 'on' : ''} onClick={() => setPanel('odi')}>🫧 Odi çıkartmaları</button>
              </div>
              {panel === 'emoji'
                ? <div className="dm-emoji-grid">{EMOJIS.map((e) => <button key={e} onClick={() => pickEmoji(e)} aria-label={`Emoji ${e}`}>{e}</button>)}</div>
                : <div className="dm-st-grid">{DM_STICKERS.map((s) => <button key={s.id} className="dm-st-btn" onClick={() => { void send(s.id, 'sticker'); setPanel(''); }} aria-label={`Çıkartma gönder: ${s.label}`}><Sticker id={s.id} color={me?.color ?? 0x8b6bff} hat={me?.hat ?? ''} size={72} /></button>)}</div>}
            </div>
          )}
          <form className="dm-compose" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <button type="button" className={`dm-emo-btn${panel ? ' on' : ''}`} onClick={() => setPanel(panel ? '' : 'emoji')} aria-label="Emoji ve çıkartmalar">{panel ? '⌨️' : '😊'}</button>
            <textarea ref={input} className="dm-input" rows={1} value={text} maxLength={FRIEND_LIMITS.dmMax} placeholder={`${name} kişisine yaz…`} aria-label="Mesaj" enterKeyHint="send"
              onFocus={() => { setPanel(''); stick.current = true; }}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
            <button className="dm-send" type="submit" disabled={!text.trim()} aria-label="Gönder">➤</button>
          </form>
        </div>
      ) : (
        <div className="dm-closed card">
          <span>🔒 {conv?.reason ?? 'Bu sohbete mesaj gönderilemiyor.'}</span>
          <button className="btn small" onClick={() => openProfile(id)}>Profili aç</button>
        </div>
      )}

      {menu && <MsgMenu m={menu} mine={menu.from === me?.id} meId={me?.id ?? ''} name={name} onClose={() => setMenu(null)} />}
    </div>
  );
}

function Bubble({ m, mine, tail, seen, sender, meId, onMenu, onInvite }: { m: DmMessage; mine: boolean; tail: boolean; seen: boolean; sender: Pick<PublicProfile, 'color' | 'hat'> | null; meId: string; onMenu: () => void; onInvite: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const down = (e: RPointerEvent) => { if (m.deleted) return; start.current = { x: e.clientX, y: e.clientY }; timer.current = setTimeout(() => { platform().haptic('medium'); onMenu(); }, 450); };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const move = (e: RPointerEvent) => { const s = start.current; if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel(); };
  const time = new Date(m.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const ticks = mine && !m.deleted ? <span className={`dm-ticks${seen ? ' seen' : ''}`} aria-label={seen ? 'görüldü' : 'gönderildi'}>{seen ? '✓✓' : '✓'}</span> : null;
  const reacts = Object.entries(m.reactions ?? {});
  const counts = new Map<string, number>(); for (const [, e] of reacts) counts.set(e, (counts.get(e) ?? 0) + 1);
  const meta = <span className="dm-meta">{time}{ticks}</span>;
  let body;
  if (m.deleted) body = <div className="dm-bubble deleted">🚫 Bu mesaj silindi {meta}</div>;
  else if (m.kind === 'sticker') body = <div className="dm-free">{sender && <Sticker id={m.text} color={sender.color} hat={sender.hat} />}{meta}</div>;
  else if (m.kind === 'emoji') body = <div className="dm-free"><span className="dm-big-emoji">{m.text}</span>{meta}</div>;
  else if (m.kind === 'davet') {
    const yaris = m.meta?.type === 'yaris';
    body = (
      <div className="dm-invite" data-testid="davet-karti">
        <div className="dm-inv-top"><span className="dm-inv-ico" aria-hidden>{yaris ? '🏁' : '📨'}</span><span className="min0"><b>{yaris ? 'Canlı yarış daveti' : typeof m.meta?.title === 'string' ? m.meta.title : 'Davet'}</b>{typeof m.meta?.level === 'number' && <small>{m.meta.level}. bölüm · en çok 4 oyuncu</small>}</span></div>
        <div className="dm-inv-text">{m.text}</div>
        <button className={`btn small ${mine ? 'ghost' : ''}`} onClick={onInvite}>{yaris ? (mine ? 'Lobiye dön' : 'Yarışa katıl') : 'Davete git'}</button>
        {meta}
      </div>
    );
  } else body = <div className={`dm-bubble${tail ? ' tail' : ''}`}>{m.text}{meta}</div>;
  return (
    <div className={`dm-row ${mine ? 'mine' : 'theirs'}${tail ? ' end' : ''}`} onPointerDown={down} onPointerUp={cancel} onPointerLeave={cancel} onPointerMove={move} onContextMenu={(e) => { e.preventDefault(); if (!m.deleted) onMenu(); }} data-testid="dm-mesaj">
      {body}
      {counts.size > 0 && (
        <button className="dm-reacts" onClick={onMenu} aria-label={`Tepkiler: ${[...counts.keys()].join(' ')}`}>
          {[...counts.entries()].map(([e, n]) => <span key={e} className={m.reactions?.[meId] === e ? 'me' : ''}>{e}{n > 1 ? n : ''}</span>)}
        </button>
      )}
    </div>
  );
}

function MsgMenu({ m, mine, meId, name, onClose }: { m: DmMessage; mine: boolean; meId: string; name: string; onClose: () => void }) {
  const react = async (e: string) => { const r = await act('dm.react', { msgId: m.id, emoji: e }); if (r) { applyMsg(r.msg); platform().haptic('light'); } onClose(); };
  const del = async () => { const r = await act('dm.delete', { msgId: m.id }); if (r) { applyMsg(r.msg); toast('🗑️', 'Mesaj herkesten silindi'); } onClose(); };
  const report = async () => { if (await act('dm.report', { msgId: m.id })) toast('🙏', 'Teşekkürler', `Şikâyetin alındı ve mesaj senden gizlendi. ${name} kişisini profilinden engelleyebilirsin.`, 'green'); onClose(); useFriends.setState((s) => { const c = s.convos[m.from]; return c ? { convos: { ...s.convos, [m.from]: { ...c, messages: c.messages.filter((x) => x.id !== m.id) } } } : {}; }); };
  const copy = async () => { try { await navigator.clipboard.writeText(m.text); toast('📋', 'Kopyalandı'); } catch { /* izin yoksa sessiz */ } onClose(); };
  return (
    <Sheet onClose={onClose}>
      <div className="dm-react-bar" role="group" aria-label="Tepki ver">
        {DM_REACTIONS.map((e) => <button key={e} className={m.reactions?.[meId] === e ? 'on' : ''} onClick={() => void react(e)} aria-label={`Tepki ${e}`}>{e}</button>)}
      </div>
      {m.kind === 'text' && <div className="dm-quote">“{m.text}”</div>}
      {m.kind === 'text' && <button className="btn ghost" onClick={() => void copy()}>📋 Kopyala</button>}
      {mine ? <button className="btn ghost coral-text" onClick={() => void del()}>🗑️ Herkesten sil</button>
        : <button className="btn ghost" onClick={() => void report()}>🚩 Şikâyet et</button>}
      <button className="btn ghost" onClick={onClose}>Vazgeç</button>
    </Sheet>
  );
}
