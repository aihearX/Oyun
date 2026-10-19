import { useEffect } from 'react';
import { useNav } from '../../nav';
import { Hub, refreshEvents } from '../../events';
import { Art } from '../../ui/art';

/** Takım ekranındaki "Etkinlikler" sekmesi: canlı etkinlik kartları; dokununca etkinliğin kendi ekranı açılır. */
export function TeamEvents() {
  const nav = useNav();
  useEffect(() => { void refreshEvents(); }, []);
  return (
    <div className="stack" data-testid="takim-etkinlikler">
      <button className="btn small ghost" onClick={() => nav.open({ name: 'events' })}><Art e="🎪" size="1.15em" className="art-inline" /> Etkinlik merkezini aç</button>
      <Hub open={(k) => nav.open({ name: 'events', view: k })} />
    </div>
  );
}
