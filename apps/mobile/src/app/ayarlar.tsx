import { Alert, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useStore } from '@/store';
import { AppText, Button, Card, styles as ui } from '@/ui';
import { colors } from '@/ui/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStore();
  const confirmReset = () => Alert.alert('İlerleme sıfırlansın mı?', 'Yıldızlar, jetonlar ve yetenekler silinir.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sıfırla', style: 'destructive', onPress: () => s.reset() }]);
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={ui.topbar}><Button title="← Harita" variant="ghost" size="sm" onPress={() => router.back()} /></View>
      <AppText variant="h1">Ayarlar</AppText>
      <Card style={[ui.row, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}><AppText variant="h2">Sesler</AppText><AppText variant="small" muted>Efektler ve notalar</AppText></View>
        <Switch value={s.sounds} onValueChange={s.setSounds} trackColor={{ true: colors.accent }} />
      </Card>
      <Card style={[ui.row, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}><AppText variant="h2">Titreşim</AppText><AppText variant="small" muted>Zıplama, hasar ve ödül anlarında haptik</AppText></View>
        <Switch value={s.haptics} onValueChange={s.setHaptics} trackColor={{ true: colors.accent }} />
      </Card>
      <Card style={[ui.row, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}><AppText variant="h2">İlerlemeyi sıfırla</AppText><AppText variant="small" muted>Yıldızlar, jetonlar, yetenekler silinir.</AppText></View>
        <Button title="Sıfırla" variant="coral" size="sm" onPress={confirmReset} />
      </Card>
      <AppText variant="small" muted>ODİ: Sesin Yolu · sürüm {Constants.expoConfig?.version ?? '0.1'} · Faz 1</AppText>
    </ScrollView>
  );
}
