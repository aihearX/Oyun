import { openProfile } from '../friends/state';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import { CHAT_REACTIONS, COMM_RULES, REACTION_LABEL, SOCIAL_LIMITS, type ChatMessage, type ChatReaction } from '@odi/shared';
import { newRunId } from '@odi/net';
import { act, callSafe, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { Empty, Sheet, Skeleton, fmtTime, hex } from './social';
import { ActionButton, IconButton } from './Button';
import { Art, Glyph, rich } from './art';
import { FeedCard, SafeChatSheet, HelpCard, OnlineRow, PhraseStrip, QuestionCard, REACTION_ART, RallyChatCard, ReactionBar, ThreadPreview, ThreadSheet, isRallyStart, rallyEnds } from '../comm/Cards';
import { KonsultCard } from '../camp/gorev/KonsultCard';
import { clearMentions, useCanFreeText, useComm } from '../comm/state';
import { foldSystemRows, type ChatRow } from '../comm/sysfold';
import { featureOpen } from '../ftue/useFeatures';
import { Icon } from './icons';
import { useBackLayer } from '../nav';

/** hızlı tepki satırı: mesaj kartı tepkileriyle aynı çizili set (YN-071). İletiye eşlenen emoji kodu yazılır (sunucu 'emoji' türünü
 *  böyle doğrular, eski istemciler de okur); balonda kod değil çizim görünür (artFor / EMOJI_ART, eski 😂 gibi kayıtlar dahil). */
const QUICK_CODE: Record<ChatReaction, string> = { alkis: '👏', kalp: '❤️', ates: '🔥', yildiz: '⭐', guc: '💪' };
const EMPTY: ChatMessage[] = [];
export interface ChatMember { id: string; name: string; color: number; hat: string; online: boolean }

function sysIcon(m: ChatMessage): string {
  const ev = m.meta?.event;
  if (ev === 'ralli') return '⚔️'; if (ev === 'duello') return '🥊'; if (ev === 'bayrak') return '🚩'; if (ev === 'quiz') return '🧠'; if (ev === 'avi') return '🎵';
  if (ev === 'meydan' || ev === 'yaris') return '🏁'; if (ev === 'calisma') return '💡'; if (ev === 'sira') return '🏆'; if (ev === 'tyaris') return '🏁'; if (ev === 'tlig') return '🛡️';
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

/** başı kesik (alt kısmı görünen) Günün Sorusu kartını sohbet kutusunun başına getirecek kaydırma (negatif px); gerekmiyorsa null (YN-172) */
function questionShift(box: { top: number; bottom: number }, card: { top: number; bottom: number }, pad: number): number | null {
  if (card.top >= box.top + pad - 1 || card.bottom <= box.top) return null;
  return Math.round(card.top - box.top - pad);
}

let fitCanvas: HTMLCanvasElement | null = null;
/** ipucu yazı kutusuna sığıyor mu (kutunun kendi yazı tipiyle ölçülür); ölçülemezse sığıyor sayılır */
function placeholderFits(el: HTMLInputElement, text: string): boolean {
  const ctx = (fitCanvas ??= document.createElement('canvas')).getContext('2d'); if (!ctx) return true;
  const cs = getComputedStyle(el); ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText(text).width <= el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/** Gerçek zamanlı sohbet odası: takım, özel (dm) ya da genel. Takımda: akış kartları, yardım kartları, Günün Sorusu, konular,
 *  bahsetme ve "Kim çevrimiçi". Uzun bas: tepki / yanıtla / şikâyet / sessize al. since: bakan oyuncunun takıma katıldığı an; ondan önceki
 *  art arda sistem satırları katlanır, art arda ayrılma satırları tek satır olur (comm/sysfold.ts, YN-148).
 *  placeholderShort: uzun ipucu kutuya sığmazsa (320 px, Büyük yazı, uzun takım adı) yazılan kısa ipucu (OT-eski-telefon-31).
 *  expandable: sohbet tam ekran açılabilir (takım kartı, sekmeler ve alt çubuk gizlenir; geri tuşu / Escape kapatır; YN-248). */
export function ChatRoom({ room, offset = 360, placeholder = 'Mesaj yaz…', placeholderShort, emptyText, members, since, expandable }: { room: string; offset?: number; placeholder?: string; placeholderShort?: string; emptyText?: string; members?: ChatMember[]; since?: number; expandable?: boolean }) {
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
  const [full, setFull] = useState(false);
  useBackLayer(() => setFull(false), full);
  // tam ekrana geçince ya da çıkınca kutu boyu değişir: sondaysa sonda kalsın
  useLayoutEffect(() => { const b = box.current; if (b && stick.current) b.scrollTop = b.scrollHeight; }, [full]);
  const [shortPh, setShortPh] = useState(false);
  useLayoutEffect(() => {
    const el = inputRef.current; if (!el || !placeholderShort) { setShortPh(false); return; }
    const fit = () => setShortPh(!placeholderFits(el, placeholder));
    fit(); void document.fonts?.ready.then(fit); // yazı tipi geç yüklenirse yeniden ölç
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, [placeholder, placeholderShort]);
  const richFeed = featureOpen('akis'); const dqOpen = featureOpen('soru');
  const names = useMemo(() => (members ?? []).filter((m) => m.id !== me?.id).map((m) => m.name), [members, me?.id]);

  useEffect(() => { setPhrases(!free); }, [free]);
  // odaya katıl + geçmiş; bağlantı kopup geri gelince yeniden (sunucu yeniden başladıysa abonelik ve aradaki mesajlar)
  const st = useNet((s) => s.status);
  const [joins, setJoins] = useState(0);
  const wasDown = useRef(false);
  useEffect(() => { if (st !== 'bağlı') { wasDown.current = true; return; } if (wasDown.current) { wasDown.current = false; setJoins((n) => n + 1); } }, [st]);
  useEffect(() => {
    const c = getNet(); if (!c) return;
    let alive = true;
    useNet.getState().setActiveRoom(room);
    clearMentions(room);
    c.call('chat.join', { room }).then(({ history }) => {
      if (!alive) return;
      useNet.setState((s) => {
        const live = (s.messages[room] ?? []).filter((m) => !history.some((h) => h.id === m.id));
        return { messages: { ...s.messages, [room]: [...history, ...live].sort((a, b) => a.at - b.at).slice(-SOCIAL_LIMITS.historySize * 2) } };
      });
      setLoading(false);
      if (joins > 0) setErr((e) => (e && /bağlı değilsin|koptu/i.test(e) ? '' : e));
    }, (e) => { if (alive) { setLoading(false); setErr(errText(e)); } });
    return () => { alive = false; if (useNet.getState().activeRoom === room) useNet.getState().setActiveRoom(null); if (room === 'genel') void c.call('chat.leave', { room }).catch(() => undefined); };
  }, [room, joins]);
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

  const rows = useMemo<ChatRow[]>(() => (team ? foldSystemRows(top, since) : top.map((m, i) => ({ kind: 'msg' as const, m, i }))), [top, since, team]);
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
  const ralliEnds = useMemo(() => (team ? rallyEnds(msgs) : new Map()), [msgs, team]);
  useLayoutEffect(() => { const b = box.current; if (b && stick.current) b.scrollTop = b.scrollHeight; }, [msgs.length, loading]);
  // Günün Sorusu sohbetin görünen alanına sığmıyorsa (sona kaydırınca başı kesik): ilk açılışta kartın başına hizalanır, soru ve şıklar
  // görünür (YN-172). Cevaplanmış ya da açıklanmış soruda ve kart tümüyle yukarıda kaldıysa sohbet sonda kalır.
  const aligned = useRef(false);
  useLayoutEffect(() => {
    const b = box.current; if (!team || loading || !b || aligned.current) return;
    aligned.current = true;
    const cards = b.querySelectorAll<HTMLElement>('[data-testid="gunun-sorusu"][data-rev="0"]');
    const card = cards[cards.length - 1]; if (!card?.querySelector('.dq-opt:not(:disabled)')) return;
    const q = useComm.getState().dq?.question; if (q && q.msgId === card.dataset.id && q.myChoice != null) return;
    const d = questionShift(b.getBoundingClientRect(), card.getBoundingClientRect(), parseFloat(getComputedStyle(b).paddingTop) || 0);
    if (d) { b.scrollTop += d; stick.current = false; }
  }, [loading]);
  // takım sohbeti görünür ve sona kaydırılmışsa son iletiye kadar okundu (sunucu imleci; Takım sekmesi rozeti, YN-071)
  const readAt = useRef(0);
  const markRead = () => {
    const b = box.current; if (!team || loading || !b || document.visibilityState === 'hidden') return;
    if (b.scrollHeight - b.scrollTop - b.clientHeight >= 60) return;
    const last = msgs.reduce((a, m) => Math.max(a, m.at), 0); if (!last || last <= readAt.current) return;
    readAt.current = last;
    getNet()?.call('chat.read', { room, at: last }).catch(() => { readAt.current = 0; });
  };
  useEffect(() => { markRead(); });
  useEffect(() => { const vis = () => markRead(); document.addEventListener('visibilitychange', vis); return () => document.removeEventListener('visibilitychange', vis); });
  const onScroll = () => { const b = box.current; if (b) stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 60; markRead(); };

  // gönderim kimliği (cid): aynı ileti yeniden denenirse sunucu bir kez yazar (kopukken / yanıt gelmeden kopunca)
  const cid = useRef<{ key: string; id: string } | null>(null);
  const [sending, setSending] = useState(false);
  const send = async (t: string, kind: 'text' | 'emoji' | 'hazir' = 'text') => {
    const c = getNet(); const clean = t.trim(); if (!c || !clean) return;
    const key = `${kind}:${clean}`;
    if (cid.current?.key !== key) cid.current = { key, id: newRunId() };
    setErr(''); setSending(true);
    try {
      const { msg } = await callSafe('chat.send', { room, text: clean, kind, cid: cid.current.id });
      cid.current = null;
      // kendi iletin (yeniden denemede yayın tekrarlanmaz): listede yoksa ekle
      useNet.setState((s) => { const list = s.messages[room] ?? []; return list.some((m) => m.id === msg.id) ? {} : { messages: { ...s.messages, [room]: [...list, msg].slice(-SOCIAL_LIMITS.historySize * 2) } }; });
      if (kind === 'text') setText(''); stick.current = true; platform().haptic('light');
    } catch (e) { setErr(errText(e)); }
    finally { setSending(false); }
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
    if (m.kind === 'feed' && m.meta?.type === 'konsultasyon' && team && richFeed) return <KonsultCard key={m.id} m={m} live={live} />;
    if (m.kind === 'feed') return <FeedCard key={m.id} m={m} live={live} rich={richFeed} />;
    if (m.kind === 'help' && team) return <HelpCard key={m.id} m={m} live={live} />;
    if (m.kind === 'soru') return <QuestionCard key={m.id} m={m} live={live} />;
    if (team && isRallyStart(m)) return <RallyChatCard key={m.id} m={m} end={ralliEnds.get(String(m.meta!.rallyId))} />;
    if (m.from === 'sistem') return <div key={m.id} className={`msg-sys kind-${m.kind}`}><span aria-hidden><Glyph e={sysIcon(m)} size="1.2em" /></span> {rich(m.text)}{m.replyTo && <small className="msg-re"> · yanıt</small>}</div>;
    const mine = m.from === me?.id; const head = !prev || prev.from !== m.from || m.at - prev.at > 5 * 60_000 || prev.kind === 'feed';
    const at = typeof m.meta?.at === 'string' && !!me && m.meta.at.split(',').includes(me.id);
    return (
      <div key={m.id} className={`msg${mine ? ' mine' : ''}${m.kind === 'emoji' ? ' emoji' : ''}${m.kind === 'hazir' ? ' preset' : ''}${at ? ' mentioned' : ''}`} data-testid="mesaj"
        onPointerDown={() => startPress(m)} onPointerUp={endPress} onPointerLeave={endPress} onContextMenu={(e) => { e.preventDefault(); setMenu(m); }}>
        {head && !mine && <button type="button" className="msg-name linkish" style={{ color: hex(m.color) }} onClick={() => openProfile(m.from)}>{m.name}</button>}
        {/* seçenekler düğmesi balonla aynı satırda, balonun hemen yanında (satırın sağ ucunda boşta durmaz) */}
        <div className="bubble-row">
          <div className="bubble">{m.kind === 'hazir' && <Art name="chat" size="1em" className="art-inline preset-ic" />}{m.kind === 'emoji' ? <span className="emoji-art">{rich(m.text, '1.6em')}</span> : withMentions(m.text, names)}<span className="msg-time">{fmtTime(m.at)}</span>{m.replyTo && <small className="msg-re"> · yanıt</small>}</div>
          {!mine && <button type="button" className="msg-more" onClick={() => setMenu(m)} aria-label={`${m.name} mesajı için seçenekler`}>⋯</button>}
        </div>
        {m.reactions && <ReactionBar msg={m} compact />}
        {(m.replies || live.length) ? <ThreadPreview parent={m} live={live} onOpen={() => setThread(m)} /> : null}
      </div>
    );
  };

  const renderRow = (r: ChatRow): ReactNode => {
    if (r.kind === 'msg') return render(r.m, r.i);
    if (r.kind === 'left') return <div key={r.id} className="msg-sys kind-system" data-testid="sohbet-ayrilanlar"><span aria-hidden><Glyph e="🚪" size="1.2em" /></span> {r.n} oyuncu takımdan ayrıldı.</div>;
    const shown = unfolded.has(r.id);
    return (
      <Fragment key={r.id}>
        <button type="button" className="msg-sys msg-fold" aria-expanded={shown} data-testid="sohbet-katlanmis"
          onClick={() => setUnfolded((s) => { const n = new Set(s); if (shown) n.delete(r.id); else n.add(r.id); return n; })}>
          <span aria-hidden><Glyph e="📣" size="1.2em" /></span> Sen katılmadan önce: {r.n} takım duyurusu · {shown ? 'Gizle' : 'Göster'}
        </button>
        {shown && r.rows.map(renderRow)}
      </Fragment>
    );
  };

  return (
    <div className={`chat${full ? ' full' : ''}`}>
      {((team && members) || expandable) && (
        <div className="chat-top">
          {team && members && <OnlineRow members={members} />}
          {expandable && <button type="button" className="chat-full-btn" data-testid="sohbet-tam-ekran" aria-pressed={full} onClick={() => { setFull(!full); platform().haptic('light'); }}
            aria-label={full ? 'Tam ekrandan çık' : 'Sohbeti tam ekran aç'} title={full ? 'Tam ekrandan çık' : 'Sohbeti tam ekran aç'}><Icon name={full ? 'shrink' : 'expand'} size={20} /></button>}
        </div>
      )}
      <div className="chat-box" ref={box} onScroll={onScroll} style={{ ['--chat-off' as string]: `${offset}px` }}>
        {loading ? <Skeleton rows={3} /> : top.length === 0 ? <Empty icon="💬" title="Henüz ses yok" text={emptyText ?? 'İlk mesajı sen yaz; bir “merhaba” bile yeter.'} /> : rows.map(renderRow)}
      </div>
      {phrases
        ? <div className="quick-line"><button type="button" className="quick phr-toggle on" onClick={() => setPhrases(false)} aria-label="Tepkilere geç"><Art name="chat" size={20} /></button><PhraseStrip rewind ctx={['genel', 'tebrik', 'tesekkur']} onPick={(id) => void send(id, 'hazir')} /></div>
        : <div className="quick-line"><button type="button" className="quick phr-toggle" onClick={() => setPhrases(true)} aria-label="Hazır sözler"><Art name="chat" size={20} /></button><div className="quick-row" aria-label="Hızlı tepkiler">{CHAT_REACTIONS.map((r) => <button key={r} type="button" className="quick" onClick={() => void send(QUICK_CODE[r], 'emoji')} aria-label={`Hızlı tepki: ${REACTION_LABEL[r]}`}><Art name={REACTION_ART[r]} size={22} /></button>)}</div></div>}
      {err && <div className="chat-err" role="alert">{err}</div>}
      {sending && st !== 'bağlı' && <div className="net-banner chat-wait" role="status" data-testid="sohbet-bekliyor">Bağlantı bekleniyor; iletin bağlanınca gönderilecek.</div>}
      {suggest.length > 0 && <div className="at-suggest" role="listbox" aria-label="Bahset">{suggest.map((m) => <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => pickMention(m.name)}><span className="at-dot" style={{ background: hex(m.color) }} />@{m.name}</button>)}</div>}
      {!free && <div className="chat-lock-note" id={`kilit-${room}`} data-testid="serbest-kilit">Serbest yazı {freeAt}. bölümden sonra açılır; şimdilik hazır sözler ve emoji.</div>}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (!free) { setOptIn(true); return; } void send(text); }}>
        <input ref={inputRef} className="input" value={text} maxLength={SOCIAL_LIMITS.chatMax} readOnly={!free} onChange={(e) => setText(e.target.value)}
          onFocus={() => { if (!free) { inputRef.current?.blur(); setOptIn(true); } }}
          placeholder={free ? (shortPh && placeholderShort ? placeholderShort : placeholder) : 'Yazı kapalı'} aria-describedby={free ? undefined : `kilit-${room}`} aria-label="Mesaj" enterKeyHint="send" />
        <IconButton type="submit" icon="send" label="Gönder" tone="solid" disabled={free && !text.trim()} />
      </form>
      {menu && (
        <Sheet title={menu.name} onClose={() => setMenu(null)}>
          <div className="muted wrap">{menu.kind === 'emoji' ? rich(menu.text, '1.4em') : <span data-ugc>“{menu.text}”</span>}</div>
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
