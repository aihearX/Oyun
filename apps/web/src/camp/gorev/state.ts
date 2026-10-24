/**
 * Kamp Görevleri istemci durumu (docs/17-kamp-gorevleri.md): sunucunun KgState / VakaState'i, açık panel ve ödül alma.
 * `bindKg(client)` net.ts'ten bir kez çağrılır. İlerleme ve ödül sunucudadır; istemci yalnız gösterir. Bir ödülün kutlaması
 * yalnız o ödülün başarılı `kg.claim` yanıtıyla, tam bir kez çalar (aynı ref ikinci kez alınamaz; düğme istek sürerken kilitli).
 */
import { create } from 'zustand';
import type { NetClient } from '@odi/net';
import { useNet } from '@odi/net/store';
import type { KampOdul, KgState, VakaState } from '@odi/shared';
import { decorById, remedyById } from '@odi/content';
import { audio } from '@odi/audio';
import { celebrate, type RewardItem } from '../../celebrate';
import { platform } from '../../platform';
import { act } from '../../net';
import { useStore } from '../../store';

export type GorevSekme = 'hikaye' | 'gunluk' | 'etkinlik' | 'basari';
export type KgPanel =
  | { kind: 'gorev'; tab: GorevSekme }
  | { kind: 'klinik'; tab: 'salon' | 'defter'; vaka?: string; replay?: boolean }
  | { kind: 'oyun'; oyun: 'ton' | 'timpano' };
export interface KgStore { kg: KgState | null; vaka: VakaState | null; panel: KgPanel | null; busy: string | null }
export const useKg = create<KgStore>()(() => ({ kg: null, vaka: null, panel: null, busy: null }));
const set = useKg.setState;

let client: NetClient | null = null;
export const kgNet = () => client;
export const openPanel = (p: KgPanel | null) => set({ panel: p });

export async function refreshKg(): Promise<void> { const c = client; if (!c || c.status !== 'bağlı') return; try { set({ kg: (await c.call('kg.state', {})).state }); } catch { /* sonra */ } }
export async function refreshVaka(): Promise<void> { const c = client; if (!c || c.status !== 'bağlı') return; try { set({ vaka: (await c.call('vaka.state', {})).vaka }); } catch { /* sonra */ } }

/** sunucunun ödülünü kutlama öğelerine çevir (gösterilen = verilen) */
export function odulOgeleri(r: KampOdul): RewardItem[] {
  const out: RewardItem[] = [];
  if (r.jeton) out.push({ kind: 'jeton', amount: r.jeton });
  if (r.kristal) out.push({ kind: 'kristal', amount: r.kristal });
  if (r.kampXp) out.push({ kind: 'xp', amount: r.kampXp, label: `${r.kampXp} Kamp XP` });
  if (r.m5) out.push({ kind: 'hizlandirici', amount: r.m5, label: `${r.m5} × 5 dk hızlandırıcı` });
  if (r.m60) out.push({ kind: 'hizlandirici', amount: r.m60, label: `${r.m60} × 60 dk hızlandırıcı` });
  if (r.dekor) out.push({ kind: 'kozmetik', amount: 1, label: `Süs: ${decorById(r.dekor)?.name ?? 'süs'}`, ref: r.dekor });
  if (r.malzeme) out.push({ kind: 'koruyucu', amount: r.malzemeN ?? 1, label: `${remedyById(r.malzeme)?.name ?? 'Malzeme'} ×${r.malzemeN ?? 1}`, ref: r.malzeme });
  return out;
}
export const odulBos = (r: KampOdul) => odulOgeleri(r).length === 0;

/**
 * ödülü al: sunucu bir kez verir; kutlama yalnız başarılı yanıtta çalar. `big`: sandık kutlaması (bölüm/basamak), değilse afiş + jeton uçuşu.
 * Dönüş: alınan ödül (başarısızsa null).
 */
export async function claimKg(ref: string, title: string, o: { from?: { x: number; y: number }; big?: boolean } = {}): Promise<KampOdul | null> {
  if (useKg.getState().busy) return null;
  set({ busy: ref });
  try {
    const r = await act('kg.claim', { ref });
    if (!r) return null;
    set({ kg: r.state }); useNet.setState({ wallet: r.wallet });
    celebrateReward(title, r.reward, o);
    return r.reward;
  } finally { set({ busy: null }); }
}
let celebrations = 0;
export function celebrateReward(title: string, reward: KampOdul, o: { from?: { x: number; y: number }; big?: boolean } = {}): void {
  const items = odulOgeleri(reward); if (!items.length) return;
  celebrations++;
  platform().haptic('success');
  if (o.big) { void celebrate.chest({ title, items, tier: reward.kristal && reward.kristal >= 8 ? 'altin' : reward.kristal ? 'gumus' : 'bronz' }); return; }
  audio.play('questDone');
  if (reward.jeton) void celebrate.coins({ amount: reward.jeton, kind: 'jeton', from: o.from });
  celebrate.banner({ icon: '✅', title, body: items.map((i) => i.label ?? `${i.amount} ${i.kind}`).join(' · '), tone: 'green' });
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** kamp durumu değişince (inşaat bitti, seviye) görevleri tazele (kısa gecikmeyle, art arda gelenler birleşir) */
function soon(): void { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { refreshTimer = null; void refreshKg(); }, 600); }

export function bindKg(c: NetClient): void {
  client = c;
  c.on('kg.updated', ({ state }) => set({ kg: state }));
  c.on('vaka.updated', ({ vaka }) => set({ vaka }));
  c.on('camp.updated', () => soon());
  c.onStatus((st) => { if (st === 'bağlı') { void refreshKg(); } });
}

/** test kancası */
if (typeof window !== 'undefined') (window as unknown as { __kg?: unknown }).__kg = { state: () => useKg.getState(), open: openPanel, refresh: refreshKg, celebrations: () => celebrations,
  /** denetim aracı: oyun sesini aç/kapat (Ton Avı ses kapalı kartı) */ ses: (on: boolean) => useStore.getState().setSounds(on) };
