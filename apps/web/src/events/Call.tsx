import { useState } from 'react';
import { useNet } from '@odi/net/store';
import type { TeamMember } from '@odi/shared';
import { errText, getNet } from '../net';
import { platform } from '../platform';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Sheet } from '../ui/social';
import { Art } from '../ui/art';
import { Icon } from '../ui/icons';
import './events.css';

/** "şimdi" ya da "2 sa önce": takım arkadaşının en son ne zaman oyunda olduğu (sunucunun son görülme zamanı) */
export function seenAgo(online: boolean, lastSeen: number, now = Date.now()): string {
  if (online) return 'şimdi';
  const d = Math.max(0, now - lastSeen);
  if (d < 60_000) return 'az önce';
  if (d < 3_600_000) return `${Math.round(d / 60_000)} dk önce`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} sa önce`;
  return `${Math.max(1, Math.round(d / 86_400_000))} gün önce`;
}

/** listelerdeki satır: "çevrimiçi" ya da "son görülme 5 dk önce" (çağırma pencereleri ve Bayrak devret listesi aynı; YN-107) */
export const seenLine = (online: boolean, lastSeen: number, now = Date.now()): string => (online ? 'çevrimiçi' : `son görülme ${seenAgo(false, lastSeen, now)}`);

/** çevrimiçiler üstte, sonra en son görülen (çağırma pencereleri ve Bayrak devret listesi) */
export const byPresence = <T extends Pick<TeamMember, 'lastSeen'>>(list: T[], online: (m: T) => boolean): T[] =>
  [...list].sort((a, b) => Number(online(b)) - Number(online(a)) || b.lastSeen - a.lastSeen);

/**
 * Takım arkadaşını özel mesajla çağır (DM davet kartı). Listede çevrimiçi noktası ve son görülme; çevrimiçiler üstte
 * (Bayrak Yarışı devret penceresindeki ev-dot deseni). Ralli odası ve Takım Yarışı lobisi aynı pencereyi kullanır (OT-takim-kaptani-12).
 */
export function TeammateCall({ joined, text, meta, label, sheetTitle, note, testId, onSent }: {
  joined: string[]; text: string; meta: { type: string; roomId: string; title: string };
  label: string; sheetTitle: string; note: string; testId: string;
  /** davet gitti (ralli ekranı çağrı listesini yeniler, YN-224) */
  onSent?: (to: string) => void;
}) {
  const team = useNet((s) => s.team); const me = useNet((s) => s.me); const presence = useNet((s) => s.presence);
  const [open, setOpen] = useState(false); const [sent, setSent] = useState<Record<string, string>>({});
  const online = (m: TeamMember) => presence[m.id] ?? m.online;
  const list = byPresence((team?.roster ?? []).filter((m) => m.id !== me?.id && !joined.includes(m.id)), online);
  if (!list.length) return null;
  const call = async (to: string) => {
    try { await getNet()!.call('dm.send', { to, text, kind: 'davet', meta }); setSent((s) => ({ ...s, [to]: 'ok' })); platform().haptic('light'); onSent?.(to); }
    catch (e) { setSent((s) => ({ ...s, [to]: errText(e) })); }
  };
  const now = Date.now();
  return (
    <>
      <button className="btn ghost small" data-testid={testId} onClick={() => setOpen(true)}><Art e="📨" size="1.15em" className="art-inline" /> {label}</button>
      {open && (
        <Sheet title={sheetTitle} onClose={() => setOpen(false)}>
          <div className="muted small-note">{note}</div>
          {list.map((m) => { const on = online(m); return (
            <div key={m.id} className="ev-pass" data-testid="cagir-uye" data-online={on ? '1' : '0'}>
              <OdiAvatar color={m.color} hat={m.hat} size={36} />
              <span className="grow min0 ev-call-who"><b className="ellipsis">{m.name}</b><small className="muted"><span className={`ev-dot${on ? ' on' : ''}`} role="img" aria-label={on ? 'çevrimiçi' : 'çevrimdışı'} /> {seenLine(on, m.lastSeen, now)}</small></span>
              {sent[m.id] === 'ok' ? <span className="ev-tag">Gönderildi <Icon name="check" size="1.1em" className="ic-inline" /></span> : <button className="btn small" aria-label={`${m.name} çağır`} onClick={() => void call(m.id)}>Çağır</button>}
              {sent[m.id] && sent[m.id] !== 'ok' && <small className="ev-note" style={{ flexBasis: '100%' }}>{sent[m.id]}</small>}
            </div>); })}
        </Sheet>
      )}
    </>
  );
}
