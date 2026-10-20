import type { BiomeId } from '@odi/shared';

/**
 * Küçük anatomik çizimler (Kulak Sözlüğü): her bölge için tek bir sade şekil. ui/art.tsx ile aynı dil:
 * degrade dolgu, koyu kontur, tepe parlaması. 48×48 görünüm kutusu; renk bölgeden gelir.
 */
const STROKE = '#22153f';
const GRAD: Record<string, [string, string]> = {
  pink: ['#ffd3c7', '#ff7a59'], amber: ['#ffe2a8', '#e08a3c'], rose: ['#ffd0dc', '#ff4f7a'], bone: ['#fffaf0', '#cfc6b0'],
  violet: ['#e2d9ff', '#7c5cff'], teal: ['#c9fff8', '#16b3a7'], blue: ['#cfe9ff', '#3a7bd5'], plum: ['#f3d2ff', '#a05ad8'],
};
const tone: Record<BiomeId, keyof typeof GRAD> = {
  'dis-kulak': 'pink', kanal: 'amber', zar: 'rose', kemikcikler: 'bone', 'koklea-1': 'violet', 'koklea-2': 'plum', 'koklea-3': 'amber', sinir: 'blue', 'beyin-sapi': 'teal', korteks: 'rose',
};

function Shape({ region }: { region: BiomeId }) {
  const f = `url(#an-${tone[region]})`;
  const s = { stroke: STROKE, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (region) {
    case 'dis-kulak': // kulak kepçesi
      return <><path d="M30 6c-9 0-16 7-16 16 0 6 3 9 5 12 2 3 2 6 1 8 3 2 8 1 10-3 2-4 6-6 9-10 3-4 3-8 3-11C42 11 37 6 30 6z" fill={f} {...s} /><path d="M24 22c0-4 3-7 7-7s6 3 6 6-3 4-5 6" fill="none" {...s} /></>;
    case 'kanal': // dış kulak yolu: kıvrık tüp
      return <><path d="M6 20c8-6 14 8 22 2s14-4 14-4v12s-6-2-14 4-14-8-22-2z" fill={f} {...s} /><ellipse cx="42" cy="24" rx="3" ry="6" fill="#fff6e5" {...s} /></>;
    case 'zar': // kulak zarı: eğimli zar + çekiç sapı
      return <><ellipse cx="24" cy="24" rx="15" ry="18" fill={f} {...s} /><path d="M24 9v17" {...s} /><circle cx="24" cy="26" r="2.5" fill={STROKE} /></>;
    case 'kemikcikler': // çekiç, örs, üzengi
      return <><path d="M8 14c3-5 9-5 11 0l-3 12-5 1z" fill={f} {...s} /><path d="M19 13l9 1 2 7-6 9-3-1 2-8z" fill={f} {...s} /><path d="M29 27l8 4M29 33l8-2M36 28l5 6-6 4z" fill="none" {...s} /><path d="M36 28l5 6-6 4z" fill={f} {...s} /></>;
    case 'koklea-1': case 'koklea-3': // koklea sarmalı
      return <><path d="M24 40c-9 0-16-7-16-16S15 8 24 8s14 6 14 13-5 11-11 11-9-4-9-8 3-6 6-6 4 2 4 4" fill="none" stroke={STROKE} strokeWidth="7" strokeLinecap="round" /><path d="M24 40c-9 0-16-7-16-16S15 8 24 8s14 6 14 13-5 11-11 11-9-4-9-8 3-6 6-6 4 2 4 4" fill="none" stroke={f} strokeWidth="4.5" strokeLinecap="round" /></>;
    case 'koklea-2': // tüy hücresi + stereosilya
      return <><path d="M14 22c0-4 4-6 10-6s10 2 10 6v14c0 5-4 8-10 8s-10-3-10-8z" fill={f} {...s} />{[15, 20, 25, 30].map((x, i) => <path key={x} d={`M${x} 17V${12 - i * 2}`} {...s} />)}<circle cx="24" cy="31" r="3" fill="#fff6e5" {...s} /></>;
    case 'sinir': // sinir lifleri demeti
      return <><path d="M6 30c10-2 14-12 24-12h12M6 24c10 0 14-8 24-8h12M6 36c12-2 16-10 24-10h12" fill="none" stroke={STROKE} strokeWidth="5" strokeLinecap="round" /><path d="M6 30c10-2 14-12 24-12h12M6 24c10 0 14-8 24-8h12M6 36c12-2 16-10 24-10h12" fill="none" stroke={f} strokeWidth="2.6" strokeLinecap="round" /><circle cx="10" cy="30" r="3.5" fill="#ffc93c" {...s} /></>;
    case 'beyin-sapi': // beyin sapı: iki taraf birleşir
      return <><path d="M14 8c4 0 6 4 10 4s6-4 10-4c3 6 0 12-4 16v16h-12V24c-4-4-7-10-4-16z" fill={f} {...s} /><path d="M18 22l6 4 6-4" fill="none" {...s} /></>;
    case 'korteks': // beyin (yan görünüş) + temporal lob vurgusu
      return <><path d="M10 26c-3-9 4-17 13-17 6-3 15 1 16 8 5 2 5 10 1 13-1 6-8 8-12 6-3 4-10 3-12-1-4 0-6-4-6-9z" fill={f} {...s} /><path d="M17 30c4 2 9 2 13 0" fill="none" {...s} /><path d="M20 17c2 3 6 3 8 0M30 20c1 3 4 4 6 3" fill="none" {...s} /></>;
  }
}

export function AnatomyGlyph({ region, size = 40 }: { region: BiomeId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="anat">
      <defs>{Object.entries(GRAD).map(([k, [a, b]]) => <linearGradient key={k} id={`an-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>)}</defs>
      <ellipse cx="24" cy="44.5" rx="13" ry="2.4" fill="rgba(14,6,40,.3)" />
      <Shape region={region} />
    </svg>
  );
}
