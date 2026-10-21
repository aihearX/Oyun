import { COSMETICS, DEFAULT_COLOR_ID, cosmeticUnlockText, type CosmeticDef } from '@odi/content';
import { odiLook } from '../look';
import { useStore } from '../store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { ScreenHead } from '../ui/bits';
import { platform } from '../platform';
import { Art } from '../ui/art';

/** Dolap: Odi renkleri ve şapkaları. Yalnızca görünüm; seçilen kozmetik oyunda da görünür. */
export function WardrobeScreen({ onBack }: { onBack: () => void }) {
  const s = useStore(); const look = odiLook(s); const owned = new Set(s.meta.cosmetics.owned);
  const baseColor = look.color;
  // seçili renk: Odi'nin rengi (takma adla seçilen ya da burada giyilen) hangi döşemeyse o
  const colorOn = (c: CosmeticDef) => (s.odiColor != null ? s.odiColor === c.color && s.meta.cosmetics.color === c.id : s.meta.cosmetics.color === c.id);
  const own = s.chosenColor;
  const ownOn = own != null && s.odiColor === own && !COSMETICS.some((c) => c.kind === 'renk' && colorOn(c));
  const tile = (c: CosmeticDef) => {
    const has = owned.has(c.id); const on = c.kind === 'renk' ? colorOn(c) : s.meta.cosmetics.hat === c.id;
    return (
      <button key={c.id} className={`wtile${has ? '' : ' locked'}${on ? ' on' : ''}`} disabled={!has} onClick={() => { s.equip(c.id); platform().haptic('light'); }} aria-pressed={on} aria-label={`${c.name}${has ? '' : ', kilitli'}`}>
        <OdiAvatar size={52} color={c.kind === 'renk' ? c.color : baseColor} hat={c.kind === 'sapka' ? c.hat : c.hat} />
        <b>{c.name}</b>
        <span className="muted">{has ? (on ? 'Giyili' : 'Giy') : <><Art name="lock" size="1.15em" className="art-inline" /> {cosmeticUnlockText(c.unlock)}</>}</span>
      </button>
    );
  };
  return (
    <div className="screen fade-in">
      <ScreenHead title="Dolap" onBack={onBack} right={<span className="pill">{owned.size}/{COSMETICS.length}</span>} />
      <div className="card wardrobe-hero"><OdiAvatar size={120} color={look.color} hat={look.hat} mood="wow" /><div className="muted">Kozmetikler yalnızca görünüştür; oyun gücü vermez.</div></div>
      <h2>Renkler</h2><div className="wgrid">
        {own != null && (
          <button className={`wtile${ownOn ? ' on' : ''}`} data-testid="kendi-rengin" onClick={() => { s.equip(DEFAULT_COLOR_ID); s.setOdiColor(own); platform().haptic('light'); }} aria-pressed={ownOn} aria-label="Kendi rengin">
            <OdiAvatar size={52} color={own} hat={look.hat} /><b>Kendi rengin</b><span className="muted">{ownOn ? 'Giyili' : 'Giy'}</span>
          </button>
        )}
        {COSMETICS.filter((c) => c.kind === 'renk').map(tile)}
      </div>
      <h2>Şapkalar</h2><div className="wgrid">{COSMETICS.filter((c) => c.kind === 'sapka').map(tile)}</div>
    </div>
  );
}
