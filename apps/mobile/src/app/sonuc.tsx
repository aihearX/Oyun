import { Share, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Card, Pill, styles as ui } from '@/ui';
import { useSession } from '@/store/session';
import { LEVEL_COUNT, shareTextFor } from '@/lib/level';

/** Sonuç: yıldız, skor, jeton/süre/hedef; tekrar, sonraki, paylaş, harita. */
export default function ResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { spec, result } = useSession();
  if (!spec || !result) return <Redirect href="/" />;
  const last = spec.number >= LEVEL_COUNT;
  const title = result.completed ? (result.stars === 3 ? 'Mükemmel!' : result.stars === 2 ? 'Harika!' : 'Geçtin!') : 'Bu sefer olmadı';
  const share = async () => { try { await Share.share({ message: shareTextFor(spec, result.completed, result.stars, result.score) }); } catch { /* iptal */ } };
  const go = (n: number) => router.replace({ pathname: '/oyun/[n]', params: { n: String(n) } });

  return (
    <View style={[ui.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16, paddingHorizontal: 16, alignItems: 'center', gap: 14 }]} testID="result-screen">
      <AppText variant="small" muted>{spec.number}. {spec.name}</AppText>
      <AppText variant="h1" center>{title}</AppText>
      <AppText style={{ fontSize: 52, letterSpacing: -6 }}>{'⭐'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</AppText>
      <AppText style={{ fontSize: 44, fontWeight: '800' }}>{result.score.toLocaleString('tr-TR')}</AppText>
      <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
        <Card style={{ flex: 1, alignItems: 'center', padding: 12 }}><AppText variant="h2">🪙 {result.coins}</AppText><AppText variant="tiny" muted>jeton{spec.coinsTotal ? ` / ${spec.coinsTotal}` : ''}</AppText></Card>
        <Card style={{ flex: 1, alignItems: 'center', padding: 12 }}><AppText variant="h2">⏱ {result.timeSec}s</AppText><AppText variant="tiny" muted>süre · par {spec.parTimeSec}s</AppText></Card>
        <Card style={{ flex: 1, alignItems: 'center', padding: 12 }}><AppText variant="h2">{result.objectiveMet ? '✅' : '❌'}</AppText><AppText variant="tiny" muted center numberOfLines={2}>{spec.objective.label}</AppText></Card>
      </View>
      {result.secretFound ? <Pill>🐚 Altın koklea bulundu</Pill> : null}
      {!result.completed && result.extra?.reason === 'fall' ? <AppText variant="small" muted center>İpucu: boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.</AppText> : null}
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
        <Button title="↻ Tekrar" variant="ghost" style={{ flex: 1 }} onPress={() => go(spec.number)} />
        {result.completed && !last ? <Button title="Sonraki ▶" style={{ flex: 1 }} onPress={() => go(spec.number + 1)} /> : null}
      </View>
      <Button title="Paylaş" variant="coral" style={{ alignSelf: 'stretch' }} onPress={share} />
      <Button title="Harita" variant="ghost" size="sm" onPress={() => router.replace('/')} />
    </View>
  );
}
