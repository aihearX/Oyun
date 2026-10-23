import { useEffect, useMemo, useState } from 'react';
import type { CampState, CampVisit, CheerKind } from '@odi/shared';
import { act, toast } from '../net';
import { Skeleton, TopBar } from '../ui/social';
import { CampBase } from './CampBase';
import { regionsNow } from './anit';
import type { CampActions } from './model';
import './camp.css';

/** başkasının kampında hiçbir eylem yapılmaz (salt okunur) */
const NO_ACTIONS: CampActions = {
  upgrade: async () => false, speed: async () => false, ask: async () => false, collect: async () => null, helpAll: async () => null,
  remedyMake: async () => false, remedyCollect: async () => null, decorPlace: async () => null, decorMove: async () => null, decorStore: async () => false, libCollect: async () => null,
};
/** ziyaret bilgisinden sahnenin anladığı kamp durumu */
export function visitCamp(v: CampVisit, now = Date.now()): CampState {
  return {
    buildings: v.buildings.map((b) => ({ id: b.id, level: b.level, upgradingTo: null, startedAt: null, endsAt: null, helpsReceived: 0 })),
    depotStoredAt: now, serverTime: now, xp: v.xp, decor: { inv: {}, placed: v.decor, cap: v.decor.length }, cheers: v.cheers,
  };
}

/** Kamp ziyareti (docs/14-kamp.md §12): arkadaşın ya da takım arkadaşının kampı salt okunur; günde bir hazır tepki. */
export function CampVisitScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [v, setV] = useState<CampVisit | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { void act('camp.visit', { playerId: id }).then((r) => { if (r) setV(r.visit); else setErr(true); }); }, [id]);
  const camp = useMemo(() => (v ? visitCamp(v) : null), [v]);
  if (!v || !camp) {
    return (
      <div className="screen fade-in">
        <TopBar title="Kamp" />
        {err ? <div className="card"><b>Bu kampı şu an göremiyoruz.</b><div className="muted">Yalnız arkadaşlarının ve takım arkadaşlarının kampını gezebilirsin.</div><button className="btn" onClick={onBack}>Geri</button></div> : <Skeleton rows={3} />}
      </div>
    );
  }
  const cheer = async (kind: CheerKind) => {
    const r = await act('camp.cheer', { playerId: id, kind });
    if (!r) return;
    setV(r.visit);
    toast('👏', `${v.name} tepkini gördü`, r.xp > 0 ? `+${r.xp} Kamp XP` : 'Yarın yine gel!', 'green');
  };
  return (
    <CampBase camp={camp} wallet={{ jeton: 0, kristal: 0, hizlandirici: { m5: 0, m60: 0, s8: 0 } }} team={v.team} helpCount={0} fast={0} now={Date.now} actions={NO_ACTIONS} onList={() => undefined}
      visit={{ name: v.name, heroColor: v.color, regions: regionsNow(Math.max(0, v.highest - 1)), cheeredToday: v.cheeredToday, cheers: v.cheers, relation: v.relation, onCheer: cheer, onBack }} />
  );
}
