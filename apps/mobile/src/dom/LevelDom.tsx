'use dom';
import { useEffect, useRef } from 'react';
import { startLevel, type GameEvent, type LevelHandle } from '@odi/game-core';
import type { LevelSpec, PlayerSkills, RunResult } from '@odi/shared';

export type LevelDomProps = {
  /** level-gen çıktısı; JSON serileştirilebilir */
  spec: LevelSpec;
  skills: PlayerSkills;
  sounds: boolean;
  /** harness/test: otomatik oyuncu */
  bot?: boolean;
  timeScale?: number;
  /** native duraklat düğmesi → sahne pause/resume */
  paused?: boolean;
  /** her oyun olayı native'e (haptik, sonuç, hazır) */
  onEvent: (e: GameEvent) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

declare global { interface Window { __odi?: { events: GameEvent[]; result?: RunResult; done?: boolean; spec?: LevelSpec } } }

/**
 * Phaser bölümü WebView içinde. Köprü: olaylar `onEvent` ile native'e; test için `window.__odi` (tools/domcheck.mjs).
 * Yalnızca tarayıcı API'leri; React Native import YOK.
 */
export default function LevelDom({ spec, skills, sounds, bot, timeScale, paused, onEvent }: LevelDomProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<LevelHandle | null>(null);
  const send = useRef(onEvent); send.current = onEvent;

  useEffect(() => {
    if (!ref.current) return;
    const bus: NonNullable<Window['__odi']> = { events: [], spec }; window.__odi = bus;
    let finished = false;
    const h = startLevel(ref.current, {
      spec, skills, sounds, bot, timeScale,
      onEvent: (e) => {
        bus.events.push(e);
        if (bot) console.log('ODI_EVENT ' + JSON.stringify(e));
        if ((e.type === 'levelComplete' || e.type === 'levelFailed')) { if (finished) return; finished = true; bus.result = e.result; bus.done = true; }
        // Köprü eşzamansız; hatası oyunu durdurmasın.
        Promise.resolve().then(() => send.current(e)).catch(() => undefined);
      },
    });
    handle.current = h;
    return () => { h.destroy(); handle.current = null; };
    // spec.id değişince bölüm baştan kurulur; diğer prop'lar kurulumda okunur.
  }, [spec.id]);

  useEffect(() => { if (paused) handle.current?.pause(); else handle.current?.resume(); }, [paused]);

  return <div ref={ref} style={{ position: 'fixed', inset: 0, background: '#ffffff', overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }} />;
}
