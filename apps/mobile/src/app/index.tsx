import { Share, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebApp from '@/dom/WebApp';
import { ErrorBoundary } from '@/ui';
import { createNativePurchase } from '@/purchases';

const nativePurchase = createNativePurchase();

/** Sosyal sunucu adresi: EXPO_PUBLIC_ODI_SERVER > geliştirmede Metro'nun çalıştığı bilgisayar (aynı Wi-Fi) */
function serverUrl(): string {
  const env = process.env.EXPO_PUBLIC_ODI_SERVER;
  if (env) return env;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `ws://${host}:8787` : '';
}

async function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error') {
  try {
    if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'error') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else await Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch { /* desteklenmiyor */ }
}

async function share(text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  try { const r = await Share.share({ message: text }); return r.action === Share.sharedAction ? 'shared' : 'cancelled'; } catch { return 'cancelled'; }
}

/** Anlatıcı (Tüy Dede) sesi: cihazın Türkçe sesi; varsa "gelişmiş" kalitedeki seçilir. Ses yoksa sessizce geçer (altyazı hep var). */
let trVoice: string | undefined | null = null;
async function pickVoice(): Promise<string | undefined> {
  if (trVoice !== null) return trVoice;
  try {
    const all = await Speech.getAvailableVoicesAsync();
    const tr = all.filter((v) => v.language?.toLowerCase().replace('_', '-').startsWith('tr'));
    trVoice = (tr.find((v) => String(v.quality).toLowerCase() === 'enhanced') ?? tr[0])?.identifier;
  } catch { trVoice = undefined; }
  return trVoice;
}
async function speak(text: string, rate: number, pitch: number) {
  try { Speech.stop(); const voice = await pickVoice(); Speech.speak(text, { language: 'tr-TR', rate, pitch, ...(voice ? { voice } : {}) }); } catch { /* TTS yok */ }
}
async function stopSpeaking() { try { await Speech.stop(); } catch { /* yok */ } }

export default function Home() {
  const insets = useSafeAreaInsets();
  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: '#140c35' }} testID="odi-root">
        <WebApp
          getItem={(k) => AsyncStorage.getItem(k)}
          setItem={(k, v) => AsyncStorage.setItem(k, v)}
          removeItem={(k) => AsyncStorage.removeItem(k)}
          haptic={haptic}
          share={share}
          speak={speak}
          stopSpeaking={stopSpeaking}
          {...(nativePurchase ? { purchase: nativePurchase } : {})}
          canPurchase={!!nativePurchase}
          serverUrl={serverUrl()}
          insetTop={insets.top}
          insetBottom={insets.bottom}
          // Kaydırma web tarafında #root kabında (ivmeli, kenar sekmesi kapta); WebView'in kendi kaydırması kapalı.
          // Güvenli alan payları prop olarak gider (insetTop/insetBottom) → içerik kenardan kenara çizilir, iOS ayrıca kaydırmaz.
          dom={{ style: { flex: 1, backgroundColor: '#140c35' }, scrollEnabled: false, bounces: false, overScrollMode: 'never', contentInsetAdjustmentBehavior: 'never', automaticallyAdjustContentInsets: false, mediaPlaybackRequiresUserAction: false, allowsInlineMediaPlayback: true }}
        />
      </View>
    </ErrorBoundary>
  );
}
