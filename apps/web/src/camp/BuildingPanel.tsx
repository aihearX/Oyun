import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildCost, crystalsToFinish, type BuildingId, type CampState, type Wallet } from '@odi/shared';
import { CAMP_TIER_NAMES, buildingCanvas, depotStored, tierOf } from '@odi/game-core';
import { audio } from '@odi/audio';
import { fmtDur, fmtLeft, fmtNum } from '../ui/social';
import { DEPOT_RATE, ITEMS, askedHelp, buildKey, canUpgrade, defOf, effect, type CampActions } from './model';

/** binanın görünümü (önbellekli küçük resim) */
const thumbs = new Map<string, string>();
export function BuildingThumb({ id, level, size = 84 }: { id: BuildingId; level: number; size?: number }) {
  const src = useMemo(() => {
    const k = `${id}:${level}`; const hit = thumbs.get(k); if (hit) return hit;
    try { const { canvas } = buildingCanvas(id, level, 1.4); const url = canvas.toDataURL('image/png'); thumbs.set(k, url); return url; } catch { return ''; }
  }, [id, level]);
  return src ? <img className="bp-thumb" src={src} alt="" style={{ height: size }} aria-hidden /> : null;
}

/** Bina paneli: ad, seviye, etki (şimdi → sonraki), maliyet/süre, Yükselt (yetersizse nedeni), inşaat eylemleri, depo toplama. */
export function BuildingPanel({ id, camp, wallet, team, fast, sNow, actions, onClose }: {
  id: BuildingId; camp: CampState; wallet: Wallet; team: boolean; fast: number; sNow: number; actions: CampActions; onClose: () => void;
}) {
  const d = defOf(id); const b = camp.buildings.find((x) => x.id === id)!;
  const to = b.level + 1; const max = b.level >= d.maxLevel;
  const cost = buildCost(id, Math.min(to, d.maxLevel)); const seconds = Math.max(1, Math.round(cost.seconds * (1 - fast / 100)));
  const verdict = canUpgrade(camp, wallet, id);
  const building = !!(b.upgradingTo && b.endsAt);
  const left = Math.max(0, (b.endsAt ?? 0) - sNow); const total = Math.max(1, (b.endsAt ?? 0) - (b.startedAt ?? 0));
  const crystals = crystalsToFinish(Math.ceil(left / 1000));
  const [asked, setAsked] = useState(() => askedHelp.has(buildKey(b)));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAsked(askedHelp.has(buildKey(b))); }, [b.upgradingTo, b.startedAt]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const run = async (f: () => Promise<unknown>) => { if (busy) return; setBusy(true); audio.play('tap'); try { await f(); } finally { setBusy(false); } };
  const tierNext = !max && tierOf(to) !== tierOf(b.level);
  const depot = id === 'depo' && b.level > 0 ? depotStored(b.level, camp.depotStoredAt, sNow) : null;

  // üs görünümü sabit konumlu bir katman: panel sekme çubuğunun üstünde kalsın diye body'ye taşınır
  return createPortal(
    <div className="bp-wrap" onClick={onClose}>
      <div className="bp" role="dialog" aria-label={`${d.name} paneli`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="bp-head">
          <BuildingThumb id={id} level={b.level} />
          <div className="grow min0">
            <h2>{d.name}</h2>
            <div className="bp-lv"><span className={`bp-tier t${Math.max(0, tierOf(b.level))}`}>{b.level > 0 ? `Sv ${b.level} · ${CAMP_TIER_NAMES[tierOf(b.level)]}` : 'Kurulmadı'}</span><span className="bp-max">en çok Sv {d.maxLevel}</span></div>
            <div className="bp-desc">{d.desc}</div>
          </div>
          <button className="bp-x" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div className="bp-eff">
          <div><small>Şimdi</small><b>{effect(id, b.level)}</b></div>
          {!max && <><span aria-hidden>→</span><div className="next"><small>Sv {to}</small><b>{effect(id, to)}</b></div></>}
        </div>

        {depot && (
          <div className="bp-depot">
            <div className="row between"><b>Depoda</b><span className="qn">🪙 {fmtNum(depot.stored)} / {fmtNum(depot.max)}</span></div>
            <div className="bp-bar"><i style={{ width: `${Math.round(depot.ratio * 100)}%` }} className={depot.ratio >= 1 ? 'full' : ''} /></div>
            <div className="row between"><span className="bp-note">{depot.ratio >= 1 ? 'Depo dolu! Topla ki üretim sürsün.' : `Saatte ${b.level * DEPOT_RATE} jeton`}</span>
              <button className="btn small gold" disabled={busy || depot.stored < 1} onClick={() => void run(async () => { await actions.collect(); })}>Topla{depot.stored >= 1 ? ` +${fmtNum(depot.stored)}` : ''}</button></div>
          </div>
        )}

        {building ? (
          <div className="bp-build">
            <div className="row between"><b>🏗️ Sv {b.upgradingTo} yapılıyor</b><span className="countdown big-count" aria-live="off">{left > 0 ? fmtLeft(left) : 'Bitiyor…'}</span></div>
            <div className="bp-bar"><i style={{ width: `${Math.round((1 - left / total) * 100)}%` }} /></div>
            {team
              ? <button className="btn help" disabled={busy || asked} onClick={() => void run(async () => { if (await actions.ask(id)) setAsked(true); })}>{asked ? `🙋 Yardım istendi · ${b.helpsReceived} yardım` : `🙋 Takımdan yardım iste${b.helpsReceived ? ` · ${b.helpsReceived} yardım` : ''}`}</button>
              : <div className="bp-note">Bir takıma katılırsan arkadaşların inşaatını tek dokunuşla hızlandırabilir.</div>}
            <div className="speed-row">
              {ITEMS.map((it) => <button key={it.k} className="btn ghost small" disabled={busy || wallet.hizlandirici[it.k] < 1} onClick={() => void run(() => actions.speed(id, it.k))}>⏩ {it.label}<i className="cnt">×{wallet.hizlandirici[it.k]}</i></button>)}
            </div>
            <button className="btn finish" disabled={busy || wallet.kristal < crystals} onClick={() => void run(() => actions.speed(id, 'kristal'))}>💎 {crystals} ile bitir</button>
            <div className="bp-note">Kristal: kalan her dakika için 1 (sende 💎 {fmtNum(wallet.kristal)}).</div>
          </div>
        ) : max ? <div className="bp-note">En yüksek seviyede. Tebrikler!</div> : (
          <div className="bp-up">
            <div className="chips"><span className="chip">🪙 {fmtNum(cost.jeton)}</span><span className="chip">⏱ {fmtDur(seconds)}</span>{fast > 0 && <span className="chip">🏗️ takım −%{fast}</span>}</div>
            {tierNext && <div className="bp-next"><BuildingThumb id={id} level={to} size={58} /><span><b>Sv {to}: yeni görünüm!</b><br />{CAMP_TIER_NAMES[tierOf(to)]} {b.level === 0 ? 'yapı kurulur' : 'malzemeyle büyür'}</span></div>}
            <button className="btn" disabled={busy || !verdict.ok} onClick={() => void run(() => actions.upgrade(id))}>{b.level === 0 ? 'Kur' : 'Yükselt'}{verdict.ok ? ` → Sv ${to}` : ''}</button>
            {!verdict.ok && <div className="bp-why" role="status">{verdict.reason}</div>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
