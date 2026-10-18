import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import type { DmThread } from '@odi/shared';
import { useNav } from '../nav';
import { Empty, Sheet, Skeleton } from '../ui/social';
import { Av, shortTime } from './common';
import { preview, refreshFriends, refreshThreads, useFriends } from './state';
import './friends.css';

/** Mesajlar (gelen kutusu): sohbet listesi — avatar, isim, son mesaj, zaman, okunmamış rozeti, çevrimiçi noktası. */
export function Messages() {
  const threads = useFriends((s) => s.threads);
  const [pick, setPick] = useState(false);
  useEffect(() => { void refreshThreads(); }, []);
  return (
    <div className="stack fr-hub">
      <button className="card fr-newmsg" onClick={() => setPick(true)}><span className="fr-newmsg-ico" aria-hidden>✏️</span><span className="min0 grow"><b>Yeni mesaj</b><small>Arkadaşına ya da takım arkadaşına yaz</small></span><span aria-hidden>›</span></button>
      {!threads ? <Skeleton rows={4} /> : threads.length === 0
        ? <Empty icon="💌" title="Henüz mesajın yok" text="Bir arkadaşına “merhaba” de, yarışa çağır ya da bir Odi çıkartması gönder. Özel mesajlar arkadaşlar ve takım arkadaşları arasındadır." />
        : <div className="fr-threads" role="list">{threads.map((t) => <ThreadRow key={t.other.id} t={t} />)}</div>}
      {pick && <NewMessage onClose={() => setPick(false)} />}
    </div>
  );
}

function ThreadRow({ t }: { t: DmThread }) {
  const nav = useNav();
  const meId = useNet((s) => s.me?.id);
  const typing = useFriends((s) => (s.typing[t.other.id] ?? 0) > Date.now());
  return (
    <button className={`fr-thread${t.unread ? ' unread' : ''}`} role="listitem" onClick={() => nav.open({ name: 'dm', id: t.other.id })} data-testid="sohbet-satiri" aria-label={`${t.other.name}${t.unread ? `, ${t.unread} okunmamış` : ''}`}>
      <Av p={t.other} size={52} />
      <span className="min0 grow fr-thread-body">
        <span className="row between"><b className="ellipsis">{t.other.name}</b><small className="fr-thread-time">{shortTime(t.at)}</small></span>
        <span className="row between">
          <small className={`ellipsis${typing ? ' dm-typing-txt' : ''}`}>{typing ? 'yazıyor…' : preview(t.last, meId)}</small>
          {t.unread > 0 && <span className="sbadge fr-unread">{t.unread > 99 ? '99+' : t.unread}</span>}
        </span>
      </span>
    </button>
  );
}

function NewMessage({ onClose }: { onClose: () => void }) {
  const nav = useNav();
  const friends = useFriends((s) => s.friends);
  const team = useNet((s) => s.team);
  const meId = useNet((s) => s.me?.id);
  useEffect(() => { if (!friends) void refreshFriends(); }, [friends]);
  const ids = new Set((friends ?? []).map((f) => f.id));
  const mates = (team?.roster ?? []).filter((m) => m.id !== meId && !ids.has(m.id));
  const open = (id: string) => { onClose(); nav.open({ name: 'dm', id }); };
  return (
    <Sheet title="Kime yazalım?" onClose={onClose}>
      {!friends ? <Skeleton rows={2} /> : !friends.length && !mates.length ? <div className="muted">Önce bir arkadaş ekle ya da bir takıma katıl. 🌱</div> : null}
      {(friends ?? []).map((f) => <button key={f.id} className="fr-pick" onClick={() => open(f.id)}><Av p={f} size={40} /><b className="grow ellipsis">{f.name}</b><span aria-hidden>›</span></button>)}
      {mates.length > 0 && <div className="muted small-note">Takım arkadaşların</div>}
      {mates.map((m) => <button key={m.id} className="fr-pick" onClick={() => open(m.id)}><Av p={m} size={40} /><b className="grow ellipsis">{m.name}</b><span aria-hidden>›</span></button>)}
    </Sheet>
  );
}
