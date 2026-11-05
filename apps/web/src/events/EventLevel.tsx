import { useEffect, useRef, useState } from 'react';
import type { EventKind, LevelSpec, PlayerSkills, RunResult } from '@odi/shared';
import type { LevelOptions } from '@odi/game-core/lite';
import { DEFAULT_SKILLS, FIRSTS } from '@odi/content';
import { newRunId } from '@odi/net';
import { LevelHost } from '../screens/LevelHost';
import { useStore } from '../store';
import { applyOverview, evNet, useEvents } from './store';
import { errText, fmtSecs } from './common';
import { relayRunText } from './bayrak';
import './events.css';
import { RALLY_LATE_RUN, RALLY_WON_EXIT, rallyAlreadyWon, rallyHitText, rallyWonWhilePlaying, type RallyHitFlash } from './ralli-bolum';
import { useNet } from '@odi/net/store';

/** Bir etkinlik koşusu: hangi etkinliğe gönderileceği */
export type EventPlay = { kind: 'ralli'; rallyId: string } | { kind: 'bayrak'; leg: number } | { kind: 'meydan' } | { kind: 'turnuva'; slot: number };
/** koşudan sonra etkinlik ekranında gösterilen kısa sonuç */
export interface EventFlash { icon: string; title: string; text: string; tone: 'ok' | 'warn'; won?: boolean; /** ralli vuruşu: yazı canlı ralli durumundan (rallyHitText) */ rally?: RallyHitFlash }

/**
 * Yalnızca uçtan uca test derlemesi (VITE_ODI_E2E=1) + `?etkinlik-bot=1`: bölümü harness botu oynar.
 * Normal derlemede sabit false olur ve bu yol tamamen çıkarılır (üretimde etkisiz).
 */
/** yalnız test derlemesi (VITE_ODI_E2E=1 → vite define); Metro/mobil pakette tanımsız → kapalı */
declare const __ODI_E2E__: boolean | undefined;
const E2E = typeof __ODI_E2E__ !== 'undefined' && !!__ODI_E2E__;
const E2E_Q = E2E ? new URLSearchParams(location.search) : null;
export const EVENT_BOT = !!E2E_Q && E2E_Q.get('etkinlik-bot') === '1';
/**
 * test: oyuncu testi (`?oyun-bot=1[&oyun-hiz=N][&oyun-beceri=0..1[&oyun-tohum=N]]`, App.tsx ile aynı parametreler): etkinlik ayağını da
 * haritadaki bölüm gibi harness botu oynar, `oyun-beceri` verilince aynı insan eliyle (e2e/oyuncu-eli.ts; modül yalnız o zaman yüklenir).
 */
const PLAY_BOT = !!E2E_Q && E2E_Q.get('oyun-bot') === '1';
const BOT = EVENT_BOT || PLAY_BOT;
const BOT_SPEED = PLAY_BOT ? Math.min(4, Math.max(1, Number(E2E_Q!.get('oyun-hiz')) || 1)) : 1;
const BOT_HAND: Promise<LevelOptions['botHand']> | undefined = PLAY_BOT && E2E_Q!.has('oyun-beceri') && Number(E2E_Q!.get('oyun-beceri')) < 0.99
  ? import('../e2e/oyuncu-eli').then((m) => m.oyuncuEli(Number(E2E_Q!.get('oyun-beceri')), E2E_Q!.has('oyun-tohum') ? Number(E2E_Q!.get('oyun-tohum')) : null))
  : undefined;

/**
 * Bölüm içi öğretici anlar ve "ilk kez" anları (LevelOptions.firsts): süre/skor yarışmalı ayaklarda (Bayrak, Meydan Okuma, Turnuva)
 * hiç yok — herkes aynı koşulda, ağır çekimli öğretici süreye ve el işaretine girmez (YN-160); Ralli'de haritadaki gibi yalnız henüz
 * görülmemişler. Eskiden hiç verilmezdi: oyuncu haritada öğrendiği yeteneğin öğreticisini etkinlik ayağında yeniden görüyordu.
 */
function eventFirsts(play: EventPlay): string[] {
  if (play.kind !== 'ralli') return [];
  const seen = useStore.getState().meta.firsts;
  return Object.keys(FIRSTS).filter((f) => !seen.includes(f));
}

/** Mevcut LevelHost ile etkinlik bölümünü oynatır; bitince sonucu ilgili etkinliğe (runId ile idempotent) gönderir. */
export function EventLevel({ spec, play, onExit }: { spec: LevelSpec; play: EventPlay; onExit: (kind: EventKind, flash?: EventFlash) => void }) {
  const done = useRef(false);
  const [running, setRunning] = useState(true);
  const skills: PlayerSkills = play.kind === 'ralli' ? useStore.getState().skills : DEFAULT_SKILLS; // yarışmalı etkinliklerde herkes eşit
  // bölüm sürerken ralli kazanıldı (takım arkadaşının son darbesi, rally.updated yayını): bölüm içi şerit (YN-193, ralli-bolum.ts)
  const rallyWon = useEvents((s) => play.kind === 'ralli' && rallyWonWhilePlaying(s.rally, play.rallyId));
  const finish = (r: RunResult) => {
    if (done.current) return; done.current = true; setRunning(false);
    void submit(play, r).then((flash) => onExit(play.kind, flash));
  };
  const quitWon = () => { if (done.current) return; done.current = true; onExit(play.kind, RALLY_WON_EXIT); };
  // bot modunda LevelHost onDone çağırmaz: sonucu window.__odi'den al
  useEffect(() => {
    if (!BOT) return;
    const h = setInterval(() => { const o = window.__odi; if (o?.done && o.result && o.spec?.id === spec.id) { clearInterval(h); finish(o.result); } }, 250);
    return () => clearInterval(h);
  }, [spec.id]);
  return (
    <>
      <LevelHost key={spec.id + play.kind} spec={spec} skills={skills} sounds={!BOT && useStore.getState().sounds} bot={BOT} botHand={BOT_HAND} timeScale={BOT_SPEED > 1 ? BOT_SPEED : undefined} extras={{ firsts: eventFirsts(play) }} onDone={finish} onQuit={() => onExit(play.kind)} />
      {rallyWon && running && (
        <div className="ev-level-won" role="status" data-testid="ralli-bolum-yenildi">
          <span className="min0"><b>Canavar yenildi! Ralli kazanıldı</b><small>Bu koşu artık hasar yazmaz.</small></span>
          <button className="btn small" data-testid="ralli-bolum-cik" onClick={quitWon}>Çık</button>
        </div>
      )}
    </>
  );
}

async function submit(play: EventPlay, r: RunResult): Promise<EventFlash> {
  const c = evNet();
  if (!c) return { icon: '📡', title: 'Sunucu yok', text: 'Etkinlik sonucu gönderilemedi.', tone: 'warn' };
  const run = { runId: newRunId(), completed: r.completed, stars: r.completed ? r.stars : 0, score: Math.max(0, Math.min(50_000, Math.round(r.score))), timeSec: Math.max(5, Math.min(3600, Math.round(r.timeSec * 10) / 10)) };
  try {
    switch (play.kind) {
      case 'ralli': {
        const x = await c.call('rally.hit', { rallyId: play.rallyId, ...run });
        useEvents.setState({ rally: x.rally });
        if (x.rally.status === 'kazanildi') return { icon: '🏆', title: 'Canavar yenildi!', text: `Son darbe senden: −${x.damage} can`, tone: 'ok', won: true };
        const me = useNet.getState().me?.id ?? '';
        const mine = x.rally.hits.find((h) => h.id === me);
        const rally: RallyHitFlash = { id: x.rally.id, me, at: mine?.at ?? Date.now(), hp: x.rally.hp, lead: run.completed ? `${run.stars} yıldızla vurdun.` : 'Bölüm yarım kaldı ama yine de vurdun.' };
        return { icon: run.completed ? '💥' : '🩹', title: `−${x.damage} hasar!`, text: rallyHitText(rally, x.rally), tone: 'ok', rally };
      }
      case 'bayrak': {
        const x = await c.call('relay.submit', { leg: play.leg, ...run });
        useEvents.setState({ relay: x.relay });
        if (!run.completed) return { icon: '🚩', title: 'Ayak tamamlanmadı', text: 'Bayrak hâlâ sende; bir daha dene!', tone: 'warn' };
        return { icon: '🚩', title: `${play.leg + 1}. ayak: ${fmtSecs(run.timeSec)}`, text: relayRunText(run.timeSec, x.improved, x.record), tone: 'ok' };
      }
      case 'meydan': {
        const x = await c.call('challenge.submit', run);
        useEvents.setState({ challenge: x.challenge });
        return { icon: '🏅', title: `Skor: ${run.score.toLocaleString('tr-TR')}`, text: x.challenge.rank ? `Sıran: ${x.challenge.rank}. · kalan deneme ${x.challenge.maxTries - x.challenge.tries}` : 'Skor kaydedildi.', tone: 'ok' };
      }
      case 'turnuva': {
        const x = await c.call('tourney.submit', { slot: play.slot, ...run });
        useEvents.setState({ tourney: x.tourney });
        return { icon: '🏆', title: `Skor: ${run.score.toLocaleString('tr-TR')}`, text: `Turnuva toplamın: ${x.tourney.total.toLocaleString('tr-TR')}`, tone: 'ok' };
      }
    }
  } catch (e) {
    void c.call('events.overview', {}).then((o) => applyOverview(o.overview)).catch(() => undefined);
    if (play.kind === 'ralli' && rallyAlreadyWon(e)) return RALLY_LATE_RUN;
    return { icon: '🙈', title: 'Sonuç işlenemedi', text: errText(e), tone: 'warn' };
  }
}
