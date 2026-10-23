import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LevelSpec, PlayerSkills, RaceRoom, RunResult } from '@odi/shared';
import { generateLevel } from '@odi/level-gen';
import { DEFAULT_SKILLS, FIRSTS, HUMAN_JOURNEY } from '@odi/content';
import {
  calendarView, chestReady, dayKey, defaultMeta, ensureDaily, needsBiomeIntro, processRun, questDone, rollLucky, settle, xpThreshold,
  type PlayerCore, type RunSummary,
} from '@odi/meta';
import type { LevelOptions } from '@odi/game-core';
import { audio, type Track } from '@odi/audio';
import { CelebrationLayer } from './celebrate/CelebrationLayer';
import { installUiFeedback } from './ui/feedback';
import { platform } from './platform';
import { installViewport, scrollAppTop } from './ui/viewport';
import { ArtDefs, ArtGallery } from './ui/art';
import { CoachHost } from './ftue/Coach';
import { FtueDirector, useLockToast } from './ftue/Director';
import { StoryScreen } from './ftue/Story';
import { clearedCount, isOpen, lockText, type FeatureId } from './ftue/features';
import { useStore } from './store';
import { MapScreen } from './screens/MapScreen';
import { LevelHost } from './screens/LevelHost';
import { ResultScreen } from './screens/ResultScreen';
import { SkillsScreen } from './screens/SkillsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TitleScreen } from './screens/TitleScreen';
import { TodayScreen } from './screens/TodayScreen';
import { TeamScreen } from './screens/TeamScreen';
import { ProfileScreen, type ProfileLink } from './screens/ProfileScreen';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { AlbumScreen } from './screens/AlbumScreen';
import { GlossaryScreen } from './screens/GlossaryScreen';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { InfoScreen } from './screens/InfoScreen';
import { BiomeIntro } from './screens/BiomeIntro';
import { TabBar, type Tab } from './ui/TabBar';
import { readInvite } from './invite';
import { CampScreen } from './screens/CampScreen';
import { CampVisitScreen } from './camp/Ziyaret';
import { ChatScreen, DmRouteScreen, FriendsScreen, MessagesScreen } from './screens/FriendsScreen';
import { FriendBanner, ProfileCardHost, useSocialUnread } from './friends';
import { ShopScreen } from './screens/ShopScreen';
import { InboxScreen, LeagueScreen } from './screens/InboxScreen';
import { Onboarding } from './ui/Onboarding';
import { NavContext, type Nav, type SocialRoute } from './nav';
import { startNet, submitRun, toast, useSocial } from './net';
import { useNet } from '@odi/net/store';
import { BUILDINGS, buildCost } from '@odi/shared';
import { RaceLobby, RaceResult, RaceInviteBanner, raceSpec } from './race';
import { TeamProfileHost } from './screens/team/TeamProfile';
import { useTeamApply } from './screens/team/apply';
import { TeamRaceMatchWatcher, TeamRaceResultScreen } from './teamrace';
import { EventLevel, EventNoticeStrip, EventsFab, EventsScreen, type EventPlay } from './events';
import { CommBanner, TogetherScreen, mentionCount, useComm } from './comm';
import { RankScreen } from './rank/RankScreen';
import { odiLook } from './look';
import { takeRemedies } from './camp/bag';

type Extras = Pick<LevelOptions, 'cosmetic' | 'lucky' | 'firsts' | 'remedies'>;
/** yalnız test derlemesi (VITE_ODI_E2E=1): `?ftue=0` ilk deneyimi atlar (her şey açık), `?oyun-bot=1` normal akıştaki bölümleri harness botu oynar */
declare const __ODI_E2E__: boolean | undefined;
const E2E = typeof __ODI_E2E__ !== 'undefined' && !!__ODI_E2E__;
const E2E_Q = E2E ? new URLSearchParams(location.search) : null;
const PLAY_BOT = !!E2E_Q && E2E_Q.get('oyun-bot') === '1';
/** test: bot hız çarpanı (`&oyun-hiz=3`; yavaş test makinesinde çok oyunculu yarış zaman sınırına takılmasın) */
const BOT_SPEED = PLAY_BOT ? Math.min(4, Math.max(1, Number(E2E_Q!.get('oyun-hiz')) || 1)) : 1;
/** sekme → açılması gereken yer (harita hep açık) */
const TAB_FEATURE: Partial<Record<Tab, FeatureId>> = { today: 'today', camp: 'camp', team: 'team', profile: 'profile' };
type Sub = 'skills' | 'settings' | 'achievements' | 'album' | 'glossary' | 'wardrobe' | 'info';
type Route =
  | { name: 'title' } | { name: Tab } | { name: Sub; back: Tab } | { name: 'story'; replay?: boolean; back?: Tab }
  | (SocialRoute & { back: Tab; key?: number })
  | { name: 'intro'; spec: LevelSpec; extras: Extras; skills?: PlayerSkills }
  | { name: 'level'; spec: LevelSpec; extras: Extras; skills?: PlayerSkills; race?: RaceRoom }
  | { name: 'raceResult'; room: RaceRoom; result: RunResult; back: Tab }
  | { name: 'eventLevel'; spec: LevelSpec; play: EventPlay; back: Tab }
  | { name: 'result'; spec: LevelSpec; result: RunResult; summary: RunSummary; demo?: boolean; runId?: string };

/** `?bot=1&level=N[&ts=2][&skills=all][&salt=K][&hd=2][&human=1]` → test modu: harness bölümü otomatik oynatır (hd: pazarlama çekimi için tuval piksel oranı;
 *  human: bot yerine dokunuş girdisi — mobil duraklat/kaydırma testleri). */
function botParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('bot') !== '1') return null;
  return { human: q.get('human') === '1', idle: q.get('idle') === '1', level: Number(q.get('level') ?? 1), ts: Number(q.get('ts') ?? 1), skillsAll: q.get('skills') === 'all', salt: Number(q.get('salt') ?? 0), hd: Number(q.get('hd') ?? 0) };
}

/**
 * Geliştirme önizlemesi: `?demo=sonuc&yildiz=3&skor=1234&rekor=1[&seviye=1][&sans=1][&acilim=1][&bolum=8]`
 * Sonuç ekranını sahte bir çekirdek üzerinde gösterir; kayda hiçbir şey yazmaz (üretimde zararsız).
 * `&katki=1`: takım katkısı satırlarını örnek bir sunucu onayıyla gösterir (yalnızca görünüm; sunucuya bir şey gitmez).
 */
function demoResult(): Extract<Route, { name: 'result' }> | null {
  const q = new URLSearchParams(location.search); if (q.get('demo') !== 'sonuc') return null;
  const stars = Math.max(0, Math.min(3, Number(q.get('yildiz') ?? 3))) as 0 | 1 | 2 | 3; const score = Math.max(0, Number(q.get('skor') ?? 1234));
  const n = Math.max(1, Math.min(HUMAN_JOURNEY.levels.length, Number(q.get('bolum') ?? 8)));
  const record = q.get('rekor') === '1', levelUp = q.get('seviye') === '1', lucky = q.get('sans') === '1', unlock = q.get('acilim') === '1';
  const spec = generateLevel(HUMAN_JOURNEY.id, n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
  const completed = stars > 0;
  const result: RunResult = {
    levelId: spec.id, completed, stars, score, coins: completed ? Math.round(spec.coinsTotal * (stars === 3 ? 0.9 : stars === 2 ? 0.6 : 0.4)) : 6, timeSec: spec.parTimeSec - 4,
    deaths: 0, damageTaken: stars === 3 ? 0 : 1, objectiveMet: stars >= 2, secretFound: false,
    extra: { maxCombo: 12, ...(lucky ? { luckyNote: true } : {}), ...(completed ? {} : { reason: 'fall', pct: 0.92 }) },
  };
  const progress: PlayerCore['progress'] = {};
  for (let i = 1; i < n; i++) progress[i] = { stars: 2, best: 600, plays: 1 };
  if (record || !unlock) progress[n] = { stars: unlock ? 0 : 1, best: record ? Math.max(1, score - 150) : score + 300, plays: 2 };
  const meta = { ...defaultMeta(), seenBiomes: HUMAN_JOURNEY.levels.slice(0, n).map((l) => l.biome) };
  const L = 3; const xp = levelUp ? xpThreshold(L + 1) - 12 : xpThreshold(L) + 40;
  const base = { ...settle<PlayerCore>({ progress, coins: 140, xp, streak: 3, lastDay: dayKey(), failStreak: 0, skills: DEFAULT_SKILLS, meta }).core, xp };
  const { summary } = processRun(base, spec, result, dayKey());
  return { name: 'result', spec, result, summary, demo: true, ...(q.get('katki') === '1' ? { runId: 'demo' } : {}) };
}

export function App() {
  const gallery = useMemo(() => new URLSearchParams(location.search).get('demo') === 'ikonlar', []);
  const bot = useMemo(botParams, []);
  const demo = useMemo(() => (bot ? null : demoResult()), [bot]);
  const invite = useMemo(() => (bot ? null : readInvite()), [bot]);
  const store = useStore();
  const [route, setRoute] = useState<Route>(demo ?? { name: 'title' });
  // alt ekran geçmişi (ör. Arkadaşlar → özel sohbet → geri: Arkadaşlar)
  const stack = useRef<Route[]>([]);
  // test derlemesi: normal akıştaki bölüm botla oynanır (LevelHost bot modunda onDone çağırmaz; sonuç window.__odi'den)
  const levelDone = useRef<((r: RunResult, room?: RaceRoom) => void) | null>(null);
  useEffect(() => {
    if (!PLAY_BOT || route.name !== 'level' || route.race) return; const id = route.spec.id; // yarışta LevelHost kendisi bitirir
    const h = setInterval(() => { const o = window.__odi; if (o?.done && o.result && o.spec?.id === id) { clearInterval(h); levelDone.current?.(o.result); } }, 250);
    return () => clearInterval(h);
  }, [route]);

  useEffect(() => {
    if (!bot) return;
    const spec = generateLevel(store.journey, bot.level, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, bot.salt);
    setRoute({ name: 'level', spec, extras: {} });
  }, [bot, store.journey]);
  // ses: oyuncu ayarları (kalıcı) → motor; ilk dokunuşta kilit açma + global düğme sesleri
  useEffect(() => { audio.setVolumes({ enabled: store.sounds, music: store.musicVol, sfx: store.sfxVol }); }, [store.sounds, store.musicVol, store.sfxVol]);
  useEffect(() => (bot ? undefined : installUiFeedback()), [bot]);
  useEffect(() => (bot ? undefined : installViewport()), [bot]);
  useEffect(() => { if (E2E_Q?.get('ftue') === '0' && !useStore.getState().ftue.bypass) useStore.getState().ftueBypass(); }, []);
  const lockToast = useLockToast();
  // müzik geçişleri (crossfade): harita teması, menü, biyom tanıtımı. Bölüm/sonuç kendi müziğini yönetir (LevelScene, ResultScreen).
  // useLayoutEffect: ekranın kendi useEffect'i (ör. harita ekibinin özel parçası) bundan SONRA çalışır ve üstüne yazabilir.
  useLayoutEffect(() => { if (bot) return; const t = routeTrack(route); if (t) audio.music(t); }, [route.name, bot]);
  // sosyal katman: bot modunda hiç başlamaz (harness sözleşmesi ve konsol temiz kalsın)
  useEffect(() => { if (!bot) startNet(); }, [bot]);
  useEffect(() => {
    if (demo?.runId !== 'demo') return;
    const r = demo.result;
    useSocial.setState({ lastRun: { runId: 'demo', state: 'tamam', biome: demo.spec.biome, level: demo.spec.number, completed: r.completed,
      ack: { highest: demo.spec.number + 1, stars: 0, warPoints: r.completed ? 10 * r.stars + Math.ceil(demo.spec.number / 4) : 0, raidDamage: r.completed ? 5 + 5 * r.stars : 0, leaguePoints: r.completed ? 5 + 5 * r.stars : 1, newInbox: 0, jeton: Math.round(r.coins * 1.06), wallet: { jeton: 0, kristal: 0, hizlandirici: { m5: 0, m60: 0, s8: 0 } } } } });
  }, [demo]);
  const socialBadges = useSocialBadges(store.coins);
  const dmBadge = useSocialUnread();
  // ekran değişince en üstten başla (harita kendi kaydırmasını yapar)
  useEffect(() => { if (route.name !== 'level' && route.name !== 'map') scrollAppTop(); }, [route.name, 'room' in route ? route.room : '']);

  const play = (number: number) => {
    const s = useStore.getState();
    const spec = generateLevel(s.journey, number, { recentStars: s.recentStars.length ? s.recentStars.reduce((a, b) => a + b, 0) / s.recentStars.length : 2, failStreak: s.failStreak, skills: s.skills });
    const look = odiLook(s);
    const extras: Extras = {
      // seçilen renk her bölümde (yoksa bölüm biyomun varsayılan rengini kullanır)
      cosmetic: { color: look.custom ? look.color : undefined, hat: look.hat },
      lucky: rollLucky(),
      firsts: Object.keys(FIRSTS).filter((f) => !s.meta.firsts.includes(f)),
      // Tedavi Odası çantası (bölüm kartında seçilen; kullanılan adet sonuçla sunucuya gider)
      remedies: takeRemedies(),
    };
    const skills = runSkills(s.skills);
    setRoute(needsBiomeIntro(s.meta, spec.biome) ? { name: 'intro', spec, extras, skills } : { name: 'level', spec, extras, skills });
  };

  if (gallery) return <><ArtDefs /><ArtGallery /></>;
  if (bot && route.name === 'level') {
    const skills = bot.skillsAll ? { doubleJump: true, longSlide: true, magnet: 3 as const, shield: 2 as const, breath: 3 as const, echoSight: true } : DEFAULT_SKILLS;
    return <LevelHost spec={route.spec} skills={skills} sounds={false} bot={!bot.human} botIdle={bot.idle} timeScale={bot.ts} renderScale={bot.hd || undefined} onDone={() => { /* harness window.__odi üzerinden okur */ }} onQuit={() => undefined} />;
  }

  // sekme rozetleri: bekleyen (alınabilir) ödüller
  const today = dayKey(); const daily = ensureDaily(store.meta.daily, today);
  const todayBadge = daily.quests.filter((q) => questDone(q) && !q.claimed).length + (chestReady(daily) ? 1 : 0) + (store.lastDay === today && !calendarView(store, today).claimedToday ? 1 : 0);
  const cleared = clearedCount(store.progress);
  const tabLocked = (t: Tab) => { const f = TAB_FEATURE[t]; return f && !isOpen(f, cleared, store.ftue) ? f : null; };
  const tab = (t: Tab) => { const f = tabLocked(t); if (f) { lockToast.show(lockText(f)); platform().haptic('light'); return; } stack.current = []; setRoute({ name: t }); };
  /** açılış: yeni oyuncu → hikâye → doğrudan 1. bölüm; hiç bölüm geçmemişse yine tek giriş 1. bölüm */
  const start = () => {
    store.touchDay(); const s = useStore.getState();
    if (!s.ftue.story && !s.ftue.bypass) { setRoute({ name: 'story' }); return; }
    if (!s.ftue.bypass && clearedCount(s.progress) === 0) { play(1); return; }
    setRoute({ name: 'map' });
  };
  const curTab: Tab = 'back' in route ? route.back ?? 'profile' : (['map', 'today', 'camp', 'team', 'profile'] as string[]).includes(route.name) ? route.name as Tab : 'map';
  const isSub = (r: Route) => 'back' in r && r.name !== 'raceResult';
  const nav: Nav = { open: (r) => { if (isSub(route)) stack.current.push(route); else stack.current = []; setRoute({ ...r, back: curTab, key: Date.now() } as Route); }, play, tab };
  const banner = <><RaceInviteBanner onAccept={(id) => setRoute({ name: 'race', inviteRoomId: id, back: curTab, key: Date.now() })} /><FriendBanner /><CommBanner /><ProfileCardHost /><TeamProfileHost /><TeamRaceMatchWatcher busy={false} onPlay={(room) => setRoute({ name: 'level', spec: raceSpec(room), extras: raceExtras(), race: room })} />{isOpen('events', cleared, store.ftue) && <EventNoticeStrip onOpen={(v) => (route.name === 'events' ? setRoute({ name: 'events', view: v, back: route.back, key: Date.now() }) : nav.open({ name: 'events', view: v }))} />}</>;
  const withTabs = (active: Tab, el: ReactNode) => <NavContext.Provider value={nav}>{banner}{el}<TabBar active={active} onTab={tab} locked={{ today: tabLocked('today') ? lockText('today') : undefined, camp: tabLocked('camp') ? lockText('camp') : undefined, team: tabLocked('team') ? lockText('team') : undefined, profile: tabLocked('profile') ? lockText('profile') : undefined }} badges={{ today: todayBadge, camp: socialBadges.camp, team: socialBadges.team, profile: dmBadge }} /><Onboarding /></NavContext.Provider>;
  const sub = (el: ReactNode) => <NavContext.Provider value={nav}>{banner}{el}</NavContext.Provider>;
  const openSub = (back: Tab) => (l: ProfileLink | Sub | SocialRoute['name']) => setRoute({ name: l, back } as Route);
  const back = (r: { back: Tab }) => () => { const prev = stack.current.pop(); setRoute(prev ?? { name: r.back }); };

  // kutlama katmanı (ve üst bildirimler) kök seviyede: ekran değişse de yaşar; oyun/başlık/tanıtımda bildirimler bekler
  const view = (() => { switch (route.name) {
    case 'title': return <TitleScreen returning={Object.keys(store.progress).length > 0} invite={invite} onChallenge={() => { store.touchDay(); if (invite) play(invite.level); }} onStart={start} />;
    case 'story': { const r = route; return <StoryScreen replay={r.replay} onDone={() => { store.ftueStoryDone(); if (r.replay) setRoute({ name: 'settings', back: r.back ?? 'profile' }); else play(1); }} />; }
    case 'map': return withTabs('map', <><MapScreen onPlay={play} onToday={() => tab('today')} />{isOpen('events', cleared, store.ftue) && <EventsFab onOpen={() => nav.open({ name: 'events' })} />}</>);
    case 'today': return withTabs('today', <TodayScreen onInfo={() => openSub('today')('info')} />);
    case 'camp': return withTabs('camp', <CampScreen />);
    case 'team': return withTabs('team', <TeamScreen />);
    case 'profile': return withTabs('profile', <ProfileScreen onOpen={openSub('profile')} />);
    case 'friends': return sub(<FriendsScreen onBack={back(route)} raceReady={isOpen('race', cleared, store.ftue)} />);
    case 'chat': return sub(<ChatScreen key={route.room} room={route.room} title={route.title} onBack={back(route)} />);
    case 'messages': return sub(<MessagesScreen onBack={back(route)} />);
    case 'birlikte': return sub(<TogetherScreen onBack={back(route)} />);
    case 'siralama': return sub(<RankScreen onBack={back(route)} />);
    case 'kamp': return sub(<CampVisitScreen key={route.id} id={route.id} onBack={back(route)} />);
    case 'dm': return sub(<DmRouteScreen key={route.id} id={route.id} onBack={back(route)} />);
    case 'shop': return sub(<ShopScreen onBack={back(route)} />);
    case 'inbox': return sub(<InboxScreen onBack={back(route)} />);
    case 'league': return sub(<LeagueScreen onBack={back(route)} />);
    case 'race': return sub(<RaceLobby key={route.key} inviteRoomId={route.inviteRoomId} onPlay={(spec, room) => setRoute({ name: 'level', spec, extras: raceExtras(), race: room })} onClose={back(route)} />);
    case 'events': return sub(<EventsScreen key={route.key} view={route.view} flash={route.flash} onBack={back(route)} onPlay={(spec, p) => setRoute({ name: 'eventLevel', spec, play: p, back: route.back })} />);
    case 'eventLevel': return <EventLevel spec={route.spec} play={route.play} onExit={(kind, flash) => setRoute({ name: 'events', view: kind, flash, back: route.back, key: Date.now() })} />;
    case 'raceResult': if (route.room.team) return sub(<TeamRaceResultScreen room={route.room} result={route.result} />); return sub(<RaceResult room={route.room} result={route.result} onRematch={(id) => setRoute({ name: 'race', inviteRoomId: id, back: route.back, key: Date.now() })} onLobby={() => setRoute({ name: 'race', back: route.back, key: Date.now() })} />);
    case 'intro': return <BiomeIntro spec={route.spec} onGo={() => { store.markBiomeSeen(route.spec.biome); setRoute({ name: 'level', spec: route.spec, extras: route.extras, skills: route.skills }); }} />;
    case 'level': { const r = route; return <LevelHost key={r.spec.id + (r.race?.id ?? '')} spec={r.spec} skills={r.race ? DEFAULT_SKILLS : r.skills ?? store.skills} sounds={store.sounds && !PLAY_BOT} bot={PLAY_BOT && (!r.race || !!r.race.team) /* test: takım yarışını da bot koşar */} timeScale={BOT_SPEED > 1 ? BOT_SPEED : undefined} extras={r.extras} race={r.race}
      onDone={levelDone.current = (result, room) => {
        if (r.race) {
          // yarış bölümü açık bölümlerdense ilerlemeye ve takıma sayılır (rövanşta açılmamış bölüm sayılmaz)
          if (r.spec.number <= store.highestUnlocked()) { store.completeRun(r.spec, result); submitRun(r.spec, result, r.race.id); }
          setRoute({ name: 'raceResult', room: room ?? r.race, result, back: curTab }); return;
        }
        const summary = store.completeRun(r.spec, result); const runId = submitRun(r.spec, result); setRoute({ name: 'result', spec: r.spec, result, summary, runId });
      }}
      onQuit={() => setRoute(r.race ? (r.race.team ? { name: 'team' } : { name: 'race', back: 'team', key: Date.now() }) : { name: 'map' })} />; }
    case 'result': return <NavContext.Provider value={nav}><ResultScreen key={`${route.spec.id}-${route.result.score}-${route.summary.xpAfter}`} spec={route.spec} result={route.result} summary={route.summary} demo={route.demo} runId={route.runId} challenge={invite} onRetry={() => play(route.spec.number)} onNext={() => play(route.spec.number + 1)} onMap={() => setRoute({ name: 'map' })} /></NavContext.Provider>;
    case 'skills': return <SkillsScreen onBack={() => setRoute({ name: route.back })} />;
    case 'settings': return <SettingsScreen onBack={() => setRoute({ name: route.back })} onReplay={() => setRoute({ name: 'story', replay: true, back: route.back })} onReset={() => setRoute({ name: 'title' })} />;
    case 'achievements': return <AchievementsScreen onBack={() => setRoute({ name: route.back })} />;
    case 'album': return <AlbumScreen onBack={() => setRoute({ name: route.back })} />;
    case 'glossary': return <GlossaryScreen onBack={() => setRoute({ name: route.back })} />;
    case 'wardrobe': return <WardrobeScreen onBack={() => setRoute({ name: route.back })} />;
    case 'info': return <InfoScreen onBack={() => setRoute({ name: route.back })} />;
  } })();
  return <><ArtDefs />{view}<CelebrationLayer toasts={route.name !== 'level' && route.name !== 'eventLevel' && route.name !== 'title' && route.name !== 'intro' && route.name !== 'story'} />{!bot && <><FtueDirector route={route.name} /><CoachHost /></>}{lockToast.node}</>;
}

/** ekran → müzik parçası (undefined: o ekran kendi yönetir) */
function routeTrack(r: Route): Track | undefined {
  switch (r.name) {
    case 'title': case 'map': return 'harita';
    case 'intro': return `biyom:${r.spec.biome}`;
    case 'level': case 'result': case 'eventLevel': return undefined;
    default: return 'menu';
  }
}

/** sekme rozetleri: Kamp = inşaatçı boşta ve yükseltmeye jeton yetiyor; Takım = okunmamış takım sohbeti + hediye + yardım bekleyen */
function useSocialBadges(coins: number) {
  const camp = useNet((s) => s.camp); const team = useNet((s) => s.team); const gifts = useNet((s) => s.giftCount); const help = useNet((s) => s.campHelp.length);
  const unread = useNet((s) => (s.team ? s.unread[`takim:${s.team.id}`] ?? 0 : 0));
  const mentions = useComm((s) => mentionCount(s, team ? `takim:${team.id}` : null));
  const apps = useTeamApply((s) => s.pending?.length ?? 0); // lider/yardımcı: bekleyen başvurular
  let campBadge = 0;
  if (camp && !camp.buildings.some((b) => b.upgradingTo)) {
    const merkez = camp.buildings.find((b) => b.id === 'merkez')?.level ?? 1;
    campBadge = camp.buildings.some((b) => { const d = BUILDINGS.find((x) => x.id === b.id)!; const to = b.level + 1; return to <= d.maxLevel && (b.id === 'merkez' || to <= merkez) && buildCost(b.id, to).jeton <= coins; }) ? 1 : 0;
  }
  return { camp: campBadge, team: team ? unread + gifts + help + mentions + apps : 0 };
}

/** yarışta da oyuncunun kendi Odi'si (renk + şapka); rakipler sunucu profilindeki rengi görür */
function raceExtras(): Extras { const l = odiLook(useStore.getState()); return { cosmetic: { color: l.custom ? l.color : undefined, hat: l.hat } }; }

/** bu koşunun yetenekleri: takım kalkanı varsa bir tanesi kullanılır; yoksa Atölye/Ortak Kalkan şansı (oranı Kamp'ta yazılı) */
function runSkills(skills: PlayerSkills): PlayerSkills {
  if (skills.shield > 0) return skills;
  if (useStore.getState().consumeTeamShield()) { toast('🛡️', 'Takım kalkanı devrede', 'Bu bölüme kalkanla başlıyorsun.', 'accent'); return { ...skills, shield: 1 }; }
  const pct = useSocial.getState().bonuses?.shieldChancePct ?? 0;
  if (pct > 0 && Math.random() * 100 < pct) { toast('🛠️', 'Atölye kalkanı!', `%${pct} şansla bu bölüme kalkanla başlıyorsun.`, 'green'); return { ...skills, shield: 1 }; }
  return skills;
}

