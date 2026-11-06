import { describe, expect, it, vi } from 'vitest';
import type { OpMap } from '@odi/shared';
import { createOdemeKuyrugu, ODEME_KUYRUGU_ANAHTARI, TARAMA_ARALIK_MS, TARAMA_OMUR_MS, type OdemeKuyruguDeps } from './odeme-kuyrugu';

type PRes = OpMap['shop.purchase']['res'];
const wallet = (kristal: number) => ({ kristal }) as unknown as PRes['wallet'];
const res = (kristal: number, already?: boolean): PRes => ({ wallet: wallet(kristal), spend: {} as PRes['spend'], teamGiftSent: false, ...(already ? { already } : {}) });
const hata = (code: string, message = code) => Object.assign(new Error(message), { code });
const restoreRes = (restored: string[]): OpMap['shop.restore']['res'] => ({ restored: restored.map((productId) => ({ productId, store: 'app-store' as const })), alreadyHere: [], elsewhere: [], wallet: wallet(0), spend: {} as PRes['spend'], teamGiftSent: false });

/** cihaz deposu (AsyncStorage gibi): uygulama yeniden açılınca aynı nesne yeni kuyruğa verilir */
function depo() {
  const m = new Map<string, string>();
  return { m, storage: { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => { m.set(k, v); } } };
}
const kayit = (m: Map<string, string>) => JSON.parse(m.get(ODEME_KUYRUGU_ANAHTARI) ?? '{"odemeler":[],"tarama":[]}') as { odemeler: { receipt: string; tries: number }[]; tarama: { playerId: string }[] };
const odeme = { playerId: 'p1', productId: 'odi.baslangic', store: 'app-store' as const, receipt: 'tx1' };

describe('bekleyen mağaza ödemeleri (YN-285)', () => {
  it('makbuz sunucuya gitmeden önce kalıcı yazılır; işlenince silinir', async () => {
    const d = depo();
    const purchase = vi.fn(async () => { expect(kayit(d.m).odemeler.map((o) => o.receipt)).toEqual(['tx1']); return res(300); });
    const q = createOdemeKuyrugu({ storage: d.storage, purchase, restore: vi.fn() });
    const r = await q.odemeAlindi(odeme);
    expect(r).toMatchObject({ k: 'islendi', kalici: true });
    expect(purchase).toHaveBeenCalledWith({ productId: 'odi.baslangic', store: 'app-store', receipt: 'tx1' });
    expect(kayit(d.m).odemeler).toEqual([]);
  });

  it('sunucuya ulaşılamazsa kayıt kalır; uygulama yeniden açılıp bağlanınca bir kez işlenir', async () => {
    const d = depo();
    const q1 = createOdemeKuyrugu({ storage: d.storage, purchase: async () => { throw hata('CEVRIMDISI', 'Sunucuya bağlı değilsin.'); }, restore: vi.fn() });
    const r = await q1.odemeAlindi(odeme);
    expect(r).toMatchObject({ k: 'bekle', code: 'CEVRIMDISI', kalici: true });
    expect(await q1.bekleyenler('p1')).toHaveLength(1);
    expect(await q1.bekleyenler('p2')).toHaveLength(0);
    // yeni açılış: aynı depo, yeni kuyruk
    const purchase = vi.fn(async () => res(300));
    const q2 = createOdemeKuyrugu({ storage: d.storage, purchase, restore: vi.fn() });
    const { sonuclar } = await q2.bosalt('p1');
    expect(sonuclar.map((x) => x.k)).toEqual(['islendi']);
    expect(await q2.bekleyenler('p1')).toEqual([]);
    await q2.bosalt('p1');
    expect(purchase).toHaveBeenCalledTimes(1);
  });

  it('"zaten işlendi" başarı sayılır (yanıtı kaybolan istek); eski sunucunun TEKRAR yanıtı da', async () => {
    const d = depo();
    let n = 0;
    const q = createOdemeKuyrugu({ storage: d.storage, purchase: async () => { n++; if (n === 1) throw hata('KOPTU'); if (n === 2) return res(300, true); throw hata('TEKRAR'); }, restore: vi.fn() });
    expect((await q.odemeAlindi(odeme)).k).toBe('bekle');
    const r = (await q.bosalt('p1')).sonuclar[0]!;
    expect(r).toMatchObject({ k: 'zaten' });
    expect(r.k === 'zaten' && r.res?.wallet.kristal).toBe(300);
    expect(kayit(d.m).odemeler).toEqual([]);
    expect((await q.odemeAlindi({ ...odeme, receipt: 'tx2' })).k).toBe('zaten');
    expect(kayit(d.m).odemeler).toEqual([]);
  });

  it('kalıcı ret (başka hesaba işlenmiş, ürün yok) kaydı siler; geçici hata (MAKBUZ, SUNUCU) bırakır ve deneme sayar', async () => {
    const d = depo();
    const codes = ['MAKBUZ', 'SUNUCU', 'BASKA_HESAP'];
    const q = createOdemeKuyrugu({ storage: d.storage, purchase: async () => { throw hata(codes.shift()!); }, restore: vi.fn() });
    expect((await q.odemeAlindi(odeme)).k).toBe('bekle');
    expect(kayit(d.m).odemeler[0]!.tries).toBe(1);
    expect((await q.bosalt('p1')).sonuclar[0]!.k).toBe('bekle');
    expect(kayit(d.m).odemeler[0]!.tries).toBe(2);
    const r = (await q.bosalt('p1')).sonuclar[0]!;
    expect(r).toMatchObject({ k: 'ret', code: 'BASKA_HESAP' });
    expect(kayit(d.m).odemeler).toEqual([]);
  });

  it('bağlantı yokken sıradaki öteki kayıtlar denenmez; aynı kayıt aynı anda iki kez gönderilmez', async () => {
    const d = depo();
    let open = false; const bekleyen: (() => void)[] = [];
    const purchase = vi.fn(async () => { if (!open) throw hata('CEVRIMDISI'); await new Promise<void>((r) => { bekleyen.push(r); }); return res(1); });
    const q = createOdemeKuyrugu({ storage: d.storage, purchase, restore: vi.fn() });
    await q.odemeAlindi(odeme); await q.odemeAlindi({ ...odeme, receipt: 'tx2', productId: 'odi.pass' });
    purchase.mockClear();
    expect((await q.bosalt('p1')).sonuclar).toHaveLength(1);
    expect(purchase).toHaveBeenCalledTimes(1);
    open = true; purchase.mockClear();
    const ilk = q.bosalt('p1');
    await vi.waitFor(() => expect(purchase).toHaveBeenCalledTimes(1));
    // ilk tur tx1'i beklerken ikinci tur tx1'i atlar, tx2'yi gönderir; ilk tur sonra tx2'yi yeniden göndermez
    const ikinci = q.bosalt('p1');
    await vi.waitFor(() => expect(purchase).toHaveBeenCalledTimes(2));
    for (const r of bekleyen) r();
    const [a, b] = await Promise.all([ilk, ikinci]);
    expect([...a.sonuclar, ...b.sonuclar].map((x) => x.item.receipt).sort()).toEqual(['tx1', 'tx2']);
    expect(purchase).toHaveBeenCalledTimes(2);
    expect(kayit(d.m).odemeler).toEqual([]);
  });

  it('depoya yazılamasa da ödeme sunucuya gider (kalici: false)', async () => {
    const q = createOdemeKuyrugu({ storage: { getItem: async () => null, setItem: async () => { throw new Error('disk dolu'); } }, purchase: async () => res(5), restore: vi.fn() });
    expect(await q.odemeAlindi(odeme)).toMatchObject({ k: 'islendi', kalici: false });
  });

  it('makbuzu gelmeyen ödeme: tarama bağlanınca yapılır, aralığa uyar, ürün bulununca ya da süresi dolunca biter', async () => {
    const d = depo(); let t = 1_000_000;
    const restore = vi.fn<OdemeKuyruguDeps['restore']>(async () => restoreRes([]));
    const q = createOdemeKuyrugu({ storage: d.storage, purchase: vi.fn(), restore, now: () => t });
    expect((await q.bosalt('p1')).tarama).toBeNull();
    expect(restore).not.toHaveBeenCalled();
    await q.taramaIste('p1');
    expect((await q.bosalt('p1')).tarama).toEqual(restoreRes([]));
    await q.bosalt('p1');
    expect(restore).toHaveBeenCalledTimes(1); // aralık dolmadı
    expect(await q.bosalt('p2')).toEqual({ sonuclar: [], tarama: null });
    t += TARAMA_ARALIK_MS;
    restore.mockResolvedValueOnce(restoreRes(['odi.kristal.2']));
    expect((await q.bosalt('p1')).tarama?.restored).toHaveLength(1);
    expect(kayit(d.m).tarama).toEqual([]);
    // süresi dolan istek sessizce düşer
    await q.taramaIste('p1'); t += TARAMA_OMUR_MS + 1; restore.mockClear();
    expect((await q.bosalt('p1')).tarama).toBeNull();
    expect(restore).not.toHaveBeenCalled();
    expect(kayit(d.m).tarama).toEqual([]);
    // elle geri yükleme otomatik taramayı bitirir
    await q.taramaIste('p1'); await q.taramaBitti('p1');
    expect(kayit(d.m).tarama).toEqual([]);
  });

  it('bozuk kayıt okunmaz, kuyruk boş başlar; abone değişiklikte çağrılır', async () => {
    const d = depo(); d.m.set(ODEME_KUYRUGU_ANAHTARI, '{bozuk');
    const q = createOdemeKuyrugu({ storage: d.storage, purchase: async () => { throw hata('CEVRIMDISI'); }, restore: vi.fn() });
    expect(await q.bekleyenler('p1')).toEqual([]);
    const fn = vi.fn(); const off = q.abone(fn);
    await q.odemeAlindi(odeme);
    expect(fn).toHaveBeenCalled();
    off(); fn.mockClear();
    await q.taramaIste('p1');
    expect(fn).not.toHaveBeenCalled();
    d.m.set(ODEME_KUYRUGU_ANAHTARI, JSON.stringify({ odemeler: [{ playerId: 'p1' }, { ...odeme, receipt: 'tx9', at: 1, tries: 0 }], tarama: [] }));
    expect((await q.bekleyenler('p1')).map((o) => o.receipt)).toEqual(['tx9']);
  });
});
