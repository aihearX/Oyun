import type { LevelSpec, PlayerSkills } from '@odi/shared';
import { runShields } from '@odi/content';
import { useStore } from '../store';
import { useSocial } from '../net';
import { shieldStartLine, type ShieldGift } from '../kalkan';
import { star3Line } from '../map/goals';

/**
 * bu koşunun yetenekleri: yetenek kalkanlarına (düzey kadar) bir ek kalkan eklenir (en çok 3; content `runShields`, YN-099):
 * takım kalkanı varsa bir tanesi kullanılır; yoksa Atölye/Ortak Kalkan şansı (oranı Kamp'ta yazılı). Eklenen kalkan bildirim
 * kuyruğuna değil bölüm başı şeridine ve sonuç ekranına gider (`gift`; YN-192: bildirim bölüm bittikten sonra görünüyordu)
 */
export function runSkills(skills: PlayerSkills): { skills: PlayerSkills; gift?: ShieldGift } {
  const n = runShields(skills.shield); if (n <= skills.shield) return { skills };
  if (useStore.getState().consumeTeamShield()) return { skills: { ...skills, shield: n }, gift: { from: 'takim', n } };
  const pct = useSocial.getState().bonuses?.shieldChancePct ?? 0;
  if (pct > 0 && Math.random() * 100 < pct) return { skills: { ...skills, shield: n }, gift: { from: 'atolye', n, pct } };
  return { skills };
}

/** bölüm başı şeridi (LevelHost; YN-176, YN-192): 3. yıldızın koşulu (bölüm kartıyla aynı kaynak) ve varsa bölüme eklenen kalkan */
export function startLines(spec: LevelSpec, gift: ShieldGift | undefined): string[] {
  return [star3Line(spec), ...(gift ? [shieldStartLine(gift)] : [])];
}
