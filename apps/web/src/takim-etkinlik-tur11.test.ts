// Takım etkinlikleri, tur 11 (YN-193, YN-194, YN-107 kalanı): ralli bölüm içinde yenilince, Bayrak'ta bugünkü takım, Geri, devret listesi.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NetError } from '@odi/net';
import { DELETED_PLAYER_NAME, type RallyState, type RelayState } from '@odi/shared';
import { relayTeamBestLine, relayTeamLegs } from './events/bayrak';
import { RALLY_LATE_RUN, RALLY_WON_EXIT, rallyAlreadyWon, rallyWonWhilePlaying } from './events/ralli-bolum';
import { byPresence, seenLine } from './events/Call';
import { eventBackTo } from './nav';
import { RelayView } from './events/Relay';

vi.mock('./events/store', () => ({ useEvents: (sel: (s: { relay: RelayState }) => unknown) => sel({ relay }), evNet: () => null, srvNow: () => Date.now() }));

const relay = vi.hoisted(() => ({
  period: { key: 'B1', startsAt: 0, endsAt: Date.now() + 86_400_000 },
  legs: [
    { index: 0, level: 3, salt: 7, best: { id: 'x', name: 'Silinmiş Oyuncu', timeSec: 40 }, firstBy: { id: 'x', name: 'Silinmiş Oyuncu' }, teamBest: { id: 'p2', name: 'Bora', timeSec: 47.5 } },
    { index: 1, level: 9, salt: 7, best: { id: 'x', name: 'Silinmiş Oyuncu', timeSec: 41 }, firstBy: { id: 'x', name: 'Silinmiş Oyuncu' }, teamBest: null },
    { index: 2, level: 13, salt: 7, best: { id: 'p1', name: 'Ayşe', timeSec: 42 }, firstBy: { id: 'p1', name: 'Ayşe' }, teamBest: { id: 'p1', name: 'Ayşe', timeSec: 42 } },
    { index: 3, level: 21, salt: 7, best: null, firstBy: null, teamBest: null },
  ],
  current: 3, carrier: null, lastRunner: { id: 'p1', name: 'Ayşe' }, totalSec: null, ranking: [], history: [],
  rewards: { finish: [], podium: [] },
}) as unknown as RelayState);

const rally = (status: RallyState['status'], id = 'r1') => ({ id, status }) as RallyState;

describe('Ralli: bölüm sürerken canavar yenildi (YN-193, OT-takim-kaptani-34)', () => {
  it('yalnız oynanan ralli kazanılınca şerit', () => {
    expect(rallyWonWhilePlaying(rally('kazanildi'), 'r1')).toBe(true);
    expect(rallyWonWhilePlaying(rally('acik'), 'r1')).toBe(false);
    expect(rallyWonWhilePlaying(rally('kazanildi', 'r2'), 'r1')).toBe(false); // takımın başka rallisi
    expect(rallyWonWhilePlaying(null, 'r1')).toBe(false);
  });
  it('bitirilen koşu reddedilince (BITTI) sonuç nedenini söyler; başka hatalar aynı yoldan', () => {
    expect(rallyAlreadyWon(new NetError('BITTI', 'Bu ralli zaten kazanıldı!'))).toBe(true);
    expect(rallyAlreadyWon(new NetError('SURE', 'Bu rallinin süresi doldu.'))).toBe(false);
    expect(rallyAlreadyWon(new Error('x'))).toBe(false);
    expect(RALLY_LATE_RUN.text).toBe('Bu koşu sayılmadı: canavar o sırada yenilmişti.');
    expect(RALLY_LATE_RUN.title).toBe('Canavar yenildi! Ralli kazanıldı');
    expect(RALLY_WON_EXIT.title).toBe('Canavar yenildi! Ralli kazanıldı');
  });
  it('şerit bölüm katmanında (game-core değil): EventLevel "Çık" düğmesi, yalnız bölüm sürerken', () => {
    const src = readFileSync(resolve(__dirname, 'events/EventLevel.tsx'), 'utf8');
    expect(src).toMatch(/rallyWon && running && \(/);
    expect(src).toContain('data-testid="ralli-bolum-cik"');
    expect(src).toContain('rallyAlreadyWon(e)) return RALLY_LATE_RUN');
  });
});

describe('Bayrak: bugünkü takım (YN-194, OT-rekabetci-43)', () => {
  it('rekor şimdiki üyede değilse takımdaki en iyi; rekor üyedeyse satır yok; eski sunucuda sahte satır yok', () => {
    expect(relayTeamBestLine(relay.legs[0]!)).toBe('Takımdaki en iyi: Bora 47,5 sn');
    expect(relayTeamBestLine(relay.legs[1]!)).toBe('Takımdaki en iyi: bugünkü üyelerden koşan yok');
    expect(relayTeamBestLine(relay.legs[2]!)).toBeNull();
    expect(relayTeamBestLine(relay.legs[3]!)).toBeNull();
    expect(relayTeamBestLine({ best: { id: 'x', name: DELETED_PLAYER_NAME, timeSec: 40 } })).toBeNull();
  });
  it('başlıkta bugünkü takımın koştuğu ayak sayısı', () => {
    expect(relayTeamLegs(relay.legs)).toBe(2);
    expect(relayTeamLegs([{ teamBest: null }, {}])).toBeNull(); // eski sunucu: alan yok
    const html = renderToStaticMarkup(createElement(RelayView, { onPlay: () => undefined }));
    expect(html).toContain('Bugünkü takımın koştuğu ayak: 2/4');
    expect(html).toMatch(/data-testid="bayrak-takimda-0"[^>]*>Takımdaki en iyi: Bora 47,5 sn</);
    expect(html).not.toContain('bayrak-takimda-2');
    // kural değişmedi: rekor ve silinmiş hesabın notu yerinde
    expect(html).toContain('Hesabı silinmiş bir oyuncunun süresi; parkurda sayılmaya devam eder.');
  });
});

describe('Bayrak devret listesi (YN-107, OT-takim-kaptani-16)', () => {
  it('çevrimiçi üstte, sonra en son görülen; satır "çevrimiçi" / "son görülme N dk önce"', () => {
    const now = 10_000_000;
    const list = [{ id: 'a', online: false, lastSeen: now - 3_600_000 * 5 }, { id: 'b', online: false, lastSeen: now - 120_000 }, { id: 'c', online: true, lastSeen: now - 9e6 }];
    expect(byPresence(list, (m) => m.online).map((m) => m.id)).toEqual(['c', 'b', 'a']);
    expect(seenLine(true, now - 9e6, now)).toBe('çevrimiçi');
    expect(seenLine(false, now - 120_000, now)).toBe('son görülme 2 dk önce');
    expect(seenLine(false, now - 3_600_000 * 5, now)).toBe('son görülme 5 sa önce');
  });
  it('devret penceresi çağırma pencereleriyle aynı sıralama ve yazıyı kullanır', () => {
    const src = readFileSync(resolve(__dirname, 'events/Relay.tsx'), 'utf8');
    expect(src).toContain('byPresence((team?.roster ?? []).filter((m) => m.id !== meId), isOn)');
    expect(src).toContain('seenLine(isOn(m), m.lastSeen, now)');
  });
});

describe('Etkinlik Geri (YN-107, OT-buyuk-yazi-59, OT-ogrenci-birinci-21)', () => {
  it('doğrudan açılan etkinlikte geldiği yere, merkezden açılanda merkeze', () => {
    expect(eventBackTo('bayrak', false)).toBe('geldigi-yer'); // Takım › Etkinlikler, Bugün, duyuru
    expect(eventBackTo('bayrak', true)).toBe('merkez');
    expect(eventBackTo('merkez', true)).toBe('geldigi-yer');
    expect(eventBackTo('merkez', false)).toBe('geldigi-yer');
  });
  it('koşu dönüşünde de korunur (App rotası fromHub taşır)', () => {
    const app = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');
    expect(app).toContain("setRoute({ name: 'eventLevel', spec, play: p, back: route.back, fromHub })");
    expect(app).toContain("setRoute({ name: 'events', view: kind, flash, back: route.back, fromHub: route.fromHub, key: Date.now() })");
  });
});

describe('Profil kartı lig adı (OT-eski-telefon-17)', () => {
  it('lig rozeti kesilmez, sığmazsa iki satır', () => {
    const css = readFileSync(resolve(__dirname, 'friends/friends.css'), 'utf8');
    expect(css).toMatch(/\.fr-badge\.lig b \{ white-space:normal; overflow:visible; text-overflow:clip;/);
    expect(readFileSync(resolve(__dirname, 'friends/ProfileCard.tsx'), 'utf8')).toContain('className="fr-badge lig"');
  });
});
