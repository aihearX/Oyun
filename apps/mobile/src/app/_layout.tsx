import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="oyun/[n]" options={{ gestureEnabled: false, animation: 'none' }} />
        <Stack.Screen name="sonuc" options={{ gestureEnabled: false }} />
        <Stack.Screen name="yetenekler" />
        <Stack.Screen name="ayarlar" />
      </Stack>
    </SafeAreaProvider>
  );
}
