/**
 * Kulak Kampı arayüz modeli: etki metinleri, yükseltme uygunluğu (nedeniyle), hızlandırıcılar, eylemler (gerçek/demo).
 */
import { BUILDINGS, CAMP_POWER_LEVEL, buildCost, type BuildingDef, type BuildingId, type BuildingState, type CampState, type Wallet } from '@odi/shared';
import { CAMP_TIER_NAMES, DEPOT_CAP_H, DEPOT_RATE, tierOf } from '@odi/game-core';
import { audio } from '@odi/audio';
import { BUILDING_INFO, CAMP_TERMS, districtOfBuilding, LIB_CAP_HOURS, LIB_XP_PER_LEVEL_HOUR, campUnlocksAt, cosmeticById, depotCapHours, kabinXpPct, levelLineId, parkDecorSlots, remediesAt, remedyById, remedyShelfCap, taramaFactor, type CampUnlock } from '@odi/content';
import { celebrate } from '../celebrate';
import { platform } from '../platform';
import { sayDede } from './dede';

export { DEPOT_CAP_H, DEPOT_RATE };
const fmtH = (h: number) => (Number.isInteger(h) ? String(h) : h.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));
/** bina gücü Sv 15'te tavan yapar (sunucu ile aynı) */
const P = (l: number) => Math.min(CAMP_POWER_LEVEL, l);
/** gücü olan (yüzde veren) binalar */
export const POWER_BUILDINGS: BuildingId[] = ['laboratuvar', 'atolye', 'kule', 'revir'];
export const defOf = (id: BuildingId): BuildingDef => BUILDINGS.find((b) => b.id === id)!;
export function effect(id: BuildingId, l: number): string {
  switch (id) {
    case 'merkez': return l ? `Diğer binalar en çok Sv ${l}` : 'Kamp kurulmadı';
    case 'laboratuvar': return `Bölüm jetonu +%${P(l) * 3}`;
    case 'atolye': return `Bölüm başında kalkan şansı %${P(l) * 4}`;
    case 'depo': return l ? `${l * DEPOT_RATE} jeton/saat (${DEPOT_CAP_H} saatte dolar)` : 'Pasif jeton üretimi yok';
    case 'kule': return `Savaş puanı +%${P(l) * 2}`;
    case 'revir': return `İlk hasarı yok sayma şansı %${P(l) * 3}`;
    case 'tedavi': return l ? `${remediesAt(l).length} tarif · rafta en çok ${remedyShelfCap(l)}` : 'Malzeme hazırlanmıyor';
    case 'kabin': return l ? `Kamp XP +%${kabinXpPct(l)}` : 'Kamp XP bonusu yok';
    case 'tarama': return l ? `Tedavi Odası hazırlık süresi −%${Math.round((1 - taramaFactor(l)) * 100)}` : 'Hazırlık süresi bonusu yok';
    case 'park': return l ? `+${parkDecorSlots(l)} süs yeri` : 'Ek süs yeri yok';
    case 'denge': return `Depo ${fmtH(depotCapHours(l))} saatte dolar`;
    case 'kutuphane': return l ? `Saatte ${l * LIB_XP_PER_LEVEL_HOUR} Kamp XP (${LIB_CAP_HOURS} saatte dolar)` : 'Okuma köşesi yok';
  }
}
/** binanın gerçek hayattaki karşılığı (sade + "Daha fazla") */
export const infoOf = (id: BuildingId) => BUILDING_INFO[id];
/** açılımın kısa adı (panel ve kutlama) */
export function unlockLabel(u: CampUnlock): string {
  switch (u.kind) {
    case 'kozmetik': return `Dolap: ${cosmeticById(u.id)?.name ?? 'kozmetik'}`;
    case 'terim': return `Sözlük: ${CAMP_TERMS.find((t) => t.id === u.id)?.term ?? 'terim'}`;
    case 'tarif': return `Tarif: ${remedyById(u.id)?.name ?? 'malzeme'}`;
    case 'canta': return 'Çantaya +1 yer';
  }
}
/** Merkez'in "kısa ad"ı (dar yerler) */
export const shortOf = (id: BuildingId) => defOf(id).short ?? defOf(id).name.split(' ')[0]!;
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
  if (d.campLevel && (camp.xp?.level ?? 1) < d.campLevel) return { ok: false, reason: `Kamp Seviyesi ${d.campLevel} gerekli: ${districtOfBuilding(id)?.name ?? 'bölge'} açılınca kurulur.`, short: `Kamp Sv ${d.campLevel}` };
  if (busy) return { ok: false, reason: busy.id === id ? 'İnşaat sürüyor.' : `İnşaatçı meşgul: ${defOf(busy.id).name} yapılıyor. Aynı anda bir inşaat yapılır.`, short: busy.id === id ? 'Yapılıyor' : 'İnşaatçı meşgul' };
  if (id !== 'merkez' && to > merkez) return { ok: false, reason: `Önce Odyoloji Merkezi'ni Sv ${to} yap.`, short: `Merkez Sv ${to}` };
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
  /** Tedavi Odası: hazırlanacak tarifi seç (null: dur) */
  remedyMake(item: string | null): Promise<boolean>;
  /** Tedavi Odası: raftakileri çantaya al; alınan adet (başarısızsa null) */
  remedyCollect(): Promise<number | null>;
  /** süs yerleştir / taşı-çevir (yeni kamp durumu; başarısızsa null) / depoya kaldır */
  decorPlace(id: string, gx: number, gy: number, flip: boolean): Promise<CampState | null>;
  decorMove(uid: number, gx: number, gy: number, flip: boolean): Promise<CampState | null>;
  decorStore(uid: number): Promise<boolean>;
  /** Kütüphane okuma köşesi: alınan Kamp XP (başarısızsa null) */
  libCollect(): Promise<number | null>;
}

/** inşaat bitti: her zaman fanfar + afiş (açılımlar yazılı); görsel kademe değiştiyse (Sv 4, 7, 10, 13) büyük "seviye" anı.
 *  Tüy Dede binanın odyolojik işleviyle ilgili tek satır söyler (bina başına üç satır, sırayla). */
export function celebrateBuilt(id: BuildingId, level: number, bigTier: boolean): void {
  const d = defOf(id); platform().haptic('success');
  const unlocks = campUnlocksAt(id, level).map(unlockLabel);
  sayDede(levelLineId(id, level), `${d.name} · Sv ${level}`, level === 1 ? BUILDING_INFO[id].tech : undefined);
  if (bigTier) {
    void celebrate.levelUp({ level, unlocks: [`${d.name}: ${CAMP_TIER_NAMES[tierOf(level)]} görünüm`, effect(id, level), ...unlocks] });
    return;
  }
  audio.play('fanfare');
  const body = [level === 1 ? `Kuruldu · ${effect(id, level)}` : effect(id, level), ...unlocks].join(' · ');
  celebrate.banner({ icon: d.emoji, title: `${d.name} Sv ${level}!`, body, tone: 'green' });
}
