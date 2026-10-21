import type { ReactNode } from 'react';

/**
 * Tedavi Odası malzemelerinin resimli simgeleri (24×24, ui/art.tsx'in ışık ve kontur diliyle; renk geçişleri ArtDefs'ten:
 * oa-gold, oa-teal, oa-coral, oa-violet, oa-green, oa-silver, oa-cream). Emoji kullanılmaz.
 */
const SH = 'rgba(14,6,40,.38)';
const S = ({ d, g, o, w = 1.2 }: { d: string; g: string; o: string; w?: number }) => <><path d={d} fill={SH} transform="translate(.5 1.2)" /><path d={d} fill={`url(#oa-${g})`} stroke={o} strokeWidth={w} strokeLinejoin="round" /></>;
const gloss = (cx: number, cy: number, rx = 1.6, ry = 0.8, rot = -30) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} fill="#fff" opacity={0.85} />;
const line = (d: string, c: string, w = 1.4) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
const drop = (x: number, y: number, s = 1, g = 'teal', o = '#0d5a63') => <S d={`M${x} ${y - 3.4 * s}c${1.9 * s} ${2.4 * s} ${2.6 * s} ${3.6 * s} ${2.6 * s} ${4.6 * s}a${2.6 * s} ${2.6 * s} 0 0 1 ${-5.2 * s} 0c0-${1 * s} ${0.7 * s}-${2.2 * s} ${2.6 * s}-${4.6 * s}z`} g={g} o={o} w={1} />;

const ART: Record<string, ReactNode> = {
  'kulak-tikaci': <>
    <g transform="rotate(-35 12 12)"><S d="M6 9.2h8.4a3.6 3.6 0 0 1 0 7.2H6a2 2 0 0 1-2-2v-3.2a2 2 0 0 1 2-2z" g="gold" o="#a35a00" />
      {line('M9 9.6v6.4M12 9.6v6.4', '#d07a00', 0.8)}{gloss(7.4, 10.8, 2, 0.7, 0)}</g>
    {line('M17.6 5.2a4 4 0 0 1 0 4.6M19.8 3.8a7 7 0 0 1 0 7.4', '#fff3b0', 1.2)}
  </>,
  'serumen-damlasi': <>
    <S d="M8.2 9.4h7.6v9.4a2.2 2.2 0 0 1-2.2 2.2H10.4a2.2 2.2 0 0 1-2.2-2.2z" g="gold" o="#8a4a00" />
    <rect x="9.6" y="12.4" width="4.8" height="4.4" rx="1" fill="#fff6e5" opacity=".9" /><path d="M10.6 14.6h2.8" stroke="#d07a00" strokeWidth=".9" />
    <S d="M9.8 5.4h4.4v4h-4.4z" g="cream" o="#8a6a3a" w={1} /><S d="M10.4 2.6h3.2v3h-3.2z" g="coral" o="#8f1740" w={1} />
    {drop(18.4, 7.6, 0.75, 'gold', '#8a4a00')}
  </>,
  'dis-kulak-damlasi': <>
    <S d="M7.6 9.6h7.2v9.2a2.2 2.2 0 0 1-2.2 2.2H9.8a2.2 2.2 0 0 1-2.2-2.2z" g="teal" o="#0d5a63" />
    <rect x="9" y="12.6" width="4.4" height="4" rx="1" fill="#fff" opacity=".85" /><path d="M11.2 13.4v2.4M10 14.6h2.4" stroke="#12a89e" strokeWidth="1" />
    <S d="M9.2 5.8h4v3.8h-4z" g="silver" o="#5a6380" w={1} /><S d="M9.8 2.8h2.8v3h-2.8z" g="violet" o="#2d1a85" w={1} />
    {drop(18, 9.2, 0.75)}
  </>,
  'zar-yamasi': <>
    <ellipse cx="12" cy="12.6" rx="8.4" ry="8.8" fill={SH} transform="translate(.5 1.2)" />
    <ellipse cx="12" cy="12.6" rx="8.4" ry="8.8" fill="url(#oa-gold)" stroke="#8a5a10" strokeWidth="1.1" />
    <ellipse cx="12" cy="12.6" rx="6.6" ry="7" fill="url(#oa-silver)" stroke="#6c6690" strokeWidth=".8" />
    <S d="M12.6 12.2c1.8-.6 3.6.2 3.8 1.8.2 1.8-1.6 3-3.4 2.8-1.6-.2-2.6-1.4-2.2-2.8.2-.8.8-1.4 1.8-1.8z" g="coral" o="#8f1740" w={0.9} />
    {line('M11.2 7.2l.6 4.6', '#f2e6c8', 1.3)}{gloss(9.4, 9.4, 1.4, 0.7)}
  </>,
  'ventilasyon-tupu': <>
    <g transform="rotate(-30 12 12)">
      <S d="M5 8.6h3.2v6.8H5z" g="violet" o="#2d1a85" /><S d="M15.8 8.6H19v6.8h-3.2z" g="violet" o="#2d1a85" />
      <S d="M8.2 10.2h7.6v3.6H8.2z" g="violet" o="#2d1a85" /><path d="M5.8 12h12.4" stroke="#1b0f4a" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />{gloss(6.4, 9.6, 1, 0.5, 90)}
    </g>
    {line('M3.6 4.6c1.6 1.4 1.6 2.6 0 4M6.4 3.4c2 1.8 2 4.2 0 6', '#c9f5ff', 1.1)}
  </>,
  'kemikcik-protezi': <>
    <ellipse cx="12" cy="6.2" rx="6.4" ry="2.6" fill={SH} transform="translate(.5 1.2)" />
    <ellipse cx="12" cy="6.2" rx="6.4" ry="2.6" fill="url(#oa-gold)" stroke="#8a5a10" strokeWidth="1.1" />
    <S d="M10.9 7.6h2.2v10.6h-2.2z" g="silver" o="#5a6380" w={1} />
    <S d="M8.6 18.2h6.8a1.4 1.4 0 0 1 0 2.8H8.6a1.4 1.4 0 0 1 0-2.8z" g="cream" o="#8a6a3a" w={1} />{gloss(9.6, 5.6, 1.6, 0.6, 0)}
  </>,
  'stapes-protezi': <>
    {line('M12 3.6c3 0 4 2.4 2.4 4.2-1 1.1-2.4 1.1-2.4 2.2', '#d5daea', 2)}{line('M12 3.6c3 0 4 2.4 2.4 4.2-1 1.1-2.4 1.1-2.4 2.2', '#5a6380', 0.6)}
    <S d="M10.8 9.6h2.4v9.4h-2.4z" g="silver" o="#5a6380" w={1} />
    <S d="M9.4 18.4h5.2v2.6H9.4z" g="violet" o="#2d1a85" w={1} />{gloss(11.4, 12, 0.5, 1.6, 0)}
    {line('M5.4 19.6c1.2-1 1.2-2.2 0-3.2M18.6 19.6c-1.2-1-1.2-2.2 0-3.2', '#c9f5ff', 1.1)}
  </>,
  'isitme-cihazi': <>
    <S d="M14.2 3.2c3.6.4 5.4 3.6 4.4 7.8l-1.6 6.2c-.4 1.6-2 2.4-3.4 1.8-1.2-.6-1.6-1.8-1.2-3.2l1.4-6.4c.3-1.6-.4-2.6-1.8-3.2-.8-.4-.6-1.4.3-1.8.6-.2 1.2-.3 1.9-.2z" g="green" o="#11663a" />
    {line('M12.6 4.4C8 4 5.4 7 5.6 10.4c.1 1.6 1 2.6 2.2 3.4', '#5a6380', 1.2)}
    <S d="M6.4 13.4h3v3.6a1.5 1.5 0 0 1-3 0z" g="cream" o="#8a6a3a" w={0.9} />{gloss(16.6, 6.2, 1.2, 0.6)}
    <circle cx="15.6" cy="11.6" r=".9" fill="#11663a" />
  </>,
  'ses-ureteci': <>
    <S d="M7.4 6.4h9.2a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H7.4a2 2 0 0 1-2-2V8.4a2 2 0 0 1 2-2z" g="teal" o="#0d5a63" />
    {line('M8.6 13c.9-2.6 1.8-2.6 2.7 0s1.8 2.6 2.7 0 1.8-2.6 2.7 0', '#ffffff', 1.3)}
    <circle cx="12" cy="17.2" r="1" fill="#0d5a63" />{gloss(8.8, 8.2, 1.6, 0.6, 0)}
    {line('M19.8 4.2a4.6 4.6 0 0 1 0 4.6', '#c9f5ff', 1.1)}
  </>,
  'uzaktan-mikrofon': <>
    <S d="M9.6 3.4h4.8a2.4 2.4 0 0 1 2.4 2.4v6.8a2.4 2.4 0 0 1-2.4 2.4H9.6a2.4 2.4 0 0 1-2.4-2.4V5.8a2.4 2.4 0 0 1 2.4-2.4z" g="coral" o="#8f1740" />
    {line('M9.4 6.2h5.2M9.4 8.2h5.2M9.4 10.2h5.2', '#ffd3df', 0.9)}
    {line('M12 15v4.2M9 20.6h6', '#5a6380', 1.4)}{gloss(9.6, 5, 1.3, 0.6)}
    {line('M4.4 6c-1.4 2.2-1.4 4.4 0 6.6M19.6 6c1.4 2.2 1.4 4.4 0 6.6', '#ffd3df', 1.2)}
  </>,
  'koklear-implant': <>
    <circle cx="9" cy="10.6" r="6.2" fill={SH} transform="translate(.5 1.2)" />
    <circle cx="9" cy="10.6" r="6.2" fill="url(#oa-gold)" stroke="#8a5a10" strokeWidth="1.1" />
    <circle cx="9" cy="10.6" r="2.4" fill="url(#oa-silver)" stroke="#5a6380" strokeWidth=".8" />
    {line('M14.6 13c2.4 1.2 3.6 2.8 3.6 5.4', '#5a6380', 1.3)}
    <S d="M16.4 17.4h3.6v3.6h-3.6z" g="violet" o="#2d1a85" w={1} />
    {line('M5.6 6.2a5 5 0 0 1 3.4-1.6', '#fff3b0', 1)}
  </>,
};

/** malzemenin resimli simgesi (bilinmeyen kimlik: boş çerçeve) */
export function RemedyIcon({ id, size = 28 }: { id: string; size?: number | string }) {
  return (
    <svg className="remedy-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      {ART[id] ?? <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="4" fill="rgba(5,2,20,.35)" stroke="rgba(201,193,255,.45)" strokeWidth="1.4" strokeDasharray="2.4 2" />}
    </svg>
  );
}
