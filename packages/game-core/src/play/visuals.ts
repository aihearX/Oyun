import Phaser from 'phaser';
import type { Entity } from '@odi/shared';
import { GAME_W, HERO_SIZE } from '@odi/shared';
import type { BiomeDef } from '@odi/content';
import { emojiTexture, roundRectTexture, shade, tonotopyColor, luckyNoteTexture } from '../art';
import { decorTexture, gateTexture, gearTexture, hazardTexture, moverTexture, spikeTexture, springTexture, bubbleTexture, platformTexture } from '../entities';
import { buildParallax } from '../parallax';
import { Hero } from '../hero';
import { FONT } from '../ui';

/**
 * ============================================================================================
 *  GÖRSEL SEAM'LER (docs/11 §7) — oynanış motoru TÜM çizimi yalnızca bu dosyadaki işlevlerle yapar.
 *  Görsel ekip `render/**` modülünü hazırlayınca aşağıdaki fabrikaların içini (ya da bu dosyanın
 *  dışa aktarımlarını) kendi uygulamalarına yönlendirmesi yeterlidir; LevelScene başka çizim çağırmaz.
 *
 *  paintBiome(scene, biome, worldW, worldH): BiomeBackdrop        — arka plan; her kare backdrop.update(cam)
 *  makeTerrain(scene, rects: TerrainRect[], biome): void         — durağan katı zeminlerin görseli (toptan, bir kez)
 *  drawEntity(scene, e: Entity, biome): EntityView | null        — diğer her varlık; motor her kare view.update(v: EntityVisual)
 *        e: DÜNYA koordinatlarında Entity (x,y = world/chunks yazım kuralı; dikdörtgenlerde sol-üst, ayaklılarda taban)
 *        v: x,y (anlık bağlantı noktası), visible, alpha, warn 0..1 (telegraf), on (açık/basılı/etkin), t (sn), color (−1/0..1)
 *  createHeroView(scene, cosmetic): HeroView                     — Odi + efektler (hale, süzülme kanatları, darbe izi, kanca ipi)
 *        motor her kare heroView.update(h: HeroVisual), anlar için heroView.fx(kind)
 *  createHud(scene, info): LevelHudView                          — nota sayacı, 3 altın koklea yuvası, can, ilerleme, seri
 *  createBossView(scene, kind, name): BossView                   — boss ve saldırıları (golem/canavar); update(b: BossVisual)
 *  createProjectileLayer(scene): ProjectileLayer                 — atıcı mermileri (her kare tüm konumlar)
 *
 *  Fizik gövdeleri görsellerde değildir (play/sim.ts); görseller yalnızca konum/durum yansıtır.
 * ============================================================================================
 */

// ---------------------------------------------------------------- arka plan
export interface BiomeBackdrop { update(cam: Phaser.Cameras.Scene2D.Camera): void }
export function paintBiome(scene: Phaser.Scene, biome: BiomeDef, worldW: number, _worldH: number): BiomeBackdrop {
  const p = buildParallax(scene, biome, worldW);
  return { update: (cam) => p.update(cam.scrollX) };
}

// ---------------------------------------------------------------- zemin
export interface TerrainRect { l: number; t: number; r: number; b: number; kind: 'platform' | 'wall' | 'ceiling' }
const TILE = 128;
function crustTile(s: Phaser.Scene, biome: BiomeDef, h: number): string {
  const hh = Math.max(8, Math.min(40, Math.round(h)));
  const key = `crust-${biome.id}-${hh}`; if (s.textures.exists(key)) return key;
  platformTexture(s, biome, TILE, hh); // biyom motifli dokuyu üret, sonra aynı anahtarla kullan
  const src = `plat-${biome.id}-${TILE}x${hh}`;
  return src;
}
function bodyTile(s: Phaser.Scene, biome: BiomeDef): string {
  const key = `body-${biome.id}`; if (s.textures.exists(key)) return key;
  const p = biome.palette; const g = s.add.graphics();
  g.fillStyle(p.ground, 1); g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(shade(p.ground, -0.1), 0.6); for (let i = 0; i < 6; i++) g.fillEllipse((i * 37) % TILE, 20 + ((i * 53) % 100), 26, 12);
  g.fillStyle(p.groundDark, 0.35); g.fillRect(0, TILE * 0.6, TILE, TILE * 0.4);
  g.generateTexture(key, TILE, TILE); g.destroy(); return key;
}
function wallTile(s: Phaser.Scene, biome: BiomeDef): string {
  const key = `wall-${biome.id}`; if (s.textures.exists(key)) return key;
  const p = biome.palette; const g = s.add.graphics();
  g.fillStyle(shade(p.groundDark, -0.05), 1); g.fillRect(0, 0, 40, 64);
  g.lineStyle(3, shade(p.ground, 0.15), 0.8); for (let y = 8; y < 64; y += 16) { g.beginPath(); g.moveTo(4, y); g.lineTo(36, y + 6); g.strokePath(); }
  g.fillStyle(p.accent, 0.5); g.fillRect(0, 0, 4, 64); g.fillRect(36, 0, 4, 64);
  g.generateTexture(key, 40, 64); g.destroy(); return key;
}
/** durağan zeminleri toptan çiz: üst kabuk (biyom motifi) + gövde (koyulaşan doku) */
export function makeTerrain(scene: Phaser.Scene, rects: TerrainRect[], biome: BiomeDef): void {
  for (const r of rects) {
    const w = r.r - r.l, h = r.b - r.t; if (w <= 0 || h <= 0) continue;
    if (r.kind === 'wall') { scene.add.tileSprite(r.l, r.t, w, h, wallTile(scene, biome)).setOrigin(0, 0).setDepth(5); continue; }
    if (h <= 44) { scene.add.tileSprite(r.l, r.t, w, h, crustTile(scene, biome, h)).setOrigin(0, 0).setDepth(5); continue; }
    scene.add.tileSprite(r.l, r.t + 18, w, h - 18, bodyTile(scene, biome)).setOrigin(0, 0).setDepth(4);
    scene.add.tileSprite(r.l, r.t, w, 26, crustTile(scene, biome, 26)).setOrigin(0, 0).setDepth(5);
  }
}

// ---------------------------------------------------------------- varlıklar
export interface EntityVisual { x: number; y: number; visible: boolean; alpha: number; warn: number; on: boolean; t: number; color: number; face: 1 | -1 }
export interface EntityView { obj: Phaser.GameObjects.GameObject; update(v: EntityVisual): void; destroy(): void }

type Pos = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.Alpha;
const simple = (o: Pos, ox = 0, oy = 0, extra?: (v: EntityVisual) => void): EntityView => ({
  obj: o, destroy: () => o.destroy(),
  update: (v) => { o.setPosition(v.x + ox, v.y + oy); o.setVisible(v.visible); o.setAlpha(v.alpha); extra?.(v); },
});
const tex = (s: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
  if (!s.textures.exists(key)) { const g = s.add.graphics(); draw(g); g.generateTexture(key, w, h); g.destroy(); }
  return key;
};

function noteGlyph(s: Phaser.Scene, key: string, color: number, size: number): string {
  return tex(s, key, size, size, (g) => {
    const k = size / 32;
    g.fillStyle(0x000000, 0.18); g.fillEllipse(12 * k, 25 * k, 14 * k, 9 * k);
    g.fillStyle(color, 1); g.fillEllipse(11 * k, 23 * k, 13 * k, 9 * k); g.fillRect(16 * k, 5 * k, 3 * k, 18 * k);
    g.fillTriangle(17 * k, 5 * k, 27 * k, 11 * k, 17 * k, 13 * k);
    g.fillStyle(0xffffff, 0.6); g.fillCircle(9 * k, 21 * k, 2.4 * k);
  });
}
function cochleaTex(s: Phaser.Scene): string {
  return tex(s, 'altin-koklea', 48, 48, (g) => {
    g.fillStyle(0xffd75e, 0.3); g.fillCircle(24, 24, 23);
    g.lineStyle(6, 0xf2a900, 1); g.beginPath();
    for (let a = 0; a < Math.PI * 5.2; a += 0.15) { const r = 3 + a * 3.2; const x = 24 + Math.cos(a) * r * 0.9, y = 24 + Math.sin(a) * r * 0.9; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.strokePath(); g.fillStyle(0xfff4c4, 1); g.fillCircle(24, 24, 3);
  });
}

/** Her EntityType için görsel. e dünya koordinatlarındadır. */
export function drawEntity(s: Phaser.Scene, e: Entity, biome: BiomeDef): EntityView | null {
  const p = biome.palette; const props = e.props ?? {};
  const w = e.w ?? 120, h = e.h ?? 24;
  switch (e.type) {
    case 'moving': case 'lift': {
      const o = s.add.image(0, 0, moverTexture(s, biome, w, 24)).setOrigin(0, 0).setDepth(6);
      if (e.type === 'lift') { const arrow = s.add.text(0, 0, '⇧', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5, 1).setDepth(7); return { obj: o, destroy: () => { o.destroy(); arrow.destroy(); }, update: (v) => { o.setPosition(v.x, v.y); arrow.setPosition(v.x + w / 2, v.y - 2).setAlpha(0.6 + 0.4 * Math.sin(v.t * 6)); } }; }
      return simple(o);
    }
    case 'crumble': {
      const key = tex(s, `crumble-${biome.id}-${w}`, w, 24, (g) => {
        g.fillStyle(shade(p.ground, -0.08), 1); g.fillRoundedRect(0, 0, w, 24, 6);
        g.lineStyle(2, p.groundDark, 0.9); for (let x = 12; x < w - 6; x += 22) { g.beginPath(); g.moveTo(x, 2); g.lineTo(x + 6, 12); g.lineTo(x - 2, 22); g.strokePath(); }
      });
      const o = s.add.image(0, 0, key).setOrigin(0, 0).setDepth(6);
      return simple(o, 0, 0, (v) => { if (v.warn > 0) o.setPosition(v.x + Math.sin(v.t * 70) * 2, v.y + v.warn * 4); });
    }
    case 'wall': return simple(s.add.tileSprite(0, 0, w, h, wallTile(s, biome)).setOrigin(0, 0).setDepth(5));
    case 'barrier': {
      const key = tex(s, `barrier-${w}x${h}`, w, h, (g) => {
        g.fillStyle(0x6b21a8, 0.85); g.fillRoundedRect(0, 0, w, h, 8);
        g.lineStyle(3, 0xff4fd8, 0.9); for (let y = 6; y < h; y += 14) { g.beginPath(); g.moveTo(3, y); g.lineTo(w / 2, y + 7); g.lineTo(w - 3, y); g.strokePath(); }
      });
      const o = s.add.image(0, 0, key).setOrigin(0, 0).setDepth(7);
      return simple(o, 0, 0, (v) => o.setX(v.x + Math.sin(v.t * 40) * 1.5));
    }
    case 'door': {
      const key = tex(s, `door-${w}x${h}`, w, h, (g) => { g.fillStyle(0x3b3f58, 1); g.fillRoundedRect(0, 0, w, h, 6); g.lineStyle(3, 0xffc25c, 1); g.strokeRoundedRect(2, 2, w - 4, h - 4, 6); g.fillStyle(0xffc25c, 1); g.fillCircle(w / 2, h / 2, 6); });
      const o = s.add.image(0, 0, key).setOrigin(0, 0).setDepth(7);
      let lift = 0; return simple(o, 0, 0, (v) => { lift += ((v.on ? h - 10 : 0) - lift) * 0.15; o.setY(v.y - lift); });
    }
    case 'switch': {
      const pillar = props.by === 'darbe';
      const key = pillar ? tex(s, 'sw-pillar', 28, 64, (g) => { g.fillStyle(0x4cf0ff, 1); g.fillRoundedRect(0, 0, 28, 64, 8); g.fillStyle(0xffffff, 0.6); g.fillCircle(14, 14, 6); })
        : tex(s, 'sw-plate', 48, 14, (g) => { g.fillStyle(0xffc25c, 1); g.fillRoundedRect(0, 0, 48, 14, 5); g.fillStyle(0xffffff, 0.5); g.fillRect(8, 3, 32, 3); });
      const o = s.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(6);
      return simple(o, 0, 0, (v) => { o.setScale(1, v.on ? 0.45 : 1); o.setTint(v.on ? 0x8ef0b0 : 0xffffff); });
    }
    case 'fork': {
      const c = tonotopyColor(Number(props.color ?? 0));
      const key = tex(s, `fork-${c}`, 34, 50, (g) => { g.lineStyle(5, c, 1); g.beginPath(); g.moveTo(9, 4); g.lineTo(9, 26); g.arc(17, 26, 8, Math.PI, 0, true); g.lineTo(25, 4); g.strokePath(); g.fillStyle(c, 1); g.fillRect(15, 32, 5, 16); g.fillStyle(0xffffff, 0.5); g.fillCircle(9, 8, 2); });
      const o = s.add.image(0, 0, key).setDepth(9);
      return simple(o, 0, 0, (v) => { o.setScale(v.on ? 1.25 : 1); o.setAngle(Math.sin(v.t * 10) * (v.on ? 8 : 3)); });
    }
    case 'freqgate': {
      const c = tonotopyColor(Number(props.color ?? 0));
      const key = tex(s, `fgate-${c}-${w}x${h}`, w, h, (g) => { g.fillStyle(c, 0.55); g.fillRoundedRect(0, 0, w, h, 10); g.lineStyle(3, 0xffffff, 0.7); for (let y = 10; y < h; y += 18) { g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.strokePath(); } g.lineStyle(3, c, 1); g.strokeRoundedRect(1, 1, w - 2, h - 2, 10); });
      const o = s.add.image(0, 0, key).setOrigin(0, 0).setDepth(7);
      return simple(o, 0, 0, (v) => o.setAlpha(v.on ? 0.22 : 0.95));
    }
    case 'beat': {
      const key = tex(s, `beat-${biome.id}-${w}`, w, 20, (g) => { g.fillStyle(p.accent, 1); g.fillRoundedRect(0, 0, w, 20, 8); g.fillStyle(0xffffff, 0.45); g.fillRoundedRect(6, 3, w - 12, 5, 2); g.lineStyle(2, shade(p.accent, -0.35), 1); g.strokeRoundedRect(1, 1, w - 2, 18, 8); });
      const o = s.add.image(0, 0, key).setOrigin(0, 0).setDepth(6);
      return simple(o, 0, 0, (v) => { o.setAlpha(v.on ? (v.warn > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(v.t * 30)) : 1) : 0.18); o.setScale(1, v.on ? 1 : 0.6); });
    }
    case 'echo': {
      const key = tex(s, `echo-${w}`, w, 20, (g) => { g.fillStyle(0x4cf0ff, 0.9); g.fillRoundedRect(0, 0, w, 20, 8); g.lineStyle(2, 0xffffff, 0.9); g.strokeRoundedRect(1, 1, w - 2, 18, 8); });
      const o = s.add.image(0, 0, key).setOrigin(0, 0).setDepth(6);
      return simple(o, 0, 0, (v) => o.setAlpha(v.on ? 0.95 : 0.12 + 0.06 * Math.sin(v.t * 4)));
    }
    case 'launcher': {
      const key = tex(s, 'launcher', 52, 30, (g) => { g.fillStyle(0x3b3f58, 1); g.fillRoundedRect(0, 8, 52, 22, 8); g.fillStyle(0xffc25c, 1); g.fillTriangle(26, 0, 12, 16, 40, 16); });
      const o = s.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(6);
      const vx = Number(props.vx ?? 0); if (vx) o.setAngle(vx > 0 ? 25 : -25);
      return simple(o, 0, 0, (v) => o.setScale(1, 1 + 0.08 * Math.sin(v.t * 8)));
    }
    case 'water': {
      const key = tex(s, 'water-tile', 64, 64, (g) => { g.fillStyle(0x2ee6d6, 0.28); g.fillRect(0, 0, 64, 64); g.fillStyle(0xffffff, 0.08); g.fillCircle(16, 20, 5); g.fillCircle(48, 44, 3); });
      const o = s.add.tileSprite(0, 0, w, h, key).setOrigin(0, 0).setDepth(12);
      const top = s.add.tileSprite(0, 0, w, 8, tex(s, 'water-top', 64, 8, (g) => { g.fillStyle(0xffffff, 0.55); for (let x = 0; x < 64; x += 16) g.fillEllipse(x + 8, 4, 14, 5); })).setOrigin(0, 0.5).setDepth(12);
      return { obj: o, destroy: () => { o.destroy(); top.destroy(); }, update: (v) => { o.setPosition(v.x, v.y); top.setPosition(v.x, v.y); top.tilePositionX = v.t * 30; o.tilePositionY = -v.t * 10; } };
    }
    case 'gravzone': {
      const o = s.add.tileSprite(0, 0, w, h, tex(s, 'grav-tile', 48, 48, (g) => { g.fillStyle(0x9b5cff, 0.16); g.fillRect(0, 0, 48, 48); g.lineStyle(2, 0xd6b8ff, 0.35); g.beginPath(); g.moveTo(24, 10); g.lineTo(24, 38); g.moveTo(18, 16); g.lineTo(24, 10); g.lineTo(30, 16); g.moveTo(18, 32); g.lineTo(24, 38); g.lineTo(30, 32); g.strokePath(); })).setOrigin(0, 0).setDepth(2);
      return simple(o, 0, 0, (v) => { (o as Phaser.GameObjects.TileSprite).tilePositionY = Math.sin(v.t) * 6; });
    }
    case 'current': {
      const o = s.add.tileSprite(0, 0, w, h, tex(s, 'cur-tile', 48, 32, (g) => { g.lineStyle(2, 0xffffff, 0.25); g.beginPath(); g.moveTo(4, 16); g.lineTo(40, 16); g.lineTo(32, 10); g.moveTo(40, 16); g.lineTo(32, 22); g.strokePath(); })).setOrigin(0, 0).setDepth(13);
      const vx = Number(props.vx ?? 0); return simple(o, 0, 0, (v) => { (o as Phaser.GameObjects.TileSprite).tilePositionX = -v.t * vx * 0.5; });
    }
    case 'collect': { const o = s.add.image(0, 0, noteGlyph(s, 'nota-buyuk', 0xffc25c, 56)).setDepth(9); return simple(o, 0, 0, (v) => o.setScale(1 + 0.1 * Math.sin(v.t * 5))); }
    case 'coin': { const o = s.add.image(0, 0, noteGlyph(s, 'nota-altin', 0xffb800, 32)).setDepth(9); return simple(o, 0, 0, (v) => o.setY(v.y - 3 * Math.sin(v.t * 4 + e.x * 0.01))); }
    case 'note': {
      const c = tonotopyColor(Number(props.t ?? 0.5)); const o = s.add.image(0, 0, noteGlyph(s, `nota-mel-${c}`, c, 40)).setDepth(9);
      return simple(o, 0, 0, (v) => o.setScale(1 + 0.08 * Math.sin(v.t * 6)));
    }
    case 'secret': { const o = s.add.image(0, 0, cochleaTex(s)).setDepth(9); return simple(o, 0, 0, (v) => { o.setAngle(v.t * 40); o.setY(v.y - 5 * Math.sin(v.t * 3)); }); }
    case 'hook': {
      const key = tex(s, 'hook', 36, 36, (g) => { g.lineStyle(5, 0xffc25c, 1); g.strokeCircle(18, 18, 12); g.fillStyle(0xffffff, 0.8); g.fillCircle(13, 12, 3); });
      const o = s.add.image(0, 0, key).setDepth(8);
      const ring = s.add.circle(0, 0, Number(props.r ?? 150), 0xffc25c, 0).setStrokeStyle(2, 0xffc25c, 0.12).setDepth(3);
      return { obj: o, destroy: () => { o.destroy(); ring.destroy(); }, update: (v) => { o.setPosition(v.x, v.y).setScale(1 + 0.1 * Math.sin(v.t * 4)); ring.setPosition(v.x, v.y); } };
    }
    case 'platform': return simple(s.add.image(0, 0, platformTexture(s, biome, w, h)).setOrigin(0, 0).setDepth(5));
    case 'spike': { const ww = e.w ?? 32; return simple(s.add.image(0, 0, spikeTexture(s, biome, ww)).setOrigin(0, 1).setDepth(6)); }
    case 'hazard': {
      const kind = String(props.kind ?? 'gurultu');
      if (props.chase) {
        const key = tex(s, `isik-${w}x${h}`, w, h, (g) => { for (let i = 0; i < 6; i++) { g.fillStyle(0xfff6b0, 0.12 + i * 0.12); g.fillRoundedRect(i * w / 14, 0, w - i * w / 7, h, 20); } });
        return simple(s.add.image(0, 0, key).setOrigin(0, 0).setDepth(18));
      }
      const o = s.add.image(0, 0, hazardTexture(s, biome, w, h, kind)).setOrigin(0, 0).setDepth(7);
      const pulse = Number(props.on ?? 0) > 0;
      return simple(o, 0, 0, (v) => { if (pulse) { o.setTint(v.warn > 0 ? 0xff5c5c : 0xffffff); } if (props.dash) o.setTint(0xd6b8ff); });
    }
    case 'enemy': return enemyView(s, e);
    case 'powerup': {
      const kind = String(props.kind ?? 'shield'); const emo = kind === 'shield' ? '🦻' : kind === 'magnet' ? '🧲' : kind === 'life' ? '💚' : '💨';
      const o = s.add.image(0, 0, emojiTexture(s, `pw-${kind}`, emo, 44)).setDepth(9); return simple(o, 0, 0, (v) => o.setScale(1 + 0.1 * Math.sin(v.t * 6)));
    }
    case 'spring': return simple(s.add.image(0, 0, springTexture(s, p.accent)).setOrigin(0.5, 1).setDepth(6));
    case 'trampoline': {
      const key = roundRectTexture(s, `tramp-${w}`, w, 20, 0xff4f7a, 10); const o = s.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(6);
      return simple(o, 0, 0, (v) => o.setScale(1, v.on ? 0.55 : 1));
    }
    case 'checkpoint': {
      const o = s.add.image(0, 0, emojiTexture(s, 'flag', '🚩', 48)).setOrigin(0.5, 1).setDepth(6);
      return simple(o, 0, 0, (v) => o.setTint(v.on ? 0x8ef0b0 : 0xffffff));
    }
    case 'gate': return simple(s.add.image(0, 0, gateTexture(s, p.accent)).setOrigin(0.5, 1).setDepth(4));
    case 'escortee': return null; // eskort görünümü motor tarafından fısıltı olarak çizilir (createEscortView)
    case 'gear': { const r = Number(props.r ?? 40); const o = s.add.image(0, 0, gearTexture(s, r, 0x8a8f9e)).setDepth(7); return simple(o, 0, 0, (v) => o.setAngle(v.t * 160)); }
    case 'bubble': { const o = s.add.image(0, 0, bubbleTexture(s)).setDepth(13); return simple(o, 0, 0, (v) => o.setY(v.y - 6 * Math.sin(v.t * 3))); }
    case 'lane': return simple(s.add.image(0, 0, roundRectTexture(s, 'lane-obst', 52, 52, 0xff5c5c, 12)).setDepth(7));
    case 'text': {
      const t = s.add.text(0, 0, String(props.text ?? ''), { fontFamily: FONT, fontSize: '15px', fontStyle: '700', color: '#13162a', backgroundColor: 'rgba(255,255,255,0.8)', padding: { x: 10, y: 6 }, align: 'center', wordWrap: { width: 260 } }).setOrigin(0.5).setDepth(15);
      return simple(t);
    }
    case 'decor': {
      const key = decorTexture(s, biome, String(props.kind ?? 'ot')); if (!key) return null;
      const o = s.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(3).setScale(Number(props.scale ?? 1)).setAlpha(0.9);
      return simple(o, 0, 0, (v) => o.setAngle(Math.sin(v.t * 1.5 + e.x) * 4));
    }
    default: return null;
  }
}

function enemyView(s: Phaser.Scene, e: Entity): EntityView {
  const kind = String(e.props?.kind ?? 'devriye');
  const emo: Record<string, string> = { devriye: '🦠', bakteri: '🦠', ucan: '🪰', sinek: '🪰', atici: '👾', ziplayan: '🐸', kalkanli: '🦠' };
  const o = s.add.image(0, 0, emojiTexture(s, `enemy-${kind}`, emo[kind] ?? '👾', 44)).setOrigin(0.5, 1).setDepth(10);
  const ring = kind === 'kalkanli' ? s.add.circle(0, 0, 25, 0x5b8def, 0).setStrokeStyle(4, 0x5b8def, 0.9).setDepth(11) : null;
  const glow = s.add.circle(0, 0, 26, 0xff3b3b, 0.0).setDepth(9);
  return {
    obj: o, destroy: () => { o.destroy(); ring?.destroy(); glow.destroy(); },
    update: (v) => {
      o.setPosition(v.x, v.y).setVisible(v.visible).setFlipX(v.face > 0);
      // telegraf: atıcı ateş etmeden, zıplayan sıçramadan önce kırmızı nabız ve sıkışma
      o.setScale(1 + v.warn * 0.12, 1 - v.warn * 0.15);
      glow.setPosition(v.x, v.y - 20).setVisible(v.visible).setFillStyle(0xff3b3b, v.warn * 0.45);
      ring?.setPosition(v.x, v.y - 20).setVisible(v.visible);
    },
  };
}

// ---------------------------------------------------------------- mermiler
export interface ProjectileLayer { update(list: { x: number; y: number }[]): void; destroy(): void }
export function createProjectileLayer(s: Phaser.Scene): ProjectileLayer {
  const key = tex(s, 'mermi', 22, 22, (g) => { g.fillStyle(0xff3b6b, 0.35); g.fillCircle(11, 11, 11); g.fillStyle(0xff3b6b, 1); g.fillCircle(11, 11, 7); g.fillStyle(0xffffff, 0.8); g.fillCircle(9, 9, 2); });
  const pool: Phaser.GameObjects.Image[] = [];
  return {
    update: (list) => { while (pool.length < list.length) pool.push(s.add.image(0, 0, key).setDepth(16)); pool.forEach((o, i) => { const q = list[i]; o.setVisible(!!q); if (q) o.setPosition(q.x, q.y); }); },
    destroy: () => pool.forEach((o) => o.destroy()),
  };
}

// ---------------------------------------------------------------- kahraman
export interface HeroVisual {
  x: number; y: number; dir: 1 | -1; g: 1 | -1; t: number; grounded: boolean; sliding: boolean; gliding: boolean; dashing: boolean; pounding: boolean;
  hook: { x: number; y: number } | null; wall: boolean; water: boolean; invuln: boolean; shield: number; breath: number; breathMax: number; color: number; echo: boolean;
}
export interface HeroView { hero: Hero; update(h: HeroVisual): void; fx(kind: 'jump' | 'land' | 'hurt' | 'wow' | 'stomp'): void; destroy(): void }
export function createHeroView(s: Phaser.Scene, cosmetic: { color?: number; hat?: string } | undefined, x: number, y: number, defaultColor = 0x6c4cf1): HeroView {
  const hero = new Hero(s, x, y, cosmetic?.color ?? defaultColor, cosmetic?.hat);
  const halo = s.add.image(x, y, tex(s, 'hale', 120, 120, (g) => { for (let i = 10; i > 0; i--) { g.fillStyle(0xffffff, 0.025 * (11 - i)); g.fillCircle(60, 60, i * 6); } })).setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
  const wings = s.add.graphics().setDepth(19);
  const rope = s.add.graphics().setDepth(18);
  const trail = s.add.particles(0, 0, tex(s, 'iz', 10, 10, (g) => { g.fillStyle(0xffffff, 1); g.fillCircle(5, 5, 5); }), { speed: 10, lifespan: 260, scale: { start: 1.4, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: [0x4cf0ff, 0xffffff], emitting: false }).setDepth(18);
  const breathBar = s.add.rectangle(x, y, 40, 5, 0x2ee6d6, 1).setDepth(30).setOrigin(0.5);
  let squashT = 0; let sx = 1, sy = 1;
  return {
    hero,
    update: (h) => {
      const spr = hero.sprite;
      spr.setPosition(h.x, h.y);
      spr.setFlipY(h.g < 0); spr.setOrigin(0.5, h.g < 0 ? 0 : 1);
      spr.setFlipX(h.dir < 0);
      // ölçek: kayma, süzülme, çakılma, dinlenme
      let tx = 1, ty = 1;
      if (h.sliding) { tx = 1.15; ty = 0.5; } else if (h.pounding) { tx = 0.8; ty = 1.25; } else if (h.wall) { tx = 0.85; ty = 1.1; }
      if (squashT > 0) { squashT -= 1 / 60; } else { sx += (tx - sx) * 0.3; sy += (ty - sy) * 0.3; }
      spr.setScale(sx, sy); spr.setRotation(h.dashing ? h.dir * 0.25 : h.hook ? Math.atan2(h.hook.x - h.x, h.y - h.hook.y) * -0.5 : 0);
      spr.setAlpha(h.invuln ? (Math.floor(h.t * 12) % 2 ? 0.35 : 1) : 1);
      if (h.shield > 0) spr.setTint(0xbfe3ff); else spr.clearTint();
      const cy = h.g > 0 ? h.y - HERO_SIZE * 0.45 : h.y + HERO_SIZE * 0.45;
      halo.setPosition(h.x, cy).setAlpha(h.echo ? 0.9 : 0.5).setScale(h.echo ? 1.5 : 1);
      wings.clear();
      if (h.gliding) {
        wings.lineStyle(3, 0x4cf0ff, 0.9);
        for (let i = 0; i < 3; i++) { const r = 14 + i * 7 + Math.sin(h.t * 18 + i) * 2; wings.beginPath(); wings.arc(h.x - 14, cy - 4, r, Math.PI * 0.9, Math.PI * 1.35); wings.strokePath(); wings.beginPath(); wings.arc(h.x + 14, cy - 4, r, Math.PI * 1.65, Math.PI * 2.1); wings.strokePath(); }
      }
      rope.clear(); if (h.hook) { rope.lineStyle(3, 0xffc25c, 1); rope.beginPath(); rope.moveTo(h.hook.x, h.hook.y); rope.lineTo(h.x, cy); rope.strokePath(); }
      if (h.dashing) trail.emitParticleAt(h.x - h.dir * 10, cy, 2);
      breathBar.setVisible(h.water && h.breath < h.breathMax - 0.05).setPosition(h.x, cy - 40).setSize(40 * Math.max(0, h.breath / h.breathMax), 5).setFillStyle(h.breath < 2 ? 0xff5c5c : 0x2ee6d6);
    },
    fx: (k) => {
      if (k === 'jump') { sx = 0.8; sy = 1.25; squashT = 0.08; }
      else if (k === 'land') { sx = 1.25; sy = 0.78; squashT = 0.07; }
      else if (k === 'hurt') hero.mood('hurt', 700);
      else if (k === 'wow' || k === 'stomp') hero.mood('wow', 350);
    },
    destroy: () => { halo.destroy(); wings.destroy(); rope.destroy(); trail.destroy(); breathBar.destroy(); },
  };
}

/** eskort edilen fısıltı */
export function createEscortView(s: Phaser.Scene): { update(x: number, y: number, alive: boolean): void } {
  const o = s.add.image(0, 0, emojiTexture(s, 'escortee', '💬', 40)).setDepth(19);
  return { update: (x, y, alive) => { o.setPosition(x, y); o.setTint(alive ? 0xffffff : 0x888888); o.setAlpha(alive ? 1 : 0.5); } };
}

// ---------------------------------------------------------------- HUD
export interface HudSnapshot { notes: number; notesTotal: number; cochleas: number; cochleasTotal: number; lives: number; pct: number; score: number; shield: number }
export interface LevelHudView { update(h: HudSnapshot): void; pulse(kind: 'note' | 'cochlea' | 'life'): void; setTitle(t: string): void }
export function createHud(s: Phaser.Scene, info: { title: string; objective: string; top?: number }): LevelHudView {
  const top = info.top ?? 0;
  const bg = s.add.graphics().setScrollFactor(0).setDepth(100);
  bg.fillStyle(0x0d1024, 0.62); bg.fillRoundedRect(8, 8 + top, GAME_W - 16, 50, 18); bg.lineStyle(1.5, 0xffd27a, 0.55); bg.strokeRoundedRect(8, 8 + top, GAME_W - 16, 50, 18);
  const noteIcon = s.add.image(30, 33 + top, noteGlyph(s, 'nota-altin', 0xffb800, 32)).setScrollFactor(0).setDepth(101).setScale(0.8);
  const notes = s.add.text(48, 33 + top, '0', { fontFamily: FONT, fontSize: '20px', fontStyle: '800', color: '#ffd27a' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
  const slots: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 3; i++) slots.push(s.add.image(GAME_W / 2 - 28 + i * 28, 33 + top, cochleaTex(s)).setScale(0.5).setScrollFactor(0).setDepth(101).setAlpha(0.25).setTint(0x777777));
  const lives = s.add.text(GAME_W - 22, 33 + top, '', { fontFamily: FONT, fontSize: '18px' }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(101);
  const barBg = s.add.rectangle(20, 64 + top, GAME_W - 40, 4, 0xffffff, 0.18).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
  const bar = s.add.rectangle(20, 64 + top, 0, 4, 0xffd27a, 1).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
  const title = s.add.text(GAME_W / 2, 78 + top, info.title || ' ', { fontFamily: FONT, fontSize: '12px', fontStyle: '700', color: '#ffffff', backgroundColor: 'rgba(13,16,36,0.45)', padding: { x: 8, y: 2 } }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101).setVisible(!!info.title);
  void barBg;
  let last: HudSnapshot | null = null;
  return {
    update: (h) => {
      if (last && last.notes === h.notes && last.lives === h.lives && last.cochleas === h.cochleas && Math.abs(last.pct - h.pct) < 0.002 && last.shield === h.shield) return;
      notes.setText(h.notesTotal ? `${h.notes}/${h.notesTotal}` : `${h.notes}`);
      slots.forEach((o, i) => { const got = i < h.cochleas; o.setVisible(i < Math.max(h.cochleasTotal, 0)); o.setAlpha(got ? 1 : 0.25); if (got) o.clearTint(); else o.setTint(0x777777); });
      lives.setText('❤️'.repeat(Math.max(0, h.lives)) + (h.shield > 0 ? ' 🛡️' : ''));
      bar.width = (GAME_W - 40) * Math.max(0, Math.min(1, h.pct));
      last = { ...h };
    },
    pulse: (k) => {
      const t = k === 'note' ? noteIcon : k === 'cochlea' ? slots.find((o) => o.alpha === 1 && !o.isTinted) ?? slots[0]! : lives;
      const base = k === 'note' ? 0.8 : k === 'cochlea' ? 0.5 : 1;
      s.tweens.killTweensOf(t); t.setScale(base); s.tweens.add({ targets: t, scale: base * 1.35, duration: 90, yoyo: true });
    },
    setTitle: (t) => title.setText(t),
  };
}

// ---------------------------------------------------------------- boss
export interface BossVisual {
  kind: 'golem' | 'canavar'; name: string; hp: number; maxHp: number; phase: number; defeated: boolean; mode: string; t: number;
  fists: { x: number; st: string; t0: number; until: number }[]; balls: { x: number }[]; drops: { x: number; t0: number }[];
  waves: { x: number; kind: 'low' | 'high' }[]; warnWall: { side: -1 | 1; kind: string } | null; notes: { x: number; y: number; got: boolean }[]; core: { x: number } | null;
}
export interface BossView { update(b: BossVisual, groundY: number): void; destroy(): void }
export function createBossView(s: Phaser.Scene, kind: 'golem' | 'canavar', name: string, groundY: number): BossView {
  const bodyKey = kind === 'golem' ? tex(s, 'boss-golem2', 200, 210, (g) => {
    g.fillStyle(0xb8903d, 1); g.fillEllipse(100, 130, 180, 150); g.fillStyle(0xd4b25a, 1); g.fillCircle(100, 64, 58);
    g.fillStyle(0xffffff, 1); g.fillCircle(78, 60, 13); g.fillCircle(122, 60, 13); g.fillStyle(0x13162a, 1); g.fillCircle(80, 62, 6); g.fillCircle(120, 62, 6);
    g.lineStyle(6, 0x6b3a1a, 1); g.beginPath(); g.moveTo(60, 40); g.lineTo(90, 50); g.moveTo(140, 40); g.lineTo(110, 50); g.strokePath();
    g.fillStyle(0x9c6b2f, 1); g.fillCircle(60, 150, 12); g.fillCircle(140, 160, 10); g.fillCircle(100, 175, 8);
  }) : tex(s, 'boss-canavar2', 220, 190, (g) => {
    g.fillStyle(0x2a163a, 1); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.fillTriangle(110 + Math.cos(a - 0.15) * 70, 95 + Math.sin(a - 0.15) * 62, 110 + Math.cos(a + 0.15) * 70, 95 + Math.sin(a + 0.15) * 62, 110 + Math.cos(a) * 100, 95 + Math.sin(a) * 88); }
    g.fillStyle(0x4a2a6a, 1); g.fillCircle(110, 95, 70); g.fillStyle(0xff4fd8, 1); g.fillCircle(84, 80, 14); g.fillCircle(136, 80, 14); g.fillStyle(0x000000, 1); g.fillCircle(86, 82, 6); g.fillCircle(134, 82, 6);
    g.fillStyle(0x1a0208, 1); g.fillEllipse(110, 125, 80, 34); g.fillStyle(0xffffff, 1); for (let i = 0; i < 5; i++) g.fillTriangle(78 + i * 15, 110, 90 + i * 15, 110, 84 + i * 15, 122);
  });
  const body = s.add.image(195, kind === 'golem' ? groundY - 330 : groundY - 360, bodyKey).setDepth(3).setScrollFactor(1);
  const fistKey = tex(s, 'boss-fist2', 80, 64, (g) => { g.fillStyle(0xb8903d, 1); g.fillRoundedRect(0, 0, 80, 64, 20); g.fillStyle(0xd4b25a, 1); for (let i = 0; i < 4; i++) g.fillCircle(12 + i * 19, 10, 9); g.fillStyle(0xffe066, 1); g.fillCircle(40, 30, 9); });
  const shadowKey = tex(s, 'boss-shadow2', 100, 24, (g) => { g.fillStyle(0x000000, 0.35); g.fillEllipse(50, 12, 96, 22); g.fillStyle(0xe5484d, 0.7); g.fillEllipse(50, 12, 60, 12); });
  const ballKey = tex(s, 'boss-ball2', 36, 36, (g) => { g.fillStyle(0xc9a24a, 1); g.fillCircle(18, 18, 17); g.lineStyle(4, 0x8a5a28, 1); g.beginPath(); g.arc(18, 18, 9, 0, Math.PI * 1.5); g.strokePath(); });
  const dropKey = tex(s, 'boss-drop2', 44, 36, (g) => { g.fillStyle(kind === 'golem' ? 0xc9a24a : 0x6b7280, 1); g.fillEllipse(22, 18, 44, 34); });
  const waveKey = (k: string) => tex(s, `boss-wave2-${k}`, 26, k === 'low' ? 30 : 52, (g) => { g.fillStyle(k === 'low' ? 0xff5c5c : 0xc44dff, 0.9); g.fillRoundedRect(0, 0, 26, k === 'low' ? 30 : 52, 6); g.lineStyle(3, 0xffffff, 0.85); g.beginPath(); g.moveTo(13, 2); g.lineTo(5, 10); g.lineTo(20, 18); g.lineTo(6, 26); g.strokePath(); });
  const noteKey = noteGlyph(s, 'nota-boss', 0x4cf0ff, 40);
  const coreKey = tex(s, 'boss-core', 70, 70, (g) => { g.fillStyle(0xff4fd8, 0.35); g.fillCircle(35, 35, 35); g.fillStyle(0xff4fd8, 1); g.fillCircle(35, 35, 22); g.fillStyle(0xffffff, 0.8); g.fillCircle(28, 28, 6); });
  const pool = new Map<string, Phaser.GameObjects.Image[]>();
  const use = (key: string, n: number, depth = 12) => { const arr = pool.get(key) ?? []; while (arr.length < n) arr.push(s.add.image(0, 0, key).setDepth(depth)); pool.set(key, arr); arr.forEach((o, i) => o.setVisible(i < n)); return arr.slice(0, n); };
  const wallGlow = s.add.rectangle(0, groundY - 150, 30, 300, 0xff3b3b, 0).setDepth(14);
  const bar = s.add.graphics().setScrollFactor(0).setDepth(102);
  const nameText = s.add.text(GAME_W / 2, 92, '', { fontFamily: FONT, fontSize: '12px', fontStyle: '800', color: '#ffffff', backgroundColor: 'rgba(13,16,36,0.6)', padding: { x: 8, y: 2 } }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
  let shownHp = -1;
  return {
    update: (b, gy) => {
      body.setScale(1 + 0.03 * Math.sin(b.t * 2), 1 - 0.03 * Math.sin(b.t * 2)).setTint(b.mode === 'stun' ? 0x9ad0ff : b.phase === 3 ? 0xff9a8a : b.phase === 2 ? 0xffc8a8 : 0xffffff);
      if (b.defeated) body.setAlpha(Math.max(0, body.alpha - 0.02)).setAngle(body.angle + 3);
      const fists = use(fistKey, b.fists.length); const shadows = use(shadowKey, b.fists.filter((f) => f.st === 'warn').length, 6);
      let si = 0;
      b.fists.forEach((f, i) => {
        const o = fists[i]!; o.setOrigin(0.5, 1);
        const y = f.st === 'warn' ? gy - 320 + Math.sin(b.t * 20) * 4 : f.st === 'slam' ? gy - 160 : f.st === 'up' ? gy - 40 - (b.t - (f.until - 0.3)) * 400 : gy;
        o.setPosition(f.x, y); o.setTint(f.st === 'planted' ? 0xffffff : 0xdddddd);
        if (f.st === 'warn') { const sh = shadows[si++]!; sh.setPosition(f.x, gy - 2).setScale(1 + 0.15 * Math.sin(b.t * 25), 1); }
      });
      use(ballKey, b.balls.length).forEach((o, i) => { const q = b.balls[i]!; o.setPosition(q.x, gy - 17).setAngle(q.x * 3); });
      use(dropKey, b.drops.length, 15).forEach((o, i) => { const d = b.drops[i]!; const age = b.t - d.t0; const y = age < 0.8 ? gy - 330 : gy - 330 + (age - 0.8) / 0.3 * 330; o.setPosition(d.x, y); });
      const dshadow = use(shadowKey + '-d', 0); void dshadow;
      const lows = b.waves.filter((w) => w.kind === 'low'), highs = b.waves.filter((w) => w.kind === 'high');
      use(waveKey('low'), lows.length).forEach((o, i) => o.setPosition(lows[i]!.x, gy - 15));
      use(waveKey('high'), highs.length).forEach((o, i) => o.setPosition(highs[i]!.x, gy - 52));
      const notes = b.notes.filter((n) => !n.got); use(noteKey, notes.length, 16).forEach((o, i) => o.setPosition(notes[i]!.x, notes[i]!.y + Math.sin(b.t * 5 + i) * 5));
      use(coreKey, b.core ? 1 : 0, 16).forEach((o) => o.setPosition(b.core!.x, gy - 40).setScale(1 + 0.12 * Math.sin(b.t * 10)));
      if (b.warnWall) wallGlow.setPosition(b.warnWall.side > 0 ? 375 : 15, gy - 150).setFillStyle(b.warnWall.kind === 'high' ? 0xc44dff : 0xff3b3b, 0.25 + 0.25 * Math.abs(Math.sin(b.t * 16)));
      else wallGlow.setFillStyle(0xff3b3b, 0);
      if (shownHp !== b.hp) {
        shownHp = b.hp; const x0 = GAME_W / 2 - 120, y0 = 104, w = 240, h = 12; bar.clear();
        bar.fillStyle(0x0d1024, 0.6); bar.fillRoundedRect(x0, y0, w, h, 6);
        const ratio = Math.max(0, b.hp / b.maxHp); if (ratio > 0) { bar.fillStyle(b.phase === 3 ? 0xb3122e : b.phase === 2 ? 0xe5484d : 0xf0567a, 1); bar.fillRoundedRect(x0 + 2, y0 + 2, Math.max(8, (w - 4) * ratio), h - 4, 4); }
        bar.lineStyle(1.5, 0xffd27a, 0.8); bar.strokeRoundedRect(x0, y0, w, h, 6);
        nameText.setText(b.defeated ? `${name} · Yenildi!` : `${name} · Faz ${b.phase}`);
      }
    },
    destroy: () => { body.destroy(); for (const a of pool.values()) a.forEach((o) => o.destroy()); bar.destroy(); nameText.destroy(); wallGlow.destroy(); },
  };
}

/** Şanslı Nota parıltısı (bir notanın üstünde) */
export function luckyGlow(s: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  const o = s.add.image(x, y, luckyNoteTexture(s)).setDepth(16);
  s.tweens.add({ targets: o, scale: 1.18, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
  return o;
}
