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
import { QuizView } from './Quiz';
import { QuestsView } from './Quests';
import { ChallengeView } from './Challenge';
import { TourneyView } from './Tourney';
import type { EventFlash, EventPlay } from './EventLevel';
import { scrollAppTop } from '../ui/viewport';
import './events.css';
import { IconButton } from '../ui/Button';
import { Art, Glyph } from '../ui/art';

export type EventView = 'merkez' | EventKind;
export type PlayFn = (spec: LevelSpec, play: EventPlay) => void;
const TEAM_ONLY: EventKind[] = ['ralli', 'duello', 'bayrak', 'avi', 'quiz', 'gorev'];

/** Etkinlikler: merkez (kartlar) + her etkinliğin ekranı. Koşu bitince `flash` ile sonuç gösterilir. */
export function EventsScreen({ view = 'merkez', flash, onBack, onPlay }: { view?: EventView; flash?: EventFlash; onBack: () => void; onPlay: PlayFn }) {
  const [v, setV] = useState<EventView>(view);
  const [shown, setShown] = useState<EventFlash | undefined>(flash);
  const inTeam = useEvents((s) => s.inTeam); const loaded = useEvents((s) => s.loaded); const status = useNet((s) => s.status);
  useEffect(() => { void refreshEvents(); }, [v, status]);
  useEffect(() => { if (!shown) return; const h = setTimeout(() => setShown(undefined), 6000); return () => clearTimeout(h); }, [shown]);
  useEffect(() => { scrollAppTop(); }, [v]);
  const back = () => (v === 'merkez' ? onBack() : setV('merkez'));
  const needTeam = v !== 'merkez' && TEAM_ONLY.includes(v) && loaded && !inTeam;
  return (
    <div className="screen fade-in ev-screen" data-testid="etkinlikler" data-view={v}>
      {v === 'merkez' ? <EvHeadHub onBack={onBack} /> : <EvHead kind={v} onBack={back} />}
      {shown && <div className={`ev-flash ${shown.tone}`} role="status" data-testid="ev-flash" onClick={() => setShown(undefined)}><span className="ev-flash-i"><Glyph e={shown.icon} size={30} /></span><span className="min0"><b>{shown.title}</b><small>{shown.text}</small></span></div>}
      <Online what="Etkinlikler">
        {needTeam ? <div className="card muted">Bu etkinlik için bir takımda olmalısın.</div> : (
          <>
            {v === 'merkez' && <Hub open={setV} />}
            {v === 'ralli' && <RallyView onPlay={onPlay} />}
            {v === 'duello' && <DuelView />}
            {v === 'bayrak' && <RelayView onPlay={onPlay} />}
            {v === 'avi' && <HuntView />}
            {v === 'quiz' && <QuizView />}
            {v === 'gorev' && <QuestsView />}
            {v === 'meydan' && <ChallengeView onPlay={onPlay} />}
            {v === 'turnuva' && <TourneyView onPlay={onPlay} />}
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
