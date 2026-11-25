/**
 * Cihaz köprüleri (1.1.0): ses oturumu (expo-audio), dış bağlantı (expo-linking), profil fotoğrafı seçimi (expo-image-picker) ve
 * "bu açılışta bir kez" bayrakları. Yerel modüller tembel yüklenir (purchases.ts gibi): modül derlemede yoksa (eski kabuk, Expo Go
 * sürüm farkı) uygulama açılır, yalnız o yetenek sessizce çalışmaz.
 */
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import type * as ExpoAudio from 'expo-audio';
import type * as ExpoImagePicker from 'expo-image-picker';

/**
 * Ses oturumu: oyunun bütün sesi WebView içindeki Web Audio'dan gelir. Oturum ayarlanmazsa iOS onu "ortam sesi" sayar: sessiz
 * anahtarına uyar ve ses tuşları zil sesini değiştirir. Burada medya oynatımı olarak kurulur: telefonun MEDYA ses düzeyini izler,
 * sessiz anahtarı oyunu susturmaz (oyunun kendi Ses düğmesi var). Diğer uygulamaların müziği/podcast'i kesilmez (mixWithOthers),
 * arka planda çalmaz. Kayıt yok (allowsRecording false; mikrofon izni istenmez).
 */
export async function configureAudioSession(): Promise<boolean> {
  try {
    const { setAudioModeAsync } = require('expo-audio') as typeof ExpoAudio;
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers', allowsRecording: false });
    return true;
  } catch { return false; }
}

let audioWatch: { remove(): void } | null = null;
/** açılışta ve uygulama öne her döndüğünde (başka uygulama oturumu değiştirmiş olabilir) ses oturumunu kur; bir kez çağrılır */
export function installAudioSession(): void {
  void configureAudioSession();
  if (audioWatch) return;
  try {
    let last: string | null | undefined = AppState.currentState;
    audioWatch = AppState.addEventListener('change', (s) => { if (s === 'active' && last !== 'active') void configureAudioSession(); last = s; });
  } catch { /* yok */ }
}

/** mağaza sayfası gibi dış bağlantıyı telefonda aç (App Store / Play Store uygulaması bağlantıyı kendisi yakalar) */
export function openUrl(url: string): void {
  if (!/^https:\/\//i.test(url)) return;
  void Linking.openURL(url).catch(() => undefined);
}

/**
 * Profil fotoğrafı: sistemin fotoğraf seçicisi (iOS PHPicker, Android Photo Picker; izin istemez), kare kırpma, JPEG ~%70.
 * Dönen: data:image/jpeg;base64,... ya da vazgeçildiyse / hata olursa null.
 */
export async function pickPhoto(): Promise<string | null> {
  try {
    const ImagePicker = require('expo-image-picker') as typeof ExpoImagePicker;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true, exif: false, allowsMultipleSelection: false });
    if (r.canceled) return null;
    const b64 = r.assets?.[0]?.base64;
    return b64 ? `data:image/jpeg;base64,${b64}` : null;
  } catch { return null; }
}

/**
 * Bu uygulama sürecinde (soğuk açılış) anahtar başına ilk çağrı true. Modül düzeyinde tutulur: Sıfırla / restartApp WebView'i
 * (ve web katmanının belleğini) baştan kursa da yerel taraf aynı süreçte kalır, uyarılar ikinci kez çıkmaz.
 */
const launchSeen = new Set<string>();
export async function onceThisLaunch(key: string): Promise<boolean> {
  if (launchSeen.has(key)) return false;
  launchSeen.add(key); return true;
}
/** yalnız test */
export function _resetLaunchFlags(): void { launchSeen.clear(); }
