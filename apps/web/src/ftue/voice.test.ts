import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EAR_NOTES } from '../../../../packages/content/src/odyoloji';
import { NARRATOR_LINES, lineText, textHash } from './script';
import { isMaleVoice, pickTurkishVoice, ttsChunks, ttsParams, NARRATOR_TTS } from './voicePick';

const src = (f: string) => readFileSync(resolve(__dirname, f), 'utf8');

describe('Tüy Dede metinleri', () => {
  it('kimlikler eşsiz, metinler dolu ve Türkçe', () => {
    const ids = NARRATOR_LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of NARRATOR_LINES) { expect(l.text.length).toBeGreaterThan(8); expect(l.context).toBeTruthy(); expect(l.emotion).toBeTruthy(); expect(l.id).toMatch(/^[a-z0-9-]+$/); }
  });
  it('turlarda ve hikâyede kullanılan her kimlik tanımlı (yazım hatası yok)', () => {
    const used = new Set([...`${src('Director.tsx')}\n${src('Story.tsx')}`.matchAll(/'((?:hikaye|sonuc|harita|sekme|bugun|kamp|kamp-insa|arkadas|sozluk|takim|magaza|etkinlik|yaris)-[a-z0-9-]+)'/g)].map((m) => m[1]!));
    expect(used.size).toBeGreaterThan(30);
    for (const id of used) expect(() => lineText(id)).not.toThrow();
  });
  it('parmak izi kararlı ve boşluk farkını saymaz', () => {
    expect(textHash('Merhaba  dünya ')).toBe(textHash('Merhaba dünya'));
    expect(textHash('Merhaba dünya')).not.toBe(textHash('Merhaba dünya!'));
    expect(textHash('a')).toMatch(/^[0-9a-f]{8}$/);
  });
  it('gömülü ses listesi güncel metinlerle eşleşir (eski kayıt çalınmaz)', () => {
    const man = JSON.parse(readFileSync(resolve(__dirname, '../../public/voice/manifest.json'), 'utf8')) as { lines: Record<string, { file: string; hash: string }> };
    const textOf = (id: string) => (id.startsWith('not-') ? EAR_NOTES.find((n) => `not-${n.id}` === id)!.plain : lineText(id));
    for (const [id, e] of Object.entries(man.lines)) {
      expect(e.hash, id).toBe(textHash(textOf(id)));
      expect(e.file).toBe(`${id}.mp3`);
    }
  });
});

describe('cihaz sesi (TTS) seçimi', () => {
  it('erkek / yaşlı erkek Türkçe sesi kadın sese tercih eder', () => {
    const yelda = { name: 'Yelda', identifier: 'com.apple.voice.compact.tr-TR.Yelda', lang: 'tr-TR' };
    const tolga = { name: 'Microsoft Tolga - Turkish (Turkey)', lang: 'tr-TR' };
    const grandpa = { name: 'Grandpa (Turkish (Turkey))', identifier: 'com.apple.eloquence.tr-TR.Grandpa', lang: 'tr-TR' };
    const en = { name: 'Daniel', lang: 'en-GB' };
    expect(pickTurkishVoice([yelda, tolga, en])).toBe(tolga);
    expect(pickTurkishVoice([yelda, tolga, grandpa])).toBe(grandpa);
    expect(pickTurkishVoice([yelda, en])).toBe(yelda);
    expect(pickTurkishVoice([en])).toBeNull();
    expect(isMaleVoice(yelda)).toBe(false);
    expect(isMaleVoice(tolga)).toBe(true);
  });
  it('kadın seste perde düşer ve tempo yavaşlar; erkek seste daha az', () => {
    expect(ttsParams(false)).toEqual({ rate: NARRATOR_TTS.rate, pitch: NARRATOR_TTS.pitch });
    expect(NARRATOR_TTS.pitch).toBeLessThanOrEqual(0.8);
    expect(NARRATOR_TTS.rate).toBeLessThanOrEqual(0.9);
    expect(ttsParams(true).pitch).toBeGreaterThan(NARRATOR_TTS.pitch);
  });
  it('cümlelere böler (doğal nefes)', () => {
    expect(ttsChunks('Merhaba! Ben Tüy Dede, iç kulağın en yaşlı tüy hücresiyim. Seni bekliyordum.')).toEqual(['Merhaba!', 'Ben Tüy Dede, iç kulağın en yaşlı tüy hücresiyim.', 'Seni bekliyordum.']);
    expect(ttsChunks('Kısa')).toEqual(['Kısa']);
  });
});
