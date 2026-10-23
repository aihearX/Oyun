/**
 * İnşaat bitiş kutlaması (afiş ya da büyük "seviye" anı + Tüy Dede satırı): her bina seviyesi, oyuncu başına TAM BİR KEZ.
 *
 * Aynı bitiş istemciye birkaç yoldan gelir: işlem yanıtı (kristalle / hızlandırıcıyla bitir), sunucunun `camp.updated` itmesi
 * (süre doldu; takım yardımında art arda iki itme), süre dolunca istemcinin kendi `camp.state` tazelemesi. Kutlama bu durumların
 * sırasına ve sayısına, kamp sahnesinin saatine (Phaser; boşta düşük kare hızı, sayfa gizliyken uyur) ya da hangi görünümün
 * (üs / liste) açık olduğuna bağlı değildir: gelen seviyeler oyuncunun "gördüğü" seviyelerle karşılaştırılır.
 *
 * Taban: oturumdaki ilk kamp durumu (uygulama açılırken zaten bitmiş inşaatlar kutlanmaz). Kamp ekranı dışındayken biten inşaat,
 * kampa dönülünce kutlanır. Yalnız +1 seviye kutlanır (birden çok seviyelik sıçrama bir eşitlemedir, inşaat değil).
 */
import { useEffect } from 'react';
import { useNet } from '@odi/net/store';
import type { BuildingId, CampState } from '@odi/shared';
import { tierOf } from '@odi/game-core';
import { useStore } from '../store';
import { celebrateBuilt, defOf } from './model';

type Levels = Map<BuildingId, number>;
const seen = new Map<string, Levels>();
const levelsOf = (camp: CampState): Levels => new Map(camp.buildings.map((b) => [b.id, b.level]));

/** oturumun ilk kamp durumu taban olur (oyuncu başına; kamp ekranı hiç açılmadan biten inşaat da sonra kutlansın diye) */
export function campBaseline(owner: string | null | undefined, camp: CampState | null | undefined): void {
  if (owner && camp && !seen.has(owner)) seen.set(owner, levelsOf(camp));
}
useNet.subscribe((s) => campBaseline(s.me?.id, s.camp));

export interface Built { id: BuildingId; level: number; bigTier: boolean }
/** son bina kutlamasının zamanı (Kamp Seviyesi kutlaması Tüy Dede'nin bina satırını kesmesin diye bekler) */
export let lastBuiltAt = 0;
/** gelen durumdaki yeni seviyeleri "görüldü" yapar ve kutlanacakları döndürür (aynı seviye ikinci kez dönmez) */
export function takeBuilt(owner: string, camp: CampState): Built[] {
  const prev = seen.get(owner);
  if (!prev) { seen.set(owner, levelsOf(camp)); return []; }
  const out: Built[] = [];
  for (const b of camp.buildings) {
    const o = prev.get(b.id) ?? 0;
    if (b.level <= o) continue;
    prev.set(b.id, b.level);
    if (b.level === o + 1) out.push({ id: b.id, level: b.level, bigTier: o > 0 && tierOf(o) !== tierOf(b.level) });
  }
  return out;
}

/** kamp ekranı açıkken (üs ya da liste): yeni seviyeyi bir kez kutla. delayMs: sahnede iskelenin düşüşüyle aynı ana denk gelsin */
export function useBuiltCelebration(owner: string | null | undefined, camp: CampState | null | undefined, delayMs = 0): void {
  useEffect(() => {
    if (!owner || !camp) return;
    const list = takeBuilt(owner, camp);
    if (!list.length) return;
    // "inşaatı başladı" bildirimi sırada bekliyorsa kutlamanın önünü tıkamasın (kristalle hemen bitirince)
    const started = new Set(list.map((x) => `${defOf(x.id).name} inşaatı başladı`));
    useStore.setState((s) => ({ toasts: s.toasts.filter((t) => !started.has(t.title)) }));
    // bilerek temizlenmez: hemen ardından gelen ikinci durum (itme + yanıt) kutlamayı iptal etmemeli
    lastBuiltAt = Date.now();
    setTimeout(() => { for (const x of list) celebrateBuilt(x.id, x.level, x.bigTier); }, delayMs);
  }, [owner, camp]);
}
