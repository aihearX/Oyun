// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PublicProfile } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
const calls: { op: string; data: unknown }[] = [];
let reply: (op: string) => Promise<unknown> = async () => null;
vi.mock('./net', () => ({ act: (op: string, data: unknown) => { calls.push({ op, data }); return reply(op); }, toast: () => undefined, errText: () => '' }));

/**
 * Oyuncu testi tur 12 (YN-205, YN-206, YN-140):
 *  - Ekran sınırı kartında ("İnternet yok", "Bir şeyler ters gitti") Geri: düğme, telefonun geri tuşu (Escape) ve sekmeler; bağlantı
 *    gelince ekran yine kendiliğinden açılır. Kök sınırda Geri yok.
 *  - Arkadaş satırında gönderilmiş hediye "Hediye gönderildi" yazar; bağlantı yokken basılan Hediye "Bağlanınca gönderilecek" der ve
 *    istek bir kez gider. Arkadaşlar'da silinen hesap bilgi satırı.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom'da yok (SubTabs seçili sekmeyi görünür kaydırır)
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; reply = async () => null;
  vi.restoreAllMocks();
  const { useNet } = await import('@odi/net/store'); useNet.setState({ status: 'kapalı' });
});
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); h.id = 'root'; document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}
const $ = (id: string) => document.querySelector(`[data-testid="${id}"]`);
const geriBtn = () => document.querySelector<HTMLButtonElement>('button[aria-label="Geri"]');

describe('ekran sınırı kartında Geri (YN-205)', () => {
  /** parçası bağlantı yokken yüklenemeyen ekran: `bozuk.ag` doğruyken ChunkOffline atar, bağlantı gelince açılır */
  const bozuk = { ag: true, cokme: false };
  async function kart(props: Record<string, unknown>) {
    const { HataSiniri } = await import('./ui/HataSiniri');
    const { ChunkOffline } = await import('./engine');
    function Parca() {
      if (bozuk.cokme) throw new Error('çizim hatası');
      if (bozuk.ag) throw new ChunkOffline();
      return createElement('p', { 'data-testid': 'ekran-acik' }, 'Bilgi pratiği');
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await render(createElement(HataSiniri, props as never, createElement(Parca)));
  }

  it('ağ kartında Geri düğmesi geldiği yere döner; sekmeler kartın altında', async () => {
    bozuk.ag = true; bozuk.cokme = false;
    const geri = vi.fn();
    await kart({ geri, baslik: 'Bilgi pratiği', sekmeler: createElement('nav', { 'data-testid': 'sekmeler' }) });
    expect($('hata-ag')).toBeTruthy();
    expect($('hata-ag')!.textContent).toContain('İnternet yok');
    expect($('hata-ag')!.textContent).toContain('Bilgi pratiği');
    expect($('sekmeler')).toBeTruthy();
    await act(async () => { geriBtn()!.click(); });
    expect(geri).toHaveBeenCalledTimes(1);
  });

  it('telefonun geri tuşu (Escape) Geri ile aynı işi yapar', async () => {
    bozuk.ag = true; bozuk.cokme = false;
    const geri = vi.fn();
    await kart({ geri, baslik: 'Bilgi pratiği' });
    await act(async () => { dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(geri).toHaveBeenCalledTimes(1);
  });

  it('bağlantı gelince ekran kendiliğinden açılır (YN-047 aynı)', async () => {
    bozuk.ag = true; bozuk.cokme = false;
    await kart({ geri: () => undefined, baslik: 'Bilgi pratiği' });
    expect($('hata-ag')).toBeTruthy();
    bozuk.ag = false;
    await act(async () => { dispatchEvent(new Event('online')); });
    expect($('hata-ag')).toBeNull();
    expect($('ekran-acik')).toBeTruthy();
  });

  it('çökme kartında da Geri var; kök sınırda yok', async () => {
    bozuk.ag = false; bozuk.cokme = true;
    const hata = await import('./hata'); vi.spyOn(hata, 'reportCrash').mockImplementation(() => undefined);
    const geri = vi.fn();
    await kart({ geri, baslik: 'Ayarlar' });
    expect($('hata-ekran')).toBeTruthy();
    await act(async () => { geriBtn()!.click(); });
    expect(geri).toHaveBeenCalledTimes(1);
    await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = '';
    await kart({ kok: true, geri, sekmeler: createElement('nav', { 'data-testid': 'sekmeler' }) });
    expect($('hata-kok')).toBeTruthy();
    expect(geriBtn()).toBeNull();
    expect($('sekmeler')).toBeNull();
    bozuk.cokme = false;
  });
});

describe('errorBackTo (nav.ts, YN-205)', () => {
  it('alt ekran geri yığınına, kök alt ekran sekmesine, sekme ve bölüm Harita\'ya; başlık ve Harita\'da Geri yok', async () => {
    const { errorBackTo } = await import('./nav');
    const subs = ['skills', 'settings'];
    expect(errorBackTo({ name: 'pratik', back: 'today' }, subs)).toBe('gecmis');
    expect(errorBackTo({ name: 'friends', back: 'profile' }, subs)).toBe('gecmis');
    expect(errorBackTo({ name: 'settings', back: 'profile' }, subs)).toBe('profile');
    expect(errorBackTo({ name: 'raceResult', back: 'team' }, subs)).toBe('team');
    expect(errorBackTo({ name: 'today' }, subs)).toBe('map');
    expect(errorBackTo({ name: 'level' }, subs)).toBe('map');
    expect(errorBackTo({ name: 'result' }, subs)).toBe('map');
    expect(errorBackTo({ name: 'map' }, subs)).toBeNull();
    expect(errorBackTo({ name: 'title' }, subs)).toBeNull();
    expect(errorBackTo({ name: 'story' }, subs)).toBeNull();
  });
});

describe('arkadaş satırında hediye (YN-206) ve silinen hesap satırı (YN-140)', () => {
  const tuba: PublicProfile = {
    id: 'p-tuba', name: 'KaptanTuba', color: 0, hat: '', online: false, lastSeen: Date.now() - 60_000, highest: 23, stars: 50, league: 'bronz',
    teamName: 'Kulaklar', teamEmblem: null,
  } as unknown as PublicProfile;
  async function hub() {
    const { useNet } = await import('@odi/net/store');
    useNet.setState({ me: { id: 'p-ben', friendCode: 'ABC123' } as never, status: 'kapalı' });
    const { useFriends } = await import('./friends/state');
    useFriends.setState({ friends: [tuba], gifted: [], incoming: [], outgoing: [] });
    const { FriendsHub } = await import('./friends/FriendsHub');
    await render(createElement(FriendsHub, { raceReady: false }));
  }
  const hediyeBtn = () => document.querySelector<HTMLButtonElement>('[data-testid="arkadas-satiri"] button[aria-label*="hediye"]');

  it('bağlantı yokken "Bağlanınca gönderilecek"; bağlanınca bir kez gider, düğme "Hediye gönderildi" yazar', async () => {
    let gonder: (v: unknown) => void = () => undefined;
    reply = (op) => (op === 'friends.gift' ? new Promise((r) => { gonder = r; }) : Promise.resolve(null));
    await hub();
    expect($('silinen-hesap-notu')!.textContent).toBe('Hesabını silen oyuncular arkadaş listenden kendiliğinden çıkar.');
    expect(hediyeBtn()!.textContent).toContain('Hediye');
    await act(async () => { hediyeBtn()!.click(); });
    expect($('bekleyen-istek')!.textContent).toContain('Bağlanınca gönderilecek');
    expect(hediyeBtn()!.disabled).toBe(true);
    await act(async () => { hediyeBtn()!.click(); });
    expect(calls.filter((c) => c.op === 'friends.gift')).toHaveLength(1);
    // bağlandı: istek gitti, yanıt geldi
    await act(async () => { gonder({ thanks: 2, left: 4 }); await Promise.resolve(); });
    expect($('bekleyen-istek')).toBeNull();
    const b = hediyeBtn()!;
    expect(b.textContent).toContain('Hediye gönderildi');
    expect(b.textContent).not.toContain('Gitti');
    expect(b.getAttribute('aria-label')).toBe('KaptanTuba için bugünkü hediye gönderildi');
    expect(calls.filter((c) => c.op === 'friends.gift')).toHaveLength(1);
  });

  it('bağlıyken bekleyen satırı çıkmaz; takım amblemi takım adıyla yazılır', async () => {
    reply = async (op) => (op === 'friends.gift' ? { thanks: 2, left: 4 } : null);
    await hub();
    const { useNet } = await import('@odi/net/store'); await act(async () => { useNet.setState({ status: 'bağlı' }); });
    const satir = $('arkadas-satiri')!;
    expect(satir.textContent).toContain('23. bölüm');
    expect(satir.textContent).toContain('Kulaklar');
    expect(satir.querySelector('small[title]')!.getAttribute('title')).toBe('23. bölüm · Takımı: Kulaklar');
    await act(async () => { hediyeBtn()!.click(); });
    expect($('bekleyen-istek')).toBeNull();
    expect(hediyeBtn()!.textContent).toContain('Hediye gönderildi');
  });
});
