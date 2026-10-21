import type { AbilityId } from '@odi/shared';
import { ABILITIES } from '@odi/content';
import type { BiomeBackdrop, HintKind, LevelHudView } from './visuals';

/**
 * Öğretici an: yeni yeteneğin ilk karşılaşmasında zaman yavaşlar (×0,3, en çok 8 gerçek saniye) ve göstergede büyük el işareti hareketi
 * (dokun / basılı tut / aşağı kaydır / ileri kaydır / geri kaydır) belirir. Oyuncu hareketi yaptığı an normal hıza döner ("Harika!").
 * Süre sayacı, ceza ya da sahte baskı yok; kaçırırsa oyun normal kurallarla sürer, aynı yere döndüğünde an yeniden açılır.
 */
export const TUTORIAL_SLOW = 0.3;
/** ağır çekimin en uzun süresi (gerçek sn): ilk kez oynayan oyuncu el işaretini okuyup denesin */
export const TUTORIAL_MAX_S = 8;

/** yeteneğin "başardın" sayılan sim olayı */
export const TUTORIAL_SUCCESS: Record<AbilityId, string[]> = {
  zipla: ['jump'], don: ['uturn'], kayma: ['slide'], duvar: ['walljump'], suzul: ['glide'], trambolin: ['tramp-strong'], kanca: ['unhook'],
  cakil: ['poundland'], yuz: ['swim', 'jump'], darbe: ['dash'], cevir: ['flip'],
};

const GESTURE: Record<'dokun' | 'basili' | 'asagi' | 'ileri' | 'geri', HintKind> = { dokun: 'tap', basili: 'hold', asagi: 'swipeDown', ileri: 'swipeRight', geri: 'swipeLeft' };
export const gestureHint = (a: AbilityId): HintKind => GESTURE[ABILITIES[a].gesture];

export class Tutorial {
  constructor(public ability: AbilityId, public tutorId: number, private hud: LevelHudView, private backdrop?: BiomeBackdrop) {
    const def = ABILITIES[ability];
    hud.showHint(gestureHint(ability), `Yeni: ${def.name}\n${def.how}`);
    backdrop?.setForegroundAlpha(0.35);
  }
  done() { this.hud.hideHint(); this.backdrop?.setForegroundAlpha(1); }
}
