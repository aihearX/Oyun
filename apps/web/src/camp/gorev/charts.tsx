/**
 * Klinik çizimleri: odyogram (ASHA sembolleri: sağ hava yolu kırmızı O, sol hava yolu mavi X, kemik yolu sağ <, sol >;
 * yanıt yok: sembolün altında aşağı ok), timpanogram (Jerger tipleri; normal bölge gölgeli), otoskopi görünümü (stilize) ve
 * kurgusal hasta çizimi (gerçekçi olmayan, resimli karakter). Hepsi SVG; renkler koyu cam panellerde okunur.
 */
import { AC_HZ, BC_AT, type HastaGorunum, type Odyogram, type Otoskopi, type Timp, type YasGrubu } from '@odi/content';

const RED = '#ff6b7f'; const BLUE = '#6fb7ff';
const fmt = (n: number, d = 1) => n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

// ------------------------------------------------------------------ odyogram
export function OdyogramSvg({ o, normalBand = true, title = 'Odyogram' }: { o: Odyogram; normalBand?: boolean; title?: string }) {
  const W = 320, H = 250, x0 = 40, x1 = 306, y0 = 22, y1 = 226;
  const xOf = (i: number) => x0 + (Math.log2(AC_HZ[i]! / 250) / 5) * (x1 - x0);
  const yOf = (db: number) => y0 + ((db + 10) / 130) * (y1 - y0);
  const ear = (e: 'R' | 'L') => {
    const color = e === 'R' ? RED : BLUE; const ac = o.ac[e]; const bc = o.bc[e];
    const nrAc = o.nr?.[e === 'R' ? 'acR' : 'acL'] ?? []; const nrBc = o.nr?.[e === 'R' ? 'bcR' : 'bcL'] ?? [];
    const pts = ac.map((d, i) => [xOf(i), yOf(d)] as const);
    const path = pts.filter((_, i) => !nrAc.includes(i)).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const dx = e === 'R' ? -9 : 9;
    return (
      <g key={e} data-ear={e}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeDasharray={e === 'L' ? '6 4' : undefined} opacity=".85" />
        {pts.map(([x, y], i) => (
          <g key={i}>
            {e === 'R' ? <circle cx={x} cy={y} r="5.6" fill="#1a1240" stroke={color} strokeWidth="2.2" /> : <path d={`M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10`} stroke={color} strokeWidth="2.4" strokeLinecap="round" />}
            {nrAc.includes(i) && <path d={`M${x + (e === 'R' ? 4 : -4)} ${y + 5}l${e === 'R' ? 6 : -6} 8m0 0l0-5m0 5l${e === 'R' ? -5 : 5} 0`} stroke={color} strokeWidth="1.6" fill="none" />}
          </g>
        ))}
        {bc.map((d, bi) => {
          const x = xOf(BC_AT[bi]!) + dx; const y = yOf(d);
          return (
            <g key={`b${bi}`}>
              <path d={e === 'R' ? `M${x + 4} ${y - 6}L${x - 4} ${y}L${x + 4} ${y + 6}` : `M${x - 4} ${y - 6}L${x + 4} ${y}L${x - 4} ${y + 6}`} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
              {nrBc.includes(bi) && <path d={`M${x} ${y + 7}l0 8m-3-3l3 3 3-3`} stroke={color} strokeWidth="1.5" fill="none" />}
            </g>
          );
        })}
      </g>
    );
  };
  return (
    <svg className="kg-chart kg-ody" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} data-testid="odyogram">
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx="6" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.18)" />
      {normalBand && <rect x={x0} y={yOf(-10)} width={x1 - x0} height={yOf(25) - yOf(-10)} fill="rgba(95,227,154,.12)" />}
      {normalBand && <text x={x1 - 4} y={yOf(25) + 11} textAnchor="end" className="kg-ax small kg-normal">↑ normal bölge</text>}
      {Array.from({ length: 14 }, (_, i) => -10 + i * 10).map((d) => (
        <g key={d}><line x1={x0} x2={x1} y1={yOf(d)} y2={yOf(d)} stroke="rgba(255,255,255,.1)" strokeWidth={d === 0 ? 1.4 : 1} />{d % 20 === 0 && <text x={x0 - 5} y={yOf(d) + 3.5} textAnchor="end" className="kg-ax">{d}</text>}</g>
      ))}
      {AC_HZ.map((f, i) => (
        <g key={f}><line x1={xOf(i)} x2={xOf(i)} y1={y0} y2={y1} stroke="rgba(255,255,255,.1)" strokeDasharray={f === 3000 || f === 6000 ? '2 3' : undefined} />
          <text x={xOf(i)} y={y0 - 7} textAnchor="middle" className="kg-ax">{f >= 1000 ? `${f / 1000}k` : f}</text></g>
      ))}
      <text x={6} y={y0 + 4} className="kg-ax small" transform={`rotate(-90 6 ${y0 + 4})`} textAnchor="end">dB HL</text>
      {ear('R')}{ear('L')}
    </svg>
  );
}
export function OdyogramLejant() {
  return (
    <div className="kg-legend" aria-label="Odyogram sembolleri">
      <span><i className="sym o" aria-hidden /> Sağ hava yolu</span><span><i className="sym x" aria-hidden /> Sol hava yolu</span>
      <span><b className="r">&lt;</b> Sağ kemik yolu</span><span><b className="l">&gt;</b> Sol kemik yolu</span>
    </div>
  );
}

// ------------------------------------------------------------------ timpanogram
/** Jerger eğrisi: tepe basıncında, statik admitans yüksekliğinde bir tepe; düz eğride (B) tepe yok */
function curve(t: Timp): [number, number][] {
  const pts: [number, number][] = [];
  for (let p = -400; p <= 200; p += 10) {
    let y: number;
    if (t.tip === 'B') y = t.uyum * 0.8 + (p + 400) * 0.00012;
    else { const w = t.tip === 'As' ? 55 : t.tip === 'Ad' ? 75 : 65; y = 0.06 + t.uyum * Math.exp(-(((p - (t.basinc ?? 0)) / w) ** 2)); }
    pts.push([p, y]);
  }
  return pts;
}
/** mini: seçenek kartı için küçük çizim; tüm mini eğriler aynı ölçekte (yükseklikler karşılaştırılabilir), eksen yazısı yok */
export function TimpanogramSvg({ R, L, tek, values = false, title = 'Timpanogram', mini = false }: { R?: Timp | null; L?: Timp | null; tek?: Timp; values?: boolean; title?: string; mini?: boolean }) {
  const W = 320, H = 200, x0 = mini ? 8 : 40, x1 = mini ? 312 : 306, y0 = 14, y1 = mini ? 190 : 168;
  const all = [R, L, tek].filter((t): t is Timp => !!t);
  const ymax = mini ? 3.2 : Math.max(2, ...all.map((t) => t.uyum + 0.4));
  const xOf = (p: number) => x0 + ((p + 400) / 600) * (x1 - x0);
  const yOf = (v: number) => y1 - (v / ymax) * (y1 - y0);
  const line = (t: Timp, color: string, dash?: string, key = '') => <path key={key} d={curve(t).map(([p, v], i) => `${i ? 'L' : 'M'}${xOf(p).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={mini ? 5 : 2.6} strokeDasharray={dash} strokeLinecap="round" />;
  return (
    <svg className={`kg-chart kg-timp${mini ? ' mini' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} data-testid={mini ? 'timpanogram-mini' : 'timpanogram'}>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx="6" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.18)" />
      {/* normal bölge (Tip A): −100…+50 daPa, 0,3–1,7 ml */}
      <rect x={xOf(-100)} y={yOf(1.7)} width={xOf(50) - xOf(-100)} height={yOf(0.3) - yOf(1.7)} fill="rgba(95,227,154,.12)" stroke="rgba(142,240,176,.4)" strokeDasharray="3 3" />
      {[-400, -300, -200, -100, 0, 100, 200].map((p) => <g key={p}><line x1={xOf(p)} x2={xOf(p)} y1={y0} y2={y1} stroke="rgba(255,255,255,.1)" strokeWidth={p === 0 ? 1.4 : 1} />{!mini && <text x={xOf(p)} y={y1 + 14} textAnchor="middle" className="kg-ax">{p}</text>}</g>)}
      {[0, 0.5, 1, 1.5, 2, 2.5, 3].filter((v) => v <= ymax).map((v) => <g key={v}><line x1={x0} x2={x1} y1={yOf(v)} y2={yOf(v)} stroke="rgba(255,255,255,.08)" />{!mini && <text x={x0 - 5} y={yOf(v) + 3.5} textAnchor="end" className="kg-ax">{fmt(v)}</text>}</g>)}
      {!mini && <text x={x1} y={H - 2} textAnchor="end" className="kg-ax small">daPa</text>}
      {!mini && <text x={6} y={y0 + 4} className="kg-ax small" transform={`rotate(-90 6 ${y0 + 4})`} textAnchor="end">ml</text>}
      {tek && line(tek, '#ffd66b', undefined, 't')}
      {R && line(R, RED, undefined, 'r')}
      {L && line(L, BLUE, '7 4', 'l')}
      {values && tek && <text x={x1 - 6} y={y0 + 16} textAnchor="end" className="kg-ax val">Kanal hacmi {fmt(tek.hacim)} ml</text>}
    </svg>
  );
}

// ------------------------------------------------------------------ otoskopi (stilize)
export function OtoskopSvg({ f, ear, size = 120 }: { f: Otoskopi; ear: 'R' | 'L'; size?: number }) {
  const s = ear === 'R' ? 1 : -1; // ışık üçgeni: sağda saat 5, solda saat 7 yönünde
  const drum = f === 'efuzyon' ? '#e8b86a' : f === 'plak' ? '#c9cfdd' : f === 'odem' ? '#d98c8c' : '#bfc6d8';
  return (
    <svg className="kg-oto" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${ear === 'R' ? 'Sağ' : 'Sol'} kulak otoskopi görünümü`}>
      <defs><radialGradient id={`kgo-${ear}`} cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#ffe9d2" /><stop offset="1" stopColor="#c47a5c" /></radialGradient></defs>
      <circle cx="50" cy="50" r="48" fill={`url(#kgo-${ear})`} stroke="#1a1240" strokeWidth="3" />
      {f === 'odem'
        ? <circle cx="50" cy="50" r="40" fill="none" stroke="#e05a5a" strokeWidth="22" opacity=".9" />
        : <circle cx="50" cy="50" r="32" fill={drum} stroke="#8d96b4" strokeWidth="2" opacity={f === 'serumen' ? 0.4 : 1} />}
      {f !== 'serumen' && f !== 'odem' && <>
        {/* çekiç sapı ve umbo: kısa çıkıntı ön-üstte (sağ kulakta saat 1, solda 11), ışık üçgeniyle aynı (ön) tarafta */}
        <path d={`M${50 + 8 * s} 24 L50 50`} stroke={f === 'icecekik' ? '#fff' : '#e9ecf5'} strokeWidth={f === 'icecekik' ? 4 : 3} strokeLinecap="round" />
        <circle cx="50" cy="50" r="2.4" fill="#e9ecf5" />
        {/* ışık üçgeni */}
        {f !== 'efuzyon' && f !== 'perforasyon' && <path d={f === 'icecekik' ? `M${50 + 4 * s} 54 l${8 * s} 6 l${-2 * s} 3z` : `M${50 + 4 * s} 54 l${18 * s} 14 l${-8 * s} 6z`} fill="#fffbe6" opacity=".9" />}
      </>}
      {f === 'serumen' && <path d="M22 38c8-14 30-20 46-12 14 8 16 30 4 42-12 12-36 12-48 0-8-8-8-20-2-30z" fill="#7a4a22" stroke="#4d2c10" strokeWidth="2" />}
      {f === 'eksostoz' && <><circle cx="20" cy="40" r="11" fill="#f4efe6" stroke="#b8ad9a" strokeWidth="1.5" /><circle cx="78" cy="58" r="12" fill="#f4efe6" stroke="#b8ad9a" strokeWidth="1.5" /><circle cx="44" cy="84" r="9" fill="#f4efe6" stroke="#b8ad9a" strokeWidth="1.5" /></>}
      {f === 'perforasyon' && <ellipse cx={50 + 13 * s} cy="62" rx="10" ry="8" fill="#2a1418" stroke="#5a2a30" strokeWidth="1.5" />}
      {f === 'efuzyon' && <><path d="M20 56 Q50 50 80 56" stroke="#a8742c" strokeWidth="2" fill="none" /><circle cx="38" cy="44" r="3" fill="none" stroke="#fff6e5" strokeWidth="1.2" /><circle cx="58" cy="40" r="2.2" fill="none" stroke="#fff6e5" strokeWidth="1.2" /><circle cx="64" cy="46" r="2.8" fill="none" stroke="#fff6e5" strokeWidth="1.2" /></>}
      {f === 'retraksiyon' && <ellipse cx={50 - 12 * s} cy="36" rx="9" ry="7" fill="#5b4a5e" stroke="#2e2232" strokeWidth="1.5" />}
      {f === 'plak' && <path d={`M${50 - 22 * s} 46 a20 20 0 0 0 ${18 * s} 22`} stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".95" />}
    </svg>
  );
}

// ------------------------------------------------------------------ kurgusal hasta (resimli, gerçekçi olmayan)
const TEN = ['#ffe0c7', '#f2c29b', '#d39a6a', '#a06a44'];
const SAC: Record<HastaGorunum['sac'], string> = { kahve: '#6b3f22', siyah: '#2a1d1a', sari: '#f2c55c', kizil: '#d4592a', gri: '#a7a9b4', beyaz: '#eef0f6', yok: 'transparent' };
export function HastaSvg({ g, grup, size = 64 }: { g: HastaGorunum; grup: YasGrubu; size?: number }) {
  const skin = TEN[g.ten]!; const hair = SAC[g.sac];
  const baby = grup === 'bebek'; const old = grup === 'yasli'; const kid = grup === 'cocuk';
  const r = baby ? 25 : kid ? 27 : 28;
  return (
    <svg className="kg-hasta" width={size} height={size} viewBox="0 0 80 80" aria-hidden focusable="false">
      <circle cx="40" cy="40" r="38" fill="rgba(139,107,255,.25)" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" />
      {/* omuzlar */}
      <path d="M14 80c2-14 12-20 26-20s24 6 26 20z" fill={g.aks === 'okul' ? '#ff9f1c' : g.aks === 'baret' ? '#ff7a2a' : '#5fa8ff'} />
      {g.aks === 'okul' && <path d="M24 66l4 14M56 66l-4 14" stroke="#7a3a00" strokeWidth="3" />}
      {/* kulaklar */}
      <ellipse cx={40 - r + 1} cy="42" rx="5" ry="7" fill={skin} stroke="#00000022" />
      <ellipse cx={40 + r - 1} cy="42" rx="5" ry="7" fill={skin} stroke="#00000022" />
      {g.aks === 'cihaz' && <path d={`M${40 + r + 2} 34c5 1 6 9 1 12`} stroke="#c9cfdd" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
      <circle cx="40" cy="40" r={r} fill={skin} stroke="#00000026" strokeWidth="1.2" />
      {/* saç */}
      {g.sac !== 'yok' && !baby && <path d={old ? `M${40 - r + 3} 34c2-12 10-18 21-18s19 6 21 18c-6-6-12-7-21-7s-15 1-21 7z` : `M${40 - r} 40c-1-16 10-25 24-25s24 9 23 25c-4-9-11-14-23-14s-20 5-24 14z`} fill={hair} />}
      {baby && <path d="M40 14c4 0 5 4 2 6" stroke="#6b3f22" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {/* yüz */}
      <circle cx="31" cy="42" r="2.8" fill="#2a1d1a" /><circle cx="49" cy="42" r="2.8" fill="#2a1d1a" />
      <circle cx="32" cy="41" r="0.9" fill="#fff" /><circle cx="50" cy="41" r="0.9" fill="#fff" />
      <circle cx="26" cy="49" r="3.2" fill="#ff8fa3" opacity=".35" /><circle cx="54" cy="49" r="3.2" fill="#ff8fa3" opacity=".35" />
      {g.aks === 'emzik' ? <><circle cx="40" cy="54" r="5" fill="#8fd3ff" stroke="#3a7fb0" /><circle cx="40" cy="54" r="2" fill="#fff" /></> : <path d="M33 52q7 6 14 0" stroke="#7a3a2a" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {old && <path d="M24 36q4-2 8 0M48 36q4-2 8 0" stroke="#00000033" strokeWidth="1.2" fill="none" />}
      {/* aksesuarlar */}
      {g.aks === 'gozluk' && <g fill="none" stroke="#2d1d6e" strokeWidth="2"><circle cx="31" cy="42" r="6" /><circle cx="49" cy="42" r="6" /><path d="M37 42h6" /></g>}
      {g.aks === 'baret' && <path d="M14 30c0-14 12-22 26-22s26 8 26 22zM10 30h60" fill="#ffc93c" stroke="#a35a00" strokeWidth="2" />}
      {g.aks === 'kulaklik' && <g><path d="M14 40c0-18 12-28 26-28s26 10 26 28" stroke="#2d1d6e" strokeWidth="4" fill="none" /><rect x="8" y="36" width="9" height="14" rx="4" fill="#8b6bff" /><rect x="63" y="36" width="9" height="14" rx="4" fill="#8b6bff" /></g>}
      {g.aks === 'bere' && <path d="M14 34c0-16 12-24 26-24s26 8 26 24c-8-4-16-6-26-6s-18 2-26 6z" fill="#ff5c8a" stroke="#8f1740" strokeWidth="1.5" />}
      {g.aks === 'yuzucu' && <path d="M13 38c0-17 12-26 27-26s27 9 27 26c-8-5-17-7-27-7s-19 2-27 7z" fill="#2ee6d6" stroke="#0b5f5a" strokeWidth="1.5" />}
      {g.aks === 'bisiklet' && <path d="M12 34c2-16 14-24 28-24s26 8 28 24zM22 22l4 8M40 14v8M58 22l-4 8" fill="#5fe39a" stroke="#11663a" strokeWidth="1.8" />}
      {g.aks === 'sapka' && <path d="M16 30c2-12 12-18 24-18s22 6 24 18zM8 30h46" fill="#ff9f1c" stroke="#a35a00" strokeWidth="2" />}
    </svg>
  );
}
