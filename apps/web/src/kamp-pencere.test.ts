// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
const calls: { op: string; data: unknown }[] = [];
let reply: (op: string) => unknown = () => null;
vi.mock('./net', () => ({ act: async (op: string, data: unknown) => { calls.push({ op, data }); return reply(op); }, toast: () => undefined }));

/**
 * Oyuncu testi tur 6 (YN-120): Kamp'ın pencereleri oyuncunun dokunuşunu ve parasını şaşırtmaz.
 *  - Kamp Görevleri sayfası ödül sandığının (kutlama katmanı) altında kalır; sandık "cüzdanına eklendi" der, cüzdan hemen güncel.
 *  - Kamp seviyesi penceresi her evrede "Kamp Seviyesi N!" der; açıkken sekme çubuğuna düşen dokunuş kapanınca o sekmeyi açar.
 *  - Bağlantı yokken basılan yükseltme: kart "Bağlanınca başlayacak" der, düğmeler kilitli; istek bitince kart eski haline döner.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; reply = () => null; });
async function render(node: ReturnType<typeof createElement>, host?: HTMLElement) {
  const h = host ?? document.createElement('div'); if (!host) document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}
const tick = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
function reduced() {
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

describe('Kamp Görevleri ödül sandığı sayfanın önünde (OT-ekonomi-denetci-26)', () => {
  it('sayfa kökün (#root) içinde: kutlama katmanıyla aynı yığında, onun altında (z 90 < 200)', async () => {
    const rootEl = document.createElement('div'); rootEl.id = 'root'; document.body.appendChild(rootEl);
    const app = document.createElement('div'); rootEl.appendChild(app);
    const { KgSheet } = await import('./camp/gorev/Klinik');
    await render(createElement(KgSheet, { title: 'Kamp Görevleri', onClose: () => undefined, testid: 'kg-panel', children: null }), app);
    const sheet = document.querySelector('[data-testid="kg-panel"]')!;
    expect(sheet.closest('#root')).toBe(rootEl);
    expect(sheet.parentElement?.parentElement).toBe(rootEl);
  });
  it('bölüm ödülü: cüzdan yanıtla hemen yazılır, sandık "cüzdana eklendi" (sayaç beklemez, jeton ikinci kez sayılmaz)', async () => {
    const { registerCelebrations } = await import('./celebrate');
    const chests: { granted?: boolean; items: { kind: string; amount: number }[] }[] = [];
    registerCelebrations({ chest: async (o) => { chests.push(o); }, coins: async () => undefined, levelUp: async () => undefined, biomeRestored: async () => undefined, recap: async () => undefined, banner: () => undefined });
    const { useNet } = await import('@odi/net/store'); const { claimKg } = await import('./camp/gorev/state');
    const wallet = { jeton: 8792, kristal: 0, hizlandirici: { m5: 2, m60: 0, s8: 0 } };
    reply = (op) => (op === 'kg.claim' ? { state: null, wallet, reward: { jeton: 80, kampXp: 60, m5: 2 } } : null);
    await claimKg('hikaye:1', 'Bölüm 1: Kampa Hoş Geldin', { big: true });
    expect(useNet.getState().wallet?.jeton).toBe(8792);
    expect(chests).toHaveLength(1);
    expect(chests[0]!.granted).toBe(true);
    expect(chests[0]!.items.find((i) => i.kind === 'jeton')?.amount).toBe(80);
  });
});

describe('Kamp Seviyesi penceresi (OT-ekonomi-denetci-27)', () => {
  it('başlık ve rozet her evrede "Kamp Seviyesi N!" / KAMP (açılanlar sıralanırken "Seviye N!"e dönmez)', async () => {
    reduced(); HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext; // jsdom: tuval yok
    const { CelebrationLayer } = await import('./celebrate/CelebrationLayer'); const { celebrate } = await import('./celebrate');
    await render(createElement(CelebrationLayer, { toasts: false }));
    let done = false;
    await act(async () => { void celebrate.levelUp({ level: 5, kicker: 'KAMP', title: 'Kamp Seviyesi 5!', unlocks: ['Unvan: Kulak Kaşifi', '+2 süs yeri'] }).then(() => { done = true; }); });
    await tick(400);
    expect(document.querySelector('.lvl-item.in')).not.toBeNull(); // açılanlar evresi
    expect(document.querySelector('.cel-title')?.textContent).toBe('Kamp Seviyesi 5!');
    expect(document.querySelector('.lvl-badge .lb-k')?.textContent).toBe('KAMP');
    await act(async () => { (document.querySelector('.cel-cta .btn') as HTMLElement).click(); });
    await tick(50);
    expect(done).toBe(true);
  });
  it('pencere açıkken sekme çubuğuna (Profil) düşen dokunuş kapanınca Profil’i açar; açık sekmeye ya da başka yere dokunuş bir şey açmaz', async () => {
    const { tabTapUnder, openTab } = await import('./camp/seviye');
    const nav = document.createElement('nav'); nav.className = 'tabbar'; document.body.appendChild(nav);
    const opened: string[] = [];
    for (const [i, t] of ['map', 'today', 'camp', 'team', 'profile'].entries()) {
      const b = document.createElement('button'); b.className = 'tab'; b.dataset.tab = t; if (t === 'camp') b.setAttribute('aria-current', 'page');
      b.getBoundingClientRect = () => new DOMRect(i * 78, 780, 78, 64); b.addEventListener('click', () => opened.push(t)); nav.appendChild(b);
    }
    const cel = document.createElement('div'); cel.className = 'cel-root on'; const stage = document.createElement('div'); cel.appendChild(stage); document.body.appendChild(cel);
    const tap = (x: number, y: number) => stage.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    let w = tabTapUnder(); tap(340, 810); openTab(w.stop());
    expect(opened).toEqual(['profile']);
    w = tabTapUnder(); tap(195, 400); openTab(w.stop());
    w = tabTapUnder(); tap(195, 810); openTab(w.stop()); // Kamp zaten açık
    expect(opened).toEqual(['profile']);
    w = tabTapUnder(); w.stop(); tap(340, 810); openTab(null); // pencere kapandıktan sonraki dokunuş sayılmaz
    expect(opened).toEqual(['profile']);
  });
});

describe('çevrimdışı yükseltme bekliyor (OT-eski-telefon-18)', () => {
  it('bağlantı yokken Yükselt: kart "Bağlanınca başlayacak", bütün yükseltme düğmeleri kilitli; istek bitince eski hali', async () => {
    const { useNet } = await import('@odi/net/store'); useNet.setState({ status: 'bağlanıyor' });
    const { demoCamp } = await import('./camp/demo'); const { CampList } = await import('./camp/CampList');
    const { camp, wallet } = demoCamp({ level: 3, build: null, campLevel: 2 });
    let finish: (v: boolean) => void = () => undefined;
    const actions = { upgrade: vi.fn(() => new Promise<boolean>((r) => { finish = r; })), queue: vi.fn(async () => true) } as unknown as import('./camp/model').CampActions;
    await render(createElement(CampList, { camp, wallet, team: false, fast: 0, sNow: Date.now(), actions, bonuses: null }));
    const card = () => [...document.querySelectorAll('.card.building')].find((c) => c.textContent?.includes('Odyoloji Merkezi'))!;
    await act(async () => { (card().querySelector('.b-up .btn') as HTMLElement).click(); });
    await act(async () => { ([...document.querySelectorAll('.sheet .btn')].find((b) => b.textContent === 'Yükselt') as HTMLElement).click(); });
    expect(actions.upgrade).toHaveBeenCalledTimes(1);
    expect(card().querySelector('[data-testid="bekleyen-insaat"]')?.textContent).toContain('Bağlanınca başlayacak');
    expect(card().querySelector('.b-up .btn')?.textContent).toBe('Bekliyor');
    expect([...document.querySelectorAll<HTMLButtonElement>('.card.building .b-up .btn')].every((b) => b.disabled)).toBe(true);
    await act(async () => { finish(true); });
    expect(document.querySelector('[data-testid="bekleyen-insaat"]')).toBeNull();
    useNet.setState({ status: 'kapalı' });
  });
  it('bağlıyken basılan yükseltmede bekliyor yazısı yok', async () => {
    const { useNet } = await import('@odi/net/store'); useNet.setState({ status: 'bağlı' });
    const { insaatIstegi, useBekleyenInsaat } = await import('./camp/model');
    let seen: string | null = 'x';
    await insaatIstegi('merkez', async () => { seen = useBekleyenInsaat.getState().id; return true; });
    expect(seen).toBeNull();
    useNet.setState({ status: 'kapalı' });
  });
});
