import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '@odi/shared';
import { BUILDING_ORDER, CAMP_FIT_H, CAMP_MIN_W, DEPOT_CAP_H, DEPOT_RATE, LOTS, ZONE_LEVELS, campZoom, depotStored, tierChanged, tierOf, zonesOpen } from './layout';

describe('Kulak Kampı yerleşimi', () => {
  it('görsel kademeler: 1-3 / 4-6 / 7-9 / 10-12 / 13-15, 0 boş arsa', () => {
    expect(tierOf(0)).toBe(-1);
    expect([1, 3, 4, 6, 7, 9, 10, 12, 13, 15].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(tierChanged(3, 4)).toBe(true);
    expect(tierChanged(4, 5)).toBe(false);
  });
  it('Kamp Merkezi seviyesiyle açılan bölgeler', () => {
    expect(ZONE_LEVELS[0]).toBe(1);
    expect([1, 3, 4, 7, 10, 13, 15].map(zonesOpen)).toEqual([1, 1, 2, 3, 4, 5, 5]);
  });
  it('depo hesabı sunucu kuralıyla aynı (seviye × 20/saat, 8 saatte dolar)', () => {
    const t0 = 1_000_000;
    expect(depotStored(0, t0, t0 + 9e9).stored).toBe(0);
    expect(depotStored(3, t0, t0 + 3_600_000)).toEqual({ stored: 3 * DEPOT_RATE, max: 3 * DEPOT_RATE * DEPOT_CAP_H, ratio: 1 / DEPOT_CAP_H });
    expect(depotStored(3, t0, t0 + 99 * 3_600_000).ratio).toBe(1);
    expect(depotStored(2, t0, t0 - 5000).stored).toBe(0);
  });
  it('her binanın bir arsası var ve arsalar çakışmıyor', () => {
    expect(new Set(BUILDING_ORDER)).toEqual(new Set(BUILDINGS.map((b) => b.id)));
    for (const a of BUILDING_ORDER) for (const b of BUILDING_ORDER) {
      if (a >= b) continue;
      const la = LOTS[a], lb = LOTS[b];
      const ha = la.tiles * 16 + 4, hb = lb.tiles * 16 + 4;
      // izometrik elmaslar: |dx|/(2h) + |dy|/h toplamı iki yarıçap toplamından büyük olmalı
      const dx = Math.abs(la.x - lb.x), dy = Math.abs(la.y - lb.y);
      expect(dx / 2 + dy).toBeGreaterThan(ha + hb - 1);
    }
  });
  it('açılış yakınlaştırması yüksekliğe de bakar (MK-028): uzun telefonda ada ekranı doldurur, eski değerin altına inmez', () => {
    const old = (w: number, h: number) => Math.min(1.1, Math.max(0.5, Math.min(w / 540, h / 600)));
    for (const [w, h] of [[320, 640], [360, 640], [390, 844], [440, 956], [430, 932], [768, 1024], [1280, 800], [844, 390]] as const) {
      const z = campZoom(w, h);
      expect(z).toBeGreaterThanOrEqual(old(w, h)); // dokunma hedefleri (dünya birimi × yakınlaştırma) küçülmez
      expect(w / z).toBeGreaterThanOrEqual(Math.min(CAMP_MIN_W, w / old(w, h)) - 1e-9); // görünür genişlik üst sınırı
    }
    // uzun telefonlar: görünür yükseklik ada yüksekliğine yakın (eskiden ~1170 birim)
    for (const [w, h] of [[390, 844], [440, 956]] as const) expect(h / campZoom(w, h)).toBeLessThanOrEqual(CAMP_FIT_H * 1.12);
    expect(campZoom(1280, 800)).toBe(1.1); // geniş ekran: eski görünüm
  });
});
