import { useEffect } from 'react';
import './comm.css'; // paket bölme: bu bileşen Cards.tsx olmadan da çizilir (sonuç ekranı), stili kendisi yüklesin
import { useNav } from '../nav';
import { platform } from '../platform';
import { act, toast } from '../net';
import { Av } from '../friends/common';
import { Icon } from '../ui/icons';
import { Art, type ArtName } from '../ui/art';
import { dismissNotice, useComm } from './state';
import type { CommNotice } from '@odi/shared';

const ART: Record<CommNotice['kind'], ArtName> = { mention: 'bell', thanks: 'heart', mentor: 'crown', duo: 'users', challenge: 'finish', dq: 'bulb' };

/** İletişim bildirim şeridi: bahsetme, teşekkür, usta–çırak, ikili görev, meydan okuma. 7 sn sonra kaybolur. Gerçek olaylardan gelir. */
export function CommBanner() {
  const n = useComm((s) => s.notices[0]);
  const nav = useNav();
  useEffect(() => {
    if (!n) return;
    platform().haptic('light');
    const h = setTimeout(() => dismissNotice(n.id), 7000);
    return () => clearTimeout(h);
  }, [n?.id]);
  if (!n) return null;
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
  const acts: { label: string; on: () => void; id: string }[] = [];
  if (n.kind === 'thanks' && n.msgId) acts.push(/ipucu verdi$/.test(n.title) ? { id: 'tesekkur', label: 'Teşekkürler', on: () => void reply('tesekkur') } : { id: 'rica', label: 'Rica ederim', on: () => void reply('rica') });
  if (n.kind === 'mentor' && n.from && /ulaştı!$/.test(n.title) && /^Çırağın/.test(n.title)) acts.push({ id: 'tebrik', label: 'Tebrik et', on: () => void dmCheer() });
  if (n.kind === 'mention' && n.msgId) acts.push({ id: 'bak', label: 'Sohbete git', on: go });
  if (n.kind === 'mentor' || n.kind === 'duo') acts.push({ id: 'bak', label: 'Birlikte’ye git', on: go });
  return (
    <div className="fr-banner cm-banner" role="status" aria-live="polite" key={n.id} data-testid="iletisim-bildirimi" data-kind={n.kind}>
      <div className={`fr-banner-card k-${n.kind}`} onClick={acts.length ? undefined : go}>
        {n.from ? <Av p={n.from} size={42} dot={false} /> : <span className="cm-ic"><Art name={ART[n.kind]} size={26} /></span>}
        <span className="min0 grow fr-banner-text"><b className="ellipsis">{n.title}</b><small>{n.text}</small></span>
        {acts.length > 0 && <span className="cm-acts">{acts.map((a) => <button key={a.id + a.label} type="button" className="btn small" data-act={a.id} onClick={(e) => { e.stopPropagation(); a.on(); }}>{a.label}</button>)}</span>}
      </div>
      <button className="fr-banner-x" onClick={close} aria-label="Bildirimi kapat"><Icon name="close" size="1.1em" className="ic-inline" /></button>
    </div>
  );
}
