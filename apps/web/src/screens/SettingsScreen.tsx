import { useId, useRef, useState } from 'react';
import { audio } from '@odi/audio';
import { useStore } from '../store';
import { ScreenHead, systemPrefersReducedMotion } from '../ui/bits';
import { hapticsSupported } from '../platform';
import { TuyDede } from '../ftue/Narrator';
import { ActionButton } from '../ui/Button';
import { Art, Glyph } from '../ui/art';
import { Sheet } from '../ui/social';
import { resetEverything } from '../reset';
import { speakLine, useVoiceStatus } from '../ftue/voice';
import { CodeSettingsCard } from '../codes/Codes';
import { GeriBildirimKart } from './GeriBildirimKart';
import { KurucuSecim } from '../kurucu/Kurucular';
import { lineText } from '../ftue/script';
import { LegalSheet, type YasalSayfa } from './LegalSheet';
import { APP_VERSION } from '../legal';
import { AYAR } from '../yasal/yasal';
import { useNet } from '@odi/net/store';

declare const __ODI_E2E__: boolean | undefined;
const E2E = typeof __ODI_E2E__ !== 'undefined' && !!__ODI_E2E__;

/** 0-1 kaydırıcı (yüzde gösterir); üstünde görünür adı (yalnız simgeyle ayırt edilmesin), dolgu rengi CSS değişkeniyle */
function Slider({ icon, name, label, value, onChange, onRelease, disabled }: { icon: string; name: string; label: string; value: number; onChange: (v: number) => void; onRelease?: () => void; disabled?: boolean }) {
  const pct = Math.round(value * 100); const id = useId();
  return (
    <div className={`vol-slider${disabled ? ' off' : ''}`}>
      <div className="row between"><label className="vl" htmlFor={id}><span className="vi" aria-hidden><Glyph e={icon} size={22} /></span>{name}</label><span className="vv">%{pct}</span></div>
      <input id={id} className="range" type="range" min={0} max={100} step={5} value={pct} disabled={disabled} aria-label={label}
        style={{ ['--p' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value) / 100)} onPointerUp={onRelease} onKeyUp={onRelease} />
    </div>
  );
}

/** Açık/Kapalı seçimi: iki seçenek yan yana, vurgulu olan şu anki durum (tek düğmede "Açık" durum mu eylem mi belli değildi) */
function OnOff({ label, on, onChange, testid }: { label: string; on: boolean; onChange: (v: boolean) => void; testid?: string }) {
  return (
    <div className="seg onoff" role="radiogroup" aria-label={label} data-testid={testid}>
      <button type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => onChange(true)}>Açık</button>
      <button type="button" role="radio" aria-checked={!on} className={on ? '' : 'on'} onClick={() => onChange(false)}>Kapalı</button>
    </div>
  );
}

export function SettingsScreen({ onBack, onReplay, onReset }: { onBack: () => void; onReplay?: () => void; onReset?: () => void }) {
  const s = useStore();
  const lastPreview = useRef(0);
  const [ask, setAsk] = useState(false); const [busy, setBusy] = useState(false); const [legal, setLegal] = useState<YasalSayfa | null>(null);
  const me = useNet((x) => x.me);
  void onReset; // eski arayüz: sıfırlama artık uygulamayı baştan kurar
  const preview = () => { const t = performance.now(); if (t - lastPreview.current > 250) { lastPreview.current = t; audio.play('coin'); } };
  const canVibrate = hapticsSupported(); const systemMotion = systemPrefersReducedMotion();
  return (
    <div className="screen fade-in">
      <ScreenHead title="Ayarlar" onBack={onBack} />
      <div className="card vol-row" data-testid="sesler-ayar">
        <div className="row between set-row"><div className="set-text"><h2>Sesler</h2><div className="muted">Müzik, efektler ve anlatıcı; kapalıyken hepsi susar</div></div>
          <OnOff label="Sesler" on={s.sounds} onChange={s.setSounds} testid="sesler" /></div>
        <Slider icon="🎵" name="Müzik" label="Müzik ses düzeyi" value={s.musicVol} disabled={!s.sounds} onChange={(v) => s.setVolumes({ musicVol: v })} />
        <Slider icon="🔔" name="Efektler" label="Efekt ses düzeyi" value={s.sfxVol} disabled={!s.sounds} onChange={(v) => s.setVolumes({ sfxVol: v })} onRelease={preview} />
        <div className="muted small-note">Not: Telefon sessiz moddayken de oyun sesleri çalabilir (uygulama içi tarayıcı sessiz anahtarını her zaman dikkate almaz). Sesi buradan kısabilir ya da kapatabilirsin.</div>
      </div>
      <div className="card vol-row">
        <div className="row between set-row"><div className="row set-text" style={{ gap: 10 }}><TuyDede size={52} /><div><h2>Anlatıcı sesi</h2><div className="muted">Tüy Dede anlatırken sesli okusun (yazı hep görünür)</div></div></div>
          <OnOff label="Anlatıcı sesi" on={s.narratorVoice} onChange={s.setNarratorVoice} testid="anlatici-sesi" /></div>
        {/* anlatıcı da genel ses anahtarına bağlı (ses motorunun ana kazancı; bkz. ftue/voice.ts): kapalıyken bunu yazıyla söyle */}
        {!s.sounds && <div className="set-note" role="status" data-testid="anlatici-susuyor"><Art name="mute" size={18} className="art-inline" /> Sesler kapalı: anlatıcı da susuyor. Duymak için yukarıdan Sesler’i aç (müzik ve efektleri kaydırıcıyla kısabilirsin).</div>}
        {/* anlatıcının kendi düzeyi (efekt kaydırıcısından bağımsız); konuşurken de anında değişir */}
        <Slider icon="💬" name="Anlatıcı" label="Anlatıcı ses düzeyi" value={s.voiceVol} disabled={!s.sounds || !s.narratorVoice} onChange={(v) => s.setVolumes({ voiceVol: v })} />
        {onReplay && <ActionButton tone="teal" icon="play" onClick={onReplay}>Hikâyeyi yeniden izle</ActionButton>}
        <VoiceReadout details={E2E || s.ftue.admin === true} />
        <small className="muted credit" data-testid="ses-lisansi">Anlatıcı sesi: Chatterbox Multilingual (Resemble AI, MIT) · temel tını Kokoro-82M (Apache-2.0) · sentetik ses, Perth filigranlı</small>
      </div>
      <div className="card vol-row" data-testid="buyuk-yazi-ayar">
        <div className="row between set-row"><div className="set-text"><h2>Büyük yazı</h2><div className="muted">Menülerde, sohbette ve bölüm içi göstergelerde yazılar daha büyük görünür</div></div>
          <OnOff label="Büyük yazı" on={s.bigText} onChange={s.setBigText} testid="buyuk-yazi" /></div>
      </div>
      <div className="card vol-row" data-testid="hareket-ayar">
        <div className="row between set-row"><div className="set-text"><h2>Hareketi azalt</h2><div className="muted">Menü canlandırmaları ve kutlamalar sadeleşir, bölümlerde ekran flaşları kapanır</div></div>
          {systemMotion ? <span className="set-fixed" data-testid="hareket-sistem">Telefon ayarından açık</span> : <OnOff label="Hareketi azalt" on={s.reduceMotion} onChange={s.setReduceMotion} testid="hareket-azalt" />}</div>
      </div>
      <div className="card vol-row" data-testid="titresim-ayar">
        <div className="row between set-row"><div className="set-text"><h2>Titreşim</h2><div className="muted">Zıplama, hasar, kontrol noktası ve ödüllerde telefon kısaca titrer</div></div>
          {canVibrate ? <OnOff label="Titreşim" on={s.haptics} onChange={s.setHaptics} testid="titresim" /> : <span className="set-fixed" data-testid="titresim-yok">Bu cihaz desteklemiyor</span>}</div>
        {!canVibrate && <div className="muted small-note">Bu tarayıcı titreşimi desteklemiyor (ör. iPhone’da Safari); oyun burada titremez.</div>}
      </div>
      <div className="card know-card" data-testid="bilgi-duzeyi">
        <div><h2>Bilgi düzeyi</h2><div className="muted">Odyoloji öğrencisiysen Tüy Dede’nin notları ayrıntılı açılır, bilgi yarışması daha teknik sorular seçer.</div></div>
        <div className="seg" role="radiogroup" aria-label="Bilgi düzeyi">
          <button type="button" role="radio" aria-checked={s.knowledge === 'genel'} className={s.knowledge === 'genel' ? 'on' : ''} onClick={() => s.setKnowledge('genel')}>Genel</button>
          <button type="button" role="radio" aria-checked={s.knowledge === 'odyoloji'} className={s.knowledge === 'odyoloji' ? 'on' : ''} onClick={() => s.setKnowledge('odyoloji')}>Odyoloji öğrencisi</button>
        </div>
      </div>
      <CodeSettingsCard />
      <KurucuSecim />
      <GeriBildirimKart />
      <div className="card skill" data-testid="hesap-sil-kart"><div><h2>Hesabı sil</h2><div className="muted">Sunucudaki hesabın (adın, takım üyeliğin, arkadaşların, mesajların) ve bu cihazdaki ilerleme, jetonlar ve ayarlar silinir; oyun hikâyeyle baştan başlar.</div></div><button className="btn coral small" data-testid="sifirla" onClick={() => { setLegal(null); setAsk(true); }}>Hesabı sil</button></div>
      {ask && (
        <Sheet title="Hesabın silinsin mi?" onClose={() => { if (!busy) setAsk(false); }}>
          <div className="reset-sheet" data-testid="sifirla-onay">
            <p className="rs-warn"><Art name="trash" size={22} /> Her şey silinecek: hesabın, ilerleme, jetonlar, satın aldıkların, takım üyeliği, arkadaşlar, mesajlar, ayarlar.</p>
            <p className="muted">Bu cihazda yeni bir oyuncu olarak, hikâyeyle baştan başlarsın. Geri alınamaz. İnternet bağlantın yoksa sunucudaki hesabın silinemez; yalnızca bu cihaz sıfırlanır.{me ? <> O durumda silmeyi e-postayla isteyebilmek için arkadaş kodunu not al: <b className="mono">{me.friendCode}</b>.</> : null}</p>
            <div className="rs-actions">
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setAsk(false)}>Vazgeç</button>
              <button type="button" className="btn coral" data-testid="sifirla-evet" disabled={busy} onClick={() => { setBusy(true); void resetEverything(); }}>{busy ? 'Siliniyor…' : 'Her şeyi sil'}</button>
            </div>
          </div>
        </Sheet>
      )}
      <div className="card legal-card" data-testid="gizlilik-hesap"><div><h2>Gizlilik ve hesap</h2><div className="muted">Hangi veriyi neden tuttuğumuz, hesabını nasıl sileceğin, bize nasıl ulaşacağın.</div></div>
        <div className="legal-nav">
          <button type="button" className="btn small ghost" data-testid="gizlilik-ac" onClick={() => setLegal('gizlilik')}>Gizlilik</button>
          <button type="button" className="btn small ghost" data-testid="hesap-sil-ac" onClick={() => setLegal('hesap-sil')}>Hesap silme</button>
          <button type="button" className="btn small ghost" data-testid="hakkinda-ac" onClick={() => setLegal('hakkinda')}>Hakkında / iletişim</button>
        </div>
      </div>
      {legal && <LegalSheet sayfa={legal} onClose={() => setLegal(null)} onDelete={() => { setLegal(null); setAsk(true); }} />}
      <div className="muted" data-testid="surum">ODİ: Sesin Yolu · sürüm {APP_VERSION} · {AYAR.YAYINCI}</div>
    </div>
  );
}

/**
 * "Sesi dene" bir satır çalar. Teşhis satırı (kayıt ✓ / cihaz sesi / sessiz, kaynak, çözülen kayıt, son hata) yalnız uçtan uca
 * test derlemesinde ve yönetici modunda: oyuncuya geliştirici ayrıntısı gösterilmez.
 */
function VoiceReadout({ details }: { details: boolean }) {
  const v = useVoiceStatus();
  if (!details) return (
    <div className="row between voice-try"><span className="muted">Tüy Dede’nin sesini dinle</span>
      <button type="button" className="btn small ghost" onClick={() => speakLine(lineText('hikaye-01'), 'hikaye-01')}>Sesi dene</button></div>
  );
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
