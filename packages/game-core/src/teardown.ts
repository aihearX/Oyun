import Phaser from 'phaser';

/**
 * Phaser oyununu kurar ve tamamen yok eden işlevi verir (harita, bölüm, kamp; YN-163). Phaser 3.90'ın `Game.destroy` yolu uzun
 * oturumda üç şey bırakıyordu (tools/harness/uzun-oturum.mjs ölçümü, yığın görüntüsü):
 * - `destroy` yalnız işaret koyar, asıl yıkım döngünün bir sonraki adımında olur: uyuyan döngü (haritanın boşta uykusu, gizli sayfa)
 *   uyandırılmazsa oyun hiç yok edilmez. Burada döngü uyandırılır.
 * - `VisibilityHandler` belgeye `visibilitychange` dinleyicisi koyar, hiç kaldırmaz; `window.onblur/onfocus`'u da bırakır. Kurulum
 *   açılışında (postBoot) izlenir, oyun yok edilince kaldırılır.
 * - `Graphics.TargetCamera` (bütün oyunların ortak, modül düzeyindeki kamerası) `generateTexture`'da çizilen her Graphics nesnesini
 *   `renderList`'e ekler, hiç boşaltmaz: her harita/bölüm ziyaretinin sahnesi, dokuları ve WebGL bağlamı bellekte kalıyordu. Oyun yok
 *   edilince liste boşaltılır, kamera o oyunun sahnesini bırakır.
 * WebGL bağlamı da yıkımdan hemen sonra bırakılır (çöp toplamayı beklemeden; telefonda GPU belleği).
 */
export function createGame(config: Phaser.Types.Core.GameConfig): { game: Phaser.Game; destroy: () => void } {
  const vis: [string, EventListenerOrEventListenerObject][] = [];
  let blur: Window['onblur'] = null, focus: Window['onfocus'] = null;
  // Game.start sırası: postBoot → döngü → VisibilityHandler (eşzamanlı). postBoot'ta belge dinleyicileri izlenir, start bitince
  // (mikro görev) izleme kalkar; o arada konan visibilitychange dinleyicisi ve onblur/onfocus bu oyunundur
  const postBoot = config.callbacks?.postBoot;
  const watch = (g: Phaser.Game) => {
    postBoot?.(g);
    const add = document.addEventListener; const own = Object.prototype.hasOwnProperty.call(document, 'addEventListener');
    document.addEventListener = function (this: Document, type: string, fn: EventListenerOrEventListenerObject | null, opts?: boolean | AddEventListenerOptions) {
      if (fn && /visibilitychange$/.test(type)) vis.push([type, fn]);
      return add.call(this, type, fn as EventListenerOrEventListenerObject, opts);
    } as typeof document.addEventListener;
    queueMicrotask(() => {
      if (own) document.addEventListener = add; else delete (document as Partial<Document>).addEventListener;
      blur = window.onblur; focus = window.onfocus;
    });
  };
  const game = new Phaser.Game({ ...config, callbacks: { ...config.callbacks, postBoot: watch } });
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    for (const [type, fn] of vis) document.removeEventListener(type, fn, false);
    if (blur && window.onblur === blur) window.onblur = null;
    if (focus && window.onfocus === focus) window.onfocus = null;
    const tc = (Phaser.GameObjects.Graphics as unknown as { TargetCamera?: { renderList?: unknown[]; scene?: Phaser.Scene | null; sceneManager?: unknown; scaleManager?: unknown; cameraManager?: unknown } }).TargetCamera;
    if (tc) {
      if (tc.renderList) tc.renderList.length = 0;
      if (tc.scene?.game === game) { tc.scene = null; tc.sceneManager = null; tc.scaleManager = null; tc.cameraManager = null; }
    }
    const gl = (game.renderer as Partial<Phaser.Renderer.WebGL.WebGLRenderer> | null)?.gl;
    // yıkım bitince (görüntüleyici bağlam kaybı dinleyicilerini kaldırmış olur)
    if (gl) setTimeout(() => { try { if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* yok */ } }, 0);
  });
  let dead = false;
  return {
    game,
    destroy: () => {
      if (dead) return; dead = true;
      try { game.destroy(true); if (game.isBooted && !game.loop.running) game.loop.wake(); } catch { /* yok sayılır */ }
    },
  };
}
