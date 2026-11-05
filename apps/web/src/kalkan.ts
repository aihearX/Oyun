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
 * harcanır, vuruş gelmese de geri gelmez). Karşıladıysa kaç çarpmayı ve kaç kez düşüldüğünü (karar 37: vuruş yine hasar sayılır).
 * Kalkan düşüşü karşılamaz (sim.ts hurt: yalnız çarpmalar). Bölüme en az bir kalkanla başlandığı için karşılanan vuruş yokken alınan
 * her hasar düşüştendir: "vuruş gelmedi" yerine nedeni söylenir (YN-202). Hasar sayısı satırda geçmez: kayıpta neden kartı, kazançta
 * hasar kutusu söyler; aynı sayı kartta iki kez geçiyordu (YN-229, OT-sessiz-oyuncu-31).
 * Düşme sayısı `r.extra.falls` (game-core LevelScene: can götüren düşüş); yoksa (önizleme) karşılanmayan hasar.
 */
export function shieldResultLine(g: ShieldGift, r: Pick<RunResult, 'extra'> & Partial<Pick<RunResult, 'damageTaken'>>): string {
  const g0 = r.extra?.guarded; const hit = typeof g0 === 'number' && g0 > 0 ? Math.floor(g0) : 0;
  const harca = g.from === 'takim' ? ' Takım kalkanı bölüm başında harcanır.' : '';
  const dmg = Math.max(0, Math.floor(r.damageTaken ?? 0));
  const f0 = r.extra?.falls; const falls = typeof f0 === 'number' ? Math.max(0, Math.floor(f0)) : Math.max(0, dmg - hit);
  if (hit > 0) {
    // Klinik koruması da vuruş karşılar (r.extra.klinik; damageNote ile aynı ad): önce kalkan, sonra Klinik
    const who = r.extra?.klinik === true ? (hit >= 2 ? 'Kalkan ve Klinik' : 'Klinik') : 'Kalkan';
    return `${who} ${hit}\u00a0çarpmayı karşıladı${falls > 0 ? `; ${falls}\u00a0kez düştün` : ''}.`;
  }
  // satır kısa (320 px büyük yazıda neden kartı düğmelerin altında kalmasın): "harcanır" kuralı vuruşsuz satırda ve bölüm başı şeridinde
  if (dmg > 0) return 'Kalkan kullanılmadı: hasarların hepsi düşmeydi (kalkan düşmeyi karşılamaz).';
  return `${WHO[g.from]} bu bölümde seninleydi, vuruş gelmedi.${harca}`;
}
