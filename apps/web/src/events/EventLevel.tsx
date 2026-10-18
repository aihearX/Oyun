import { useEffect, useRef } from 'react';
import type { EventKind, LevelSpec, PlayerSkills, RunResult } from '@odi/shared';
import { DEFAULT_SKILLS } from '@odi/content';
import { newRunId } from '@odi/net';
import { LevelHost } from '../screens/LevelHost';
import { useStore } from '../store';
import { applyOverview, evNet, useEvents } from './store';
import { errText } from './common';

/** Bir etkinlik koşusu: hangi etkinliğe gönderileceği */
export type EventPlay = { kind: 'ralli'; rallyId: string } | { kind: 'bayrak'; leg: number } | { kind: 'meydan' } | { kind: 'turnuva'; slot: number };
/** koşudan sonra etkinlik ekranında gösterilen kısa sonuç */
export interface EventFlash { icon: string; title: string; text: string; tone: 'ok' | 'warn'; won?: boolean }

/**
 * Yalnızca uçtan uca test derlemesi (VITE_ODI_E2E=1) + `?etkinlik-bot=1`: bölümü harness botu oynar.
 * Normal derlemede sabit false olur ve bu yol tamamen çıkarılır (üretimde etkisiz).
 */
const E2E = import.meta.env.VITE_ODI_E2E === '1';
export const EVENT_BOT = E2E && new URLSearchParams(location.search).get('etkinlik-bot') === '1';

/** Mevcut LevelHost ile etkinlik bölümünü oynatır; bitince sonucu ilgili etkinliğe (runId ile idempotent) gönderir. */
export function EventLevel({ spec, play, onExit }: { spec: LevelSpec; play: EventPlay; onExit: (kind: EventKind, flash?: EventFlash) => void }) {
  const done = useRef(false);
  const skills: PlayerSkills = play.kind === 'ralli' ? useStore.getState().skills : DEFAULT_SKILLS; // yarışmalı etkinliklerde herkes eşit
  const finish = (r: RunResult) => {
    if (done.current) return; done.current = true;
    void submit(play, r).then((flash) => onExit(play.kind, flash));
  };
  // bot modunda LevelHost onDone çağırmaz: sonucu window.__odi'den al
  useEffect(() => {
    if (!EVENT_BOT) return;
    const h = setInterval(() => { const o = window.__odi; if (o?.done && o.result && o.spec?.id === spec.id) { clearInterval(h); finish(o.result); } }, 250);
    return () => clearInterval(h);
  }, [spec.id]);
  return <LevelHost key={spec.id + play.kind} spec={spec} skills={skills} sounds={!EVENT_BOT && useStore.getState().sounds} bot={EVENT_BOT} onDone={finish} onQuit={() => onExit(play.kind)} />;
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
        return { icon: run.completed ? '💥' : '🩹', title: `−${x.damage} hasar!`, text: run.completed ? `${run.stars} yıldızla vurdun. Kalan can: ${x.rally.hp}` : `Bölüm yarım kaldı ama yine de vurdun. Kalan can: ${x.rally.hp}`, tone: 'ok' };
      }
      case 'bayrak': {
        const x = await c.call('relay.submit', { leg: play.leg, ...run });
        useEvents.setState({ relay: x.relay });
        if (!run.completed) return { icon: '🚩', title: 'Ayak tamamlanmadı', text: 'Bayrak hâlâ sende; bir daha dene!', tone: 'warn' };
        return { icon: '🚩', title: `${play.leg + 1}. ayak: ${run.timeSec.toLocaleString('tr-TR')} sn`, text: x.improved ? 'Ayağın en iyi süresi senin!' : 'Koşu kaydedildi.', tone: 'ok' };
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
    return { icon: '🙈', title: 'Sonuç işlenemedi', text: errText(e), tone: 'warn' };
  }
}
