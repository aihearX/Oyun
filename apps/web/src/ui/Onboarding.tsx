import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { NetError } from '@odi/net';
import { useNet } from '@odi/net/store';
import { SOCIAL_LIMITS } from '@odi/shared';
import { errText, getNet, toast, useSocial } from '../net';
import { platform } from '../platform';
import { OdiAvatar } from './OdiAvatar';
import { useStore } from '../store';
import { useCoach } from '../ftue/Coach';
import { featureById } from '../ftue/features';
import { featureOpen } from '../ftue/useFeatures';

const COLORS = [0x6c4cf1, 0xff7a59, 0x2ee6d6, 0xffc25c, 0xff4f7a, 0x5b8def, 0x4cd97b, 0xf28fe0];
export const isDefaultName = (n: string) => /^Odi\d{4}$/.test(n);

/**
 * Bağlantı zayıfken seçilen ad (YN-047): istek gitmiş ama yanıtı gelmemiş ya da bağlantı bekleniyor olabilir. Kart en çok
 * BEKLE ms bekler, sonra "bağlanınca kaydedilecek" der; bağlanınca ad (hâlâ varsayılansa) bir kez daha gönderilir. Aynı ad iki kez
 * yazılsa da sonuç aynıdır (sunucu adı üzerine yazar); yanıtı beklenen istek varken yenisi gönderilmez. Uygulama kapanırsa kayıt
 * cihazda kalır, bir sonraki bağlanışta gönderilir. İnternet hiç yokken (YN-154, OT-eski-telefon-25) beklenmez: kart hemen
 * "İnternet yok" der, ad bağlanınca (aşağıdaki abonelik) bir kez gönderilir; "zayıf" yalnız bağlıyken yanıt gecikince.
 */
interface Bekleyen { name: string; color: number }
const KEY = 'odi.adBekliyor';
const BEKLE = 5000;
const okunan = (): Bekleyen | null => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) as Bekleyen : null; } catch { return null; } };
const useAdKaydi = create<{ bekleyen: Bekleyen | null }>()(() => ({ bekleyen: okunan() }));
const bekleyenYaz = (b: Bekleyen | null) => { useAdKaydi.setState({ bekleyen: b }); try { if (b) localStorage.setItem(KEY, JSON.stringify(b)); else localStorage.removeItem(KEY); } catch { /* gizli mod */ } };
/** ad kaydının bekleme metni: internet yok (hemen) ya da bağlıyken yanıt gecikti (BEKLE ms sonra) */
export const AD_INTERNET_YOK = 'İnternet yok; adın bağlanınca kaydedilecek. Bu arada oynamaya devam edebilirsin.';
export const AD_ZAYIF = 'Bağlantı zayıf; adın bağlanınca kaydedilecek. Bu arada oynamaya devam edebilirsin.';
/** çevrimdışı: tarayıcı ağ yok diyor ya da sunucu bağlantısı açık değil (soket kapalı/bağlanıyor) */
export const cevrimdisi = (): boolean => (typeof navigator !== 'undefined' && navigator.onLine === false) || useNet.getState().status !== 'bağlı';
/**
 * ad kaydolunca karşılama (YN-154, OT-ogrenci-birinci-29): takım henüz kilitliyse o an yapılabilecek şey ve takımın açıldığı bölüm
 * (eşik features.ts'ten; sabit yazılmaz)
 */
export function merhabaMetni(): string {
  return featureOpen('team') ? 'Takımlar ve sohbet seni bekliyor.' : `İlk bölümler seni bekliyor; takımlar ${featureById('team').at}. bölümde açılır.`;
}
/** bağlantı kaynaklı hata: sunucu işlemiş olabilir ya da istek hiç gitmedi; ikisinde de bağlanınca yeniden gönderilir */
const baglantiHatasi = (e: unknown) => e instanceof NetError && ['CEVRIMDISI', 'KAPALI', 'KOPTU', 'ZAMAN_ASIMI'].includes(e.code);

let ucus: Promise<unknown> | null = null;
/** profile.update; yanıtı beklenen istek varken yenisi gönderilmez (aynı söz döner) */
function gonder(b: Bekleyen): Promise<unknown> {
  const n = getNet(); if (!n) return Promise.reject(new NetError('KAPALI', 'Sunucu adresi yok.'));
  if (ucus) return ucus;
  const p = n.call('profile.update', { name: b.name, color: b.color }).then(() => {
    bekleyenYaz(null); useStore.getState().setOdiColor(b.color, true);
    toast('👋', `Merhaba ${b.name}!`, merhabaMetni(), 'green');
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

/** başka bir akış sürerken kart açılmaz (oyuncu testi: takma ad penceresi harita turu ve başarım kutlamasıyla aynı anda çıkıyordu):
 *  anlatıcı turu, kutlama, açılış hikâyesi ve bölge tanıtımı bitince açılır. Tur da açık kartın üstüne başlamaz (Director `quiet`). */
const mesgulDom = () => !!document.querySelector('.cel-stage, .story, .biome-intro');
function useSakin(): boolean {
  const tur = useCoach((s) => s.tour);
  const [mesgul, setMesgul] = useState(mesgulDom);
  useEffect(() => { const h = setInterval(() => setMesgul(mesgulDom()), 400); return () => clearInterval(h); }, []);
  return !tur && !mesgul;
}

/** Bilgi düzeyi sorusu (karar 31): Ayarlar'dakiyle aynı iki seçenek; dokunmak yeter, geçilebilir (varsayılan Genel kalır) */
function BilgiSorusu() {
  const k = useStore((s) => s.knowledge); const set = useStore((s) => s.setKnowledge);
  return (
    <div className="onboard-bilgi" data-testid="onboard-bilgi">
      <div className="ob-k" id="ob-bilgi">Bilgi düzeyi</div>
      <div className="seg" role="radiogroup" aria-labelledby="ob-bilgi">
        <button type="button" role="radio" aria-checked={k === 'genel'} className={k === 'genel' ? 'on' : ''} onClick={() => set('genel')}>Genel</button>
        <button type="button" role="radio" aria-checked={k === 'odyoloji'} className={k === 'odyoloji' ? 'on' : ''} onClick={() => set('odyoloji')}>Odyoloji öğrencisi</button>
      </div>
      <div className="muted ob-not">Notlar ve sorular buna göre gelir; Ayarlar’dan değişir.</div>
    </div>
  );
}

/** İlk bağlantıda takma ad + renk seçimi (sunucu doğrular) ve bir kez Bilgi düzeyi sorusu. "Sonra" denirse bu oturumda bir daha sorulmaz. */
export function Onboarding() {
  const me = useNet((s) => s.me); const st = useNet((s) => s.status); const dismissed = useSocial((s) => s.onboardDismissed);
  const bekleyen = useAdKaydi((s) => s.bekleyen);
  const [name, setName] = useState(''); const [color, setColor] = useState<number | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // ad cihazda bekliyor: 'yok' internet/bağlantı yok (beklemeden), 'zayif' bağlıyken yanıt BEKLE ms'de gelmedi
  const [gecikti, setGecikti] = useState<'yok' | 'zayif' | null>(null);
  // açılmış kart bağlantı koparsa kaybolmaz (yazılan ad bağlanınca kaydedilir)
  const acildi = useRef(false);
  // Bilgi düzeyi sorusu yalnız bir kez (karar 31): kart açılırken karar verilir, seçince kart içinde kalır
  const bilgiSor = useRef(false);
  const sakin = useSakin();
  if (!me || dismissed || !isDefaultName(me.name) || (st !== 'bağlı' && !acildi.current)) return null;
  // önceki oturumdan bekleyen ad: bağlanınca kendiliğinden gönderilir, yeniden sorulmaz
  if (bekleyen && !acildi.current) return null;
  if (!acildi.current && !sakin) return null;
  if (!acildi.current) bilgiSor.current = !useStore.getState().knowledgeAsked;
  acildi.current = true;
  const sonra = () => { useStore.getState().knowledgeAskedDone(); useSocial.setState({ onboardDismissed: true }); };
  const c = color ?? useStore.getState().odiColor ?? me.color;
  const save = async () => {
    const b = { name: name.trim(), color: c };
    setErr(''); bekleyenYaz(b); useStore.getState().knowledgeAskedDone();
    // internet yok: beklemeden söyle; ad cihazda, bağlanınca abonelik bir kez gönderir
    if (cevrimdisi()) { setGecikti('yok'); return; }
    setBusy(true);
    let sure: ReturnType<typeof setTimeout> | undefined;
    try {
      // en çok BEKLE ms: yanıt gelmezse istek sürer, kart dürüstçe "bağlanınca kaydedilecek" der
      const r = await Promise.race([gonder(b).then(() => 'tamam' as const), new Promise<'bekle'>((res) => { sure = setTimeout(() => res('bekle'), BEKLE); })]);
      if (r === 'tamam') platform().haptic('success'); else setGecikti(cevrimdisi() ? 'yok' : 'zayif');
    } catch (e) {
      if (baglantiHatasi(e)) setGecikti(cevrimdisi() ? 'yok' : 'zayif'); else { setErr(errText(e)); platform().haptic('error'); }
    } finally { clearTimeout(sure); }
    setBusy(false);
  };
  if (gecikti && bekleyen) {
    return (
      <div className="overlay onboard-wrap">
        <div className="card onboard" role="dialog" aria-label="Takma adın">
          <OdiAvatar size={84} color={bekleyen.color} />
          <h2>{bekleyen.name}</h2>
          <div className="muted" role="status" data-testid="ad-bekliyor" data-durum={gecikti}>{gecikti === 'yok' ? AD_INTERNET_YOK : AD_ZAYIF}</div>
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
        {bilgiSor.current && <BilgiSorusu />}
        {err && <div className="chat-err" role="alert">{err}</div>}
        <button className="btn" disabled={busy || name.trim().length < SOCIAL_LIMITS.nameMin}>{busy ? 'Kaydediliyor…' : 'Başla'}</button>
        <button type="button" className="linkish center" onClick={sonra}>Sonra</button>
      </form>
    </div>
  );
}
