import { useEffect, useState } from 'react';
import type { LevelSpec, RaceRoom, RunResult } from '@odi/shared';
import { DEFAULT_SKILLS } from '@odi/content';
import { useNet } from '@odi/net/store';
import { getNet, submitRun } from '../../net';
import { useStore } from '../../store';
import { LevelHost } from '../../screens/LevelHost';
import { RaceLobby } from '../RaceLobby';
import { RaceResult } from '../RaceResult';
import { RaceInviteBanner } from '../useRaceInvites';

/**
 * Yarış test sayfası (yalnızca geliştirme ve tools/harness/race-e2e.mjs; üretim derlemesinde yok).
 * Parametreler:
 *  - `?ad=Ayşe`          → bağlanınca takma adı ayarla
 *  - `?yaris-bot=1`      → bölümü harness botu oynar (yalnızca bu sayfada; uygulamada etkisiz, kullanıcıya hiç gösterilmez)
 *  - `&bot-gecikme=700`  → bot "Başla!"dan bu kadar ms sonra başlar (testte bitiş sırası ve hayaletler ayrışsın diye)
 *  - `&hd=3`             → bot kipinde de tuval bu piksel oranında çizilir (vitrin: keskin yarış içi kare; yoksa bot 1x)
 *  - `?sunucu=ws://…`    → sosyal sunucu adresi (platform.ts)
 *  - `&ilerleme=1`       → bölüm bitince sonuç uygulamadaki gibi ilerlemeye ve sunucuya yazılır (submitRun + yarış odası; kopma-e2e ödül denetimi)
 * Uygulamadaki (App.tsx) bağlama bunun aynısıdır.
 */
const q = new URLSearchParams(location.search);
const BOT = q.get('yaris-bot') === '1';
const BOT_DELAY = Math.max(0, Number(q.get('bot-gecikme') ?? 0) || 0);
const NAME = (q.get('ad') ?? '').trim();
const HD = Math.max(0, Math.min(3, Number(q.get('hd') ?? 0) || 0));
const PROGRESS = q.get('ilerleme') === '1';

type Route =
  | { name: 'lobby'; inviteRoomId?: string; key: number }
  | { name: 'level'; spec: LevelSpec; room: RaceRoom }
  | { name: 'result'; room: RaceRoom; result: RunResult };

declare global { interface Window { __yaris?: { net: typeof getNet; route: Route['name']; result?: RaceRoom } } }

export function RaceDevApp() {
  const [route, setRoute] = useState<Route>({ name: 'lobby', key: 0 });
  const status = useNet((s) => s.status);
  useEffect(() => {
    const net = getNet();
    if (status === 'bağlı' && net && NAME && net.me?.name !== NAME) void net.call('profile.update', { name: NAME }).catch(() => undefined);
  }, [status]);
  useEffect(() => { window.__yaris = { net: getNet, route: route.name, result: route.name === 'result' ? route.room : undefined }; }, [route]);
  const lobby = (inviteRoomId?: string) => setRoute({ name: 'lobby', inviteRoomId, key: Date.now() });

  switch (route.name) {
    case 'lobby': return <>
      <RaceInviteBanner onAccept={(id) => lobby(id)} />
      <RaceLobby key={route.key} inviteRoomId={route.inviteRoomId} onPlay={(spec, room) => setRoute({ name: 'level', spec, room })} onClose={() => lobby()} />
    </>;
    case 'level': return <LevelHost spec={route.spec} skills={DEFAULT_SKILLS} sounds={!BOT} bot={BOT} race={route.room} raceBotDelayMs={BOT_DELAY} renderScale={HD || undefined}
      onDone={(result, room) => {
        // uygulamadaki (App.tsx) aynı kural: açık bölümse ilerlemeye ve sunucuya (yarış derecesiyle) yazılır
        if (PROGRESS) { const store = useStore.getState(); if (route.spec.number <= store.highestUnlocked()) { store.completeRun(route.spec, result); submitRun(route.spec, result, route.room.id); } }
        setRoute({ name: 'result', room: room ?? route.room, result });
      }} onQuit={() => lobby()} />;
    case 'result': return <>
      <RaceInviteBanner onAccept={(id) => lobby(id)} />
      <RaceResult room={route.room} result={route.result} onRematch={(id) => lobby(id)} onLobby={() => lobby()} />
    </>;
  }
}
