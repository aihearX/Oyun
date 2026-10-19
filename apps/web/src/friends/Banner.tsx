import { useEffect } from 'react';
import { useNav } from '../nav';
import { platform } from '../platform';
import { Av } from './common';
import { useFriends } from './state';
import './friends.css';
import { Icon } from '../ui/icons';
import { Glyph, rich } from '../ui/art';

/**
 * Üstten kayan bildirim şeridi: yeni özel mesaj, arkadaşlık isteği/kabulü, arkadaş hediyesi.
 * O sohbet açıkken çıkmaz (state.ts). Dokununca ilgili ekrana gider; 5 sn sonra kendiliğinden kaybolur.
 */
export function FriendBanner() {
  const b = useFriends((s) => s.banner);
  const nav = useNav();
  useEffect(() => {
    if (!b) return;
    platform().haptic('light');
    const h = setTimeout(() => { if (useFriends.getState().banner?.id === b.id) useFriends.setState({ banner: null }); }, 6000);
    return () => clearTimeout(h);
  }, [b?.id]);
  if (!b) return null;
  const close = () => useFriends.setState({ banner: null });
  const go = () => {
    close();
    if (b.kind === 'dm' || b.kind === 'kabul') nav.open({ name: 'dm', id: b.from.id });
    else if (b.kind === 'istek') nav.open({ name: 'friends' });
    else nav.open({ name: 'inbox' });
  };
  const icon = b.kind === 'dm' ? '💬' : b.kind === 'istek' ? '👋' : b.kind === 'kabul' ? '🫂' : '🎁';
  return (
    <div className="fr-banner" role="status" aria-live="polite" key={b.id} data-testid="mesaj-bildirimi">
      <button className={`fr-banner-card k-${b.kind}`} onClick={go}>
        <Av p={b.from} size={42} dot={false} />
        <span className="min0 grow fr-banner-text"><b className="ellipsis"><span aria-hidden className="fr-b-ic"><Glyph e={icon} size="1.25em" /></span> {b.title}</b><small className="ellipsis">{rich(b.text)}</small></span>
      </button>
      <button className="fr-banner-x" onClick={close} aria-label="Bildirimi kapat"><Icon name="close" size="1.1em" className="ic-inline" /></button>
    </div>
  );
}

/** üst bar için: okunmamış mesaj rozetli sohbet düğmesi (TopBar `extra` olarak verilebilir) */
export function DmTopPill() {
  const nav = useNav();
  const n = useFriends((s) => s.dmUnread);
  return (
    <button className="pill tb-pill tap ico" onClick={() => nav.open({ name: 'messages' })} aria-label={`Mesajlar: ${n} okunmamış`} data-testid="mesaj-rozeti">
      <Icon name="chat" size={20} />{n > 0 && <span className="dot">{n > 99 ? '99+' : n}</span>}
    </button>
  );
}

/** Profil sekmesi rozeti için: okunmamış mesaj + gelen istek */
export const useSocialUnread = () => useFriends((s) => s.dmUnread + s.incoming.length);
