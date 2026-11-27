/**
 * Anlık bildirimler (1.3.0): expo-notifications köprüsü. Sunucu Expo Push API ile gönderir (apps/server/src/push.ts); burada yalnız
 * izin, cihaz anahtarı, Android kanalı ve bildirime dokunma vardır. İzin ilk açılışta SORULMAZ: web katmanı anlamlı bir anda
 * (ilk özel mesaj, Ayarlar › Bildirimler) ister. Modül tembel yüklenir: derlemede yoksa (eski kabuk) ya da anahtar alınamazsa
 * (Android'de Firebase yapılandırılmamış, Expo Go, simülatör) uygulama açılır, yalnız bildirim gelmez.
 */
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';

export type PushIzin = 'granted' | 'denied' | 'undetermined';
export interface PushDokunus { kind: string; id: string }
/** sunucunun gönderdiği kanal (push.ts PUSH_KANAL) */
export const KANAL = 'varsayilan';

function modul(): typeof ExpoNotifications | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try { return require('expo-notifications') as typeof ExpoNotifications; } catch { return null; }
}

/** dokunma verisi: yalnız {kind, id} metinleri */
export function dokunusVerisi(data: unknown): PushDokunus | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { kind?: unknown; id?: unknown };
  if (typeof d.kind !== 'string' || !/^[a-z]{1,16}$/.test(d.kind)) return null;
  return { kind: d.kind, id: typeof d.id === 'string' ? d.id.slice(0, 40) : '' };
}

let kurulu = false;
let sonYanit = '';
/**
 * Açılışta bir kez: oyun öndeyken gelen bildirim gösterilmez (sunucu zaten göndermez; geçişte gelirse oyuncu oyunda görür),
 * Android kanalı kurulur, bildirime dokunma dinlenir (soğuk açılışta son dokunma da). İzin istemez.
 */
export function installNotifications(onTap: (d: PushDokunus) => void): () => void {
  const N = modul(); if (!N) return () => undefined;
  const tap = (r: ExpoNotifications.NotificationResponse | null | undefined) => {
    if (!r || r.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
    const kimlik = r.notification.request.identifier;
    if (kimlik && kimlik === sonYanit) return;
    sonYanit = kimlik;
    const d = dokunusVerisi(r.notification.request.content.data);
    if (d) onTap(d);
  };
  let sub: { remove(): void } | null = null;
  try {
    if (!kurulu) {
      kurulu = true;
      N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }) });
      if (Platform.OS === 'android') void N.setNotificationChannelAsync(KANAL, { name: 'Bildirimler', importance: N.AndroidImportance.HIGH }).catch(() => undefined);
    }
    sub = N.addNotificationResponseReceivedListener(tap);
    void N.getLastNotificationResponseAsync().then(tap, () => undefined);
  } catch { /* modül yok */ }
  return () => { try { sub?.remove(); } catch { /* yok */ } };
}

function izinOf(p: ExpoNotifications.NotificationPermissionsStatus, N: typeof ExpoNotifications): PushIzin {
  const ios = p.ios?.status;
  if (p.granted || ios === N.IosAuthorizationStatus.PROVISIONAL || ios === N.IosAuthorizationStatus.EPHEMERAL) return 'granted';
  // Android 13+: reddedilse de yeniden sorulabiliyorsa "sorulmadı" sayılır
  if (p.status === 'denied' && !p.canAskAgain) return 'denied';
  return p.status === 'denied' && Platform.OS === 'ios' ? 'denied' : 'undetermined';
}

export async function pushIzin(): Promise<PushIzin> {
  const N = modul(); if (!N) return 'denied';
  try { return izinOf(await N.getPermissionsAsync(), N); } catch { return 'denied'; }
}
/** sistem izin penceresi: uyarı ve ses (simge sayısı istenmez) */
export async function pushIzinIste(): Promise<PushIzin> {
  const N = modul(); if (!N) return 'denied';
  try {
    if (Platform.OS === 'android') await N.setNotificationChannelAsync(KANAL, { name: 'Bildirimler', importance: N.AndroidImportance.HIGH }).catch(() => undefined);
    return izinOf(await N.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }), N);
  } catch { return 'denied'; }
}

function sureli<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error('süre')), ms); })]).finally(() => clearTimeout(t));
}
/** Expo bildirim anahtarı (EAS proje kimliğiyle); izin yoksa ya da alınamazsa null (Android'de FCM yoksa hata yutulur) */
export async function pushAnahtari(): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  const N = modul(); if (!N) return null;
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    if ((await pushIzin()) !== 'granted') return null;
    const t = await sureli(N.getExpoPushTokenAsync({ projectId }), 15_000);
    return typeof t?.data === 'string' && t.data ? { token: t.data, platform: Platform.OS === 'ios' ? 'ios' : 'android' } : null;
  } catch { return null; }
}

/** telefonun Ayarlar › ODİ sayfası (bildirim izni reddedildiyse oradan açılır) */
export async function bildirimAyarlariAc(): Promise<void> {
  try { await Linking.openSettings(); } catch { /* yok */ }
}

/** soğuk ya da sıcak açılışta dokunulan, web katmanının henüz almadığı bildirim (WebView yeniden kurulsa da bir kez verilir) */
let bekleyen: PushDokunus | null = null;
async function dokunusAl(): Promise<PushDokunus | null> { const d = bekleyen; bekleyen = null; return d; }

/**
 * Ana ekran (app/index.tsx) için köprü: WebApp'e verilen bildirim yetenekleri. pushTapN her dokunuşta artar, web katmanı
 * takePushTap ile veriyi alır; appActive uygulama önde mi (arka plana geçince sunucu bildirim gönderir).
 */
export function useBildirimKoprusu() {
  const [pushTapN, setN] = useState(0);
  const [appActive, setActive] = useState(AppState.currentState === 'active' || AppState.currentState == null);
  useEffect(() => installNotifications((d) => { bekleyen = d; setN((n) => n + 1); }), []);
  useEffect(() => {
    try { const sub = AppState.addEventListener('change', (s) => setActive(s === 'active')); return () => sub.remove(); } catch { return undefined; }
  }, []);
  if (!modul()) return {};
  return { pushStatus: pushIzin, pushRequest: pushIzinIste, pushToken: pushAnahtari, openSettings: bildirimAyarlariAc, takePushTap: dokunusAl, pushTapN, appActive };
}
