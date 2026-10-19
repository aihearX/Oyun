import { useEffect } from 'react';
import type { EvtMap } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { platform } from '../platform';
import { levelName } from './common';
import { Icon } from '../ui/icons';

/** davet bu kadar süre sonra kendiliğinden düşer (oda başlamış olabilir) */
const INVITE_TTL_MS = 90_000;

export type RaceInvite = EvtMap['race.invited'];

/**
 * Gelen yarış davetleri ('race.invited'; @odi/net/store `raceInvite` alanı üzerinden — bindNet olayı depoya yazar,
 * böylece kanca o an bağlı olmasa da davet kaybolmaz).
 * accept(): daveti kapatır ve katılınacak oda kimliğini döndürür → `<RaceLobby inviteRoomId={id} />` katılır (hata varsa orada gösterilir).
 */
export function useRaceInvites(): { invite: RaceInvite | null; accept: () => string | null; dismiss: () => void } {
  const invite = useNet((s) => s.raceInvite);
  const clear = useNet((s) => s.clearRaceInvite);
  useEffect(() => {
    if (!invite) return;
    platform().haptic('medium');
    const t = setTimeout(() => { if (useNet.getState().raceInvite === invite) clear(); }, INVITE_TTL_MS);
    return () => clearTimeout(t);
  }, [invite]);
  return {
    invite,
    accept: () => { const id = useNet.getState().raceInvite?.room.id ?? null; clear(); return id; },
    dismiss: clear,
  };
}

/** Hazır davet kartı (ekranın üstünde). onAccept(roomId) → yarış lobisini o odayla aç. */
export function RaceInviteBanner({ onAccept }: { onAccept: (roomId: string) => void }) {
  const { invite, accept, dismiss } = useRaceInvites();
  if (!invite) return null;
  return (
    <div className="race-invite" role="alertdialog" aria-label="Yarış daveti" data-testid="yaris-davet-karti">
      <OdiAvatar color={invite.from.color} hat={invite.from.hat} size={44} mood="wow" />
      <div className="ri-body min0">
        <b className="ellipsis">{invite.from.name} seni yarışa çağırıyor!</b>
        <small className="muted ellipsis">{invite.room.level}. {levelName(invite.room.level)} · {invite.room.players.filter((p) => !p.left).length}/{invite.room.max} oyuncu</small>
      </div>
      <button className="btn small" data-testid="yaris-davet-kabul" onClick={() => { const id = accept(); if (id) onAccept(id); }}>Katıl</button>
      <button className="btn ghost small" aria-label="Daveti kapat" onClick={dismiss}><Icon name="close" size="1.1em" className="ic-inline" /></button>
    </div>
  );
}
