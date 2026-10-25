/**
 * Sahipli müzik kısma (duck) hesabı — saf, Web Audio'suz (birim testli).
 * Her sahip (anlatıcı `ses`, `efekt:<ad>`, `duraklat`, `kutlama` …) kendi düzeyini ve süresini tutar;
 * etkin düzey, o anda süresi dolmamış sahiplerin EN DÜŞÜĞÜDÜR (hiç sahip yoksa 1 = tam düzey).
 * Bir sahip bitince (süresi dolunca ya da `unduck`) yalnız o kalkar; ötekilerin kısması sürer.
 */
export interface DuckClaim {
  /** 0..1 müzik düzeyi */
  level: number;
  /** kısmanın başladığı an (sn, bağlam saati) */
  from: number;
  /** kısmanın bittiği an (sn); bu andan itibaren sayılmaz */
  until: number;
}

/** `t` anındaki etkin düzey: from ≤ t < until olan sahiplerin en düşüğü; yoksa 1 */
export function duckLevelAt(claims: Iterable<DuckClaim>, t: number): number {
  let level = 1;
  for (const c of claims) if (c.from <= t && t < c.until && c.level < level) level = c.level;
  return level;
}

export interface DuckStep { at: number; level: number }

/**
 * `now`'dan sonrası için düzey planı: ilk adım `now`'daki düzey, ardından yalnız düzeyin DEĞİŞTİĞİ anlar
 * (bir sahibin başladığı ya da süresinin dolduğu anlar). Motor bunu AudioParam olaylarına çevirir;
 * böylece zamanlayıcı gerekmez, çevrimdışı işlemede de aynı sonuç çıkar.
 */
export function duckPlan(claims: Iterable<DuckClaim>, now: number): DuckStep[] {
  const list = [...claims];
  const times = new Set<number>();
  for (const c of list) { if (c.from > now) times.add(c.from); if (c.until > now) times.add(c.until); }
  const steps: DuckStep[] = [{ at: now, level: duckLevelAt(list, now) }];
  for (const at of [...times].sort((a, b) => a - b)) {
    const level = duckLevelAt(list, at);
    if (level !== steps[steps.length - 1]!.level) steps.push({ at, level });
  }
  return steps;
}

/** süresi dolmuş sahipleri sil (harita yerinde değişir) */
export function pruneDucks(claims: Map<string, DuckClaim>, now: number): void {
  for (const [owner, c] of claims) if (c.until <= now) claims.delete(owner);
}
