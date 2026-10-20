import { useState } from 'react';
import { Share, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebApp from '@/dom/WebApp';
import { ErrorBoundary } from '@/ui';
import { createNativePurchase } from '@/purchases';
import { voiceData, voiceManifest } from '@/voice/player';
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
 * Anlatıcı (Tüy Dede) yedek sesi: kayıtlı dosyası çalınamayan satırlarda cihazın Türkçe sesi — yalnız ERKEK bir tr-TR ses varsa
 * (maleOnly). iOS'ta yalnız kadın ses (Yelda) olduğundan orada sessiz kalınır; Tüy Dede kadın sesle konuşmaz. Cümleler sıraya alınır.
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
async function speak(text: string, rate: number, pitch: number, maleOnly = true): Promise<boolean> {
  try {
    Speech.stop();
    const v = await pickVoice();
    if (maleOnly && !v.male) return false;
    const p = ttsParams(v.male, { rate, pitch });
    const chunks = ttsChunks(text);
    await new Promise<void>((resolve) => {
      let left = chunks.length;
      const guard = setTimeout(() => finish(), (text.length * 95) / p.rate + 2500); // olay gelmezse takılma
      const finish = () => { clearTimeout(guard); resolve(); };
      const one = () => { if (--left <= 0) finish(); };
      for (const c of chunks) Speech.speak(c, { language: 'tr-TR', rate: p.rate, pitch: p.pitch, ...(v.id ? { voice: v.id } : {}), onDone: one, onStopped: finish, onError: one });
    });
    return true;
  } catch { return false; /* TTS yok */ }
}
async function stopSpeaking() { try { await Speech.stop(); } catch { /* yok */ } }

/** Sıfırla: cihazdaki bütün kayıtlar (ilerleme, oyuncu kimliği, önbellekler, ayarlar) */
async function clearAll() { try { await AsyncStorage.clear(); } catch { /* yok */ } }

export default function Home() {
  const insets = useSafeAreaInsets();
  // sıfırlamada WebView baştan kurulur (yeni JS bağlamı: bellekte hiçbir şey kalmaz)
  const [gen, setGen] = useState(0);
  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: '#140c35' }} testID="odi-root">
        <WebApp
          key={gen}
          getItem={(k) => AsyncStorage.getItem(k)}
          setItem={(k, v) => AsyncStorage.setItem(k, v)}
          removeItem={(k) => AsyncStorage.removeItem(k)}
          haptic={haptic}
          share={share}
          speak={speak}
          stopSpeaking={stopSpeaking}
          voiceManifest={voiceManifest}
          voiceData={voiceData}
          clearAll={clearAll}
          restartApp={async () => setGen((g) => g + 1)}
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
