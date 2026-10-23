/**
 * Kamp ekranına küçük kancalar: üst göstergede "Görevler" (rozet: alınmayı bekleyen ödül) ve "Klinik" (bekleyen hasta) düğmeleri,
 * açık paneli çizen kök (GorevHost) ve bina panellerindeki giriş düğmeleri (Klinik → Hasta Vakaları, Odyometri Odası → Ton Avı,
 * Kule → Timpanogram Eşleştir). Özellikler sunucunun söylediğiyle açılır (geçilen bölüm; yönetici modunda hepsi).
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
  return <OyunPanel oyun={p.oyun} />;
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
  const g = kg.oyun.find((x) => KAMP_OYUN[x.oyun].bina === id);
  if (g?.open) return (
    <button className="btn kg-bina-btn" data-testid={`bina-${g.oyun}`} onClick={() => go(() => openPanel({ kind: 'oyun', oyun: g.oyun }))}>
      <KgIcon name={KAMP_OYUN[g.oyun].art} size={22} /> {KAMP_OYUN[g.oyun].ad} oyna · ödüllü tur {Math.max(0, g.cap - g.rewarded)}
    </button>
  );
  return null;
}
