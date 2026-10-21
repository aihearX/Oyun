import type { LevelSpec, PlayerSkills, RunResult } from '@odi/shared';

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
  | { type: 'quit' };

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
  /** Revir bonusu: bölümdeki ilk (düşme dışı) hasarı bu yüzde şansla yok say. Tek zar atılır; oran Kamp ekranında yazılıdır. */
  firstHitIgnorePct?: number;
  sounds?: boolean;
  /** bölüm başı can (varsayılan 3) */
  lives?: number;
  /** harness/pazarlama çekimi: tuval piksel oranını zorla (1–3). Yoksa bot 1, oyuncu cihaz oranı (en çok 2). Yalnız görsel. */
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
