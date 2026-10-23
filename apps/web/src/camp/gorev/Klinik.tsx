/**
 * Odyoloji Kliniği: bekleme salonu (dürüst takvim: günde en çok 3 yeni hasta, bekleyenler bekler), Vaka Defteri (tamamlanma %,
 * yıldızlar, yeniden oynama) ve vaka akışı: hasta → testler (odyogram, timpanogram, otoskopi…) → tanı → yönetim → sonuç
 * (yıldızlar, açıklama, Kulak Sözlüğü terimi, kaynak). Bilgi düzeyi (Ayarlar): genel = sade metin ve 3 seçenek; odyoloji = sayılar
 * ve 4 seçenek. Vakalar kurgusaldır; tıbbi öneri değildir.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNet } from '@odi/net/store';
import { GLOSSARY } from '@odi/content/odyoloji';
import { CAMP_TERMS, KG_KURAL, PATHOLOGY_IDS, PATHOLOGY_NAMES, REMEDY_DISCLAIMER, VAKALAR, VAKA_TESTLERI, isYok, taniById, taniSecenekleri, vakaById, yonetimSecenekleri, type Ear, type Odyogram, type Otoskopi, type Timp, type Vaka } from '@odi/content';
import type { VakaSonuc } from '@odi/shared';
import { audio } from '@odi/audio';
import { act } from '../../net';
import { useStore } from '../../store';
import { MoreLine } from '../../ftue/Notes';
import { Art } from '../../ui/art';
import { Icon } from '../../ui/icons';
import { fmtTime } from '../../ui/social';
import { sayDede } from '../dede';
import { HastaSvg, OdyogramLejant, OdyogramSvg, OtoskopSvg, TimpanogramSvg } from './charts';
import { KgIcon, TestIcon } from './art';
import { celebrateReward, odulOgeleri, openPanel, refreshVaka, useKg } from './state';
import { KULAK, testSatirlari } from './yorum';

export const KLINIK_NOT = 'Vakalar kurgusaldır ve eğitim içindir; gerçek kişiler değildir ve tıbbi öneri değildir. Gerçek hayatta tanı ve tedaviyi hekim ve odyolog birlikte koyar.';
const terimOf = (id: string) => GLOSSARY.find((g) => g.id === id) ?? CAMP_TERMS.find((t) => t.id === id);

/** koyu cam alt sayfa (bina paneliyle aynı görünüm) */
export function KgSheet({ title, icon, onClose, children, testid, wide }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode; testid: string; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <div className="bp-wrap kg-wrap" onClick={onClose}>
      <div className={`bp kg-sheet${wide ? ' tall' : ''}`} role="dialog" aria-label={title} data-testid={testid} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="kg-head">{icon && <span className="kg-head-ic" aria-hidden>{icon}</span>}<h2>{title}</h2><button className="bp-x" onClick={onClose} aria-label="Kapat"><Icon name="close" size="1.1em" className="ic-inline" /></button></div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Stars({ n, of = 3, size = 18 }: { n: number; of?: number; size?: number }) {
  return <span className="kg-stars" aria-label={`${n} yıldız`}>{Array.from({ length: of }, (_, i) => <span key={i} className={i < n ? 'on' : ''}><Art name="star" size={size} /></span>)}</span>;
}

export function KlinikPanel({ tab, vakaId, replay }: { tab: 'salon' | 'defter'; vakaId?: string; replay?: boolean }) {
  const vaka = useKg((s) => s.vaka);
  useEffect(() => { void refreshVaka(); }, []);
  const close = () => { audio.play('tap'); openPanel(null); };
  const setTab = (t: 'salon' | 'defter') => { audio.play('tab'); openPanel({ kind: 'klinik', tab: t }); };
  if (vakaId) { const v = vakaById(vakaId); if (v) return <VakaAkisi v={v} replay={!!replay} onBack={() => openPanel({ kind: 'klinik', tab: replay ? 'defter' : 'salon' })} onClose={close} />; }
  const solved = vaka?.book.filter((b) => b.stars > 0) ?? [];
  return (
    <KgSheet title="Odyoloji Kliniği" icon={<KgIcon name="klinik" size={30} />} onClose={close} testid="klinik-panel">
      <div className="kg-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'salon'} className={tab === 'salon' ? 'on' : ''} onClick={() => setTab('salon')}><KgIcon name="salon" size={18} /> Bekleme salonu{vaka?.waiting.length ? <i className="kg-badge">{vaka.waiting.length}</i> : null}</button>
        <button role="tab" aria-selected={tab === 'defter'} className={tab === 'defter' ? 'on' : ''} onClick={() => setTab('defter')} data-testid="defter-tab"><KgIcon name="defter" size={18} /> Vaka Defteri <small>{solved.length}/{vaka?.total ?? VAKALAR.length}</small></button>
      </div>
      {!vaka ? <div className="kg-note">Klinik yükleniyor…</div>
        : vaka.locked ? <div className="kg-locked"><Art name="lock" size={22} /> {vaka.locked}</div>
          : tab === 'salon' ? <Salon /> : <Defter />}
      <p className="kg-disclaimer">{KLINIK_NOT}</p>
    </KgSheet>
  );
}

function Salon() {
  const vaka = useKg((s) => s.vaka)!;
  return (
    <div className="kg-salon">
      <div className="kg-note">Bugün {vaka.arrivedToday} yeni hasta geldi · salonda en çok {KG_KURAL.vakaSalon} kişi bekler · Klinik Sv {vaka.klinikSv} ({vaka.tier}. kademe vakalar)</div>
      {vaka.waiting.length === 0 && (
        <div className="kg-empty" data-testid="salon-bos"><KgIcon name="salon" size={40} /><b>Bekleyen hasta yok</b>
          <span>{vaka.nextArrivalAt ? `Yeni hastalar yarın gelir (${new Date(vaka.nextArrivalAt).toLocaleDateString('tr-TR', { weekday: 'long' })} ${fmtTime(vaka.nextArrivalAt)}).` : vaka.tier < 3 ? `Bu kademedeki bütün hastaları gördün. Yeni vakalar Odyoloji Kliniği Sv ${KG_KURAL.kademeSv[vaka.tier]} ile gelir.` : 'Bütün vakaları gördün! Vaka Defteri’nden yıldızlarını artırabilirsin.'}</span></div>
      )}
      <div className="kg-list">
        {vaka.waiting.map((id) => { const v = vakaById(id); if (!v) return null; const k = vaka.konsult.find((x) => x.caseId === id); const b = vaka.book.find((x) => x.id === id); return (
          <button key={id} className="kg-hasta-kart" data-vaka={id} onClick={() => { audio.play('tap'); openPanel({ kind: 'klinik', tab: 'salon', vaka: id }); }}>
            <HastaSvg g={v.hasta.gorunum} grup={v.hasta.grup} size={54} />
            <span className="grow min0"><b>{v.hasta.ad} · {v.hasta.yas}</b><small>{v.baslik}</small>
              <span className="kg-chips"><i className={`kg-tier t${v.kademe}`}>{v.kademe}. kademe</i>{k && <i className="kg-chip-k"><KgIcon name="konsult" size={14} /> {k.n} görüş</i>}{b && b.plays > 0 && <i>{b.plays}. deneme</i>}</span></span>
            <Icon name="chevron" size="1.1em" />
          </button>); })}
      </div>
    </div>
  );
}

function Defter() {
  const vaka = useKg((s) => s.vaka)!;
  const by = new Map(vaka.book.map((b) => [b.id, b]));
  const solved = vaka.book.filter((b) => b.stars > 0);
  const stars = solved.reduce((a, b) => a + b.stars, 0);
  const pats = new Set(VAKALAR.filter((v) => (by.get(v.id)?.stars ?? 0) > 0 && (PATHOLOGY_IDS as readonly string[]).includes(v.kat)).map((v) => v.kat));
  const pct = Math.round((solved.length / VAKALAR.length) * 100);
  return (
    <div className="kg-defter" data-testid="vaka-defteri">
      <div className="kg-defter-ozet">
        <div><b>%{pct}</b><small>tamamlandı</small></div>
        <div><b>{stars}</b><small>/ {VAKALAR.length * 3} yıldız</small></div>
        <div><b>{pats.size}</b><small>/ {PATHOLOGY_IDS.length} patoloji</small></div>
      </div>
      <div className="kg-bar" aria-label={`Vaka Defteri %${pct}`}><i style={{ width: `${pct}%` }} /></div>
      <div className="kg-defter-grid">
        {VAKALAR.map((v) => { const b = by.get(v.id); const ok = !!b && b.stars > 0; return (
          <button key={v.id} className={`kg-dslot${ok ? ' ok' : ''}`} disabled={!ok} data-vaka={v.id} aria-label={ok ? `${v.baslik}, ${b!.stars} yıldız, yeniden çöz` : 'Henüz çözülmedi'}
            onClick={() => { audio.play('tap'); openPanel({ kind: 'klinik', tab: 'defter', vaka: v.id, replay: true }); }}>
            {ok ? <HastaSvg g={v.hasta.gorunum} grup={v.hasta.grup} size={40} /> : <span className="kg-q" aria-hidden>?</span>}
            <small>{ok ? v.baslik : `${v.kademe}. kademe`}</small>
            {ok && <Stars n={b!.stars} size={12} />}
          </button>); })}
      </div>
      <div className="kg-note">Gördüğün patolojiler: {pats.size ? [...pats].map((p) => PATHOLOGY_NAMES[p as keyof typeof PATHOLOGY_NAMES]).join(', ') : 'henüz yok'}.</div>
    </div>
  );
}

// ------------------------------------------------------------------ vaka akışı
type Adim = 'hasta' | 'test' | 'tani' | 'sonuc';
const yeniDeneme = (id: string) => `${id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

function VakaAkisi({ v, replay, onBack, onClose }: { v: Vaka; replay: boolean; onBack: () => void; onClose: () => void }) {
  const duzey = useStore((s) => s.knowledge);
  const team = useNet((s) => s.team); const vaka = useKg((s) => s.vaka);
  const [adim, setAdim] = useState<Adim>('hasta');
  const [tests, setTests] = useState<string[]>([]);
  const [dx, setDx] = useState<string | null>(null); const [mg, setMg] = useState<string | null>(null);
  const [res, setRes] = useState<VakaSonuc | null>(null); const [busy, setBusy] = useState(false);
  const attempt = useMemo(() => yeniDeneme(v.id), [v.id]);
  const dxOpts = useMemo(() => taniSecenekleri(v, duzey), [v.id, duzey]);
  const mgOpts = useMemo(() => yonetimSecenekleri(v, duzey), [v.id, duzey]);
  const konsult = vaka?.konsult.find((k) => k.caseId === v.id);
  const order = (id: string) => { if (tests.includes(id)) return; audio.play('pop'); setTests((t) => [id, ...t]); };
  const send = async () => {
    if (!dx || !mg || busy) return; setBusy(true);
    const r = await act('vaka.answer', { caseId: v.id, attempt, tests: [...tests].reverse(), dx, mg });
    setBusy(false); if (!r) return;
    useKg.setState({ vaka: r.vaka }); useNet.setState({ wallet: r.wallet }); setRes(r.result); setAdim('sonuc');
    if (r.result.stars > 0) {
      audio.play(r.result.stars === 3 ? 'star3' : r.result.stars === 2 ? 'star2' : 'star1');
      if (r.result.first && (r.vaka.book.filter((b) => b.stars > 0).length === 1)) sayDede('kg-vaka-ilk', 'Vaka Defteri');
      celebrateReward(r.result.first ? `${v.hasta.ad}: vaka çözüldü!` : `${v.hasta.ad}: +${r.result.newStars} yıldız`, r.result.reward);
    } else audio.play('error');
  };
  const ask = async () => { setBusy(true); const r = await act('vaka.konsult', { caseId: v.id }); setBusy(false); if (r) { useKg.setState({ vaka: r.vaka }); audio.play('notify'); } };
  return (
    <KgSheet title={`${v.hasta.ad} · ${v.baslik}`} icon={<HastaSvg g={v.hasta.gorunum} grup={v.hasta.grup} size={40} />} onClose={onClose} testid="vaka-akisi" wide>
      <div className="kg-steps" aria-label="Adımlar">
        {(['hasta', 'test', 'tani', 'sonuc'] as Adim[]).map((a, i) => <span key={a} className={a === adim ? 'on' : (['hasta', 'test', 'tani', 'sonuc'].indexOf(adim) > i ? 'done' : '')}>{i + 1}. {({ hasta: 'Hasta', test: 'Testler', tani: 'Karar', sonuc: 'Sonuç' })[a]}</span>)}
      </div>

      {adim === 'hasta' && (
        <div className="kg-hasta" data-testid="hasta-adim">
          <div className="kg-hasta-top"><HastaSvg g={v.hasta.gorunum} grup={v.hasta.grup} size={84} /><div><b>{v.hasta.ad}</b><small>{v.hasta.yas} · kurgusal hasta</small><i className={`kg-tier t${v.kademe}`}>{v.kademe}. kademe</i></div></div>
          <p className="kg-oyku">{v.oyku}</p>
          <div className="kg-chips">{v.belirtiler.map((b) => <i key={b}>{b}</i>)}</div>
          <button className="btn" data-testid="testlere-gec" onClick={() => { audio.play('tap'); setAdim('test'); }}>Testleri seç</button>
          {replay && <button className="btn ghost small" onClick={onBack}>Vaka Defteri’ne dön</button>}
        </div>
      )}

      {adim === 'test' && (
        <div className="kg-testler" data-testid="test-adim">
          <div className="kg-note">Gerekli testleri seç: az testle doğru karar +1 yıldız. İstenen test: <b data-testid="test-sayisi">{tests.length}</b></div>
          <div className="kg-test-grid">
            {VAKA_TESTLERI.map((t) => <button key={t.id} className={`kg-test${tests.includes(t.id) ? ' on' : ''}`} data-test={t.id} onClick={() => order(t.id)} aria-pressed={tests.includes(t.id)}><TestIcon id={t.id} size={26} /><span>{duzey === 'genel' ? t.kisa : t.ad}</span></button>)}
          </div>
          {tests.map((id) => <SonucKart key={id} v={v} id={id} duzey={duzey} />)}
          {team && !replay && (
            konsult ? <div className="kg-konsult-durum" data-testid="konsult-durum"><KgIcon name="konsult" size={20} /> Takımına danıştın: {konsult.n ? taniSecenekleri(v, 'genel').map((o, i) => `${o.sade} ${konsult.votes[i] ?? 0}`).join(' · ') : 'henüz görüş yok'}</div>
              : team.members < 2 ? <small className="kg-note">Konsültasyon: takımına bir arkadaş katılınca zor vakalarda danışabilirsin.</small>
                : <button className="btn ghost small kg-konsult-btn" data-testid="konsult-iste" disabled={busy || (vaka?.konsultLeft ?? 0) <= 0} onClick={() => void ask()}><KgIcon name="konsult" size={18} /> Takımına danış ({vaka?.konsultLeft ?? 0} hak)</button>
          )}
          <button className="btn" data-testid="karara-gec" disabled={!tests.length} onClick={() => { audio.play('tap'); setAdim('tani'); }}>{tests.length ? 'Karar ver' : 'Önce bir test iste'}</button>
        </div>
      )}

      {adim === 'tani' && (
        <div className="kg-karar" data-testid="tani-adim">
          <h3>Olası tanı</h3>
          <div className="kg-opts">{dxOpts.map((o) => <button key={o.id} className={`kg-opt${dx === o.id ? ' on' : ''}`} data-dx={o.id} onClick={() => { audio.play('tap'); setDx(o.id); }}>{duzey === 'genel' ? o.sade : o.teknik}</button>)}</div>
          <h3>Ne yaparsın?</h3>
          <div className="kg-opts">{mgOpts.map((o) => <button key={o.id} className={`kg-opt${mg === o.id ? ' on' : ''}`} data-mg={o.id} onClick={() => { audio.play('tap'); setMg(o.id); }}>{o.sade}</button>)}</div>
          <div className="row gap"><button className="btn ghost small" onClick={() => setAdim('test')}>Testlere dön</button><button className="btn grow" data-testid="karar-gonder" disabled={!dx || !mg || busy} onClick={() => void send()}>Kararı gönder</button></div>
        </div>
      )}

      {adim === 'sonuc' && res && (
        <div className="kg-sonuc" data-testid="vaka-sonuc" data-stars={res.stars}>
          <div className="kg-sonuc-top"><Stars n={res.stars} size={30} /><b>{res.stars === 0 ? 'Bu sefer olmadı' : res.stars === 3 ? 'Mükemmel karar!' : 'Doğru tanı!'}</b></div>
          <ul className="kg-check">
            <li className={res.dxOk ? 'ok' : 'no'}><Art name={res.dxOk ? 'check' : 'cross'} size={18} /> Tanı: {taniById(res.correctDx)?.[duzey === 'genel' ? 'sade' : 'teknik']}</li>
            <li className={res.mgOk ? 'ok' : 'no'}><Art name={res.mgOk ? 'check' : 'cross'} size={18} /> Yönetim: {v.yonetim[0].sade}</li>
            <li className={res.efficient ? 'ok' : 'no'}><Art name={res.efficient ? 'check' : 'cross'} size={18} /> Test seçimi: {res.efficient ? 'verimli' : `anahtar testler: ${v.anahtar.map((k) => VAKA_TESTLERI.find((t) => t.id === k)!.kisa).join(', ')} (en çok ${v.anahtar.length + 1} test)`}</li>
          </ul>
          <div className="kg-aciklama"><p>{v.aciklama.sade}</p><MoreLine text={v.aciklama.teknik} /></div>
          <Terim id={v.terim} />
          {odulOgeleri(res.reward).length > 0 && <div className="kg-odul" data-testid="vaka-odul">{odulOgeleri(res.reward).map((i, k) => <span key={k} className="kg-odul-chip">{i.label ?? `${i.amount} ${i.kind === 'jeton' ? 'jeton' : 'kristal'}`}</span>)}</div>}
          {res.stars > 0 && res.reward.malzeme && <small className="kg-note">{REMEDY_DISCLAIMER}</small>}
          <small className="kg-kaynak">Kaynak: {v.kaynak}</small>
          <div className="row gap">
            {res.stars === 0 ? <button className="btn grow" onClick={() => { setAdim('hasta'); setTests([]); setDx(null); setMg(null); setRes(null); }}>Yeniden dene</button>
              : <button className="btn grow" data-testid="salona-don" onClick={onBack}>{replay ? 'Vaka Defteri’ne dön' : 'Bekleme salonuna dön'}</button>}
          </div>
        </div>
      )}
    </KgSheet>
  );
}

function Terim({ id }: { id: string }) {
  const t = terimOf(id); if (!t) return null;
  return <div className="kg-terim" data-testid="vaka-terim"><Art name="bulb" size={20} /><div><small>Kulak Sözlüğü</small><b>{t.term}</b><p>{t.plain}</p></div></div>;
}

function SonucKart({ v, id, duzey }: { v: Vaka; id: string; duzey: 'genel' | 'odyoloji' }) {
  const def = VAKA_TESTLERI.find((t) => t.id === id)!; const x = (v.testler as unknown as Record<string, unknown>)[id];
  const yok = isYok(x);
  return (
    <div className={`kg-sonuc-kart${yok ? ' yok' : ''}`} data-sonuc={id}>
      <div className="kg-sk-head"><TestIcon id={id} size={22} /><b>{def.ad}</b></div>
      {!yok && id === 'odyometri' && <><OdyogramSvg o={x as Odyogram} normalBand={duzey === 'genel'} /><OdyogramLejant /></>}
      {!yok && id === 'timpanometri' && <><TimpanogramSvg R={(x as { R: Timp | null }).R} L={(x as { L: Timp | null }).L} /><div className="kg-legend"><span><i className="sym line r" aria-hidden /> Sağ</span><span><i className="sym line l" aria-hidden /> Sol</span><span><i className="sym box" aria-hidden /> Normal bölge</span></div></>}
      {!yok && id === 'otoskopi' && <div className="kg-oto-row">{(['R', 'L'] as Ear[]).map((e) => { const f = (x as Record<Ear, Otoskopi | null>)[e]; return <figure key={e}>{f ? <OtoskopSvg f={f} ear={e} size={96} /> : <span className="kg-oto-yok">—</span>}<figcaption>{KULAK[e]}</figcaption></figure>; })}</div>}
      <ul className="kg-sk-lines">{testSatirlari(v, id, duzey).map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}
