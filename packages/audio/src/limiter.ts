/**
 * Ses sınırlayıcı (saf mantık, test edilebilir): aynı anda çok ses çalınca kulak tırmalamasın.
 * - Aynı efekt çok kısa aralıkla (merge penceresi) gelirse tek seste birleşir (jeton yağmuru).
 * - Aynı efektten en çok `cap` ses aynı anda çalar; fazlası atlanır.
 * - Aynı efektin üst üste binen her kopyası biraz daha kısık çalar (yoğunluk telafisi).
 * - Toplam ses sayısı sınırı aşılırsa düşük öncelikli sesler (dokunma, tık) atlanır, diğerleri kısılır.
 */
export interface LimitRule { cap: number; merge: number; prio: number }
interface Voice { name: string; start: number; end: number; prio: number }

export const DEFAULT_RULE: LimitRule = { cap: 4, merge: 0.025, prio: 2 };

export class VoiceLimiter {
  private active: Voice[] = [];
  constructor(private maxVoices = 14, private rule: (name: string) => LimitRule = () => DEFAULT_RULE) {}

  /** çalınabilir mi? 0 = atla (birleşti/sınır), aksi halde ses çarpanı (0-1] */
  request(name: string, at: number, dur: number): number {
    this.active = this.active.filter((v) => v.end > at);
    const r = this.rule(name);
    const same = this.active.filter((v) => v.name === name);
    if (same.some((v) => Math.abs(at - v.start) < r.merge)) return 0;
    if (same.length >= r.cap) return 0;
    let gain = 1 / (1 + 0.3 * same.length);
    if (this.active.length >= this.maxVoices) {
      if (r.prio < 2) return 0;
      gain *= 0.6;
    } else if (this.active.length > this.maxVoices / 2) gain *= 0.85;
    this.active.push({ name, start: at, end: at + Math.max(0.02, dur), prio: r.prio });
    return gain;
  }

  /** şu an çalan ses sayısı (test/hata ayıklama) */
  count(at: number): number { return this.active.filter((v) => v.end > at).length; }
  reset() { this.active = []; }
}
