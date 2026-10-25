import './ftue.css'; // Tüy Dede stili (td-*): dev yarış sayfası gibi Coach'suz girişlerde de yüklü (YN-026)
/**
 * Tüy Dede: iç kulağın en yaşlı tüy hücresi. Başındaki altın tüycükler (stereosilya) basamak basamak dizilir,
 * yuvarlak altın gözlük, kar beyazı kaşlar ve bıyık; konuşurken ağzı oynar, boşta hafifçe sallanır.
 * Odi ve ui/art.tsx ile aynı çizim dili: degrade gövde, kenar ışığı, parlama, yumuşak gölge.
 */
export const NARRATOR_NAME = 'Tüy Dede';

export function TuyDede({ size = 120, talking = false, mood = 'happy' }: { size?: number; talking?: boolean; mood?: 'happy' | 'wow' | 'wink' }) {
  return (
    <svg className={`tuy-dede${talking ? ' talking' : ''}`} width={size} height={size} viewBox="0 0 200 200" aria-hidden>
      <defs>
        <radialGradient id="td-body" cx="36%" cy="30%" r="80%">
          <stop offset="0" stopColor="#d9fffa" /><stop offset=".35" stopColor="#5ff0e2" /><stop offset=".75" stopColor="#16b3a7" /><stop offset="1" stopColor="#0b6f69" />
        </radialGradient>
        <linearGradient id="td-rim" x1="0" y1="0" x2="1" y2="1"><stop offset=".55" stopColor="#8b6bff" stopOpacity="0" /><stop offset="1" stopColor="#8b6bff" stopOpacity=".75" /></linearGradient>
        <linearGradient id="td-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset=".5" stopColor="#ffc93c" /><stop offset="1" stopColor="#ff9f1c" /></linearGradient>
        <radialGradient id="td-cheek" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ff5c8a" stopOpacity=".55" /><stop offset="1" stopColor="#ff5c8a" stopOpacity="0" /></radialGradient>
        <radialGradient id="td-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#2ee6d6" stopOpacity=".35" /><stop offset="1" stopColor="#2ee6d6" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="100" cy="108" r="92" fill="url(#td-halo)" className="td-halo" />
      <ellipse cx="100" cy="186" rx="44" ry="7" fill="rgba(5,2,20,.45)" />
      <g className="td-bob">
        {/* tüycükler: basamaklı stereosilya */}
        <g className="td-cilia" strokeLinecap="round">
          {([[72, 40], [86, 31], [100, 23], [114, 16], [128, 10]] as const).map(([x, top], i) => (
            <g key={i}>
              <path d={`M${x} 56 L${x + (i - 2) * 1.5} ${top}`} stroke="#a35a00" strokeWidth="9" />
              <path d={`M${x} 56 L${x + (i - 2) * 1.5} ${top}`} stroke="url(#td-gold)" strokeWidth="6" />
              <circle cx={x + (i - 2) * 1.5} cy={top} r="5" fill="url(#td-gold)" stroke="#a35a00" strokeWidth="1.6" />
              <circle cx={x + (i - 2) * 1.5 - 1.6} cy={top - 1.6} r="1.5" fill="#fff" opacity=".9" />
            </g>
          ))}
        </g>
        {/* gövde: tüy hücresi (yuvarlak kapsül) */}
        <path d="M54 92c0-28 20-44 46-44s46 16 46 44v52c0 26-20 40-46 40s-46-14-46-40z" fill="url(#td-body)" />
        <path d="M54 92c0-28 20-44 46-44s46 16 46 44v52c0 26-20 40-46 40s-46-14-46-40z" fill="url(#td-rim)" />
        <path d="M54 92c0-28 20-44 46-44s46 16 46 44v52c0 26-20 40-46 40s-46-14-46-40z" fill="none" stroke="#0b5f5a" strokeWidth="3" />
        <ellipse cx="74" cy="72" rx="15" ry="8" transform="rotate(-30 74 72)" fill="#fff" opacity=".55" />
        <ellipse cx="69" cy="69" rx="4.5" ry="2.6" transform="rotate(-30 69 69)" fill="#fff" opacity=".9" />
        {/* yanaklar */}
        <circle cx="66" cy="124" r="11" fill="url(#td-cheek)" /><circle cx="134" cy="124" r="11" fill="url(#td-cheek)" />
        {/* kaşlar */}
        <path d="M66 82c6-8 18-9 26-3" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <path d="M108 79c8-6 20-5 26 3" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        {/* gözler */}
        <g className="td-eyes">
          {mood === 'wink'
            ? <><ellipse cx="82" cy="99" rx="8" ry="9" fill="#fff" /><circle cx="83.5" cy="100.5" r="4.6" fill="#22153f" /><circle cx="85.4" cy="98" r="1.6" fill="#fff" /><path d="M110 100q8 5 16 0" fill="none" stroke="#22153f" strokeWidth="3.4" strokeLinecap="round" /></>
            : <><ellipse cx="82" cy="99" rx="8" ry={mood === 'wow' ? 10 : 9} fill="#fff" /><ellipse cx="118" cy="99" rx="8" ry={mood === 'wow' ? 10 : 9} fill="#fff" />
              <circle cx="83.5" cy="100.5" r="4.6" fill="#22153f" /><circle cx="119.5" cy="100.5" r="4.6" fill="#22153f" />
              <circle cx="85.4" cy="98" r="1.6" fill="#fff" /><circle cx="121.4" cy="98" r="1.6" fill="#fff" /></>}
        </g>
        {/* altın yuvarlak gözlük */}
        <g fill="none" stroke="url(#td-gold)" strokeWidth="4">
          <circle cx="82" cy="99" r="14" /><circle cx="118" cy="99" r="14" /><path d="M96 98q4-3 8 0" />
        </g>
        <g fill="none" stroke="#a35a00" strokeWidth="1.2" opacity=".7"><circle cx="82" cy="99" r="16" /><circle cx="118" cy="99" r="16" /></g>
        <path d="M71 92a14 14 0 0 1 8-6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".8" fill="none" />
        {/* ağız (konuşurken oynar) */}
        <ellipse className="td-mouth" cx="100" cy="133" rx="8" ry={mood === 'wow' ? 7 : 5} fill="#3b0b20" />
        {/* bıyık */}
        <path d="M100 124c-6-6-18-7-25 0 4 6 15 7 25 2 10 5 21 4 25-2-7-7-19-6-25 0z" fill="#fff" stroke="#d6e4ff" strokeWidth="1.2" strokeLinejoin="round" />
        {/* minik altın nota rozeti */}
        <g transform="translate(118 150) scale(1.1)"><circle cx="8" cy="8" r="10" fill="#2a1b63" stroke="#ffc93c" strokeWidth="2" /><path d="M7 3.5v8.2a2.4 2 -20 1 1-1.6-1.8V3.5c2 .7 4.2 1.6 4.4 3.8-.7-.8-1.7-1.3-2.8-1.4z" fill="url(#td-gold)" /></g>
      </g>
    </svg>
  );
}
