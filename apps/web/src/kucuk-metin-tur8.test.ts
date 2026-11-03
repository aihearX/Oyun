// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_SKILLS, DUPLICATE_VALUE, MAX_STREAK_SHIELDS } from '@odi/content';
import { advanceStreak, defaultMeta, explainReward, type PlayerCore } from '@odi/meta';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
vi.mock('./ftue/Coach', () => ({ useCoach: (sel: (s: { tour: null }) => unknown) => sel({ tour: null }) }));
const calls: { op: string; data: unknown }[] = vi.hoisted(() => []);
const toasts: string[][] = vi.hoisted(() => []);
vi.mock('./net', async () => {
  const { create } = await import('zustand');
  return {
    act: async () => null, errText: () => 'hata', toast: (...a: string[]) => { toasts.push(a); },
    useSocial: create(() => ({ enabled: true, tried: true, onboardDismissed: false, bonuses: null })),
    // yanıt hiç gelmez (bağlıyken gecikme); çağrılar sayılır
    getNet: () => ({ call: (op: string, data: unknown) => { calls.push({ op, data }); return new Promise(() => undefined); } }),
  };
});

/**
 * Oyuncu testi tur 8 küçük arayüz metinleri (YN-151–YN-154): seri koruyucunun kuralı koddakiyle aynı; kurulmamış binanın inşaatı
 * sürerken rozet "Kuruluyor"; kamp etkilerinde sıfır olanın nasıl artacağı; internet yokken takma ad beklemeden "İnternet yok",
 * "zayıf" yalnız bağlıyken yanıt gecikince; takım kilitliyken karşılama takımı vaat etmez.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => { await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; toasts.length = 0; vi.useRealTimers();
  // Onboarding'in modül durumu (bekleyen ad, yanıtı beklenen istek) testler arasında taşınmasın
  try { localStorage.clear(); } catch { /* yok */ } vi.resetModules(); });
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}

const DAY = '2026-11-03';
const core = (shields: number, lastDay: string): PlayerCore => { const meta = defaultMeta(); meta.shields = shields; return { progress: {}, coins: 0, xp: 0, streak: 5, lastDay, failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta }; };

describe('Seri koruyucu (YN-151)', () => {
  it('cümle koddaki kuralı söyler: her kaçırılan gün bir koruyucu, yetmezse seri bozulur, en çok 2, doluyken jeton', async () => {
    const { SHIELD_RULE } = await import('./ui/bits');
    expect(SHIELD_RULE).toContain('her gün için bir koruyucu harcanır');
    expect(SHIELD_RULE).toContain(`en çok ${MAX_STREAK_SHIELDS} tane birikir`);
    expect(SHIELD_RULE).toContain(`yerine ${DUPLICATE_VALUE.koruyucu} jeton`);
    // bir gün kaçtı, 1 koruyucu: seri sürer, koruyucu harcanır
    const a = advanceStreak(core(1, '2026-11-01'), DAY);
    expect(a.event).toEqual({ kind: 'saved', streak: 6, used: 1 }); expect(a.core.meta.shields).toBe(0);
    // iki gün kaçtı, 1 koruyucu: yetmez, seri baştan ("yettiği sürece")
    expect(advanceStreak(core(1, '2026-10-31'), DAY).event.kind).toBe('reset');
    // doluyken gelen koruyucu jetona döner
    const m = defaultMeta(); m.shields = MAX_STREAK_SHIELDS;
    expect(explainReward(m, [{ kind: 'koruyucu', amount: 1 }]).swaps).toEqual([{ from: { kind: 'koruyucu', amount: 1 }, jeton: DUPLICATE_VALUE.koruyucu }]);
  });
});

describe('Kamp: inşaat rozeti ve etkiler (YN-153)', () => {
  it('kurulmamış bina: "Kurulmadı"; ilk inşaat sürerken "Kuruluyor" (listede de)', async () => {
    const { kurulumYazisi } = await import('./camp/model');
    expect(kurulumYazisi({ level: 0, upgradingTo: null })).toBe('Kurulmadı');
    expect(kurulumYazisi({ level: 0, upgradingTo: 1 })).toBe('Kuruluyor');
    expect(kurulumYazisi({ level: 2, upgradingTo: 3 })).toBeNull();
    const { useNet } = await import('@odi/net/store'); useNet.setState({ status: 'bağlı' });
    const { demoCamp } = await import('./camp/demo'); const { CampList } = await import('./camp/CampList');
    const { camp, wallet } = demoCamp({ level: 2, build: 'revir', campLevel: 1 });
    const bonuses = { coinPct: 6, shieldChancePct: 0, firstHitIgnorePct: 0, warPct: 0, raidPct: 0 };
    await render(createElement(CampList, { camp, wallet, team: false, fast: 0, sNow: Date.now(), actions: {} as never, bonuses }));
    const pill = (name: string) => [...document.querySelectorAll('.card.building')].find((c) => c.textContent?.includes(name))!.querySelector('.lvl-pill')!.textContent;
    expect(pill('Odyoloji Kliniği')).toBe('Kuruluyor');
    expect(pill('Odyoloji Merkezi')).toBe('Sv 2');
    // etkiler: sade başlık, sıfır olanın nasıl artacağı tek satır, kaynak kuralı (karar 29) dokununca
    const card = document.querySelector('.bonus-card')!;
    expect(card.textContent).toContain('Binalarının ve takımının sana verdiği ek ödüller');
    expect(card.querySelector('[data-testid="etki-artisi"]')!.textContent).toBe('Artırmak için yükselt: Atölye (kalkan), Klinik (klinik). Savaş ve baskın bir takıma katılınca takım teknolojisiyle artar.');
    expect(card.querySelector('[data-testid="etki-kurali"]')).toBeNull();
    await act(async () => { (card.querySelector('.bonus-kural-btn') as HTMLElement).click(); });
    expect(card.querySelector('[data-testid="etki-kurali"]')!.textContent).toContain('kamp binaları takım puanlarına eklenmez');
    useNet.setState({ status: 'kapalı' });
  });
  it('hepsi sıfırdan büyükse artış satırı yok', async () => {
    const { bonusArtisi } = await import('./camp/model');
    expect(bonusArtisi({ coinPct: 3, shieldChancePct: 4, firstHitIgnorePct: 5, warPct: 2, raidPct: 2 }, true)).toBeNull();
    expect(bonusArtisi({ coinPct: 3, shieldChancePct: 4, firstHitIgnorePct: 5, warPct: 0, raidPct: 2 }, true)).toBe('Savaş takımının teknolojisiyle artar.');
  });
});

describe('Takma ad: çevrimdışı ve karşılama (YN-154)', () => {
  const me = { id: 'p1', name: 'Odi1234', color: 0x6c4cf1, friendCode: 'ABC123' };
  async function openCard() {
    const { useNet } = await import('@odi/net/store'); useNet.setState({ status: 'bağlı', me: me as never });
    const { Onboarding } = await import('./ui/Onboarding');
    await render(createElement(Onboarding));
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Takma ad"]')!;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Kulakçı');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return useNet;
  }
  const submit = () => act(async () => { document.querySelector('form.onboard')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

  it('bağlantı yokken: beklemeden "İnternet yok", istek gitmez; bağlanınca ad bir kez gönderilir', async () => {
    const useNet = await openCard();
    await act(async () => { useNet.setState({ status: 'çevrimdışı' }); });
    await submit();
    const st = document.querySelector('[data-testid="ad-bekliyor"]')!;
    expect(st.textContent).toBe('İnternet yok; adın bağlanınca kaydedilecek. Bu arada oynamaya devam edebilirsin.');
    expect(calls).toHaveLength(0);
    await act(async () => { useNet.setState({ status: 'bağlı' }); });
    await act(async () => { useNet.setState({ status: 'bağlı', me: { ...me } as never }); });
    expect(calls.filter((c) => c.op === 'profile.update')).toEqual([{ op: 'profile.update', data: { name: 'Kulakçı', color: expect.any(Number) } }]);
  });
  it('tarayıcı ağ yok diyorsa (navigator.onLine false) da beklemez', async () => {
    const useNet = await openCard(); void useNet;
    const d = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')!;
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
    try {
      await submit();
      expect(document.querySelector('[data-testid="ad-bekliyor"]')!.getAttribute('data-durum')).toBe('yok');
    } finally { Object.defineProperty(Navigator.prototype, 'onLine', d); }
  });
  it('bağlıyken yanıt gecikince "Bağlantı zayıf"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openCard();
    await submit();
    expect(document.querySelector('[data-testid="ad-bekliyor"]')).toBeNull();
    expect(calls.map((c) => c.op)).toEqual(['profile.update']);
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    expect(document.querySelector('[data-testid="ad-bekliyor"]')!.textContent).toBe('Bağlantı zayıf; adın bağlanınca kaydedilecek. Bu arada oynamaya devam edebilirsin.');
  });
  it('karşılama: takım kilitliyken açılış bölümünü söyler (eşik features.ts\'ten)', async () => {
    const { merhabaMetni } = await import('./ui/Onboarding'); const { featureById } = await import('./ftue/features');
    const { useStore } = await import('./store');
    useStore.setState({ progress: {} });
    expect(merhabaMetni()).toBe(`İlk bölümler seni bekliyor; takımlar ${featureById('team').at}. bölümde açılır.`);
    useStore.setState({ ftue: { ...useStore.getState().ftue, bypass: true } });
    expect(merhabaMetni()).toBe('Takımlar ve sohbet seni bekliyor.');
  });
});
