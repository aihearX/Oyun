import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';

import { useStore } from './store';
import { registerServiceWorker } from './sw-kayit';

// kayıtlı ilerlemeyi yükle, sonra çiz (mobil kabuk aynı adımı köprü kurulduktan sonra yapar)
void Promise.resolve(useStore.persist.rehydrate()).finally(() => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});
registerServiceWorker();
