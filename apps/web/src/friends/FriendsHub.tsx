import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import { FRIEND_LIMITS, type FriendRequest, type FriendSuggestion, type PublicProfile, type SearchHit } from '@odi/shared';
import { act, errText, toast } from '../net';
import { platform } from '../platform';
import { useNav } from '../nav';
import { Empty, Sheet, Skeleton, SubTabs } from '../ui/social';
import { Av, giftFriend, infoLine, raceWith, requestFriend, useOnline } from './common';
import { friendsNet, openProfile, refreshFriends, useFriends } from './state';
import './friends.css';
import { IconButton } from '../ui/Button';

type T = 'arkadaslar' | 'istekler' | 'oneriler';

/** Arkadaşlar: kodum, arama (isim/kod), sekmeler: Arkadaşlar · İstekler · Öneriler; Mesajlar kısayolu. */
export function FriendsHub({ raceReady = true }: { raceReady?: boolean }) {
  const me = useNet((s) => s.me)!;
  const incoming = useFriends((s) => s.incoming.length);
  const [tab, setTab] = useState<T>(() => (useFriends.getState().incoming.length ? 'istekler' : 'arkadaslar'));
  const [q, setQ] = useState('');
  const friends = useFriends((s) => s.friends);
  useEffect(() => { void refreshFriends(); }, []);
  const searching = q.trim().length > 0;
  return (
    <div className="stack fr-hub">
      <MyCode code={me.friendCode} />
      <div className="fr-search">
        <span aria-hidden className="fr-search-ico">🔎</span>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim ya da arkadaş kodu ara" aria-label="Oyuncu ara" enterKeyHint="search" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={30} />
        {searching && <button className="fr-search-x" onClick={() => setQ('')} aria-label="Aramayı temizle">✕</button>}
      </div>
      {searching ? <SearchResults q={q.trim()} /> : (
        <>
          <SubTabs<T> active={tab} onChange={setTab} tabs={[
            { id: 'arkadaslar', icon: '🫂', label: `Arkadaşlar${friends ? ` ${friends.length}` : ''}` },
            { id: 'istekler', icon: '📨', label: 'İstekler', badge: incoming },
            { id: 'oneriler', icon: '✨', label: 'Öneriler' },
          ]} />
          {tab === 'arkadaslar' && <FriendList raceReady={raceReady} onFind={() => setTab('oneriler')} />}
          {tab === 'istekler' && <Requests />}
          {tab === 'oneriler' && <Suggestions />}
        </>
      )}
    </div>
  );
}

function MyCode({ code }: { code: string }) {
  const share = async () => { const r = await platform().share(`ODİ'de arkadaş olalım! Arkadaş kodum: ${code}`); if (r === 'copied') toast('📋', 'Kod kopyalandı', code); };
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast('📋', 'Kod kopyalandı', code); } catch { void share(); } };
  return (
    <div className="card fr-mycode">
      <div className="min0 grow">
        <span className="muted small-note">Arkadaş kodun</span>
        <b className="fr-code" aria-label={`Arkadaş kodun ${code.split('').join(' ')}`}>{code}</b>
      </div>
      <IconButton icon="copy" label="Kodu kopyala" tone="teal" onClick={() => void copy()} />
      <button className="btn small" onClick={() => void share()} aria-label="Kodu paylaş">📣 Paylaş</button>
    </div>
  );
}

function RelBtn({ hit, onDone }: { hit: SearchHit; onDone: (r: SearchHit['relation']) => void }) {
  const [busy, setBusy] = useState(false);
  const incoming = useFriends((s) => s.incoming.find((r) => r.from.id === hit.profile.id));
  const p = hit.profile;
  if (hit.relation === 'arkadas') return <span className="fr-state ok">Arkadaş ✓</span>;
  if (hit.relation === 'istek-giden') return <span className="fr-state">İstek gitti</span>;
  if (hit.relation === 'engelledin') return <span className="fr-state">Engelli</span>;
  if (hit.relation === 'istek-gelen' && incoming) return <button className="btn small" disabled={busy} onClick={async () => { setBusy(true); if (await act('friends.respond', { requestId: incoming.id, accept: true })) { void refreshFriends(); onDone('arkadas'); } setBusy(false); }}>Kabul et</button>;
  return <button className="btn small" disabled={busy} aria-label={`${p.name} ekle`} onClick={async () => { setBusy(true); const r = await requestFriend(p); if (r) onDone(r === 'arkadas' ? 'arkadas' : 'istek-giden'); setBusy(false); }}>➕ Ekle</button>;
}

function SearchResults({ q }: { q: string }) {
  const [res, setRes] = useState<{ q: string; hits: SearchHit[]; more: boolean; page: number } | null>(null);
  const [err, setErr] = useState('');
  const short = [...q].length < FRIEND_LIMITS.searchMin;
  useEffect(() => {
    if (short) { setRes(null); setErr(''); return; }
    const c = friendsNet(); if (!c) return;
    let alive = true;
    const h = setTimeout(() => { c.call('players.search', { query: q }).then((r) => { if (alive) { setErr(''); setRes({ q, hits: r.players, more: r.hasMore, page: 0 }); } }, (e) => { if (alive) setErr(errText(e)); }); }, 300);
    return () => { alive = false; clearTimeout(h); };
  }, [q, short]);
  const more = async () => {
    const c = friendsNet(); if (!c || !res) return;
    try { const r = await c.call('players.search', { query: res.q, page: res.page + 1 }); setRes({ ...res, hits: [...res.hits, ...r.players], more: r.hasMore, page: res.page + 1 }); } catch (e) { setErr(errText(e)); }
  };
  const setRel = (id: string, relation: SearchHit['relation']) => setRes((r) => (r ? { ...r, hits: r.hits.map((h) => (h.profile.id === id ? { ...h, relation } : h)) } : r));
  if (short) return <div className="muted small-note fr-hint">Aramak için en az {FRIEND_LIMITS.searchMin} harf yaz. 6 karakterlik arkadaş kodunu da yazabilirsin.</div>;
  if (err) return <div className="chat-err" role="alert">{err}</div>;
  if (!res || res.q !== q) return <Skeleton rows={2} />;
  if (!res.hits.length) return <Empty icon="🔍" title="Kimseyi bulamadık" text={`“${q}” adında bir oyuncu yok. Arkadaşından kodunu isteyebilirsin.`} />;
  return (
    <div className="stack" aria-label="Arama sonuçları">
      {res.hits.map((h) => (
        <div className="card fr-row" key={h.profile.id} data-testid="arama-sonucu">
          <button className="fr-row-main" onClick={() => openProfile(h.profile.id)} aria-label={`${h.profile.name} profili`}>
            <Av p={h.profile} />
            <span className="min0 grow fr-row-text"><b className="ellipsis">{h.profile.name}</b><small className="ellipsis">⭐ {h.profile.stars} · {infoLine(h.profile)}</small></span>
          </button>
          <RelBtn hit={h} onDone={(r) => setRel(h.profile.id, r)} />
        </div>
      ))}
      {res.more && <button className="btn ghost" onClick={() => void more()}>Daha fazla göster</button>}
    </div>
  );
}

function FriendRow({ f, raceReady }: { f: PublicProfile; raceReady: boolean }) {
  const nav = useNav();
  const online = useOnline(f);
  const gifted = useFriends((s) => s.gifted.includes(f.id));
  const unread = useFriends((s) => s.threads?.find((t) => t.other.id === f.id)?.unread ?? 0);
  const [busy, setBusy] = useState(false);
  return (
    <div className={`card fr-row${online ? ' online' : ''}`} data-testid="arkadas-satiri">
      <button className="fr-row-main" onClick={() => openProfile(f.id)} aria-label={`${f.name} profili`}>
        <Av p={f} />
        <span className="min0 grow fr-row-text">
          <b className="ellipsis">{f.name}</b>
          <small className="ellipsis">{online && <span className="fr-on" aria-label="çevrimiçi">● </span>}{f.highest}. bölüm{f.teamEmblem ? ` · ${f.teamEmblem}` : ''}</small>
        </span>
      </button>
      <div className="fr-acts">
        <button className="fr-act rel" onClick={() => nav.open({ name: 'dm', id: f.id })} aria-label={`${f.name} ile mesajlaş`}><span aria-hidden>💬</span><small>Mesaj</small>{unread > 0 && <span className="sbadge abs">{unread}</span>}</button>
        <button className={`fr-act${gifted ? ' done' : ''}`} disabled={gifted || busy} onClick={async () => { setBusy(true); await giftFriend(f); setBusy(false); }} aria-label={gifted ? `${f.name} için bugünkü hediye gönderildi` : `${f.name} için hediye gönder`}><span aria-hidden>{gifted ? '✅' : '🎁'}</span><small>{gifted ? 'Gitti' : 'Hediye'}</small></button>
        {raceReady && <button className="fr-act race" onClick={() => void raceWith(f, nav)} aria-label={`${f.name} ile yarış`}><span aria-hidden>🏁</span><small>Yarış</small></button>}
      </div>
    </div>
  );
}

function FriendList({ raceReady, onFind }: { raceReady: boolean; onFind: () => void }) {
  const nav = useNav();
  const friends = useFriends((s) => s.friends);
  const presence = useNet((s) => s.presence);
  const [blocked, setBlocked] = useState(false);
  if (!friends) return <Skeleton rows={3} />;
  const on = (f: PublicProfile) => presence[f.id] ?? f.online;
  const sorted = [...friends].sort((a, b) => Number(on(b)) - Number(on(a)) || b.lastSeen - a.lastSeen || a.name.localeCompare(b.name, 'tr'));
  const onlineN = sorted.filter(on).length;
  return (
    <div className="stack">
      {sorted.length === 0
        ? <Empty icon="🫂" title="Henüz arkadaşın yok" text="Kodunu paylaş, yukarıdan isimle ara ya da önerilere göz at. Birlikte konuşup yarışabilir, her gün hediye gönderebilirsiniz.">
            <button className="btn small" onClick={onFind}>✨ Önerilere bak</button>
          </Empty>
        : <>
            <div className="fr-sub muted small-note">{onlineN > 0 ? `🟢 ${onlineN} arkadaşın şu an çevrimiçi` : 'Şu an kimse çevrimiçi değil; mesaj bırakabilirsin.'}</div>
            {sorted.map((f) => <FriendRow key={f.id} f={f} raceReady={raceReady} />)}
          </>}
      <div className="fr-foot">
        <button className="linkish" onClick={() => nav.open({ name: 'chat', room: 'genel', title: 'Genel sohbet' })}>🌍 Genel sohbet</button>
        <button className="linkish" onClick={() => setBlocked(true)}>🚫 Engellenenler</button>
      </div>
      {blocked && <BlockedSheet onClose={() => setBlocked(false)} />}
    </div>
  );
}

function BlockedSheet({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<PublicProfile[] | null>(null);
  useEffect(() => { const c = friendsNet(); if (c) void c.call('players.blocked', {}).then((r) => setList(r.players), () => setList([])); }, []);
  return (
    <Sheet title="Engellenenler" onClose={onClose}>
      {!list ? <Skeleton rows={2} /> : !list.length ? <div className="muted">Kimseyi engellemedin. 🌱</div> : list.map((p) => (
        <div className="fr-row plain" key={p.id}>
          <Av p={p} dot={false} size={40} /><b className="grow ellipsis">{p.name}</b>
          <button className="btn ghost small" onClick={async () => { if (await act('players.unblock', { id: p.id })) { setList((l) => l?.filter((x) => x.id !== p.id) ?? null); toast('✅', `${p.name} engeli kaldırıldı`); } }}>Kaldır</button>
        </div>
      ))}
    </Sheet>
  );
}

function ReqRow({ r, dir }: { r: FriendRequest; dir: 'in' | 'out' }) {
  const p = dir === 'in' ? r.from : r.to;
  const [busy, setBusy] = useState(false);
  const respond = async (accept: boolean) => {
    setBusy(true);
    const res = await act('friends.respond', { requestId: r.id, accept });
    if (res) {
      useFriends.setState((s) => ({ incoming: s.incoming.filter((x) => x.id !== r.id), friends: res.friend ? [...(s.friends ?? []).filter((f) => f.id !== p.id), res.friend] : s.friends }));
      if (accept) { platform().haptic('success'); toast('🫂', `${p.name} artık arkadaşın`, 'Hadi bir merhaba yaz!', 'green'); }
    }
    setBusy(false);
  };
  const cancel = async () => { setBusy(true); if (await act('friends.cancel', { requestId: r.id })) useFriends.setState((s) => ({ outgoing: s.outgoing.filter((x) => x.id !== r.id) })); setBusy(false); };
  return (
    <div className={`card fr-row${dir === 'in' ? ' wrap' : ''}`} data-testid={dir === 'in' ? 'gelen-istek' : 'giden-istek'}>
      <button className="fr-row-main" onClick={() => openProfile(p.id)} aria-label={`${p.name} profili`}>
        <Av p={p} />
        <span className="min0 grow fr-row-text"><b className="ellipsis">{p.name}</b><small className="ellipsis">{dir === 'in' ? `seninle arkadaş olmak istiyor · ⭐ ${p.stars} · ${p.highest}. bölüm` : 'yanıt bekleniyor'}</small></span>
      </button>
      {dir === 'in'
        ? <div className="fr-req-btns"><button className="btn small" disabled={busy} onClick={() => void respond(true)}>✓ Kabul</button><button className="btn ghost small" disabled={busy} onClick={() => void respond(false)}>Reddet</button></div>
        : <button className="btn ghost small" disabled={busy} onClick={() => void cancel()}>İptal</button>}
    </div>
  );
}

function Requests() {
  const incoming = useFriends((s) => s.incoming); const outgoing = useFriends((s) => s.outgoing);
  if (!incoming.length && !outgoing.length) return <Empty icon="📨" title="Bekleyen istek yok" text="Biri seni eklemek istediğinde burada görünür; sen de yukarıdan isimle arayıp istek gönderebilirsin." />;
  return (
    <div className="stack">
      {incoming.length > 0 && <h2 className="fr-h">Gelen istekler <span className="sbadge">{incoming.length}</span></h2>}
      {incoming.map((r) => <ReqRow key={r.id} r={r} dir="in" />)}
      {outgoing.length > 0 && <h2 className="fr-h">Gönderdiklerin</h2>}
      {outgoing.map((r) => <ReqRow key={r.id} r={r} dir="out" />)}
    </div>
  );
}

const REASON_ICON: Record<FriendSuggestion['kind'], string> = { takim: '🤝', yaris: '🏁', ortak: '🫂', lig: '🏆' };
function Suggestions() {
  const [list, setList] = useState<FriendSuggestion[] | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; const c = friendsNet(); if (c) void c.call('friends.suggest', {}).then((r) => { if (mounted.current) setList(r.suggestions); }, () => setList([])); return () => { mounted.current = false; }; }, []);
  if (!list) return <Skeleton rows={3} />;
  if (!list.length) return <Empty icon="✨" title="Şimdilik öneri yok" text="Bir takıma katıl, canlı yarışa gir ya da ligde oyna: tanıştığın oyuncular burada belirir." />;
  return (
    <div className="stack">
      {list.map((s) => (
        <div className="card fr-row" key={s.profile.id} data-testid="oneri">
          <button className="fr-row-main" onClick={() => openProfile(s.profile.id)} aria-label={`${s.profile.name} profili`}>
            <Av p={s.profile} />
            <span className="min0 grow fr-row-text"><b className="ellipsis">{s.profile.name}</b><small className="fr-reason">{REASON_ICON[s.kind]} {s.reason}</small></span>
          </button>
          {sent[s.profile.id] ? <span className="fr-state">İstek gitti</span>
            : <button className="btn small" onClick={async () => { const r = await requestFriend(s.profile); if (r) setSent((x) => ({ ...x, [s.profile.id]: true })); }}>➕ Ekle</button>}
        </div>
      ))}
    </div>
  );
}
