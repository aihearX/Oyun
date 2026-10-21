import { openProfile } from '../friends/state';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import { COMM_RULES, SOCIAL_LIMITS, type ChatMessage } from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { Empty, Sheet, Skeleton, fmtTime, hex } from './social';
import { ActionButton, IconButton } from './Button';
import { Art, Glyph, rich } from './art';
import { FeedCard, SafeChatSheet, HelpCard, OnlineRow, PhraseStrip, QuestionCard, ReactionBar, ThreadPreview, ThreadSheet } from '../comm/Cards';
import { clearMentions, useCanFreeText, useComm } from '../comm/state';
import { featureOpen } from '../ftue/useFeatures';

const QUICK = ['👍', '❤️', '😂', '🔥', '👏', '💪', '🎉', '🙏'];
const EMPTY: ChatMessage[] = [];
export interface ChatMember { id: string; name: string; color: number; hat: string; online: boolean }

function sysIcon(m: ChatMessage): string {
  const ev = m.meta?.event;
  if (ev === 'ralli') return '⚔️'; if (ev === 'duello') return '🥊'; if (ev === 'bayrak') return '🚩'; if (ev === 'quiz') return '🧠'; if (ev === 'avi') return '🎵';
  if (ev === 'meydan' || ev === 'yaris') return '🏁'; if (ev === 'calisma') return '💡'; if (ev === 'sira') return '🏆';
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

/** metindeki @İsim bahsetmelerini vurgula (yalnızca bilinen üye adları) */
function withMentions(text: string, names: string[]): ReactNode {
  if (!names.length || !text.includes('@')) return text;
  const low = text.toLocaleLowerCase('tr'); const out: ReactNode[] = []; let i = 0; let k = 0;
  while (i < text.length) {
    const at = low.indexOf('@', i); if (at < 0) break;
    const hit = names.find((n) => low.startsWith('@' + n.toLocaleLowerCase('tr'), at));
    if (!hit) { out.push(text.slice(i, at + 1)); i = at + 1; continue; }
    out.push(text.slice(i, at)); out.push(<b key={k++} className="at-name">{text.slice(at, at + hit.length + 1)}</b>); i = at + hit.length + 1;
  }
  out.push(text.slice(i));
  return out;
}

/** Gerçek zamanlı sohbet odası: takım, özel (dm) ya da genel. Takımda: akış kartları, yardım kartları, Günün Sorusu, konular,
 *  bahsetme ve "Kim çevrimiçi". Uzun bas: tepki / yanıtla / şikâyet / sessize al. */
export function ChatRoom({ room, offset = 360, placeholder = 'Mesaj yaz…', emptyText, members }: { room: string; offset?: number; placeholder?: string; emptyText?: string; members?: ChatMember[] }) {
  const me = useNet((s) => s.me);
  const msgs = useNet((s) => s.messages[room] ?? EMPTY);
  const free = useCanFreeText(); const freeAt = useComm((s) => s.settings?.freeTextLevel ?? COMM_RULES.freeTextLevel);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [thread, setThread] = useState<ChatMessage | null>(null);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [phrases, setPhrases] = useState(!free);
  const [optIn, setOptIn] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const team = room.startsWith('takim:');
  const richFeed = featureOpen('akis'); const dqOpen = featureOpen('soru');
  const names = useMemo(() => (members ?? []).filter((m) => m.id !== me?.id).map((m) => m.name), [members, me?.id]);

  useEffect(() => { setPhrases(!free); }, [free]);
  useEffect(() => {
    const c = getNet(); if (!c) return;
    let alive = true;
    useNet.getState().setActiveRoom(room);
    clearMentions(room);
    c.call('chat.join', { room }).then(({ history }) => {
      if (!alive) return;
      useNet.setState((s) => {
        const live = (s.messages[room] ?? []).filter((m) => !history.some((h) => h.id === m.id));
        return { messages: { ...s.messages, [room]: [...history, ...live].slice(-SOCIAL_LIMITS.historySize * 2) } };
      });
      setLoading(false);
    }, (e) => { if (alive) { setLoading(false); setErr(errText(e)); } });
    return () => { alive = false; if (useNet.getState().activeRoom === room) useNet.getState().setActiveRoom(null); if (room === 'genel') void c.call('chat.leave', { room }).catch(() => undefined); };
  }, [room]);
  useEffect(() => { clearMentions(room); }, [msgs.length]);

  // konu yanıtları üst mesajın altında; üst mesaj listede yoksa tek başına (yanıt etiketiyle) görünür
  const { top, repliesOf } = useMemo(() => {
    const ids = new Set(msgs.map((m) => m.id));
    const by = new Map<string, ChatMessage[]>(); const t: ChatMessage[] = [];
    for (const m of msgs) {
      if (muted.has(m.from)) continue;
      if (m.kind === 'soru' && !dqOpen) continue;
      if (m.replyTo && ids.has(m.replyTo)) { const l = by.get(m.replyTo) ?? []; l.push(m); by.set(m.replyTo, l); continue; }
      t.push(m);
    }
    return { top: t, repliesOf: by };
  }, [msgs, muted, dqOpen]);

  useLayoutEffect(() => { const b = box.current; if (b && stick.current) b.scrollTop = b.scrollHeight; }, [msgs.length, loading]);
  const onScroll = () => { const b = box.current; if (b) stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 60; };

  const send = async (t: string, kind: 'text' | 'emoji' | 'hazir' = 'text') => {
    const c = getNet(); const clean = t.trim(); if (!c || !clean) return;
    setErr('');
    try { await c.call('chat.send', { room, text: clean, kind }); if (kind === 'text') setText(''); stick.current = true; platform().haptic('light'); }
    catch (e) { setErr(errText(e)); }
  };
  const startPress = (m: ChatMessage) => { if (m.from === 'sistem') return; press.current = setTimeout(() => { platform().haptic('medium'); setMenu(m); }, 480); };
  const endPress = () => { if (press.current) clearTimeout(press.current); press.current = null; };

  // @ öneri: yazılan son sözcük @ ile başlıyorsa eşleşen üyeler
  const atQ = team ? /(?:^|\s)@([\p{L}\p{N}_]*)$/u.exec(text)?.[1] : undefined;
  const suggest = atQ !== undefined ? (members ?? []).filter((m) => m.id !== me?.id && m.name.toLocaleLowerCase('tr').startsWith(atQ.toLocaleLowerCase('tr'))).slice(0, 4) : [];
  const pickMention = (name: string) => { setText((t) => t.replace(/@([\p{L}\p{N}_]*)$/u, `@${name} `)); inputRef.current?.focus(); };

  const render = (m: ChatMessage, i: number) => {
    const prev = top[i - 1];
    const live = repliesOf.get(m.id) ?? EMPTY;
    if (m.kind === 'feed') return <FeedCard key={m.id} m={m} live={live} rich={richFeed} />;
    if (m.kind === 'help' && team) return <HelpCard key={m.id} m={m} live={live} />;
    if (m.kind === 'soru') return <QuestionCard key={m.id} m={m} live={live} />;
    if (m.from === 'sistem') return <div key={m.id} className={`msg-sys kind-${m.kind}`}><span aria-hidden><Glyph e={sysIcon(m)} size="1.2em" /></span> {rich(m.text)}{m.replyTo && <small className="msg-re"> · yanıt</small>}</div>;
    const mine = m.from === me?.id; const head = !prev || prev.from !== m.from || m.at - prev.at > 5 * 60_000 || prev.kind === 'feed';
    const at = typeof m.meta?.at === 'string' && !!me && m.meta.at.split(',').includes(me.id);
    return (
      <div key={m.id} className={`msg${mine ? ' mine' : ''}${m.kind === 'emoji' ? ' emoji' : ''}${m.kind === 'hazir' ? ' preset' : ''}${at ? ' mentioned' : ''}`} data-testid="mesaj"
        onPointerDown={() => startPress(m)} onPointerUp={endPress} onPointerLeave={endPress} onContextMenu={(e) => { e.preventDefault(); setMenu(m); }}>
        {head && !mine && <button type="button" className="msg-name linkish" style={{ color: hex(m.color) }} onClick={() => openProfile(m.from)}>{m.name}</button>}
        <div className="bubble">{m.kind === 'hazir' && <Art name="chat" size="1em" className="art-inline preset-ic" />}{withMentions(m.text, names)}<span className="msg-time">{fmtTime(m.at)}</span>{m.replyTo && <small className="msg-re"> · yanıt</small>}</div>
        {m.reactions && <ReactionBar msg={m} compact />}
        {(m.replies || live.length) ? <ThreadPreview parent={m} live={live} onOpen={() => setThread(m)} /> : null}
        {!mine && <button className="msg-more" onClick={() => setMenu(m)} aria-label={`${m.name} mesajı için seçenekler`}>⋯</button>}
      </div>
    );
  };

  return (
    <div className="chat">
      {team && members && <OnlineRow members={members} />}
      <div className="chat-box" ref={box} onScroll={onScroll} style={{ ['--chat-off' as string]: `${offset}px` }}>
        {loading ? <Skeleton rows={3} /> : top.length === 0 ? <Empty icon="💬" title="Henüz ses yok" text={emptyText ?? 'İlk mesajı sen yaz; bir “merhaba” bile yeter.'} /> : top.map(render)}
      </div>
      {phrases
        ? <div className="quick-line"><button type="button" className="quick phr-toggle on" onClick={() => setPhrases(false)} aria-label="Emoji tepkilerine geç"><Art name="chat" size={20} /></button><PhraseStrip ctx={['genel', 'tebrik', 'tesekkur']} onPick={(id) => void send(id, 'hazir')} /></div>
        : <div className="quick-line"><button type="button" className="quick phr-toggle" onClick={() => setPhrases(true)} aria-label="Hazır sözler"><Art name="chat" size={20} /></button><div className="quick-row" aria-label="Hızlı tepkiler">{QUICK.map((e) => <button key={e} className="quick" onClick={() => void send(e, 'emoji')} aria-label={`Hızlı tepki ${e}`}>{e}</button>)}</div></div>}
      {err && <div className="chat-err" role="alert">{err}</div>}
      {suggest.length > 0 && <div className="at-suggest" role="listbox" aria-label="Bahset">{suggest.map((m) => <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => pickMention(m.name)}><span className="at-dot" style={{ background: hex(m.color) }} />@{m.name}</button>)}</div>}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (!free) { setOptIn(true); return; } void send(text); }}>
        <input ref={inputRef} className="input" value={text} maxLength={SOCIAL_LIMITS.chatMax} readOnly={!free} onChange={(e) => setText(e.target.value)}
          onFocus={() => { if (!free) { inputRef.current?.blur(); setOptIn(true); } }}
          placeholder={free ? placeholder : `Serbest yazı ${freeAt}. bölümden sonra açılır`} aria-label="Mesaj" enterKeyHint="send" />
        <IconButton type="submit" icon="send" label="Gönder" tone="solid" disabled={free && !text.trim()} />
      </form>
      {menu && (
        <Sheet title={menu.name} onClose={() => setMenu(null)}>
          <div className="muted wrap">“{menu.text}”</div>
          <ReactionBar msg={menu} />
          <ActionButton block tone="teal" onClick={() => { setThread(menu); setMenu(null); }}>Yanıtla</ActionButton>
          {menu.from !== me?.id && <>
            <ActionButton block tone="coral" onClick={async () => { const r = await act('chat.report', { msgId: menu.id }); if (r) toast('🙏', 'Teşekkürler', 'Şikâyetin alındı. Üç farklı kişi şikâyet ederse mesaj gizlenir.', 'green'); setMenu(null); }}>Şikâyet et</ActionButton>
            <ActionButton block tone="plain" onClick={async () => { const r = await act('chat.mute', { id: menu.from, on: true }); if (r) { setMuted(new Set([...muted, menu.from])); toast('🔇', `${menu.name} sessize alındı`, 'Mesajlarını artık görmeyeceksin.'); } setMenu(null); }}>Sessize al</ActionButton>
          </>}
          <ActionButton block tone="plain" onClick={() => setMenu(null)}>Vazgeç</ActionButton>
        </Sheet>
      )}
      {thread && <ThreadSheet parent={thread} onClose={() => setThread(null)} />}
      {optIn && <SafeChatSheet onClose={() => setOptIn(false)} />}
    </div>
  );
}
