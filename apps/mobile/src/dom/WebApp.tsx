'use dom';
import { useEffect, useState } from 'react';
import '../../../web/src/styles.css';
import { installPlatform, type HapticKind } from '../../../web/src/platform';
import { App } from '../../../web/src/App';
import { useStore } from '../../../web/src/store';

export type WebAppProps = {
  /** yerel depolama köprüsü (AsyncStorage) */
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  haptic: (kind: HapticKind) => Promise<void>;
  share: (text: string) => Promise<'shared' | 'copied' | 'cancelled'>;
  /** anlatıcı sesi: yerel TTS (expo-speech, tr-TR) */
  speak?: (text: string, rate: number, pitch: number) => Promise<void>;
  stopSpeaking?: () => Promise<void>;
  /** gerçek mağaza satın alması (yalnız mağaza derlemesinde) */
  purchase?: (productId: string, playerId: string) => Promise<{ ok: true; store: 'app-store' | 'play'; receipt: string } | { ok: false; error: string; cancelled?: boolean }>;
  canPurchase: boolean;
  /** sosyal sunucu (ws://bilgisayar-ip:8787 ya da wss://...) */
  serverUrl: string;
  insetTop: number;
  insetBottom: number;
  dom?: import('expo/dom').DOMProps;
};

/** çentik / ana çizgi payları → CSS (--safe-top/--safe-bottom; styles.css --sat/--sab bunlardan türetilir) + platform köprüsü */
function applyInsets(top: number, bottom: number) {
  const t = Math.max(0, Math.round(top || 0)), b = Math.max(0, Math.round(bottom || 0));
  document.documentElement.style.setProperty('--safe-top', `${t}px`);
  document.documentElement.style.setProperty('--safe-bottom', `${b}px`);
  installPlatform({ insets: { top: t, bottom: b } });
}

/**
 * Tek arayüz: web uygulamasının (apps/web) aynısı iPhone/Android'de bu DOM bileşeninin içinde çalışır.
 * Yerel yetenekler props üzerinden platform köprüsüne bağlanır; React Native import YOK.
 */
export default function WebApp(p: WebAppProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    installPlatform({
      kind: 'native',
      storage: { getItem: (k) => p.getItem(k), setItem: (k, v) => p.setItem(k, v), removeItem: (k) => p.removeItem(k) },
      haptic: (k) => { void p.haptic(k); },
      share: (t) => p.share(t),
      ...(p.speak ? { speak: (t: string, o?: { rate?: number; pitch?: number }) => { void p.speak!(t, o?.rate ?? 0.95, o?.pitch ?? 0.92).catch(() => undefined); } } : {}),
      ...(p.stopSpeaking ? { stopSpeaking: () => { void p.stopSpeaking!().catch(() => undefined); } } : {}),
      ...(p.canPurchase && p.purchase ? { purchase: (id: string, pid: string) => p.purchase!(id, pid) } : {}),
      serverUrl: () => p.serverUrl,
      insets: { top: p.insetTop, bottom: p.insetBottom },
    });
    applyInsets(p.insetTop, p.insetBottom);
    // Expo'nun DOM sayfası viewport-fit=cover içermez → env(safe-area-inset-*) 0 kalır; ekle (köprü değerleri yine esas)
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp && !/viewport-fit/.test(vp.getAttribute('content') ?? '')) vp.setAttribute('content', `${vp.getAttribute('content')}, viewport-fit=cover`);
    // kayıt köprü kurulduktan sonra yerel depodan yüklenir
    void Promise.resolve(useStore.persist.rehydrate()).finally(() => setReady(true));
    // eslint yok: props köprüsü bir kez kurulur
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // güvenli alan payları ilk çizimden sonra gelebilir/değişebilir (SafeAreaProvider ölçümü, döndürme): her değişimde yaz
  useEffect(() => { applyInsets(p.insetTop, p.insetBottom); }, [p.insetTop, p.insetBottom]);
  if (!ready) return null;
  return <App />;
}
