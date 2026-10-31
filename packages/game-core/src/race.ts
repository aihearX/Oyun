import Phaser from 'phaser';
import { HERO_SIZE, SOCIAL_LIMITS } from '@odi/shared';
import type { RaceGhostInfo, RaceOptions, RacePosUpdate } from './bridge';
import { hatTexture, heroTexture } from './art';
import { COLORS, FONT, floatText, viewW, viewH } from './ui';
import { sfx, unlock } from './audio';

/** bu kadar uzağa tek seferde atlayan hayalet kaydırılmaz, ışınlanır (yeniden doğma, kontrol noktası) */
const TELEPORT_PX = 480;
/** bu kadar süredir konum gelmeyen (bitirmemiş) rakip soluklaşır: bağlantısı kopmuş ya da ayrılmış olabilir */
const STALE_MS = 4000;
/**
 * Soluklaşmış (konumu gelmeyen) hayaletin konumu dönünce bundan uzaktaysa kaymaz: görünmezken yeni yerine geçer, sonra belirir.
 * Sunucu yeniden başlarken ya da ağ koparken rakip koşmaya devam eder; dönüşte hızla kayan bir hayalet "sıçrama" gibi görünür (MK-031).
 */
const RESUME_SLIDE_PX = 24;
/** sıralama bildirimleri seyrek: en az bu aralıkla ve sıra bu kadar süre değişmeden kalınca */
const NOTICE_COOLDOWN_MS = 4500;
const RANK_STABLE_MS = 700;
const GHOST_ALPHA = 0.5;
/** konum gönderme aralığı (gerçek zaman); sunucu 8 Hz üstünü düşürdüğü için biraz pay */
const SEND_MS = 1000 / SOCIAL_LIMITS.racePosHz + 5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface Ghost {
  info: RaceGhostInfo;
  body: Phaser.GameObjects.Image; hat?: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; dot: Phaser.GameObjects.Image;
  x: number; y: number; fromX: number; fromY: number; toX: number; toY: number; t0: number; dur: number;
  lastAt: number; pct: number; seen: boolean; stale: boolean; done: boolean;
  /** isim etiketinin kafadan yüksekliği: yan yana koşanların etiketleri üst üste binmesin diye sırayla kademeli */
  labelDy: number;
}

export interface RaceHost {
  scene: Phaser.Scene;
  /** kendi kahramanım (yalnızca konum okunur) */
  hero: { readonly x: number; readonly y: number };
  /** kapı x'i (ilerleme = hero.x / gateX) */
  gateX: number;
  startX: number;
  startY: number;
  /** sahne zaman çarpanı (bot hızlandırma); gönderme aralığı gerçek zamanda sabit kalsın diye */
  timeScale: number;
  haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error'): void;
  /** kendi koşum sürüyor mu (başladı ve bitmedi) */
  live(): boolean;
  /** kendi Odi rengim (şeritteki işaret için; yoksa varsayılan mor) */
  heroColor?: number;
  /** oyun içi göstergenin güvenli alan inişi (tasarım px): şerit onun altında kalır */
  top?: number;
}

/**
 * Canlı yarış katmanı: rakip hayaletleri (yarı saydam Odi + isim), 8 Hz konum akışı arasında yumuşak geçiş,
 * üstte canlı sıralama şeridi, seyrek "Öne geçtin!" / "Ayşe önde!" bildirimleri ve başlangıç geri sayımı.
 * Hayaletlerin fiziği/çarpışması yoktur; kamera kendi kahramanında kalır.
 */
export class RaceLayer {
  private ghosts = new Map<string, Ghost>();
  private unsub: () => void;
  private meDot!: Phaser.GameObjects.Image; private meRing!: Phaser.GameObjects.Graphics; private rankText!: Phaser.GameObjects.Text; private leadBadge!: Phaser.GameObjects.Text;
  private x0 = 0; private x1 = 0; private stripY = 101; private stripObjs: Phaser.GameObjects.GameObject[] = [];
  private rank = 0; private pendingRank = 0; private pendingSince = 0; private lastNoticeAt = -1e9;
  private lastSentAt = -1e9; private myFinal: number | null = null;
  // geri sayım
  private goFn: (() => void) | null = null; private countVeil?: Phaser.GameObjects.Rectangle; private countInfo?: Phaser.GameObjects.Text; private countBig?: Phaser.GameObjects.Text; private shownStep: number | null = null;
  started = false;

  constructor(private host: RaceHost, private opts: RaceOptions) {
    const { scene } = host;
    const others = opts.players.filter((p) => p.id !== opts.meId);
    this.stripY = 101 + (host.top ?? 0);
    this.buildStrip();
    others.forEach((p, i) => this.ghosts.set(p.id, this.makeGhost(p, i)));
    this.unsub = opts.subscribe((p) => this.onPos(p));
    // kendi konumum: sahne zamanlayıcısı (fizik adımından bağımsız; zaman çarpanı telafi edilir)
    scene.time.addEvent({ delay: SEND_MS * host.timeScale, loop: true, callback: () => this.send() });
    scene.events.once('shutdown', () => this.destroy());
  }

  // ------------------------------------------------------------ hayaletler
  private makeGhost(info: RaceGhostInfo, i: number): Ghost {
    const { scene } = this.host;
    const key = heroTexture(scene, `odi-g${(info.color & 0xffffff).toString(16)}`, info.color, HERO_SIZE, 'happy');
    // başlangıç dizilişi: konumu gelene kadar kahramanın arkasında sıra (herkes aynı noktadan başlar)
    const x = Math.max(16, this.host.startX - 30 * (i + 1)); const y = this.host.startY; const labelDy = HERO_SIZE + 6 + (i % 2) * 17;
    const body = scene.add.image(x, y, key).setOrigin(0.5, 1).setAlpha(GHOST_ALPHA).setDepth(18);
    const hk = info.hat ? hatTexture(scene, info.hat) : null;
    const hat = hk ? scene.add.image(x, y - HERO_SIZE / 2, hk).setAlpha(GHOST_ALPHA).setDepth(18.5) : undefined;
    const label = scene.add.text(x, y - labelDy, info.name, { fontFamily: FONT, fontSize: '12px', fontStyle: '800', color: '#ffffff', backgroundColor: 'rgba(19,22,42,0.55)', padding: { x: 6, y: 2 } })
      .setOrigin(0.5, 1).setDepth(19).setAlpha(0.9);
    const dot = scene.add.image(this.x0, this.stripY, key).setScale(0.42).setScrollFactor(0).setDepth(105);
    return { info, body, hat, label, dot, x, y, fromX: x, fromY: y, toX: x, toY: y, t0: 0, dur: 1, lastAt: 0, pct: 0, seen: false, stale: false, done: false, labelDy };
  }

  private onPos(p: RacePosUpdate) {
    const g = this.ghosts.get(p.id); if (!g) return;
    const now = performance.now();
    const gap = g.lastAt ? now - g.lastAt : 1000 / SOCIAL_LIMITS.racePosHz;
    const wasStale = g.stale || (g.seen && !g.done && gap > STALE_MS);
    g.lastAt = now; g.seen = true; g.pct = clamp01(p.pct);
    const dist = Math.hypot(p.x - g.x, p.y - g.y);
    if (dist > TELEPORT_PX || (wasStale && dist > RESUME_SLIDE_PX)) {
      // ışınlanma (yeniden doğma) ya da uzun aradan sonra dönüş: görünmezken yeni yerine geç, sonra belir (sıçrama görünmez)
      g.x = g.fromX = g.toX = p.x; g.y = g.fromY = g.toY = p.y; g.t0 = now; g.dur = 1;
      this.reappear(g);
    } else {
      // bir sonraki paket gelene kadar mevcut görünür konumdan yeni hedefe doğrusal geçiş (≈ bir paket gecikmeli, takılmasız)
      // geçiş en az bir paket aralığı sürer: art arda (yığılmış) gelen paketlerde hayalet hızla atılmaz
      g.fromX = g.x; g.fromY = g.y; g.toX = p.x; g.toY = p.y; g.t0 = now; g.dur = Math.max(1000 / SOCIAL_LIMITS.racePosHz, Math.min(320, gap));
      if (wasStale) this.setFaded(g, false);
    }
    if (g.pct >= 0.999 && !g.done) { g.done = true; g.label.setText(`${g.info.name} · bitirdi`); }
  }

  /** soluk (konumu gelmiyor) ya da normal görünüm */
  private setFaded(g: Ghost, stale: boolean) {
    g.stale = stale; const a = stale ? 0.18 : GHOST_ALPHA;
    this.host.scene.tweens.killTweensOf([g.body, g.hat, g.label].filter(Boolean));
    g.body.setAlpha(a); g.hat?.setAlpha(a); g.label.setAlpha(stale ? 0.45 : 0.9); g.dot.setAlpha(stale ? 0.4 : 1);
  }

  /** aynı karede görünmez olur (konum değişimi görünmesin), sonra belirir */
  private reappear(g: Ghost) {
    const { scene } = this.host;
    g.stale = false;
    const parts = [g.body, g.hat].filter(Boolean) as Phaser.GameObjects.Image[];
    scene.tweens.killTweensOf([...parts, g.label]);
    for (const o of parts) o.setAlpha(0);
    g.label.setAlpha(0); g.dot.setAlpha(1);
    scene.tweens.add({ targets: parts, alpha: GHOST_ALPHA, duration: 240 });
    scene.tweens.add({ targets: g.label, alpha: 0.9, duration: 240 });
  }

  // ------------------------------------------------------------ üst şerit
  private buildStrip() {
    const { scene } = this.host; const w = viewW(scene); const y = this.stripY;
    for (const o of this.stripObjs) o.destroy(); this.stripObjs = [];
    const bg = scene.add.graphics().setScrollFactor(0).setDepth(104);
    // sağdaki seri rozetiyle (LevelHud) çakışmasın diye şerit sola yaslı ve koyu cam görünümünde
    const right = w - 132;
    bg.fillStyle(0x140c35, 0.62); bg.fillRoundedRect(8, y - 14, right - 8, 28, 14); bg.lineStyle(1.5, 0x8f7cff, 0.55); bg.strokeRoundedRect(8, y - 14, right - 8, 28, 14);
    this.rankText = scene.add.text(18, y, '', { fontFamily: FONT, fontSize: '14px', fontStyle: '800', color: '#fff6e5' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(105);
    this.x0 = 64; this.x1 = right - 30;
    const track = scene.add.graphics().setScrollFactor(0).setDepth(104);
    track.lineStyle(3, 0x6a5fb0, 1); track.lineBetween(this.x0, y, this.x1, y);
    // bitiş bayrağı çizili (tuvalde emoji yok): direk + dama bayrak
    const flag = scene.add.graphics().setScrollFactor(0).setDepth(105); const fx = this.x1 + 9, fy = y - 9;
    flag.lineStyle(2, 0xfff6e5, 1); flag.lineBetween(fx, fy, fx, fy + 19);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { flag.fillStyle((r + c) % 2 ? 0x140c35 : 0xfff6e5, 1); flag.fillRect(fx + 1 + c * 4, fy + r * 4, 4, 4); }
    flag.lineStyle(1, 0xfff6e5, 1); flag.strokeRect(fx + 1, fy, 12, 8);
    this.meRing = scene.add.graphics().setScrollFactor(0).setDepth(106);
    this.meRing.lineStyle(2.5, 0x6c4cf1, 1); this.meRing.strokeCircle(0, 0, 12);
    const meColor = this.host.heroColor ?? 0x6c4cf1;
    this.meDot = scene.add.image(this.x0, y, heroTexture(scene, `odi-g${(meColor & 0xffffff).toString(16)}`, meColor, HERO_SIZE, 'happy')).setScale(0.42).setScrollFactor(0).setDepth(107);
    this.leadBadge = scene.add.text(this.x0, y - 15, '1.', { fontFamily: FONT, fontSize: '11px', fontStyle: '800', color: '#13162a', backgroundColor: '#ffc25c', padding: { x: 4, y: 1 } })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(108).setVisible(false);
    this.stripObjs.push(bg, this.rankText, track, flag, this.meRing, this.meDot, this.leadBadge);
  }
  /** görünüm boyutu / gösterge inişi değişti: şerit yeniden kurulur, rakip işaretleri yeni hizaya (LevelScene.onViewResize) */
  relayout(top: number) {
    this.stripY = 101 + top; this.buildStrip();
    for (const g of this.ghosts.values()) g.dot.setY(this.stripY);
    this.drawStrip();
  }

  private myPct(): number { return this.myFinal ?? clamp01(this.host.hero.x / this.host.gateX); }

  /** canlı sıralama: ilerlemeye göre (eşitlikte kimliğe göre, her istemcide aynı) */
  private standings(): { id: string; name: string; pct: number }[] {
    const list = [{ id: this.opts.meId, name: 'Sen', pct: this.myPct() }, ...[...this.ghosts.values()].map((g) => ({ id: g.info.id, name: g.info.name, pct: g.pct }))];
    return list.sort((a, b) => b.pct - a.pct || (a.id < b.id ? -1 : 1));
  }

  // ------------------------------------------------------------ her kare
  update() {
    const now = performance.now();
    if (!this.started) this.tickCountdown(now);
    for (const g of this.ghosts.values()) {
      const k = Math.min(1, (now - g.t0) / g.dur);
      g.x = g.fromX + (g.toX - g.fromX) * k; g.y = g.fromY + (g.toY - g.fromY) * k;
      g.body.setPosition(g.x, g.y); g.hat?.setPosition(g.x, g.y - HERO_SIZE / 2); g.label.setPosition(g.x, g.y - g.labelDy);
      // yalnız soluklaşma burada; dönüş onPos'ta (uzaksa görünmezken yeni yerine geçer)
      if (!g.stale && g.seen && !g.done && now - g.lastAt > STALE_MS) this.setFaded(g, true);
    }
    const { rank, list } = this.drawStrip();
    this.notices(now, rank, list);
  }

  /** şeritteki işaretler, sıra yazısı ve önde rozeti (hayalet gövdeleri ayrı: update) */
  private drawStrip() {
    for (const g of this.ghosts.values()) g.dot.setX(this.x0 + (this.x1 - this.x0) * g.pct);
    const mx = this.x0 + (this.x1 - this.x0) * this.myPct();
    this.meDot.setX(mx); this.meRing.setPosition(mx, this.stripY);
    const list = this.standings();
    const rank = list.findIndex((p) => p.id === this.opts.meId) + 1;
    this.rankText.setText(`${rank}./${list.length}`);
    const leader = list[0]!;
    const leaderX = leader.id === this.opts.meId ? mx : this.ghosts.get(leader.id)!.dot.x;
    // yarış başlamadan (herkes 0'da) rozet yok
    this.leadBadge.setVisible(this.started && leader.pct > 0.02).setX(leaderX);
    return { rank, list };
  }

  private notices(now: number, rank: number, list: { id: string; name: string; pct: number }[]) {
    if (!this.started || !this.host.live()) { this.rank = rank; this.pendingRank = rank; return; }
    if (rank === this.rank) { this.pendingRank = rank; return; }
    if (rank !== this.pendingRank) { this.pendingRank = rank; this.pendingSince = now; return; }
    if (now - this.pendingSince < RANK_STABLE_MS) return;
    const prev = this.rank; this.rank = rank;
    if (now - this.lastNoticeAt < NOTICE_COOLDOWN_MS) return;
    this.lastNoticeAt = now;
    const { scene, hero } = this.host;
    if (rank < prev) { floatText(scene, hero.x, hero.y - 92, rank === 1 ? 'Öne geçtin!' : `Öne geçtin! ${rank}.`, COLORS.accent2); sfx.tick(); }
    else { const ahead = list[rank - 2]; if (ahead) floatText(scene, hero.x, hero.y - 92, `${ahead.name} önde!`, COLORS.coral); }
  }

  private send() {
    if (!this.started || !this.host.live()) return;
    const t = performance.now(); if (t - this.lastSentAt < SEND_MS - 12) return; this.lastSentAt = t;
    const h = this.host.hero;
    try { this.opts.sendPos({ x: Math.round(h.x), y: Math.round(h.y), pct: Math.round(this.myPct() * 1000) / 1000 }); } catch { /* ağ hatası oyunu durdurmasın */ }
  }

  /** bölüm bitti: tamamladıysa son konumu %100 olarak gönder */
  finished(completed: boolean) {
    if (completed) {
      this.myFinal = 1;
      const h = this.host.hero;
      try { this.opts.sendPos({ x: Math.round(h.x), y: Math.round(h.y), pct: 1 }); } catch { /* yok */ }
    }
  }

  // ------------------------------------------------------------ geri sayım
  /** "Hazır ol" → 3-2-1 → "Başla!"; o ana kadar giriş kilitli (sahne başlamadı). Başlama anı herkes için sunucu saatine hizalı. */
  countdown(info: string, go: () => void) {
    const { scene } = this.host; const w = viewW(scene), h = viewH(scene);
    unlock(); // oyuncu lobide "Hazırım"a dokundu: sayfa etkinleştirilmiş durumda, ses açılabilir
    this.goFn = go;
    this.countVeil = scene.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0.45).setScrollFactor(0).setDepth(300);
    this.countInfo = scene.add.text(w / 2, h / 2 - 150, info, { fontFamily: FONT, fontSize: '19px', fontStyle: '800', color: COLORS.text, align: 'center', wordWrap: { width: w - 60 }, lineSpacing: 6 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(301);
    this.countBig = scene.add.text(w / 2, h / 2, '', { fontFamily: FONT, fontSize: '118px', fontStyle: '900', color: COLORS.accent, stroke: '#ffffff', strokeThickness: 10 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(302);
    this.tickCountdown(performance.now());
  }

  private tickCountdown(now: number) {
    if (!this.goFn || !this.countBig) return;
    const remaining = this.opts.startAt > 0 ? this.opts.startAt - now : 0;
    const step = remaining <= 0 ? 0 : remaining > 3000 ? 4 : Math.ceil(remaining / 1000);
    if (step === this.shownStep) return;
    this.shownStep = step;
    const { scene } = this.host; const t = this.countBig;
    scene.tweens.killTweensOf(t);
    if (step === 4) { t.setText('Hazır ol…').setFontSize(40).setColor(COLORS.muted).setScale(1).setAlpha(1); return; }
    if (step > 0) {
      t.setText(String(step)).setFontSize(118).setColor(step === 1 ? COLORS.coral : COLORS.accent).setScale(1.7).setAlpha(1);
      scene.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.Out' });
      sfx.countdown(false); this.host.haptic('medium');
      return;
    }
    // Başla!
    t.setText('Başla!').setFontSize(76).setColor(COLORS.accent2).setScale(0.6).setAlpha(1);
    scene.tweens.add({ targets: t, scale: 1.15, duration: 200, ease: 'Back.Out' });
    scene.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 300, onComplete: () => t.destroy() });
    const veil = this.countVeil, info = this.countInfo;
    if (veil) scene.tweens.add({ targets: veil, alpha: 0, duration: 250, onComplete: () => veil.destroy() });
    info?.destroy();
    sfx.countdown(true); this.host.haptic('heavy');
    this.started = true;
    const go = this.goFn; this.goFn = null; go();
  }

  destroy() { try { this.unsub(); } catch { /* yok */ } }
}
