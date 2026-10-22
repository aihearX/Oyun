import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ABILITY_ORDER, PATOLOJILER, PATOLOJI_IDS, tutorialKey } from '@odi/content';

// ses motoru: her kayıt elle bitirilen sahte bir çalma
const plays: { file: number; end(): void; stopped: boolean }[] = [];
vi.mock('@odi/audio', () => ({
  audio: {
    unlock: () => undefined,
    running: () => true,
    decode: async () => ({ duration: 3 }),
    voice: () => {
      let end!: () => void; const done = new Promise<void>((r) => { end = r; });
      const p = { file: plays.length, end: () => end(), stopped: false };
      plays.push(p);
      return { done, stop: () => { p.stopped = true; end(); } };
    },
    duck: () => undefined,
  },
}));

const { installPlatform } = await import('../platform');
const { useStore } = await import('../store');
const { textHash } = await import('./script');
const { speakLine, speakWhenFree, stopVoice, voiceBusy, resetVoiceManifest, voiceRequests } = await import('./voice');
const { sayPathology, pathologyLineId } = await import('./pathology');
const { sayHint, hintLineId, isVoicedHint } = await import('./hints');
const { lineText } = await import('./script');
const { FRESH_FTUE, normalizeFtue } = await import('./features');

const lines: Record<string, { file: string; hash: string }> = {};
const add = (id: string, text: string) => { lines[id] = { file: `${id}.mp3`, hash: textHash(text) }; };
add('a', 'Birinci satır.'); add('b', 'İkinci satır.'); add('c', 'Üçüncü satır.');
for (const k of PATOLOJI_IDS) add(pathologyLineId(k), PATOLOJILER[k].sade);
for (const h of ['tazele-kayma', 'perde-kay', ...ABILITY_ORDER.map(tutorialKey)]) add(hintLineId(h), lineText(hintLineId(h)));
installPlatform({ voiceManifest: async () => JSON.stringify({ version: 1, lines }), voiceData: async () => 'AAAA', speak: async () => false, stopSpeaking: () => undefined });

const settle = () => new Promise((r) => setTimeout(r, 5));
const requests = voiceRequests;

describe('Tüy Dede: bölüm içi cümleler başka satırın üstüne binmez', () => {
  beforeEach(() => { stopVoice(); plays.length = 0; requests().length = 0; resetVoiceManifest(); useStore.setState({ sounds: true, narratorVoice: true }); });

  it('boştayken hemen söyler', async () => {
    speakWhenFree('Birinci satır.', 'a'); await settle();
    expect(plays.length).toBe(1); expect(voiceBusy()).toBe(true);
    plays[0]!.end(); await settle(); expect(voiceBusy()).toBe(false);
    expect(requests().map((r) => r.outcome)).toEqual(['hemen']);
  });

  it('süren satır bitince sıradaki başlar; süren satır kesilmez', async () => {
    speakLine('Birinci satır.', 'a'); await settle();
    speakWhenFree('İkinci satır.', 'b'); await settle();
    expect(plays.length).toBe(1); expect(plays[0]!.stopped).toBe(false);
    plays[0]!.end(); await settle();
    expect(plays.length).toBe(2);
    expect(requests().map((r) => `${r.id}:${r.outcome}`)).toEqual(['b:sırada', 'b:çalındı']);
  });

  it('çok bekleyen satır atlanır; sıra en çok iki satır tutar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      speakLine('Birinci satır.', 'a'); await settle();
      speakWhenFree('İkinci satır.', 'b', 1000);
      vi.setSystemTime(Date.now() + 2000);
      speakWhenFree('Üçüncü satır.', 'c', 1000);
      plays[0]!.end(); await settle();
      expect(requests().map((r) => `${r.id}:${r.outcome}`)).toEqual(['b:sırada', 'c:sırada', 'b:atlandı (eski)', 'c:çalındı']);
    } finally { vi.useRealTimers(); }
    stopVoice(); requests().length = 0;
    speakLine('Birinci satır.', 'a'); await settle();
    speakWhenFree('İkinci satır.', 'b'); speakWhenFree('Üçüncü satır.', 'c'); speakWhenFree('Birinci satır.', 'a');
    expect(requests().filter((r) => r.outcome === 'atlandı (sıra dolu)').map((r) => r.id)).toEqual(['b']);
  });

  it('ayar kapalıysa çalmaz; iptal sıradan çıkarır ya da susturur', async () => {
    useStore.setState({ narratorVoice: false });
    speakWhenFree('Birinci satır.', 'a'); await settle();
    expect(plays.length).toBe(0); expect(requests().at(-1)?.outcome).toBe('kapalı');
    useStore.setState({ narratorVoice: true });
    speakLine('Birinci satır.', 'a'); await settle();
    const t = speakWhenFree('İkinci satır.', 'b'); t.cancel();
    plays[0]!.end(); await settle();
    expect(plays.length).toBe(1);
    const u = speakWhenFree('İkinci satır.', 'b'); await settle();
    expect(plays.length).toBe(2); u.cancel(); expect(plays[1]!.stopped).toBe(true);
  });

  it('patoloji cümlesi kendi kaydıyla söylenir (pat-<kimlik>); bilinmeyen kimlik sessiz', async () => {
    sayPathology('serumen-tikaci'); await settle();
    expect(plays.length).toBe(1);
    expect(requests().at(-1)).toMatchObject({ id: 'pat-serumen-tikaci', outcome: 'hemen' });
    expect(sayPathology('yok-boyle')).toBeNull();
  });

  it('ipuçları: yalnız seçki, oyuncu başına bir kez, ayar kapalıysa işaretlenmez', async () => {
    useStore.setState({ ftue: { ...FRESH_FTUE } });
    for (const a of ABILITY_ORDER) expect(isVoicedHint(tutorialKey(a)), a).toBe(true);
    expect(isVoicedHint('giris')).toBe(false); expect(isVoicedHint('boss-bagir')).toBe(false); expect(isVoicedHint('patoloji:eksostoz')).toBe(false);
    expect(sayHint('giris')).toBeNull();
    useStore.setState({ narratorVoice: false });
    expect(sayHint('ogret-kayma')).toBeNull(); expect(useStore.getState().ftue.said ?? []).toEqual([]);
    useStore.setState({ narratorVoice: true });
    // 3. bölüm gibi: bölüm başında kayma satırı söylenmemiş → perde ipucu bu bölümde hiç seslenmez (işaretlenmez)
    const l3 = [] as string[];
    expect(sayHint('perde-kay', l3)).toBeNull();
    expect(sayHint('ogret-kayma', l3)).not.toBeNull(); await settle();
    expect(sayHint('perde-kay', l3)).toBeNull();
    expect(sayHint('ogret-kayma', l3)).toBeNull();
    stopVoice();
    // sonraki bölüm: kayma önceden söylendi → ilk perdede bir kez
    const l4 = [...(useStore.getState().ftue.said ?? [])];
    expect(sayHint('perde-kay', l4)).not.toBeNull(); await settle();
    expect(sayHint('perde-kay', l4)).toBeNull();
    expect(useStore.getState().ftue.said).toEqual(['ipucu-ogret-kayma', 'ipucu-perde-kay']);
    expect(requests().filter((r) => r.id.startsWith('ipucu-')).map((r) => `${r.id}:${r.outcome}`)).toEqual(['ipucu-ogret-kayma:hemen', 'ipucu-perde-kay:hemen']);
    // kayıtta kalır
    expect(normalizeFtue(JSON.parse(JSON.stringify(useStore.getState().ftue)), {}).said).toEqual(['ipucu-ogret-kayma', 'ipucu-perde-kay']);
  });
});
