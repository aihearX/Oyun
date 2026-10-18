import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LevelSpec, RunResult } from '@odi/shared';
import { generateLevel } from '@odi/level-gen';
import { DEFAULT_COLOR_ID, DEFAULT_SKILLS, FIRSTS, HUMAN_JOURNEY } from '@odi/content';
import {
  calendarView, chestReady, dayKey, defaultMeta, ensureDaily, needsBiomeIntro, processRun, questDone, resolveLook, rollLucky, settle, xpThreshold,
  type PlayerCore, type RunSummary,
} from '@odi/meta';
import { setSoundsEnabled, type LevelOptions } from '@odi/game-core';
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
import { WardrobeScreen } from './screens/WardrobeScreen';
import { InfoScreen } from './screens/InfoScreen';
import { BiomeIntro } from './screens/BiomeIntro';
import { TabBar, type Tab } from './ui/TabBar';
import { Toasts } from './ui/Toasts';
import { readInvite } from './invite';

type Extras = Pick<LevelOptions, 'cosmetic' | 'lucky' | 'firsts'>;
type Sub = 'skills' | 'settings' | 'achievements' | 'album' | 'wardrobe' | 'info';
type Route =
  | { name: 'title' } | { name: Tab } | { name: Sub; back: Tab }
  | { name: 'intro'; spec: LevelSpec; extras: Extras }
  | { name: 'level'; spec: LevelSpec; extras: Extras }
  | { name: 'result'; spec: LevelSpec; result: RunResult; summary: RunSummary; demo?: boolean };

/** `?bot=1&level=N[&ts=2][&skills=all][&salt=K]` → test modu: harness bölümü otomatik oynatır. */
function botParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('bot') !== '1') return null;
  return { idle: q.get('idle') === '1', level: Number(q.get('level') ?? 1), ts: Number(q.get('ts') ?? 1), skillsAll: q.get('skills') === 'all', salt: Number(q.get('salt') ?? 0) };
}

/**
 * Geliştirme önizlemesi: `?demo=sonuc&yildiz=3&skor=1234&rekor=1[&seviye=1][&sans=1][&acilim=1][&bolum=8]`
 * Sonuç ekranını sahte bir çekirdek üzerinde gösterir; kayda hiçbir şey yazmaz (üretimde zararsız).
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
  return { name: 'result', spec, result, summary, demo: true };
}

export function App() {
  const bot = useMemo(botParams, []);
  const demo = useMemo(() => (bot ? null : demoResult()), [bot]);
  const invite = useMemo(() => (bot ? null : readInvite()), [bot]);
  const store = useStore();
  const [route, setRoute] = useState<Route>(demo ?? { name: 'title' });

  useEffect(() => {
    if (!bot) return;
    const spec = generateLevel(store.journey, bot.level, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, bot.salt);
    setRoute({ name: 'level', spec, extras: {} });
  }, [bot, store.journey]);
  useEffect(() => { setSoundsEnabled(store.sounds); }, [store.sounds]);

  const play = (number: number) => {
    const s = useStore.getState();
    const spec = generateLevel(s.journey, number, { recentStars: s.recentStars.length ? s.recentStars.reduce((a, b) => a + b, 0) / s.recentStars.length : 2, failStreak: s.failStreak, skills: s.skills });
    const look = resolveLook(s.meta);
    const extras: Extras = {
      cosmetic: { color: look.colorId === DEFAULT_COLOR_ID ? undefined : look.color, hat: look.hat },
      lucky: rollLucky(),
      firsts: Object.keys(FIRSTS).filter((f) => !s.meta.firsts.includes(f)),
    };
    setRoute(needsBiomeIntro(s.meta, spec.biome) ? { name: 'intro', spec, extras } : { name: 'level', spec, extras });
  };

  if (bot && route.name === 'level') {
    const skills = bot.skillsAll ? { doubleJump: true, longSlide: true, magnet: 3 as const, shield: 2 as const, breath: 3 as const, echoSight: true } : DEFAULT_SKILLS;
    return <LevelHost spec={route.spec} skills={skills} sounds={false} bot botIdle={bot.idle} timeScale={bot.ts} onDone={() => { /* harness window.__odi üzerinden okur */ }} onQuit={() => undefined} />;
  }

  // sekme rozetleri: bekleyen (alınabilir) ödüller
  const today = dayKey(); const daily = ensureDaily(store.meta.daily, today);
  const todayBadge = daily.quests.filter((q) => questDone(q) && !q.claimed).length + (chestReady(daily) ? 1 : 0) + (store.lastDay === today && !calendarView(store, today).claimedToday ? 1 : 0);
  const tab = (t: Tab) => setRoute({ name: t });
  const withTabs = (active: Tab, el: ReactNode) => <>{el}<TabBar active={active} onTab={tab} badges={{ today: todayBadge }} /><Toasts /></>;
  const openSub = (back: Tab) => (l: ProfileLink | Sub) => setRoute({ name: l, back });

  switch (route.name) {
    case 'title': return <TitleScreen returning={Object.keys(store.progress).length > 0} invite={invite} onChallenge={() => { store.touchDay(); if (invite) play(invite.level); }} onStart={() => { store.touchDay(); setRoute({ name: 'map' }); }} />;
    case 'map': return withTabs('map', <MapScreen onPlay={play} onToday={() => tab('today')} />);
    case 'today': return withTabs('today', <TodayScreen onInfo={() => openSub('today')('info')} />);
    case 'team': return withTabs('team', <TeamScreen />);
    case 'profile': return withTabs('profile', <ProfileScreen onOpen={openSub('profile')} />);
    case 'intro': return <BiomeIntro spec={route.spec} onGo={() => { store.markBiomeSeen(route.spec.biome); setRoute({ name: 'level', spec: route.spec, extras: route.extras }); }} />;
    case 'level': return <LevelHost spec={route.spec} skills={store.skills} sounds={store.sounds} extras={route.extras} onDone={(result) => { const summary = store.completeRun(route.spec, result); setRoute({ name: 'result', spec: route.spec, result, summary }); }} onQuit={() => setRoute({ name: 'map' })} />;
    case 'result': return <><ResultScreen key={`${route.spec.id}-${route.result.score}-${route.summary.xpAfter}`} spec={route.spec} result={route.result} summary={route.summary} demo={route.demo} challenge={invite} onRetry={() => play(route.spec.number)} onNext={() => play(route.spec.number + 1)} onMap={() => setRoute({ name: 'map' })} /><Toasts /></>;
    case 'skills': return <><SkillsScreen onBack={() => setRoute({ name: route.back })} /><Toasts /></>;
    case 'settings': return <SettingsScreen onBack={() => setRoute({ name: route.back })} />;
    case 'achievements': return <AchievementsScreen onBack={() => setRoute({ name: route.back })} />;
    case 'album': return <AlbumScreen onBack={() => setRoute({ name: route.back })} />;
    case 'wardrobe': return <WardrobeScreen onBack={() => setRoute({ name: route.back })} />;
    case 'info': return <InfoScreen onBack={() => setRoute({ name: route.back })} />;
  }
}
