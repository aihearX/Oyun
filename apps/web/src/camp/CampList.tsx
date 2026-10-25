import { useState } from 'react';
import { BUILDINGS, buildCost, crystalsToFinish, type BuildingDef, type BuildingState, type CampState, type QueuedBuild, type Wallet } from '@odi/shared';
import { depotStored } from '@odi/game-core/lite';
import { depotCapHours } from '@odi/content';
import { CampLevelChip, CampLevelPanel } from './KampSeviye';
import { Bar } from '../ui/bits';
import { FloatBurst, Sheet, fmtDur, fmtLeft, fmtNum } from '../ui/social';
import { DEPOT_RATE, ITEMS, askedHelp, buildKey, canQueue, effect, queueSupported, shortOf, type CampActions } from './model';
import { useKg } from './gorev/state';
import { KgIcon } from './gorev/art';
import { hikayeBinasi } from './hikaye-bina';
import { TedaviPanel } from './TedaviPanel';
import { DedeCard } from './dede';
import { Art, rich, Glyph } from '../ui/art';
import { GorevChips, GorevHost } from './gorev/Kanca';

/** Liste görünümü (erişilebilirlik): binalar, canlı geri sayım, takımdan yardım, hızlandırıcılar, kristalle bitirme, depo. */
export function CampList({ camp, wallet, team, fast, sNow, actions, bonuses }: {
  camp: CampState; wallet: Wallet; team: boolean; fast: number; sNow: number; actions: CampActions;
  bonuses: { coinPct: number; shieldChancePct: number; firstHitIgnorePct: number; warPct: number; raidPct: number } | null;
}) {
  const [confirm, setConfirm] = useState<BuildingDef | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const dur = (sec: number) => Math.max(1, Math.round(sec * (1 - fast / 100)));
  const active = camp.buildings.find((b) => b.upgradingTo && b.endsAt);
  const lv = (id: string) => camp.buildings.find((b) => b.id === id)?.level ?? 0;
  const merkez = lv('merkez'); const depot = lv('depo');
  const { stored, max: depotMax } = depotStored(depot, camp.depotStoredAt, sNow, depotCapHours(lv('denge')));
  const [levelPanel, setLevelPanel] = useState(false);
  const upgrade = async (d: BuildingDef) => { setConfirm(null); if (active && queueSupported(camp)) await actions.queue(d.id); else await actions.upgrade(d.id); };
  const qOn = !!active && queueSupported(camp);
  const story = hikayeBinasi(useKg((st) => st.kg)); // hikâyenin istediği bina (MK-016)
  const collect = async () => { const n = await actions.collect(); if (n) setBurst(`+${fmtNum(n)} 🪙`); };

  return (
    <div className="stack">
      <DedeCard className="dede-list" />
      <div className="kg-list-chips"><GorevChips /></div>
      <GorevHost />
      {camp.xp && <div className="card ks-card"><CampLevelChip xp={camp.xp} onOpen={() => setLevelPanel(true)} /></div>}
      {levelPanel && <CampLevelPanel camp={camp} onClose={() => setLevelPanel(false)} />}
      {active && <Construction b={active} sNow={sNow} wallet={wallet} team={team} actions={actions} queued={camp.queued ?? null} />}
      {!active && (() => { const can = BUILDINGS.some((d) => { const b = camp.buildings.find((x) => x.id === d.id)!; const to = b.level + 1; return to <= d.maxLevel && (d.id === 'merkez' || to <= merkez) && buildCost(d.id, to).jeton <= wallet.jeton; }); return (
        <div className="card idle-card"><span aria-hidden><Art e="👷" size="1.15em" className="art-inline" /></span><div className="grow min0"><b>İnşaatçı boşta</b><div className="muted">{can ? 'Bir bina seç ve yükselt. Aynı anda bir inşaat yapılır.' : 'Yükseltme için jeton biriktir: bölüm oyna, görevleri bitir, takım hediyelerini al.'}</div></div></div>); })()}

      {depot > 0 && (
        <div className="card depot">
          <div className="row between"><b><Art e="📦" size="1.15em" className="art-inline" /> Kulak Deposu</b><span className="qn">{fmtNum(stored)}/{fmtNum(depotMax)}</span></div>
          <div className="row qbar"><Bar value={depotMax ? stored / depotMax : 0} tone={stored >= depotMax ? 'coral' : 'amber'} label="Depo doluluğu" /><button className="btn small" disabled={stored < 1} onClick={() => void collect()}>Topla</button></div>
          <div className="muted small-note">{stored >= depotMax ? 'Depo dolu! Topla ki üretim sürsün.' : `Saatte ${depot * DEPOT_RATE} jeton · ${fmtDur(((depotMax - stored) / (depot * DEPOT_RATE)) * 3600)} sonra dolar`}</div>
          {burst && <FloatBurst text={burst} onDone={() => setBurst(null)} />}
        </div>
      )}

      {bonuses && Object.values(bonuses).some((v) => v > 0) && (
        <div className="card bonus-card" aria-label="Kamp ve takım etkileri">
          <span className="muted small-note">Kamp + takım etkilerin</span>
          <div className="bonus-row">
            <span><b>+%{bonuses.coinPct}</b><Art e="🪙" size="1.15em" className="art-inline" /> jeton</span><span><b>%{bonuses.shieldChancePct}</b><Art e="🛡️" size="1.15em" className="art-inline" /> kalkan</span><span><b>%{bonuses.firstHitIgnorePct}</b><Art e="💚" size="1.15em" className="art-inline" /> klinik</span><span><b>+%{bonuses.warPct}</b><Art e="⚔️" size="1.15em" className="art-inline" /> savaş</span><span><b>+%{bonuses.raidPct}</b><Art e="👹" size="1.15em" className="art-inline" /> baskın</span>
          </div>
        </div>)}

      {BUILDINGS.map((d) => { const b = camp.buildings.find((x) => x.id === d.id)!; const to = b.level + 1; const cost = buildCost(d.id, to); const max = b.level >= d.maxLevel;
        const blocked = d.id !== 'merkez' && to > merkez; const busy = !!active; const poor = wallet.jeton < cost.jeton; const locked = !!d.campLevel && (camp.xp?.level ?? 1) < d.campLevel;
        const inQueue = camp.queued?.id === d.id; const qv = qOn && !b.upgradingTo ? canQueue(camp, wallet, d.id) : null;
        return (
          <div className={`card building${b.upgradingTo ? ' building-now' : ''}${inQueue ? ' building-queued' : ''}`} key={d.id}>
            <div className="row">
              <span className="b-i" aria-hidden><Glyph e={d.emoji} size={32} /></span>
              <div className="grow min0"><div className="row between"><b>{d.name}</b><span className="lvl-pill">Sv {b.level}</span></div><div className="muted">{effect(d.id, b.level)}</div><div className="b-desc">{d.desc}</div></div>
            </div>
            {!max && <div className="row b-up">
              <span className="muted grow">Sv {to}: {effect(d.id, to)}<br /><Art e="🪙" size="1.15em" className="art-inline" /> {fmtNum(cost.jeton)} · <Art name="timer" size="1.15em" className="art-inline" /> {fmtDur(dur(cost.seconds))}</span>
              {inQueue ? <button className="btn small ghost" onClick={() => void actions.unqueue()} aria-label={`${d.name} sırada; sıradan çıkar, ${fmtNum(camp.queued!.jeton)} jeton geri`}>Sıradan çıkar</button>
                : qv ? <button className="btn small" disabled={!qv.ok} onClick={() => setConfirm(d)}>{qv.ok ? 'Sıraya al' : qv.short}</button>
                : <button className="btn small" disabled={busy || blocked || poor || locked} onClick={() => setConfirm(d)}>{b.upgradingTo ? 'Yapılıyor' : locked ? `Kamp Sv ${d.campLevel}` : blocked ? `Merkez ${to}` : b.level === 0 ? 'Kur' : 'Yükselt'}</button>}
            </div>}
            {story && story.id === d.id && b.level < story.need && <div className="muted small-note" data-testid="hikaye-ipucu"><KgIcon name="bolum" size={16} className="art-inline" /> Kampın Hikâyesi bu binayı Sv {story.need} istiyor</div>}
            {inQueue && <div className="muted small-note"><Art name="hourglass" size={16} className="art-inline" /> Sırada: Sv {camp.queued!.toLevel} · {active ? `${shortOf(active.id)} bitince başlar` : 'birazdan başlar'} · bedel ödendi</div>}
            {max && <div className="muted">En yüksek seviye.</div>}
            {d.id === 'tedavi' && b.level > 0 && <TedaviPanel camp={camp} sNow={sNow} actions={actions} compact />}
          </div>); })}

      {confirm && (() => { const b = camp.buildings.find((x) => x.id === confirm.id)!; const c = buildCost(confirm.id, b.level + 1); return (
        <Sheet title={`${confirm.emoji} ${confirm.name} → Sv ${b.level + 1}`} onClose={() => setConfirm(null)}>
          <div className="muted">{effect(confirm.id, b.level + 1)}</div>
          <div className="chips"><span className="chip"><Art e="🪙" size="1.15em" className="art-inline" /> {fmtNum(c.jeton)}</span><span className="chip"><Art e="⏱" size="1.15em" className="art-inline" /> {fmtDur(dur(c.seconds))}</span>{fast > 0 && <span className="chip"><Art e="🏗️" size="1.15em" className="art-inline" /> takım −%{fast}</span>}</div>
          {qOn && <div className="muted small-note">{shortOf(active!.id)} bitince kendiliğinden başlar. Bedel şimdi ödenir; sıradan çıkarırsan tamamı geri gelir.</div>}
          <button className="btn" onClick={() => void upgrade(confirm)}>{qOn ? 'Sıraya al' : 'Yükselt'}</button>
          <button className="btn ghost" onClick={() => setConfirm(null)}>Vazgeç</button>
        </Sheet>); })()}
    </div>
  );
}

export function Construction({ b, sNow, wallet, team, actions, queued }: { b: BuildingState; sNow: number; wallet: Wallet; team: boolean; actions: CampActions; queued?: QueuedBuild | null }) {
  const d = BUILDINGS.find((x) => x.id === b.id)!;
  const left = Math.max(0, (b.endsAt ?? 0) - sNow); const total = Math.max(1, (b.endsAt ?? 0) - (b.startedAt ?? 0));
  const crystals = crystalsToFinish(Math.ceil(left / 1000));
  const key = buildKey(b);
  const [isAsked, setAsked] = useState(askedHelp.has(key));
  const ask = async () => { if (await actions.ask(b.id)) setAsked(true); };
  return (
    <div className="card construction">
      <div className="row"><span className="b-i big" aria-hidden><Glyph e={d.emoji} size={40} /></span><div className="grow min0"><b>{d.name} → Sv {b.upgradingTo}</b><div className="countdown big-count" aria-live="off">{fmtLeft(left)}</div></div></div>
      <Bar value={1 - left / total} tone="accent" label="İnşaat ilerlemesi" />
      {team ? <button className="btn ghost" disabled={isAsked} onClick={() => void ask()}>{rich(isAsked ? `🙋 Yardım istendi · ${b.helpsReceived} yardım` : `🙋 Takımdan yardım iste${b.helpsReceived ? ` · ${b.helpsReceived} yardım` : ''}`)}</button>
        : <div className="muted small-note">Bir takıma katılırsan arkadaşların inşaatını tek dokunuşla hızlandırabilir.</div>}
      <div className="speed-row">
        {ITEMS.map((it) => <button key={it.k} className="btn ghost small" disabled={wallet.hizlandirici[it.k] < 1} onClick={() => void actions.speed(b.id, it.k)}><Art e="⏩" size="1.15em" className="art-inline" /> {it.label}<i className="cnt">×{wallet.hizlandirici[it.k]}</i></button>)}
      </div>
      <button className="btn ghost small finish" disabled={wallet.kristal < crystals} onClick={() => void actions.speed(b.id, 'kristal')}><Art e="💎" size="1.15em" className="art-inline" /> {crystals} kristalle hemen bitir</button>
      <div className="muted small-note">Kristal: kalan her dakika için 1 (sende <Art name="crystal" size="1.15em" className="art-inline" /> {fmtNum(wallet.kristal)}).</div>
      {queued && <div className="row q-line" data-testid="sirada-sonraki"><Art name="hourglass" size={18} className="art-inline" /><span className="grow min0">Sırada: <b>{shortOf(queued.id)} Sv {queued.toLevel}</b> · bu bitince başlar</span><button className="btn ghost small" onClick={() => void actions.unqueue()}>Sıradan çıkar</button></div>}
    </div>
  );
}
