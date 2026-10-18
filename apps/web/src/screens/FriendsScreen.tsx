import { useNav } from '../nav';
import { ScreenHead } from '../ui/bits';
import { ChatRoom } from '../ui/Chat';
import { Online } from '../ui/social';
import { DmScreen, FriendsHub, Messages, useFriends } from '../friends';

/** Arkadaşlar: kodum (kopyala/paylaş), arama, sekmeler (Arkadaşlar · İstekler · Öneriler), profil kartı; sağ üstte Mesajlar. */
export function FriendsScreen({ onBack, raceReady }: { onBack: () => void; raceReady: boolean }) {
  const nav = useNav();
  const unread = useFriends((s) => s.dmUnread);
  return (
    <div className="screen fade-in">
      <ScreenHead title="Arkadaşlar" onBack={onBack} right={
        <button className="btn ghost small icon-btn rel" onClick={() => nav.open({ name: 'messages' })} aria-label={`Mesajlar${unread ? `: ${unread} okunmamış` : ''}`}>💬{unread > 0 && <span className="sbadge abs">{unread > 99 ? '99+' : unread}</span>}</button>
      } />
      <Online what="Arkadaşlar ve mesajlar"><FriendsHub raceReady={raceReady} /></Online>
    </div>
  );
}

/** Mesajlar (gelen kutusu) */
export function MessagesScreen({ onBack }: { onBack: () => void }) {
  const nav = useNav();
  const req = useFriends((s) => s.incoming.length);
  return (
    <div className="screen fade-in">
      <ScreenHead title="Mesajlar" onBack={onBack} right={
        <button className="btn ghost small icon-btn rel" onClick={() => nav.open({ name: 'friends' })} aria-label={`Arkadaşlar${req ? `: ${req} istek` : ''}`}>🫂{req > 0 && <span className="sbadge abs">{req}</span>}</button>
      } />
      <Online what="Mesajlar"><Messages /></Online>
    </div>
  );
}

/** Birebir özel sohbet (tam ekran) */
export function DmRouteScreen({ id, onBack }: { id: string; onBack: () => void }) {
  return <Online what="Özel sohbet"><DmScreen id={id} onBack={onBack} /></Online>;
}

/** Tek oda sohbet ekranı (genel ya da eski dm:<a>:<b> odası) */
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
