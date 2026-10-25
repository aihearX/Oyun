import { useEffect, useRef, useState } from 'react';
import { useCoach } from '../ftue/Coach';
import { claimOnce } from '../ftue/hints';
import { TuyDede } from '../ftue/Narrator';
import { lineText } from '../ftue/script';
import { speakLine, stopVoiceIf } from '../ftue/voice';
import { Icon } from '../ui/icons';

/** Tüy Dede'nin inşaat sırası satırı (script.ts) */
export const SIRA_LINE = 'kamp-sira-01';

/**
 * İnşaat sırası (MK-011) için tek seferlik Tüy Dede kartı: bir inşaat sürerken "Sıraya al" düğmesi İLK KEZ görününce (bina paneli ya
 * da liste görünümü) bir kez yazılır ve söylenir; oyuncu başına bir kez (FTUE `said`, kalıcı; Sıfırla siler). Bir anlatıcı turu
 * sürerken beklemez-araya girmez: tur bitince, düğme hâlâ görünüyorsa gelir. Tur sayılmaz (MK-007 "bölüm başına en çok 2 açılım
 * turu" sayacına girmez; kamp öğreticisi sırasında düğme zaten görünmez). Kart, onu çizen panel/liste açık kaldıkça durur; kapatılabilir.
 */
export function SiraIpucu({ on, className = '' }: { on: boolean; className?: string }) {
  const touring = useCoach((s) => !!s.tour);
  const [shown, setShown] = useState(false);
  const [closed, setClosed] = useState(false);
  const talk = useRef(-1);
  useEffect(() => { if (on && !shown && !touring && claimOnce(SIRA_LINE)) setShown(true); }, [on, shown, touring]);
  useEffect(() => {
    if (!shown) return;
    talk.current = speakLine(lineText(SIRA_LINE), SIRA_LINE);
    return () => stopVoiceIf(talk.current);
  }, [shown]);
  if (!shown || closed) return null;
  return (
    <aside className={`ear-note dede-card sira-ipucu ${className}`} data-testid="sira-ipucu" data-line={SIRA_LINE} aria-live="polite" aria-label="Tüy Dede">
      <span className="en-face" aria-hidden><TuyDede size={46} talking={false} mood="wink" /></span>
      <div className="en-body">
        <div className="en-k">İnşaat sırası</div>
        <p className="en-plain">{lineText(SIRA_LINE)}</p>
      </div>
      <button type="button" className="en-x" aria-label="Kapat" onClick={() => { stopVoiceIf(talk.current); setClosed(true); }}><Icon name="close" size="0.95em" /></button>
    </aside>
  );
}
