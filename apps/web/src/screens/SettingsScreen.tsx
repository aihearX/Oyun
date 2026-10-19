import { useRef } from 'react';
import { audio } from '@odi/audio';
import { useStore } from '../store';
import { ScreenHead } from '../ui/bits';
import { Glyph } from '../ui/art';

/** 0-1 kaydırıcı (yüzde gösterir); dolgu rengi CSS değişkeniyle */
function Slider({ icon, label, value, onChange, onRelease, disabled }: { icon: string; label: string; value: number; onChange: (v: number) => void; onRelease?: () => void; disabled?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="row">
      <span className="vi" aria-hidden><Glyph e={icon} size={26} /></span>
      <input className="range" type="range" min={0} max={100} step={5} value={pct} disabled={disabled} aria-label={label}
        style={{ ['--p' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value) / 100)} onPointerUp={onRelease} onKeyUp={onRelease} />
      <span className="vv">%{pct}</span>
    </div>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const lastPreview = useRef(0);
  const preview = () => { const t = performance.now(); if (t - lastPreview.current > 250) { lastPreview.current = t; audio.play('coin'); } };
  return (
    <div className="screen fade-in">
      <ScreenHead title="Ayarlar" onBack={onBack} />
      <div className="card vol-row">
        <div className="row between"><div><h2>Sesler</h2><div className="muted">Müzik ve efektler ayrı ayarlanır</div></div>
          <button className={`btn small toggle-btn${s.sounds ? '' : ' ghost'}`} onClick={() => s.setSounds(!s.sounds)} aria-pressed={s.sounds}>{s.sounds ? 'Açık' : 'Kapalı'}</button></div>
        <Slider icon="🎵" label="Müzik ses düzeyi" value={s.musicVol} disabled={!s.sounds} onChange={(v) => s.setVolumes({ musicVol: v })} />
        <Slider icon="🔔" label="Efekt ses düzeyi" value={s.sfxVol} disabled={!s.sounds} onChange={(v) => s.setVolumes({ sfxVol: v })} onRelease={preview} />
        <div className="muted small-note">Not: Telefon sessiz moddayken de oyun sesleri çalabilir (uygulama içi tarayıcı sessiz anahtarını her zaman dikkate almaz). Sesi buradan kısabilir ya da kapatabilirsin.</div>
      </div>
      <div className="card skill"><div><h2>İlerlemeyi sıfırla</h2><div className="muted">Yıldızlar, jetonlar, yetenekler, başarımlar, kartlar ve kozmetikler silinir.</div></div><button className="btn coral small" onClick={() => { if (confirm('Tüm ilerleme silinsin mi?')) s.reset(); }}>Sıfırla</button></div>
      <div className="muted">ODİ: Sesin Yolu · sürüm 0.1 · Faz 1</div>
    </div>
  );
}
