import { describe, expect, it } from 'vitest';
import { bossTutorial, Tutorial } from './tutorial';
import type { BiomeBackdrop, LevelHudView } from './visuals';

/** öğretici an: ipuçları gizliyken (temiz çekim, `?ipucu=0`) el işareti ve yazı çizilmez; an (olay metni) sürer */
const fake = () => {
  const calls: string[] = [];
  const hud = { showHint: (k: string, t: string) => calls.push(`show:${k}:${t.split('\n')[0]}`), hideHint: () => calls.push('hide') } as unknown as LevelHudView;
  const backdrop = { setForegroundAlpha: (a: number) => calls.push(`fg:${a}`) } as unknown as BiomeBackdrop;
  return { calls, hud, backdrop };
};

describe('öğretici an ipucu görünürlüğü', () => {
  it('normal oyuncu: el işareti ve yazı görünür, bitince kalkar', () => {
    const f = fake(); const t = new Tutorial('don', 1, f.hud, f.backdrop);
    expect(f.calls).toEqual(['show:swipeLeft:Yeni: Geri Dön', 'fg:0.35']);
    t.done(); expect(f.calls.slice(2)).toEqual(['hide', 'fg:1']);
    t.done(); expect(f.calls).toHaveLength(4);
  });
  it('ipuçları gizli: hiçbir şey çizilmez, metin (kabuk olayı için) yine hazır', () => {
    const f = fake(); const t = new Tutorial('don', 1, f.hud, f.backdrop, undefined, false);
    t.done(); expect(f.calls).toEqual([]); expect(t.text).toMatch(/^Yeni: Geri Dön/);
  });
  it('an sürerken gizlenince görsel kalkar', () => {
    const f = fake(); const t = new Tutorial('kayma', 1, f.hud, f.backdrop); t.hide(); t.done();
    expect(f.calls.filter((c) => c === 'hide')).toHaveLength(1);
  });
});

describe('ilk canavar öğretici anı', () => {
  it('çakılma el işareti, vuruş yolunu söyleyen yazı; yalnız canavara vuruş "başardın" sayılır', () => {
    const f = fake(); const t = bossTutorial(f.hud, f.backdrop, true);
    expect(f.calls[0]).toBe('show:swipeDown:Zayıf nokta: parlayan yumruk');
    expect(t.text).toMatch(/zıpla, havada aşağı kaydır/);
    expect(t.boss).toBe(true); expect(t.success).toEqual(['bossHit']); expect(t.success).not.toContain('poundland');
    expect(new Tutorial('cakil', 1, f.hud).boss).toBe(false);
  });
});
