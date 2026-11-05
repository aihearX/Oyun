import { rallyShownName, type RallyState } from '@odi/shared';
import { NetError } from '@odi/net';
import type { EventFlash } from './EventLevel';

/**
 * Ralli bölümü oynanırken canavar yenilirse (YN-193, OT-takim-kaptani-34): takım arkadaşının son darbesi `rally.updated` yayınıyla
 * gelir; bölüm içinde şerit "Canavar yenildi! Ralli kazanıldı" ve tek dokunuşla "Çık". Eskiden oyuncu ~65 sn bölümü sonuna kadar
 * oynuyor, koşu hasar akışına yazılmıyor (sunucu: BITTI "Bu ralli zaten kazanıldı"), sonuçta neden sayılmadığı söylenmiyordu.
 * Ödül ve hasar kuralı değişmez: kazanılmış ralliye vuruş yazılmaz, ödül katılımcılara kazanma anında verilir.
 */
export function rallyWonWhilePlaying(rally: RallyState | null, rallyId: string): boolean {
  return !!rally && rally.id === rallyId && rally.status === 'kazanildi';
}

/** şeritteki "Çık": koşu gönderilmez (hak düşmez), ralli ekranına dönülür */
export const RALLY_WON_EXIT: EventFlash = { icon: '🏆', title: 'Canavar yenildi! Ralli kazanıldı', text: 'Bölümden çıktın; bu koşu gönderilmedi.', tone: 'ok' };

/** oyuncu bölümü yine de bitirdi: sunucu kazanılmış ralliye vuruşu reddeder (BITTI); sonuçta nedeni açıkça söylenir */
export const RALLY_LATE_RUN: EventFlash = { icon: '🏆', title: 'Canavar yenildi! Ralli kazanıldı', text: 'Bu koşu sayılmadı: canavar o sırada yenilmişti.', tone: 'ok' };

/** rally.hit hatası "ralli zaten kazanıldı" mı (sunucu events/rally.ts openRally: BITTI) */
export const rallyAlreadyWon = (e: unknown): boolean => e instanceof NetError && e.code === 'BITTI';

/**
 * Ralli vuruşu sonucu (YN-245, OT-takim-kaptani-40): bildirim eskiden yanıttaki canı ("Kalan can: 200", oyuncunun kendi vuruşundan
 * hemen sonraki) yazıyordu; bu arada arkadaş da vurunca can çubuğu 80 gösteriyordu. Kalan can sunucunun son durumundan (rally.updated)
 * okunur; oyuncunun vuruşundan sonra başkası vurduysa kim ve ne kadar yazılır.
 */
export interface RallyHitFlash { id: string; /** vuran (ben) */ me: string; /** benim vuruşumun sunucu zamanı */ at: number; /** vuruştan hemen sonraki can (yanıt) */ hp: number; /** başlangıç ("2 yıldızla vurdun.") */ lead: string }
export function rallyHitText(f: RallyHitFlash, live: RallyState | null): string {
  const cur = live && live.id === f.id ? live : null;
  const after = cur ? cur.hits.filter((h) => h.at > f.at && h.id !== f.me) : [];
  // en eskiden yeniye (sunucu en yeniyi başta verir)
  const who = after.slice().reverse().map((h) => `${rallyShownName(h.name)} ${h.damage}`).join(', ');
  const hp = cur ? cur.hp : f.hp;
  return `${f.lead} Kalan can: ${hp}${who ? ` · senden sonra ${who} vurdu` : ''}${cur?.status === 'kazanildi' && after.length ? '; canavar yenildi!' : ''}`;
}
