import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { TEAM_TECH, type TeamGift } from '@odi/shared';
import { act, applyServerItems, getNet, toast } from '../../net';
import { platform } from '../../platform';
import { Bar } from '../../ui/bits';
import { Empty, FloatBurst, ItemChips, Skeleton, fmtLeft, fmtNum, useNow } from '../../ui/social';
import { Art, Glyph } from '../../ui/art';

const DONATE = [100, 500, 1000];
/** açıklamanın sonundaki birim: '+%', '-%' ya da '+' */
const unitOf = (desc: string) => /[+-]%?$/.exec(desc)?.[0] ?? '';

/** Teknoloji: üyeler bağışlar, herkes yararlanır. Etki metni açık. */
export function TeamTech() {
  const extra = useNet((s) => s.extra); const wallet = useNet((s) => s.wallet);
  const [busy, setBusy] = useState(''); const [burst, setBurst] = useState<{ id: string; text: string } | null>(null);
  if (!extra) return <Skeleton rows={4} />;
  const donate = async (tech: string, jeton: number) => {
    setBusy(tech + jeton);
    const r = await act('team.donate', { tech: tech as never, jeton });
    setBusy('');
    if (r) { useNet.setState({ extra: r.extra, wallet: r.wallet }); platform().haptic('success'); setBurst({ id: tech, text: `+${fmtNum(jeton)} 🪙` }); }
  };
  return (
    <div className="stack">
      <div className="muted">Bağışlanan jeton teknolojiyi büyütür; etkisi <b>tüm üyelere</b> uygulanır. Her 10 jeton takıma 1 XP.</div>
      {TEAM_TECH.map((d) => { const st = extra.tech.find((t) => t.id === d.id) ?? { level: 0, progress: 0, cost: 0 }; const max = st.level >= d.maxLevel; return (
        <div className="card tech" key={d.id}>
          <div className="row">
            <span className="tech-i" aria-hidden><Glyph e={d.emoji} size={32} /></span>
            <div className="grow min0"><div className="row between"><b>{d.name}</b><span className="lvl-pill">Sv {st.level}/{d.maxLevel}</span></div>
              <div className="tech-eff">{d.desc}{st.level * d.perLevel}</div>
              {!max && <div className="muted small-note">Sv {st.level + 1}: {unitOf(d.desc)}{(st.level + 1) * d.perLevel}</div>}
            </div>
          </div>
          {!max ? <>
            <div className="row qbar"><Bar value={st.progress / Math.max(1, st.cost)} tone="amber" label={`${d.name} ilerlemesi`} /><span className="qn">{fmtNum(st.progress)}/{fmtNum(st.cost)}</span></div>
            <div className="donate-row">{DONATE.map((n) => <button key={n} className="btn ghost small" disabled={!wallet || wallet.jeton < n || busy === d.id + n} onClick={() => void donate(d.id, n)}><Art e="🪙" size="1.15em" className="art-inline" /> {fmtNum(n)}</button>)}</div>
          </> : <div className="muted">En yüksek seviye. Harika iş!</div>}
          {burst?.id === d.id && <FloatBurst text={burst.text} onDone={() => setBurst(null)} />}
        </div>); })}
    </div>
  );
}

/** Hediyeler: kimden, neden, içerik görünür, son süre; "Hepsini al". */
export function TeamGifts() {
  const extra = useNet((s) => s.extra); const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  if (!extra) return <Skeleton rows={3} />;
  const open = extra.gifts.filter((g) => !g.claimed && g.expiresAt > now);
  const rest = extra.gifts.filter((g) => g.claimed || g.expiresAt <= now);
  const claim = async (g: TeamGift): Promise<boolean> => {
    const c = getNet(); if (!c) return false;
    try { const r = await c.call('team.gift.claim', { giftId: g.id }); useNet.setState({ extra: r.extra, wallet: r.wallet, giftCount: r.extra.gifts.filter((x) => !x.claimed && x.expiresAt > Date.now()).length }); applyServerItems(g.contents); return true; }
    catch { return false; }
  };
  const one = async (g: TeamGift) => { setBusy(true); if (await claim(g)) { platform().haptic('success'); toast('🎁', 'Hediye alındı', g.contents.map((c) => `${c.kind === 'kristal' ? '💎' : c.kind === 'jeton' ? '🪙' : '🎁'} ${c.amount}`).join(' · '), 'gold'); } setBusy(false); };
  const all = async () => {
    setBusy(true); let n = 0;
    for (const g of open) if (await claim(g)) n++;
    setBusy(false);
    if (n) { platform().haptic('success'); toast('🎁', `${n} hediye alındı`, 'Hepsi cüzdanında.', 'gold'); }
  };
  return (
    <div className="stack">
      {open.length > 0 && <button className="btn" disabled={busy} onClick={() => void all()}><Art e="🎁" size="1.15em" className="art-inline" /> Hepsini al ({open.length})</button>}
      {open.length === 0 && <Empty icon="🎁" title="Bekleyen hediye yok" text="Takım hedefleri, baskın zaferleri ve takım arkadaşlarının paketleri buraya düşer. İçerikleri hep önceden yazılı." />}
      {open.map((g) => (
        <div className="card gift" key={g.id}>
          <span className="gift-i" aria-hidden><Art e="🎁" size="1.15em" className="art-inline" /></span>
          <div className="grow min0"><b className="wrap">{g.reason}</b><div className="muted">{g.from === 'sistem' ? g.fromName : `${g.fromName} gönderdi`} · <Art name="hourglass" size="1.1em" className="art-inline" /> {fmtLeft(g.expiresAt - now)}</div><ItemChips items={g.contents} small /></div>
          <button className="btn small" disabled={busy} onClick={() => void one(g)}>Al</button>
        </div>))}
      {rest.length > 0 && <><div className="muted section-head">Son 7 gün</div>{rest.map((g) => (
        <div className="card gift done" key={g.id}><span className="gift-i" aria-hidden><Art name={g.claimed ? 'check' : 'hourglass'} size={30} /></span><div className="grow min0"><b className="wrap">{g.reason}</b><div className="muted">{g.claimed ? 'Alındı' : 'Süresi doldu'}</div><ItemChips items={g.contents} small /></div></div>))}</>}
    </div>
  );
}

const METRIC = { yildiz: { icon: '⭐', unit: 'yıldız' }, bolum: { icon: '🗺️', unit: 'bölüm' }, baskin: { icon: '👹', unit: 'hasar' } } as const;

/** Hedefler: haftalık 3 hedef, kademe çubukları, ödül önizlemesi, alınabilir kademeler. */
export function TeamGoals() {
  const extra = useNet((s) => s.extra); const now = useNow(30_000);
  const [busy, setBusy] = useState('');
  if (!extra) return <Skeleton rows={3} />;
  const claim = async (goalId: string, tier: number) => {
    setBusy(`${goalId}:${tier}`);
    const r = await act('team.goal.claim', { goalId, tier });
    setBusy('');
    if (r) { useNet.setState({ extra: r.extra, wallet: r.wallet }); platform().haptic('success'); toast('🎯', 'Kademe ödülü alındı', undefined, 'gold'); }
  };
  const ends = extra.goals[0]?.endsAt ?? 0;
  return (
    <div className="stack">
      <div className="muted">Bu haftanın takım hedefleri · bitişe {fmtLeft(ends - now)}. Herkesin bölümü sayılır; kademe dolunca ödül tüm üyelere düşer.</div>
      {extra.goals.map((g) => { const m = METRIC[g.metric]; const top = g.tiers[g.tiers.length - 1]!.need; return (
        <div className="card goal" key={g.id}>
          <div className="row between"><b><Glyph e={m.icon} size="1.2em" /> {g.name}</b><span className="qn">{fmtNum(g.progress)}/{fmtNum(top)} {m.unit}</span></div>
          <div className="goal-track"><Bar value={g.progress / top} tone="green" label={g.name} />{g.tiers.map((t, i) => <i key={i} className={`tick${g.progress >= t.need ? ' hit' : ''}`} style={{ left: `${(t.need / top) * 100}%` }} />)}</div>
          <div className="tiers">
            {g.tiers.map((t, i) => { const reached = g.progress >= t.need; const claimed = g.claimedTiers.includes(i); return (
              <div className={`tier${reached ? ' hit' : ''}${claimed ? ' claimed' : ''}`} key={i}>
                <span className="t-need">{i + 1}. kademe · {fmtNum(t.need)}</span>
                <ItemChips items={t.reward} small />
                {reached && !claimed ? <button className="btn small" disabled={busy === `${g.id}:${i}`} onClick={() => void claim(g.id, i)}>Al</button> : <span className="t-state">{claimed ? <Art name="check" size={22} /> : reached ? '' : <Art name="lock" size={22} />}</span>}
              </div>); })}
          </div>
        </div>); })}
    </div>
  );
}
