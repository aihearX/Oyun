// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const spoken: (string | undefined)[] = [];
vi.mock('./voice', () => ({ speakLine: (_t: string, id?: string) => { spoken.push(id); return spoken.length; }, stopVoice: () => undefined, stopVoiceIf: () => undefined, prefetchLines: () => undefined, speakWhenFree: () => ({ cancel() {} }) }));
vi.mock('@odi/audio', () => ({ audio: { play: () => undefined } }));

/**
 * İnşaat sırası (MK-011): "Sıraya al" düğmesi ilk kez görününce Tüy Dede'nin `kamp-sira-01` satırı OYUNCU BAŞINA BİR KEZ yazılır ve
 * söylenir (bina paneli ya da liste). Kayıt FTUE `said` alanında: yeniden açılışta kalır, Sıfırla siler. Tur sürerken araya girmez.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { useStore } = await import('../store');
const { useCoach } = await import('./Coach');
const { FRESH_FTUE, normalizeFtue } = await import('./features');
const { lineText } = await import('./script');
const { SiraIpucu, SIRA_LINE } = await import('../camp/SiraIpucu');

let root: Root | null = null;
const mount = async (on: boolean) => {
  const el = document.createElement('div'); document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => root!.render(createElement(SiraIpucu, { on })));
};
const rerender = async (on: boolean) => act(async () => root!.render(createElement(SiraIpucu, { on })));
const unmount = async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ''; };
const cards = () => document.querySelectorAll('[data-testid="sira-ipucu"]').length;

describe('Tüy Dede: inşaat sırası satırı (kamp-sira-01)', () => {
  beforeEach(() => { spoken.length = 0; useStore.setState({ ftue: { ...FRESH_FTUE } }); useCoach.setState({ tour: null, step: 0 }); });
  afterEach(unmount);

  it('satır tanımlı, onaylı metin', () => {
    expect(SIRA_LINE).toBe('kamp-sira-01');
    expect(lineText(SIRA_LINE)).toBe('Yapı ustası tek elle iki iş tutmaz ama sırayı bilir: bir sonrakini şimdi seç, bedelini öde; bu bitince kendiliğinden başlar. Vazgeçersen jetonun geri gelir.');
  });

  it('düğme ilk kez görününce bir kez gelir; panel yeniden açılınca ve yeniden yüklemede bir daha gelmez', async () => {
    await mount(false);
    expect(cards()).toBe(0); expect(useStore.getState().ftue.said ?? []).toEqual([]);
    await rerender(true);
    expect(cards()).toBe(1); expect(spoken).toEqual([SIRA_LINE]);
    expect(document.querySelector('[data-testid="sira-ipucu"] .en-plain')?.textContent).toBe(lineText(SIRA_LINE));
    expect(useStore.getState().ftue.said).toEqual([SIRA_LINE]);
    // aynı panelde düğme kaybolup gelse de (sıraya al / çıkar) ikinci kez söylenmez
    await rerender(false); await rerender(true);
    expect(cards()).toBe(1); expect(spoken).toEqual([SIRA_LINE]);
    // panel kapanıp başka bir binanın paneli (ya da liste) açılınca: yok
    await unmount(); await mount(true);
    expect(cards()).toBe(0); expect(spoken).toEqual([SIRA_LINE]);
    // yeniden yükleme: kayıt kalıcı (normalizeFtue: kalıcı kayıttan okuma)
    await unmount();
    useStore.setState({ ftue: normalizeFtue(JSON.parse(JSON.stringify(useStore.getState().ftue)), {}) });
    await mount(true);
    expect(cards()).toBe(0); expect(spoken).toEqual([SIRA_LINE]);
  });

  it('Sıfırla sonrası (taze FTUE kaydı) yeniden bir kez gelir', async () => {
    await mount(true); expect(cards()).toBe(1); await unmount();
    useStore.setState({ ftue: normalizeFtue(undefined, {}) });
    expect(useStore.getState().ftue.said ?? []).toEqual([]);
    await mount(true); expect(cards()).toBe(1); expect(spoken).toEqual([SIRA_LINE, SIRA_LINE]);
  });

  it('anlatıcı turu sürerken araya girmez; tur bitince düğme hâlâ görünüyorsa gelir', async () => {
    useCoach.setState({ tour: { id: 'gorev', steps: [] }, step: 0 });
    await mount(true);
    expect(cards()).toBe(0); expect(spoken).toEqual([]); expect(useStore.getState().ftue.said ?? []).toEqual([]);
    await act(async () => { useCoach.setState({ tour: null, step: 0 }); });
    expect(cards()).toBe(1); expect(spoken).toEqual([SIRA_LINE]);
  });

  it('kapatılınca o panelde de kaybolur', async () => {
    await mount(true);
    await act(async () => (document.querySelector('[data-testid="sira-ipucu"] .en-x') as HTMLButtonElement).click());
    expect(cards()).toBe(0); expect(useStore.getState().ftue.said).toEqual([SIRA_LINE]);
  });
});
