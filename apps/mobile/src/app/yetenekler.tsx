import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SKILL_TREE } from '@odi/content';
import { ownsSkill, useStore } from '@/store';
import { AppText, Button, Card, Pill, styles as ui } from '@/ui';

export default function SkillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = useStore();
  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={ui.topbar}><Button title="← Harita" variant="ghost" size="sm" onPress={() => router.back()} /><Pill>🪙 {s.coins}</Pill></View>
      <AppText variant="h1">Yetenekler</AppText>
      <AppText variant="small" muted>Jetonlarla kalıcı yetenek al. Hepsi oyun içinden kazanılır.</AppText>
      {SKILL_TREE.map((n) => { const owned = ownsSkill(s.skills, n.id); const locked = n.requires ? !ownsSkill(s.skills, n.requires) : false; return (
        <Card key={n.id} style={[ui.row, { justifyContent: 'space-between', opacity: owned ? 0.7 : 1 }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="h2">{n.name}</AppText>
            <AppText variant="small" muted>{n.desc}{locked ? ` · önce: ${SKILL_TREE.find((x) => x.id === n.requires)?.name}` : ''}</AppText>
          </View>
          <Button title={owned ? 'Alındı' : `🪙 ${n.cost}`} size="sm" disabled={owned || locked || s.coins < n.cost} onPress={() => s.buySkill(n.id)} />
        </Card>); })}
    </ScrollView>
  );
}
