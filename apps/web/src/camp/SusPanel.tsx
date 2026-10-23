import { useEffect, useState } from 'react';
import type { CampState } from '@odi/shared';
import { DECORATIONS, decorById } from '@odi/content';
import type { CampHandle } from '@odi/game-core';
import { audio } from '@odi/audio';
import { platform } from '../platform';
import { Art } from '../ui/art';
import { Icon } from '../ui/icons';
import { DecorThumb } from './KampSeviye';
import type { CampActions } from './model';

/** süsleme kipindeki seçim: yeni süs (hayalet), taşınan süs (hayalet + uid) ya da seçili yerleşik süs */
export type SusSel = { k: 'yeni'; id: string; ok: boolean } | { k: 'tasi'; uid: number; id: string; ok: boolean } | { k: 'secili'; uid: number } | null;

/**
 * Süsleme kipi (docs/14-kamp.md §10): alt panelde envanter; bir süse dokun → kampta hayaleti belirir (yeşil taban: konabilir,
 * kırmızı: konamaz) → sürükle ya da yere dokun → Yerleştir. Yerleşik bir süse dokun → Taşı / Çevir / Depoya kaldır.
 * 320 px genişlikte çalışır; düğmeler büyük, metinler kısa.
 */
export function SusPanel({ camp, handle, actions, sel, setSel, onDone }: {
  camp: CampState; handle: CampHandle | null; actions: CampActions; sel: SusSel; setSel: (s: SusSel) => void; onDone: () => void;
}) {
  const decor = camp.decor ?? { inv: {}, placed: [], cap: 4 };
  const used = decor.placed.length; const full = used >= decor.cap;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inv = DECORATIONS.filter((d) => (decor.inv[d.id] ?? 0) > 0);
  useEffect(() => { setMsg(null); }, [sel?.k]);

  const startNew = (id: string) => {
    if (full) { setMsg('Süs yerin dolu. Kamp Seviyesi ve Rehabilitasyon Parkı yeni yer açar; ya da bir süsü depoya kaldır.'); audio.play('tap'); return; }
    audio.play('pop'); platform().haptic('light');
    const g = handle?.setGhost({ id, flip: false }); setSel({ k: 'yeni', id, ok: !!g?.ok });
  };
  const cancel = () => { audio.play('tap'); handle?.setGhost(null); handle?.selectDecor(null); setSel(null); };
  const confirm = async () => {
    const g = handle?.ghostState(); if (!g || !sel || busy) return;
    if (!g.ok) { setMsg('Buraya konamaz: boş ve açık bir yer seç (binaların ve anıtların önü açık kalır).'); return; }
    setBusy(true);
    try {
      if (sel.k === 'yeni') {
        const before = new Set(decor.placed.map((p) => p.uid));
        const camp2 = await actions.decorPlace(g.id, g.gx, g.gy, g.flip);
        if (camp2) { handle?.setGhost(null); setSel(null); audio.play('coinBurst', { semitones: 6 }); platform().haptic('success'); const n = camp2.decor?.placed.find((p) => !before.has(p.uid)); if (n) setTimeout(() => handle?.decorPlaced(n.uid), 60); }
      } else if (sel.k === 'tasi') {
        const camp2 = await actions.decorMove(sel.uid, g.gx, g.gy, g.flip);
        if (camp2) { handle?.setGhost(null); setSel({ k: 'secili', uid: sel.uid }); setTimeout(() => { handle?.selectDecor(sel.uid); handle?.decorPlaced(sel.uid); }, 60); audio.play('pop'); }
      }
    } finally { setBusy(false); }
  };
  const placed = sel && sel.k === 'secili' ? decor.placed.find((p) => p.uid === sel.uid) : undefined;
  const ghostId = sel && (sel.k === 'yeni' || sel.k === 'tasi') ? sel.id : placed?.id;
  const def = ghostId ? decorById(ghostId) : undefined;

  return (
    <div className="sus-panel" data-testid="sus-panel" onClick={(e) => e.stopPropagation()}>
      <div className="sus-head">
        <b><Art name="palette" size={18} /> Süsle</b>
        <span className={`sus-cap${full ? ' full' : ''}`} data-testid="sus-yer">{used}/{decor.cap} yer</span>
        <button type="button" className="btn small sus-done" onClick={() => { cancel(); onDone(); }}>Bitti</button>
      </div>
      {sel && (sel.k === 'yeni' || sel.k === 'tasi') ? (
        <div className="sus-act">
          <div className="sus-info"><DecorThumb id={sel.id} size={40} /><span><b>{def?.name}</b><small className={sel.ok ? 'ok' : 'bad'}>{sel.ok ? 'Buraya konabilir · sürükle ya da yere dokun' : 'Buraya konamaz · başka yere sürükle'}</small></span></div>
          <div className="sus-btns">
            <button type="button" className="btn ghost" onClick={() => { audio.play('tap'); handle?.flipGhost(); }} aria-label="Çevir"><Icon name="retry" size="1em" className="ic-inline" /> Çevir</button>
            <button type="button" className="btn ghost" onClick={cancel}>Vazgeç</button>
            <button type="button" className="btn sus-ok" disabled={!sel.ok || busy} onClick={() => void confirm()} data-testid="sus-yerlestir"><Art name="check" size={18} /> Yerleştir</button>
          </div>
        </div>
      ) : sel && sel.k === 'secili' && placed ? (
        <div className="sus-act">
          <div className="sus-info"><DecorThumb id={placed.id} size={40} /><span><b>{def?.name}</b><small>{def?.plain}</small></span></div>
          <div className="sus-btns">
            <button type="button" className="btn ghost" onClick={() => { audio.play('pop'); handle?.selectDecor(null); const g = handle?.setGhost({ id: placed.id, flip: placed.flip, uid: placed.uid, gx: placed.gx, gy: placed.gy }); setSel({ k: 'tasi', uid: placed.uid, id: placed.id, ok: !!g?.ok }); }} data-testid="sus-tasi">Taşı</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void (async () => { setBusy(true); try { await actions.decorMove(placed.uid, placed.gx, placed.gy, !placed.flip); audio.play('tap'); } finally { setBusy(false); } })()}>Çevir</button>
            <button type="button" className="btn ghost" disabled={busy} data-testid="sus-kaldir" onClick={() => void (async () => { setBusy(true); try { if (await actions.decorStore(placed.uid)) { handle?.selectDecor(null); setSel(null); audio.play('whoosh'); } } finally { setBusy(false); } })()}>Depoya</button>
            <button type="button" className="btn ghost sus-x" onClick={cancel} aria-label="Seçimi kapat"><Icon name="close" size="1em" className="ic-inline" /></button>
          </div>
        </div>
      ) : (
        <div className="sus-inv" role="list" aria-label="Süs envanteri">
          {inv.length === 0 && <div className="sus-empty">Envanterin boş. Kamp Seviyesi atladıkça, anıtlar yükseldikçe ve kamp görevleriyle yeni süsler gelir. Yerleşik bir süse dokunup taşıyabilirsin.</div>}
          {inv.map((d) => (
            <button type="button" role="listitem" key={d.id} className="sus-card" data-decor={d.id} onClick={() => startNew(d.id)} disabled={busy}>
              <DecorThumb id={d.id} size={44} />
              <span className="sus-n">{d.name}</span>
              <i className="cnt">×{decor.inv[d.id]}</i>
            </button>
          ))}
        </div>
      )}
      {msg && <div className="sus-msg" role="status">{msg}</div>}
    </div>
  );
}
