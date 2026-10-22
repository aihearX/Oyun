import { useEffect } from 'react';
import type { RaceRoom } from '@odi/shared';
import { platform } from '../platform';
import { takeMatch, useTeamRace } from './state';

/** eşleşme gelince (hangi ekranda olunursa olsun) takım yarışı bölümüne geç; App bir kez bağlar */
export function TeamRaceMatchWatcher({ onPlay, busy }: { onPlay: (room: RaceRoom) => void; busy: boolean }) {
  const matched = useTeamRace((x) => x.matched);
  useEffect(() => {
    if (!matched || busy) return;
    const room = takeMatch(); if (!room) return;
    platform().haptic('heavy');
    onPlay(room);
  }, [matched, busy]);
  return null;
}
