import { useState } from 'react';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS } from '@odi/shared';
import { errText, getNet, toast, useSocial } from '../net';
import { platform } from '../platform';
import { OdiAvatar } from './OdiAvatar';

const COLORS = [0x6c4cf1, 0xff7a59, 0x2ee6d6, 0xffc25c, 0xff4f7a, 0x5b8def, 0x4cd97b, 0xf28fe0];
export const isDefaultName = (n: string) => /^Odi\d{4}$/.test(n);

/** İlk bağlantıda takma ad + renk seçimi (sunucu doğrular). "Sonra" denirse bu oturumda bir daha sorulmaz. */
export function Onboarding() {
  const me = useNet((s) => s.me); const st = useNet((s) => s.status); const dismissed = useSocial((s) => s.onboardDismissed);
  const [name, setName] = useState(''); const [color, setColor] = useState<number | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (!me || st !== 'bağlı' || dismissed || !isDefaultName(me.name)) return null;
  const c = color ?? me.color;
  const save = async () => {
    const n = getNet(); if (!n) return;
    setBusy(true); setErr('');
    try { await n.call('profile.update', { name: name.trim(), color: c }); platform().haptic('success'); toast('👋', `Merhaba ${name.trim()}!`, 'Takımlar ve sohbet seni bekliyor.', 'green'); }
    catch (e) { setErr(errText(e)); platform().haptic('error'); }
    setBusy(false);
  };
  return (
    <div className="overlay onboard-wrap">
      <form className="card onboard" role="dialog" aria-label="Takma adını seç" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <OdiAvatar size={84} color={c} />
        <h2>Sana ne diyelim?</h2>
        <div className="muted">Takım arkadaşların ve sohbette bu adı görecek. Gerçek adını yazmak zorunda değilsin.</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={SOCIAL_LIMITS.nameMax} placeholder="Takma ad (3–16 harf)" aria-label="Takma ad" autoFocus />
        <div className="swatches" role="radiogroup" aria-label="Rengin">{COLORS.map((x) => <button type="button" key={x} role="radio" aria-checked={c === x} className={`swatch${c === x ? ' on' : ''}`} style={{ background: `#${x.toString(16).padStart(6, '0')}` }} onClick={() => setColor(x)} aria-label="Renk" />)}</div>
        {err && <div className="chat-err" role="alert">{err}</div>}
        <button className="btn" disabled={busy || name.trim().length < SOCIAL_LIMITS.nameMin}>{busy ? 'Kaydediliyor…' : 'Başla'}</button>
        <button type="button" className="linkish center" onClick={() => useSocial.setState({ onboardDismissed: true })}>Sonra</button>
      </form>
    </div>
  );
}
