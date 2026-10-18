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
  /** gerçek mağaza satın alması (yalnız mağaza derlemesinde) */
  purchase?: (productId: string, playerId: string) => Promise<{ ok: true; store: 'app-store' | 'play'; receipt: string } | { ok: false; error: string; cancelled?: boolean }>;
  canPurchase: boolean;
  /** sosyal sunucu (ws://bilgisayar-ip:8787 ya da wss://...) */
  serverUrl: string;
  insetTop: number;
  insetBottom: number;
  dom?: import('expo/dom').DOMProps;
};

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
      ...(p.canPurchase && p.purchase ? { purchase: (id: string, pid: string) => p.purchase!(id, pid) } : {}),
      serverUrl: () => p.serverUrl,
      insets: { top: p.insetTop, bottom: p.insetBottom },
    });
    document.documentElement.style.setProperty('--safe-top', `${p.insetTop}px`);
    document.documentElement.style.setProperty('--safe-bottom', `${p.insetBottom}px`);
    // kayıt köprü kurulduktan sonra yerel depodan yüklenir
    void Promise.resolve(useStore.persist.rehydrate()).finally(() => setReady(true));
    // eslint yok: props köprüsü bir kez kurulur
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return null;
  return <App />;
}
