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

/**
 * İlk canavarın (20, Serumen Golemi) öğretici anı: ilk saplı yumrukta bir kez (sim olayı 'bossTutor', play/boss.ts). Zayıf nokta
 * (saplı yumruk) parlar; vuruş yolu golem(): saplı yumruğun üstüne yere çakıl (zıpla, havada aşağı kaydır). Başarı: 'bossHit'.
 * Yumruk kalkınca (ya da 8 gerçek sn sonra) an biter; oyuncu vuramazsa savaş normal kurallarla sürer.
 */
export const BOSS_TUTOR = 'boss';
export const BOSS_TUTOR_TEXT = 'Zayıf nokta: parlayan yumruk\nÜstüne zıpla, havada aşağı kaydır!';
export const BOSS_TUTOR_SUCCESS = ['bossHit'];

/** 5. bölümün kayma tazeleme anı (öğrenilmiş olsa da gösterilir; iki başarılı perde geçişinden sonra bir daha gösterilmez) */
export const REFRESH_KEY = 'tazele-kayma';
export const REFRESH_TEXT = 'Aşağı kaydır: perdenin altından kay!';
export class Tutorial {
  /** ekranda gösterilen yazı (kabuk seslendirmesi için 'hint' olayıyla gider) */
  readonly text: string;
  /** anı "başardın" diye bitiren sim olayları (yeteneğin kendi olayları; ilk canavarda BOSS_TUTOR_SUCCESS) */
  success: readonly string[];
  private shown = false;
  /** show: el işareti ve yazı çizilsin mi (ipuçları gizliyken — temiz çekim, `?ipucu=0` — yalnız ağır çekim ve olay) */
  constructor(public ability: AbilityId, public tutorId: number, private hud: LevelHudView, private backdrop?: BiomeBackdrop, text?: string, show = true) {
    const def = ABILITIES[ability];
    this.text = text ?? `Yeni: ${def.name}\n${def.how}`;
    this.success = TUTORIAL_SUCCESS[ability];
    if (show) { hud.showHint(gestureHint(ability), this.text); backdrop?.setForegroundAlpha(0.35); this.shown = true; }
  }
  /** görseli kaldır (an sürer) */
  hide() { if (!this.shown) return; this.shown = false; this.hud.hideHint(); this.backdrop?.setForegroundAlpha(1); }
  done() { this.hide(); }
  /** ilk canavarın anı mı (bossTutorial) */
  get boss(): boolean { return this.success === BOSS_TUTOR_SUCCESS; }
}
/** ilk canavarın öğretici anı (el işareti: çakılmanın aşağı kaydırması) */
export function bossTutorial(hud: LevelHudView, backdrop: BiomeBackdrop | undefined, show: boolean): Tutorial {
  const t = new Tutorial('cakil', -1, hud, backdrop, BOSS_TUTOR_TEXT, show); t.success = BOSS_TUTOR_SUCCESS; return t;
}
