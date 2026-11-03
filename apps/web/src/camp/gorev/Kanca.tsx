/**
 * Kamp ekranına küçük kancalar: üst göstergede "Görevler" (rozet: alınmayı bekleyen ödül) ve "Klinik" (bekleyen hasta) düğmeleri,
 * açık paneli çizen kök (GorevHost) ve bina panellerindeki giriş düğmeleri (Klinik → Hasta Vakaları, Odyometri Odası → Ton Avı,
 * Kule → Timpanogram Eşleştir; liste kartında da). Özellikler sunucunun söylediğiyle açılır (geçilen bölüm; yönetici modunda hepsi).
 * Hasta Vakaları'nın yeri Klinik kartında ve panelinde de söylenir (KlinikVakaSatiri): kurulmadıysa "Kurunca: Hasta Vakaları açılır".
 */
import { useEffect } from 'react';
import type { BuildingId } from '@odi/shared';
import { KAMP_OYUN } from '@odi/content';
import { audio } from '@odi/audio';
import { useNet } from '@odi/net/store';
import { KgIcon } from './art';
import { GorevPanel } from './GorevPanel';
import { KlinikPanel } from './Klinik';
import { OyunPanel } from './Oyunlar';
import { openPanel, refreshKg, useKg } from './state';
import './gorev.css';

export function GorevChips() {
  const kg = useKg((s) => s.kg); const st = useNet((s) => s.status);
  useEffect(() => { if (st === 'bağlı' && !kg) void refreshKg(); }, [st]);
  if (!kg?.open.gorev) return null;
  return (
    <>
      <button className={`hud-chip kg-chip${kg.claimable ? ' ready' : ''}`} data-testid="kg-btn" aria-label={`Görevler${kg.claimable ? `, ${kg.claimable} ödül hazır` : ''}`} onClick={() => { audio.play('tap'); openPanel({ kind: 'gorev', tab: kg.story.chapter?.done ? 'hikaye' : 'gunluk' }); }}>
        <KgIcon name="gorev" size="1.25em" /> Görevler{kg.claimable > 0 && <i className="kg-badge" data-testid="kg-rozet">{kg.claimable}</i>}
      </button>
      {kg.vaka.open && (
        <button className="hud-chip kg-chip klinik" data-testid="klinik-btn" aria-label={`Klinik, ${kg.vaka.waiting} hasta bekliyor`} onClick={() => { audio.play('tap'); openPanel({ kind: 'klinik', tab: 'salon' }); }}>
          <KgIcon name="klinik" size="1.25em" /> Klinik{kg.vaka.waiting > 0 && <i className="kg-badge teal">{kg.vaka.waiting}</i>}
        </button>
      )}
    </>
  );
}

export function GorevHost() {
  const p = useKg((s) => s.panel);
  useEffect(() => () => { openPanel(null); }, []);
  if (!p) return null;
  if (p.kind === 'gorev') return <GorevPanel tab={p.tab} />;
  if (p.kind === 'klinik') return <KlinikPanel tab={p.tab} vakaId={p.vaka} replay={p.replay} />;
  return <OyunPanel key={p.oyun} oyun={p.oyun} />;
}

/** Odyoloji Kliniği kartı/paneli: Hasta Vakaları nerede, ne zaman açılır; açıksa giriş düğmesi */
export function KlinikVakaSatiri({ level, onOpen }: { level: number; onOpen?: () => void }) {
  const kg = useKg((s) => s.kg);
  if (level < 1) return <div className="muted small-note kg-vaka-satir" data-testid="klinik-vaka-not"><KgIcon name="klinik" size={16} className="art-inline" /> Kurunca: Hasta Vakaları açılır (kurgusal hastalara test iste, karar ver)</div>;
  if (!kg) return null;
  if (kg.vaka.open) return (
    <button className="btn small ghost kg-vaka-satir" data-testid="klinik-vaka-giris" onClick={() => { audio.play('tap'); onOpen?.(); setTimeout(() => openPanel({ kind: 'klinik', tab: 'salon' }), 0); }}>
      <KgIcon name="klinik" size={18} /> Hasta Vakaları: {kg.vaka.waiting > 0 ? `${kg.vaka.waiting} hasta bekliyor` : 'şu an bekleyen yok'}
    </button>
  );
  return kg.vaka.locked ? <div className="muted small-note kg-vaka-satir" data-testid="klinik-vaka-not"><KgIcon name="klinik" size={16} className="art-inline" /> Hasta Vakaları: {kg.vaka.locked}</div> : null;
}

/** bina panelinde kamp etkinliği girişi */
export function KgBinaKanca({ id, onClose }: { id: BuildingId; onClose: () => void }) {
  const kg = useKg((s) => s.kg);
  if (!kg) return null;
  const go = (f: () => void) => { audio.play('tap'); onClose(); setTimeout(f, 0); };
  if (id === 'revir' && kg.vaka.open) return (
    <button className="btn kg-bina-btn" data-testid="bina-vaka" onClick={() => go(() => openPanel({ kind: 'klinik', tab: 'salon' }))}>
      <KgIcon name="klinik" size={22} /> Hasta Vakaları{kg.vaka.waiting > 0 ? ` · ${kg.vaka.waiting} hasta bekliyor` : ''}
    </button>
  );
  if (id === 'revir' && kg.vaka.locked) return <KlinikVakaSatiri level={1} />;
  return <KgOyunGiris id={id} onOpen={onClose} />;
}

/**
 * Kamp oyununun binadaki kalıcı girişi (Odyometri Odası → Ton Avı, Timpanometri Kulesi → Timpanogram Eşleştir): bina paneli ve liste
 * görünümünün kartı. Açıksa "Oyna"; değilse ne gerektiği (sunucunun dürüst nedeni: "Timpanometri Kulesi’ni kur", "Bölüm N’de açılır").
 * Ton Avı'nın düğmesi sesle oynandığını söyler; Timpanogram'ınki Ton Avı'ndan sayılabilecek ödüllü turları da gösterir (karar 44).
 */
export function KgOyunGiris({ id, onOpen }: { id: BuildingId; onOpen?: () => void }) {
  const kg = useKg((s) => s.kg);
  const g = kg?.oyun.find((x) => KAMP_OYUN[x.oyun].bina === id);
  if (!g) return null;
  const o = KAMP_OYUN[g.oyun];
  if (!g.open) return g.locked ? <div className="muted small-note kg-vaka-satir" data-testid={`giris-${g.oyun}-kilit`}><KgIcon name={o.art} size={16} className="art-inline" /> {o.ad}: {g.locked}</div> : null;
  return (
    <button className="btn kg-bina-btn" data-testid={`bina-${g.oyun}`} onClick={() => { audio.play('tap'); onOpen?.(); setTimeout(() => openPanel({ kind: 'oyun', oyun: g.oyun }), 0); }}>
      <KgIcon name={o.art} size={22} /> {o.ad} oyna{g.oyun === 'ton' ? ' · sesle oynanır' : ''} · ödüllü tur {Math.max(0, g.cap - g.rewarded)}{g.oyun === 'timpano' && g.ortak > 0 ? ` (+${g.ortak} Ton Avı’ndan)` : ''}
    </button>
  );
}
