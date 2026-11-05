// @vitest-environment jsdom
// Oyuncu testi tur 15 (YN-255, OT-rekabetci-50): arkadaşı olmayan oyuncunun da Canlı yarış lobisine yolu var. Profil menüsünde
// "Canlı yarış" karosu (race açıkken dokununca lobi, inviteRoomId yok; kilitliyken dürüst "Bölüm N'de açılır" notu, lobi açılmaz);
// Arkadaşlar boşken "Arkadaşın yoksa Hızlı yarış'ı dene". YN-266 (OT-takim-kaptani-43): Arkadaşlar sekme şeridi adlı (eşit genişlik
// kuralı styles.css'te), arkadaş sayısı sekme adına yapışık yazı değil nötr rozet.
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { featureById } from './ftue/features';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom'da yok (SubTabs seçili sekmeyi görünür kaydırır)
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = '';
  const { useStore } = await import('./store'); const { FRESH_FTUE } = await import('./ftue/features');
  useStore.setState({ progress: {}, ftue: { ...FRESH_FTUE } });
});
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}
/** n bölümü geçmiş (yıldızlı) oyuncu */
async function gecmis(n: number) {
  const { useStore } = await import('./store');
  const progress: Record<number, { stars: number; best: number }> = {};
  for (let i = 1; i <= n; i++) progress[i] = { stars: 1, best: 100 };
  useStore.setState({ progress: progress as never });
}
async function profil() {
  const { NavContext } = await import('./nav');
  const { ProfileScreen } = await import('./screens/ProfileScreen');
  const open = vi.fn();
  await render(createElement(NavContext.Provider, { value: { open, play: () => undefined, tab: () => undefined } }, createElement(ProfileScreen, { onOpen: () => undefined })));
  return { open, karo: () => document.querySelector<HTMLButtonElement>('.menu-tile[data-tile="race"]') };
}

describe('Profil › Canlı yarış karosu (YN-255)', () => {
  const at = featureById('race').at;

  it('race açıkken karo lobi alt yazısıyla; dokununca davetsiz yarış lobisi', async () => {
    await gecmis(at);
    const { open, karo } = await profil();
    const k = karo()!;
    expect(k).toBeTruthy();
    expect(k.className).not.toContain('locked');
    expect(k.textContent).toContain('Canlı yarış');
    expect(k.textContent).toContain('Hızlı yarış · Oda kur · Kodla katıl');
    await act(async () => { k.click(); });
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ name: 'race' });
  });

  it('kilitliyken dürüst kilit notu; dokunuş lobi açmaz, ne zaman açılacağını söyler', async () => {
    await gecmis(at - 1);
    const { open, karo } = await profil();
    const k = karo()!;
    expect(k.className).toContain('locked');
    expect(k.textContent).toContain(`Bölüm ${at}'`);
    expect(k.textContent).toContain('açılır');
    expect(k.textContent).not.toContain('Hızlı yarış · Oda kur');
    await act(async () => { k.click(); });
    expect(open).not.toHaveBeenCalled();
    expect(document.querySelector('.lock-toast')!.textContent).toContain(`Bölüm ${at}'`);
  });
});

describe('Arkadaşlar: boş listede Hızlı yarış bağlantısı (YN-255) ve sekme şeridi (YN-266)', () => {
  async function hub(raceReady: boolean, friends: unknown[] = []) {
    const { useNet } = await import('@odi/net/store');
    useNet.setState({ me: { id: 'p-ben', friendCode: 'ABC123' } as never, status: 'kapalı' });
    const { useFriends } = await import('./friends/state');
    useFriends.setState({ friends: friends as never, gifted: [], incoming: [], outgoing: [] });
    const { NavContext } = await import('./nav');
    const { FriendsHub } = await import('./friends/FriendsHub');
    const open = vi.fn();
    await render(createElement(NavContext.Provider, { value: { open, play: () => undefined, tab: () => undefined } }, createElement(FriendsHub, { raceReady })));
    return open;
  }
  const link = () => document.querySelector<HTMLButtonElement>('[data-testid="bos-hizli-yaris"]');

  it('race açıkken "Henüz arkadaşın yok" kartında bağlantı; dokununca davetsiz lobi', async () => {
    const open = await hub(true);
    expect(document.body.textContent).toContain('Henüz arkadaşın yok');
    expect(link()!.textContent).toContain("Arkadaşın yoksa Hızlı yarış'ı dene");
    await act(async () => { link()!.click(); });
    expect(open).toHaveBeenCalledWith({ name: 'race' });
  });

  it('race kilitliyken bağlantı yok', async () => {
    await hub(false);
    expect(document.body.textContent).toContain('Henüz arkadaşın yok');
    expect(link()).toBeNull();
  });

  it('sekme şeridi adlı; arkadaş sayısı sekme adında değil, nötr rozette', async () => {
    await hub(true);
    const wrap = document.querySelector('[data-subtabs="arkadas"]')!;
    expect(wrap.querySelectorAll('.subtab')).toHaveLength(3);
    const ark = wrap.querySelector('.subtab[data-sekme="arkadaslar"]')!;
    expect(ark.querySelector('.st-sayi')!.textContent).toBe('0');
    expect(ark.querySelector('.sbadge')).toBeNull();
  });
});
