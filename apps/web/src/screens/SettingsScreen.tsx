import { useRef } from 'react';
import { audio } from '@odi/audio';
import { useStore } from '../store';
import { ScreenHead } from '../ui/bits';
import { TuyDede } from '../ftue/Narrator';
import { ActionButton } from '../ui/Button';
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

export function SettingsScreen({ onBack, onReplay, onReset }: { onBack: () => void; onReplay?: () => void; onReset?: () => void }) {
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
      <div className="card vol-row">
        <div className="row between"><div className="row" style={{ gap: 10 }}><TuyDede size={52} /><div><h2>Anlatıcı sesi</h2><div className="muted">Tüy Dede anlatırken sesli okusun (yazı hep görünür)</div></div></div>
          <button className={`btn small toggle-btn${s.narratorVoice ? '' : ' ghost'}`} onClick={() => s.setNarratorVoice(!s.narratorVoice)} aria-pressed={s.narratorVoice} aria-label="Anlatıcı sesi">{s.narratorVoice ? 'Açık' : 'Kapalı'}</button></div>
        {onReplay && <ActionButton tone="teal" icon="play" onClick={onReplay}>Hikâyeyi yeniden izle</ActionButton>}
        <small className="muted credit" data-testid="ses-lisansi">Anlatıcı sesi: Coqui TTS, Fatih Akademi Türkçe modeli (MIT)</small>
      </div>
      <div className="card know-card" data-testid="bilgi-duzeyi">
        <div><h2>Bilgi düzeyi</h2><div className="muted">Odyoloji öğrencisiysen Tüy Dede’nin notları ayrıntılı açılır, bilgi yarışması daha teknik sorular seçer.</div></div>
        <div className="seg" role="radiogroup" aria-label="Bilgi düzeyi">
          <button type="button" role="radio" aria-checked={s.knowledge === 'genel'} className={s.knowledge === 'genel' ? 'on' : ''} onClick={() => s.setKnowledge('genel')}>Genel</button>
          <button type="button" role="radio" aria-checked={s.knowledge === 'odyoloji'} className={s.knowledge === 'odyoloji' ? 'on' : ''} onClick={() => s.setKnowledge('odyoloji')}>Odyoloji öğrencisi</button>
        </div>
      </div>
      <div className="card skill"><div><h2>İlerlemeyi sıfırla</h2><div className="muted">Yıldızlar, jetonlar, yetenekler, başarımlar, kartlar ve kozmetikler silinir.</div></div><button className="btn coral small" onClick={() => { if (confirm('Tüm ilerleme silinsin mi? Oyun baştan, hikâyeyle başlar.')) { s.reset(); onReset?.(); } }}>Sıfırla</button></div>
      <div className="muted">ODİ: Sesin Yolu · sürüm 0.1 · Faz 1</div>
    </div>
  );
}
