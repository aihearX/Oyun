import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import { BUILDINGS, buildCost, crystalsToFinish, type BuildingDef, type BuildingState, type CampState } from '@odi/shared';
import { act, getNet, toast, useSocial } from '../net';
import { platform } from '../platform';
import { Bar } from '../ui/bits';
import { FloatBurst, Online, Sheet, TopBar, fmtDur, fmtLeft, fmtNum, useNow } from '../ui/social';

const DEPOT_RATE = 20; const DEPOT_CAP_H = 8;
function effect(id: BuildingDef['id'], l: number): string {
  switch (id) {
    case 'merkez': return `Diğer binalar en çok Sv ${l}`;
    case 'laboratuvar': return `Bölüm jetonu +%${l * 3}`;
    case 'atolye': return `Bölüm başında kalkan şansı %${l * 4}`;
    case 'depo': return l ? `${l * DEPOT_RATE} jeton/saat (8 saatte dolar)` : 'Pasif jeton üretimi yok';
    case 'kule': return `Savaş puanı +%${l * 2}`;
    case 'revir': return `İlk hasarı yok sayma şansı %${l * 3}`;
  }
}
const asked = new Set<string>();
const ITEMS = [{ k: 'm5', label: '5 dk', sec: 300 }, { k: 'm60', label: '60 dk', sec: 3600 }, { k: 's8', label: '8 sa', sec: 28_800 }] as const;

/** Kulak Kampı: binalar, canlı geri sayım, takımdan yardım, hızlandırıcılar, kristalle bitirme, depo. */
export function CampScreen() {
  return (
    <div className="screen fade-in with-tabs">
      <TopBar title="Kamp" />
      <Online what="Kulak Kampı">
        <Camp />
      </Online>
    </div>
  );
}

function Camp() {
  const camp = useNet((s) => s.camp); const wallet = useNet((s) => s.wallet); const team = useNet((s) => s.team); const extra = useNet((s) => s.extra);
  const fast = team ? (extra?.tech.find((t) => t.id === 'insaat')?.level ?? 0) * 2 : 0;
  const dur = (sec: number) => Math.max(1, Math.round(sec * (1 - fast / 100)));
  const bonuses = useSocial((s) => s.bonuses);
  const now = useNow(); const net = getNet(); const sNow = now + (net ? net.serverNow() - Date.now() : 0);
  const [confirm, setConfirm] = useState<BuildingDef | null>(null);
  const [party, setParty] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const prev = useRef<CampState | null>(null);

  useEffect(() => { void net?.call('camp.state', {}).then((r) => useNet.setState({ camp: r.camp, wallet: r.wallet })).catch(() => undefined); }, []);
  // inşaat bitince kutlama
  useEffect(() => {
    if (camp && prev.current) for (const b of camp.buildings) { const o = prev.current.buildings.find((x) => x.id === b.id); if (o && b.level > o.level) { const d = BUILDINGS.find((x) => x.id === b.id)!; setParty(`${d.emoji} ${d.name} ${b.level}. seviye!`); platform().haptic('success'); } }
    prev.current = camp;
  }, [camp]);
  // süre dolunca sunucudan tazele (5 sn'lik zamanlayıcıyı beklemeden)
  const active = camp?.buildings.find((b) => b.upgradingTo && b.endsAt);
  useEffect(() => { if (active?.endsAt && active.endsAt <= sNow + 500) { const h = setTimeout(() => void net?.call('camp.state', {}).then((r) => useNet.setState({ camp: r.camp })).catch(() => undefined), 800); return () => clearTimeout(h); } }, [active?.endsAt, Math.floor(sNow / 1000)]);

  if (!camp || !wallet) return null;
  const lv = (id: string) => camp.buildings.find((b) => b.id === id)?.level ?? 0;
  const merkez = lv('merkez'); const depot = lv('depo');
  const stored = depot ? Math.floor((Math.min(Math.max(0, sNow - camp.depotStoredAt), DEPOT_CAP_H * 3_600_000) / 3_600_000) * depot * DEPOT_RATE) : 0;
  const depotMax = depot * DEPOT_RATE * DEPOT_CAP_H;

  const upgrade = async (d: BuildingDef) => { setConfirm(null); const r = await act('camp.upgrade', { id: d.id }); if (r) { useNet.setState({ camp: r.camp, wallet: r.wallet }); platform().haptic('medium'); toast('🏗️', `${d.name} inşaatı başladı`, team ? 'Takımından yardım iste, süre kısalsın.' : undefined); } };
  const collect = async () => { const r = await act('camp.collect', {}); if (r) { useNet.setState({ camp: r.camp, wallet: r.wallet }); if (r.collected) { platform().haptic('success'); setBurst(`+${fmtNum(r.collected)} 🪙`); } } };

  return (
    <div className="stack">
      {active && <Construction b={active} camp={camp} sNow={sNow} />}
      {!active && (() => { const can = BUILDINGS.some((d) => { const b = camp.buildings.find((x) => x.id === d.id)!; const to = b.level + 1; return to <= d.maxLevel && (d.id === 'merkez' || to <= merkez) && buildCost(d.id, to).jeton <= wallet.jeton; }); return (
        <div className="card idle-card"><span aria-hidden>👷</span><div className="grow min0"><b>İnşaatçı boşta</b><div className="muted">{can ? 'Bir bina seç ve yükselt. Aynı anda bir inşaat yapılır.' : 'Yükseltme için jeton biriktir: bölüm oyna, görevleri bitir, takım hediyelerini al.'}</div></div></div>); })()}

      {depot > 0 && (
        <div className="card depot">
          <div className="row between"><b>📦 Kulak Deposu</b><span className="qn">{fmtNum(stored)}/{fmtNum(depotMax)}</span></div>
          <div className="row qbar"><Bar value={depotMax ? stored / depotMax : 0} tone={stored >= depotMax ? 'coral' : 'amber'} label="Depo doluluğu" /><button className="btn small" disabled={stored < 1} onClick={() => void collect()}>Topla</button></div>
          <div className="muted small-note">{stored >= depotMax ? 'Depo dolu! Topla ki üretim sürsün.' : `Saatte ${depot * DEPOT_RATE} jeton · ${fmtDur(((depotMax - stored) / (depot * DEPOT_RATE)) * 3600)} sonra dolar`}</div>
          {burst && <FloatBurst text={burst} onDone={() => setBurst(null)} />}
        </div>
      )}

      {bonuses && Object.values(bonuses).some((v) => v > 0) && (
        <div className="card bonus-card" aria-label="Kamp ve takım etkileri">
          <span className="muted small-note">Kamp + takım etkilerin</span>
          <div className="bonus-row">
            <span><b>+%{bonuses.coinPct}</b>🪙 jeton</span><span><b>%{bonuses.shieldChancePct}</b>🛡️ kalkan</span><span><b>%{bonuses.firstHitIgnorePct}</b>💚 revir</span><span><b>+%{bonuses.warPct}</b>⚔️ savaş</span><span><b>+%{bonuses.raidPct}</b>👹 baskın</span>
          </div>
        </div>)}

      {BUILDINGS.map((d) => { const b = camp.buildings.find((x) => x.id === d.id)!; const to = b.level + 1; const cost = buildCost(d.id, to); const max = b.level >= d.maxLevel;
        const blocked = d.id !== 'merkez' && to > merkez; const busy = !!active; const poor = wallet.jeton < cost.jeton;
        return (
          <div className={`card building${b.upgradingTo ? ' building-now' : ''}`} key={d.id}>
            <div className="row">
              <span className="b-i" aria-hidden>{d.emoji}</span>
              <div className="grow min0"><div className="row between"><b>{d.name}</b><span className="lvl-pill">Sv {b.level}</span></div><div className="muted">{effect(d.id, b.level)}</div></div>
            </div>
            {!max && <div className="row b-up">
              <span className="muted grow">Sv {to}: {effect(d.id, to)}<br />🪙 {fmtNum(cost.jeton)} · ⏱ {fmtDur(dur(cost.seconds))}</span>
              <button className="btn small" disabled={busy || blocked || poor} onClick={() => setConfirm(d)}>{b.upgradingTo ? 'Yapılıyor' : blocked ? `Merkez ${to}` : 'Yükselt'}</button>
            </div>}
            {max && <div className="muted">En yüksek seviye.</div>}
          </div>); })}

      {confirm && (() => { const b = camp.buildings.find((x) => x.id === confirm.id)!; const c = buildCost(confirm.id, b.level + 1); return (
        <Sheet title={`${confirm.emoji} ${confirm.name} → Sv ${b.level + 1}`} onClose={() => setConfirm(null)}>
          <div className="muted">{effect(confirm.id, b.level + 1)}</div>
          <div className="chips"><span className="chip">🪙 {fmtNum(c.jeton)}</span><span className="chip">⏱ {fmtDur(dur(c.seconds))}</span>{fast > 0 && <span className="chip">🏗️ takım −%{fast}</span>}</div>
          <button className="btn" onClick={() => void upgrade(confirm)}>Yükselt</button>
          <button className="btn ghost" onClick={() => setConfirm(null)}>Vazgeç</button>
        </Sheet>); })()}
      {party && <div className="overlay" onClick={() => setParty(null)}><div className="card reward-pop" role="dialog" aria-label="İnşaat bitti"><div className="rp-burst" aria-hidden>🎉</div><h2>İnşaat bitti!</h2><div className="muted">{party}</div><button className="btn" onClick={() => setParty(null)}>Harika</button></div></div>}
    </div>
  );
}

function Construction({ b, camp, sNow }: { b: BuildingState; camp: CampState; sNow: number }) {
  const wallet = useNet((s) => s.wallet)!; const team = useNet((s) => s.team);
  const d = BUILDINGS.find((x) => x.id === b.id)!;
  const left = Math.max(0, (b.endsAt ?? 0) - sNow); const total = Math.max(1, (b.endsAt ?? 0) - (b.startedAt ?? 0));
  const leftSec = Math.ceil(left / 1000); const crystals = crystalsToFinish(leftSec);
  const key = `${b.id}:${b.upgradingTo}:${camp.serverTime > 0 ? b.startedAt : 0}`;
  const [isAsked, setAsked] = useState(asked.has(key));
  const speed = async (item: 'm5' | 'm60' | 's8' | 'kristal') => { const r = await act('camp.speedup', { id: b.id, item, count: 1 }); if (r) { useNet.setState({ camp: r.camp, wallet: r.wallet }); platform().haptic('light'); } };
  const ask = async () => { const r = await act('camp.help.request', { id: b.id }); if (r) { useNet.setState({ camp: r.camp }); asked.add(key); setAsked(true); toast('🙋', 'Takımına haber verildi', 'Her yardım süreyi kısaltır.', 'green'); } };
  return (
    <div className="card construction">
      <div className="row"><span className="b-i big" aria-hidden>{d.emoji}</span><div className="grow min0"><b>{d.name} → Sv {b.upgradingTo}</b><div className="countdown big-count" aria-live="off">{fmtLeft(left)}</div></div></div>
      <Bar value={1 - left / total} tone="accent" label="İnşaat ilerlemesi" />
      {team ? <button className="btn ghost" disabled={isAsked} onClick={() => void ask()}>{isAsked ? `🙋 Yardım istendi · ${b.helpsReceived} yardım` : `🙋 Takımdan yardım iste${b.helpsReceived ? ` · ${b.helpsReceived} yardım` : ''}`}</button>
        : <div className="muted small-note">Bir takıma katılırsan arkadaşların inşaatını tek dokunuşla hızlandırabilir.</div>}
      <div className="speed-row">
        {ITEMS.map((it) => <button key={it.k} className="btn ghost small" disabled={wallet.hizlandirici[it.k] < 1} onClick={() => void speed(it.k)}>⏩ {it.label}<i className="cnt">×{wallet.hizlandirici[it.k]}</i></button>)}
      </div>
      <button className="btn ghost small finish" disabled={wallet.kristal < crystals} onClick={() => void speed('kristal')}>💎 {crystals} kristalle hemen bitir</button>
      <div className="muted small-note">Kristal: kalan her dakika için 1 (sende 💎 {fmtNum(wallet.kristal)}).</div>
    </div>
  );
}
