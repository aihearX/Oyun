/**
 * Kamp Seviyesi atlama kutlaması: her seviye oyuncu başına TAM BİR KEZ (built.ts ile aynı ilke).
 * Aynı durum istemciye birkaç yoldan gelir (işlem yanıtı + camp.updated itmesi); kutlama gelen seviyeyi oyuncunun "gördüğü"
 * seviyeyle karşılaştırır. Taban: oturumdaki ilk kamp durumu (o ana kadar biriken seviyeler sessizce görülmüş sayılır).
 * Birden çok seviye birden atlanırsa (ör. görev ödülü) tek kutlamada hepsinin ödülü yazılır.
 */
import { useEffect } from 'react';
import { useNet } from '@odi/net/store';
import type { CampState } from '@odi/shared';
import { campLevelRewards, campTitle, cosmeticById, decorById, districtById, type CampLevelReward } from '@odi/content';
import { BUILDINGS } from '@odi/shared';
import { audio } from '@odi/audio';
import { celebrate } from '../celebrate';
import { platform } from '../platform';
import { sayDede } from './dede';
import type { ArtName } from '../ui/art';

const seen = new Map<string, number>();
export function campLevelBaseline(owner: string | null | undefined, camp: CampState | null | undefined): void {
  if (owner && camp?.xp && !seen.has(owner)) seen.set(owner, camp.xp.level);
}
useNet.subscribe((s) => campLevelBaseline(s.me?.id, s.camp));

/** yeni ulaşılan seviyeler (aynı seviye ikinci kez dönmez) */
export function takeCampLevels(owner: string, camp: CampState): number[] {
  const lv = camp.xp?.level; if (!lv) return [];
  const prev = seen.get(owner);
  if (prev == null) { seen.set(owner, lv); return []; }
  if (lv <= prev) return [];
  seen.set(owner, lv);
  return Array.from({ length: lv - prev }, (_, i) => prev + 1 + i);
}

/** ödülün kısa adı (kutlama, seviye paneli) */
export function rewardLabel(r: CampLevelReward): string {
  switch (r.kind) {
    case 'arazi': return `Yeni arazi: ${districtById(r.district)?.name ?? 'bölge'}`;
    case 'bina': return `Yeni bina: ${BUILDINGS.find((b) => b.id === r.building)?.name ?? 'bina'}`;
    case 'sus': return `Süs: ${decorById(r.id)?.name ?? 'süs'}${r.n > 1 ? ` ×${r.n}` : ''}`;
    case 'kozmetik': return `Dolap: ${cosmeticById(r.id)?.name ?? 'kozmetik'}`;
    case 'canta': return `Çanta: bir malzemeden en çok ${r.cap}`;
    case 'unvan': return `Unvan: ${r.name}`;
    case 'yer': return `+${r.n} süs yeri`;
  }
}
export const rewardIcon = (r: CampLevelReward): ArtName => ({ arazi: 'map', bina: 'tent', sus: 'gift', kozmetik: 'hat', canta: 'chest', unvan: 'crown', yer: 'plus' } as const)[r.kind];

/** kamp ekranı açıkken: yeni Kamp Seviyesini bir kez kutla (ödüller yazılı); arazi açıldıysa Tüy Dede o bölgeyi anlatır */
export function useCampLevelCelebration(owner: string | null | undefined, camp: CampState | null | undefined, delayMs = 0): void {
  useEffect(() => {
    if (!owner || !camp) return;
    const levels = takeCampLevels(owner, camp);
    if (!levels.length) return;
    const top = levels[levels.length - 1]!;
    const rewards = levels.flatMap((l) => campLevelRewards(l));
    const land = rewards.find((r) => r.kind === 'arazi');
    setTimeout(() => {
      platform().haptic('success'); audio.play('fanfare');
      void celebrate.levelUp({ level: top, kicker: 'KAMP', title: `Kamp Seviyesi ${top}!`, unlocks: [`Unvan: ${campTitle(top)}`, ...rewards.filter((r) => r.kind !== 'unvan').map(rewardLabel)] });
      if (land && land.kind === 'arazi') sayDede(`kamp-bolge-${land.district}`, `Yeni arazi · ${districtById(land.district)?.name ?? ''}`, districtById(land.district)?.plain);
      else sayDede('kamp-seviye-up', `Kamp Seviyesi ${top}`);
    }, delayMs);
  }, [owner, camp]);
}
