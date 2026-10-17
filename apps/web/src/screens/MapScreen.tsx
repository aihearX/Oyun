import { useEffect, useRef } from 'react';
import { BIOMES, HUMAN_JOURNEY, type LevelPlan } from '@odi/content';
import type { BiomeId } from '@odi/shared';
import { useStore } from '../store';

/** Yolculuk haritası: biyom biyom gruplanmış 40 düğüm. Kilit: önceki bölüm en az 1 yıldız. */
export function MapScreen({ onPlay, onSkills, onSettings }: { onPlay: (n: number) => void; onSkills: () => void; onSettings: () => void }) {
  const s = useStore(); const unlocked = s.highestUnlocked(); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('.node.current')?.scrollIntoView({ block: 'center' }); }, []);
  const groups: { biome: BiomeId; levels: LevelPlan[] }[] = [];
  for (const l of HUMAN_JOURNEY.levels) { const g = groups[groups.length - 1]; if (g && g.biome === l.biome) g.levels.push(l); else groups.push({ biome: l.biome, levels: [l] }); }
  const totalStars = Object.values(s.progress).reduce((a, p) => a + p.stars, 0);
  return (
    <div className="screen fade-in" ref={ref}>
      <div className="topbar">
        <div className="brand">OD<span>İ</span> <span className="muted" style={{ fontSize: 14 }}>Sesin Yolu</span></div>
        <div className="pills"><div className="pill">🪙 {s.coins}</div><div className="pill">⭐ {totalStars}</div><div className="pill">Sv {s.playerLevel()}</div>{s.streak > 1 && <div className="pill">🔥 {s.streak} gün</div>}</div>
      </div>
      <div className="card row"><div className="grow"><h2>{HUMAN_JOURNEY.name}</h2><div className="muted">{HUMAN_JOURNEY.blurb}</div></div><button className="btn" onClick={() => onPlay(unlocked)}>Bölüm {unlocked} ▶</button></div>
      <div className="map">
        {groups.map((g) => { const b = BIOMES[g.biome]; return (
          <div className="biome" key={g.biome + g.levels[0]!.number}>
            <div className="biome-head"><h2>{b.name}</h2><div className="fact">{b.fact}</div></div>
            <div className="nodes">
              {g.levels.map((l) => { const p = s.progress[l.number]; const locked = l.number > unlocked; const cur = l.number === unlocked; return (
                <div key={l.number} className={`node${locked ? ' locked' : ''}${cur ? ' current' : ''}`} onClick={() => { if (!locked) onPlay(l.number); }}>
                  {l.boss && <span className="boss">👹</span>}
                  <div className="n">{l.number}</div><div className="name">{l.name}</div>
                  <div className="stars">{p ? '⭐'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : locked ? '🔒' : '☆☆☆'}</div>
                </div>); })}
            </div>
          </div>); })}
      </div>
      <div className="tabs"><button className="btn ghost" onClick={onSkills}>🧠 Yetenekler</button><button className="btn ghost" onClick={onSettings}>⚙️ Ayarlar</button></div>
    </div>
  );
}
