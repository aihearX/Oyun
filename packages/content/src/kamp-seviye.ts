import { BUILDINGS, type BuildingId, type CampXpState } from '@odi/shared';
import type { DistrictId } from './kamp-arazi';

/**
 * Kamp Seviyesi (docs/14-kamp.md §8): kamptaki her emek (inşaat, malzeme, anıt, süsleme, ziyaret, görev) Kamp XP verir.
 * Her seviyenin görünür, önceden yazılı bir ödülü vardır (arazi, bina yeri, süs, kozmetik, çanta, unvan, süs yeri).
 * Formüller şeffaftır; sunucu ve istemci aynı tabloyu kullanır. Para ile XP alınmaz.
 */

export const CAMP_LEVEL_MAX = 30;
/** seviye L'den L+1'e geçmek için gereken XP */
export function campXpNeed(level: number): number { return level >= CAMP_LEVEL_MAX ? 0 : Math.round(30 * Math.pow(level, 1.4)) + 30; }
/** toplam XP'den seviye durumu */
export function campXpState(total: number): CampXpState {
  let level = 1; let rest = Math.max(0, Math.floor(total));
  while (level < CAMP_LEVEL_MAX && rest >= campXpNeed(level)) { rest -= campXpNeed(level); level++; }
  return { level, total: Math.max(0, Math.floor(total)), into: level >= CAMP_LEVEL_MAX ? 0 : rest, need: campXpNeed(level) };
}
/** seviyeye ulaşmak için gereken toplam XP */
export function campXpTotalFor(level: number): number { let t = 0; for (let l = 1; l < Math.min(level, CAMP_LEVEL_MAX); l++) t += campXpNeed(l); return t; }

/** Kamp XP kaynakları (tek yerde; görev ekibi kendi miktarlarını grantCampXp ile verir) */
export const CAMP_XP = {
  /** inşaat bitti: 20 + 10 × seviye (merkez ×1,5) */
  build: (id: BuildingId, level: number) => Math.round((20 + 10 * level) * (id === 'merkez' ? 1.5 : 1)),
  /** Tedavi Odası rafından toplanan her malzeme */
  remedy: 3,
  /** depodan toplanan her 40 jeton için 1 (toplama başına en çok 20) */
  depotPer: 40, depotMax: 20,
  /** bölge anıtı yükseldi */
  monument: 40,
  /** bir süs türünü ilk kez yerleştirmek */
  decorFirst: 5,
  /** ziyarette tepki bırakmak (günde en çok 5 kez XP) / almak (günde en çok 10 kez XP) */
  cheerGive: 2, cheerGiveDaily: 5, cheerGot: 5, cheerGotDaily: 10,
} as const;

// ---------------------------------------------------------------- yeni binaların etkileri (ekonomi / üretim / bilgi / süs; bölüm gücü değil)
/** Akustik Kabin: Kamp XP +%3/Sv */
export const kabinXpPct = (level: number) => Math.max(0, level) * 3;
/** Yenidoğan Tarama Birimi: Tedavi Odası hazırlık süresi çarpanı (−%2/Sv, en çok −%40) */
export const taramaFactor = (level: number) => Math.max(0.6, 1 - 0.02 * Math.max(0, level));
/** İşitsel Rehabilitasyon Parkı: +2 süs yeri/Sv */
export const parkDecorSlots = (level: number) => Math.max(0, level) * 2;
/** Vestibüler Laboratuvar: depo dolma süresi (saat) 8 + 0,5/Sv */
export const depotCapHours = (dengeLevel: number) => 8 + 0.5 * Math.max(0, dengeLevel);
/** Odyoloji Kütüphanesi: okuma köşesi — saatte Sv × 2 Kamp XP, 12 saatte dolar */
export const LIB_XP_PER_LEVEL_HOUR = 2;
export const LIB_CAP_HOURS = 12;
export function libStored(level: number, since: number, now: number): { stored: number; max: number; ratio: number } {
  if (level <= 0 || !since) return { stored: 0, max: 0, ratio: 0 };
  const rate = level * LIB_XP_PER_LEVEL_HOUR; const max = rate * LIB_CAP_HOURS;
  const stored = Math.floor((Math.min(Math.max(0, now - since), LIB_CAP_HOURS * 3_600_000) / 3_600_000) * rate);
  return { stored, max, ratio: max ? stored / max : 0 };
}

// ---------------------------------------------------------------- seviye ödülleri
export type CampLevelReward =
  | { kind: 'arazi'; district: DistrictId }
  | { kind: 'bina'; building: BuildingId }
  | { kind: 'sus'; id: string; n: number }
  | { kind: 'kozmetik'; id: string }
  | { kind: 'canta'; cap: number }
  | { kind: 'unvan'; name: string }
  | { kind: 'yer'; n: number };

/** her seviyenin ödülü (Sv 1 başlangıçta verilir). Bina yerleri BUILDINGS[].campLevel ile, araziler DISTRICTS[].level ile aynı (test). */
export const CAMP_LEVEL_REWARDS: Record<number, CampLevelReward[]> = {
  1: [{ kind: 'unvan', name: 'Kamp Çırağı' }, { kind: 'sus', id: 'diyapazon', n: 1 }, { kind: 'sus', id: 'odyogram-tarhi', n: 1 }],
  2: [{ kind: 'sus', id: 'odyogram-tarhi', n: 2 }, { kind: 'yer', n: 2 }],
  3: [{ kind: 'arazi', district: 'koru' }, { kind: 'bina', building: 'kabin' }, { kind: 'sus', id: 'stereosilya', n: 2 }],
  4: [{ kind: 'sus', id: 'kemikcik-banki', n: 2 }, { kind: 'yer', n: 1 }],
  5: [{ kind: 'unvan', name: 'Kulak Kaşifi' }, { kind: 'sus', id: 'otoskop-lamba', n: 2 }, { kind: 'yer', n: 2 }],
  6: [{ kind: 'arazi', district: 'koy' }, { kind: 'bina', building: 'tarama' }, { kind: 'sus', id: 'dalga-cit', n: 3 }],
  7: [{ kind: 'kozmetik', id: 'renk-koru' }, { kind: 'sus', id: 'kulaklik-salincak', n: 1 }],
  8: [{ kind: 'sus', id: 'koklea-cesme', n: 1 }, { kind: 'yer', n: 2 }],
  9: [{ kind: 'bina', building: 'park' }, { kind: 'sus', id: 'stereosilya', n: 2 }],
  10: [{ kind: 'unvan', name: 'Odyoloji Gönüllüsü' }, { kind: 'sus', id: 'kepce-cardak', n: 1 }, { kind: 'yer', n: 2 }],
  11: [{ kind: 'sus', id: 'cihaz-saksi', n: 3 }],
  12: [{ kind: 'arazi', district: 'tepe' }, { kind: 'bina', building: 'denge' }, { kind: 'sus', id: 'kanal-heykel', n: 1 }],
  13: [{ kind: 'kozmetik', id: 'renk-koy' }, { kind: 'sus', id: 'tuy-lamba', n: 2 }],
  14: [{ kind: 'canta', cap: 12 }, { kind: 'sus', id: 'tikac-puf', n: 2 }, { kind: 'yer', n: 1 }],
  15: [{ kind: 'unvan', name: 'Ses Ustası' }, { kind: 'sus', id: 'dalga-havuz', n: 1 }, { kind: 'yer', n: 2 }],
  16: [{ kind: 'arazi', district: 'yerleske' }, { kind: 'bina', building: 'kutuphane' }, { kind: 'sus', id: 'desibel-sutun', n: 2 }],
  17: [{ kind: 'sus', id: 'implant-heykel', n: 1 }, { kind: 'yer', n: 1 }],
  18: [{ kind: 'sus', id: 'nota-agaci', n: 2 }, { kind: 'yer', n: 2 }],
  19: [{ kind: 'sus', id: 'ostaki-kemer', n: 2 }],
  20: [{ kind: 'arazi', district: 'orman' }, { kind: 'unvan', name: 'Koklea Bilgesi' }, { kind: 'sus', id: 'isik-feneri', n: 2 }, { kind: 'yer', n: 3 }],
  21: [{ kind: 'sus', id: 'altin-diyapazon', n: 1 }],
  22: [{ kind: 'kozmetik', id: 'kostum-rehber' }, { kind: 'yer', n: 1 }],
  23: [{ kind: 'sus', id: 'koklea-cesme', n: 1 }, { kind: 'yer', n: 2 }],
  24: [{ kind: 'canta', cap: 15 }, { kind: 'sus', id: 'kanal-heykel', n: 1 }],
  25: [{ kind: 'unvan', name: 'Kulak Adası Rehberi' }, { kind: 'sus', id: 'altin-kulak', n: 1 }, { kind: 'yer', n: 2 }],
  26: [{ kind: 'sus', id: 'kemikcik-banki', n: 2 }, { kind: 'yer', n: 1 }],
  27: [{ kind: 'sus', id: 'tuy-lamba', n: 3 }],
  28: [{ kind: 'sus', id: 'dalga-cit', n: 4 }, { kind: 'yer', n: 2 }],
  29: [{ kind: 'sus', id: 'kepce-cardak', n: 1 }],
  30: [{ kind: 'unvan', name: 'Kulak Adası Efsanesi' }, { kind: 'sus', id: 'altin-kulak', n: 1 }, { kind: 'yer', n: 3 }],
};
export const campLevelRewards = (level: number): CampLevelReward[] => CAMP_LEVEL_REWARDS[level] ?? [];
/** bu seviyeye kadarki en yüksek unvan */
export function campTitle(level: number): string {
  let t = 'Kamp Çırağı';
  for (let l = 1; l <= Math.min(level, CAMP_LEVEL_MAX); l++) for (const r of campLevelRewards(l)) if (r.kind === 'unvan') t = r.name;
  return t;
}
/** başlangıç süs yeri */
export const DECOR_BASE_SLOTS = 4;
/** aynı anda yerleştirilebilecek süs: 4 + seviye ödülleri + Park */
export function decorSlots(campLevel: number, parkLevel: number): number {
  let n = DECOR_BASE_SLOTS;
  for (let l = 1; l <= Math.min(campLevel, CAMP_LEVEL_MAX); l++) for (const r of campLevelRewards(l)) if (r.kind === 'yer') n += r.n;
  return n + parkDecorSlots(parkLevel);
}
/** çantada bir malzemeden en çok (9; Kamp Sv 14 → 12, Sv 24 → 15) */
export function remedyInvCap(campLevel: number): number {
  let c = 9; for (let l = 1; l <= Math.min(campLevel, CAMP_LEVEL_MAX); l++) for (const r of campLevelRewards(l)) if (r.kind === 'canta') c = Math.max(c, r.cap);
  return c;
}
/** Kamp Seviyesiyle açılan kozmetikler (cosmetics.ts'teki unlock { by: 'kamp' } ile aynı; test) */
export function campLevelCosmetics(level: number): string[] {
  const out: string[] = []; for (let l = 1; l <= Math.min(level, CAMP_LEVEL_MAX); l++) for (const r of campLevelRewards(l)) if (r.kind === 'kozmetik') out.push(r.id);
  return out;
}
/** bina kurulabilir mi (bölgesi açık mı) */
export function buildingOpen(id: BuildingId, campLevel: number): boolean { const d = BUILDINGS.find((b) => b.id === id); return !d?.campLevel || campLevel >= d.campLevel; }
/** sonraki ödüllü seviye (panelde "Sv N: …") */
export function nextCampReward(level: number): { level: number; rewards: CampLevelReward[] } | null {
  for (let l = level + 1; l <= CAMP_LEVEL_MAX; l++) { const r = campLevelRewards(l); if (r.length) return { level: l, rewards: r }; }
  return null;
}
