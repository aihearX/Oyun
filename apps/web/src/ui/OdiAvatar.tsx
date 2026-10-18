import type { HatId } from '@odi/content';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Odi'nin SVG hali (oyundaki heroTexture/hatTexture ile aynı koordinatlar: 64×64, gövde merkezi 32,32, yarıçap 22). */
export function OdiAvatar({ color = 0x6c4cf1, hat, size = 64, mood = 'happy' }: { color?: number; hat?: HatId | string; size?: number; mood?: 'happy' | 'wow' }) {
  const c = hex(color);
  return (
    <svg width={size} height={size} viewBox="0 -4 64 68" aria-hidden className="odi-avatar">
      <circle cx="32" cy="32" r="22" fill={c} />
      <circle cx="25" cy="24" r="8" fill="#fff" opacity="0.22" />
      <circle cx="24.3" cy="29.6" r="5.3" fill="#fff" /><circle cx="39.7" cy="29.6" r="5.3" fill="#fff" />
      <circle cx="25.3" cy="30.1" r="2.4" fill="#13162a" /><circle cx="40.6" cy="30.1" r="2.4" fill="#13162a" />
      {mood === 'wow' ? <circle cx="32" cy="40.4" r="3.4" fill="none" stroke="#13162a" strokeWidth="2.4" /> : <path d="M26.6 38.5 Q32 44 37.4 38.5" fill="none" stroke="#13162a" strokeWidth="2.4" strokeLinecap="round" />}
      {hat && <Hat id={hat} />}
    </svg>
  );
}

function Hat({ id }: { id: string }) {
  switch (id) {
    case 'bere': return <g><path d="M12 17 Q12 5 32 5 Q52 5 52 17 Z" fill="#f0567a" /><rect x="12" y="14" width="40" height="5" rx="2" fill="#fff" opacity="0.9" /><circle cx="32" cy="4" r="4.5" fill="#fff" /></g>;
    case 'kulaklik': return <g><path d="M8 30 A26 26 0 0 1 56 30" fill="none" stroke="#13162a" strokeWidth="4" /><rect x="3" y="24" width="10" height="18" rx="4" fill="#f0567a" /><rect x="51" y="24" width="10" height="18" rx="4" fill="#f0567a" /></g>;
    case 'nota': return <g><line x1="32" y1="11" x2="34" y2="2" stroke="#13162a" strokeWidth="2.5" /><ellipse cx="31" cy="3" rx="4.5" ry="3.2" fill="#13162a" /><path d="M35 3 L35 -3 L40 0" fill="none" stroke="#13162a" strokeWidth="2" /></g>;
    case 'dalgic': return <g><line x1="8" y1="29" x2="56" y2="29" stroke="#13162a" strokeWidth="3" /><circle cx="24" cy="29.5" r="8" fill="#8fe3ff" fillOpacity="0.55" stroke="#0e9c98" strokeWidth="2.5" /><circle cx="40" cy="29.5" r="8" fill="#8fe3ff" fillOpacity="0.55" stroke="#0e9c98" strokeWidth="2.5" /></g>;
    case 'tac': return <g><path d="M18 14 L18 3 L24 9 L32 0 L40 9 L46 3 L46 14 Z" fill="#f5b700" /><circle cx="32" cy="9" r="2.5" fill="#f0567a" /></g>;
    case 'parti': return <g><path d="M22 13 L42 13 L33 0 Z" fill="#0e9c98" /><path d="M26 9 L38 9 L37 13 L25 13 Z" fill="#ffc25c" /><circle cx="33" cy="0" r="3.5" fill="#f0567a" /></g>;
    case 'kasif': return <g><ellipse cx="32" cy="14" rx="25" ry="4.5" fill="#b88a4a" /><path d="M18 14 Q18 2 32 2 Q46 2 46 14 Z" fill="#c9a063" /><rect x="18" y="10" width="28" height="3" fill="#6b4a24" /></g>;
    case 'koklea': return <g><circle cx="46" cy="12" r="8" fill="#ffe1ea" /><path d="M46 12 m0 -1 a1.5 1.5 0 1 1 -1 2 a3 3 0 1 1 3 -4 a5 5 0 1 1 -6 6" fill="none" stroke="#f0567a" strokeWidth="2" strokeLinecap="round" /></g>;
    case 'yildiz': return <g><path d="M13 22 A23 23 0 0 1 51 22" fill="none" stroke="#f5b700" strokeWidth="3" /><path d="M32 -1 L34.4 4.6 L40.5 5.2 L35.9 9.2 L37.3 15.1 L32 12 L26.7 15.1 L28.1 9.2 L23.5 5.2 L29.6 4.6 Z" fill="#f5b700" /></g>;
    case 'altin': return <g><circle cx="32" cy="7" r="8" fill="#fff3c4" /><path d="M32 7 m0 -1.5 a1.5 1.5 0 1 1 -1 2.5 a3.5 3.5 0 1 1 4 -4.5 a6 6 0 1 1 -7 7" fill="none" stroke="#d9a400" strokeWidth="2.4" strokeLinecap="round" /></g>;
    default: return null;
  }
}
