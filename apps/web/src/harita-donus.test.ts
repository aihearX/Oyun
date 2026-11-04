// @vitest-environment jsdom
// Oyuncu testi tur 12 (YN-213): Bölüm 20 (Serumen Golemi) haritada Kemikçikler bölgesinde durur; kalıcı düğüm kartı geri dönüşü ve
// gerçek yeri söyler (serumen yalnız dış kulak yolundadır). Bölüm dizilimi değişmez.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HUMAN_JOURNEY } from '@odi/content';
import { zoneOfLevels } from '@odi/game-core/lite';
import { MapCards } from './map/MapCards';

vi.mock('./ftue/voice', () => ({ speakLine: () => -1, stopVoiceIf: () => undefined }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ''; });

const kart = async (n: number) => {
  const h = document.createElement('div'); document.body.appendChild(h); const r = createRoot(h);
  await act(async () => { r.render(createElement(MapCards, { card: { kind: 'node', n }, stars: {}, unlocked: 40, onClose: () => undefined, onPlay: () => undefined })); });
  const ust = document.querySelector('[data-testid="bolum-ust"]')?.textContent; const yer = document.querySelector('[data-testid="bolum-yer"]')?.textContent ?? null;
  await act(async () => { r.unmount(); });
  return { ust, yer };
};

describe('harita: Kemikçikler bölgesindeki kanal bölümleri geri dönüşü söyler (YN-213)', () => {
  it('Bölüm 20 kartı: "Kulak Kanalı’na dönüş · Bölüm 20", alt satır dış kulak yolu', async () => {
    expect(HUMAN_JOURNEY.levels[19]!.biome).toBe('kanal');
    const k = await kart(20);
    expect(k.ust).toBe('Kulak Kanalı’na dönüş · Bölüm 20');
    expect(k.yer).toBe('Dış kulak yolu, zarın dışında');
    expect((await kart(17)).ust).toBe('Kulak Kanalı’na dönüş · Bölüm 17');
  });
  it('başka bir bölgenin içinde duran her bölümün dönüş kartı var (haritada yer sanılmasın)', () => {
    const zon = zoneOfLevels(HUMAN_JOURNEY.levels);
    const disari = HUMAN_JOURNEY.levels.filter((l, i) => zon[i] !== l.biome);
    expect(disari.map((l) => l.number)).toEqual([17, 20]);
    for (const l of HUMAN_JOURNEY.levels) expect(!!l.backCard, `${l.number}`).toBe(disari.includes(l));
  });
  it('kendi bölgesindeki bölümler biyom adını gösterir, yer satırı yok', async () => {
    expect(await kart(6)).toEqual({ ust: 'Kulak Kanalı · Bölüm 6', yer: null });
    expect(await kart(19)).toEqual({ ust: 'Kemikçikler · Bölüm 19', yer: null });
  });
});
