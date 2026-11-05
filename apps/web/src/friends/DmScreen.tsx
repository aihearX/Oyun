import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNet } from '@odi/net/store';
import { COMM_RULES, DM_REACTIONS, DM_STICKERS, FRIEND_LIMITS, RALLY_RULES, phraseById, type DmMessage, type PublicProfile, type RallyState } from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { srvNow, useEvents } from '../events/store';
import { platform } from '../platform';
import { useNav } from '../nav';
import { Sheet } from '../ui/social';
import { Av, Sticker, dayLabel, lastSeenText, openInvite, raceWith, useOnline } from './common';
import { applyMsg, dropDm, friendsNet, loadConvo, openProfile, queueDm, readActive, retryDm, useFriends, type PendingDm } from './state';
import './friends.css';
import { IconButton } from '../ui/Button';
import { Art, rich } from '../ui/art';
import { Icon } from '../ui/icons';
import { featureOpen } from '../ftue/useFeatures';
import { PhraseStrip, SafeChatSheet } from '../comm/Cards';
import { useCanFreeText, useComm } from '../comm/state';
import { refreshTeamRace, useTeamRace } from '../teamrace/state';

/** simge paneli: her biri çizimle görünür (ui/art.tsx EMOJI_ART); iletiye emoji kodu yazılır, balonda çizim çıkar (YN-071) */
const EMOJIS = ['😀', '😂', '😮', '😢', '😡', '👋', '👍', '👏', '💪', '🔥', '❤️', '⭐', '🏆', '🏁', '🎵', '👂', '🐚', '😴'];
/** tepki adları (erişilebilir ad; tepki çizimle gösterilir) */
const REACT_NAME: Record<string, string> = { '❤️': 'Kalp', '😂': 'Kahkaha', '😮': 'Vay', '😢': 'Üzgün', '👍': 'Tamam', '🔥': 'Ateş' };
const EMPTY: DmMessage[] = [];
const NO_PENDING: PendingDm[] = [];

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
  const online = useNet((s) => s.status === 'bağlı');
  const conv = useFriends((s) => s.convos[id]);
  const outbox = useFriends((s) => s.outbox);
  const pending = useMemo(() => { const p = outbox.filter((x) => x.to === id); return p.length ? p : NO_PENDING; }, [outbox, id]);
  const msgs = conv?.messages ?? EMPTY;
  const other = useFriends((s) => s.people[id] ?? null);
  const isFriend = useFriends((s) => (s.friends ?? []).some((f) => f.id === id));
  const typing = useTyping(id);
  const peerOnline = useOnline(other);
  const vh = useViewportHeight();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [panel, setPanel] = useState<'' | 'emoji' | 'odi' | 'soz'>('');
  const free = useCanFreeText(); const freeAt = useComm((s) => s.settings?.freeTextLevel ?? COMM_RULES.freeTextLevel); const [optIn, setOptIn] = useState(false);
  const [menu, setMenu] = useState<DmMessage | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const restore = useRef<{ h: number; top: number } | null>(null);
  const lastTyping = useRef(0);

  // konuşma bağlıyken yüklenir; bağlantı yokken istek bekletilmez (sonsuz "Yükleniyor…" yerine açık durum), bağlanınca kendiliğinden (YN-085)
  useEffect(() => {
    if (!online) return;
    setErr('');
    loadConvo(id).then(() => readActive(id), (e) => setErr(errText(e)));
  }, [id, online]);
  useEffect(() => {
    useFriends.setState({ activeDm: id });
    const vis = () => { if (document.visibilityState === 'visible') readActive(id); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); if (useFriends.getState().activeDm === id) useFriends.setState({ activeDm: null }); };
  }, [id]);

  // kaydırma: eski mesajlar yüklenince konumu koru; yeni mesajda (alttaysan) aşağı in
  useLayoutEffect(() => {
    const el = list.current; if (!el) return;
    if (restore.current) { el.scrollTop = el.scrollHeight - restore.current.h + restore.current.top; restore.current = null; return; }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs, pending, typing, vh, panel]);

  const onScroll = () => {
    const el = list.current; if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && conv?.hasMore && !loadingOlder) {
      setLoadingOlder(true);
      restore.current = { h: el.scrollHeight, top: el.scrollTop };
      loadConvo(id, true).catch(() => { restore.current = null; }).finally(() => setLoadingOlder(false));
    }
  };

  // mesaj hemen bekleyen balon olur ve kutudan çıkar; bağlıysa şimdi, değilse bağlanınca bir kez gider (state.ts queueDm)
  const send = (body: string, kind: DmMessage['kind'] = 'text') => {
    const clean = body.trim(); if (!clean) return;
    setErr('');
    stick.current = true;
    queueDm(id, clean, kind);
    if (kind === 'text') setText('');
    platform().haptic('light');
  };
  const onType = (v: string) => {
    setText(v);
    const c = friendsNet(); const t = Date.now();
    if (c && v.trim() && t - lastTyping.current > 2500) { lastTyping.current = t; c.fire('dm.typing', { to: id }); }
  };
  // simge her zaman kendi iletisi olarak gider (yazının içine emoji glifi eklenmez); yazılan metin kutuda kalır
  const pickEmoji = (e: string) => { void send(e, 'emoji'); };

  const lastMine = [...msgs].reverse().find((m) => m.from === me?.id && !m.deleted);
  const peerRead = conv?.peerReadSeq ?? 0;
  const canMessage = conv ? conv.canMessage : true;
  const name = other?.name ?? 'Sohbet';

  return (
    <div className="dm-screen fade-in" style={vh ? { height: vh } : undefined} data-testid="dm-ekrani">
      <header className="dm-head">
        <IconButton icon="back" label="Geri" onClick={onBack} />
        <button className="dm-head-who min0" onClick={() => openProfile(id)} aria-label={`${name} profili`}>
          {other && <Av p={other} size={40} />}
          <span className="min0">
            <b className="ellipsis">{name}</b>
            <small className={`ellipsis${typing ? ' dm-typing-txt' : peerOnline ? ' fr-on' : ''}`} data-testid="dm-durum">{typing ? 'yazıyor…' : other ? lastSeenText(other, peerOnline) : ''}</small>
          </span>
        </button>
        {isFriend && other && featureOpen('race') && <button className="btn coral small icon-btn" onClick={() => void raceWith(other, nav)} aria-label={`${name} ile yarış`}><Art e="🏁" size="1.15em" className="art-inline" /></button>}
      </header>

      {!online && <div className="net-banner dm-net" role="status" data-testid="dm-cevrimdisi"><Art name="signal" size={18} /><span className="grow min0">{conv?.loaded ? 'Bağlantı yok: son yüklenen konuşma. Yazdıkların bağlanınca gider.' : 'Bağlantı yok: konuşma bağlanınca yüklenecek. Yazdıkların bağlanınca gider.'}</span></div>}
      <div className="dm-list" ref={list} onScroll={onScroll} aria-live="polite">
        {conv?.hasMore && <div className="dm-older">{loadingOlder ? 'Eski mesajlar yükleniyor…' : '↑ Daha eski mesajlar için kaydır'}</div>}
        {!conv?.loaded && !err && online && <div className="dm-older">Yükleniyor…</div>}
        {conv?.loaded && msgs.length === 0 && !pending.length && (
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
        {pending.map((p) => <PendingBubble key={p.cid} p={p} online={online} sender={me} />)}
        {typing && <div className="dm-row theirs"><div className="dm-bubble dm-typing" aria-label={`${name} yazıyor`}><i /><i /><i /></div></div>}
      </div>

      {err && <div className="chat-err dm-err" role="alert">{err}</div>}
      {canMessage ? (
        <div className="dm-bottom">
          {panel && (
            <div className="dm-panel" role="dialog" aria-label="Emoji ve çıkartmalar">
              <div className="dm-panel-tabs">
                <button className={panel === 'emoji' ? 'on' : ''} onClick={() => setPanel('emoji')}><Icon name="smile" size="1.1em" className="ic-inline" /> Simgeler</button>
                <button className={panel === 'odi' ? 'on' : ''} onClick={() => setPanel('odi')}><Art e="🫧" size="1.15em" className="art-inline" /> Odi çıkartmaları</button>
                <button className={panel === 'soz' ? 'on' : ''} onClick={() => setPanel('soz')}><Art name="chat" size="1.15em" className="art-inline" /> Hazır sözler</button>
              </div>
              {panel === 'soz' ? <div className="dm-phrases"><PhraseStrip ctx={['genel', 'tebrik', 'tesekkur', 'yaris']} onPick={(pid) => { void send(pid, 'hazir'); setPanel(''); }} /></div>
                : panel === 'emoji'
                ? <div className="dm-emoji-grid">{EMOJIS.map((e) => <button key={e} onClick={() => pickEmoji(e)} aria-label={`Simge ${e}`}><Art e={e} size={28} /></button>)}</div>
                : <div className="dm-st-grid">{DM_STICKERS.map((s) => <button key={s.id} className="dm-st-btn" onClick={() => { void send(s.id, 'sticker'); setPanel(''); }} aria-label={`Çıkartma gönder: ${s.label}`}><Sticker id={s.id} color={me?.color ?? 0x8b6bff} hat={me?.hat ?? ''} size={72} /></button>)}</div>}
            </div>
          )}
          <form className="dm-compose" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <button type="button" className={`dm-emo-btn${panel ? ' on' : ''}`} onClick={() => setPanel(panel ? '' : 'emoji')} aria-label="Emoji ve çıkartmalar"><Icon name={panel ? 'list' : 'smile'} size={22} /></button>
            <textarea ref={input} className="dm-input" rows={1} value={text} maxLength={FRIEND_LIMITS.dmMax} placeholder={free ? `${name} kişisine yaz…` : `Serbest yazı ${freeAt}. bölümden sonra`} aria-label="Mesaj" enterKeyHint="send" readOnly={!free}
              onFocus={() => { if (!free) { input.current?.blur(); setPanel('soz'); setOptIn(true); return; } setPanel(''); stick.current = true; }}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
            <button className="dm-send" type="submit" disabled={!text.trim()} aria-label="Gönder"><Icon name="send" size="1.1em" className="ic-inline" /></button>
          </form>
        </div>
      ) : (
        <div className="dm-closed card">
          <span><Art e="🔒" size="1.15em" className="art-inline" /> {conv?.reason ?? 'Bu sohbete mesaj gönderilemiyor.'}</span>
          <button className="btn small" onClick={() => openProfile(id)}>Profili aç</button>
        </div>
      )}

      {menu && <MsgMenu m={menu} mine={menu.from === me?.id} meId={me?.id ?? ''} name={name} onClose={() => setMenu(null)} />}
      {optIn && <SafeChatSheet onClose={() => setOptIn(false)} />}
    </div>
  );
}

/** biten ralli kesin sonuçtur: oturum boyunca bir kez sorulur (aynı konuşmada birden çok kart) */
const rallyDone = new Map<string, RallyState | null>();
/**
 * Ralli davet kartının durumu (YN-116): kartın kendi rallisi (meta.roomId) sunucudan sorulur; takımın güncel rallisiyse canlı.
 * 'acik' | 'kazanildi' | 'kaybedildi' | 'sayilmadi' | 'yok' (bulunamadı / takımının değil); undefined: yükleniyor ya da ralli kartı değil.
 */
function useRallyInvite(id: string | undefined): RallyState['status'] | 'yok' | undefined {
  const live = useEvents((s) => (id && s.rally?.id === id ? s.rally : null));
  const [got, setGot] = useState<RallyState | null | undefined>(() => (id ? rallyDone.get(id) : undefined));
  const [, tick] = useState(0);
  useEffect(() => {
    if (!id || rallyDone.has(id)) return;
    let on = true;
    void getNet()?.call('rally.state', { rallyId: id }).then((r) => {
      if (!r.rally || r.rally.status !== 'acik') rallyDone.set(id, r.rally);
      if (on) setGot(r.rally);
    }, () => { if (on) setGot(null); });
    return () => { on = false; };
  }, [id]);
  const rally = live ?? got;
  // açık ralli süresi dolunca kart kendiliğinden "bitti" olur
  useEffect(() => {
    if (rally?.status !== 'acik') return;
    const h = setTimeout(() => tick((x) => x + 1), Math.max(0, rally.endsAt - srvNow()) + 300);
    return () => clearTimeout(h);
  }, [rally?.status, rally?.endsAt]);
  if (!id || rally === undefined) return undefined;
  if (!rally) return 'yok';
  // süre doldu, sunucu henüz kapatmadı: en az katılımcıya ulaşmadıysa sayılmaz (sunucu events/rally.ts ile aynı kural)
  return rally.status === 'acik' && rally.endsAt <= srvNow() ? (rally.participants.length < RALLY_RULES.minPlayers ? 'sayilmadi' : 'kaybedildi') : rally.status;
}

/**
 * Takım Yarışı davet kartının durumu (OT-takim-kaptani-21): kart takımın lobisine çağırır (meta.roomId = takım). Lobi takımın canlı
 * durumundan (trace.state / trace.updated) okunur: açık ve yarış başlamamışsa 'acik'; lobi yoksa, yarış başladıysa ya da kart başka
 * takımınsa 'kapali'; undefined: yükleniyor ya da Takım Yarışı kartı değil.
 */
function useTeamRaceInvite(teamId: string | undefined): 'acik' | 'kapali' | undefined {
  const myTeam = useNet((s) => s.team?.id ?? null);
  const loaded = useTeamRace((s) => s.state !== null);
  const open = useTeamRace((s) => !!s.state?.lobby && s.state.lobby.status !== 'eslesti');
  useEffect(() => { if (teamId && myTeam === teamId && !loaded) void refreshTeamRace(); }, [teamId, myTeam, loaded]);
  if (!teamId) return undefined;
  if (myTeam !== teamId) return 'kapali';
  if (!loaded) return undefined;
  return open ? 'acik' : 'kapali';
}

/** gönderilmeyi bekleyen mesaj: gri balon, altında durumu (bağlanınca gidecek / gönderiliyor / reddedildi: Tekrar dene, Sil) */
function PendingBubble({ p, online, sender }: { p: PendingDm; online: boolean; sender: Pick<PublicProfile, 'color' | 'hat'> | null }) {
  const body = p.kind === 'sticker' ? <div className="dm-free">{sender && <Sticker id={p.text} color={sender.color} hat={sender.hat} />}</div>
    : p.kind === 'emoji' ? <div className="dm-free"><span className="dm-big-emoji" data-ugc>{rich(p.text, '1em')}</span></div>
    : p.kind === 'hazir' ? <div className="dm-bubble tail">{phraseById(p.text)?.text ?? p.text}</div>
    : <div className="dm-bubble tail">{p.text}</div>;
  return (
    <div className={`dm-row mine end dm-pending${p.error ? ' failed' : ''}`} data-testid="dm-bekleyen">
      {body}
      {p.error
        ? <div className="dm-pend-note" role="alert"><span>Gönderilemedi: {p.error}</span><span className="dm-pend-acts"><button type="button" className="linkish" onClick={() => retryDm(p.cid)}>Tekrar dene</button><button type="button" className="linkish" onClick={() => dropDm(p.cid)}>Sil</button></span></div>
        : <div className="dm-pend-note" role="status"><Art name={online ? 'hourglass' : 'signal'} size="1em" className="art-inline" /> {online ? 'Gönderiliyor…' : 'Bağlanınca gidecek'}</div>}
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
  const rally = useRallyInvite(m.kind === 'davet' && m.meta?.type === 'ralli' && typeof m.meta.roomId === 'string' ? m.meta.roomId : undefined);
  const lobby = useTeamRaceInvite(m.kind === 'davet' && m.meta?.type === 'tyaris' && typeof m.meta.roomId === 'string' ? m.meta.roomId : undefined);
  const rallyOver = (rally !== undefined && rally !== 'acik') || lobby === 'kapali';
  let body;
  if (m.deleted) body = <div className="dm-bubble deleted"><Art e="🚫" size="1.15em" className="art-inline" /> Bu mesaj silindi {meta}</div>;
  else if (m.kind === 'sticker') body = <div className="dm-free">{sender && <Sticker id={m.text} color={sender.color} hat={sender.hat} />}{meta}</div>;
  else if (m.kind === 'emoji') body = <div className="dm-free"><span className="dm-big-emoji" data-ugc>{rich(m.text, '1em')}</span>{meta}</div>;
  else if (m.kind === 'davet') {
    const yaris = m.meta?.type === 'yaris'; const takim = m.meta?.type === 'takim';
    body = (
      <div className={`dm-invite${rallyOver ? ' closed' : ''}`} data-testid="davet-karti" data-durum={rally ?? lobby ?? ''}>
        <div className="dm-inv-top"><span className="dm-inv-ico" aria-hidden><Art name={yaris ? 'finish' : takim ? 'users' : 'mail'} size={30} /></span><span className="min0"><b>{yaris ? 'Canlı yarış daveti' : typeof m.meta?.title === 'string' ? m.meta.title : 'Davet'}</b>{typeof m.meta?.level === 'number' && <small>{m.meta.level}. bölüm · en çok 4 oyuncu</small>}</span></div>
        {/* eski ralli davetlerinin sonundaki sistem emojisi gösterilmez (yeni davetlerde yok, YN-107) */}
        <div className="dm-inv-text">{m.meta?.type === 'ralli' ? m.text.replace(/\s*🔥\s*$/u, '') : m.text}</div>
        {rallyOver && <div className="dm-inv-state" role="status" data-testid="davet-bitti">{lobby === 'kapali' ? 'Bu lobi kapandı' : rally === 'yok' ? 'Bu ralli artık açık değil' : rally === 'sayilmadi' ? 'Kimse katılmadı; ralli sayılmadı' : `Bu ralli bitti${rally === 'kazanildi' ? ': canavar yenildi' : ': canavar kaçtı'}`}</div>}
        <button className={`btn small ${mine ? 'ghost' : ''}`} disabled={rallyOver} onClick={onInvite}>{yaris ? (mine ? 'Lobiye dön' : 'Yarışa katıl') : takim ? (mine ? 'Takımına git' : 'Takıma katıl') : 'Davete git'}</button>
        {meta}
      </div>
    );
  } else body = <div className={`dm-bubble${tail ? ' tail' : ''}`}>{m.text}{meta}</div>;
  return (
    <div className={`dm-row ${mine ? 'mine' : 'theirs'}${tail ? ' end' : ''}`} onPointerDown={down} onPointerUp={cancel} onPointerLeave={cancel} onPointerMove={move} onContextMenu={(e) => { e.preventDefault(); if (!m.deleted) onMenu(); }} data-testid="dm-mesaj">
      {body}
      {counts.size > 0 && (
        <button className="dm-reacts" onClick={onMenu} aria-label={`Tepkiler: ${[...counts.keys()].map((e) => REACT_NAME[e] ?? 'tepki').join(', ')}`}>
          {[...counts.entries()].map(([e, n]) => <span key={e} className={m.reactions?.[meId] === e ? 'me' : ''}>{rich(e, '1.1em')}{n > 1 ? n : ''}</span>)}
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
        {DM_REACTIONS.map((e) => <button key={e} className={m.reactions?.[meId] === e ? 'on' : ''} onClick={() => void react(e)} aria-label={`Tepki: ${REACT_NAME[e] ?? e}`}><Art e={e} size={28} /></button>)}
      </div>
      {m.kind === 'text' && <div className="dm-quote">“{m.text}”</div>}
      {m.kind === 'text' && <button className="btn ghost" onClick={() => void copy()}><Art e="📋" size="1.15em" className="art-inline" /> Kopyala</button>}
      {mine ? <button className="btn ghost coral-text" onClick={() => void del()}><Art e="🗑️" size="1.15em" className="art-inline" /> Herkesten sil</button>
        : <button className="btn ghost" onClick={() => void report()}><Art e="🚩" size="1.15em" className="art-inline" /> Şikâyet et</button>}
      <button className="btn ghost" onClick={onClose}>Vazgeç</button>
    </Sheet>
  );
}
