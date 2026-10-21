import { useState } from 'react';
import type { CampState } from '@odi/shared';
import { PATHOLOGY_NAMES, REMEDIES, REMEDY_DISCLAIMER, REMEDY_INV_CAP, remedyById, remedyPeriodMs, remedyShelf, type RemedyDef } from '@odi/content';
import { audio } from '@odi/audio';
import { MoreLine } from '../ftue/Notes';
import { fmtDur } from '../ui/social';
import { RemedyIcon } from './remedyArt';
import { slotsOf } from './bag';
import type { CampActions } from './model';

/**
 * Tedavi Odası üretimi (bina panelinde ve liste görünümünde): tarif seç → bina sürekli hazırlar → raf dolunca topla → çanta.
 * Kurallar sunucuyla aynı (@odi/content remedies.ts): her seviye süreyi %3 kısaltır, raf 2 + Sv/3, çantada bir malzemeden en çok 9.
 */
export function TedaviPanel({ camp, sNow, actions, compact = false }: { camp: CampState; sNow: number; actions: CampActions; compact?: boolean }) {
  const lv = camp.buildings.find((b) => b.id === 'tedavi')?.level ?? 0;
  const r = camp.remedy; const cur = r?.item ? remedyById(r.item) : undefined;
  const [peek, setPeek] = useState<string | null>(cur?.id ?? null);
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<unknown>) => { if (busy) return; setBusy(true); audio.play('tap'); try { await f(); } finally { setBusy(false); } };
  if (lv <= 0) return <div className="tp-note">Tedavi Odası kurulunca burada kulak tıkacı, damla, ventilasyon tüpü gibi malzemeler hazırlarsın.</div>;
  const sh = cur && r ? remedyShelf(cur, lv, r.since, sNow) : null;
  const inv = r?.inv ?? {};
  const shown = peek ? remedyById(peek) : cur;
  const invList = REMEDIES.filter((x) => (inv[x.id] ?? 0) > 0);
  return (
    <div className={`tp${compact ? ' compact' : ''}`} data-testid="tedavi-panel">
      {cur && sh ? (
        <div className="tp-now" data-making={cur.id}>
          <span className="tp-ico big" style={{ ['--rc' as string]: cur.color }}><RemedyIcon id={cur.id} size={34} /></span>
          <div className="grow min0">
            <div className="tp-k">Hazırlanıyor</div>
            <b>{cur.name}</b>
            <div className="bp-bar tp-bar"><i style={{ width: `${Math.round(sh.progress * 100)}%` }} className={sh.ready >= sh.cap ? 'full' : ''} /></div>
            <div className="tp-meta">{sh.ready >= sh.cap ? 'Raf dolu: topla ki hazırlık sürsün.' : `Her ${fmtDur(sh.periodMs / 1000)}’da 1 · sıradaki ${fmtDur(Math.max(1, (1 - sh.progress) * sh.periodMs / 1000))}`}</div>
          </div>
          <div className="tp-shelf">
            <span className="qn">Rafta <b>{sh.ready}</b>/{sh.cap}</span>
            <button className="btn small gold" disabled={busy || sh.ready < 1 || (inv[cur.id] ?? 0) >= REMEDY_INV_CAP} onClick={() => void run(() => actions.remedyCollect())}>Topla</button>
          </div>
        </div>
      ) : <div className="tp-note">Bir tarif seç: Tedavi Odası onu sürekli hazırlar, raf dolunca toplarsın.</div>}

      <div className="tp-grid" role="radiogroup" aria-label="Tarifler">
        {REMEDIES.map((d) => {
          const open = d.level <= lv; const on = cur?.id === d.id;
          return (
            <button key={d.id} type="button" role="radio" aria-checked={on} className={`tp-tile${on ? ' on' : ''}${open ? '' : ' locked'}${peek === d.id ? ' peek' : ''}`} data-recipe={d.id}
              onClick={() => { audio.play('tap'); setPeek(d.id); }} style={{ ['--rc' as string]: d.color }}>
              <span className="tp-ico"><RemedyIcon id={d.id} size={28} /></span>
              <span className="tp-name">{d.name}</span>
              <small>{open ? fmtDur(remedyPeriodMs(d, lv) / 1000) : `Sv ${d.level}`}</small>
              {(inv[d.id] ?? 0) > 0 && <i className="tp-have">×{inv[d.id]}</i>}
            </button>
          );
        })}
      </div>

      {shown && <RecipeInfo d={shown} lv={lv} on={cur?.id === shown.id} busy={busy} onMake={() => void run(() => actions.remedyMake(shown.id))} />}

      {!compact && (
        <div className="tp-inv">
          <span className="tp-k">Çantan ({slotsOf(camp)} yer · bölüm kartında seçilir)</span>
          <div className="tp-inv-row">{invList.length ? invList.map((x) => <span key={x.id} className="tp-chip" data-inv={x.id}><RemedyIcon id={x.id} size={20} />{x.name} ×{inv[x.id]}</span>) : <span className="tp-note">Henüz malzeme yok.</span>}</div>
        </div>
      )}
      <div className="tp-disc">{REMEDY_DISCLAIMER}</div>
    </div>
  );
}

function RecipeInfo({ d, lv, on, busy, onMake }: { d: RemedyDef; lv: number; on: boolean; busy: boolean; onMake: () => void }) {
  const open = d.level <= lv;
  return (
    <div className="tp-info" data-info={d.id}>
      <div className="tp-info-head"><b>{d.name}</b><span className="tp-term">{d.term}</span></div>
      <p className="tp-plain">{d.plain}</p>
      <div className="tp-counters"><span className="tp-k">Etkisiz kıldığı engel</span>{d.counters.map((p) => <span key={p} className="tp-path">{PATHOLOGY_NAMES[p]}</span>)}</div>
      <MoreLine text={d.tech} />
      {open
        ? <button className="btn small" disabled={busy || on} onClick={onMake}>{on ? 'Şu an hazırlanıyor' : 'Bunu hazırla'}</button>
        : <div className="bp-why">Tedavi Odası Sv {d.level} gerekli.</div>}
    </div>
  );
}
