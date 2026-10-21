import { useEffect, useState } from 'react';
import { ActionButton } from '../ui/Button';
import { Art } from '../ui/art';
import './title.css';
import { tone, useOdiLook } from '../look';

/** Odi kahraman çizimi: degrade küre, kenar ışığı, parlama, hale; gözlerde ışık; yanında ses dalgaları. */
export function OdiHero({ size = 168 }: { size?: number }) {
  // oyuncunun seçtiği renk (takma ad sayfası / Dolap); seçilmediyse özgün mor çizim
  const look = useOdiLook();
  const st = look.custom ? [tone(look.color, 0.55), tone(look.color, 0.18), tone(look.color, -0.18), tone(look.color, -0.42)] : ['#c9b8ff', '#8b6bff', '#5a36e0', '#3b1fae'];
  const edge = look.custom ? tone(look.color, -0.55) : '#2d1a85';
  return (
    <svg className="odi-hero" width={size} height={size} viewBox="0 0 200 200" aria-hidden data-odi-color={look.color.toString(16).padStart(6, '0')}>
      <defs>
        <radialGradient id="oh-body" cx="38%" cy="32%" r="72%">
          <stop offset="0" stopColor={st[0]} /><stop offset=".38" stopColor={st[1]} /><stop offset=".78" stopColor={st[2]} /><stop offset="1" stopColor={st[3]} />
        </radialGradient>
        <radialGradient id="oh-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffc93c" stopOpacity=".55" /><stop offset=".45" stopColor="#8b6bff" stopOpacity=".28" /><stop offset="1" stopColor="#8b6bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="oh-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".0" /><stop offset=".7" stopColor="#2ee6d6" stopOpacity=".0" /><stop offset="1" stopColor="#2ee6d6" stopOpacity=".85" /></linearGradient>
        <radialGradient id="oh-cheek" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ff5c8a" stopOpacity=".55" /><stop offset="1" stopColor="#ff5c8a" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#oh-halo)" className="oh-halo" />
      <g className="oh-waves" fill="none" strokeLinecap="round">
        <path d="M160 74a40 40 0 0 1 0 52" stroke="#2ee6d6" strokeWidth="5" opacity=".9" />
        <path d="M174 60a62 62 0 0 1 0 80" stroke="#2ee6d6" strokeWidth="4" opacity=".55" />
        <path d="M40 74a40 40 0 0 0 0 52" stroke="#ffc93c" strokeWidth="5" opacity=".9" />
        <path d="M26 60a62 62 0 0 0 0 80" stroke="#ffc93c" strokeWidth="4" opacity=".55" />
      </g>
      <g className="oh-body">
        <ellipse cx="100" cy="176" rx="40" ry="7" fill="rgba(5,2,20,.45)" />
        <circle cx="100" cy="102" r="58" fill="url(#oh-body)" />
        <circle cx="100" cy="102" r="58" fill="url(#oh-rim)" />
        <circle cx="100" cy="102" r="57" fill="none" stroke={edge} strokeWidth="3" />
        <ellipse cx="76" cy="70" rx="20" ry="11" transform="rotate(-28 76 70)" fill="#fff" opacity=".55" />
        <ellipse cx="70" cy="66" rx="6" ry="3.4" transform="rotate(-28 70 66)" fill="#fff" opacity=".9" />
        <circle cx="70" cy="116" r="11" fill="url(#oh-cheek)" /><circle cx="130" cy="116" r="11" fill="url(#oh-cheek)" />
        <g className="oh-eyes">
          <ellipse cx="80" cy="96" rx="13" ry="14.5" fill="#fff" /><ellipse cx="120" cy="96" rx="13" ry="14.5" fill="#fff" />
          <circle cx="83" cy="99" r="7" fill="#22153f" /><circle cx="123" cy="99" r="7" fill="#22153f" />
          <circle cx="86" cy="95" r="2.6" fill="#fff" /><circle cx="126" cy="95" r="2.6" fill="#fff" />
        </g>
        <path d="M86 124q14 14 28 0" fill="none" stroke="#22153f" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Açılış: Odi, logo, hikâye cümlesi, tek ana düğme. Kulak Gecesi zemini (yıldızlar, ses halkaları) yavaşça yaşar. */
export function TitleScreen({ onStart, returning, invite, onChallenge }: { onStart: () => void; returning: boolean; invite?: { level: number; score: number; stars: number } | null; onChallenge?: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 250); return () => clearTimeout(t); }, []);
  return (
    <div className="screen fade-in title-screen">
      <div className="ts-sky" aria-hidden>
        <i className="ts-ring r1" /><i className="ts-ring r2" /><i className="ts-ring r3" />
        <span className="ts-note n1"><Art name="note" size={26} /></span>
        <span className="ts-note n2"><Art name="note" size={18} /></span>
        <span className="ts-note n3"><Art name="shell" size={22} /></span>
        <span className="ts-note n4"><Art name="star" size={16} /></span>
      </div>
      <div className="ts-hero"><OdiHero /></div>
      <div className="ts-logo">
        <h1 className="ts-word" aria-label="ODİ">OD<span>İ</span></h1>
        <div className="ts-tag"><i aria-hidden />Sesin Yolu<i aria-hidden /></div>
      </div>
      <p className="ts-story">{returning ? 'Ninni hâlâ yolda. Devam edelim mi?' : 'Odi küçük bir ses. Görevi: annenin ninnisini kulaktan beyne ulaştırmak. Yol uzun, kulak derin.'}</p>
      {invite && onChallenge && (
        <div className="card ts-invite">
          <div className="muted">Bir arkadaşın seni çağırıyor</div>
          <h2>{invite.score > 0 ? <>{invite.level}. bölümü {Array.from({ length: invite.stars }, (_, i) => <Art key={i} name="star" size="1em" className="art-inline" />)} {invite.score.toLocaleString('tr-TR')} puanla geçti</> : `${invite.level}. bölümde takıldı`}</h2>
          <div className="muted">{invite.score > 0 ? 'Skorunu geçebilir misin?' : 'Sen geçebilir misin?'}</div>
          <ActionButton block icon="megaphone" onClick={onChallenge}>Meydan okumayı kabul et</ActionButton>
        </div>
      )}
      <div className={`ts-cta${ready ? ' on' : ''}`}>
        {invite ? <ActionButton block tone="plain" icon="map" onClick={onStart}>{returning ? 'Devam et' : 'Yola çık'}</ActionButton>
          : <ActionButton block icon="play" onClick={onStart}>{returning ? 'Devam et' : 'Yola çık'}</ActionButton>}
      </div>
    </div>
  );
}
