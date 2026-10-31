import { useRef, useState } from 'react';
import { create } from 'zustand';
import { NetError } from '@odi/net';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS } from '@odi/shared';
import { errText, getNet, toast, useSocial } from '../net';
import { platform } from '../platform';
import { OdiAvatar } from './OdiAvatar';
import { useStore } from '../store';

const COLORS = [0x6c4cf1, 0xff7a59, 0x2ee6d6, 0xffc25c, 0xff4f7a, 0x5b8def, 0x4cd97b, 0xf28fe0];
export const isDefaultName = (n: string) => /^Odi\d{4}$/.test(n);

/**
 * Bağlantı zayıfken seçilen ad (YN-047): istek gitmiş ama yanıtı gelmemiş ya da bağlantı bekleniyor olabilir. Kart en çok
 * BEKLE ms bekler, sonra "bağlanınca kaydedilecek" der; bağlanınca ad (hâlâ varsayılansa) bir kez daha gönderilir. Aynı ad iki kez
 * yazılsa da sonuç aynıdır (sunucu adı üzerine yazar); yanıtı beklenen istek varken yenisi gönderilmez. Uygulama kapanırsa kayıt
 * cihazda kalır, bir sonraki bağlanışta gönderilir.
 */
interface Bekleyen { name: string; color: number }
const KEY = 'odi.adBekliyor';
const BEKLE = 5000;
const okunan = (): Bekleyen | null => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) as Bekleyen : null; } catch { return null; } };
const useAdKaydi = create<{ bekleyen: Bekleyen | null }>()(() => ({ bekleyen: okunan() }));
const bekleyenYaz = (b: Bekleyen | null) => { useAdKaydi.setState({ bekleyen: b }); try { if (b) localStorage.setItem(KEY, JSON.stringify(b)); else localStorage.removeItem(KEY); } catch { /* gizli mod */ } };
/** bağlantı kaynaklı hata: sunucu işlemiş olabilir ya da istek hiç gitmedi; ikisinde de bağlanınca yeniden gönderilir */
const baglantiHatasi = (e: unknown) => e instanceof NetError && ['CEVRIMDISI', 'KAPALI', 'KOPTU', 'ZAMAN_ASIMI'].includes(e.code);

let ucus: Promise<unknown> | null = null;
/** profile.update; yanıtı beklenen istek varken yenisi gönderilmez (aynı söz döner) */
function gonder(b: Bekleyen): Promise<unknown> {
  const n = getNet(); if (!n) return Promise.reject(new NetError('KAPALI', 'Sunucu adresi yok.'));
  if (ucus) return ucus;
  const p = n.call('profile.update', { name: b.name, color: b.color }).then(() => {
    bekleyenYaz(null); useStore.getState().setOdiColor(b.color, true);
    toast('👋', `Merhaba ${b.name}!`, 'Takımlar ve sohbet seni bekliyor.', 'green');
  }, (e: unknown) => { if (!baglantiHatasi(e)) bekleyenYaz(null); throw e; });
  ucus = p.finally(() => { ucus = null; });
  return ucus;
}
// bağlanınca bekleyen ad gönderilir (ad zaten kaydolduysa — önceki istek sunucuya ulaşmış — bekleyen düşer)
useNet.subscribe((s) => {
  const b = useAdKaydi.getState().bekleyen; if (!b || !s.me) return;
  if (!isDefaultName(s.me.name)) { bekleyenYaz(null); return; }
  if (s.status === 'bağlı' && !ucus) gonder(b).catch(() => undefined);
});

/** İlk bağlantıda takma ad + renk seçimi (sunucu doğrular). "Sonra" denirse bu oturumda bir daha sorulmaz. */
export function Onboarding() {
  const me = useNet((s) => s.me); const st = useNet((s) => s.status); const dismissed = useSocial((s) => s.onboardDismissed);
  const bekleyen = useAdKaydi((s) => s.bekleyen);
  const [name, setName] = useState(''); const [color, setColor] = useState<number | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // yanıt BEKLE ms'de gelmedi ya da bağlantı yok: ad cihazda bekliyor
  const [gecikti, setGecikti] = useState(false);
  // açılmış kart bağlantı koparsa kaybolmaz (yazılan ad bağlanınca kaydedilir)
  const acildi = useRef(false);
  if (!me || dismissed || !isDefaultName(me.name) || (st !== 'bağlı' && !acildi.current)) return null;
  // önceki oturumdan bekleyen ad: bağlanınca kendiliğinden gönderilir, yeniden sorulmaz
  if (bekleyen && !acildi.current) return null;
  acildi.current = true;
  const c = color ?? useStore.getState().odiColor ?? me.color;
  const save = async () => {
    const b = { name: name.trim(), color: c };
    setBusy(true); setErr(''); bekleyenYaz(b);
    let sure: ReturnType<typeof setTimeout> | undefined;
    try {
      // en çok BEKLE ms: yanıt gelmezse istek sürer, kart dürüstçe "bağlanınca kaydedilecek" der
      const r = await Promise.race([gonder(b).then(() => 'tamam' as const), new Promise<'bekle'>((res) => { sure = setTimeout(() => res('bekle'), BEKLE); })]);
      if (r === 'tamam') platform().haptic('success'); else setGecikti(true);
    } catch (e) {
      if (baglantiHatasi(e)) setGecikti(true); else { setErr(errText(e)); platform().haptic('error'); }
    } finally { clearTimeout(sure); }
    setBusy(false);
  };
  if (gecikti && bekleyen) {
    return (
      <div className="overlay onboard-wrap">
        <div className="card onboard" role="dialog" aria-label="Takma adın">
          <OdiAvatar size={84} color={bekleyen.color} />
          <h2>{bekleyen.name}</h2>
          <div className="muted" role="status">Bağlantı zayıf; adın bağlanınca kaydedilecek. Bu arada oynamaya devam edebilirsin.</div>
          <button type="button" className="btn" onClick={() => useSocial.setState({ onboardDismissed: true })}>Tamam</button>
        </div>
      </div>
    );
  }
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
