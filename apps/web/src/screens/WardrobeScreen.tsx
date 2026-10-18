import { COSMETICS, cosmeticUnlockText, cosmeticById, type CosmeticDef } from '@odi/content';
import { resolveLook } from '@odi/meta';
import { useStore } from '../store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { ScreenHead } from '../ui/bits';
import { platform } from '../platform';

/** Dolap: Odi renkleri ve şapkaları. Yalnızca görünüm; seçilen kozmetik oyunda da görünür. */
export function WardrobeScreen({ onBack }: { onBack: () => void }) {
  const s = useStore(); const look = resolveLook(s.meta); const owned = new Set(s.meta.cosmetics.owned);
  const baseColor = cosmeticById(s.meta.cosmetics.color)?.color;
  const tile = (c: CosmeticDef) => {
    const has = owned.has(c.id); const on = s.meta.cosmetics.color === c.id || s.meta.cosmetics.hat === c.id;
    return (
      <button key={c.id} className={`wtile${has ? '' : ' locked'}${on ? ' on' : ''}`} disabled={!has} onClick={() => { s.equip(c.id); platform().haptic('light'); }} aria-pressed={on} aria-label={`${c.name}${has ? '' : ', kilitli'}`}>
        <OdiAvatar size={52} color={c.kind === 'renk' ? c.color : baseColor} hat={c.kind === 'sapka' ? c.hat : c.hat} />
        <b>{c.name}</b>
        <span className="muted">{has ? (on ? 'Giyili' : 'Giy') : `🔒 ${cosmeticUnlockText(c.unlock)}`}</span>
      </button>
    );
  };
  return (
    <div className="screen fade-in">
      <ScreenHead title="Dolap" onBack={onBack} right={<span className="pill">{owned.size}/{COSMETICS.length}</span>} />
      <div className="card wardrobe-hero"><OdiAvatar size={120} color={look.color} hat={look.hat} mood="wow" /><div className="muted">Kozmetikler yalnızca görünüştür; oyun gücü vermez.</div></div>
      <h2>Renkler</h2><div className="wgrid">{COSMETICS.filter((c) => c.kind === 'renk').map(tile)}</div>
      <h2>Şapkalar</h2><div className="wgrid">{COSMETICS.filter((c) => c.kind === 'sapka').map(tile)}</div>
    </div>
  );
}
