import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameEvent } from '@odi/game-core';
import LevelDom from '@/dom/LevelDom';
import { buildLevel, clampLevel } from '@/lib/level';
import { useStore } from '@/store';
import { useSession } from '@/store/session';
import { AppText, Button, Card, ErrorBoundary } from '@/ui';
import { colors } from '@/ui/theme';

const LOAD_TIMEOUT_MS = 30_000;

/**
 * Bölüm ekranı: Phaser DOM bileşeninde (WebView) çalışır; bu taraf yükleme perdesi, zaman aşımı,
 * haptik, duraklatma ve sonucu işler. Bölüm üretimi burada (native) yapılır, spec JSON olarak geçer.
 */
export default function LevelHost() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { n } = useLocalSearchParams<{ n: string }>();
  const number = clampLevel(Number(n));
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lives, setLives] = useState<number | null>(null);
  const finished = useRef(false);
  const skills = useStore((s) => s.skills);
  const sounds = useStore((s) => s.sounds);
  const haptics = useStore((s) => s.haptics);

  // Bölüm yalnızca deneme başında üretilir; koşu sırasında kalıcı durum değişse de yeniden üretilmez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const spec = useMemo(() => buildLevel(number), [number, attempt]);
  useEffect(() => { useSession.getState().setRun(spec); finished.current = false; }, [spec]);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready, attempt]);

  const onEvent = useCallback(async (e: GameEvent) => {
    switch (e.type) {
      case 'ready': setReady(true); setTimedOut(false); return;
      case 'damage': setLives(e.lives); return;
      case 'haptic': {
        if (!haptics) return;
        const p = e.kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : e.kind === 'error' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          : Haptics.impactAsync(e.kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : e.kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        p.catch(() => undefined);
        return;
      }
      case 'levelComplete':
      case 'levelFailed': {
        if (finished.current) return;
        finished.current = true;
        useStore.getState().recordRun(spec.number, e.result);
        useSession.getState().setResult(spec, e.result);
        setTimeout(() => router.replace('/sonuc'), 250);
        return;
      }
      case 'quit': router.replace('/'); return;
      default: return;
    }
  }, [haptics, router, spec]);

  const retry = () => { setReady(false); setTimedOut(false); setPaused(false); setAttempt((a) => a + 1); };
  const quit = () => router.replace('/');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ErrorBoundary title={`${spec.number}. ${spec.name} (oyun motoru)`} onReset={retry}>
        <LevelDom key={`${spec.id}-${attempt}`} spec={spec} skills={skills} sounds={sounds} paused={paused} onEvent={onEvent}
          dom={{ style: { flex: 1 }, scrollEnabled: false, bounces: false, matchContents: false, overScrollMode: 'never', contentInsetAdjustmentBehavior: 'never', mediaPlaybackRequiresUserAction: false }} />
      </ErrorBoundary>

      {!ready ? (
        <View style={styles.cover} pointerEvents={timedOut ? 'auto' : 'none'}>
          {timedOut ? (
            <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 24 }}>
              <AppText variant="h3" center>Oyun yüklenemedi</AppText>
              <AppText variant="small" muted center>Geliştirme modunda oyun motoru bilgisayardan Wi-Fi ile gelir; telefon ve bilgisayar aynı ağda olmalı. Tekrar denemek çoğu zaman yeter.</AppText>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Tekrar dene" onPress={retry} />
                <Button title="Harita" variant="ghost" onPress={quit} />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 24 }}>
              <ActivityIndicator size="large" color={colors.accent} />
              <AppText variant="bodyStrong">{spec.number}. {spec.name}</AppText>
              {spec.intro ? <AppText variant="small" muted center>{spec.intro}</AppText> : null}
              <AppText variant="tiny" muted center>Oyun motoru yükleniyor… İlk açılış 10-20 saniye sürebilir.</AppText>
            </View>
          )}
        </View>
      ) : null}

      {ready ? (
        <Pressable accessibilityLabel={paused ? 'Devam' : 'Duraklat'} onPress={() => setPaused((p) => !p)} style={[styles.hud, { top: insets.top + 8 }]}>
          <AppText variant="h3">{paused ? '▶' : '⏸'}</AppText>
        </Pressable>
      ) : null}

      {paused ? (
        <View style={styles.overlay}>
          <Card style={{ width: 300, gap: 12, alignItems: 'center', backgroundColor: colors.white }}>
            <AppText variant="h2">Duraklatıldı</AppText>
            <AppText variant="small" muted>{spec.number}. {spec.name}{lives != null ? ` · ${lives} can` : ''}</AppText>
            <Button title="Devam" onPress={() => setPaused(false)} style={{ alignSelf: 'stretch' }} />
            <Button title="Haritaya dön" variant="ghost" onPress={quit} style={{ alignSelf: 'stretch' }} />
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  hud: { position: 'absolute', right: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
