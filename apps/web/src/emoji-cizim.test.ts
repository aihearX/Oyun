import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CHAT_REACTIONS, DM_REACTIONS, DM_STICKERS, TEAM_EMBLEMS } from '@odi/shared';
import { Art, artFor, artSvg, emblemArt, rich } from './ui/art';
import { REACTION_ART } from './comm/Cards';

const EMOJI = /\p{Extended_Pictographic}/u;

describe('Emoji kalıntıları tur 2 (YN-071, YN-060)', () => {
  it('özel mesaj tepkileri, çıkartmalar ve eski hızlı tepki emojileri çizimle eşleşir; 👋 el sallayan el', () => {
    for (const e of [...DM_REACTIONS, ...DM_STICKERS.map((s) => s.emoji), '👍', '❤️', '😂', '🔥', '👏', '💪', '🎉', '🙏', '😄']) expect(artFor(e), e).toBeTruthy();
    expect(artFor('👋')).toBe('hand');
    expect(CHAT_REACTIONS.every((r) => REACTION_ART[r])).toBe(true);
  });
  it('eski emoji iletisi (😂 🔥) balonda çizim olarak basılır, emoji glifi kalmaz', () => {
    const html = renderToStaticMarkup(createElement('span', null, rich('😂🔥', '1.6em')));
    expect(html).toContain('art-laugh'); expect(html).toContain('art-flame');
    expect(EMOJI.test(html)).toBe(false);
  });
  it('artSvg: degradeleri içeren bağımsız SVG (Phaser dokusu); camelCase özellik kalmaz, ikon aynı çizim', () => {
    for (const e of TEAM_EMBLEMS) {
      const svg = artSvg(emblemArt(e), 48);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"')).toBe(true);
      expect(svg).toContain('<linearGradient id="oa-gold"');
      expect(svg).not.toMatch(/strokeWidth|stopColor|strokeLinejoin|className/);
      expect(EMOJI.test(svg)).toBe(false);
      const dom = renderToStaticMarkup(createElement(Art, { name: emblemArt(e) }));
      const inner = dom.slice(dom.indexOf('>') + 1, dom.lastIndexOf('</svg>'));
      expect(svg, e).toContain(inner);
    }
  });
});
