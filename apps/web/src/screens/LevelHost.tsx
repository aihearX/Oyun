import { useEffect, useRef, useState } from 'react';
import type { LevelSpec, PlayerSkills, RunResult } from '@odi/shared';
import { platform } from '../platform';
import { startLevel, type GameEvent, type LevelHandle } from '@odi/game-core';

declare global { interface Window { __odi?: { events: GameEvent[]; result?: RunResult; done?: boolean; spec?: LevelSpec } } }

/** Phaser bölümünü bir div'e bağlar; olayları kabuğa ve (test için) window.__odi'ye aktarır. */
export function LevelHost({ spec, skills, sounds, bot, botIdle, timeScale, onDone, onQuit }: { spec: LevelSpec; skills: PlayerSkills; sounds: boolean; bot?: boolean; botIdle?: boolean; timeScale?: number; onDone: (r: RunResult) => void; onQuit: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const handle = useRef<LevelHandle | null>(null);
  const [paused, setPaused] = useState(false); const [lives, setLives] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const bus: NonNullable<Window['__odi']> = { events: [], spec }; window.__odi = bus;
    let finished = false;
    const h = startLevel(ref.current, {
      spec, skills, sounds, bot, botIdle, timeScale,
      onEvent: (e) => {
        bus.events.push(e);
        if (bot) console.log('ODI_EVENT ' + JSON.stringify(e));
        if (e.type === 'damage') setLives(e.lives);
        if (e.type === 'haptic' && !bot) platform().haptic(e.kind);
        if ((e.type === 'levelComplete' || e.type === 'levelFailed') && !finished) { finished = true; bus.result = e.result; bus.done = true; if (!bot) setTimeout(() => onDone(e.result), 200); }
      },
    });
    handle.current = h;
    return () => { h.destroy(); handle.current = null; };
  }, [spec.id]);
  const togglePause = () => { if (paused) { handle.current?.resume(); setPaused(false); } else { handle.current?.pause(); setPaused(true); } };
  return (
    <>
      <div className="level-host" ref={ref} />
      {!bot && <button className="hud-btn" onClick={togglePause} aria-label="Duraklat">{paused ? '▶' : '⏸'}</button>}
      {paused && (
        <div className="overlay"><div className="card">
          <h2>Duraklatıldı</h2><div className="muted">{spec.number}. {spec.name}{lives != null ? ` · ${lives} can` : ''}</div>
          <button className="btn" onClick={togglePause}>Devam</button>
          <button className="btn ghost" onClick={onQuit}>Haritaya dön</button>
        </div></div>
      )}
    </>
  );
}
