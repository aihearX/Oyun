import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNet } from '@odi/net/store';
import type { BuildingId, CampState, Wallet } from '@odi/shared';
import { audio } from '@odi/audio';
import { act, getNet, reconnect, toast, useSocial } from '../net';
import { platform } from '../platform';
import { Skeleton, TopBar, useNow } from '../ui/social';
import { CampBase } from '../camp/CampBase';
import { CampList } from '../camp/CampList';
import { askedHelp, buildKey, defOf, type CampActions } from '../camp/model';
import { useBuiltCelebration } from '../camp/built';
import { useCampLevelCelebration } from '../camp/seviye';
import { sayDede } from '../camp/dede';
import { demoCamp, demoParams, demoReduce, type DemoParams } from '../camp/demo';
import { Art } from '../ui/art';
import '../camp/camp.css';

type View = 'us' | 'liste';
const VIEW_KEY = 'odi.kamp.gorunum';
function useView(): [View, (v: View) => void] {
  const [v, setV] = useState<View>(() => { try { return localStorage.getItem(VIEW_KEY) === 'liste' ? 'liste' : 'us'; } catch { return 'us'; } });
  return [v, (n) => { setV(n); try { localStorage.setItem(VIEW_KEY, n); } catch { /* gizli mod */ } }];
}

/** Kulak Kampı: izometrik üs görünümü (varsayılan) ya da erişilebilir liste görünümü. Tüm kamp işlevleri iki görünümde de var. */
export function CampScreen() {
  const demo = useMemo(demoParams, []);
  const [view, setView] = useView();
  return demo ? <DemoCamp p={demo} view={view} setView={setView} /> : <RealCamp view={view} setView={setView} />;
}

function ListShell({ children, setView }: { children: ReactNode; setView: (v: View) => void }) {
  return (
    <div className="screen fade-in with-tabs camp-list-screen">
      <TopBar title="Kamp" extra={<button className="pill tb-pill tap ico" onClick={() => { audio.play('tap'); setView('us'); }} aria-label="Üs görünümü"><Art name="tent" size={22} /></button>} />
      {children}
    </div>
  );
}

/** sunucu yoksa: nazik kart + Tekrar dene */
function CampOffline() {
  const enabled = useSocial((s) => s.enabled); const st = useNet((s) => s.status);
  return (
    <div className="card offline-card fade-in camp-offline">
      <div className="ph-icon" aria-hidden><Art name="tent" size={48} /></div>
      <h2>Kampın sunucuda tutulur — bağlanınca görünür</h2>
      <div className="muted">{enabled ? 'Şu an sunucuya ulaşamıyoruz. Bu arada bölüm oynamaya devam edebilirsin; jetonların ve ilerlemen kaybolmaz.' : 'Kulak Kampı için bir sunucu adresi gerekiyor. Oyunun geri kalanı çevrimdışı tamamen oynanır.'}</div>
      {enabled && <button className="btn" onClick={reconnect} disabled={st === 'bağlanıyor'}>{st === 'bağlanıyor' ? 'Bağlanıyor…' : 'Tekrar dene'}</button>}
    </div>
  );
}

function RealCamp({ view, setView }: { view: View; setView: (v: View) => void }) {
  const st = useNet((s) => s.status); const me = useNet((s) => s.me); const tried = useSocial((s) => s.tried); const enabled = useSocial((s) => s.enabled);
  const camp = useNet((s) => s.camp); const wallet = useNet((s) => s.wallet); const team = useNet((s) => s.team); const extra = useNet((s) => s.extra);
  const helpCount = useNet((s) => s.campHelp.length); const bonuses = useSocial((s) => s.bonuses);
  const fast = team ? (extra?.tech.find((t) => t.id === 'insaat')?.level ?? 0) * 2 : 0;
  const nowMs = useNow(); const net = getNet();
  const sNow = net ? net.serverNow() : nowMs;
  const serverNow = useCallback(() => { const n = getNet(); return n ? n.serverNow() : Date.now(); }, []);

  useEffect(() => { if (st === 'bağlı') void getNet()?.call('camp.state', {}).then((r) => useNet.setState({ camp: r.camp, wallet: r.wallet })).catch(() => undefined); }, [st]);
  // süre dolunca sunucudan tazele (5 sn'lik zamanlayıcıyı beklemeden)
  const active = camp?.buildings.find((b) => b.upgradingTo && b.endsAt);
  useEffect(() => { if (active?.endsAt && active.endsAt <= sNow + 500) { const h = setTimeout(() => void getNet()?.call('camp.state', {}).then((r) => useNet.setState({ camp: r.camp })).catch(() => undefined), 800); return () => clearTimeout(h); } }, [active?.endsAt, Math.floor(sNow / 1000)]);
  // inşaat bitti: her seviye bir kez kutlanır (üs görünümünde iskelenin düşüşüyle aynı anda)
  useBuiltCelebration(me?.id, camp, view === 'us' ? 420 : 0);
  // Kamp Seviyesi atladı: bir kez kutlanır (inşaat afişinden sonra gelsin)
  useCampLevelCelebration(me?.id, camp, view === 'us' ? 1600 : 900);

  const actions = useMemo<CampActions>(() => ({
    upgrade: async (id) => { const r = await act('camp.upgrade', { id }); if (!r) return false; useNet.setState({ camp: r.camp, wallet: r.wallet }); platform().haptic('medium'); audio.play('whoosh'); toast('🏗️', `${defOf(id).name} inşaatı başladı`, useNet.getState().team ? 'Takımından yardım iste, süre kısalsın.' : undefined); return true; },
    speed: async (id, item) => { const r = await act('camp.speedup', { id, item, count: 1 }); if (!r) return false; useNet.setState({ camp: r.camp, wallet: r.wallet }); platform().haptic('light'); return true; },
    ask: async (id) => {
      const r = await act('camp.help.request', { id }); if (!r) return false;
      useNet.setState({ camp: r.camp }); const b = r.camp.buildings.find((x) => x.id === id); if (b) askedHelp.add(buildKey(b));
      toast('🙋', 'Takımına haber verildi', 'Her yardım süreyi kısaltır.', 'green'); return true;
    },
    collect: async () => { const r = await act('camp.collect', {}); if (!r) return null; useNet.setState({ camp: r.camp, wallet: r.wallet }); return r.collected; },
    helpAll: async () => { const r = await act('team.camp.helpAll', {}); if (!r) return null; if (r.given > 0) toast('🤝', `${r.given} inşaatı hızlandırdın`, 'Her yardım takımına güç katar.', 'green'); return r.given; },
    remedyMake: async (item) => { const r = await act('camp.remedy.make', { item }); if (!r) return false; useNet.setState({ camp: r.camp }); platform().haptic('light'); if (r.collected > 0) toast('🩹', `+${r.collected} malzeme çantana girdi`, undefined, 'green'); return true; },
    remedyCollect: async () => { const r = await act('camp.remedy.collect', {}); if (!r) return null; useNet.setState({ camp: r.camp }); remedyCollected(r.collected); return r.collected; },
    decorPlace: async (id, gx, gy, flip) => { const r = await act('camp.decor.place', { id, gx, gy, flip }); if (!r) return null; useNet.setState({ camp: r.camp }); return r.camp; },
    decorMove: async (uid, gx, gy, flip) => { const r = await act('camp.decor.move', { uid, gx, gy, flip }); if (!r) return null; useNet.setState({ camp: r.camp }); return r.camp; },
    decorStore: async (uid) => { const r = await act('camp.decor.store', { uid }); if (!r) return false; useNet.setState({ camp: r.camp }); return true; },
    libCollect: async () => { const r = await act('camp.lib.collect', {}); if (!r) return null; useNet.setState({ camp: r.camp }); return r.xp; },
  }), []);
  const onHelped = useCallback((fn: (b: BuildingId, s: number) => void) => { const n = getNet(); if (!n) return () => undefined; return n.on('camp.helped', ({ building, seconds }) => fn(building, seconds)); }, []);
  const teamView = useMemo(() => (team ? { emblem: team.emblem, name: team.name } : null), [team?.emblem, team?.name]);

  if (!me) {
    if (enabled && (!tried || st === 'bağlanıyor')) return <ListShell setView={setView}><Skeleton rows={4} /></ListShell>;
    return <ListShell setView={setView}><CampOffline /></ListShell>;
  }
  const banner = st !== 'bağlı' && <div className="net-banner camp-net"><Art name="signal" size={18} /> Bağlantı koptu — yeniden bağlanıyor… <button className="linkish" onClick={reconnect}>Tekrar dene</button></div>;
  if (!camp || !wallet) return <ListShell setView={setView}>{banner}<Skeleton rows={4} /></ListShell>;
  if (view === 'us') return <>{banner}<CampBase camp={camp} wallet={wallet} team={teamView} helpCount={helpCount} fast={fast} now={serverNow} actions={actions} onHelped={onHelped} onList={() => setView('liste')} /></>;
  return <ListShell setView={setView}>{banner}<CampList camp={camp} wallet={wallet} team={!!team} fast={fast} sNow={sNow} actions={actions} bonuses={bonuses} /></ListShell>;
}

/** malzemeler çantaya girdi: ilk toplamada Tüy Dede çantayı anlatır (bir kez, bu cihazda) */
function remedyCollected(n: number) {
  if (n <= 0) return;
  let first = false; try { first = !localStorage.getItem('odi.kamp.ilkMalzeme'); localStorage.setItem('odi.kamp.ilkMalzeme', '1'); } catch { /* gizli mod */ }
  if (first) sayDede('tedavi-al-01', 'Tedavi Odası');
  else toast('🩹', `+${n} malzeme çantana girdi`, 'Bölüm kartından çantana koy.', 'green');
}

/** önizleme: yerel sahte kamp (sunucusuz; hiçbir şey gönderilmez) */
function DemoCamp({ p, view, setView }: { p: DemoParams; view: View; setView: (v: View) => void }) {
  const [s, setRaw] = useState<{ camp: CampState; wallet: Wallet }>(() => demoCamp(p));
  const ref = useRef(s); ref.current = s;
  const setS = (f: (o: typeof s) => typeof s) => { ref.current = f(ref.current); setRaw(ref.current); };
  const nowMs = useNow();
  useEffect(() => { const b = s.camp.buildings.find((x) => x.endsAt && x.endsAt <= nowMs); if (b) setS((o) => demoReduce(o, { k: 'complete' })); }, [nowMs]);
  useBuiltCelebration('onizleme', s.camp, view === 'us' ? 420 : 0);
  useCampLevelCelebration('onizleme', s.camp, view === 'us' ? 1600 : 900);
  const actions = useMemo<CampActions>(() => ({
    upgrade: async (id) => { setS((o) => demoReduce(o, { k: 'upgrade', id })); audio.play('whoosh'); return true; },
    speed: async (id, item) => { setS((o) => demoReduce(o, { k: 'speed', id, item })); return true; },
    ask: async (id) => { const b = ref.current.camp.buildings.find((x) => x.id === id); if (b) askedHelp.add(buildKey(b)); toast('🙋', 'Önizleme', 'Gerçek oyunda takımına haber gider.', 'green'); return true; },
    collect: async () => { const r = demoReduce(ref.current, { k: 'collect' }); setS(() => ({ camp: r.camp, wallet: r.wallet })); return r.collected ?? 0; },
    helpAll: async () => { toast('🤝', 'Önizleme', 'Gerçek oyunda takım arkadaşlarının inşaatı hızlanır.', 'green'); return 2; },
    remedyMake: async (item) => { setS((o) => demoReduce(o, { k: 'remedyMake', item })); return true; },
    remedyCollect: async () => { const r = demoReduce(ref.current, { k: 'remedyCollect' }); setS(() => ({ camp: r.camp, wallet: r.wallet })); remedyCollected(r.collected ?? 0); return r.collected ?? 0; },
    decorPlace: async (id, gx, gy, flip) => { const r = demoReduce(ref.current, { k: 'decorPlace', id, gx, gy, flip }); if (r.error) { toast('🙈', 'Buraya konamaz', 'Boş ve açık bir yer seç.'); return null; } setS(() => ({ camp: r.camp, wallet: r.wallet })); return r.camp; },
    decorMove: async (uid, gx, gy, flip) => { const r = demoReduce(ref.current, { k: 'decorMove', uid, gx, gy, flip }); if (r.error) { toast('🙈', 'Buraya konamaz', 'Boş ve açık bir yer seç.'); return null; } setS(() => ({ camp: r.camp, wallet: r.wallet })); return r.camp; },
    decorStore: async (uid) => { const r = demoReduce(ref.current, { k: 'decorStore', uid }); setS(() => ({ camp: r.camp, wallet: r.wallet })); return true; },
    libCollect: async () => { const r = demoReduce(ref.current, { k: 'lib' }); setS(() => ({ camp: r.camp, wallet: r.wallet })); return r.collected ?? 0; },
  }), []);
  const team = useMemo(() => ({ emblem: '🐚', name: 'Koklea Kaşifleri' }), []);
  if (view === 'us') return <CampBase demo camp={s.camp} wallet={s.wallet} team={team} helpCount={2} fast={4} now={Date.now} actions={actions} onList={() => setView('liste')} />;
  return <ListShell setView={setView}><div className="camp-demo-tag static">ÖNİZLEME · sunucuya bir şey gitmez</div><CampList camp={s.camp} wallet={s.wallet} team fast={4} sNow={nowMs} actions={actions} bonuses={null} /></ListShell>;
}
