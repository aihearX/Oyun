import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { duckLevelAt, duckPlan, pruneDucks, type DuckClaim } from './duck';
import { Engine } from './engine';

/** düzlemi örnekle: [t, düzey] (plan adımları arasında düzey sabit) */
const at = (claims: DuckClaim[], t: number) => duckLevelAt(claims, t);

describe('sahipli kısma: düzey hesabı (saf)', () => {
  it('anlatım + efekt: anlatım bitene kadar en çok 0,3, sonra 1', () => {
    const ses = { level: 0.3, from: 0, until: 4 };
    const efekt = { level: 0.35, from: 1, until: 1 + 2.4 }; // fanfare, anlatımın ortasında
    const c = [ses, efekt];
    for (let t = 0; t < 4; t += 0.05) expect(at(c, t)).toBeLessThanOrEqual(0.3);
    expect(at(c, 3.5)).toBe(0.3); // efektin süresi doldu, anlatım sürüyor: müzik geri gelmez
    expect(at(c, 4)).toBe(1);
    expect(duckPlan(c, 0)).toEqual([{ at: 0, level: 0.3 }, { at: 4, level: 1 }]);
  });
  it('efekt anlatımdan uzun sürerse anlatım bitince efektin düzeyine çıkar, efekt bitince 1', () => {
    const c = [{ level: 0.3, from: 0, until: 2 }, { level: 0.35, from: 1, until: 3 }];
    expect(duckPlan(c, 0)).toEqual([{ at: 0, level: 0.3 }, { at: 2, level: 0.35 }, { at: 3, level: 1 }]);
  });
  it('duraklat + anlatım biter: 0,25 kalır', () => {
    const m = new Map<string, DuckClaim>([['duraklat', { level: 0.25, from: 0, until: 3600 }], ['ses', { level: 0.3, from: 1, until: 5 }]]);
    expect(duckLevelAt(m.values(), 2)).toBe(0.25);
    m.delete('ses'); // satır bitti: yalnız anlatıcının kısması kalkar
    expect(duckLevelAt(m.values(), 2)).toBe(0.25);
    expect(duckPlan(m.values(), 2)).toEqual([{ at: 2, level: 0.25 }, { at: 3600, level: 1 }]);
  });
  it('kutlama + anlatım: en düşük olan geçerli', () => {
    const kutlama = { level: 0.35, from: 0, until: 6 }; const ses = { level: 0.3, from: 2, until: 5 };
    expect(at([kutlama, ses], 1)).toBe(0.35);
    expect(at([kutlama, ses], 3)).toBe(0.3);
    expect(at([kutlama, ses], 5.5)).toBe(0.35);
    expect(at([{ level: 0.2, from: 0, until: 6 }, ses], 3)).toBe(0.2);
    expect(duckPlan([kutlama, ses], 0)).toEqual([{ at: 0, level: 0.35 }, { at: 2, level: 0.3 }, { at: 5, level: 0.35 }, { at: 6, level: 1 }]);
  });
  it('süresi dolan sahip kalkar (yalnız o)', () => {
    const m = new Map<string, DuckClaim>([['efekt:levelUp', { level: 0.35, from: 0, until: 1.6 }], ['kutlama', { level: 0.3, from: 0, until: 3 }]]);
    pruneDucks(m, 1.6);
    expect([...m.keys()]).toEqual(['kutlama']);
    pruneDucks(m, 3);
    expect(m.size).toBe(0);
    expect(duckLevelAt(m.values(), 3)).toBe(1);
  });
  it('henüz başlamamış kısma (gecikmeli efekt) planda başlangıç anında iner', () => {
    expect(duckPlan([{ level: 0.35, from: 0.5, until: 1.5 }], 0)).toEqual([{ at: 0, level: 1 }, { at: 0.5, level: 0.35 }, { at: 1.5, level: 1 }]);
  });
});

// ---- motor: sahte AudioContext ile gerçek `duck` / `unduck` / `voice` yolu
type Ev = { kind: 'target'; v: number; t: number; tau: number };
class FakeParam {
  value: number; events: Ev[] = [];
  constructor(v: number) { this.value = v; }
  setTargetAtTime(v: number, t: number, tau: number) { this.events.push({ kind: 'target', v, t, tau }); this.events.sort((a, b) => a.t - b.t); return this; }
  setValueAtTime(v: number, t: number) { return this.setTargetAtTime(v, t, 0); }
  linearRampToValueAtTime(v: number, t: number) { return this.setTargetAtTime(v, t, 0); }
  cancelScheduledValues(t: number) { this.events = this.events.filter((e) => e.t < t); return this; }
  /** `t` anında yönelinen düzey (son başlamış olayın hedefi) */
  targetAt(t: number): number { let v = this.value; for (const e of this.events) if (e.t <= t) v = e.v; return v; }
}
class FakeNode { gain = new FakeParam(1); connect() { return this; } disconnect() { /* yok */ } }
class FakeCtx {
  currentTime = 0; sampleRate = 8000; destination = new FakeNode(); state = 'running';
  gains: FakeNode[] = [];
  createGain() { const n = new FakeNode(); this.gains.push(n); return n; }
  createDynamicsCompressor() { const p = () => new FakeParam(0); return Object.assign(new FakeNode(), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() }); }
  createConvolver() { return Object.assign(new FakeNode(), { buffer: null }); }
  createBuffer(_ch: number, n: number) { return { duration: n / this.sampleRate, getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { return Object.assign(new FakeNode(), { buffer: null, onended: null as null | (() => void), start() { /* yok */ }, stop() { this.onended?.(); } }); }
}
function engine() {
  const ctx = new FakeCtx();
  const eng = new Engine({ context: () => ctx as unknown as BaseAudioContext, intervalMs: 0 });
  eng.unlock();
  // ensure() sırası: master, sfx, duck, music, verb, voice veriyolları
  const duck = ctx.gains[2]!.gain; const voiceBus = ctx.gains[5]!.gain;
  return { ctx, eng, duck, voiceBus };
}
const line = (sec: number) => ({ duration: sec }) as AudioBuffer;

describe('sahipli kısma: motor', () => {
  // voice() güvenlik zamanlayıcısı gerçek saatte beklemesin
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('anlatım sürerken efektin kısması bitince müzik yükselmez; satır bitince 1', () => {
    const { ctx, eng, duck } = engine();
    const h = eng.voice(line(4))!; // ses: 0..4.3
    ctx.currentTime = 1; eng.duck('efekt:fanfare', 2.4, 0.35);
    for (let t = 1; t < 4.3; t += 0.1) expect(duck.targetAt(t)).toBeLessThanOrEqual(0.3);
    ctx.currentTime = 4.1; h.stop();
    expect(duck.targetAt(4.1)).toBe(1);
    expect(eng.duckOwners()).toEqual({});
  });
  it('duraklatma sürerken satır biter: 0,25 kalır; devam edince 1', () => {
    const { ctx, eng, duck } = engine();
    eng.duck('duraklat', 3600, 0.25);
    ctx.currentTime = 0.5; const h = eng.voice(line(2))!;
    ctx.currentTime = 1.5; h.stop();
    expect(duck.targetAt(1.5)).toBe(0.25);
    expect(duck.targetAt(100)).toBe(0.25);
    ctx.currentTime = 200; eng.unduck('duraklat');
    expect(duck.targetAt(200)).toBe(1);
  });
  it('kutlama + anlatım: en düşük geçerli, kutlama süresi dolunca anlatım kısması kalır', () => {
    const { ctx, eng, duck } = engine();
    eng.duck('kutlama', 3, 0.35);
    ctx.currentTime = 0.2; eng.voice(line(5)); // ses: 0,2..5,5
    expect(duck.targetAt(1)).toBe(0.3);
    expect(duck.targetAt(4)).toBe(0.3);
    expect(duck.targetAt(5.6)).toBe(1);
  });
  it('eski satırın geç gelen bitişi yeni satırın kısmasını kaldırmaz', () => {
    const { ctx, eng, duck } = engine();
    const a = eng.voice(line(2))!; ctx.currentTime = 0.5; eng.voice(line(3));
    a.stop();
    expect(duck.targetAt(1)).toBe(0.3);
    expect(Object.keys(eng.duckOwners())).toEqual(['ses']);
  });
  it('seconds 0 o sahibi kaldırır; başka sahip etkilenmez', () => {
    const { eng, duck } = engine();
    eng.duck('kutlama', 5, 0.3); eng.duck('duraklat', 3600, 0.25); eng.duck('duraklat', 0);
    expect(duck.targetAt(0)).toBe(0.3);
    expect(Object.keys(eng.duckOwners())).toEqual(['kutlama']);
  });
  it('anlatıcı düzeyi kendi veriyolunda (efekt düzeyinden bağımsız)', () => {
    const { eng, voiceBus } = engine();
    expect(voiceBus.targetAt(0)).toBe(1);
    eng.setVolumes({ sfx: 0.2, voice: 0.7 });
    expect(voiceBus.targetAt(1)).toBe(0.7);
    expect(eng.volumes()).toMatchObject({ sfx: 0.2, voice: 0.7 });
  });
});
