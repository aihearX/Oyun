import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS, type ChatMessage } from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { Empty, Sheet, Skeleton, fmtTime, hex } from './social';

const QUICK = ['👍', '❤️', '😂', '🔥', '👏', '💪', '🎉', '🙏'];
const EMPTY: ChatMessage[] = [];

function sysIcon(m: ChatMessage): string {
  if (m.kind === 'war') return '⚔️';
  if (m.kind === 'help') return '🙋';
  if (m.kind === 'race') return '🏁';
  const t = m.text;
  if (/katıldı|kurdu/.test(t)) return '👋';
  if (/ayrıldı|çıkarıldı/.test(t)) return '🚪';
  if (/hediye/i.test(t)) return '🎁';
  if (/Canavar|baskın/i.test(t)) return '👹';
  if (/teknoloji/i.test(t)) return '🔬';
  if (/hedef/i.test(t)) return '🎯';
  if (/lider|yardımcı/i.test(t)) return '👑';
  return '📣';
}

/** Gerçek zamanlı sohbet odası: takım, özel (dm) ya da genel. Uzun bas: şikâyet / sessize al. */
export function ChatRoom({ room, offset = 360, placeholder = 'Mesaj yaz…', emptyText }: { room: string; offset?: number; placeholder?: string; emptyText?: string }) {
  const me = useNet((s) => s.me);
  const msgs = useNet((s) => s.messages[room] ?? EMPTY);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const c = getNet(); if (!c) return;
    let alive = true;
    useNet.getState().setActiveRoom(room);
    c.call('chat.join', { room }).then(({ history }) => {
      if (!alive) return;
      useNet.setState((s) => {
        const live = (s.messages[room] ?? []).filter((m) => !history.some((h) => h.id === m.id));
        return { messages: { ...s.messages, [room]: [...history, ...live].slice(-SOCIAL_LIMITS.historySize) } };
      });
      setLoading(false);
    }, (e) => { if (alive) { setLoading(false); setErr(errText(e)); } });
    return () => { alive = false; if (useNet.getState().activeRoom === room) useNet.getState().setActiveRoom(null); if (room === 'genel') void c.call('chat.leave', { room }).catch(() => undefined); };
  }, [room]);

  useLayoutEffect(() => { const b = box.current; if (b && stick.current) b.scrollTop = b.scrollHeight; }, [msgs.length, loading]);
  const onScroll = () => { const b = box.current; if (b) stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 60; };

  const send = async (t: string, kind: 'text' | 'emoji' = 'text') => {
    const c = getNet(); const clean = t.trim(); if (!c || !clean) return;
    setErr('');
    try { await c.call('chat.send', { room, text: clean, kind }); if (kind === 'text') setText(''); stick.current = true; platform().haptic('light'); }
    catch (e) { setErr(errText(e)); }
  };
  const startPress = (m: ChatMessage) => { if (m.from === 'sistem' || m.from === me?.id) return; press.current = setTimeout(() => { platform().haptic('medium'); setMenu(m); }, 480); };
  const endPress = () => { if (press.current) clearTimeout(press.current); press.current = null; };

  const visible = msgs.filter((m) => !muted.has(m.from));
  return (
    <div className="chat">
      <div className="chat-box" ref={box} onScroll={onScroll} style={{ height: `max(260px, calc(100dvh - ${offset}px))` }}>
        {loading ? <Skeleton rows={3} /> : visible.length === 0 ? <Empty icon="💬" title="Henüz ses yok" text={emptyText ?? 'İlk mesajı sen yaz; bir “merhaba” bile yeter.'} /> : visible.map((m, i) => {
          const prev = visible[i - 1];
          if (m.from === 'sistem') return <div key={m.id} className={`msg-sys kind-${m.kind}`}><span aria-hidden>{sysIcon(m)}</span> {m.text}</div>;
          const mine = m.from === me?.id; const head = !prev || prev.from !== m.from || m.at - prev.at > 5 * 60_000;
          return (
            <div key={m.id} className={`msg${mine ? ' mine' : ''}${m.kind === 'emoji' ? ' emoji' : ''}`}
              onPointerDown={() => startPress(m)} onPointerUp={endPress} onPointerLeave={endPress} onContextMenu={(e) => { e.preventDefault(); if (!mine) setMenu(m); }}>
              {head && !mine && <div className="msg-name" style={{ color: hex(m.color) }}>{m.name}</div>}
              <div className="bubble">{m.text}<span className="msg-time">{fmtTime(m.at)}</span></div>
              {!mine && <button className="msg-more" onClick={() => setMenu(m)} aria-label={`${m.name} mesajı için seçenekler`}>⋯</button>}
            </div>
          );
        })}
      </div>
      <div className="quick-row" aria-label="Hızlı tepkiler">{QUICK.map((e) => <button key={e} className="quick" onClick={() => void send(e, 'emoji')} aria-label={`${e} gönder`}>{e}</button>)}</div>
      {err && <div className="chat-err" role="alert">{err}</div>}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <input value={text} maxLength={SOCIAL_LIMITS.chatMax} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Mesaj" enterKeyHint="send" />
        <button className="btn small" type="submit" disabled={!text.trim()} aria-label="Gönder">➤</button>
      </form>
      {menu && (
        <Sheet title={menu.name} onClose={() => setMenu(null)}>
          <div className="muted wrap">“{menu.text}”</div>
          <button className="btn ghost" onClick={async () => { const r = await act('chat.report', { msgId: menu.id }); if (r) toast('🙏', 'Teşekkürler', 'Şikâyetin alındı. Üç farklı kişi şikâyet ederse mesaj gizlenir.', 'green'); setMenu(null); }}>🚩 Şikâyet et</button>
          <button className="btn ghost" onClick={async () => { const r = await act('chat.mute', { id: menu.from, on: true }); if (r) { setMuted(new Set([...muted, menu.from])); toast('🔇', `${menu.name} sessize alındı`, 'Mesajlarını artık görmeyeceksin.'); } setMenu(null); }}>🔇 Sessize al</button>
          <button className="btn ghost" onClick={() => setMenu(null)}>Vazgeç</button>
        </Sheet>
      )}
    </div>
  );
}
