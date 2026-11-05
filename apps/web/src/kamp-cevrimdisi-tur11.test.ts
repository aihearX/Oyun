// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { NetClient } from '@odi/net';
import type { VakaState } from '@odi/shared';

vi.mock('./ftue/voice', () => ({ speakLine: () => 1, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
const calls: { op: string; data: unknown }[] = [];
let reply: (op: string) => unknown = () => null;
vi.mock('./net', () => ({ act: async (op: string, data: unknown) => { calls.push({ op, data }); return reply(op); }, toast: () => undefined }));

/**
 * Oyuncu testi tur 11 (YN-188, YN-164 (1), YN-180 (1), YN-189): Kamp bağlantı kopukken susmaz.
 *  - Klinik çevrimdışı açılınca "İnternet yok · bağlanınca hastalar gelir" der, bağlanınca kendiliğinden yükler; sunucu hatasında
 *    "Yeniden dene". Sonsuz "yükleniyor" yok.
 *  - Bağlantı yokken basılan Klinik kararı ve Kamp Görevleri "Al": düğmenin yanında "Bağlanınca gönderilecek/alınacak"; bağlanınca satır kalkar.
 *  - Kamp Seviyesi penceresi unvanı yalnız o seviyede değiştiyse yazar.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); }); root = null; document.body.innerHTML = ''; calls.length = 0; reply = () => null;
  const { useNet } = await import('@odi/net/store'); useNet.setState({ status: 'kapalı' });
  const { useKg } = await import('./camp/gorev/state'); useKg.setState({ kg: null, vaka: null, panel: null, busy: null, bekleyen: null });
});
async function render(node: ReturnType<typeof createElement>) {
  const h = document.createElement('div'); h.id = 'root'; document.body.appendChild(h); root = createRoot(h);
  await act(async () => { root!.render(node); });
}
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const $ = (id: string) => document.querySelector(`[data-testid="${id}"]`);

/** bindKg'ye verilen sahte istemci: `vaka.state` yanıtı testte seçilir */
function fakeClient(vaka: () => Promise<VakaState>) {
  const c = { status: 'kapalı', n: 0, on: () => () => undefined, onStatus: () => () => undefined,
    call: async (op: string) => { if (op !== 'vaka.state') throw new Error(op); c.n++; return { vaka: await vaka() }; } };
  return c;
}
const VAKA: VakaState = { open: true, locked: null, tier: 1, klinikSv: 1, waiting: [], arrivedToday: 0, nextArrivalAt: null, book: [], total: 32, konsult: [], konsultLeft: 0 } as unknown as VakaState;

describe('Klinik çevrimdışı (OT-eski-telefon-32)', () => {
  it('internet yokken "İnternet yok" der, bağlanınca kendiliğinden yükler (pencere kapatıp açmadan)', async () => {
    const { useNet } = await import('@odi/net/store'); const { bindKg } = await import('./camp/gorev/state');
    const { KlinikPanel, KLINIK_CEVRIMDISI } = await import('./camp/gorev/Klinik');
    const c = fakeClient(async () => VAKA); bindKg(c as unknown as NetClient);
    useNet.setState({ status: 'bağlanıyor' });
    await render(createElement(KlinikPanel, { tab: 'salon' }));
    expect($('klinik-cevrimdisi')?.textContent).toContain(KLINIK_CEVRIMDISI);
    expect(document.body.textContent).not.toContain('yükleniyor');
    expect(c.n).toBe(0);
    c.status = 'bağlı'; await act(async () => { useNet.setState({ status: 'bağlı' }); }); await flush();
    expect(c.n).toBe(1);
    expect($('klinik-cevrimdisi')).toBeNull();
    expect($('salon-bos')).not.toBeNull();
  });
  it('sunucu hatasında "Yeniden dene"; basınca yeniden ister ve hastalar gelir', async () => {
    const { useNet } = await import('@odi/net/store'); const { bindKg } = await import('./camp/gorev/state');
    const { KlinikPanel } = await import('./camp/gorev/Klinik');
    let fail = true;
    const c = fakeClient(async () => { if (fail) throw new Error('SUNUCU'); return VAKA; }); c.status = 'bağlı'; bindKg(c as unknown as NetClient);
    useNet.setState({ status: 'bağlı' });
    await render(createElement(KlinikPanel, { tab: 'salon' })); await flush();
    expect($('klinik-hata')).not.toBeNull();
    expect(document.body.textContent).not.toContain('yükleniyor');
    fail = false;
    await act(async () => { ($('klinik-yeniden') as HTMLElement).click(); }); await flush();
    expect(c.n).toBe(2);
    expect($('klinik-hata')).toBeNull();
    expect($('salon-bos')).not.toBeNull();
  });
});

describe('bağlantı yokken basılan istek söylenir (OT-eski-telefon-33, -26)', () => {
  it('Klinik kararı: "Bağlanınca gönderilecek", bağlanınca satır kalkar; karar bir kez gider', async () => {
    const { useNet } = await import('@odi/net/store'); const { useKg } = await import('./camp/gorev/state');
    const { KlinikPanel } = await import('./camp/gorev/Klinik'); const { VAKALAR } = await import('@odi/content');
    const v = VAKALAR[0]!;
    useKg.setState({ vaka: { ...VAKA, waiting: [v.id] } });
    useNet.setState({ status: 'bağlanıyor' });
    let finish: (x: unknown) => void = () => undefined;
    reply = (op) => (op === 'vaka.answer' ? new Promise((r) => { finish = r; }) : null);
    await render(createElement(KlinikPanel, { tab: 'salon', vakaId: v.id }));
    const click = (el: Element | null) => act(async () => { (el as HTMLElement).click(); });
    await click($('testlere-gec'));
    await click(document.querySelector(`[data-test="${v.anahtar[0]}"]`));
    await click($('karara-gec'));
    await click(document.querySelector('[data-dx]'));
    await click(document.querySelector('[data-mg]'));
    await click($('karar-gonder'));
    expect(calls.filter((x) => x.op === 'vaka.answer')).toHaveLength(1);
    expect(($('karar-gonder') as HTMLButtonElement).disabled).toBe(true);
    expect($('bekleyen-istek')?.textContent).toContain('Bağlanınca gönderilecek');
    await act(async () => { useNet.setState({ status: 'bağlı' }); });
    expect($('bekleyen-istek')).toBeNull();
    await act(async () => { finish(null); });
    expect(calls.filter((x) => x.op === 'vaka.answer')).toHaveLength(1);
  });
  it('bağlıyken gönderilen kararda bekliyor satırı yok', async () => {
    const { useNet } = await import('@odi/net/store'); const { BekleyenSatir } = await import('./ui/bekleyen');
    useNet.setState({ status: 'bağlı' });
    await render(createElement(BekleyenSatir, { text: 'x' }));
    expect($('bekleyen-istek')).toBeNull();
  });
  it('Kamp Görevleri "Al": bağlantı yokken ödül "bekleyen", istek bitince temizlenir; bağlıyken hiç işaretlenmez', async () => {
    const { useNet } = await import('@odi/net/store'); const { claimKg, useKg } = await import('./camp/gorev/state');
    useNet.setState({ status: 'bağlanıyor' });
    let finish: (x: unknown) => void = () => undefined;
    reply = (op) => (op === 'kg.claim' ? new Promise((r) => { finish = r; }) : null);
    const p = claimKg('gunluk:1', 'Kamp görevi tamam!');
    expect(useKg.getState()).toMatchObject({ busy: 'gunluk:1', bekleyen: 'gunluk:1' });
    expect(await claimKg('gunluk:1', 'Kamp görevi tamam!')).toBeNull(); // ikinci basış istek göndermez
    finish(null); await p;
    expect(useKg.getState()).toMatchObject({ busy: null, bekleyen: null });
    expect(calls.filter((x) => x.op === 'kg.claim')).toHaveLength(1);
    useNet.setState({ status: 'bağlı' });
    reply = () => null;
    const q = claimKg('gunluk:2', 'x'); const seen = useKg.getState().bekleyen; await q;
    expect(seen).toBeNull();
  });
});

describe('Kamp Seviyesi penceresinde unvan (OT-ekonomi-denetci-38)', () => {
  it('unvan yalnız o seviyede değiştiyse ödül satırı olur', async () => {
    const { seviyeSatirlari } = await import('./camp/seviye');
    expect(seviyeSatirlari([4]).some((x) => x.startsWith('Unvan'))).toBe(false);
    expect(seviyeSatirlari([4])).toHaveLength(2); // Sv 4: süs + süs yeri, unvan yok
    expect(seviyeSatirlari([4])).toContain('+1 süs yeri');
    expect(seviyeSatirlari([5])[0]).toBe('Unvan: Kulak Kâşifi');
    expect(seviyeSatirlari([3, 4, 5])[0]).toBe('Unvan: Kulak Kâşifi');
    expect(seviyeSatirlari([6, 7]).some((x) => x.startsWith('Unvan'))).toBe(false);
  });
});
