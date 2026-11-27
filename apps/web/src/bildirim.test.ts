import { describe, expect, it, vi } from 'vitest';
import type { Nav } from './nav';
import { installPlatform, type PushIzin } from './platform';
import { bildirimOner, onIzinYanit, pushDestekli, pushDokunuldu, pushDokunusDinle, useBildirim } from './bildirim/bildirim';
import { bildirimHedefi } from './bildirim/BildirimHost';
import { GIZLILIK_EN, GIZLILIK_TR, HESAP_SIL } from './yasal/metin';

/** 1.3.0 anlık bildirimler, web katmanı: dokunmanın yönlendirmesi, bekletilmesi ve izin ön sorusunun bir kez çıkması */
describe('anlık bildirimler (web)', () => {
  it('dokunma: dinleyen yoksa bekler, gelince bir kez verilir; bilinmeyen tür yok sayılır', () => {
    pushDokunuldu({ kind: 'bilinmeyen', id: 'x' });
    pushDokunuldu({ kind: 'dm', id: 'p1' });
    const got: unknown[] = [];
    const stop = pushDokunusDinle((d) => got.push(d));
    pushDokunuldu({ kind: 'odul' });
    stop();
    pushDokunuldu({ kind: 'takim', id: 't1' }); // dinleyen yok: bekler
    const got2: unknown[] = [];
    pushDokunusDinle((d) => got2.push(d))();
    expect(got).toEqual([{ kind: 'dm', id: 'p1' }, { kind: 'odul', id: '' }]);
    expect(got2).toEqual([{ kind: 'takim', id: 't1' }]);
  });

  it('hedefler: özel mesaj konuşması, Takım sekmesi, Arkadaşlar, Ödül kutusu', () => {
    const open = vi.fn(); const tab = vi.fn();
    const nav = { open, tab, play: vi.fn() } as unknown as Nav;
    bildirimHedefi(nav, { kind: 'dm', id: 'p1' });
    bildirimHedefi(nav, { kind: 'dm', id: '' });
    bildirimHedefi(nav, { kind: 'takim', id: 't1' });
    bildirimHedefi(nav, { kind: 'basvuru', id: 't1' });
    bildirimHedefi(nav, { kind: 'arkadas', id: 'p2' });
    bildirimHedefi(nav, { kind: 'odul', id: '' });
    expect(open.mock.calls.map((c) => c[0])).toEqual([{ name: 'dm', id: 'p1' }, { name: 'messages' }, { name: 'friends' }, { name: 'inbox' }]);
    expect(tab.mock.calls.map((c) => c[0])).toEqual(['team', 'team']);
  });

  it('ön soru: tarayıcıda yok; telefonda izin sorulmadıysa bir kez çıkar, "Evet" sistem iznini ister; sonra bir daha çıkmaz', async () => {
    expect(pushDestekli()).toBe(false);
    await bildirimOner();
    expect(useBildirim.getState().onIzin).toBe(false);
    const depo = new Map<string, string>();
    let izin: PushIzin = 'undetermined';
    const request = vi.fn(async () => { izin = 'granted'; return izin; });
    installPlatform({
      storage: { getItem: async (k) => depo.get(k) ?? null, setItem: async (k, v) => { depo.set(k, v); }, removeItem: async (k) => { depo.delete(k); } },
      push: { status: async () => izin, request, token: async () => null, openSettings: () => undefined },
    });
    expect(pushDestekli()).toBe(true);
    // özel mesaj bildirimi kapalıysa sorulmaz
    useBildirim.setState({ settings: { dm: false, takim: false, arkadas: true, basvuru: true } });
    await bildirimOner();
    expect(useBildirim.getState().onIzin).toBe(false);
    useBildirim.setState({ settings: null });
    await bildirimOner();
    expect(useBildirim.getState().onIzin).toBe(true);
    await onIzinYanit(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(useBildirim.getState()).toMatchObject({ onIzin: false, izin: 'granted' });
    izin = 'undetermined';
    await bildirimOner();
    expect(useBildirim.getState().onIzin).toBe(false); // bir kez soruldu
  });

  it('gizlilik metni: bildirim anahtarı sunucuda, bildirim için; kapatınca ve hesap silinince silinir; aktarım Expo, Apple, Google', () => {
    const tr = JSON.stringify(GIZLILIK_TR); const en = JSON.stringify(GIZLILIK_EN); const hs = JSON.stringify(HESAP_SIL);
    for (const k of ['Anlık bildirim anahtarı', 'Sunucumuzda saklanır; bildirimleri kapatınca', 'hesabınızı silince silinir', 'Expo (650 Industries, Inc., ABD), Apple ve Google', 'bildirim anahtarlarınız']) expect(tr).toContain(k);
    for (const k of ['Push notification token', 'deleted when you turn notifications off', 'when you delete your account', 'Expo (650 Industries, Inc., USA), Apple and Google', 'push notification tokens']) expect(en).toContain(k);
    expect(hs).toContain('bildirim anahtarlarınız');
    expect(tr + en).not.toMatch(/admin (panel|ekran|screen)|yönetici (paneli|ekranı)/i);
  });
});
