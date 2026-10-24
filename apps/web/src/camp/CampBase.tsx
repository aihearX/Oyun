import { useEffect, useMemo, useRef, useState } from 'react';
import type { BuildingId, CampState, CheerKind, Wallet } from '@odi/shared';
import { CAMP_CHEERS } from '@odi/shared';
import type { CampHandle, CampTeam } from '@odi/game-core/lite';
import { chunkFailed, loadCamp } from '../engine';
import { audio } from '@odi/audio';
import { celebrate } from '../celebrate';
import { platform } from '../platform';
import { TopBar, fmtLeft, fmtNum, useNow } from '../ui/social';
import { BuildingPanel } from './BuildingPanel';
import { ITEMS, askedHelp, buildKey, canUpgrade, defOf, shortOf, type CampActions } from './model';
import { BIOMES, decorById, districtById, monumentOf } from '@odi/content';
import type { BiomeId } from '@odi/shared';
import { clearedCount } from '../ftue/features';
import { DedeCard, sayDede, showDede } from './dede';
import { markSeen, monumentToCelebrate, regionsNow } from './anit';
import { Art } from '../ui/art';
import { Icon } from '../ui/icons';
import { odiLook } from '../look';
import { useStore } from '../store';
import { GorevChips, GorevHost } from './gorev/Kanca';
import { CampLevelChip, CampLevelPanel } from './KampSeviye';
import { SusPanel, type SusSel } from './SusPanel';

/** başka bir oyuncunun kampını gezme (salt okunur) */
export interface CampVisitView {
  name: string; heroColor: number; regions: string[]; cheeredToday: CheerKind | null; cheers: number; relation: 'arkadas' | 'takim';
  onCheer(kind: CheerKind): Promise<void>;
  onBack(): void;
}

export interface CampBaseProps {
  camp: CampState; wallet: Wallet; team: CampTeam | null; helpCount: number; fast: number;
  /** sunucu saatine eşitlenmiş şimdi (ms) */
  now: () => number;
  actions: CampActions;
  /** camp.helped olaylarına abone ol (dönüş: aboneliği bırak) */
  onHelped?: (fn: (building: BuildingId, seconds: number) => void) => () => void;
  onList: () => void;
  demo?: boolean;
  /** başkasının kampı (salt okunur; inşaat, süsleme ve toplama yok; hazır tepki bırakılır) */
  visit?: CampVisitView;
}

const once = (key: string): boolean => { try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, '1'); return true; } catch { return false; } };

/** Kulak Kampı üs görünümü: izometrik Phaser sahnesi + üst HUD (Kamp Seviyesi) + alt kısayollar + bina paneli + süsleme kipi. */
export function CampBase(p: CampBaseProps) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<CampHandle | null>(null);
  const [sel, setSel] = useState<BuildingId | null>(null);
  const [ready, setReady] = useState(false);
  const [levelPanel, setLevelPanel] = useState(false);
  const [edit, setEdit] = useState(false);
  const [susSel, setSusSel] = useState<SusSel>(null);
  const susRef = useRef<SusSel>(null); susRef.current = susSel;
  const now = useNow(500); const sNow = p.now();
  void now;
  const live = useRef({ ...p, regions: [] as string[] }); live.current = { ...p, regions: live.current.regions };
  const visit = p.visit;
  const active = p.camp.buildings.find((b) => b.upgradingTo && b.endsAt);
  const canAsk = !visit && !!(p.team && active && !askedHelp.has(buildKey(active)));
  const canAskRef = useRef(canAsk); canAskRef.current = canAsk;
  const [askTick, setAskTick] = useState(0);
  // bölge anıtları: haritada ulaşılan bölgeler; görülmemiş en ileri anıt sahne hazır olunca kutlanır (kamp öğreticisi bittiyse)
  const progress = useStore((s) => s.progress);
  const ownRegions = useMemo(() => regionsNow(clearedCount(progress)), [progress]);
  const regions = visit ? visit.regions : ownRegions;
  const celebrateRef = useRef<string | null>(null);

  // sahne: bir kez kurulur, ekrandan çıkınca yok edilir
  useEffect(() => {
    if (!host.current) return;
    const el = host.current; let dead = false; let h: CampHandle | null = null;
    // Phaser kamp sahnesi ayrı parça; yüklenene kadar .camp-loading görünür (ready)
    void loadCamp().then(({ startCamp }) => {
      if (dead) return;
      const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const heroColor = visit ? visit.heroColor : odiLook(useStore.getState()).color;
      el.dataset.odiColor = heroColor.toString(16).padStart(6, '0'); // test kancası: kamptaki kendi Odi'nin rengi
      const st = useStore.getState(); const tutorialDone = !!st.ftue.bypass || st.ftue.tours.includes('camp-build');
      // yükleme sürerken gelen değişiklikler kaybolmasın: sahne en güncel kamp/takım/bölge ile kurulur
      const { camp, team, regions } = live.current;
      const fresh = tutorialDone && !visit ? monumentToCelebrate(regions) : null; celebrateRef.current = fresh;
      const cur = startCamp(el, {
        heroColor, camp, team, canAskHelp: canAskRef.current, reducedMotion: reduced, readOnly: !!visit,
        regions: regions.filter((r) => r !== fresh),
        onMonument: (region, isNew) => {
          const m = monumentOf(region); if (!m) return;
          const name = BIOMES[region as BiomeId]?.name ?? region;
          if (isNew) { audio.play('fanfare'); platform().haptic('success'); sayDede(m.line, `Yeni anıt · ${m.name}`, m.plain); return; }
          audio.play('pop');
          if (live.current.regions.includes(region)) showDede(m.plain, `${m.name} · ${name}`);
          else showDede(`${name} bölgesine ulaşınca burada ${m.name} yükselecek.`, 'Kulak Yolu');
        },
        onCollectRemedy: () => { void collectRemedy(); },
        onCollectLib: () => { void collectLib(); },
        onDecor: (id) => { const d = decorById(id); if (!d) return; audio.play('pop'); showDede(d.plain, d.name); },
        onDistrict: (id) => { const d = districtById(id); if (!d) return; audio.play('tap'); showDede(`${d.plain} Kamp Seviyesi ${d.level} ile açılır.`, `${d.name} · kilitli`); },
        onEditTap: (uid, cell) => {
          const s = susRef.current;
          if (s && (s.k === 'yeni' || s.k === 'tasi')) { if (uid == null || uid === (s.k === 'tasi' ? s.uid : -1)) { const g = handle.current?.moveGhost(cell[0], cell[1]); if (g) setSusSel({ ...s, ok: g.ok }); } return; }
          if (uid == null) { handle.current?.selectDecor(null); setSusSel(null); return; }
          audio.play('pop'); platform().haptic('light'); handle.current?.selectDecor(uid); setSusSel({ k: 'secili', uid });
        },
        onGhost: (g) => { const s = susRef.current; if (s && (s.k === 'yeni' || s.k === 'tasi') && s.ok !== g.ok) setSusSel({ ...s, ok: g.ok }); },
        now: () => live.current.now(),
        onTap: (id) => { audio.play('pop'); platform().haptic('light'); if (live.current.visit) { const b = live.current.camp.buildings.find((x) => x.id === id); showDede(`${defOf(id).desc}`, `${defOf(id).name} · Sv ${b?.level ?? 0}`); return; } setSel(id); },
        onAskHelp: (id) => { void ask(id); },
        onSpeedup: (id) => { audio.play('tap'); setSel(id); },
        onCollect: () => { void collect(); },
        // inşaat bitişi sahnede görsel (iskele düşer, konfeti); afiş + Tüy Dede satırı kamp ekranında bir kez (camp/built.ts)
        onBuilt: () => undefined,
        onReady: () => {
          setReady(true);
          // yeni anıt: kamp yerine oturduktan sonra yükselir
          if (fresh) setTimeout(() => { if (handle.current === cur) { cur.update({ regions, celebrate: fresh }); markSeen(regions); } }, 900);
          else if (tutorialDone && !visit) markSeen(regions);
          // Kamp Seviyesi tanıtımı (bir kez; kamp öğreticisi bittikten sonra, anıt kutlaması yoksa)
          if (visit) { if (once('odi.kamp.ziyaretTanitim')) setTimeout(() => sayDede('kamp-ziyaret-01', 'Kamp ziyareti'), 700); }
          else if (tutorialDone && !fresh && camp.xp && once('odi.kamp.seviyeTanitim')) setTimeout(() => sayDede('kamp-seviye-01', 'Kamp Seviyesi'), 900);
        },
      });
      h = cur; handle.current = cur;
      (window as unknown as { __kamp?: unknown }).__kamp = {
        pos: (id: BuildingId) => cur.screenPos(id), view: () => cur.view(), focus: (id: BuildingId) => cur.focus(id, true), monument: (r: string) => cur.monumentPos(r), regions: () => live.current.regions, celebrated: () => celebrateRef.current,
        decor: (uid: number) => cur.decorPos(uid), ghost: () => cur.ghostPos(), ghostState: () => cur.ghostState(), district: (id: string) => cur.districtPos(id), focusDistrict: (id: string) => cur.focusDistrict(id), districts: () => cur.openDistricts(), mem: () => cur.mem(), moveGhost: (gx: number, gy: number) => cur.moveGhost(gx, gy),
      };
    }, (e: unknown) => { if (!dead) { try { chunkFailed(e); } catch { /* yenileniyor */ } } });
    if (!visit) audio.music('menu');
    return () => { dead = true; h?.destroy(); handle.current = null; delete (window as unknown as { __kamp?: unknown }).__kamp; };
  }, []);
  live.current.regions = regions;
  useEffect(() => { handle.current?.update({ camp: p.camp }); }, [p.camp]);
  const regionsInit = useRef(false);
  useEffect(() => { if (!regionsInit.current) { regionsInit.current = true; return; } handle.current?.update({ regions }); }, [regions.join()]);
  useEffect(() => { handle.current?.update({ team: p.team }); }, [p.team?.emblem, p.team?.name]);
  useEffect(() => { handle.current?.update({ canAskHelp: canAsk }); }, [canAsk, askTick]);
  useEffect(() => p.onHelped?.((building, seconds) => { handle.current?.helped(building, seconds); audio.play('pop', { semitones: 7 }); platform().haptic('light'); }), [p.onHelped]);
  useEffect(() => { handle.current?.setEdit(edit); if (edit) { setSel(null); if (once('odi.kamp.susTanitim')) sayDede('kamp-sus-01', 'Süsleme'); } else setSusSel(null); }, [edit]);

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
  async function collectRemedy() {
    audio.play('tap');
    const n = await live.current.actions.remedyCollect();
    if (n && n > 0) { handle.current?.remediesCollected(n); audio.play('coinBurst', { semitones: 5 }); platform().haptic('success'); }
    return n;
  }
  async function collectLib() {
    audio.play('tap');
    const n = await live.current.actions.libCollect();
    if (n && n > 0) { handle.current?.libCollected(n); audio.play('coinBurst', { semitones: 9 }); platform().haptic('success'); }
    return n;
  }
  const actions: CampActions = { ...p.actions, ask: async (id) => { const ok = await p.actions.ask(id); if (ok) setAskTick((n) => n + 1); return ok; }, collect: async () => { await collect(); return 0; }, remedyCollect: collectRemedy, libCollect: collectLib };

  useEffect(() => { if (sel) handle.current?.focus(sel, true); else handle.current?.unfocus(); }, [sel]);
  // açık paneldeki inşaat bitti (kristal, hızlandırıcı, süre, takım yardımı): panel kapanır ki kutlama, sahnedeki yükseliş ve Tüy Dede görünsün
  const selLevel = sel ? p.camp.buildings.find((b) => b.id === sel)?.level ?? 0 : -1;
  const selSeen = useRef<{ id: BuildingId; level: number } | null>(null);
  useEffect(() => {
    const was = selSeen.current;
    selSeen.current = sel ? { id: sel, level: selLevel } : null;
    if (sel && was?.id === sel && selLevel > was.level) setSel(null);
  }, [sel, selLevel]);
  const helpAll = async () => { audio.play('tap'); const n = await p.actions.helpAll(); if (n) { audio.play('coinBurst', { semitones: 4 }); platform().haptic('success'); } };
  const idle = !active;
  const anyUpgrade = !visit && idle && p.camp.buildings.some((b) => canUpgrade(p.camp, p.wallet, b.id).ok);
  const invCount = Object.values(p.camp.decor?.inv ?? {}).reduce((a, n) => a + n, 0);
  const [cheering, setCheering] = useState(false);

  return (
    <div className={`camp-base${edit ? ' editing' : ''}${visit ? ' visiting' : ''}`}>
      <div className="camp-canvas" ref={host} aria-label={visit ? `${visit.name} adlı oyuncunun kampı` : 'Kulak Kampı üs görünümü'} role="img" />
      {!ready && <div className="camp-loading" aria-hidden><span><Art e="🏕️" size="1.15em" className="art-inline" /></span></div>}
      <div className="camp-top">
        {visit
          ? <div className="topbar2 visit-bar"><button className="pill tb-pill tap ico" onClick={() => { audio.play('tap'); visit.onBack(); }} aria-label="Geri"><Icon name="back" size="1.1em" /></button><h1 className="grow min0">{visit.name} · Kamp</h1></div>
          : <TopBar title="Kamp" />}
        <div className="camp-hud" aria-label="Kaynaklar">
          {p.camp.xp && <CampLevelChip xp={p.camp.xp} onOpen={() => { audio.play('tap'); if (!visit) setLevelPanel(true); }} />}
          {!visit && <button className={`hud-chip builder${active ? ' on' : ''}`} onClick={() => { if (active) { setSel(active.id); } }} aria-label={active ? `İnşaat: ${defOf(active.id).name}, kalan ${fmtLeft((active.endsAt ?? 0) - sNow)}` : 'İnşaatçı boşta'}>
            <Art e="🔨" size="1.15em" className="art-inline" /> {active ? <>{shortOf(active.id)} <b>{fmtLeft(Math.max(0, (active.endsAt ?? 0) - sNow))}</b></> : 'Boşta'}
          </button>}
          {!visit && ITEMS.some((it) => p.wallet.hizlandirici[it.k] > 0) && <span className="hud-chip speed" aria-label={`Hızlandırıcılar: ${ITEMS.map((it) => `${it.label} ${p.wallet.hizlandirici[it.k]} adet`).join(', ')}`}><Art e="⏩" size="1.15em" className="art-inline" />{ITEMS.filter((it) => p.wallet.hizlandirici[it.k] > 0).map((it) => <span key={it.k} className="hs"><small>{it.label.replace(' ', '')}</small><b>{p.wallet.hizlandirici[it.k]}</b></span>)}</span>}
          {p.demo && <span className="hud-chip" aria-label={`Jeton: ${fmtNum(p.wallet.jeton)}`}><Art e="🪙" size="1.15em" className="art-inline" /><b>{fmtNum(p.wallet.jeton)}</b></span>}
          {visit && <span className="hud-chip" aria-label={`${visit.cheers} alkış`}><Art name="heart" size={16} /> <b>{visit.cheers}</b> alkış</span>}
          {!p.demo && !visit && <GorevChips />}
        </div>
        {p.demo && <div className="camp-demo-tag">ÖNİZLEME · sunucuya bir şey gitmez</div>}
      </div>

      <div className="camp-bottom">
        <DedeCard className="dede-camp" />
        {visit ? (
          <div className="cheer-bar" data-testid="alkis" aria-label="Hazır tepkiler">
            {visit.cheeredToday
              ? <div className="cheer-done"><Art name="heart" size={18} /> Bugün “{CAMP_CHEERS.find((c) => c.id === visit.cheeredToday)?.text}” bıraktın. Yarın yine gel!</div>
              : CAMP_CHEERS.map((c) => <button key={c.id} type="button" className="btn cheer" disabled={cheering} onClick={() => void (async () => { setCheering(true); audio.play('pop'); try { await visit.onCheer(c.id); } finally { setCheering(false); } })()}>{c.text}</button>)}
          </div>
        ) : edit ? (
          <SusPanel camp={p.camp} handle={handle.current} actions={p.actions} sel={susSel} setSel={setSusSel} onDone={() => { audio.play('tap'); setEdit(false); }} />
        ) : (<>
          {idle && anyUpgrade && <div className="camp-hint"><Art e="👷" size="1.15em" className="art-inline" /> İnşaatçı boşta — bir binaya dokun, yükselt!</div>}
          <div className="camp-actions">
            {p.team && <button className={`btn camp-helpall${p.helpCount ? ' pulse' : ''}`} disabled={!p.helpCount} onClick={() => void helpAll()} aria-label={`Herkese yardım et (${p.helpCount})`}><Art e="🤝" size="1.15em" className="art-inline" /> {p.camp.decor ? 'Yardım et' : 'Herkese yardım et'}{` (${p.helpCount})`}</button>}
            {p.camp.decor && <button className="btn camp-susle" data-testid="susle" onClick={() => { audio.play('tap'); setEdit(true); }} aria-label={`Süsle${invCount ? `, envanterde ${invCount} süs` : ''}`}><Art name="palette" size={18} /> Süsle{invCount > 0 && <i className="cnt-badge">{invCount}</i>}</button>}
            <button className="btn ghost camp-listbtn" onClick={() => { audio.play('tap'); p.onList(); }} aria-label="Liste görünümü"><Icon name="list" size="1.1em" className="ic-inline" /> Liste</button>
          </div>
        </>)}
      </div>

      {/* ekran okuyucu / klavye için binalar */}
      <div className="sr-only">
        {p.camp.buildings.map((b) => <button key={b.id} onClick={() => (visit ? undefined : setSel(b.id))}>{defOf(b.id).name}, Sv {b.level}{b.upgradingTo ? `, Sv ${b.upgradingTo} yapılıyor` : ''}</button>)}
      </div>

      {!p.demo && !visit && <GorevHost />}
      {sel && !visit && <BuildingPanel id={sel} camp={p.camp} wallet={p.wallet} team={!!p.team} fast={p.fast} sNow={sNow} actions={actions} onClose={() => { audio.play('tap'); setSel(null); }} />}
      {levelPanel && <CampLevelPanel camp={p.camp} onClose={() => { audio.play('tap'); setLevelPanel(false); }} />}
    </div>
  );
}
