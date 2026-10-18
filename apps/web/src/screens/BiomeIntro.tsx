import { BIOMES, MECHANICS } from '@odi/content';
import type { LevelSpec } from '@odi/shared';
import { useEffect, useState } from 'react';
import { platform } from '../platform';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
/** İlk kez girilen biyom için kısa sinematik kart. Tek dokunuşla geçilir. */
export function BiomeIntro({ spec, onGo }: { spec: LevelSpec; onGo: () => void }) {
  const b = BIOMES[spec.biome]; const m = MECHANICS[spec.mechanic];
  const [ready, setReady] = useState(false);
  useEffect(() => { platform().haptic('medium'); const t = setTimeout(() => setReady(true), 500); return () => clearTimeout(t); }, []);
  const dark = ['kanal', 'sinir', 'beyin-sapi'].includes(spec.biome);
  return (
    <div className={`biome-intro${dark ? ' dark' : ''}`} style={{ ['--b1' as string]: hex(b.palette.bgFar), ['--b2' as string]: hex(b.palette.bgNear), ['--ba' as string]: hex(b.palette.accent) }} onClick={() => { if (ready) onGo(); }}>
      <div className="bi-rings" aria-hidden><i /><i /><i /></div>
      <div className="bi-body">
        <div className="bi-kicker">Yeni biyom</div>
        <h1 className="bi-title">{b.name}</h1>
        <p className="bi-blurb">{b.blurb}</p>
        <div className="bi-fact">👂 {b.fact}</div>
        <div className="bi-mech">{m.icon} {m.name}: {m.hint}</div>
        <button className="btn" style={{ opacity: ready ? 1 : 0 }} onClick={(e) => { e.stopPropagation(); onGo(); }}>Haydi! ▶</button>
      </div>
    </div>
  );
}
