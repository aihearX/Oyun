/**
 * Kurucu Yolcular (YN-041): rozet çipleri, takım listesi için küçük rozet ve profil çerçevesi. Yalnız görünüş; güç vermez.
 * Veri sunucudan gelir (PublicProfile.rozetler / cerceve); rozeti olmayan profilde hiçbir şey çizilmez.
 */
import type { ReactNode } from 'react';
import { ROZETLER, type PublicProfile, type RozetId } from '@odi/shared';
import { Art, type ArtName } from '../ui/art';
import './kurucu.css';

type Rozetli = Pick<PublicProfile, 'rozetler' | 'cerceve'>;
const ART: Record<RozetId, ArtName> = { 'kurucu': 'founder', 'hata-avcisi': 'bughunt' };
const sirali = (p: Rozetli | null | undefined): RozetId[] => (p?.rozetler ?? []).filter((r): r is RozetId => r in ROZETLER);

/** profil kartı / profil: "Kurucu Yolcu" rozeti ve "Hata Avcısı" unvanı (yazılı çip) */
export function RozetCipleri({ p, className }: { p: Rozetli | null | undefined; className?: string }) {
  const list = sirali(p);
  if (!list.length) return null;
  return (
    <span className={`rz-cips${className ? ` ${className}` : ''}`} data-testid="rozetler">
      {list.map((r) => (
        <span key={r} className={`rz-cip rz-${r}`} data-rozet={r} title={ROZETLER[r].aciklama}>
          <Art name={ART[r]} size={18} className="art-inline" /> {ROZETLER[r].ad}
        </span>
      ))}
    </span>
  );
}

/** takım üye listesi: ad yanında küçük rozet simgeleri (ekran okuyucu için adı ile) */
export function RozetMini({ p }: { p: Rozetli | null | undefined }) {
  const list = sirali(p);
  if (!list.length) return null;
  return (
    <span className="rz-mini" data-testid="rozet-mini">
      {list.map((r) => <Art key={r} name={ART[r]} size={18} title={ROZETLER[r].ad} />)}
    </span>
  );
}

/** profil çerçevesi: giyiliyse avatarın çevresinde altın halka ve alt köşede kurucu yıldızı (halka içeriğin boyunu alır; size yıldız için) */
export function Cerceve({ p, size, children }: { p: Rozetli | null | undefined; size: number; children: ReactNode }) {
  if (p?.cerceve !== 'kurucu') return <>{children}</>;
  return (
    <span className="rz-cerceve" data-testid="kurucu-cerceve">
      {children}
      <span className="rz-cerceve-yildiz" aria-hidden><Art name="founder" size={Math.max(16, Math.round(size * 0.3))} /></span>
    </span>
  );
}

export const kurucuMu = (p: Rozetli | null | undefined) => !!p?.rozetler?.includes('kurucu');
