import { useEffect, useState } from 'react';
import type { EventKind, LevelSpec } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { Online } from '../ui/social';
import { refreshEvents, useEvents } from './store';
import { EVENT_META } from './common';
import { EvHead } from './common';
import { Hub } from './Hub';
import { RallyView } from './Rally';
import { DuelView } from './Duel';
import { RelayView } from './Relay';
import { HuntView } from './Hunt';
import { PratikLink, QuizView } from './Quiz';
import { QuestsView } from './Quests';
import { ChallengeView } from './Challenge';
import { TourneyView } from './Tourney';
import type { EventFlash, EventPlay } from './EventLevel';
import { rallyHitText } from './ralli-bolum';
import { eventBackTo } from '../nav';
import { scrollAppTop } from '../ui/viewport';
import './events.css';
import { IconButton } from '../ui/Button';
import { Art, Glyph } from '../ui/art';

export type EventView = 'merkez' | EventKind;
export type PlayFn = (spec: LevelSpec, play: EventPlay) => void;
const TEAM_ONLY: EventKind[] = ['ralli', 'duello', 'bayrak', 'avi', 'quiz', 'gorev'];

/**
 * Etkinlikler: merkez (kartlar) + her etkinliğin ekranı. Koşu bitince `flash` ile sonuç gösterilir. Geri: merkezden açılan etkinlikte
 * merkeze, doğrudan açılanda geldiği yere (eventBackTo; onPlay'in üçüncü bağımsız değişkeni koşu dönüşünde bunu korur).
 */
export function EventsScreen({ view = 'merkez', flash, rallyId, fromHub = false, onBack, onPlay }: { view?: EventView; flash?: EventFlash; rallyId?: string; fromHub?: boolean; onBack: () => void; onPlay: (spec: LevelSpec, play: EventPlay, fromHub: boolean) => void }) {
  const [v, setV] = useState<EventView>(view);
  const [hub, setHub] = useState(fromHub);
  const [shown, setShown] = useState<EventFlash | undefined>(flash);
  const liveRally = useEvents((s) => s.rally);
  const inTeam = useEvents((s) => s.inTeam); const loaded = useEvents((s) => s.loaded); const status = useNet((s) => s.status);
  useEffect(() => { void refreshEvents(); }, [v, status]);
  // uzun sonuç (Bayrak: rekorla karşılaştırma) okunacak kadar kalır; dokununca kapanır
  useEffect(() => { if (!shown) return; const h = setTimeout(() => setShown(undefined), Math.min(12_000, 6000 + Math.max(0, shown.text.length - 60) * 60)); return () => clearTimeout(h); }, [shown]);
  useEffect(() => { scrollAppTop(); }, [v]);
  const back = () => (eventBackTo(v, hub) === 'merkez' ? setV('merkez') : onBack());
  const play: PlayFn = (spec, p) => onPlay(spec, p, hub);
  const needTeam = v !== 'merkez' && TEAM_ONLY.includes(v) && loaded && !inTeam;
  return (
    <div className="screen fade-in ev-screen" data-testid="etkinlikler" data-view={v}>
      {v === 'merkez' ? <EvHeadHub onBack={onBack} /> : <EvHead kind={v} onBack={back} />}
      {shown && <div className={`ev-flash ${shown.tone}`} role="status" data-testid="ev-flash" onClick={() => setShown(undefined)}><span className="ev-flash-i"><Glyph e={shown.icon} size={30} /></span><span className="min0"><b>{shown.title}</b><small>{shown.rally ? rallyHitText(shown.rally, liveRally) : shown.text}</small></span></div>}
      <Online what="Etkinlikler">
        {needTeam ? <div className="card muted stack">Bu etkinlik için bir takımda olmalısın.{v === 'quiz' && <PratikLink />}</div> : (
          <>
            {v === 'merkez' && <Hub open={(k) => { setHub(true); setV(k); }} />}
            {v === 'ralli' && <RallyView onPlay={play} rallyId={rallyId} />}
            {v === 'duello' && <DuelView />}
            {v === 'bayrak' && <RelayView onPlay={play} />}
            {v === 'avi' && <HuntView />}
            {v === 'quiz' && <QuizView />}
            {v === 'gorev' && <QuestsView />}
            {v === 'meydan' && <ChallengeView onPlay={play} />}
            {v === 'turnuva' && <TourneyView onPlay={play} />}
          </>
        )}
      </Online>
    </div>
  );
}

function EvHeadHub({ onBack }: { onBack: () => void }) {
  return (
    <div className="ev-hub-head">
      <IconButton icon="back" label="Geri" onClick={onBack} />
      <div className="min0"><h1>Etkinlikler</h1><small>Bireysel oyna, takımca kazan!</small></div>
      <span className="ev-hub-art" aria-hidden><Art e="🎪" size="1.15em" className="art-inline" /></span>
    </div>
  );
}
export { EVENT_META };
