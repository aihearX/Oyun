import type { LevelSpec, PlayerSkills, RunResult } from '@odi/shared';
import type { PlanPrefs } from './play/planner';
import type { World } from './play/world';

export type GameEvent =
  | { type: 'ready' }
  | { type: 'started' }
  | { type: 'progress'; pct: number; coins: number; score: number }
  | { type: 'checkpoint'; x: number }
  | { type: 'damage'; lives: number }
  | { type: 'haptic'; kind: 'light' | 'medium' | 'heavy' | 'success' | 'error' }
  | { type: 'levelComplete'; result: RunResult }
  | { type: 'levelFailed'; result: RunResult }
  /** Tedavi Odası malzemesi bir patoloji engelini etkisiz kıldı (left: bu malzemeden kalan). docs/14-kamp.md */
  | { type: 'remedy'; id: string; pathology: string; left: number }
  /** bölge patolojisi bu koşuda ilk kez görüldü (first: oyuncu onu ilk kez görüyor; Tüy Dede'nin cümlesi gösterildi). content/src/patolojiler.ts */
  | { type: 'pathology'; id: string; first: boolean }
  /**
   * Bölüm içi ipucu/öğretici yazısı ekranda göründü (kabuk seçtiklerini seslendirebilir). id: HINT_IDS'teki sabit kimlikler,
   * öğretici anlar `ogret-<yetenek>` (zipla, kayma, duvar, suzul, trambolin, kanca, cakil, yuz, darbe, cevir), patoloji
   * cümleleri `patoloji:<kimlik>`, boss evresi `boss-faz-2` / `boss-faz-3`. text: ekrandaki yazı.
   */
  | { type: 'hint'; id: string; text: string }
  | { type: 'quit' };

/** 'hint' olayının sabit kimlikleri (öğretici `ogret-*`, `patoloji:*` ve `boss-faz-*` dışında) */
export const HINT_IDS = {
  'tazele-kayma': '5. bölümün kayma tazeleme anı (ilk perdeden önce)',
  'perde-kay': 'kıl perdesi önünde "aşağı kaydır" ipucu (3-8, ilk üç perde)',
  giris: 'bölümün giriş cümlesi',
  'mod-cihaz-kapali': 'Cihaz kapalı değiştiricisi', 'mod-ters-yercekimi': 'Ters yerçekimi değiştiricisi',
  eskort: 'fısıltı eskortu başladı', 'eskort-kayip': 'fısıltı yaralandı', kovalama: 'ışık treni kovalıyor',
  'boss-bagir': 'boss bağırıyor (3 nota)', 'boss-sersem': 'boss sersemledi', 'bolum-nota': 'bölüm içi kısım sonu nota özeti ("Bu kısımda n/m nota")',
} as const;

/** Canlı yarışta bir rakip (görünüm bilgisi) */
export interface RaceGhostInfo { id: string; name: string; color: number; hat: string }
/** Rakibin konumu (dünya koordinatı) ve ilerlemesi (0-1) */
export interface RacePosUpdate { id: string; x: number; y: number; pct: number }
/**
 * Canlı yarış bağlantısı (kabuk kurar; game-core ağ bilmez).
 * Rakipler yarı saydam "hayalet" Odi olarak çizilir (çarpışma yok), üstte yarış şeridi gösterilir,
 * dokunarak başlama yerine geri sayım (3-2-1-Başla!) çalışır ve o ana kadar giriş kilitlidir.
 */
export interface RaceOptions {
  /** benim oyuncu kimliğim (players içinde olabilir; kendim hayalet olarak çizilmem) */
  meId: string;
  /** odadaki tüm oyuncular (ben dahil olabilir) */
  players: RaceGhostInfo[];
  /** yerel performance.now() tabanlı başlama anı (sunucunun startsAt'inden saat farkıyla hesaplanır); 0 = hemen başla */
  startAt: number;
  /** kendi konumumu gönder (sahne zamanlayıcısıyla ~racePosHz) */
  sendPos(p: { x: number; y: number; pct: number }): void;
  /** rakip konumlarını dinle; dönüş değeri aboneliği bırakır */
  subscribe(cb: (p: RacePosUpdate) => void): () => void;
  /** yalnızca test harness'i: bot, "Başla!"dan bu kadar ms sonra başlar (oyunculara hiç gösterilmez; bot değilse yok sayılır) */
  botDelayMs?: number;
}

export interface LevelOptions {
  spec: LevelSpec;
  onEvent: (e: GameEvent) => void | Promise<void>;
  skills: PlayerSkills;
  /** harness/test: otomatik oyuncu */
  bot?: boolean;
  /** test: bot modunda başlar ama hiçbir giriş yapmaz (boşta oyuncu). Her bölüm boşta kaybedilmeli. */
  botIdle?: boolean;
  /**
   * yalnız test derlemesi (oyuncu ajanları, `&oyun-beceri=`): botun eli. Bölüm kurulunca dünyayla bir kez çağrılır; dönen tercihlerle
   * planlayıcı insan gibi oynar (tepki gecikmesi, sapma, kaçan girdi: play/human.ts `humanHand`); `slow(k)` öğretici an ağır çekiminde
   * çağrılır (0,3; bitince 1). Yoksa bot kusursuz planlayıcıdır (varsayılan; bot.mjs ve e2e takımları).
   */
  botHand?: (w: World) => { prefs: PlanPrefs; slow?: (k: number) => void };
  /** Revir bonusu: bölümdeki ilk (düşme dışı) hasarı bu yüzde şansla yok say. Tek zar atılır; oran Kamp ekranında yazılıdır. */
  firstHitIgnorePct?: number;
  sounds?: boolean;
  /**
   * Bölüm içi ipuçları (varsayılan açık). false: alt şerit ipuçları, el işaretli öğretici anlar ve dünyadaki öğretici tabelalar
   * çizilmez ('hint' olayları yine gelir; kabuk da seslendirmez). Temiz çekim ve test içindir (`?bot=1&ipucu=0`); oyuncuda hep açık.
   */
  hints?: boolean;
  /** Büyük yazı (Ayarlar): oyun içi gösterge, ipucu şeridi, üst şerit ve uçan yazılar ~1,2 kat büyür (yalnız görsel) */
  bigText?: boolean;
  /** azaltılmış hareket (Ayarlar/sistem `prefers-reduced-motion`): ekran flaşları tümden kapanır. Yoksa tarayıcı tercihi okunur. */
  reducedMotion?: boolean;
  /** bölüm başı can (varsayılan 3) */
  lives?: number;
  /** harness/pazarlama çekimi: tuvalin CSS pikseli başına piksel oranını zorla (1–3; ör. 3 → 440 CSS px genişlikte 1320 px tuval).
   *  Yoksa bot 1, oyuncu cihaz piksel oranı (bellek için en çok 2). Yalnız görsel. */
  renderScale?: number;
  /** bot: hız çarpanı (test süresini kısaltmak için) */
  timeScale?: number;
  /** kozmetik görünüm (yalnızca görsel): gövde rengi ve şapka anahtarı */
  cosmetic?: { color?: number; hat?: string };
  /** bu denemede Şanslı Nota var mı (kabuk zarı atar, ihtimal bilgi ekranında yazılı); yalnızca görsel + sonuç bayrağı */
  lucky?: boolean;
  /** henüz kutlanmamış "ilk kez" anları (ezme, seri5, kilpayi, guc, kontrol) */
  firsts?: string[];
  /** canlı yarış (gerçek oyuncular); yoksa normal tek kişilik bölüm */
  race?: RaceOptions;
  /** oyun içi göstergenin duraklat düğmesine basıldı (kabuk duraklatma/yarıştan çıkma menüsünü açar) */
  onPauseRequest?: () => void;
  /** cihazın güvenli alan üst boşluğu (CSS px; çentik/kamera/saat): oyun içi gösterge bunun altına iner */
  safeTop?: number;
  /** güvenli alan üst boşluğunu yeniden ölç (CSS px; görünüm boyutu değişince — döndürme, geç gelen yerel inset); verilirse safeTop yerine */
  safeTopNow?: () => number;
  /**
   * Tedavi Odası'ndan çantaya konan malzemeler (bölüm kartında seçilir; kimlikler @odi/content REMEDIES). Her adet, malzemenin
   * `counters` listesindeki bir patoloji engelini bir kez etkisiz kılar; kullanılan adetler RunResult.remediesUsed ile döner
   * (kullanılmayan kaybolmaz). Yarışta ve etkinlikte verilmez. Sözleşme: docs/14-kamp.md.
   */
  remedies?: { id: string; count: number }[];
}

export interface LevelHandle {
  destroy: () => void; pause: () => void; resume: () => void;
  /** koşuyu dışarıdan sonlandır (ör. canlı yarış sunucuda bitti): bitmemişse 'levelFailed' olayı gelir */
  end: (reason: string) => void;
}
