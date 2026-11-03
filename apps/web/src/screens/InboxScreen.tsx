import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { LEAGUE_DEMOTE_BOTTOM, LEAGUE_FULL_RUNS_PER_LEVEL, LEAGUE_GROUP_SIZE, LEAGUE_PROMOTE_TOP, LEAGUE_REPLAY_POINTS, inboxGotText, inboxReasonText, type InboxItem, type LeagueState, type LeagueTier } from '@odi/shared';
import { claimInboxItem, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { celebrate } from '../celebrate';
import { ScreenHead } from '../ui/bits';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Empty, ItemChips, Online, Skeleton, TIER, fmtDate, fmtLeft, fmtNum, useNow } from '../ui/social';
import { Art, Glyph, Rich } from '../ui/art';

/** eski kayıtların nedeni sistem emojisiyle başlayabilir ("🎁 Ayşe sana arkadaş hediyesi gönderdi"): baştaki emoji ayıklanır, satırın simgesi zaten çizim (OT-sessiz-oyuncu-8) */
const LEAD_EMOJI = /^(?:\p{Extended_Pictographic}|\u{FE0F}|\u{200D})+\s*/u;
/** eski kayıtların metni (hafta kodu, kimin sırası belirsiz) görünümde yeni biçime gelir: inboxReasonText (YN-103) */
const inboxReason = (it: InboxItem) => inboxReasonText({ kind: it.kind, reason: it.reason.replace(LEAD_EMOJI, '') });

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
  /** bildirim yalnız gerçekten alınan türleri sayar (OT-ekonomi-denetci-22) */
  const all = async () => {
    if (!items) return; setBusy(true); let n = 0; const got: InboxItem[] = [];
    for (const it of items) if (await claimInboxItem(it.id)) { n++; got.push(it); setItems((l) => l?.filter((x) => x.id !== it.id) ?? null); }
    setBusy(false); if (n) { platform().haptic('success'); fly(got); toast('📬', `${n} ödül alındı`, inboxGotText(got), 'gold'); }
  };
  if (err) return <div className="chat-err">{err}</div>;
  if (!items) return <Skeleton rows={3} />;
  return (
    <div className="stack">
      {items.length > 0 && <button className="btn" disabled={busy} onClick={() => void all()}><Art name="mail" size="1.2em" className="art-inline" /> Hepsini al ({items.length})</button>}
      {items.length === 0 ? <Empty icon="📭" title="Ödül kutun boş" text="Savaş zaferleri, takım yardımları ve Sezon Kartı ödülleri buraya gelir." /> : items.map((it) => (
        <div className="card gift" key={it.id}>
          <span className="gift-i" aria-hidden><Art name={it.kind === 'kalkan' ? 'shield' : it.kind === 'kristal' ? 'crystal' : it.kind === 'jeton' ? 'coin' : it.kind === 'kart' ? 'card' : 'hat'} size={30} /></span>
          <div className="grow min0"><b className="wrap">{inboxReason(it)}</b><div className="muted">{fmtDate(it.at)}</div><ItemChips items={[it]} small /></div>
          <button className="btn small" disabled={busy} onClick={() => void one(it)}>Al</button>
        </div>))}
    </div>
  );
}

/**
 * Bu grubun gerçek yükselme/düşme cümlesi (YN-086): sınırlar sunucudan (leagueCuts, grup büyüklüğüne oranlı; yükselen ve düşen ayrık).
 * Koklea'dan yükselme, Bronz'dan düşme yok.
 */
export function leagueRuleText(tier: LeagueTier, n: number, up: number, down: number): string {
  const drop = tier === 'bronz' ? ' Bronz\'dan düşülmez.' : down > 0 ? ` Son ${down} bir alta iner.` : ' Bu grupta düşme yok.';
  const head = tier === 'koklea' ? 'Koklea en üst lig: buradan yükselme yok.' : `İlk ${up} bir üst lige çıkar.`;
  const grow = n < LEAGUE_GROUP_SIZE ? ` Gruba yeni oyuncu katıldıkça sınırlar büyür (${LEAGUE_GROUP_SIZE} kişide ilk ${LEAGUE_PROMOTE_TOP}, son ${LEAGUE_DEMOTE_BOTTOM}).` : '';
  return `Bu grupta ${n} kişi var. ${head}${drop}${grow}`;
}

/** Profildeki haftalık lig kartı */
/** son bilinen lig durumu: çevrimdışıyken Profil'deki lig satırı bununla gri görünür (YN-142) */
let lastLeague: LeagueState | null = null;
export function LeagueCard({ onOpen, offline = false }: { onOpen: () => void; offline?: boolean }) {
  const st = useNet((s) => s.status);
  const [lg, setLg] = useState<LeagueState | null>(lastLeague); const now = useNow(30_000);
  useEffect(() => { if (st === 'bağlı') void getNet()?.call('league.state', {}).then((r) => { lastLeague = r.league; setLg(r.league); }).catch(() => undefined); }, [st]);
  // çevrimdışı: satır kaybolmaz; son bilinen değer gri, Kamp'taki "Bağlanınca başlayacak" diliyle
  if (offline) return (
    <div className="card league-card off" data-testid="lig-cevrimdisi" aria-disabled="true">
      <span className="lg-tier" aria-hidden><Glyph e={lg ? TIER[lg.tier].icon : '🏆'} size={40} /></span>
      <span className="grow min0"><b>{lg ? `${TIER[lg.tier].name} Ligi · ${lg.rank}. sıra` : 'Haftalık lig'}</b>
        <span className="muted">{lg ? `${fmtNum(lg.points)} puan · son bilinen` : 'Sıran bağlanınca görünecek'}</span>
        <span className="lg-zone">Çevrimdışı · bağlanınca güncellenecek</span>
      </span>
    </div>
  );
  if (!lg) return null;
  const t = TIER[lg.tier]; const n = lg.group.length;
  const zone = lg.rank <= lg.promoteTop && lg.tier !== 'koklea' ? 'up' : lg.tier !== 'bronz' && lg.rank > Math.max(lg.promoteTop, n - lg.demoteBottom) ? 'down' : 'safe';
  // güvenli bölgede bu grubun gerçek sınırları (YN-086)
  const dropTxt = lg.tier === 'bronz' ? '' : lg.demoteBottom ? `son ${lg.demoteBottom} iner` : 'düşme yok';
  const safe = lg.tier === 'koklea' ? (lg.rank <= lg.promoteTop ? '🐚 Zirvedesin' : `Bu grupta ${dropTxt}`) : `Bu grupta ilk ${lg.promoteTop} çıkar${dropTxt ? `, ${dropTxt}` : ''}`;
  return (
    <button className={`card league-card z-${zone}`} onClick={onOpen}>
      <span className="lg-tier" aria-hidden><Glyph e={t.icon} size={40} /></span>
      <span className="grow min0"><b>{t.name} Ligi · {lg.rank}. sıra</b><span className="muted">{fmtNum(lg.points)} puan · {n} kişi · bitişe {fmtLeft(lg.endsAt - now)}</span>
        <span className="lg-zone"><Rich text={zone === 'up' ? '⬆️ Yükselme bölgesindesin' : zone === 'down' ? '⬇️ Düşme bölgesi: biraz gayret!' : safe} /></span>
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
            <div className="card"><b><Glyph e={TIER[lg.tier].icon} size="1.2em" /> {TIER[lg.tier].name} Ligi</b><div className="muted" data-testid="lig-kural">Bitişe {fmtLeft(lg.endsAt - now)}. {leagueRuleText(lg.tier, n, lg.promoteTop, lg.demoteBottom)} Puan: bitirdiğin her bölüm 5 + 5 × yıldız (+ yarış derecesi); bitiremediğin koşu 1. Aynı bölüm haftada en çok {LEAGUE_FULL_RUNS_PER_LEVEL} kez tam puan yazar, sonraki her bitirişi {LEAGUE_REPLAY_POINTS} puan.</div></div>
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
