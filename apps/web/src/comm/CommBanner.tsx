import { useEffect, useRef } from 'react';
import './comm.css'; // paket bölme: bu bileşen Cards.tsx olmadan da çizilir (sonuç ekranı), stili kendisi yüklesin
import { useNav } from '../nav';
import { platform } from '../platform';
import { act, toast } from '../net';
import { Av } from '../friends/common';
import { Icon } from '../ui/icons';
import { Art, type ArtName } from '../ui/art';
import { dismissNotice, useComm } from './state';
import { useCoach } from '../ftue/Coach';
import { useBaslikAltinda } from '../ui/Toasts';
import type { CommNotice } from '@odi/shared';

const ART: Record<CommNotice['kind'], ArtName> = { mention: 'bell', thanks: 'heart', mentor: 'crown', duo: 'users', challenge: 'finish', dq: 'bulb' };
/** düğmesiz kartın ekranda kalma süresi */
export const NOTICE_MS = 7000;

export interface NoticeAct { id: 'tesekkur' | 'rica' | 'tebrik' | 'bak'; label: string }
/** kartın düğmeleri; düğmesi olan kart kendiliğinden kapanmaz (OT-buyuk-yazi-63) */
export function noticeActs(n: CommNotice): NoticeAct[] {
  const acts: NoticeAct[] = [];
  if (n.kind === 'thanks' && n.msgId) acts.push(/ipucu verdi$/.test(n.title) ? { id: 'tesekkur', label: 'Teşekkürler' } : { id: 'rica', label: 'Rica ederim' });
  if (n.kind === 'mentor' && n.from && /ulaştı!$/.test(n.title) && /^Çırağın/.test(n.title)) acts.push({ id: 'tebrik', label: 'Tebrik et' });
  if (n.kind === 'mention' && n.msgId) acts.push({ id: 'bak', label: 'Sohbete git' });
  if (n.kind === 'mentor' || n.kind === 'duo') acts.push({ id: 'bak', label: 'Birlikte’ye git' });
  return acts;
}

/** İletişim bildirim şeridi: bahsetme, teşekkür, usta–çırak, ikili görev, meydan okuma. Gerçek olaylardan gelir.
 *  Düğmesiz kart 7 sn sonra kaybolur; içinde düğme olan kart ("Rica ederim", "Tebrik et", "Sohbete git") kendiliğinden kapanmaz, X ya da
 *  düğmeyle kapanır: yavaş okuyan da basabilir (OT-buyuk-yazi-63, WCAG 2.2.1). Kaçırılan teşekkür sohbetteki yardım kartının konusundan
 *  da yanıtlanır.
 *  Tüy Dede bir yeri gösterirken kart sırada bekler (rehberin çerçevesiyle üst üste binmez, görülmeden süresi dolmaz; OT-buyuk-yazi-20).
 *  Ekran başlık çubuğunun altında durur: Geri her zaman dokunulabilir (OT-buyuk-yazi-49). */
export function CommBanner() {
  const n = useComm((s) => s.notices[0]);
  const guide = useCoach((s) => !!s.tour);
  const nav = useNav();
  // ekran başlığının (Geri) altında durur (OT-buyuk-yazi-49)
  const ref = useRef<HTMLDivElement>(null); useBaslikAltinda(ref, n && !guide ? n.id : null);
  const acts = n ? noticeActs(n) : [];
  const sticky = acts.length > 0;
  useEffect(() => {
    if (!n || guide) return;
    platform().haptic('light');
    if (sticky) return;
    const h = setTimeout(() => dismissNotice(n.id), NOTICE_MS);
    return () => clearTimeout(h);
  }, [n?.id, guide, sticky]);
  if (!n || guide) return null;
  const close = () => dismissNotice(n.id);
  const reply = async (phrase: string) => {
    close();
    if (!n.room || !n.msgId) return;
    if (await act('chat.send', { room: n.room, text: phrase, kind: 'hazir', replyTo: n.msgId })) toast('💬', 'Gönderildi', 'Kartın altına yazıldı.', 'green');
  };
  const dmCheer = async () => { close(); if (n.from && await act('dm.send', { to: n.from.id, text: 'tebrik', kind: 'hazir' })) toast('💬', `${n.from.name} kişisine “Tebrikler!” gittin`, undefined, 'green'); };
  const go = () => {
    close();
    if (n.kind === 'mentor' || n.kind === 'duo') nav.open({ name: 'birlikte' });
    else if (n.room?.startsWith('takim:')) nav.tab('team');
  };
  const run: Record<NoticeAct['id'], () => void> = { tesekkur: () => void reply('tesekkur'), rica: () => void reply('rica'), tebrik: () => void dmCheer(), bak: go };
  return (
    <div className="fr-banner cm-banner" ref={ref} role="status" aria-live="polite" key={n.id} data-testid="iletisim-bildirimi" data-kind={n.kind}>
      <div className={`fr-banner-card k-${n.kind}`} onClick={acts.length ? undefined : go}>
        {n.from ? <Av p={n.from} size={42} dot={false} /> : <span className="cm-ic"><Art name={ART[n.kind]} size={26} /></span>}
        <span className="min0 grow fr-banner-text"><b className="ellipsis">{n.title}</b><small>{n.text}</small></span>
        {acts.length > 0 && <span className="cm-acts">{acts.map((a) => <button key={a.id + a.label} type="button" className="btn small" data-act={a.id} onClick={(e) => { e.stopPropagation(); run[a.id](); }}>{a.label}</button>)}</span>}
      </div>
      <button className="fr-banner-x" onClick={close} aria-label="Bildirimi kapat"><Icon name="close" size="1.1em" className="ic-inline" /></button>
    </div>
  );
}
