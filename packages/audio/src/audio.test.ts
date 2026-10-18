import { describe, expect, it } from 'vitest';
import { Sequencer, alignStart, hash, rng } from './sequencer';
import { VoiceLimiter } from './limiter';
import { BIOME_TRACKS, TRACKS, barEvents, resolveTrack } from './music';
import { SFX, sfxRule } from './sfx';
import { ALL_SFX } from './offline';
import { BIOME_ORDER } from '@odi/content';

describe('sıralayıcı zamanlaması', () => {
  it('ölçüleri ileriden, bir kez ve kaymadan planlar', () => {
    const got: [number, number][] = [];
    const s = new Sequencer({ bpm: 104, startAt: 1, lookahead: 0.3, onBar: (b, t) => got.push([b, t]) });
    // düzensiz aralıklarla tick (setTimeout titremesi): planlanan zaman yine kesin
    let now = 0;
    for (let i = 0; i < 4000; i++) { now += 0.02 + (i % 7) * 0.013; s.tick(now); }
    const barDur = (60 / 104) * 4;
    expect(got.length).toBeGreaterThan(100);
    got.forEach(([b, t], i) => { expect(b).toBe(i); expect(t).toBeCloseTo(1 + i * barDur, 9); });
    // her ölçü, başlamadan önce planlanmış olmalı (ileriden planlama)
    expect(new Set(got.map(([b]) => b)).size).toBe(got.length);
  });
  it('lookahead dışındaki ölçüyü erken planlamaz', () => {
    const got: number[] = [];
    const s = new Sequencer({ bpm: 120, startAt: 0, lookahead: 0.25, onBar: (b) => got.push(b) });
    s.tick(0); expect(got).toEqual([0]);
    s.tick(1.7); expect(got).toEqual([0]);
    s.tick(1.76); expect(got).toEqual([0, 1]);
  });
  it('sekme uyuyup uyanınca geçmiş ölçüleri çalmaz', () => {
    const got: number[] = [];
    const s = new Sequencer({ bpm: 120, startAt: 0, lookahead: 0.2, onBar: (b) => got.push(b) });
    s.tick(0); s.tick(60.5);
    expect(got[0]).toBe(0); expect(got.slice(1)).toEqual([30]);
  });
  it('tek seferlik parça maxBars sonra durur', () => {
    const got: number[] = [];
    const s = new Sequencer({ bpm: 120, startAt: 0, maxBars: 2, onBar: (b) => got.push(b) });
    s.tick(0, 100); expect(got).toEqual([0, 1]); expect(s.done).toBe(true); expect(s.endTime).toBeCloseTo(4);
  });
  it('geçiş: yeni parça önceki parçanın sıradaki vuruşuna hizalanır', () => {
    const beat = 60 / 104;
    const t = alignStart(10, { startAt: 2, beatDur: beat }, 0.06);
    expect(t).toBeGreaterThanOrEqual(10.06);
    expect(((t - 2) / beat) % 1).toBeCloseTo(0, 6);
    expect(alignStart(5, null, 0.05)).toBeCloseTo(5.05);
  });
});

describe('ses sınırlayıcı', () => {
  it('jeton yağmurunu gruplar: çok yakın kopyalar birleşir, üst sınır aşılmaz', () => {
    const lim = new VoiceLimiter(16, sfxRule);
    let played = 0; let maxSame = 0;
    for (let i = 0; i < 40; i++) { const at = i * 0.01; if (lim.request('coin', at, 0.15) > 0) played++; maxSame = Math.max(maxSame, lim.count(at)); }
    expect(played).toBeLessThan(20);
    expect(played).toBeGreaterThan(5);
    expect(maxSame).toBeLessThanOrEqual(sfxRule('coin').cap);
  });
  it('üst üste binen kopyalar giderek kısılır', () => {
    const lim = new VoiceLimiter(16, sfxRule);
    const g = [0, 0.04, 0.08].map((t) => lim.request('coin', t, 0.3));
    expect(g[0]).toBe(1); expect(g[1]!).toBeLessThan(g[0]!); expect(g[2]!).toBeLessThan(g[1]!);
  });
  it('toplam sınır dolunca düşük öncelikli dokunma sesi atlanır, ödül sesi kısılarak çalar', () => {
    const lim = new VoiceLimiter(4, sfxRule);
    ['star1', 'star2', 'star3', 'unlock'].forEach((n, i) => lim.request(n, i * 0.001, 2));
    expect(lim.request('tap', 0.01, 0.05)).toBe(0);
    const g = lim.request('perfect', 0.01, 0.5); expect(g).toBeGreaterThan(0); expect(g).toBeLessThan(1);
  });
  it('süresi biten sesler sayılmaz', () => {
    const lim = new VoiceLimiter(16, sfxRule);
    lim.request('coin', 0, 0.1); expect(lim.count(0.05)).toBe(1); expect(lim.count(0.2)).toBe(0);
  });
});

describe('parça seçimi ve içerik', () => {
  it('her biyomun kendi teması var', () => {
    for (const b of BIOME_ORDER) expect(TRACKS[`biyom:${b}`], b).toBeTruthy();
    expect(new Set(BIOME_ORDER.map((b) => TRACKS[`biyom:${b}`]!.desc)).size).toBe(BIOME_ORDER.length);
  });
  it('bilinmeyen biyom sabit bir biyom temasına düşer; bilinmeyen ad null', () => {
    const a = resolveTrack('biyom:yeni-bolge'); expect(a).toBeTruthy(); expect(BIOME_TRACKS).toContain(a!.id);
    expect(resolveTrack('biyom:yeni-bolge')!.id).toBe(a!.id);
    expect(resolveTrack('harita')!.id).toBe('harita');
    expect(resolveTrack('yok')).toBeNull();
  });
  it('ölçü olayları ölçü içinde, notalar duyulur aralıkta, döngüler 8-16 ölçü', () => {
    for (const def of Object.values(TRACKS)) {
      expect(def.oneShot ? def.bars >= 1 : def.bars >= 8 && def.bars <= 16, def.id).toBe(true);
      for (let b = 0; b < def.bars * 2; b++) for (const e of barEvents(def, b)) {
        expect(e.at, def.id).toBeGreaterThanOrEqual(0); expect(e.at, def.id).toBeLessThan(4);
        expect(e.v).toBeGreaterThan(0); expect(e.v).toBeLessThanOrEqual(1.01);
        if (!['kick', 'heart', 'snare', 'clap', 'hat', 'ohat', 'shaker', 'cym', 'riser'].includes(e.inst)) { expect(e.m, `${def.id} ${e.inst}`).toBeGreaterThanOrEqual(24); expect(e.m).toBeLessThanOrEqual(108); }
      }
    }
  });
  it('döngü çeşitlemeli: ikinci tur birincinin aynısı değil, ama tekrarlanabilir', () => {
    const def = TRACKS.harita!;
    const one = JSON.stringify(Array.from({ length: def.bars }, (_, b) => barEvents(def, b)));
    const two = JSON.stringify(Array.from({ length: def.bars }, (_, b) => barEvents(def, b + def.bars)));
    expect(two).not.toBe(one);
    expect(JSON.stringify(barEvents(def, 3))).toBe(JSON.stringify(barEvents(def, 3)));
  });
  it('parçalar tempo/ton olarak ayrışır', () => {
    const sig = Object.values(TRACKS).map((t) => `${t.bpm}|${t.desc.split('·')[0]}`);
    expect(new Set(sig).size).toBeGreaterThanOrEqual(Object.keys(TRACKS).length - 3);
  });
  it('Sfx türündeki her ses tasarlanmış', () => {
    for (const s of ALL_SFX) expect(typeof SFX[s], s).toBe('function');
    expect(Object.keys(SFX).sort()).toEqual([...ALL_SFX].sort());
  });
  it('rastgele üreteç deterministik', () => {
    const a = rng(hash('x')), b = rng(hash('x'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
