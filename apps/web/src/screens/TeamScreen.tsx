import { useNet } from '@odi/net/store';
import { useNav } from '../nav';
import { Online, TopBar } from '../ui/social';
import { TeamBrowse } from './team/TeamBrowse';
import { TeamHome } from './team/TeamHome';

/** Takım sekmesi: takımsızken keşif/kurma, takımdayken takım merkezi. */
export function TeamScreen() {
  const team = useNet((s) => s.team); const nav = useNav();
  return (
    <div className="screen fade-in with-tabs team-screen">
      <TopBar title="Takım" extra={<button className="pill tb-pill tap" onClick={() => nav.open({ name: 'friends' })} aria-label="Arkadaşlar">🫂</button>} />
      <Online what="Takım, sohbet, savaş ve baskın">
        {team ? <TeamHome /> : <TeamBrowse />}
      </Online>
    </div>
  );
}
