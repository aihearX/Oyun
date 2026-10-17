import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BIOMES, HUMAN_JOURNEY, type LevelPlan } from '@odi/content';
import type { BiomeId } from '@odi/shared';
import { useStore } from '@/store';
import { AppText, Button, Card, Loading, Pill, styles as ui } from '@/ui';
import { colors, radius } from '@/ui/theme';

/** Yolculuk haritası: biyom biyom gruplanmış 40 düğüm. Kilit: önceki bölüm en az 1 yıldız. */
export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStore();
  const scroll = useRef<ScrollView>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);
  const unlocked = s.highestUnlocked();

  useEffect(() => { if (s.hydrated) s.touchDay(); }, [s.hydrated]);
  useEffect(() => { if (currentY != null) scroll.current?.scrollTo({ y: Math.max(0, currentY - 220), animated: false }); }, [currentY]);

  if (!s.hydrated) return <Loading text="Yükleniyor…" />;

  const groups: { biome: BiomeId; levels: LevelPlan[] }[] = [];
  for (const l of HUMAN_JOURNEY.levels) { const g = groups[groups.length - 1]; if (g && g.biome === l.biome) g.levels.push(l); else groups.push({ biome: l.biome, levels: [l] }); }
  const totalStars = Object.values(s.progress).reduce((a, p) => a + p.stars, 0);
  const play = (n: number) => router.push({ pathname: '/oyun/[n]', params: { n: String(n) } });

  return (
    <View style={ui.screen} testID="map-screen">
      <ScrollView ref={scroll} contentContainerStyle={[ui.content, { paddingTop: insets.top + 12 }]}>
        <View style={ui.topbar}>
          <AppText variant="h2">OD<AppText variant="h2" style={{ color: colors.accent }}>İ</AppText> <AppText variant="small" muted>Sesin Yolu</AppText></AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}><Pill>🪙 {s.coins}</Pill><Pill>⭐ {totalStars}</Pill><Pill>Sv {s.playerLevel()}</Pill></View>
        </View>
        <Card style={[ui.row, { justifyContent: 'space-between' }]}>
          <View style={{ flex: 1 }}><AppText variant="h2">{HUMAN_JOURNEY.name}</AppText><AppText variant="small" muted>{HUMAN_JOURNEY.blurb}{s.streak > 1 ? ` · ${s.streak} gündür yolda` : ''}</AppText></View>
          <Button title={`Bölüm ${unlocked} ▶`} onPress={() => play(unlocked)} testID="play-current" />
        </Card>
        {groups.map((g) => { const b = BIOMES[g.biome]; const hasCurrent = g.levels.some((l) => l.number === unlocked); return (
          <View key={g.biome + g.levels[0]!.number} style={{ gap: 8 }} onLayout={hasCurrent ? (e) => setCurrentY(e.nativeEvent.layout.y) : undefined}>
            <View style={{ paddingHorizontal: 4, paddingTop: 6 }}><AppText variant="h2">{b.name}</AppText><AppText variant="tiny" muted>{b.fact}</AppText></View>
            <View style={styles.nodes}>
              {g.levels.map((l) => { const p = s.progress[l.number]; const locked = l.number > unlocked; const cur = l.number === unlocked; return (
                <Pressable key={l.number} testID={`node-${l.number}`} disabled={locked} onPress={() => play(l.number)} style={({ pressed }) => [styles.node, locked && { opacity: 0.45 }, cur && styles.current, pressed && !locked && { transform: [{ scale: 0.97 }] }]}>
                  {l.boss ? <AppText style={styles.boss}>👹</AppText> : null}
                  <AppText variant="h3" center>{l.number}</AppText>
                  <AppText variant="tiny" muted center style={{ fontSize: 11, lineHeight: 13 }} numberOfLines={2}>{l.name}</AppText>
                  <AppText center style={{ fontSize: 11, letterSpacing: -1 }}>{p ? '⭐'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : locked ? '🔒' : '☆☆☆'}</AppText>
                </Pressable>); })}
            </View>
          </View>); })}
      </ScrollView>
      <View style={[styles.tabs, { paddingBottom: insets.bottom + 6 }]}>
        <Button title="🧠 Yetenekler" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/yetenekler')} />
        <Button title="⚙️ Ayarlar" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/ayarlar')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nodes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  node: { width: '23%', flexGrow: 1, minHeight: 78, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 2, alignItems: 'center', justifyContent: 'center' },
  current: { borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  boss: { position: 'absolute', top: -8, right: -4, fontSize: 16 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.md },
});
