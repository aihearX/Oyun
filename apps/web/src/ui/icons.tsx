import type { ReactNode } from 'react';

/**
 * Kabuk ikon seti: tek çizgi dili (24×24, 2,2 px yuvarlak uçlu çizgi, currentColor) + yer yer %22 dolgulu ikinci ton.
 * Renk, ikonu taşıyan öğeden gelir (altın / turkuaz / krem); emoji yalnızca içerikte kalır (sohbet, tepkiler, ödüller).
 */
export type IconName =
  | 'check' | 'list' | 'smile' | 'play' | 'retry' | 'megaphone' | 'map' | 'sun' | 'tent' | 'team' | 'user' | 'friends' | 'chat' | 'inbox' | 'gem' | 'globe'
  | 'trophy' | 'cards' | 'hat' | 'bolt' | 'sliders' | 'info' | 'pencil' | 'back' | 'close' | 'dots' | 'send' | 'copy' | 'chevron';

const D = (d: string, fill = false) => <path d={d} className={fill ? 'ic-fill' : undefined} />;
const P: Record<IconName, ReactNode> = {
  play: <>{D('M8 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z', true)}{D('M8 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z')}</>,
  retry: <>{D('M19.5 12a7.5 7.5 0 1 1-2.2-5.3')}{D('M19.8 4.2v4.6h-4.6')}</>,
  megaphone: <>{D('M3.5 10.2v3.6c0 .7.5 1.2 1.2 1.2H7l6.5 4V5L7 9H4.7c-.7 0-1.2.5-1.2 1.2z', true)}{D('M3.5 10.2v3.6c0 .7.5 1.2 1.2 1.2H7l6.5 4V5L7 9H4.7c-.7 0-1.2.5-1.2 1.2z')}{D('M17 9.2a4 4 0 0 1 0 5.6')}{D('M19.6 6.6a7.6 7.6 0 0 1 0 10.8')}{D('M7 15l1 4.5')}</>,
  map: <>{D('M3.5 6.6 9 4.3l6 2.4 5.5-2.3v13l-5.5 2.3-6-2.4-5.5 2.3z', true)}{D('M3.5 6.6 9 4.3l6 2.4 5.5-2.3v13l-5.5 2.3-6-2.4-5.5 2.3z')}{D('M9 4.3v13')}{D('M15 6.7v13')}</>,
  sun: <><circle cx="12" cy="12" r="4.2" className="ic-fill" /><circle cx="12" cy="12" r="4.2" />{D('M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4')}</>,
  tent: <>{D('M12 4.5 3.8 19.5h16.4z', true)}{D('M12 4.5 3.8 19.5h16.4z')}{D('M12 4.5 10.6 2M12 4.5 13.4 2')}{D('M12 12.5 8.6 19.5M12 12.5l3.4 7')}{D('M2.5 19.5h19')}</>,
  team: <><circle cx="12" cy="7.6" r="3.1" className="ic-fill" /><circle cx="12" cy="7.6" r="3.1" />{D('M6.3 19.5c0-3.3 2.6-5.6 5.7-5.6s5.7 2.3 5.7 5.6')}<circle cx="5.2" cy="10" r="2.2" />{D('M2.2 18.2c0-2.4 1.4-4 3.4-4.3')}<circle cx="18.8" cy="10" r="2.2" />{D('M21.8 18.2c0-2.4-1.4-4-3.4-4.3')}</>,
  user: <><circle cx="12" cy="12" r="9" className="ic-fill" /><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3.2" />{D('M6.6 18.4c1.2-2.3 3.1-3.4 5.4-3.4s4.2 1.1 5.4 3.4')}</>,
  friends: <><circle cx="9" cy="8.2" r="3.3" className="ic-fill" /><circle cx="9" cy="8.2" r="3.3" />{D('M3 19.5c0-3.4 2.7-5.8 6-5.8s6 2.4 6 5.8')}<circle cx="16.8" cy="9.2" r="2.6" />{D('M16.2 13.8c3 0 5.3 2 5.3 5')}</>,
  chat: <>{D('M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7.5L6.5 20.5v-3.5H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z', true)}{D('M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7.5L6.5 20.5v-3.5H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z')}{D('M8 10.8h.01M12 10.8h.01M16 10.8h.01')}</>,
  inbox: <>{D('M3.5 13.5 6.3 5.6c.2-.6.7-1 1.3-1h8.8c.6 0 1.1.4 1.3 1l2.8 7.9v4.8a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2z', true)}{D('M3.5 13.5 6.3 5.6c.2-.6.7-1 1.3-1h8.8c.6 0 1.1.4 1.3 1l2.8 7.9v4.8a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2z')}{D('M3.5 13.5h4.8l1.4 2.4h4.6l1.4-2.4h4.8')}</>,
  gem: <>{D('M7 4h10l4 5.2L12 20.5 3 9.2z', true)}{D('M7 4h10l4 5.2L12 20.5 3 9.2z')}{D('M3 9.2h18')}{D('M9.6 4 8.2 9.2 12 20.5l3.8-11.3L14.4 4')}</>,
  globe: <><circle cx="12" cy="12" r="9" className="ic-fill" /><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="3.8" ry="9" />{D('M3.5 9h17M3.5 15h17')}</>,
  trophy: <>{D('M7 4h10v5.2a5 5 0 0 1-10 0z', true)}{D('M7 4h10v5.2a5 5 0 0 1-10 0z')}{D('M7 6H4.2v1.4A3.6 3.6 0 0 0 7.6 11M17 6h2.8v1.4a3.6 3.6 0 0 1-3.4 3.6')}{D('M12 14.2v3.3M8.5 20.5h7M9.5 17.5h5')}</>,
  cards: <><rect x="3.4" y="6.4" width="10" height="14" rx="2" transform="rotate(-10 8.4 13.4)" /><rect x="10.4" y="4" width="10" height="14" rx="2" transform="rotate(8 15.4 11)" className="ic-fill" /><rect x="10.4" y="4" width="10" height="14" rx="2" transform="rotate(8 15.4 11)" />{D('M14.6 9.4l1.2 1.6 1.9.4-1.3 1.4.2 1.9-1.8-.8-1.8.6.3-1.9-1.2-1.5 1.9-.3z')}</>,
  hat: <>{D('M8 5.2c0-.7.5-1.2 1.2-1.2h5.6c.7 0 1.2.5 1.2 1.2V15H8z', true)}{D('M8 5.2c0-.7.5-1.2 1.2-1.2h5.6c.7 0 1.2.5 1.2 1.2V15H8z')}{D('M8 11.2h8')}{D('M3.5 16.6c0-1.2 3.8-2.1 8.5-2.1s8.5.9 8.5 2.1-3.8 2.4-8.5 2.4-8.5-1.2-8.5-2.4z')}</>,
  bolt: <>{D('M13.2 2.8 4.8 13.6h6.4l-1 7.6 8.4-10.8h-6.4z', true)}{D('M13.2 2.8 4.8 13.6h6.4l-1 7.6 8.4-10.8h-6.4z')}</>,
  sliders: <>{D('M4 7h9.5M18.5 7H20M4 17h3.5M12.5 17H20')}<circle cx="16" cy="7" r="2.5" className="ic-fill" /><circle cx="16" cy="7" r="2.5" /><circle cx="10" cy="17" r="2.5" className="ic-fill" /><circle cx="10" cy="17" r="2.5" /></>,
  info: <><circle cx="12" cy="12" r="9" className="ic-fill" /><circle cx="12" cy="12" r="9" />{D('M12 11v5.5M12 7.6h.01')}</>,
  pencil: <>{D('M4 20h4L18.6 9.4a2.1 2.1 0 0 0-3-3L5 17z', true)}{D('M4 20h4L18.6 9.4a2.1 2.1 0 0 0-3-3L5 17z')}{D('M13.8 8.2l3 3')}</>,
  back: D('M15 5 8 12l7 7'),
  check: D('M5 12.5l4.5 4.5L19 7.5'),
  list: D('M5 7h14M5 12h14M5 17h14'),
  smile: <><circle cx="12" cy="12" r="9" className="ic-fill" /><circle cx="12" cy="12" r="9" />{D('M8.5 14.2c.9 1.4 2.1 2.1 3.5 2.1s2.6-.7 3.5-2.1M9 9.6h.01M15 9.6h.01')}</>,
  chevron: D('M9 5l7 7-7 7'),
  close: D('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  dots: <>{D('M5.5 12h.01M12 12h.01M18.5 12h.01')}</>,
  send: <>{D('M4 11.6 20 4.5l-6.2 15.8-2.6-6.6z', true)}{D('M4 11.6 20 4.5l-6.2 15.8-2.6-6.6z')}{D('M11.2 13.7 20 4.5')}</>,
  copy: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" className="ic-fill" /><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" />{D('M15.5 8.5V6.2A2.2 2.2 0 0 0 13.3 4H6.2A2.2 2.2 0 0 0 4 6.2v7.1a2.2 2.2 0 0 0 2.2 2.2h2.3')}</>,
};

export function Icon({ name, size = 22, className }: { name: IconName; size?: number | string; className?: string }) {
  const bold = name === 'dots';
  return (
    <svg className={`ic${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={bold ? 3.4 : 2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">{P[name]}</svg>
  );
}
