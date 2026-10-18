import { useEffect, useMemo, useState } from 'react';
import type { LevelSpec, RunResult } from '@odi/shared';
import { generateLevel } from '@odi/level-gen';
import { DEFAULT_SKILLS } from '@odi/content';
import { useStore } from './store';
import { MapScreen } from './screens/MapScreen';
import { LevelHost } from './screens/LevelHost';
import { ResultScreen } from './screens/ResultScreen';
import { SkillsScreen } from './screens/SkillsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TitleScreen } from './screens/TitleScreen';
import { readInvite } from './invite';

type Route = { name: 'title' } | { name: 'map' } | { name: 'level'; spec: LevelSpec } | { name: 'result'; spec: LevelSpec; result: RunResult } | { name: 'skills' } | { name: 'settings' };

/** `?bot=1&level=N[&ts=2][&skills=all][&salt=K]` → test modu: harness bölümü otomatik oynatır. */
function botParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('bot') !== '1') return null;
  return { level: Number(q.get('level') ?? 1), ts: Number(q.get('ts') ?? 1), skillsAll: q.get('skills') === 'all', salt: Number(q.get('salt') ?? 0) };
}

export function App() {
  const bot = useMemo(botParams, []);
  const invite = useMemo(() => (bot ? null : readInvite()), [bot]);
  const store = useStore();
  const [route, setRoute] = useState<Route>({ name: 'title' });

  useEffect(() => {
    if (!bot) return;
    const spec = generateLevel(store.journey, bot.level, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, bot.salt);
    setRoute({ name: 'level', spec });
  }, [bot, store.journey]);

  const play = (number: number) => {
    const spec = generateLevel(store.journey, number, { recentStars: store.recentStars.length ? store.recentStars.reduce((a, b) => a + b, 0) / store.recentStars.length : 2, failStreak: store.failStreak, skills: store.skills });
    setRoute({ name: 'level', spec });
  };

  if (bot && route.name === 'level') {
    const skills = bot.skillsAll ? { doubleJump: true, longSlide: true, magnet: 3 as const, shield: 2 as const, breath: 3 as const, echoSight: true } : DEFAULT_SKILLS;
    return <LevelHost spec={route.spec} skills={skills} sounds={false} bot timeScale={bot.ts} onDone={() => { /* harness window.__odi üzerinden okur */ }} onQuit={() => undefined} />;
  }

  switch (route.name) {
    case 'title': return <TitleScreen returning={Object.keys(store.progress).length > 0} invite={invite} onChallenge={() => { store.touchDay(); if (invite) play(invite.level); }} onStart={() => { store.touchDay(); setRoute({ name: 'map' }); }} />;
    case 'map': return <MapScreen onPlay={play} onSkills={() => setRoute({ name: 'skills' })} onSettings={() => setRoute({ name: 'settings' })} />;
    case 'level': return <LevelHost spec={route.spec} skills={store.skills} sounds={store.sounds} onDone={(result) => { store.recordRun(route.spec.number, result); setRoute({ name: 'result', spec: route.spec, result }); }} onQuit={() => setRoute({ name: 'map' })} />;
    case 'result': return <ResultScreen spec={route.spec} result={route.result} challenge={invite} onRetry={() => play(route.spec.number)} onNext={() => play(route.spec.number + 1)} onMap={() => setRoute({ name: 'map' })} />;
    case 'skills': return <SkillsScreen onBack={() => setRoute({ name: 'map' })} />;
    case 'settings': return <SettingsScreen onBack={() => setRoute({ name: 'map' })} />;
  }
}
