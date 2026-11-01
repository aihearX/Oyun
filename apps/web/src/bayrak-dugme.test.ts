// Bayrak Yarışı (OT-ilk-kez-oyun-21): parkur bitince her ayağın "Yeniden koş" düğmesi yazılı ve adlı; açıklama cümlesinde simge değil kelime.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RelayState } from '@odi/shared';
import { RelayView } from './events/Relay';

// sunucu çiziminde zustand ilk durumu okur: etkinlik deposu bu testin durumuyla değiştirilir
vi.mock('./events/store', () => ({ useEvents: (sel: (s: { relay: RelayState }) => unknown) => sel({ relay }), evNet: () => null, srvNow: () => Date.now() }));

const relay = vi.hoisted(() => ({
  period: { key: 'B1', startsAt: 0, endsAt: Date.now() + 86_400_000 },
  legs: [0, 1, 2, 3].map((i) => ({ index: i, level: 3 + i, salt: 7, best: { id: 'p1', name: 'Ayşe', timeSec: 40 + i }, firstBy: { id: 'p1', name: 'Ayşe' } })),
  current: 4, carrier: null, lastRunner: { id: 'p1', name: 'Ayşe' }, totalSec: 170, ranking: [], history: [],
  rewards: { finish: [], podium: [] },
}) as unknown as RelayState);

describe('Bayrak Yarışı: yeniden koşma düğmeleri', () => {
  it('her ayakta "Yeniden koş" yazılı, aria-label ayağı söyler; açıklamada simge yok', () => {
    const html = renderToStaticMarkup(createElement(RelayView, { onPlay: () => undefined }));
    const buttons = [...html.matchAll(/<button[^>]*data-testid="bayrak-yeniden-(\d)"[^>]*>(.*?)<\/button>/g)];
    expect(buttons).toHaveLength(4);
    for (const [tag, i, inner] of buttons) {
      expect(tag).toContain(`aria-label="${Number(i) + 1}. ayağı yeniden koş"`);
      expect(inner).toContain('Yeniden koş');
    }
    expect(html).toContain('“Yeniden koş” düğmesiyle o ayağı tekrar koş');
  });
});
