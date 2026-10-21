import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { PATHOLOGY_NAMES, REMEDIES, REMEDY_DISCLAIMER, remedyFitsRegion, type PathologyId } from '@odi/content';
import { audio } from '@odi/audio';
import { useStore } from '../store';
import { clearedCount, isOpen } from '../ftue/features';
import { bagAdd, bagList, bagRemove, bagTotal, campLevel, slotsOf, useBag } from './bag';
import { RemedyIcon } from './remedyArt';
import { Art } from '../ui/art';
import './camp.css';

const names = (ps: PathologyId[]) => ps.map((p) => PATHOLOGY_NAMES[p]).join(', ');

/**
 * Bölüm kartındaki Çanta: Tedavi Odası'nda hazırlanan malzemelerden bu bölüme götürülecekler (en çok çanta yeri kadar).
 * Her malzeme uygun bir engeli bir kez etkisiz kılar; kullanılmayan kaybolmaz. Kamp açılmadıysa hiç görünmez.
 */
export function RemedyPicker({ region }: { region: string }) {
  const camp = useNet((s) => s.camp); const progress = useStore((s) => s.progress); const ftue = useStore((s) => s.ftue);
  useBag((s) => s.pick); // seçim değişince yeniden çiz
  const [open, setOpen] = useState(false);
  if (!isOpen('camp', clearedCount(progress), ftue)) return null;
  const lv = campLevel(camp, 'tedavi');
  if (!camp || lv <= 0) return (
    <div className="mc-row bag-row bag-empty" data-testid="canta">
      <span><Art e="🩹" size={20} /></span><b>Çanta</b><span className="mc-dim">{camp ? 'Kampta Tedavi Odası’nı kurunca bölüme koruma malzemesi götürebilirsin.' : 'Çanta, kamp sunucuya bağlanınca açılır.'}</span>
    </div>
  );
  const inv = camp.remedy?.inv ?? {};
  const list = bagList(camp); const slots = slotsOf(camp); const used = bagTotal(list);
  const owned = REMEDIES.filter((r) => (inv[r.id] ?? 0) > 0);
  const tap = (f: () => unknown) => { audio.play('tap'); f(); };
  return (
    <div className="bag" data-testid="canta">
      <button type="button" className="mc-row bag-row" aria-expanded={open} onClick={() => tap(() => setOpen(!open))}>
        <span><Art e="🩹" size={20} /></span><b>Çanta</b>
        <span className="bag-sum">
          {list.length ? list.map((x) => <span key={x.id} className="bag-chip" data-remedy={x.id}><RemedyIcon id={x.id} size={20} />×{x.count}</span>) : <span className="mc-dim">{owned.length ? 'Boş · dokun, malzeme seç' : 'Tedavi Odası’nda malzeme hazırla'}</span>}
          <i className="bag-slots">{used}/{slots}</i>
        </span>
      </button>
      {open && (
        <div className="bag-pick" role="group" aria-label="Çantaya malzeme seç">
          {!owned.length && <div className="mc-dim">Henüz malzemen yok. Kampta Tedavi Odası’na dokun, bir tarif seç; raf dolunca topla.</div>}
          {owned.map((r) => {
            const n = list.find((x) => x.id === r.id)?.count ?? 0; const fit = remedyFitsRegion(r, region);
            return (
              <div key={r.id} className={`bag-item${n ? ' on' : ''}`} data-remedy={r.id}>
                <span className="bag-ico" style={{ ['--rc' as string]: r.color }}><RemedyIcon id={r.id} size={30} /></span>
                <span className="bag-txt"><b>{r.name} <i className="bag-have">· sende {inv[r.id]}</i></b><small>{names(r.counters)}</small>{fit && <em className="bag-fit">Bu bölgede işe yarayabilir</em>}</span>
                <span className="bag-step">
                  <button type="button" aria-label={`${r.name} çıkar`} disabled={!n} onClick={() => tap(() => bagRemove(r.id, camp))}>−</button>
                  <b aria-live="polite" aria-label={`Çantada ${n}`}>{n}</b>
                  <button type="button" aria-label={`${r.name} ekle`} disabled={used >= slots || n >= (inv[r.id] ?? 0)} onClick={() => tap(() => bagAdd(r.id, camp))}>+</button>
                </span>
              </div>
            );
          })}
          <div className="bag-note">Çantaya en çok {slots} malzeme sığar. Kullanmadığın malzeme kaybolmaz. {REMEDY_DISCLAIMER}</div>
        </div>
      )}
    </div>
  );
}
