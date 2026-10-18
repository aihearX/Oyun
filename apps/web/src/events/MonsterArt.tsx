import type { RallyMonsterId } from '@odi/shared';

/** Ralli canavarlarının SVG çizimleri (emoji yerine; oyunun Odi çizimleriyle aynı yuvarlak dil). mood: kızgın / yenik */
export function MonsterArt({ id, size = 120, beaten = false }: { id: RallyMonsterId; size?: number; beaten?: boolean }) {
  const eyes = beaten
    ? <g stroke="#22153f" strokeWidth="4" strokeLinecap="round"><path d="M42 52 l10 10 M52 52 l-10 10" /><path d="M68 52 l10 10 M78 52 l-10 10" /></g>
    : <g><ellipse cx="47" cy="58" rx="9" ry="10" fill="#fff" /><ellipse cx="73" cy="58" rx="9" ry="10" fill="#fff" /><circle cx="49" cy="60" r="4.5" fill="#22153f" /><circle cx="71" cy="60" r="4.5" fill="#22153f" />
      <path d="M36 44 L56 50 M84 44 L64 50" stroke="#22153f" strokeWidth="5" strokeLinecap="round" /></g>;
  const mouth = beaten ? <path d="M48 84 Q60 76 72 84" fill="none" stroke="#22153f" strokeWidth="4" strokeLinecap="round" />
    : <g><path d="M46 80 Q60 92 74 80 Z" fill="#22153f" /><path d="M52 81 l3 5 l3 -5 M62 81 l3 5 l3 -5" fill="#fff" /></g>;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden className={`mon-art mon-${id}`}>
      <defs>
        <radialGradient id={`mg-${id}`} cx="35%" cy="30%" r="75%">
          {id === 'serumen-yavrusu' && <><stop offset="0" stopColor="#f2c27a" /><stop offset=".55" stopColor="#c98a3c" /><stop offset="1" stopColor="#8a5420" /></>}
          {id === 'cinlama-cini' && <><stop offset="0" stopColor="#c9b6ff" /><stop offset=".55" stopColor="#8b6bff" /><stop offset="1" stopColor="#4b2fc0" /></>}
          {id === 'yanki-hayaleti' && <><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#bff7f2" /><stop offset="1" stopColor="#2ee6d6" /></>}
        </radialGradient>
      </defs>
      {id === 'serumen-yavrusu' && <g>
        <path d="M60 14 C88 14 104 36 104 64 C104 92 86 106 60 106 C34 106 16 92 16 64 C16 36 32 14 60 14 Z" fill={`url(#mg-${id})`} />
        <path d="M30 96 q4 14 8 0 M82 100 q4 12 8 0 M56 104 q3 10 6 0" fill="#a8692c" />
        <circle cx="40" cy="30" r="8" fill="#fff" opacity=".35" />
        <path d="M34 22 l-6 -12 l12 6 Z M86 22 l6 -12 l-12 6 Z" fill="#8a5420" />
      </g>}
      {id === 'cinlama-cini' && <g>
        <path d="M60 104 C40 104 36 92 44 86 C24 84 18 66 22 52 C26 30 42 16 60 16 C78 16 94 30 98 52 C102 66 96 84 76 86 C84 92 80 104 60 104 Z" fill={`url(#mg-${id})`} />
        <g fill="none" stroke="#ffc93c" strokeWidth="4" strokeLinecap="round"><path d="M8 40 q-6 14 0 28" /><path d="M2 32 q-9 22 0 44" opacity=".6" /><path d="M112 40 q6 14 0 28" /><path d="M118 32 q9 22 0 44" opacity=".6" /></g>
        <path d="M52 16 l4 -12 l4 8 l4 -8 l4 12" fill="#ffc93c" />
        <circle cx="42" cy="32" r="7" fill="#fff" opacity=".35" />
      </g>}
      {id === 'yanki-hayaleti' && <g>
        <g fill="none" stroke="#2ee6d6" strokeWidth="3" opacity=".5"><circle cx="60" cy="60" r="54" /><circle cx="60" cy="60" r="46" opacity=".6" /></g>
        <path d="M60 12 C84 12 98 30 98 54 L98 98 L88 90 L78 100 L68 90 L60 100 L52 90 L42 100 L32 90 L22 98 L22 54 C22 30 36 12 60 12 Z" fill={`url(#mg-${id})`} />
        <circle cx="44" cy="28" r="7" fill="#fff" opacity=".6" />
      </g>}
      {eyes}{mouth}
    </svg>
  );
}
