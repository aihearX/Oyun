import { useRef, useState } from 'react';
import { audio } from '@odi/audio';
import { useStore } from '../store';
import { ScreenHead } from '../ui/bits';
import { TuyDede } from '../ftue/Narrator';
import { ActionButton } from '../ui/Button';
import { Art, Glyph } from '../ui/art';
import { Sheet } from '../ui/social';
import { resetEverything } from '../reset';
import { speakLine, useVoiceStatus } from '../ftue/voice';
import { CodeSettingsCard } from '../codes/Codes';
import { lineText } from '../ftue/script';
import { LegalSheet } from './LegalSheet';
import { APP_VERSION } from '../legal';

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
  const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false); const [legal, setLegal] = useState(false);
  void onReset; // eski arayüz: sıfırlama artık uygulamayı baştan kurar
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
        {/* anlatıcının kendi düzeyi (efekt kaydırıcısından bağımsız); konuşurken de anında değişir */}
        <Slider icon="💬" label="Anlatıcı ses düzeyi" value={s.voiceVol} disabled={!s.sounds || !s.narratorVoice} onChange={(v) => s.setVolumes({ voiceVol: v })} />
        {onReplay && <ActionButton tone="teal" icon="play" onClick={onReplay}>Hikâyeyi yeniden izle</ActionButton>}
        <VoiceReadout />
        <small className="muted credit" data-testid="ses-lisansi">Anlatıcı sesi: Chatterbox Multilingual (Resemble AI, MIT) · temel tını Kokoro-82M (Apache-2.0) · sentetik ses, Perth filigranlı</small>
      </div>
      <div className="card vol-row" data-testid="buyuk-yazi-ayar">
        <div className="row between"><div><h2>Büyük yazı</h2><div className="muted">Menülerde ve sohbette yazılar daha büyük görünür (oyun içi göstergeler değişmez)</div></div>
          <button type="button" className={`btn small toggle-btn${s.bigText ? '' : ' ghost'}`} data-testid="buyuk-yazi" onClick={() => s.setBigText(!s.bigText)} aria-pressed={s.bigText} aria-label="Büyük yazı">{s.bigText ? 'Açık' : 'Kapalı'}</button></div>
      </div>
      <div className="card know-card" data-testid="bilgi-duzeyi">
        <div><h2>Bilgi düzeyi</h2><div className="muted">Odyoloji öğrencisiysen Tüy Dede’nin notları ayrıntılı açılır, bilgi yarışması daha teknik sorular seçer.</div></div>
        <div className="seg" role="radiogroup" aria-label="Bilgi düzeyi">
          <button type="button" role="radio" aria-checked={s.knowledge === 'genel'} className={s.knowledge === 'genel' ? 'on' : ''} onClick={() => s.setKnowledge('genel')}>Genel</button>
          <button type="button" role="radio" aria-checked={s.knowledge === 'odyoloji'} className={s.knowledge === 'odyoloji' ? 'on' : ''} onClick={() => s.setKnowledge('odyoloji')}>Odyoloji öğrencisi</button>
        </div>
      </div>
      <CodeSettingsCard />
      <div className="card skill"><div><h2>Her şeyi sıfırla</h2><div className="muted">Bu cihazdaki ilerleme, jetonlar ve ayarlar ile sunucudaki hesabın (adın, takım üyeliğin, arkadaşların, mesajların) silinir; oyun hikâyeyle baştan başlar.</div></div><button className="btn coral small" data-testid="sifirla" onClick={() => setAsk(true)}>Sıfırla</button></div>
      {ask && (
        <Sheet title="Her şey silinsin mi?" onClose={() => { if (!busy) setAsk(false); }}>
          <div className="reset-sheet" data-testid="sifirla-onay">
            <p className="rs-warn"><Art name="trash" size={22} /> Her şey silinecek: ilerleme, jetonlar, takım üyeliği, arkadaşlar, mesajlar, ayarlar.</p>
            <p className="muted">Bu cihazda yeni bir oyuncu olarak, hikâyeyle baştan başlarsın. Geri alınamaz. İnternet bağlantın yoksa sunucudaki hesabın silinemez; yalnızca bu cihaz sıfırlanır.</p>
            <div className="rs-actions">
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setAsk(false)}>Vazgeç</button>
              <button type="button" className="btn coral" data-testid="sifirla-evet" disabled={busy} onClick={() => { setBusy(true); void resetEverything(); }}>{busy ? 'Siliniyor…' : 'Her şeyi sil'}</button>
            </div>
          </div>
        </Sheet>
      )}
      <div className="card skill"><div><h2>Gizlilik ve hakkında</h2><div className="muted">Hangi veriyi neden tuttuğumuz, silme hakkın ve sürüm bilgisi.</div></div><button className="btn small ghost" data-testid="gizlilik-ac" onClick={() => setLegal(true)}>Oku</button></div>
      {legal && <LegalSheet onClose={() => setLegal(false)} />}
      <div className="muted">ODİ: Sesin Yolu · sürüm {APP_VERSION}</div>
    </div>
  );
}

/** cihazda ne olduğunu görmek için: kayıt ✓ / cihaz sesi / sessiz + son hata; "Sesi dene" bir satır çalar */
function VoiceReadout() {
  const v = useVoiceStatus();
  const label = v.mode === 'kayıt' ? 'kayıt ✓' : v.mode === 'cihaz sesi' ? 'cihaz sesi (erkek)' : v.mode === 'sessiz' ? 'sessiz (erkek ses yok, yazı var)' : 'henüz konuşmadı';
  return (
    <div className="voice-readout" data-testid="ses-durumu" data-mode={v.mode ?? ''}>
      <div className="row between"><span><b>Anlatıcı sesi:</b> {label}</span>
        <button type="button" className="btn small ghost" onClick={() => speakLine(lineText('hikaye-01'), 'hikaye-01')}>Sesi dene</button></div>
      <small className="muted">{v.source ? `kaynak: ${v.source} · ` : ''}çözülen kayıt: {v.decoded}{v.line ? ` · son satır: ${v.line}` : ''}</small>
      {v.error && <small className="vr-err">Son hata: {v.error}</small>}
    </div>
  );
}
