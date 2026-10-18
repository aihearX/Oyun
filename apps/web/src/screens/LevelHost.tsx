import { useEffect, useRef, useState } from 'react';
import type { LevelSpec, PlayerSkills, RaceRoom, RunResult } from '@odi/shared';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { getNet, useSocial } from '../net';
import { newerRoom } from '../race/common';
import { startLevel, type GameEvent, type LevelHandle, type LevelOptions, type RaceOptions } from '@odi/game-core';

declare global { interface Window { __odi?: { events: GameEvent[]; result?: RunResult; done?: boolean; spec?: LevelSpec; race?: RaceRoom } } }

/**
 * Phaser bölümünü bir div'e bağlar; olayları kabuğa ve (test için) window.__odi'ye aktarır.
 * `race` verilirse canlı yarış: rakip hayaletleri + üst şerit + sunucu saatine hizalı geri sayım; bölüm bitince
 * `race.finish` gönderilir ve onDone(sonuç, güncel oda) çağrılır. `raceBotDelayMs` yalnızca test harness'i içindir (bot ile).
 */
export function LevelHost({ spec, skills, sounds, bot, botIdle, timeScale, extras, race, raceBotDelayMs, onDone, onQuit }: { spec: LevelSpec; skills: PlayerSkills; sounds: boolean; bot?: boolean; botIdle?: boolean; timeScale?: number; extras?: Pick<LevelOptions, 'cosmetic' | 'lucky' | 'firsts'>; race?: RaceRoom; raceBotDelayMs?: number; onDone: (r: RunResult, raceRoom?: RaceRoom) => void; onQuit: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const handle = useRef<LevelHandle | null>(null);
  const [paused, setPaused] = useState(false); const [lives, setLives] = useState<number | null>(null);
  const [raceMenu, setRaceMenu] = useState(false); const [raceNote, setRaceNote] = useState<string | null>(null);
  const pauseRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!ref.current) return;
    const bus: NonNullable<Window['__odi']> = { events: [], spec, race }; window.__odi = bus;
    let finished = false;
    // ---- canlı yarış bağlantısı (ağ yoksa normal bölüm olarak oynanır)
    const net = race ? getNet() : null;
    let latest = race; const offs: (() => void)[] = [];
    let raceOpt: RaceOptions | undefined;
    if (race && net) {
      offs.push(net.on('race.updated', ({ room }) => {
        if (room.id !== race.id) return;
        latest = newerRoom(latest, room); bus.race = latest;
        if (room.status === 'lobi' && !finished) setRaceNote('Yarış iptal oldu: rakip geri sayımda ayrıldı.');
        // sunucu yarışı bitirdi (süre doldu ya da ilk bitirenden sonra bekleme süresi geçti) ama ben hâlâ koşuyorum: koşu biter, sonuç gösterilir
        if (room.status === 'bitti' && !finished) setTimeout(() => { if (!finished) handle.current?.end('yaris-bitti'); }, 1200);
      }));
      raceOpt = {
        meId: net.me?.id ?? '',
        players: race.players.filter((p) => !p.left).map(({ id, name, color, hat }) => ({ id, name, color, hat })),
        // Başlama anı: sunucunun startsAt'i, istemcinin sunucu saat farkıyla (hello yanıtındaki serverTime → net.serverNow())
        // yerel performance.now() tabanına çevrilir; böylece herkesin "Başla!"sı aynı ana denk gelir.
        startAt: race.startsAt != null ? performance.now() + (race.startsAt - net.serverNow()) : 0,
        sendPos: (p) => net.fire('race.pos', p),
        subscribe: (cb) => net.on('race.pos', (p) => cb(p)),
        botDelayMs: bot ? raceBotDelayMs : undefined,
      };
    }
    const finishRace = async (r: RunResult): Promise<RaceRoom | undefined> => {
      if (!race || !net) return latest;
      try { return (await net.call('race.finish', { completed: r.completed, score: Math.max(0, Math.min(50_000, Math.round(r.score))), timeSec: Math.max(0, Math.min(3600, r.timeSec)) })).room; }
      catch { return latest; } // yarış zaten bitmiş (süre doldu) ya da bağlantı yok: son bilinen oda
    };
    const h = startLevel(ref.current, {
      spec, skills, sounds, bot, botIdle, timeScale, ...(bot ? {} : extras), ...(raceOpt ? { race: raceOpt } : {}),
      // oyun içi göstergenin duraklat düğmesi: tek kişilikte duraklat, yarışta çıkış menüsü
      onPauseRequest: () => { if (race) setRaceMenu(true); else pauseRef.current(); },
      // Revir bonusu (Kamp + takım): yarışta herkes eşit başlasın diye kapalı
      firstHitIgnorePct: bot || raceOpt ? 0 : (useSocial.getState().bonuses?.firstHitIgnorePct ?? 0),
      onEvent: (e) => {
        bus.events.push(e);
        if (bot) console.log('ODI_EVENT ' + JSON.stringify(e));
        if (e.type === 'damage') setLives(e.lives);
        if (e.type === 'haptic' && !bot) platform().haptic(e.kind);
        if ((e.type === 'levelComplete' || e.type === 'levelFailed') && !finished) {
          finished = true; bus.result = e.result;
          // oda: yanıt ile o arada gelen olaylardan en güncel olanı (sonuç ekranı da ayrıca canlı dinler)
          if (race) void finishRace(e.result).then((room) => { latest = newerRoom(latest, room); bus.race = latest; bus.done = true; setTimeout(() => onDone(e.result, latest), 200); });
          else { bus.done = true; if (!bot) setTimeout(() => onDone(e.result), 200); }
        }
      },
    });
    handle.current = h;
    return () => { for (const o of offs) o(); h.destroy(); handle.current = null; };
  }, [spec.id]);
  // duraklatınca müzik kısılır (durmaz), devam edince geri gelir
  const togglePause = () => { if (paused) { handle.current?.resume(); setPaused(false); audio.duck(0); } else { handle.current?.pause(); setPaused(true); audio.duck(3600, 0.25); } };
  pauseRef.current = () => { if (!paused) togglePause(); };
  useEffect(() => () => audio.duck(0), []);
  const leaveRace = () => { const net = getNet(); if (net) void net.call('race.leave', {}).catch(() => undefined); onQuit(); };
  return (
    <>
      <div className="level-host" ref={ref} />
      {paused && (
        <div className="overlay"><div className="card">
          <h2>Duraklatıldı</h2><div className="muted">{spec.number}. {spec.name}{lives != null ? ` · ${lives} can` : ''}</div>
          <button className="btn" onClick={togglePause}>Devam</button>
          <button className="btn ghost" onClick={onQuit}>Haritaya dön</button>
        </div></div>
      )}
      {raceMenu && !raceNote && (
        // canlı yarış durdurulamaz: rakipler koşmaya devam eder
        <div className="overlay"><div className="card">
          <h2>Yarıştan çıkılsın mı?</h2><div className="muted">Yarış sürüyor; çıkarsan derecen olmaz.</div>
          <button className="btn" onClick={() => setRaceMenu(false)}>Koşmaya devam</button>
          <button className="btn ghost" onClick={leaveRace}>Yarıştan çık</button>
        </div></div>
      )}
      {raceNote && (
        <div className="overlay"><div className="card">
          <h2>Yarış iptal</h2><div className="muted">{raceNote}</div>
          <button className="btn" onClick={leaveRace}>Lobiye dön</button>
        </div></div>
      )}
    </>
  );
}
