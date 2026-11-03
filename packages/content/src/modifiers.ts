import type { ModifierId } from '@odi/shared';
import { bolunmezYap } from './metin';
/**
 * Bölüm değiştiricileri. `desc` oyunun gerçekte yaptığını söyler (game-core: sim.ts, LevelScene.ts, input.ts); `hint` bölüm
 * başındaki yazılı duyurunun "ne yapmalı" yarısı ("Gecikme: dokunuşun biraz geç işler, erken bas"). Sayılar kodla aynı kalmalı
 * (gecikme süresi game-core play/consts.ts ECHO_DELAY_S; testi: game-core play/degistirici.test.ts).
 * Kimlik (`yanki`) kayıtlı veri ve sunucuyla uyum için korunur; oyuncunun gördüğü ad "Gecikme" (sahip kararı 45, YN-156):
 * "yankı" adı İşitme Siniri'nin gizli yankı yollarına, "Yankı Görüşü" yeteneğine ve yoldaş Yankı'ya kalır.
 */
export const MODIFIERS: Record<ModifierId, { name: string; desc: string; hint: string; minLevel: number }> = /* @__PURE__ */ bolunmezYap({
  'hiz': { name: 'Hız', desc: 'Odi %30 daha hızlı koşar.', hint: 'Odi daha hızlı koşar, erken zıpla', minLevel: 15 },
  'sis': { name: 'Sis', desc: 'Görüş kısa: yalnız Odi\'nin çevresi aydınlık, uzaktaki engeller geç belirir.', hint: 'görüş kısa, engel ışığa girince zıpla', minLevel: 18 },
  'ayna': { name: 'Ayna', desc: 'Sağa ve sola kaydırma ters işler.', hint: 'sağa ve sola kaydırma ters işler', minLevel: 22 },
  'tek-can': { name: 'Tek Can', desc: 'Tek canla başlarsın: bir hasar, bölüm biter.', hint: 'tek canın var, acele etme', minLevel: 24 },
  'yanki': { name: 'Gecikme', desc: 'Dokunuşun 0,14 sn geç işler: biraz erken bas.', hint: 'dokunuşun biraz geç işler, erken bas', minLevel: 26 },
  'gece': { name: 'Gece', desc: 'Karanlık: yalnız Odi\'nin çevresi görünür.', hint: 'yalnız Odi\'nin çevresi görünür, halkanın kenarına bak', minLevel: 28 },
  'ters-yercekimi': { name: 'Ters Yerçekimi', desc: 'Tavanlı yerlerde yerçekimi zaman zaman ters döner.', hint: 'tavanlı yerlerde zaman zaman yön değişir', minLevel: 30 },
  'cihaz-kapali': { name: 'Cihaz Kapalı', desc: 'Ses yok; notalar ancak yaklaşınca görünür.', hint: 'ses yok, notalar yaklaşınca görünür', minLevel: 33 },
});
/** bölüm başı duyurusu: "Gecikme: dokunuşun biraz geç işler, erken bas" (ilk harf büyük; ad + ne yapmalı) */
export const modifierAnnounce = (id: ModifierId): string => `${MODIFIERS[id].name}: ${MODIFIERS[id].hint}`;
/** sonuç ekranı ve gösterge rozeti: "Hız, Gecikme" */
export const modifierNames = (ids: readonly ModifierId[]): string => ids.filter((m) => MODIFIERS[m]).map((m) => MODIFIERS[m].name).join(', ');
