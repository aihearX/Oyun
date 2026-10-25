import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CAMP_POWER_LEVEL, buildCost, crystalsToFinish, type BuildingId, type CampState, type Wallet } from '@odi/shared';
import { CAMP_TIER_NAMES, buildingCanvas, depotStored, tierOf } from '@odi/game-core/lite';
import { audio } from '@odi/audio';
import { fmtDur, fmtLeft, fmtNum } from '../ui/social';
import { DEPOT_RATE, ITEMS, POWER_BUILDINGS, activeOf, askedHelp, buildKey, canQueue, canUpgrade, defOf, effect, infoOf, queueSupported, shortOf, unlockLabel, type CampActions } from './model';
import { depotCapHours, libStored, nextCampUnlock, campUnlocksAt, type CampUnlock } from '@odi/content';
import { MoreLine } from '../ftue/Notes';
import { TedaviPanel } from './TedaviPanel';
import { RemedyIcon } from './remedyArt';
import { Art, rich } from '../ui/art';
import { Icon } from '../ui/icons';
import { KgBinaKanca } from './gorev/Kanca';

/** binanın görünümü (önbellekli küçük resim) */
const thumbs = new Map<string, string>();
export function BuildingThumb({ id, level, size = 84 }: { id: BuildingId; level: number; size?: number }) {
  const src = useMemo(() => {
    const k = `${id}:${level}`; const hit = thumbs.get(k); if (hit) return hit;
    try { const { canvas } = buildingCanvas(id, level, 1.4); const url = canvas.toDataURL('image/png'); thumbs.set(k, url); return url; } catch { return ''; }
  }, [id, level]);
  return src ? <img className="bp-thumb" src={src} alt="" style={{ height: size }} aria-hidden /> : null;
}

/** açılım çipi: kozmetik / sözlük / tarif / çanta yeri */
export function UnlockChip({ u }: { u: CampUnlock }) {
  const icon = u.kind === 'tarif' ? <RemedyIcon id={u.id} size={18} /> : <Art name={u.kind === 'kozmetik' ? 'hat' : u.kind === 'terim' ? 'bulb' : 'plus'} size={16} />;
  return <span className={`bp-unlock k-${u.kind}`} data-unlock={`${u.kind}:${'id' in u ? u.id : ''}`}>{icon}{unlockLabel(u)}</span>;
}
/** "Odyolojide": binanın gerçek işlevi (sade + Daha fazla) ve bu binanın sıradaki açılımı */
export function BuildingInfo({ id, level }: { id: BuildingId; level: number }) {
  const info = infoOf(id); const next = nextCampUnlock(id, level); const now = level > 0 ? campUnlocksAt(id, level) : [];
  return (
    <div className="bp-info" data-testid="bina-bilgi">
      <div className="bp-info-k"><Art name="ear" size={16} /> Odyolojide</div>
      <p>{info.plain}</p>
      <MoreLine text={info.tech} />
      {now.length > 0 && <div className="bp-unlocks"><small>Sv {level} ile açıldı</small>{now.map((u, i) => <UnlockChip key={i} u={u} />)}</div>}
      {next && <div className="bp-unlocks next"><small>Sv {next.level} açar</small>{next.items.map((u, i) => <UnlockChip key={i} u={u} />)}</div>}
    </div>
  );
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
  // inşaat sırası: başka bina yapılırken bu bina sıraya alınabilir (bedel peşin; süren bitince kendiliğinden başlar)
  const other = activeOf(camp); const inQueue = camp.queued?.id === id;
  const queueMode = queueSupported(camp) && !!other && other.id !== id;
  const qv = canQueue(camp, wallet, id);
  const left = Math.max(0, (b.endsAt ?? 0) - sNow); const total = Math.max(1, (b.endsAt ?? 0) - (b.startedAt ?? 0));
  const crystals = crystalsToFinish(Math.ceil(left / 1000));
  const [asked, setAsked] = useState(() => askedHelp.has(buildKey(b)));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAsked(askedHelp.has(buildKey(b))); }, [b.upgradingTo, b.startedAt]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const run = async (f: () => Promise<unknown>) => { if (busy) return; setBusy(true); audio.play('tap'); try { await f(); } finally { setBusy(false); } };
  const tierNext = !max && tierOf(to) !== tierOf(b.level);
  const depot = id === 'depo' && b.level > 0 ? depotStored(b.level, camp.depotStoredAt, sNow, depotCapHours(camp.buildings.find((x) => x.id === 'denge')?.level ?? 0)) : null;
  const lib = id === 'kutuphane' && b.level > 0 ? libStored(b.level, camp.libAt ?? 0, sNow) : null;

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
          <button className="bp-x" onClick={onClose} aria-label="Kapat"><Icon name="close" size="1.1em" className="ic-inline" /></button>
        </div>

        <div className="bp-eff">
          <div><small>Şimdi</small><b>{effect(id, b.level)}</b></div>
          {!max && <><span aria-hidden>→</span><div className="next"><small>Sv {to}</small><b>{effect(id, to)}</b></div></>}
        </div>

        {depot && (
          <div className="bp-depot">
            <div className="row between"><b>Depoda</b><span className="qn"><Art e="🪙" size="1.15em" className="art-inline" /> {fmtNum(depot.stored)} / {fmtNum(depot.max)}</span></div>
            <div className="bp-bar"><i style={{ width: `${Math.round(depot.ratio * 100)}%` }} className={depot.ratio >= 1 ? 'full' : ''} /></div>
            <div className="row between"><span className="bp-note">{depot.ratio >= 1 ? 'Depo dolu! Topla ki üretim sürsün.' : `Saatte ${b.level * DEPOT_RATE} jeton`}</span>
              <button className="btn small gold" disabled={busy || depot.stored < 1} onClick={() => void run(async () => { await actions.collect(); })}>Topla{depot.stored >= 1 ? ` +${fmtNum(depot.stored)}` : ''}</button></div>
          </div>
        )}

        {lib && (
          <div className="bp-depot bp-lib">
            <div className="row between"><b>Okuma köşesi</b><span className="qn"><Art name="xp" size={18} className="art-inline" /> {fmtNum(lib.stored)} / {fmtNum(lib.max)} XP</span></div>
            <div className="bp-bar"><i style={{ width: `${Math.round(lib.ratio * 100)}%` }} className={lib.ratio >= 1 ? 'full' : ''} /></div>
            <div className="row between"><span className="bp-note">{lib.ratio >= 1 ? 'Raflar dolu! Topla ki okuma sürsün.' : `Saatte ${b.level * 2} Kamp XP`}</span>
              <button className="btn small gold" disabled={busy || lib.stored < 1} onClick={() => void run(async () => { await actions.libCollect(); })}>Topla{lib.stored >= 1 ? ` +${fmtNum(lib.stored)}` : ''}</button></div>
          </div>
        )}

        {building ? (
          <div className="bp-build">
            <div className="row between"><b><Art e="🏗️" size="1.15em" className="art-inline" /> Sv {b.upgradingTo} yapılıyor</b><span className="countdown big-count" aria-live="off">{left > 0 ? fmtLeft(left) : 'Bitiyor…'}</span></div>
            <div className="bp-bar"><i style={{ width: `${Math.round((1 - left / total) * 100)}%` }} /></div>
            {team
              ? <button className="btn help" disabled={busy || asked} onClick={() => void run(async () => { if (await actions.ask(id)) setAsked(true); })}>{rich(asked ? `🙋 Yardım istendi · ${b.helpsReceived} yardım` : `🙋 Takımdan yardım iste${b.helpsReceived ? ` · ${b.helpsReceived} yardım` : ''}`)}</button>
              : <div className="bp-note">Bir takıma katılırsan arkadaşların inşaatını tek dokunuşla hızlandırabilir.</div>}
            <div className="speed-row">
              {ITEMS.map((it) => <button key={it.k} className="btn ghost small" disabled={busy || wallet.hizlandirici[it.k] < 1} onClick={() => void run(() => actions.speed(id, it.k))}><Art e="⏩" size="1.15em" className="art-inline" /> {it.label}<i className="cnt">×{wallet.hizlandirici[it.k]}</i></button>)}
            </div>
            <button className="btn finish" disabled={busy || wallet.kristal < crystals} onClick={() => void run(() => actions.speed(id, 'kristal'))}><Art e="💎" size="1.15em" className="art-inline" /> {crystals} ile bitir</button>
            <div className="bp-note">Kristal: kalan her dakika için 1 (sende <Art name="crystal" size="1.15em" className="art-inline" /> {fmtNum(wallet.kristal)}).</div>
            {camp.queued && <div className="bp-qline" data-testid="sirada-sonraki"><Art name="hourglass" size={18} className="art-inline" /><span className="grow min0">Sırada: <b>{shortOf(camp.queued.id)} Sv {camp.queued.toLevel}</b> · bu bitince başlar</span></div>}
          </div>
        ) : max ? <div className="bp-note">En yüksek seviyede. Tebrikler!</div> : (
          <div className="bp-up">
            <div className="chips"><span className="chip"><Art e="🪙" size="1.15em" className="art-inline" /> {fmtNum(cost.jeton)}</span><span className="chip"><Art e="⏱" size="1.15em" className="art-inline" /> {fmtDur(seconds)}</span>{fast > 0 && <span className="chip"><Art e="🏗️" size="1.15em" className="art-inline" /> takım −%{fast}</span>}</div>
            <div className="bp-next" data-testid="sonraki-gorunum"><BuildingThumb id={id} level={to} size={58} /><span><b>Sv {to}: {tierNext ? 'yeni görünüm!' : 'yeni bir ekleme'}</b><br />{tierNext ? `${CAMP_TIER_NAMES[tierOf(to)]} ${b.level === 0 ? 'yapı kurulur' : 'malzemeyle büyür'}` : id === 'merkez' ? 'Merkez her seviyede yeni bir parça kazanır' : 'Binanın çevresi süslenir'}</span></div>
            {POWER_BUILDINGS.includes(id) && to > CAMP_POWER_LEVEL && <div className="bp-note">Bina gücü Sv {CAMP_POWER_LEVEL}’te tavan yapar; sonraki seviyeler yeni görünüm ve Kamp XP’si verir.</div>}
            {inQueue ? (
              <div className="bp-queued" data-testid="sirada">
                <div className="row between"><b><Art name="hourglass" size={18} className="art-inline" /> Sırada · Sv {camp.queued!.toLevel}</b><span className="qn"><Art name="coin" size={16} className="art-inline" /> {fmtNum(camp.queued!.jeton)} ödendi</span></div>
                <div className="bp-note">{other ? `${shortOf(other.id)} bitince kendiliğinden başlar.` : 'Birazdan başlar.'} Hızlandırıcı ve takım yardımı inşaat başlayınca kullanılır.</div>
                <button className="btn ghost" disabled={busy} onClick={() => void run(() => actions.unqueue())}>Sıradan çıkar · <Art name="coin" size={16} className="art-inline" /> {fmtNum(camp.queued!.jeton)} geri</button>
              </div>
            ) : queueMode ? (<>
              <button className="btn" data-testid="siraya-al" disabled={busy || !qv.ok} onClick={() => void run(() => actions.queue(id))}>Sıraya al · <Art name="coin" size={16} className="art-inline" /> {fmtNum(cost.jeton)}</button>
              {qv.ok ? <div className="bp-note">{shortOf(other!.id)} bitince kendiliğinden başlar. Bedel şimdi ödenir; sıradan çıkarırsan tamamı geri gelir.</div>
                : <div className="bp-why" role="status">{qv.reason}</div>}
            </>) : (<>
              <button className="btn" disabled={busy || !verdict.ok} onClick={() => void run(() => actions.upgrade(id))}>{b.level === 0 ? 'Kur' : 'Yükselt'}{verdict.ok ? ` → Sv ${to}` : ''}</button>
              {!verdict.ok && <div className="bp-why" role="status">{verdict.reason}</div>}
            </>)}
          </div>
        )}

        {/* Tedavi Odası üretimi ve odyolojik bilgi: birincil eylemin (Kur/Yükselt) altında kalsın ki küçük ekranda düğme görünür olsun */}
        {id === 'tedavi' && b.level > 0 && <TedaviPanel camp={camp} sNow={sNow} actions={actions} />}
        {b.level > 0 && <KgBinaKanca id={id} onClose={onClose} />}
        <BuildingInfo id={id} level={b.level} />
      </div>
    </div>,
    document.body,
  );
}
