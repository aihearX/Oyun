import { useEffect, useRef, useState } from 'react';
import type { LevelSpec, PlayerSkills, RaceRoom, RunResult } from '@odi/shared';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { getNet, useSocial } from '../net';
import { newerRoom } from '../race/common';
import { startLevel, type GameEvent, type LevelHandle, type LevelOptions, type RaceOptions } from '@odi/game-core';

const PAUSE_BG = { background: 'rgba(8,4,24,.78)' } as const;
const PAUSE_CARD = { background: 'linear-gradient(180deg, #2a1b63, #170d40)', border: '2px solid rgba(255,255,255,.14)', borderRadius: 22, padding: '22px 18px', boxShadow: '0 12px 40px rgba(0,0,0,.55)', color: '#fff6e5' } as const;
const PAUSE_GHOST = { color: '#fff6e5', borderColor: 'rgba(255,255,255,.28)', background: 'rgba(255,255,255,.06)' } as const;
/** cihazın güvenli alan üst boşluğu (CSS px; iOS çentik / Dinamik Ada / saat): yerel kabuğun bildirdiği inset (Expo DOM
 *  bileşeninin içinde env() 0 döner) ile tarayıcının env(safe-area-inset-top) değerinin büyüğü */
function safeAreaTop(): number {
  if (typeof document === 'undefined') return 0;
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;left:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(d); const v = parseFloat(getComputedStyle(d).paddingTop) || 0; d.remove();
  let native = 0; try { native = platform().insets?.top ?? 0; } catch { /* yok */ }
  return Math.max(v, native);
}

declare global { interface Window { __odi?: { events: GameEvent[]; result?: RunResult; done?: boolean; spec?: LevelSpec; race?: RaceRoom; /** bölüme verilen görünüm (Odi rengi/şapka) */ cosmetic?: LevelOptions['cosmetic']; /** bölüme verilen Tedavi Odası malzemeleri (test kancası) */ remedies?: LevelOptions['remedies'] } } }

/**
 * Phaser bölümünü bir div'e bağlar; olayları kabuğa ve (test için) window.__odi'ye aktarır.
 * `race` verilirse canlı yarış: rakip hayaletleri + üst şerit + sunucu saatine hizalı geri sayım; bölüm bitince
 * `race.finish` gönderilir ve onDone(sonuç, güncel oda) çağrılır. `raceBotDelayMs` yalnızca test harness'i içindir (bot ile).
 */
export function LevelHost({ spec, skills, sounds, bot, botIdle, timeScale, renderScale, extras, race, raceBotDelayMs, onDone, onQuit }: { spec: LevelSpec; skills: PlayerSkills; sounds: boolean; bot?: boolean; botIdle?: boolean; timeScale?: number; renderScale?: number; extras?: Pick<LevelOptions, 'cosmetic' | 'lucky' | 'firsts' | 'remedies'>; race?: RaceRoom; raceBotDelayMs?: number; onDone: (r: RunResult, raceRoom?: RaceRoom) => void; onQuit: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const handle = useRef<LevelHandle | null>(null);
  const [paused, setPaused] = useState(false); const [lives, setLives] = useState<number | null>(null);
  const [raceMenu, setRaceMenu] = useState(false); const [raceNote, setRaceNote] = useState<string | null>(null);
  const pauseRef = useRef<() => void>(() => undefined);
  /** "Yeniden başla": bölüm aynı ayarlarla baştan kurulur */
  const [runKey, setRunKey] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const bus: NonNullable<Window['__odi']> = { events: [], spec, race, cosmetic: extras?.cosmetic, remedies: race ? undefined : extras?.remedies }; window.__odi = bus;
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
      spec, skills, sounds, bot, botIdle, timeScale, ...(renderScale ? { renderScale } : {}), ...(bot ? {} : extras), ...(raceOpt ? { race: raceOpt, remedies: undefined } : {}),
      // çentik/kamera/saat: oyun içi gösterge güvenli alanın altına iner
      safeTop: safeAreaTop(),
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
  }, [spec.id, runKey]);
  // duraklatınca müzik kısılır (durmaz), devam edince geri gelir
  const togglePause = () => { if (paused) { handle.current?.resume(); setPaused(false); audio.duck(0); } else { handle.current?.pause(); setPaused(true); audio.duck(3600, 0.25); } };
  const restart = () => { setPaused(false); setLives(null); audio.duck(0); setRunKey((k) => k + 1); };
  pauseRef.current = () => { if (!paused) togglePause(); };
  useEffect(() => () => audio.duck(0), []);
  const leaveRace = () => { const net = getNet(); if (net) void net.call('race.leave', {}).catch(() => undefined); onQuit(); };
  return (
    <>
      <div className="level-host" ref={ref} />
      {paused && (
        // koyu duraklatma menüsü (açık temadan bağımsız: oyunun gece paletiyle)
        <div className="overlay pause-menu" role="dialog" aria-label="Duraklatıldı" style={PAUSE_BG}><div className="card" style={PAUSE_CARD}>
          <h2 style={{ color: '#fff6e5', margin: 0 }}>Duraklatıldı</h2><div style={{ color: '#c9c1ff', fontWeight: 700 }}>{spec.number}. {spec.name}{lives != null ? ` · ${lives} can` : ''}</div>
          <button className="btn" onClick={togglePause}>Devam</button>
          <button className="btn ghost" style={PAUSE_GHOST} onClick={restart}>Yeniden başla</button>
          <button className="btn ghost" style={PAUSE_GHOST} onClick={onQuit}>Haritaya dön</button>
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
