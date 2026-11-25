import { useEffect, useState } from 'react';
import { platform } from '../platform';
import { useStore } from '../store';
import { checkForUpdate, onceThisLaunch, soundWarning, toggleSounds } from '../acilis';
import { Art } from './art';

/** arayüz kurulduktan bu kadar sonra ses kontrolü (ilk ekran otursun) */
const SES_GECIKME_MS = 1500;
/** "sesi açın" şeridi bu kadar görünür kalır (dokunarak da kapanır) */
const SES_SURE_MS = 12000;

/**
 * Açılış uyarıları (1.1.0; yalnız telefon kabuğu, soğuk açılışta bir kez; mantık acilis.ts):
 * - "Daha iyi bir deneyim için sesi açın": küçük, kapatılabilir şerit (kipli değil). Oyunun sesi kapalıysa "Sesi aç" düğmesi.
 * - "Yeni bir sürüm var. Güncellemek ister misiniz?" Evet: mağaza sayfası, Hayır: kapanır.
 * `hold`: bölüm oynanırken (ve bölüme geçişte) gösterilmez; bekler, bölüm bitince çıkar.
 */
export function AcilisUyarilari({ hold }: { hold: boolean }) {
  const [warn, setWarn] = useState<'oyun' | 'cihaz' | null>(null);
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null);
  const soundsOn = useStore((s) => s.sounds);

  useEffect(() => {
    const p = platform(); if (p.kind !== 'native') return;
    let dead = false;
    const t = setTimeout(() => {
      void (async () => {
        if (!(await onceThisLaunch('ses-uyarisi'))) return;
        let vol: number | null = null;
        try { vol = (await p.getMediaVolume?.()) ?? null; } catch { vol = null; }
        const w = soundWarning(useStore.getState().sounds, vol);
        if (!dead && w) setWarn(w);
      })();
    }, SES_GECIKME_MS);
    void (async () => {
      // geliştirme derlemesinde appInfo yok (sürüm bilinmiyor): sorulmaz
      const info = p.appInfo; if (!info) return;
      if (!(await onceThisLaunch('guncelleme'))) return;
      const u = await checkForUpdate({ serverUrl: p.serverUrl(), installed: info.app, platform: info.platform });
      if (!dead && u) setUpdate(u);
    })();
    return () => { dead = true; clearTimeout(t); };
  }, []);

  // oyuncu sesi başka yerden açtıysa (üst çubuk, Ayarlar) şerit kendiliğinden kalkar
  useEffect(() => { if (warn === 'oyun' && soundsOn) setWarn(null); }, [warn, soundsOn]);
  const warnShown = !!warn && !hold;
  useEffect(() => {
    if (!warnShown) return;
    const t = setTimeout(() => setWarn(null), SES_SURE_MS);
    return () => clearTimeout(t);
  }, [warnShown]);

  if (hold) return null;
  const openStore = (url: string) => {
    setUpdate(null);
    const p = platform();
    if (p.openUrl) { try { p.openUrl(url); } catch { /* yok */ } return; }
    try { window.open(url, '_blank', 'noopener'); } catch { /* yok */ }
  };
  return (
    <>
      {warn && (
        <div className="ses-uyari" role="status" aria-live="polite" data-testid="ses-uyarisi">
          <Art name="mute" size={26} />
          <span className="su-t"><b>Daha iyi bir deneyim için sesi açın</b>{warn === 'cihaz' && <small>Telefonunun ses düzeyi kısık görünüyor.</small>}</span>
          {warn === 'oyun' && <button className="btn small" onClick={() => { toggleSounds(); setWarn(null); }} data-testid="ses-uyarisi-ac">Sesi aç</button>}
          <button className="su-x" onClick={() => setWarn(null)} aria-label="Kapat">×</button>
        </div>
      )}
      {update && (
        <div className="overlay acilis-guncelle" style={{ zIndex: 240 }}>
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="guncelle-baslik" data-testid="guncelleme-sorusu">
            <h2 id="guncelle-baslik" style={{ margin: 0 }}>Yeni sürüm var</h2>
            <div className="muted">Yeni bir sürüm var. Güncellemek ister misiniz?</div>
            <button className="btn" onClick={() => openStore(update.url)}>Evet</button>
            <button className="btn ghost" onClick={() => setUpdate(null)}>Hayır</button>
          </div>
        </div>
      )}
    </>
  );
}
