import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CampState, CampXpState } from '@odi/shared';
import { CAMP_LEVEL_MAX, CAMP_XP, DISTRICTS, campLevelRewards, campTitle, decorById, decorSlots } from '@odi/content';
import { decorCanvas } from '@odi/game-core/lite';
import { Art } from '../ui/art';
import { Icon } from '../ui/icons';
import { fmtNum } from '../ui/social';
import { rewardIcon, rewardLabel } from './seviye';

/** üst gösterge: Kamp Seviyesi rozeti + XP çubuğu + unvan (dokununca seviye paneli) */
export function CampLevelChip({ xp, onOpen }: { xp: CampXpState; onOpen: () => void }) {
  const pct = xp.need ? Math.min(100, Math.round((xp.into / xp.need) * 100)) : 100;
  return (
    <button type="button" className="kamp-sv" onClick={onOpen} data-testid="kamp-seviye" data-level={xp.level} aria-label={`Kamp Seviyesi ${xp.level}, ${campTitle(xp.level)}. ${xp.need ? `Sonraki seviyeye ${fmtNum(xp.need - xp.into)} XP` : 'En yüksek seviye'}`}>
      <span className="ks-badge" aria-hidden><small>KAMP</small><b>{xp.level}</b></span>
      <span className="ks-body">
        <span className="ks-title">{campTitle(xp.level)}</span>
        <span className="ks-bar" aria-hidden><i style={{ width: `${pct}%` }} /></span>
        <span className="ks-num">{xp.need ? `${fmtNum(xp.into)} / ${fmtNum(xp.need)} XP` : 'En yüksek seviye'}</span>
      </span>
    </button>
  );
}

const thumbs = new Map<string, string>();
/** süs küçük resmi (önbellekli) */
export function DecorThumb({ id, size = 44 }: { id: string; size?: number }) {
  const src = useMemo(() => {
    const hit = thumbs.get(id); if (hit) return hit;
    try { const d = decorById(id); const c = decorCanvas(id, d?.size ?? 1, 1.6); const url = c.toDataURL('image/png'); thumbs.set(id, url); return url; } catch { return ''; }
  }, [id]);
  return src ? <img className="dec-thumb" src={src} alt="" style={{ height: size }} aria-hidden /> : null;
}

/** Kamp Seviyesi paneli: nasıl kazanılır, her seviyenin ödülü (geçilenler işaretli), bölgeler */
export function CampLevelPanel({ camp, onClose }: { camp: CampState; onClose: () => void }) {
  const xp = camp.xp ?? { level: 1, total: 0, into: 0, need: 60 };
  const park = camp.buildings.find((b) => b.id === 'park')?.level ?? 0;
  const rows = Array.from({ length: CAMP_LEVEL_MAX }, (_, i) => i + 1);
  const box = useRef<HTMLDivElement>(null);
  // sıradaki ödül görünsün: liste açılınca o satıra kaydır (ilk seviyelerde başlık ve "nasıl kazanılır" görünür kalır)
  useEffect(() => { if (xp.level < 3) return; const row = box.current?.querySelector('.ks-row.next'); if (row && box.current) box.current.scrollTop = Math.max(0, (row as HTMLElement).offsetTop - box.current.clientHeight * 0.35); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <div className="bp-wrap" onClick={onClose}>
      <div className="bp ks-panel" ref={box} role="dialog" aria-label="Kamp Seviyesi" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="bp-head">
          <span className="ks-badge big" aria-hidden><small>KAMP</small><b>{xp.level}</b></span>
          <div className="grow min0"><h2>{campTitle(xp.level)}</h2><div className="bp-desc">Kamp Seviyesi {xp.level} / {CAMP_LEVEL_MAX} · toplam {fmtNum(xp.total)} XP · {decorSlots(xp.level, park)} süs yeri</div></div>
          <button className="bp-x" onClick={onClose} aria-label="Kapat"><Icon name="close" size="1.1em" className="ic-inline" /></button>
        </div>
        {xp.need > 0 && <div className="bp-bar" aria-label="Sonraki seviye"><i style={{ width: `${Math.round((xp.into / xp.need) * 100)}%` }} /></div>}
        <div className="ks-how">
          <b>Kamp XP nasıl kazanılır?</b>
          <ul>
            <li>İnşaat bittiğinde: 20 + 10 × seviye</li>
            <li>Tedavi Odası rafından her malzeme: {CAMP_XP.remedy}</li>
            <li>Haritada yeni bölgeye ulaşınca anıt: {CAMP_XP.monument}</li>
            <li>Bir süs türünü ilk kez yerleştirince: {CAMP_XP.decorFirst}</li>
            <li>Arkadaş kampına alkış bırakınca: {CAMP_XP.cheerGive} · alkış alınca: {CAMP_XP.cheerGot}</li>
            <li>Depo toplama, Kütüphane okuma köşesi ve kamp görevleri</li>
          </ul>
          <small>Akustik Kabin her kaynağa bonus ekler. Kamp XP satın alınmaz.</small>
        </div>
        <div className="ks-dist" aria-label="Bölgeler">
          {DISTRICTS.map((d) => <span key={d.id} className={`ks-d${xp.level >= d.level ? ' on' : ''}`}><Art name={xp.level >= d.level ? 'map' : 'lock'} size={16} /> {d.name} <small>Sv {d.level}</small></span>)}
        </div>
        <ol className="ks-list">
          {rows.map((l) => {
            const rs = campLevelRewards(l); const state = l <= xp.level ? 'ok' : l === xp.level + 1 ? 'next' : 'far';
            return (
              <li key={l} className={`ks-row ${state}`} data-level={l}>
                <span className="ks-l">{state === 'ok' ? <Art name="check" size={16} /> : null}Sv {l}</span>
                <span className="ks-r">{rs.map((r, i) => <span key={i} className={`ks-rw k-${r.kind}`}>{r.kind === 'sus' ? <DecorThumb id={r.id} size={22} /> : <Art name={rewardIcon(r)} size={16} />}{rewardLabel(r)}</span>)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
