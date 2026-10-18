import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import type { PublicProfile } from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { useNav } from '../nav';
import { OdiAvatar } from '../ui/OdiAvatar';
import { ScreenHead } from '../ui/bits';
import { ChatRoom } from '../ui/Chat';
import { Empty, Online, Sheet, Skeleton } from '../ui/social';
import { hatKey } from './team/TeamMembers';

const dmRoom = (a: string, b: string) => (a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`);

/** Arkadaşlar: kodum (kopyala/paylaş), kodla ekle, liste, 1-1 sohbet, yarışa davet, genel sohbet. */
export function FriendsScreen({ onBack, raceReady }: { onBack: () => void; raceReady: boolean }) {
  return (
    <div className="screen fade-in">
      <ScreenHead title="Arkadaşlar" onBack={onBack} />
      <Online what="Arkadaşlar ve sohbet"><Friends raceReady={raceReady} /></Online>
    </div>
  );
}

function Friends({ raceReady }: { raceReady: boolean }) {
  const me = useNet((s) => s.me)!; const presence = useNet((s) => s.presence); const unread = useNet((s) => s.unread);
  const nav = useNav();
  const [list, setList] = useState<PublicProfile[] | null>(null);
  const [code, setCode] = useState(''); const [err, setErr] = useState('');
  const [sel, setSel] = useState<PublicProfile | null>(null);

  useEffect(() => {
    const c = getNet(); if (!c) return;
    void c.call('friends.list', {}).then((r) => setList(r.friends)).catch((e) => setErr(errText(e)));
    const off = c.on('friend.updated', ({ friend }) => setList((l) => (l ? (l.some((f) => f.id === friend.id) ? l.map((f) => (f.id === friend.id ? friend : f)) : [...l, friend]) : l)));
    return off;
  }, []);

  const add = async () => {
    const c = getNet(); if (!c || !code.trim()) return; setErr('');
    try { const r = await c.call('friends.add', { code: code.trim() }); setList((l) => [...(l ?? []).filter((f) => f.id !== r.friend.id), r.friend]); setCode(''); platform().haptic('success'); toast('🫂', `${r.friend.name} artık arkadaşın`, 'Özel sohbet ve yarış daveti açıldı.', 'green'); }
    catch (e) { setErr(errText(e)); }
  };
  const share = async () => { const r = await platform().share(`ODİ'de arkadaş olalım! Arkadaş kodum: ${me.friendCode}`); if (r === 'copied') toast('📋', 'Kod kopyalandı', me.friendCode); };
  const copy = async () => { try { await navigator.clipboard.writeText(me.friendCode); toast('📋', 'Kod kopyalandı', me.friendCode); } catch { void share(); } };
  const remove = async (f: PublicProfile) => { setSel(null); if (await act('friends.remove', { id: f.id })) { setList((l) => l?.filter((x) => x.id !== f.id) ?? null); toast('👋', `${f.name} listeden çıkarıldı`); } };
  const online = (f: PublicProfile) => presence[f.id] ?? f.online;
  const sorted = [...(list ?? [])].sort((a, b) => Number(online(b)) - Number(online(a)));

  return (
    <div className="stack">
      <div className="card my-code">
        <span className="muted">Arkadaş kodun</span>
        <b className="big-code" aria-label={`Arkadaş kodun ${me.friendCode.split('').join(' ')}`}>{me.friendCode}</b>
        <div className="row"><button className="btn ghost small grow" onClick={() => void copy()}>📋 Kopyala</button><button className="btn small grow" onClick={() => void share()}>📣 Paylaş</button></div>
      </div>
      <form className="card code-join" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <b>Kodla ekle</b>
        <div className="row"><input className="input grow" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ör. 7KQ2MX" aria-label="Arkadaş kodu" autoCapitalize="characters" /><button className="btn small" disabled={!code.trim()}>Ekle</button></div>
        {err && <div className="chat-err" role="alert">{err}</div>}
      </form>
      <button className="card genel-row" onClick={() => nav.open({ name: 'chat', room: 'genel', title: 'Genel sohbet' })}>
        <span aria-hidden>🌍</span><span className="grow"><b>Genel sohbet</b><span className="muted"> · herkesle konuş, yarış arkadaşı bul</span></span><span aria-hidden>›</span>
      </button>
      <h2 className="section-head">Arkadaşların {list ? `(${list.length})` : ''}</h2>
      {!list ? <Skeleton rows={3} /> : sorted.length === 0 ? <Empty icon="🫂" title="Henüz arkadaşın yok" text="Kodunu paylaş ya da bir arkadaşının kodunu ekle. Birlikte konuşup yarışabilirsiniz." /> : sorted.map((f) => { const room = dmRoom(me.id, f.id); const u = unread[room] ?? 0; return (
        <div className="card friend" key={f.id}>
          <button className="fr-main" onClick={() => setSel(f)} aria-label={`${f.name} seçenekleri`}>
            <span className="mem-av"><OdiAvatar size={40} color={f.color} hat={hatKey(f.hat)} /><i className={`on-dot${online(f) ? ' on' : ''}`} /></span>
            <span className="grow min0 mem-body"><b className="ellipsis">{f.name}</b><span className="muted ellipsis">{online(f) ? 'çevrimiçi' : 'çevrimdışı'} · {f.highest}. bölüm{f.teamName ? ` · ${f.teamEmblem} ${f.teamName}` : ''}</span></span>
          </button>
          <button className="btn ghost small icon-btn rel" onClick={() => nav.open({ name: 'chat', room, title: f.name })} aria-label={`${f.name} ile sohbet`}>💬{u > 0 && <span className="sbadge abs">{u}</span>}</button>
          {raceReady && <button className="btn small icon-btn" onClick={() => nav.open({ name: 'race' })} aria-label={`${f.name} ile yarış`}>🏁</button>}
        </div>); })}
      {sel && (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          <div className="muted">{sel.highest}. bölüm · ⭐ {sel.stars}{sel.teamName ? ` · ${sel.teamEmblem} ${sel.teamName}` : ''}</div>
          <button className="btn" onClick={() => { setSel(null); nav.open({ name: 'chat', room: dmRoom(me.id, sel.id), title: sel.name }); }}>💬 Mesaj gönder</button>
          {raceReady ? <button className="btn coral" onClick={() => { setSel(null); nav.open({ name: 'race' }); }}>🏁 Yarışa davet et</button>
            : <div className="muted small-note">🏁 Canlı yarış çok yakında: arkadaşını davet edip aynı bölümde aynı anda yarışacaksınız.</div>}
          <button className="btn ghost coral-text" onClick={() => void remove(sel)}>Arkadaşlıktan çıkar</button>
        </Sheet>
      )}
    </div>
  );
}

/** Tek oda sohbet ekranı (özel ya da genel) */
export function ChatScreen({ room, title, onBack }: { room: string; title: string; onBack: () => void }) {
  return (
    <div className="screen fade-in chat-screen">
      <ScreenHead title={title} onBack={onBack} />
      <Online what="Sohbet">
        {room === 'genel' && <div className="muted small-note">Herkese açık oda. Nazik ol; kişisel bilgi paylaşma. Uzun bas: şikâyet / sessize al.</div>}
        <ChatRoom room={room} offset={room === 'genel' ? 250 : 220} placeholder={room === 'genel' ? 'Herkese yaz…' : `${title} kişisine yaz…`} emptyText={room === 'genel' ? 'Oda sessiz. Bir selam ver, belki yarış arkadaşı bulursun.' : 'İlk mesajı sen yaz.'} />
      </Online>
    </div>
  );
}
