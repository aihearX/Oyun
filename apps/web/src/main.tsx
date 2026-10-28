import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';

import { useStore } from './store';
import { registerServiceWorker } from './sw-kayit';
import { installCrashReporting } from './hata';
import { HataSiniri } from './ui/HataSiniri';

// çökme raporu (YN-011): ilk çizimden önce kurulur (açılıştaki hata da yakalanır); kişisel veri yok
installCrashReporting();

// kayıtlı ilerlemeyi yükle, sonra çiz (mobil kabuk aynı adımı köprü kurulduktan sonra yapar)
void Promise.resolve(useStore.persist.rehydrate()).finally(() => {
  createRoot(document.getElementById('root')!).render(<StrictMode><HataSiniri kok><App /></HataSiniri></StrictMode>);
});
registerServiceWorker();
