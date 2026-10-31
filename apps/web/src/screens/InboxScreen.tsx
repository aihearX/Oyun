import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { LEAGUE_FULL_RUNS_PER_LEVEL, LEAGUE_REPLAY_POINTS, type InboxItem, type LeagueState } from '@odi/shared';
import { claimInboxItem, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { celebrate } from '../celebrate';
import { ScreenHead } from '../ui/bits';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Empty, ItemChips, Online, Skeleton, TIER, fmtDate, fmtLeft, fmtNum, useNow } from '../ui/social';
import { Art, Glyph, Rich } from '../ui/art';

/** Ödül kutusu: sunucunun verdiği ödüller; tek tek ya da "Hepsini al". */
export function InboxScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen fade-in">
      <ScreenHead title="Ödül kutusu" onBack={onBack} />
      <Online what="Ödül kutusu"><Inbox /></Online>
    </div>
  );
}

function Inbox() {
  const [items, setItems] = useState<InboxItem[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => getNet()?.call('inbox.list', {}).then((r) => { setItems(r.items); useNet.setState({ inboxCount: r.items.length }); }, (e) => setErr(errText(e)));
  useEffect(() => { void load(); const off = getNet()?.on('inbox.new', ({ item }) => setItems((l) => (l ? [item, ...l] : l))); return off; }, []);
  /** alınan jeton/kristal sayaca uçar (miktar = alınan öğeler) */
  const fly = (got: InboxItem[]) => { for (const kind of ['jeton', 'kristal'] as const) { const n = got.filter((x) => x.kind === kind).reduce((a, x) => a + x.amount, 0); if (n > 0) void celebrate.coins({ amount: n, kind }); } };
  const one = async (it: InboxItem) => { setBusy(true); if (await claimInboxItem(it.id)) { setItems((l) => l?.filter((x) => x.id !== it.id) ?? null); platform().haptic('success'); fly([it]); } setBusy(false); };
  const all = async () => {
    if (!items) return; setBusy(true); let n = 0; const got: InboxItem[] = [];
    for (const it of items) if (await claimInboxItem(it.id)) { n++; got.push(it); setItems((l) => l?.filter((x) => x.id !== it.id) ?? null); }
    setBusy(false); if (n) { platform().haptic('success'); fly(got); toast('📬', `${n} ödül alındı`, 'Jeton ve kristal cüzdanında; kalkan bir sonraki bölümde.', 'gold'); }
  };
  if (err) return <div className="chat-err">{err}</div>;
  if (!items) return <Skeleton rows={3} />;
  return (
    <div className="stack">
      {items.length > 0 && <button className="btn" disabled={busy} onClick={() => void all()}><Art name="mail" size="1.2em" className="art-inline" /> Hepsini al ({items.length})</button>}
      {items.length === 0 ? <Empty icon="📭" title="Ödül kutun boş" text="Savaş zaferleri, takım yardımları ve Sezon Kartı ödülleri buraya gelir." /> : items.map((it) => (
        <div className="card gift" key={it.id}>
          <span className="gift-i" aria-hidden><Art name={it.kind === 'kalkan' ? 'shield' : it.kind === 'kristal' ? 'crystal' : it.kind === 'jeton' ? 'coin' : it.kind === 'kart' ? 'card' : 'hat'} size={30} /></span>
          <div className="grow min0"><b className="wrap">{it.reason}</b><div className="muted">{fmtDate(it.at)}</div><ItemChips items={[it]} small /></div>
          <button className="btn small" disabled={busy} onClick={() => void one(it)}>Al</button>
        </div>))}
    </div>
  );
}

/** Profildeki haftalık lig kartı */
export function LeagueCard({ onOpen }: { onOpen: () => void }) {
  const st = useNet((s) => s.status);
  const [lg, setLg] = useState<LeagueState | null>(null); const now = useNow(30_000);
  useEffect(() => { if (st === 'bağlı') void getNet()?.call('league.state', {}).then((r) => setLg(r.league)).catch(() => undefined); }, [st]);
  if (!lg) return null;
  const t = TIER[lg.tier]; const n = lg.group.length;
  const zone = lg.rank <= lg.promoteTop && lg.tier !== 'koklea' ? 'up' : lg.tier !== 'bronz' && lg.rank > Math.max(lg.promoteTop, n - lg.demoteBottom) ? 'down' : 'safe';
  return (
    <button className={`card league-card z-${zone}`} onClick={onOpen}>
      <span className="lg-tier" aria-hidden><Glyph e={t.icon} size={40} /></span>
      <span className="grow min0"><b>{t.name} Ligi · {lg.rank}. sıra</b><span className="muted">{fmtNum(lg.points)} puan · {n} kişi · bitişe {fmtLeft(lg.endsAt - now)}</span>
        <span className="lg-zone"><Rich text={zone === 'up' ? '⬆️ Yükselme bölgesindesin' : zone === 'down' ? '⬇️ Düşme bölgesi: biraz gayret!' : lg.tier === 'koklea' && lg.rank <= lg.promoteTop ? '🐚 Zirvedesin' : `İlk ${lg.promoteTop} bir üst lige çıkar`} /></span>
      </span>
      <span aria-hidden>›</span>
    </button>
  );
}

export function LeagueScreen({ onBack }: { onBack: () => void }) {
  const me = useNet((s) => s.me);
  const [lg, setLg] = useState<LeagueState | null>(null); const now = useNow(30_000);
  useEffect(() => { void getNet()?.call('league.state', {}).then((r) => setLg(r.league)).catch(() => undefined); }, []);
  return (
    <div className="screen fade-in">
      <ScreenHead title="Haftalık lig" onBack={onBack} />
      <Online what="Lig">
        {!lg ? <Skeleton rows={5} /> : (() => { const n = lg.group.length; const downFrom = Math.max(lg.promoteTop, n - lg.demoteBottom); return (
          <div className="stack">
            <div className="card"><b><Glyph e={TIER[lg.tier].icon} size="1.2em" /> {TIER[lg.tier].name} Ligi</b><div className="muted">Bitişe {fmtLeft(lg.endsAt - now)}. İlk {lg.promoteTop} bir üst lige çıkar{lg.tier !== 'bronz' ? `, son ${lg.demoteBottom} bir alta iner` : ''}. Puan: bitirdiğin her bölüm 5 + 5 × yıldız (+ yarış derecesi); bitiremediğin koşu 1. Aynı bölüm haftada en çok {LEAGUE_FULL_RUNS_PER_LEVEL} kez tam puan yazar, sonraki her bitirişi {LEAGUE_REPLAY_POINTS} puan.</div></div>
            <ol className="league-list">
              {lg.group.map((p, i) => { const up = i < lg.promoteTop && lg.tier !== 'koklea'; const down = lg.tier !== 'bronz' && i >= downFrom; return (
                <li key={p.id} className={`${p.id === me?.id ? 'me ' : ''}${up ? 'up' : down ? 'down' : ''}`}>
                  <span className="rk">{i + 1}</span><OdiAvatar size={28} color={p.color} /><span className="grow ellipsis">{p.name}{p.id === me?.id ? ' (sen)' : ''}</span><b>{fmtNum(p.points)}</b>
                </li>); })}
            </ol>
          </div>); })()}
      </Online>
    </div>
  );
}
