import { useNet } from '@odi/net/store';
import { useNav } from '../nav';
import { Online, TopBar } from '../ui/social';
import { TeamBrowse } from './team/TeamBrowse';
import { TeamHome } from './team/TeamHome';
import { Icon } from '../ui/icons';
import { useSocialUnread } from '../friends';

/** Takım sekmesi: takımsızken keşif/kurma, takımdayken takım merkezi. */
export function TeamScreen() {
  const team = useNet((s) => s.team); const nav = useNav();
  // üst çubukta tek sosyal kısayol: Arkadaşlar (rozet = okunmamış mesaj + gelen istek); mesaj kısayolu bu ekranda gizli (styles.css)
  const social = useSocialUnread();
  return (
    <div className="screen fade-in with-tabs team-screen">
      <TopBar title="Takım" extra={<button className="pill tb-pill tap ico" onClick={() => nav.open({ name: 'friends' })} aria-label={`Arkadaşlar${social ? `: ${social} yeni` : ''}`}><Icon name="friends" size={20} />{social > 0 && <span className="dot">{social > 99 ? '99+' : social}</span>}</button>} />
      <Online what="Takım, sohbet, savaş ve baskın">
        {team ? <TeamHome /> : <TeamBrowse />}
      </Online>
    </div>
  );
}
