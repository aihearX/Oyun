import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles.css';
import { useStore } from '../../store';
import { startNet } from '../../net';
import { RaceDevApp } from './RaceDevApp';

// Yarış test sayfası (geliştirme/harness). Uygulamadaki akışın aynısı: tek ağ istemcisi (startNet), lobi → bölüm → sonuç.
void Promise.resolve(useStore.persist.rehydrate()).finally(() => {
  startNet();
  createRoot(document.getElementById('root')!).render(<StrictMode><RaceDevApp /></StrictMode>);
});
