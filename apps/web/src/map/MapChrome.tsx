/** Harita süsleri: gece parşömeni çerçevesi (köşe süsleri, kenar gölgesi), pusula gülü ve ölçek çubuğu. Dokunuşları geçirir. */
export function MapFrame() {
  return (
    <div className="map-frame" aria-hidden>
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <svg key={c} className={`mf-corner ${c}`} viewBox="0 0 64 64" width="64" height="64">
          <path d="M4 60 V14 Q4 4 14 4 H60" fill="none" stroke="#ffc93c" strokeWidth="2.2" />
          <path d="M10 60 V18 Q10 10 18 10 H60" fill="none" stroke="#ffc93c" strokeOpacity=".45" strokeWidth="1.2" />
          <path d="M14 26 Q22 22 20 14 Q28 18 26 26 Q20 30 14 26 Z" fill="#ffc93c" fillOpacity=".85" />
          <circle cx="7" cy="7" r="3.2" fill="#ff9f1c" />
        </svg>
      ))}
    </div>
  );
}

export function Compass({ tilt = 0 }: { tilt?: number }) {
  const pt = (a: number, r: number) => `${32 + Math.sin(a) * r},${32 - Math.cos(a) * r}`;
  const big = [0, 1, 2, 3].map((i) => i * Math.PI / 2); const small = big.map((a) => a + Math.PI / 4);
  return (
    <div className="map-compass" aria-hidden>
      <svg viewBox="0 0 64 64" width="58" height="58">
        <circle cx="32" cy="32" r="29" fill="rgba(20,12,53,.72)" stroke="#ffc93c" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="24" fill="none" stroke="#ffc93c" strokeOpacity=".35" strokeDasharray="2 3" />
        {small.map((a, i) => <polygon key={`s${i}`} points={`${pt(a, 17)} ${pt(a + 0.35, 5)} 32,32 ${pt(a - 0.35, 5)}`} fill="#8b6bff" stroke="#2d1d6e" strokeWidth=".6" />)}
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '32px 32px', transition: 'transform .6s cubic-bezier(.3,1.6,.5,1)' }}>
          {big.map((a, i) => <polygon key={`b${i}`} points={`${pt(a, 25)} ${pt(a + 0.28, 6)} 32,32 ${pt(a - 0.28, 6)}`} fill={i === 0 ? '#ff5c8a' : '#fff6e5'} stroke="#2d1d6e" strokeWidth=".7" />)}
        </g>
        <circle cx="32" cy="32" r="3" fill="#ffc93c" />
        <text x="32" y="10.5" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#ffc93c" fontFamily="Georgia,serif">K</text>
      </svg>
      <div className="map-scale"><i /><span>1 adım = 1 bölüm</span></div>
    </div>
  );
}
