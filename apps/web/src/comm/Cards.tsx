import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import { CHAT_REACTIONS, COMM_RULES, QUICK_PHRASES, REACTION_LABEL, type ChatMessage, type ChatReaction, type PhraseCtx } from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { useNav } from '../nav';
import { useStore } from '../store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Art, type ArtName } from '../ui/art';
import { Sheet, fmtNum, fmtTime, hex } from '../ui/social';
import { hatKey } from '../screens/team/TeamMembers';
import { openProfile } from '../friends/state';
import { TuyDede } from '../ftue/Narrator';
import { patchMessage, refreshDq, useCanFreeText, useComm } from './state';
import './comm.css';

/** tepki → resimli ikon (emoji değil) */
export const REACTION_ART: Record<ChatReaction, ArtName> = { alkis: 'party', kalp: 'heart', ates: 'flame', yildiz: 'star', guc: 'bolt' };
const FEED_ART: Record<string, ArtName> = { bolum: 'star', boss: 'monster', koklea: 'shell', bina: 'hammer', uye: 'users', seri: 'flame', yardim: 'help', meydan: 'finish', sira: 'trophy', tyaris: 'flag' };
const FEED_KICKER: Record<string, string> = { bolum: 'Bölüm geçti', boss: 'Canavar yenildi', koklea: 'Altın koklea', bina: 'Kamp', uye: 'Yeni üye', seri: 'Oyun serisi', yardim: 'Birlikte başardınız', meydan: 'Meydan okuma', sira: 'Sıralama', tyaris: 'Takım Yarışı' };
const cap = (t: string) => t.charAt(0).toLocaleUpperCase('tr') + t.slice(1);
const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

export const phrasesFor = (...ctx: PhraseCtx[]) => QUICK_PHRASES.filter((p) => p.ctx.some((c) => ctx.includes(c)));

async function sendIn(room: string, text: string, kind: 'text' | 'hazir', replyTo?: string): Promise<boolean> {
  const c = getNet(); if (!c) return false;
  try { await c.call('chat.send', { room, text, kind, ...(replyTo ? { replyTo } : {}) }); platform().haptic('light'); return true; }
  catch (e) { toast('🙈', 'Gönderilemedi', errText(e), 'bronze'); return false; }
}

/** Hazır sözler şeridi (yatay kaydırılır): tek dokunuşla gönderir */
export function PhraseStrip({ ctx, ids, onPick, className, label = 'Hazır sözler' }: { ctx: PhraseCtx[]; ids?: string[]; onPick: (id: string) => void; className?: string; label?: string }) {
  const list = ids ? ids.map((id) => QUICK_PHRASES.find((p) => p.id === id)).filter((p): p is (typeof QUICK_PHRASES)[number] => !!p) : phrasesFor(...ctx);
  return (
    <div className={`phrase-row${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {list.map((p) => <button key={p.id} type="button" className="phrase" data-phrase={p.id} onClick={() => onPick(p.id)}>{p.text}</button>)}
    </div>
  );
}

/** Tepki çubuğu: 5 sabit tepki, sayılar; benim tepkim vurgulu. compact: yalnız verilmiş tepkiler + ekle düğmesi */
export function ReactionBar({ msg, compact }: { msg: ChatMessage; compact?: boolean }) {
  const me = useNet((x) => x.me?.id ?? '');
  const [open, setOpen] = useState(false);
  const mine = Object.entries(msg.reactions ?? {}).find(([, ids]) => ids.includes(me))?.[0] ?? '';
  const react = async (r: ChatReaction) => {
    const res = await act('chat.react', { msgId: msg.id, reaction: r === mine ? '' : r });
    if (res) { patchMessage({ ...res.msg, ...(msg.thread ? { thread: res.msg.thread ?? msg.thread } : {}) }); platform().haptic('light'); }
    setOpen(false);
  };
  const shown = compact && !open ? CHAT_REACTIONS.filter((r) => (msg.reactions?.[r]?.length ?? 0) > 0) : [...CHAT_REACTIONS];
  return (
    <div className={`react-bar${compact ? ' compact' : ''}`} role="group" aria-label="Tepkiler">
      {shown.map((r) => {
        const cnt = msg.reactions?.[r]?.length ?? 0;
        return <button key={r} type="button" className={`react${mine === r ? ' on' : ''}${cnt ? ' has' : ''}`} data-reaction={r} onClick={() => void react(r)} aria-pressed={mine === r} aria-label={`${REACTION_LABEL[r]}${cnt ? `: ${cnt}` : ''}`}>
          <Art name={REACTION_ART[r]} size={18} />{cnt > 0 && <span className="rc">{cnt}</span>}
        </button>;
      })}
      {compact && !open && <button type="button" className="react add" onClick={() => setOpen(true)} aria-label="Tepki ekle"><Art name="plus" size={16} /></button>}
    </div>
  );
}

/** konunun son yanıtları + "tümü" */
export function ThreadPreview({ parent, live, onOpen }: { parent: ChatMessage; live: ChatMessage[]; onOpen: () => void }) {
  const all = useMemo(() => {
    const m = new Map<string, ChatMessage>();
    for (const r of parent.thread ?? []) m.set(r.id, r);
    for (const r of live) m.set(r.id, r);
    return [...m.values()].sort((a, b) => a.at - b.at);
  }, [parent.thread, live]);
  const total = Math.max(parent.replies ?? 0, all.length);
  if (!total) return null;
  const last = all.slice(-COMM_RULES.threadPreview);
  return (
    <div className="thread" data-testid="konu">
      {last.map((r) => (
        <div key={r.id} className={`th-line${r.from === 'sistem' ? ' sys' : ''}`}>
          {r.from !== 'sistem' && <button type="button" className="th-who linkish" style={{ color: hex(r.color) }} onClick={() => openProfile(r.from)}>{r.name}</button>}
          <span className="th-text" data-ugc>{r.text}</span>
        </div>
      ))}
      {total > last.length && <button type="button" className="th-more linkish" onClick={onOpen}>{total} yanıtın tümü</button>}
    </div>
  );
}

/** konu sayfası: tüm yanıtlar + hazır söz / (izinliyse) yazı */
export function ThreadSheet({ parent, onClose, ctx = ['tebrik', 'genel', 'tesekkur'] }: { parent: ChatMessage; onClose: () => void; ctx?: PhraseCtx[] }) {
  const [replies, setReplies] = useState<ChatMessage[] | null>(null);
  const live = useNet((x) => x.messages[parent.room]);
  const free = useCanFreeText();
  const [text, setText] = useState('');
  useEffect(() => {
    const c = getNet(); if (!c) return;
    let on = true;
    c.call('chat.thread', { msgId: parent.id }).then((r) => { if (on) setReplies(r.replies); }, (e) => { if (on) { setReplies([]); toast('🙈', 'Yüklenemedi', errText(e), 'bronze'); } });
    return () => { on = false; };
  }, [parent.id]);
  const all = useMemo(() => {
    const m = new Map<string, ChatMessage>();
    for (const r of replies ?? []) m.set(r.id, r);
    for (const r of live ?? []) if (r.replyTo === parent.id) m.set(r.id, r);
    return [...m.values()].sort((a, b) => a.at - b.at);
  }, [replies, live, parent.id]);
  return (
    <Sheet title="Konu" onClose={onClose}>
      <div className="th-parent muted wrap" data-ugc>{parent.text}</div>
      <div className="th-list" data-testid="konu-sayfasi">
        {replies === null ? <div className="muted">Yükleniyor…</div> : all.length === 0 ? <div className="muted">İlk yanıtı sen yaz.</div> : all.map((r) => (
          <div key={r.id} className={`th-line big${r.from === 'sistem' ? ' sys' : ''}`}>
            {r.from !== 'sistem' && <b style={{ color: hex(r.color) }}>{r.name}</b>}<span className="th-text" data-ugc>{r.text}</span><span className="msg-time">{fmtTime(r.at)}</span>
          </div>
        ))}
      </div>
      <PhraseStrip ctx={ctx} onPick={(id) => void sendIn(parent.room, id, 'hazir', parent.id)} />
      {free && (
        <form className="chat-input th-input" onSubmit={async (e) => { e.preventDefault(); if (text.trim() && await sendIn(parent.room, text, 'text', parent.id)) setText(''); }}>
          <input className="input" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Yanıt yaz…" aria-label="Yanıt" />
          <button className="btn small" type="submit" disabled={!text.trim()}>Gönder</button>
        </form>
      )}
    </Sheet>
  );
}

/** Takım Akışı kartı */
export function FeedCard({ m, live, rich = true }: { m: ChatMessage; live: ChatMessage[]; rich?: boolean }) {
  const me = useNet((x) => x.me?.id);
  const type = s(m.meta?.type);
  const [thread, setThread] = useState(false);
  const nav = useNav();
  const highest = useStore((x) => x.highestUnlocked());
  if (!rich) return <div className="msg-sys kind-feed"><Art name={FEED_ART[type] ?? 'spark'} size="1.2em" className="art-inline" /> {m.text}</div>;
  const own = s(m.meta?.pid) === me;
  const cheerId = type === 'uye' ? 'hosgeldin' : 'tebrik';
  const level = n(m.meta?.level);
  let body: ReactNode = null;
  if (type === 'bolum') {
    const lv = s(m.meta?.levels).split(',').filter(Boolean);
    const st = n(m.meta?.stars);
    body = lv.length <= 1
      ? <div className="fc-stars3" aria-label={`${st} yıldız`}>{[0, 1, 2].map((i) => <span key={i} className={i < st ? 'on' : ''}><Art name="star" size={22} /></span>)}</div>
      : <div className="fc-chips">{lv.slice(0, 6).map((l) => <span key={l} className="fc-chip">{l}</span>)}{lv.length > 6 && <span className="fc-chip more">+{lv.length - 6}</span>}<span className="fc-stars"><Art name="star" size={16} /> {st}</span></div>;
  } else if (type === 'meydan') {
    body = (
      <div className="fc-duel">
        <span className="fc-score"><b>{fmtNum(n(m.meta?.score))}</b><small>puan · {level}. bölüm</small></span>
        {n(m.meta?.beaten) > 0 && <span className="fc-beaten">{n(m.meta?.beaten)} kişi geçti</span>}
        {!own && <button type="button" className="btn small" data-testid="meydan-oyna" disabled={level > highest} onClick={() => nav.play(level)}>{level > highest ? `${level}. bölüm kilitli` : 'Oyna'}</button>}
      </div>
    );
  } else if (type === 'tyaris') {
    const o = s(m.meta?.outcome);
    body = <div className="fc-duel" data-testid="tr-akis"><span className="fc-score"><b>{n(m.meta?.us)} – {n(m.meta?.them)}</b><small>{o === 'win' ? 'kazandık' : o === 'draw' ? 'berabere' : 'kaybettik'} · <span data-ugc>{s(m.meta?.rivalEmblem)}</span> {s(m.meta?.rivalName)}</small></span><button type="button" className="btn small ghost" data-testid="tr-akis-rovans" onClick={async () => { const x = await act('trace.rematch', { matchId: s(m.meta?.matchId) }); if (x) toast('🔁', 'Rövanş daveti gönderildi', 'Takım › Takım Yarışı', 'green'); }}>Rövanş</button></div>;
  } else if (type === 'sira') {
    body = <div className="fc-duel"><span className="fc-score"><b>{n(m.meta?.rank)}.</b><small>{fmtNum(n(m.meta?.value))} · geçen hafta</small></span><button type="button" className="btn small ghost" onClick={() => nav.open({ name: 'siralama' })}>Sıralamayı aç</button></div>;
  }
  return (
    <div className={`fcard t-${type}${own ? ' own' : ''}`} data-testid="akis-karti" data-type={type} data-id={m.id}>
      <div className="fc-head">
        <button type="button" className="fc-av" onClick={() => s(m.meta?.pid) && openProfile(s(m.meta?.pid))} aria-label={`${s(m.meta?.pname)} profili`}>
          <OdiAvatar size={38} color={n(m.meta?.pc) || 0x8b6bff} hat={hatKey(s(m.meta?.ph))} mood={type === 'boss' || type === 'koklea' ? 'wow' : 'happy'} />
          <span className="fc-badge"><Art name={FEED_ART[type] ?? 'spark'} size={16} /></span>
        </button>
        <div className="fc-txt min0"><small>{FEED_KICKER[type] ?? 'Takım Akışı'} · {fmtTime(m.at)}</small><b>{m.text}</b></div>
      </div>
      {body}
      <div className="fc-foot">
        <ReactionBar msg={m} />
        <span className="grow" />
        {!own && <button type="button" className="fc-cheer" data-testid="tebrik-et" onClick={() => void sendIn(m.room, cheerId, 'hazir', m.id)}><Art name={type === 'uye' ? 'users' : 'party'} size={18} />{type === 'uye' ? 'Hoş geldin de' : 'Tebrik et'}</button>}
        <button type="button" className="fc-ibtn" onClick={() => setThread(true)} aria-label="Yanıtla"><Art name="chat" size={18} /></button>
      </div>
      <ThreadPreview parent={m} live={live} onOpen={() => setThread(true)} />
      {thread && <ThreadSheet parent={m} onClose={() => setThread(false)} />}
    </div>
  );
}

/** Yardım kartı: ipucu, kalkan, birlikte yarış */
export function HelpCard({ m, live }: { m: ChatMessage; live: ChatMessage[] }) {
  const me = useNet((x) => x.me); const team = useNet((x) => x.team);
  const nav = useNav();
  const [tip, setTip] = useState(false); const [thread, setThread] = useState(false); const [busy, setBusy] = useState('');
  const reqId = s(m.meta?.requestId); const level = n(m.meta?.level); const asker = s(m.meta?.pid);
  const req = team?.help.find((h) => h.id === reqId);
  const mine = asker === me?.id || req?.from === me?.id;
  const done = !!m.meta?.done; const expired = !!req && req.expiresAt < Date.now();
  const gave = !!req && !!me && req.helpers.includes(me.id);
  const tipped = (m.thread ?? []).concat(live).some((r) => r.from === me?.id && r.meta?.tip);
  const shield = async () => { setBusy('k'); const r = await act('team.help.give', { requestId: reqId }); setBusy(''); if (r) { platform().haptic('success'); toast('🛡️', 'Kalkan gönderildi', `${req?.name ?? 'Takım arkadaşın'} bir sonraki denemesine kalkanla başlar.`, 'green'); } };
  const race = async () => { setBusy('y'); const r = await act('help.race', { requestId: reqId }); setBusy(''); if (r) nav.open({ name: 'race', inviteRoomId: r.room.id }); };
  const name = s(m.meta?.pname) || req?.name || 'Takım arkadaşın';
  return (
    <div className={`fcard t-help${done ? ' done' : ''}`} data-testid="yardim-karti" data-id={m.id} data-done={done ? '1' : '0'}>
      <div className="fc-head">
        <button type="button" className="fc-av" onClick={() => asker && openProfile(asker)} aria-label={`${name} profili`}>
          <OdiAvatar size={38} color={n(m.meta?.pc) || 0x8b6bff} hat={hatKey(s(m.meta?.ph))} mood="wow" />
          <span className="fc-badge"><Art name={done ? 'check' : 'help'} size={16} /></span>
        </button>
        <div className="fc-txt min0"><small>{done ? 'Geçildi' : 'Yardım istiyor'} · {fmtTime(m.at)}</small><b>{mine ? `${level}. bölüm için yardım istedin` : `${name}, ${level}. bölümde takıldı`}</b></div>
      </div>
      <div className="fc-help-stats"><span><Art name="bulb" size={16} /> {n(m.meta?.ipucu)} ipucu</span><span><Art name="shield" size={16} /> {n(m.meta?.kalkan)} kalkan</span><span><Art name="finish" size={16} /> {n(m.meta?.yaris)} yarış</span></div>
      {done ? <div className="fc-done"><Art name="party" size={18} /> {mine ? 'Geçtin! Yardım edenlere teşekkür ödülü gitti.' : `${name} bölümü geçti. Teşekkürler!`}</div>
        : mine ? <div className="muted small-note">Takım arkadaşların ipucu, kalkan ya da birlikte yarış gönderebilir. Geçince ikinize de ödül.</div>
          : expired ? <div className="muted small-note">Bu isteğin süresi doldu.</div>
            : (
              <div className="fc-actions">
                <button type="button" className="btn small teal" data-testid="ipucu-ver" aria-label="İpucu ver" disabled={tipped} onClick={() => setTip(true)}><Art name="bulb" size={16} className="art-inline" /> {tipped ? 'Verdin' : 'İpucu'}</button>
                <button type="button" className="btn small" data-testid="kalkan-gonder" aria-label="Kalkan gönder" disabled={gave || busy === 'k' || (!!req && req.helpers.length >= req.max)} onClick={() => void shield()}><Art name="shield" size={16} className="art-inline" /> {gave ? 'Gönderildi' : 'Kalkan'}</button>
                <button type="button" className="btn small coral" data-testid="birlikte-yaris" aria-label="Birlikte yarış" disabled={busy === 'y'} onClick={() => void race()}><Art name="finish" size={16} className="art-inline" /> Yarış</button>
              </div>
            )}
      <div className="fc-foot"><ReactionBar msg={m} compact /><span className="grow" /><button type="button" className="fc-ibtn" onClick={() => setThread(true)} aria-label="Yanıtla"><Art name="chat" size={18} /></button></div>
      <ThreadPreview parent={m} live={live} onOpen={() => setThread(true)} />
      {tip && <TipSheet requestId={reqId} name={name} level={level} onClose={() => setTip(false)} />}
      {thread && <ThreadSheet parent={m} onClose={() => setThread(false)} ctx={['ipucu', 'tebrik', 'tesekkur']} />}
    </div>
  );
}

function TipSheet({ requestId, name, level, onClose }: { requestId: string; name: string; level: number; onClose: () => void }) {
  const free = useCanFreeText(); const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const send = async (d: { phrase?: string; text?: string }) => {
    setBusy(true); const r = await act('help.tip', { requestId, ...d }); setBusy(false);
    if (r) { platform().haptic('success'); toast('💡', 'İpucun gitti', `${name} geçerse ikinize de teşekkür ödülü.`, 'green'); onClose(); }
  };
  return (
    <Sheet title={`${name} için ipucu`} onClose={onClose}>
      <div className="muted small-note">{level}. bölümde işe yarayan bir ipucu seç{free ? ' ya da kendin yaz' : ''}. İpucu kartın altında görünür.</div>
      <div className="tip-list">{phrasesFor('ipucu').map((p) => <button key={p.id} type="button" className="tip-opt" data-phrase={p.id} disabled={busy} onClick={() => void send({ phrase: p.id })}><Art name="bulb" size={18} /> {cap(p.text.replace(/^İpucu: /, ''))}</button>)}</div>
      {free && (
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send({ text: text.trim() }); }}>
          <input className="input" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Kendi ipucunu yaz…" aria-label="İpucu" />
          <button className="btn small" type="submit" disabled={!text.trim() || busy}>Gönder</button>
        </form>
      )}
    </Sheet>
  );
}

/** Günün Sorusu kartı (Tüy Dede) */
export function QuestionCard({ m, live }: { m: ChatMessage; live: ChatMessage[] }) {
  const dq = useComm((x) => x.dq);
  const [thread, setThread] = useState(false); const [board, setBoard] = useState(false); const [busy, setBusy] = useState(false);
  const q = dq?.question?.msgId === m.id ? dq.question : null;
  const rev = !!m.meta?.rev; const ans = rev ? n(m.meta?.ans) : null;
  const my = q?.myChoice ?? null;
  const choices = [0, 1, 2, 3].map((i) => s(m.meta?.[`c${i}`])).filter(Boolean);
  const answer = async (i: number) => {
    setBusy(true);
    const r = await act('dq.answer', { choice: i });
    setBusy(false);
    if (r) { useComm.setState({ dq: r }); platform().haptic('light'); }
  };
  useEffect(() => { if (!dq) void refreshDq(); }, []);
  const revealAt = n(m.meta?.revealAt);
  return (
    <div className={`fcard t-soru${rev ? ' revealed' : ''}`} data-testid="gunun-sorusu" data-id={m.id} data-rev={rev ? '1' : '0'}>
      <div className="fc-head">
        <span className="fc-av dede"><TuyDede size={40} mood={rev ? 'wink' : 'happy'} /></span>
        <div className="fc-txt min0"><small>Günün Sorusu{s(m.meta?.lvl) === 'odyoloji' ? ' · Çalışma Grubu' : ''} · Tüy Dede</small><b>{m.text}</b></div>
      </div>
      <div className="dq-choices">
        {choices.map((c, i) => {
          const cls = rev ? (i === ans ? ' ok' : i === my ? ' bad' : ' dim') : i === my ? ' picked' : '';
          return <button key={i} type="button" className={`dq-opt${cls}`} data-choice={i} disabled={busy || my !== null || rev} onClick={() => void answer(i)}>
            <span className="dq-l">{'ABCD'[i]}</span><span className="dq-t">{c}</span>{rev && i === ans && <Art name="check" size={18} />}{rev && i === my && i !== ans && <Art name="cross" size={18} />}
          </button>;
        })}
      </div>
      {rev ? (
        <div className="dq-exp">
          <p>{s(m.meta?.exp)}</p>
          <small className="muted">{n(m.meta?.okn) ? `Doğru bilenler (${n(m.meta?.okn)}): ${s(m.meta?.ok)}` : 'Bu kez doğru bilen olmadı; yarın yeni soru!'}{my === ans && my !== null ? ` · ödül kutuna ${dq?.reward ?? COMM_RULES.dqCorrectJeton} jeton` : ''}</small>
        </div>
      ) : (
        <div className="muted small-note dq-wait">{my !== null ? 'Cevabın kaydedildi. ' : ''}{n(m.meta?.n)} kişi cevapladı · cevap {revealAt ? fmtTime(revealAt) : '20:00'}’de açıklanır{my === null ? ' · doğru bilene jeton' : ''}</div>
      )}
      <div className="fc-foot">
        <ReactionBar msg={m} compact />
        <span className="grow" />
        <button type="button" className="fc-reply linkish" onClick={() => setBoard(true)}>Haftalık tablo</button>
        <button type="button" className="fc-reply linkish" data-testid="tartis" onClick={() => setThread(true)}>Tartış</button>
      </div>
      <ThreadPreview parent={m} live={live} onOpen={() => setThread(true)} />
      {thread && <ThreadSheet parent={m} onClose={() => setThread(false)} ctx={['genel', 'tebrik']} />}
      {board && <BoardSheet onClose={() => setBoard(false)} />}
    </div>
  );
}

function BoardSheet({ onClose }: { onClose: () => void }) {
  const dq = useComm((x) => x.dq); const me = useNet((x) => x.me?.id);
  useEffect(() => { void refreshDq(); }, []);
  return (
    <Sheet title="Günün Sorusu · bu hafta" onClose={onClose}>
      <div className="muted small-note">Açıklanan sorulardaki doğru cevaplar. Her doğru cevaba {dq?.reward ?? COMM_RULES.dqCorrectJeton} jeton.</div>
      {!dq?.week.length ? <div className="muted">Bu hafta henüz açıklanan soru yok.</div> : (
        <ol className="dq-board">{dq.week.map((r, i) => <li key={r.id} className={r.id === me ? 'me' : ''}><span className="rk">{i + 1}</span><span className="grow ellipsis" style={{ color: hex(r.color) }}>{r.name}</span><b>{r.correct}</b><small className="muted">/{r.answered}</small></li>)}</ol>
      )}
    </Sheet>
  );
}

/** Kim çevrimiçi: takım üyeleri (gerçek bağlantı) */
export function OnlineRow({ members }: { members: { id: string; name: string; color: number; hat: string; online: boolean }[] }) {
  const pres = useNet((x) => x.presence); const me = useNet((x) => x.me?.id);
  const on = members.filter((m) => m.id !== me && (pres[m.id] ?? m.online));
  return (
    <div className={`online-row${on.length ? '' : ' none'}`} data-testid="kim-cevrimici" aria-label={`Çevrimiçi: ${on.length}`}>
      <span className="or-dot" aria-hidden /><small>{on.length ? `${on.length} çevrimiçi` : 'Şu an kimse çevrimiçi değil'}</small>
      <span className="or-avs">{on.slice(0, 8).map((m) => <button key={m.id} type="button" className="or-av" onClick={() => openProfile(m.id)} aria-label={`${m.name} çevrimiçi`} title={m.name}><OdiAvatar size={26} color={m.color} hat={hatKey(m.hat)} /></button>)}{on.length > 8 && <span className="or-more">+{on.length - 8}</span>}</span>
    </div>
  );
}

/** güvenli sohbet notu: serbest yazı 8 bölüm geçilene kadar kapalıdır (açma seçeneği yok) — dürüst açıklama + kurallar */
export function SafeChatSheet({ onClose }: { onClose: () => void }) {
  const lim = useComm((x) => x.settings?.freeTextLevel ?? COMM_RULES.freeTextLevel);
  const me = useNet((x) => x.me);
  const left = Math.max(0, lim - Math.max(0, (me?.highest ?? 1) - 1));
  return (
    <Sheet title="Güvenli sohbet" onClose={onClose}>
      <div className="muted wrap" data-testid="serbest-not">Serbest yazı {lim}. bölümden sonra açılır{left > 0 ? ` (${left} bölüm kaldı)` : ''}. O zamana kadar hazır sözler ve emojiyle konuşursun; böylece herkes güvende başlar.</div>
      <ul className="rules">
        <li><Art name="shield" size={18} /> Kötü sözler otomatik yıldızlanır.</li>
        <li><Art name="flag" size={18} /> Bir mesajı üç farklı kişi şikâyet ederse gizlenir, gönderen 10 dk yazamaz.</li>
        <li><Art name="mute" size={18} /> Rahatsız olduğun kişiyi sessize alabilir ya da engelleyebilirsin.</li>
        <li><Art name="lock" size={18} /> Kişisel bilgini (adres, telefon, okul) paylaşma.</li>
      </ul>
      <button className="btn" data-testid="guvenli-tamam" onClick={onClose}>Tamam, hazır sözlerle devam</button>
    </Sheet>
  );
}
