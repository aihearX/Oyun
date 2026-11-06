// @vitest-environment jsdom
// Günlük ödül jetonu sınırı görünür (YN-269, OT-rekabetci-53/54): Bugün satırı sunucunun hesaba geçirdiğini yazar, bilinmiyorken sayı
// yazmaz; Nasıl çalışır? sayfası kuralı sabitten üretir; Hazine penceresi ve sonuç satırı eklenmeyenin nedenini söyler.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { treasureAt } from '@odi/content';
import { LOCAL_JETON_CARRY_MAX, LOCAL_JETON_DAILY_MAX } from '@odi/shared';
import { SINIR_IPUCU, bekleyenGun, gunlukSatiri, hazinePenceresi, hesabaGecen, ledgerKey, odulDurumu, sinirKurali, sinirSatiri } from './odul-durum';

vi.mock('@odi/audio', () => ({ audio: { play: () => undefined, music: () => undefined, duck: () => undefined } }));
vi.mock('./ftue/voice', () => ({ speakLine: () => -1, stopVoiceIf: () => undefined }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const src = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
const nb = (t: string | null | undefined) => (t ?? '').replace(/\u00a0/g, ' ');
const tr = (n: number) => n.toLocaleString('tr-TR');
const MAX = LOCAL_JETON_DAILY_MAX;
const NOW = 1_800_000_000_000; const RESET = NOW + 3 * 3600_000;
const bag = { sosyal: true, bagli: true, now: NOW };

let root: Root | null = null; let el: HTMLDivElement | null = null;
afterEach(() => { if (root) act(() => root!.unmount()); el?.remove(); root = null; el = null; });
async function mount(node: ReturnType<typeof createElement>) {
  el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el);
  await act(async () => { root!.render(node); });
  return el;
}

describe('Bugün › Günlük ödül jetonu satırı', () => {
  it('bağlıyken: hesaba geçen / sınır (sunucunun dailyLeft değeri); notsuz', () => {
    const s = gunlukSatiri({ left: MAX - 460, resetAt: RESET }, bag)!;
    expect(s.metin).toBe(`Günlük ödül jetonu: 460 / ${tr(MAX)}`);
    expect(s.gecen).toBe(460); expect(s.seviye).toBe('normal'); expect(s.not).toBeUndefined();
  });
  it('%80 ve sonrası belirgin, kalan yazılır; dolunca "eklenmez"', () => {
    const yakin = gunlukSatiri({ left: Math.floor(MAX * 0.2), resetAt: RESET }, bag)!;
    expect(yakin.seviye).toBe('yakin'); expect(nb(yakin.not)).toBe(`Sınıra ${tr(Math.floor(MAX * 0.2))} jeton kaldı.`);
    expect(gunlukSatiri({ left: Math.floor(MAX * 0.2) + 1, resetAt: RESET }, bag)!.seviye).toBe('normal');
    const dolu = gunlukSatiri({ left: 0, resetAt: RESET }, bag)!;
    expect(dolu.metin).toBe(`Günlük ödül jetonu: ${tr(MAX)} / ${tr(MAX)}`); expect(dolu.seviye).toBe('dolu');
    expect(dolu.not).toContain('eklenmez');
  });
  it('çevrimdışı: son bilinen değer ve bunu söyleyen not', () => {
    const s = gunlukSatiri({ left: MAX - 300, resetAt: RESET }, { ...bag, bagli: false })!;
    expect(s.metin).toBe(`Günlük ödül jetonu: 300 / ${tr(MAX)}`); expect(s.not).toContain('Son bilinen değer');
  });
  it('bilinmiyorken ya da gün döndüyse sayı yazılmaz; sosyal katman kapalıysa (cüzdan yerel, sınır yok) satır yok', () => {
    for (const s of [gunlukSatiri(null, bag)!, gunlukSatiri(null, { ...bag, bagli: false })!, gunlukSatiri({ left: 0, resetAt: NOW }, { ...bag, bagli: false })!]) {
      expect(s.gecen).toBeNull(); expect(s.metin).not.toMatch(/\d/);
    }
    expect(gunlukSatiri({ left: 10, resetAt: RESET }, { ...bag, sosyal: false })).toBeNull();
  });
  it('kart: metin, çubuk ve not; bilinmiyorken çubuk ve sayı yok; Bugün ekranında bağlı', async () => {
    const { GunlukJetonSatiri } = await import('./screens/TodayScreen');
    const h = await mount(createElement(GunlukJetonSatiri, { satir: gunlukSatiri({ left: 100, resetAt: RESET }, { ...bag, bagli: false })!, onInfo: () => undefined }));
    expect(h.querySelector('[data-testid="bugun-gunluk-jeton-metin"]')!.textContent).toBe(`Günlük ödül jetonu: ${tr(MAX - 100)} / ${tr(MAX)}`);
    expect(h.querySelector('[data-testid="bugun-gunluk-jeton"]')!.getAttribute('data-seviye')).toBe('yakin');
    expect(h.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(h.querySelector('[data-testid="bugun-gunluk-jeton-not"]')!.textContent).toContain('Son bilinen değer');
    act(() => root!.unmount()); el!.remove(); root = null;
    const u = await mount(createElement(GunlukJetonSatiri, { satir: gunlukSatiri(null, { ...bag, bagli: false })!, onInfo: () => undefined }));
    expect(u.querySelector('[data-testid="bugun-gunluk-jeton"]')!.textContent).not.toMatch(/\d/);
    expect(u.querySelector('[role="progressbar"]')).toBeNull();
    const t = src('screens/TodayScreen.tsx');
    expect(t).toContain('<GunlukJetonSatiri satir={gunlukS} onInfo={onInfo} />'); expect(t).toContain('gunlukYenile()');
  });
});

describe('Nasıl çalışır? › Günlük ödül jetonu sınırı', () => {
  it('kural sabitten üretilir: sayılan, sayılmayan, İstanbul günü, dolunca aşan kısım bekleyen ödül olur (karar 54)', async () => {
    const { InfoScreen } = await import('./screens/InfoScreen');
    const h = await mount(createElement(InfoScreen, { onBack: () => undefined }));
    const k = h.querySelector('[data-testid="bilgi-gunluk-sinir"]')!.textContent!;
    expect(k).toContain(`${tr(MAX)} jeton`);
    for (const w of ['hazine', 'başarım', 'görev', 'sandık', 'takvim', 'Şanslı Nota', 'kaybolmaz', 'bekleyen ödül', 'sonraki güne', 'gece yarısı', 'İstanbul', 'bölümde topladığın jeton', 'takım hediyesi']) expect(k).toContain(w);
    // sabit yazılmaz: değer LOCAL_JETON_DAILY_MAX'tan gelir
    expect(src('screens/InfoScreen.tsx')).not.toContain(tr(MAX));
    expect(src('screens/InfoScreen.tsx')).toContain('tr(LOCAL_JETON_DAILY_MAX)');
  });
});

describe('Hazine penceresi ve sonuç satırı: eklenmeyenin nedeni', () => {
  it('"N jeton eklenmedi" yanında bugünkü sınır ve kuralın yeri', () => {
    expect(nb(sinirSatiri(110))).toBe(`110 jeton eklenmedi: bugünkü ${tr(MAX)} jetonluk ödül sınırı doldu`);
    const items = treasureAt(25)?.reward ?? [{ kind: 'jeton' as const, amount: 110 }];
    const h = hazinePenceresi(items, { k: 'kesik', eksik: 110 }, 'x');
    expect(nb(h.note)).toBe(`110 jeton eklenmedi: bugünkü ${tr(MAX)} jetonluk ödül sınırı doldu. ${SINIR_IPUCU}`);
    // toplu "Yolda kazandıkların" penceresi de aynı notu kullanır
    expect(src('screens/MapScreen.tsx').match(/sinirNotu\(/g)?.length).toBe(2);
  });
});

describe('karar 54 (YN-270): sınırı aşan jeton bekleyen ödül olur, sonraki günlerde geçer', () => {
  const g = { at: 1, reason: 'hazine:25', items: [{ kind: 'jeton' as const, amount: 110 }] };
  const kaynak = (k: Record<string, { jeton: number; credited: number; gun?: number }>) => ({ krediler: k, bekleyen: new Set<string>(), sosyal: true, bagli: true });
  it('bekleyen gün sayısı: her gün en çok sınır kadar', () => {
    expect([0, 1, MAX, MAX + 1, 3 * MAX].map(bekleyenGun)).toEqual([1, 1, 1, 2, 3]);
  });
  it('sonuç ve hazine cümlesi gerçek sayıyı ve ne zaman geçeceğini söyler; güncellenmemiş sunucuda eski "eklenmedi"', () => {
    expect(nb(sinirSatiri(110, 1))).toBe(`110 jeton yarın hesabına geçecek: bugünkü ${tr(MAX)} jetonluk ödül sınırı doldu`);
    expect(nb(sinirSatiri(110, 3))).toBe(`110 jeton 3 gün içinde hesabına geçecek: bugünkü ${tr(MAX)} jetonluk ödül sınırı doldu`);
    expect(nb(sinirSatiri(110))).toContain('eklenmedi');
    expect(sinirKurali(1)).toContain('aşan kısım kaybolmaz'); expect(sinirKurali()).toContain('sınır yarın yenilenir');
    const items = [{ kind: 'jeton' as const, amount: 110 }];
    const h = hazinePenceresi(items, { k: 'kesik', eksik: 70, gun: 1 }, 'x');
    expect(nb(h.note)).toBe(`70 jeton yarın hesabına geçecek: bugünkü ${tr(MAX)} jetonluk ödül sınırı doldu. ${SINIR_IPUCU}`);
    expect(h.items).toEqual([{ kind: 'jeton', amount: 40 }]); expect(h.gun).toBe(1);
  });
  it('sunucu yanıtındaki bekleyen (gun) kayda ve sonuç kartına geçer; karışık (eski sunucu) kayıtta "eklenmedi" kalır', () => {
    const id = ledgerKey(1, 'hazine:25');
    expect(odulDurumu(g, kaynak({ [id]: { jeton: 110, credited: 40, gun: 1 } }))).toEqual({ k: 'kesik', eksik: 70, gun: 1 });
    expect(odulDurumu(g, kaynak({ [id]: { jeton: 110, credited: 40 } }))).toEqual({ k: 'kesik', eksik: 70 });
    const r = hesabaGecen([g], kaynak({ [id]: { jeton: 110, credited: 40, gun: 2 } }));
    expect(r.eksik).toBe(70); expect(r.gun).toBe(2);
    const g2 = { at: 2, reason: 'basarim:x:1', items: [{ kind: 'jeton' as const, amount: 40 }] };
    expect(hesabaGecen([g, g2], kaynak({ [id]: { jeton: 110, credited: 40, gun: 1 }, [ledgerKey(2, 'basarim:x:1')]: { jeton: 40, credited: 0 } })).gun).toBeUndefined();
  });
  it('Bugün: bekleyen miktar ve ne zaman geçeceği; dolunca "kaybolmaz"; bugün bekleyenden geçen söylenir; eski sunucuda satır yok', async () => {
    const dolu = gunlukSatiri({ left: 0, resetAt: RESET, carry: 110, carried: 0 }, bag)!;
    expect(nb(dolu.bekleyen)).toBe('Bekleyen ödül: 110 jeton, yarın hesabına geçecek.');
    expect(dolu.not).toContain('kaybolmaz'); expect(dolu.not).not.toContain('eklenmez');
    const cok = gunlukSatiri({ left: 0, resetAt: RESET, carry: 2 * MAX - 10, carried: MAX }, bag)!;
    expect(nb(cok.bekleyen)).toBe(`Bekleyen ödül: ${tr(2 * MAX - 10)} jeton, 2 gün içinde hesabına geçecek (günde en çok ${tr(MAX)}).`);
    expect(cok.not).toContain('kaybolmaz');
    expect(nb(cok.not)).toContain(`Bugün bekleyen ödülden ${tr(MAX)} jeton hesabına geçti`);
    expect(gunlukSatiri({ left: 0, resetAt: RESET, carry: 0, carried: 0 }, bag)!.bekleyen).toBeUndefined();
    const eski = gunlukSatiri({ left: 0, resetAt: RESET }, bag)!;
    expect(eski.bekleyen).toBeUndefined(); expect(eski.not).toContain('eklenmez');
    const { GunlukJetonSatiri } = await import('./screens/TodayScreen');
    const h = await mount(createElement(GunlukJetonSatiri, { satir: dolu, onInfo: () => undefined }));
    expect(nb(h.querySelector('[data-testid="bugun-bekleyen"]')!.textContent)).toBe('Bekleyen ödül: 110 jeton, yarın hesabına geçecek.');
  });
});

describe('bekleyen ödül tavanı (LOCAL_JETON_CARRY_MAX): tavanı aşan kısım "eklenmedi" diye ayrıca yazılır', () => {
  const CARRY = LOCAL_JETON_CARRY_MAX;
  const g = { at: 1, reason: 'hazine:25', items: [{ kind: 'jeton' as const, amount: 110 }] };
  const id = ledgerKey(1, 'hazine:25');
  const kaynak = (k: Record<string, { jeton: number; credited: number; gun?: number; kayip?: number }>) => ({ krediler: k, bekleyen: new Set<string>(), sosyal: true, bagli: true });
  it('iki günlük tavan', () => { expect(CARRY).toBe(2 * MAX); });
  it('kısmen bekleyende: geçecek ve eklenmeyen ayrı sayılarla; tamamı tavanda: "eklenmedi" ve nedeni', () => {
    expect(nb(sinirSatiri(110, 2, 30))).toBe(`80 jeton 2 gün içinde hesabına geçecek, 30 jeton eklenmedi: bugünkü ${tr(MAX)} jetonluk ödül sınırı doldu, ${tr(CARRY)} jetonluk bekleyen ödül sınırı da dolu`);
    expect(nb(sinirSatiri(110, undefined, 110))).toBe(`110 jeton eklenmedi: bugünkü ${tr(MAX)} jetonluk ödül sınırı doldu, ${tr(CARRY)} jetonluk bekleyen ödül sınırı da dolu`);
    expect(sinirKurali(undefined, 110)).toContain(`bekleyen en çok ${tr(CARRY)} jeton`);
    expect(sinirKurali(1)).toContain(`bekleyen en çok ${tr(CARRY)} jeton`);
  });
  it('kredi kaydındaki kayıp durumdan sonuç kartına ve hazine penceresine geçer', () => {
    const tam = kaynak({ [id]: { jeton: 110, credited: 40, kayip: 70 } });
    expect(odulDurumu(g, tam)).toEqual({ k: 'kesik', eksik: 70, kayip: 70 });
    const r = hesabaGecen([g], tam);
    expect(r.eksik).toBe(70); expect(r.kayip).toBe(70); expect(r.gun).toBeUndefined();
    const kismi = hesabaGecen([g], kaynak({ [id]: { jeton: 110, credited: 40, gun: 2, kayip: 20 } }));
    expect(kismi.eksik).toBe(70); expect(kismi.kayip).toBe(20); expect(kismi.gun).toBe(2);
    const h = hazinePenceresi(g.items, { k: 'kesik', eksik: 70, gun: 2, kayip: 20 }, 'x');
    expect(nb(h.note)).toContain('50 jeton 2 gün içinde hesabına geçecek, 20 jeton eklenmedi');
    expect(h.items).toEqual([{ kind: 'jeton', amount: 40 }]);
  });
  it('Bugün: bekleyen tavandayken sınır dolu notu "kaybolmaz" demez, "eklenmez" der', () => {
    const t = gunlukSatiri({ left: 0, resetAt: RESET, carry: CARRY, carried: 0 }, bag)!;
    expect(t.not).toContain('eklenmez'); expect(t.not).not.toContain('kaybolmaz'); expect(nb(t.not)).toContain(`en çok ${tr(CARRY)} jeton`);
  });
  it('net.ts sunucunun carryAdded alanından kaybı hesaplar; Nasıl çalışır? tavanı sabitten yazar', () => {
    const n = src('net.ts');
    expect(n).toContain('r.carryAdded'); expect(n).toContain('sinirKesti(item.reason, eksik, gun, kayip)');
    expect(src('screens/InfoScreen.tsx')).toContain('tr(LOCAL_JETON_CARRY_MAX)');
  });
  it('açılışta son bilinen günlük durum bekleyen alanlarıyla geri yüklenir ("Bekleyen ödül hesabında" her açılışta tekrar çıkmaz)', () => {
    expect(src('net.ts')).toMatch(/useSocial\.setState\(\{ gunluk: \{ left: gunluk\.left, resetAt: gunluk\.resetAt, \.\.\.\(typeof gunluk\.carry === 'number' \? \{ carry: gunluk\.carry, carried:/);
  });
});
