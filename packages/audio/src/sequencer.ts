/**
 * Gerçek zamanlı sıralayıcı (saf mantık): ölçüleri AudioContext saatine göre İLERİDEN planlar.
 * Zamanlar her zaman `startAt + i * barDur` ile hesaplanır (birikimli toplama yok → kayma yok);
 * setTimeout/setInterval yalnızca "planlama zamanı geldi mi?" diye bakar, sesin zamanını belirlemez.
 * Sekme uykuya dalıp uzun süre tick gelmezse geçmişte kalmış ölçüler çalınmaz, şimdiki ölçüden devam edilir.
 */
export interface SequencerOpts {
  bpm: number;
  beatsPerBar?: number;
  startAt: number;
  /** şimdi + lookahead'den önce başlayan ölçüler planlanır (sn) */
  lookahead?: number;
  /** tek seferlik parçalar: bu kadar ölçüden sonra durur */
  maxBars?: number;
  onBar: (bar: number, time: number) => void;
}

export class Sequencer {
  readonly barDur: number;
  readonly beatDur: number;
  private next = 0;
  private readonly lookahead: number;
  constructor(private o: SequencerOpts) {
    this.beatDur = 60 / o.bpm;
    this.barDur = this.beatDur * (o.beatsPerBar ?? 4);
    this.lookahead = o.lookahead ?? 0.3;
  }
  barTime(i: number): number { return this.o.startAt + i * this.barDur; }
  /** sıradaki planlanacak ölçü */
  get nextBar(): number { return this.next; }
  get done(): boolean { return this.o.maxBars != null && this.next >= this.o.maxBars; }
  /** parçanın bittiği an (tek seferlikse) */
  get endTime(): number { return this.o.maxBars != null ? this.barTime(this.o.maxBars) : Infinity; }

  /** planlama: [şimdi, şimdi + lookahead) içinde (ya da verilen ufka kadar) başlayan ölçüleri bir kez çağırır; planlanan ölçü sayısını döndürür */
  tick(now: number, horizon = now + this.lookahead): number {
    let n = 0;
    // tamamen geçmişte kalmış ölçüleri atla (sekme uykudaydı)
    if (this.o.maxBars == null && this.barTime(this.next) + this.barDur < now) {
      this.next = Math.max(this.next, Math.floor((now - this.o.startAt) / this.barDur));
    }
    while (!this.done && this.barTime(this.next) < horizon) {
      this.o.onBar(this.next, this.barTime(this.next));
      this.next++; n++;
      if (n > 256) break; // güvenlik
    }
    return n;
  }
}

/** iki parça arasında geçiş: yeni parça eskinin bir sonraki vuruşuna hizalanır (aynı tempo ailesindeyse) */
export function alignStart(now: number, prev: { startAt: number; beatDur: number } | null, minLead = 0.06): number {
  if (!prev) return now + minLead;
  const k = Math.ceil((now + minLead - prev.startAt) / prev.beatDur);
  return prev.startAt + k * prev.beatDur;
}

/** küçük deterministik rastgele üreteç (döngü çeşitlemeleri tekrarlanabilir olsun) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
