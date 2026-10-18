/**
 * Kulak Kampı arayüz modeli: etki metinleri, yükseltme uygunluğu (nedeniyle), hızlandırıcılar, eylemler (gerçek/demo).
 */
import { BUILDINGS, buildCost, type BuildingDef, type BuildingId, type BuildingState, type CampState, type Wallet } from '@odi/shared';
import { DEPOT_CAP_H, DEPOT_RATE } from '@odi/game-core';

export { DEPOT_CAP_H, DEPOT_RATE };
export const defOf = (id: BuildingId): BuildingDef => BUILDINGS.find((b) => b.id === id)!;
export function effect(id: BuildingId, l: number): string {
  switch (id) {
    case 'merkez': return l ? `Diğer binalar en çok Sv ${l}` : 'Kamp kurulmadı';
    case 'laboratuvar': return `Bölüm jetonu +%${l * 3}`;
    case 'atolye': return `Bölüm başında kalkan şansı %${l * 4}`;
    case 'depo': return l ? `${l * DEPOT_RATE} jeton/saat (${DEPOT_CAP_H} saatte dolar)` : 'Pasif jeton üretimi yok';
    case 'kule': return `Savaş puanı +%${l * 2}`;
    case 'revir': return `İlk hasarı yok sayma şansı %${l * 3}`;
  }
}
export const ITEMS = [{ k: 'm5', label: '5 dk', sec: 300 }, { k: 'm60', label: '60 dk', sec: 3600 }, { k: 's8', label: '8 sa', sec: 28_800 }] as const;
export type SpeedItem = 'm5' | 'm60' | 's8' | 'kristal';

/** bu oturumda yardım istenen inşaatlar (sunucu "istendi" bilgisini döndürmüyor) */
export const askedHelp = new Set<string>();
export const buildKey = (b: BuildingState) => `${b.id}:${b.upgradingTo}:${b.startedAt}`;

export type Verdict = { ok: true } | { ok: false; reason: string; short: string };
/** yükseltilebilir mi; değilse kullanıcıya söylenecek neden */
export function canUpgrade(camp: CampState, wallet: Wallet, id: BuildingId): Verdict {
  const d = defOf(id); const b = camp.buildings.find((x) => x.id === id)!; const to = b.level + 1;
  const merkez = camp.buildings.find((x) => x.id === 'merkez')?.level ?? 1;
  const busy = camp.buildings.find((x) => x.upgradingTo && x.endsAt);
  if (to > d.maxLevel) return { ok: false, reason: 'En yüksek seviyede.', short: 'En yüksek' };
  if (busy) return { ok: false, reason: busy.id === id ? 'İnşaat sürüyor.' : `İnşaatçı meşgul: ${defOf(busy.id).name} yapılıyor. Aynı anda bir inşaat yapılır.`, short: busy.id === id ? 'Yapılıyor' : 'İnşaatçı meşgul' };
  if (id !== 'merkez' && to > merkez) return { ok: false, reason: `Önce Kamp Merkezi'ni Sv ${to} yap.`, short: `Merkez Sv ${to}` };
  const cost = buildCost(id, to).jeton;
  if (wallet.jeton < cost) return { ok: false, reason: `Jeton yetersiz: ${Math.round(cost - wallet.jeton).toLocaleString('tr-TR')} jeton daha gerekli. Bölüm oyna, görev bitir.`, short: 'Jeton yetersiz' };
  return { ok: true };
}

/** kamp eylemleri: gerçek (sunucu) ya da demo (yerel) */
export interface CampActions {
  upgrade(id: BuildingId): Promise<boolean>;
  speed(id: BuildingId, item: SpeedItem): Promise<boolean>;
  ask(id: BuildingId): Promise<boolean>;
  /** toplanan jeton; başarısızsa null */
  collect(): Promise<number | null>;
  /** verilen yardım sayısı; başarısızsa null */
  helpAll(): Promise<number | null>;
}
