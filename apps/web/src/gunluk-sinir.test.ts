// @vitest-environment jsdom
// Günlük ödül jetonu sınırı görünür (YN-269, OT-rekabetci-53/54): Bugün satırı sunucunun hesaba geçirdiğini yazar, bilinmiyorken sayı
// yazmaz; Nasıl çalışır? sayfası kuralı sabitten üretir; Hazine penceresi ve sonuç satırı eklenmeyenin nedenini söyler.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { treasureAt } from '@odi/content';
import { LOCAL_JETON_DAILY_MAX } from '@odi/shared';
import { SINIR_IPUCU, gunlukSatiri, hazinePenceresi, sinirSatiri } from './odul-durum';

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
  it('kural sabitten üretilir: sayılan, sayılmayan, İstanbul günü, dolunca eklenmez', async () => {
    const { InfoScreen } = await import('./screens/InfoScreen');
    const h = await mount(createElement(InfoScreen, { onBack: () => undefined }));
    const k = h.querySelector('[data-testid="bilgi-gunluk-sinir"]')!.textContent!;
    expect(k).toContain(`${tr(MAX)} jeton`);
    for (const w of ['hazine', 'başarım', 'görev', 'sandık', 'takvim', 'Şanslı Nota', 'eklenmez', 'gece yarısı', 'İstanbul', 'bölümde topladığın jeton', 'takım hediyesi']) expect(k).toContain(w);
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
