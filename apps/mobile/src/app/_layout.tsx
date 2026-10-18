import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** Tek ekran: bütün arayüz web uygulamasından (DOM bileşeni) gelir. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#140c35' } }}>
        <Stack.Screen name="index" />
      </Stack>
    </SafeAreaProvider>
  );
}
