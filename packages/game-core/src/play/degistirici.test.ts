import { describe, expect, it } from 'vitest';
import { generateLevel } from '@odi/level-gen';
import { DEFAULT_SKILLS, MODIFIERS, modifierAnnounce, modifierNames } from '@odi/content';
import { GROUND_Y } from '@odi/shared';
import * as C from './consts';
import { NO_INPUT, step } from './sim';
import { press, setup, testSpec } from './testkit';
import { BOSS_CALM_S, INTRO_S, bossPhaseText, bossStrip } from './boss';

/**
 * YN-102 (OT-sessiz-oyuncu-12, OT-ilk-kez-oyun-23): değiştiricilerin yazısı oyunun gerçek davranışını söyler; değiştiricili her
 * bölümün bir duyurusu ve adı var; boss bölümünün alt şeridi giriş yazısından sonra Faz 1 talimatına geçer.
 */
const flat = () => [{ type: 'platform' as const, x: 0, y: GROUND_Y, w: 3000, h: 200 }];

describe('değiştirici açıklamaları kodla aynı', () => {
  it('Gecikme: açıklama girdi gecikmesini söyler ve sim dokunuşu tam o kadar geç işler', () => {
    const d = MODIFIERS.yanki.desc.replace(/\u00a0/g, ' ');
    expect(d).toContain(`${String(C.ECHO_DELAY_S).replace('.', ',')} sn geç`);
    expect(d).not.toMatch(/gölge/i);
    const jumpAt = (mods: ('yanki')[]) => {
      const { w, s } = setup(testSpec(flat(), { number: 30, modifiers: mods })); s.events = [];
      for (let i = 0; i < 30; i++) step(w, s, NO_INPUT); // yere otur
      const t0 = s.t; step(w, s, press({ down: true, pressed: true }));
      for (let i = 0; i < 40; i++) { if (s.events.some((e) => e.k === 'jump')) return s.t - t0; s.events.length = 0; step(w, s, press({ down: true })); }
      return -1;
    };
    const plain = jumpAt([]), echo = jumpAt(['yanki']);
    expect(plain).toBeGreaterThanOrEqual(0); expect(echo).toBeGreaterThan(0);
    expect(echo - plain).toBeCloseTo(C.ECHO_DELAY_S, 1);
  });
  it('Hız: açıklamadaki yüzde koşu hızı çarpanıyla aynı', () => {
    expect(MODIFIERS.hiz.desc).toContain(`%${Math.round((C.HIZ_K - 1) * 100)}`);
    const dist = (mods: ('hiz')[]) => { const { w, s } = setup(testSpec(flat(), { number: 30, modifiers: mods })); for (let i = 0; i < 30; i++) step(w, s, NO_INPUT); const x0 = s.hero.x; for (let i = 0; i < 60; i++) step(w, s, NO_INPUT); return s.hero.x - x0; };
    expect(dist(['hiz']) / dist([])).toBeCloseTo(C.HIZ_K, 1);
  });
  it('Gece ve Sis "ses dalgası" ya da "her şey" demez (görünen yalnız Odi\'nin çevresi)', () => {
    expect(MODIFIERS.gece.desc).toMatch(/Odi'nin çevresi/); expect(MODIFIERS.gece.desc).not.toMatch(/ses dalga/);
    expect(MODIFIERS.sis.desc).toMatch(/Odi'nin çevresi/);
    expect(MODIFIERS['cihaz-kapali'].desc).toMatch(/Ses yok/);
  });
});

describe('değiştiricili bölümlerin duyurusu ve adı', () => {
  it('her değiştiricili bölümde (1-40) her değiştiricinin "Ad: ne yapmalı" duyurusu ve sonuç satırı var', () => {
    let seen = 0;
    for (let n = 1; n <= 40; n++) {
      const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
      if (!spec.modifiers.length) continue; seen++;
      for (const m of spec.modifiers) { const a = modifierAnnounce(m); expect(a.startsWith(`${MODIFIERS[m].name}: `), `${n} ${m}`).toBe(true); expect(a.length).toBeLessThan(70); }
      expect(modifierNames(spec.modifiers)).toBe(spec.modifiers.map((m) => MODIFIERS[m].name).join(', '));
    }
    expect(seen).toBeGreaterThanOrEqual(8);
    expect(modifierAnnounce('yanki')).toBe('Gecikme: dokunuşun biraz geç işler, erken bas');
  });
});

describe('boss alt şeridi: her faz kendi talimatı', () => {
  it('giriş yazısı sürerken boss şeride karışmaz; sonra (≥ 4. sn) Faz 1 talimatı', () => {
    for (const n of [20, 40]) {
      const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS });
      const { w, s } = setup(spec); s.events = [];
      while (s.t < 4.05) { step(w, s, NO_INPUT); s.events.length = 0; }
      const b = s.boss!; expect(b.phase).toBe(1);
      expect(bossStrip(b, 1, true)).toBeNull();
      expect(bossStrip(b, INTRO_S - 0.01, true)).toBeNull();
      const at4 = bossStrip(b, s.t, !!spec.intro); expect(at4?.id).toBe('boss-faz-1'); expect(at4?.text).toMatch(/^Faz 1: /);
      // talimat ilk saldırı uyarısından önce ekranda (YN-091: ilk uyarı BOSS_CALM_S'den önce gelmez)
      expect(bossStrip(b, BOSS_CALM_S, true)?.id).toBe('boss-faz-1');
      expect(bossStrip({ ...b, phase: 2 }, s.t, true)).toBeNull();
    }
  });
  it('Faz 1 cümleleri motorun gerçek vuruş yolunu söyler; Faz 2/3 eskisi gibi', () => {
    const g1 = bossPhaseText('golem', 1); expect(g1).toMatch(/Gölge/); expect(g1).toMatch(/saplanınca üstüne zıpla, havada aşağı kaydır/);
    const c1 = bossPhaseText('canavar', 1); expect(c1).toMatch(/zıpla/); expect(c1).toMatch(/3 notayı topla/);
    expect(bossPhaseText('golem', 2)).toBe('Faz 2: Serumen topları! Üstlerinden zıpla');
    expect(bossPhaseText('golem', 3)).toBe('Faz 3: Çift yumruk ve damlalar!');
    expect(bossPhaseText('canavar', 2)).toBe('Faz 2: Yüksek dalgada kay · Bulutlara dikkat');
    expect(bossPhaseText('canavar', 3)).toBe('Faz 3: Çift dalga!');
  });
});
