import type { RunResult } from '@odi/shared';

/**
 * Bölüm başında yetenek kalkanlarına eklenen kalkan (YN-099, YN-192): takım kalkanı (biri harcanır) ya da Atölye/Ortak Kalkan şansı.
 * `n`: bölüme kaç kalkanla başlandığı (content runShields). Bildirim kuyruğuna değil bölüm başı şeridine gider (bölüm ve sonuç
 * rotalarında bildirim gösterilmez: bölüm bitince görünüyordu, OT-ekonomi-denetci-37); sonuç ekranı da söyler.
 */
export interface ShieldGift { from: 'takim' | 'atolye'; n: number; pct?: number }

const WHO = { takim: 'Takım kalkanı', atolye: 'Atölye kalkanı' } as const;

/** bölüm başı şeridinin kalkan satırı: "Takım kalkanı devrede: bu bölüme 2 kalkanla başlıyorsun." */
export function shieldStartLine(g: ShieldGift): string {
  const how = g.from === 'atolye' && g.pct ? ` (%${g.pct} şans)` : '';
  return `${WHO[g.from]} devrede${how}: bu bölüme ${g.n > 1 ? `${g.n} ` : ''}kalkanla başlıyorsun.`;
}

/**
 * Sonuç ekranının kalkan satırı. Kalkan hiçbir vuruşu karşılamadıysa da söylenir (kural değişmez: takım kalkanı bölüm başında
 * harcanır, vuruş gelmese de geri gelmez). Karşıladıysa kaç vuruşu (karar 37: vuruş yine hasar sayılır).
 * Kalkan düşüşü karşılamaz (sim.ts hurt: yalnız çarpmalar). Bölüme en az bir kalkanla başlandığı için karşılanan vuruş yokken alınan
 * her hasar düşüştendir: "vuruş gelmedi" yerine nedeni söylenir (YN-202, OT-ilk-kez-oyun-60: 3 düşme, 1 hasar, "vuruş gelmedi").
 */
export function shieldResultLine(g: ShieldGift, r: Pick<RunResult, 'extra'> & Partial<Pick<RunResult, 'damageTaken'>>): string {
  const g0 = r.extra?.guarded; const hit = typeof g0 === 'number' && g0 > 0 ? Math.floor(g0) : 0;
  // Klinik koruması da vuruş karşılar (r.extra.klinik): hangisinin karşıladığı ayrı bilinmez, sayı söylenmez (sonuç kartı damageNote söyler)
  if (hit > 0 && r.extra?.klinik === true) return `${WHO[g.from]} bu bölümde seninleydi.`;
  if (hit > 0) return `${WHO[g.from]} bu bölümde seninleydi: kalkan ${hit === 1 ? 'bir vuruşu' : `${hit}\u00a0vuruşu`} karşıladı (hasar yine sayılır).`;
  const harca = g.from === 'takim' ? ' Takım kalkanı bölüm başında harcanır.' : '';
  const dmg = Math.max(0, Math.floor(r.damageTaken ?? 0));
  if (dmg > 0) return `${WHO[g.from]} bu bölümde seninleydi. Kalkan düşmeyi karşılamaz: ${dmg}\u00a0hasar aldın.${harca}`;
  return `${WHO[g.from]} bu bölümde seninleydi, vuruş gelmedi.${harca}`;
}
