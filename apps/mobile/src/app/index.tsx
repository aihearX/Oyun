import { Share, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebApp from '@/dom/WebApp';
import { ErrorBoundary } from '@/ui';
import { createNativePurchase } from '@/purchases';
import { playVoice, stopVoice, voiceManifest } from '@/voice/player';
import { isMaleVoice, pickTurkishVoice, ttsChunks, ttsParams } from '../../../web/src/ftue/voicePick';

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

/**
 * Anlatıcı (Tüy Dede) yedek sesi: kayıtlı dosyası olmayan satırlarda cihazın Türkçe sesi. Erkek (tercihen yaşlı erkek) tr-TR ses
 * varsa o seçilir; yoksa (iOS'ta yalnız Yelda) perde düşürülür, tempo yavaşlar. Cümleler sıraya alınır (aralarda doğal nefes).
 */
let trVoice: { id?: string; male: boolean } | null = null;
async function pickVoice(): Promise<{ id?: string; male: boolean }> {
  if (trVoice) return trVoice;
  try {
    const best = pickTurkishVoice((await Speech.getAvailableVoicesAsync()).map((v) => ({ ...v, quality: String(v.quality) })));
    trVoice = { id: best?.identifier, male: isMaleVoice(best) };
  } catch { trVoice = { male: false }; }
  return trVoice;
}
async function speak(text: string, rate: number, pitch: number): Promise<void> {
  try {
    Speech.stop();
    const v = await pickVoice();
    const p = ttsParams(v.male, { rate, pitch });
    const chunks = ttsChunks(text);
    await new Promise<void>((resolve) => {
      let left = chunks.length;
      const guard = setTimeout(() => finish(), (text.length * 95) / p.rate + 2500); // olay gelmezse takılma
      const finish = () => { clearTimeout(guard); resolve(); };
      const one = () => { if (--left <= 0) finish(); };
      for (const c of chunks) Speech.speak(c, { language: 'tr-TR', rate: p.rate, pitch: p.pitch, ...(v.id ? { voice: v.id } : {}), onDone: one, onStopped: finish, onError: one });
    });
  } catch { /* TTS yok */ }
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
          voiceManifest={voiceManifest}
          playVoice={playVoice}
          stopVoice={async () => stopVoice()}
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
