import { useEffect, useRef, useState } from 'react';
import type { BuildingId, CampState, Wallet } from '@odi/shared';
import { startCamp, type CampHandle, type CampTeam } from '@odi/game-core';
import { audio } from '@odi/audio';
import { celebrate } from '../celebrate';
import { platform } from '../platform';
import { TopBar, fmtLeft, fmtNum, useNow } from '../ui/social';
import { BuildingPanel } from './BuildingPanel';
import { ITEMS, askedHelp, buildKey, canUpgrade, celebrateBuilt, defOf, type CampActions } from './model';
import { Art } from '../ui/art';
import { Icon } from '../ui/icons';

export interface CampBaseProps {
  camp: CampState; wallet: Wallet; team: CampTeam | null; helpCount: number; fast: number;
  /** sunucu saatine eşitlenmiş şimdi (ms) */
  now: () => number;
  actions: CampActions;
  /** camp.helped olaylarına abone ol (dönüş: aboneliği bırak) */
  onHelped?: (fn: (building: BuildingId, seconds: number) => void) => () => void;
  onList: () => void;
  demo?: boolean;
}

/** Kulak Kampı üs görünümü: izometrik Phaser sahnesi + üst HUD + alt kısayollar + bina paneli. */
export function CampBase(p: CampBaseProps) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<CampHandle | null>(null);
  const [sel, setSel] = useState<BuildingId | null>(null);
  const [ready, setReady] = useState(false);
  const now = useNow(500); const sNow = p.now();
  void now;
  const live = useRef(p); live.current = p;
  const active = p.camp.buildings.find((b) => b.upgradingTo && b.endsAt);
  const canAsk = !!(p.team && active && !askedHelp.has(buildKey(active)));
  const [askTick, setAskTick] = useState(0);

  // sahne: bir kez kurulur, ekrandan çıkınca yok edilir
  useEffect(() => {
    if (!host.current) return;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const h = startCamp(host.current, {
      camp: p.camp, team: p.team, canAskHelp: canAsk, reducedMotion: reduced,
      now: () => live.current.now(),
      onTap: (id) => { audio.play('pop'); platform().haptic('light'); setSel(id); },
      onAskHelp: (id) => { void ask(id); },
      onSpeedup: (id) => { audio.play('tap'); setSel(id); },
      onCollect: () => { void collect(); },
      onBuilt: (id, level, tierUp) => {
        celebrateBuilt(id, level, tierUp && level > 1);
      },
      onReady: () => setReady(true),
    });
    handle.current = h;
    (window as unknown as { __kamp?: unknown }).__kamp = { pos: (id: BuildingId) => h.screenPos(id), view: () => h.view(), focus: (id: BuildingId) => h.focus(id, true) };
    audio.music('menu');
    return () => { h.destroy(); handle.current = null; delete (window as unknown as { __kamp?: unknown }).__kamp; };
  }, []);
  useEffect(() => { handle.current?.update({ camp: p.camp }); }, [p.camp]);
  useEffect(() => { handle.current?.update({ team: p.team }); }, [p.team?.emblem, p.team?.name]);
  useEffect(() => { handle.current?.update({ canAskHelp: canAsk }); }, [canAsk, askTick]);
  useEffect(() => p.onHelped?.((building, seconds) => { handle.current?.helped(building, seconds); audio.play('pop', { semitones: 7 }); platform().haptic('light'); }), [p.onHelped]);

  async function ask(id: BuildingId) {
    audio.play('tap');
    if (await live.current.actions.ask(id)) setAskTick((n) => n + 1);
  }
  async function collect() {
    audio.play('tap');
    const from = handle.current?.screenPos('depo') ?? undefined;
    const n = await live.current.actions.collect();
    if (n && n > 0) { handle.current?.collected(n); audio.play('coinBurst'); platform().haptic('success'); void celebrate.coins({ amount: n, from, kind: 'jeton' }); }
  }
  const actions: CampActions = { ...p.actions, ask: async (id) => { const ok = await p.actions.ask(id); if (ok) setAskTick((n) => n + 1); return ok; }, collect: async () => { await collect(); return 0; } };

  useEffect(() => { if (sel) handle.current?.focus(sel, true); else handle.current?.unfocus(); }, [sel]);
  const helpAll = async () => { audio.play('tap'); const n = await p.actions.helpAll(); if (n) { audio.play('coinBurst', { semitones: 4 }); platform().haptic('success'); } };
  const idle = !active;
  const anyUpgrade = idle && p.camp.buildings.some((b) => canUpgrade(p.camp, p.wallet, b.id).ok);

  return (
    <div className="camp-base">
      <div className="camp-canvas" ref={host} aria-label="Kulak Kampı üs görünümü" role="img" />
      {!ready && <div className="camp-loading" aria-hidden><span><Art e="🏕️" size="1.15em" className="art-inline" /></span></div>}
      <div className="camp-top">
        <TopBar title="Kamp" />
        <div className="camp-hud" aria-label="Kaynaklar">
          <button className={`hud-chip builder${active ? ' on' : ''}`} onClick={() => { if (active) { setSel(active.id); } }} aria-label={active ? `İnşaat: ${defOf(active.id).name}, kalan ${fmtLeft((active.endsAt ?? 0) - sNow)}` : 'İnşaatçı boşta'}>
            <Art e="🔨" size="1.15em" className="art-inline" /> {active ? <>{defOf(active.id).name.split(' ')[0]} <b>{fmtLeft(Math.max(0, (active.endsAt ?? 0) - sNow))}</b></> : 'Boşta'}
          </button>
          <span className="hud-chip speed" aria-label={`Hızlandırıcılar: ${ITEMS.map((it) => `${it.label} ${p.wallet.hizlandirici[it.k]} adet`).join(', ')}`}><Art e="⏩" size="1.15em" className="art-inline" />{ITEMS.map((it) => <span key={it.k} className="hs">{it.label.replace(' ', '')}<b>×{p.wallet.hizlandirici[it.k]}</b></span>)}</span>
          {p.demo && <span className="hud-chip" aria-label={`Jeton: ${fmtNum(p.wallet.jeton)}`}><Art e="🪙" size="1.15em" className="art-inline" /><b>{fmtNum(p.wallet.jeton)}</b></span>}
        </div>
        {p.demo && <div className="camp-demo-tag">ÖNİZLEME · sunucuya bir şey gitmez</div>}
      </div>

      <div className="camp-bottom">
        {idle && anyUpgrade && <div className="camp-hint"><Art e="👷" size="1.15em" className="art-inline" /> İnşaatçı boşta — bir binaya dokun, yükselt!</div>}
        <div className="camp-actions">
          {p.team && <button className={`btn camp-helpall${p.helpCount ? ' pulse' : ''}`} disabled={!p.helpCount} onClick={() => void helpAll()}><Art e="🤝" size="1.15em" className="art-inline" /> Herkese yardım et{` (${p.helpCount})`}</button>}
          <button className="btn ghost camp-listbtn" onClick={() => { audio.play('tap'); p.onList(); }} aria-label="Liste görünümü"><Icon name="list" size="1.1em" className="ic-inline" /> Liste</button>
        </div>
      </div>

      {/* ekran okuyucu / klavye için binalar */}
      <div className="sr-only">
        {p.camp.buildings.map((b) => <button key={b.id} onClick={() => setSel(b.id)}>{defOf(b.id).name}, Sv {b.level}{b.upgradingTo ? `, Sv ${b.upgradingTo} yapılıyor` : ''}</button>)}
      </div>

      {sel && <BuildingPanel id={sel} camp={p.camp} wallet={p.wallet} team={!!p.team} fast={p.fast} sNow={sNow} actions={actions} onClose={() => { audio.play('tap'); setSel(null); }} />}
    </div>
  );
}
