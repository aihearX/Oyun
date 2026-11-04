// @vitest-environment jsdom
// Oyuncu testi tur 10 (YN-175): Tüy Dede notları tekrar etmesin, biyom kartı kısa kalsın.
//  - Sonuç ekranının "Biliyor muydun?" satırı son gösterilenden farklı (kayıtta `bilgiSonlar`), biyomda başka satır varsa.
//  - Biyom kartında notun teknik satırı "Odyoloji öğrencisi" düzeyinde de kapalı başlar; öteki yerlerde düzeye göre açık.
//  - Biyomun ilk notu bölgenin görevini anlatan onaylı not (varsa); Kemikçikler'de otoskleroz ilk not değil.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HUMAN_JOURNEY } from '@odi/content';
import { BILIYOR_MUYDUN } from '@odi/content/biliyor-muydun';
import { EAR_NOTES } from '@odi/content/odyoloji';
import type { LevelSpec } from '@odi/shared';
import { NoteCard, pickBilgi, pickNote, useBiliyorMuydun } from './ftue/Notes';
import { BiomeIntro } from './screens/BiomeIntro';
import { migrateBilgiSon, useStore } from './store';
import { BILGI_YAKIN } from '@odi/content/biliyor-muydun';

vi.mock('./ftue/voice', () => ({ speakLine: () => -1, stopVoiceIf: () => undefined }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ciz = async (el: ReturnType<typeof createElement>) => {
  const h = document.createElement('div'); document.body.appendChild(h); const r = createRoot(h);
  await act(async () => { r.render(el); });
  const html = h.innerHTML; await act(async () => { r.unmount(); }); return html;
};
afterEach(() => { useStore.setState({ bilgiSonlar: [], notesSeen: [], noteAt: 0, knowledge: 'genel' }); document.body.innerHTML = ''; });

const biyom = (no: number) => HUMAN_JOURNEY.levels.find((l) => l.number === no)!.biome;
const spec = (number: number) => ({ number, biome: biyom(number), mechanic: HUMAN_JOURNEY.levels.find((l) => l.number === number)!.mechanic, abilities: [], newAbilities: [], objective: { id: 'reach', label: 'Kapıya ulaş' }, coinsTotal: 60 }) as unknown as LevelSpec;

describe('Biliyor muydun? son gösterilenden farklı (YN-175)', () => {
  it('Bölüm 13 tekrarı ve ardından Bölüm 14 ilk geçişi aynı satırı göstermez', async () => {
    const goster = async (bolum: number, tekrar: number) => {
      let out: string | null = null;
      const Kutu = () => { out = useBiliyorMuydun(bolum, 'odyoloji', tekrar); return null; };
      const h = document.createElement('div'); document.body.appendChild(h); const r = createRoot(h);
      await act(async () => { r.render(createElement(Kutu)); });
      await act(async () => { r.unmount(); });
      return out as string | null;
    };
    const a = await goster(13, 1); const b = await goster(14, 0);
    expect(a).toMatch(/İnkusun uzun kolu/);
    expect(b).not.toBe(a);
    expect(BILIYOR_MUYDUN.filter((x) => biyom(x.bolum) === 'kemikcikler').map((x) => x.odyoloji)).toContain(b);
    expect(useStore.getState().bilgiSonlar.at(-1)).not.toBe(14);
  });
  it('kayıtta son satır yoksa ya da başkasıysa kural aynı (ilk oynayışta bölümün kendi satırı)', () => {
    for (const x of BILIYOR_MUYDUN) {
      useStore.setState({ bilgiSonlar: [] }); expect(pickBilgi(x.bolum, 0)!.bolum).toBe(x.bolum);
      useStore.setState({ bilgiSonlar: [x.bolum] });
      const ayni = BILIYOR_MUYDUN.filter((y) => biyom(y.bolum) === biyom(x.bolum));
      if (ayni.length > 1) expect(pickBilgi(x.bolum, 0)!.bolum, `${x.bolum}`).not.toBe(x.bolum);
    }
  });
});

describe('Biliyor muydun? son gösterilenler listesi (YN-212)', () => {
  it('kayıt son BILGI_YAKIN satırı tutar; eski kayıttaki tek bilgiSon listeye taşınır', () => {
    expect(migrateBilgiSon({ bilgiSon: 24 })).toEqual([24]);
    expect(migrateBilgiSon({ bilgiSon: 0 })).toEqual([]);
    expect(migrateBilgiSon({})).toEqual([]);
    expect(migrateBilgiSon({ bilgiSonlar: [3, 'x', 24, 25, 26, -1], bilgiSon: 9 })).toEqual([24, 25, 26].slice(-BILGI_YAKIN));
    const st = useStore.getState();
    for (const n of [24, 25, 25, 26, 24]) st.bilgiGoruldu(n);
    expect(useStore.getState().bilgiSonlar).toEqual([25, 26, 24].slice(-BILGI_YAKIN));
  });
  it('24 → 25 → 26 tekrarı sonuç ekranlarında aynı satırı göstermez (kayıttan seçim)', () => {
    const goster = (bolum: number, tekrar: number) => { const s = pickBilgi(bolum, tekrar)!; useStore.getState().bilgiGoruldu(s.bolum); return s.genel; };
    for (const t26 of [0, 1, 2]) {
      useStore.setState({ bilgiSonlar: [] });
      const g = [goster(24, 0), goster(25, 0), goster(26, t26)];
      expect(new Set(g).size, `26/${t26}`).toBe(3);
    }
  });
});

describe('Biyom kartı: Tüy Dede notu kısa (YN-175)', () => {
  it('öğrenci düzeyinde biyom kartında teknik satır kapalı, "Daha fazla" düğmesi var', async () => {
    useStore.setState({ knowledge: 'odyoloji' });
    const html = await ciz(createElement(BiomeIntro, { spec: spec(13), onGo: () => undefined }));
    expect(html).toContain('data-testid="tuy-notu"');
    expect(html).not.toContain('ml-tech');
    expect(html).toMatch(/aria-expanded="false"[^>]*>Daha fazla/);
  });
  it('öteki yerlerde (sonuç, harita) öğrenci düzeyinde teknik satır açık gelir, genel düzeyde kapalı', async () => {
    useStore.setState({ knowledge: 'odyoloji' });
    expect(await ciz(createElement(NoteCard, { note: EAR_NOTES[0]!, voice: false }))).toContain('ml-tech');
    useStore.setState({ knowledge: 'genel' });
    expect(await ciz(createElement(NoteCard, { note: EAR_NOTES[0]!, voice: false }))).not.toContain('ml-tech');
  });
  it('biyomun ilk notu bölgenin görevini anlatan not; Kemikçikler otosklerozla başlamaz', () => {
    expect(pickNote('kemikcikler', 'biome', 13)!.id).not.toBe('otoskleroz');
    for (const seed of [13, 14, 15, 16]) expect(pickNote('kemikcikler', 'biome', seed)!.id).toBe('akustik-refleks');
    expect(pickNote('zar', 'biome', 9)!.id).toBe('empedans');
    expect(pickNote('koklea-2', 'biome', 21)!.id).toBe('prestin');
    // görüldüyse sıradaki görülmemiş not
    useStore.setState({ notesSeen: ['akustik-refleks'] });
    expect(pickNote('kemikcikler', 'biome', 13)!.id).toBe('otoskleroz');
  });
  it('biyom tanıtımında yalnız o yapıyı anlatan onaylı not: Apeks’te taban notu yok, Sinir’de tarama, Beyin Sapı’nda maskeleme yok (YN-122)', async () => {
    // presbiakuzi (önce ince sesler) tabanın notu: Koklea · Taban'da, Apeks'te değil
    expect(EAR_NOTES.find((n) => n.id === 'presbiakuzi')!.region).toBe('koklea-1');
    const tumu = EAR_NOTES.map((n) => n.id);
    for (const seen of [[], tumu]) {
      useStore.setState({ notesSeen: seen });
      // Apeks ve İşitme Siniri'ni anlatan onaylı not yok: not çıkmaz, kart biyomun onaylı bilgisini gösterir
      expect(pickNote('koklea-3', 'biome', 27)).toBeNull();
      expect(pickNote('sinir', 'biome', 31)).toBeNull();
      expect(pickNote('beyin-sapi', 'biome', 34)!.id).toBe('yon');
      expect(pickNote('koklea-1', 'biome', 21)!.id).toBe('dalga');
    }
    useStore.setState({ notesSeen: ['dalga'] });
    expect(pickNote('koklea-1', 'biome', 21)!.id).toBe('presbiakuzi');
    // Apeks kartı: Tüy Dede notu yerine biyomun onaylı bilgisi (alçak frekanslar), tabanın notu değil
    useStore.setState({ notesSeen: [] });
    const apeks = await ciz(createElement(BiomeIntro, { spec: spec(27), onGo: () => undefined }));
    expect(apeks).not.toContain('data-testid="tuy-notu"');
    expect(apeks).toContain('Apeks kalın');
    expect(apeks).not.toContain('ince seslerin');
    // hiçbir biyomda tanıtım notu başka bölgenin ya da bilinen yanlış eşleşmenin notu değil
    const yasak = ['presbiakuzi@koklea-3', 'gurultu-centik@koklea-3', 'ototoksik@koklea-3', 'implant@koklea-3', 'tarama@sinir', 'hl-spl@sinir', 'abr-not@sinir', 'maskeleme@beyin-sapi', 'rinne-weber@beyin-sapi'];
    for (const seen of [[], ['kepce-yon', 'kanal-rezonans', 'empedans', 'akustik-refleks', 'dalga', 'prestin', 'yon', 'kokteyl'], tumu]) {
      useStore.setState({ notesSeen: seen });
      for (const b of new Set(HUMAN_JOURNEY.levels.map((l) => l.biome))) {
        const n = pickNote(b, 'biome', 1);
        if (b === 'koklea-3' || b === 'sinir') { expect(n, b).toBeNull(); continue; }
        expect(n, b).not.toBeNull();
        expect(n!.region).toBe(b); expect(yasak).not.toContain(`${n!.id}@${b}`);
      }
    }
  });
});
