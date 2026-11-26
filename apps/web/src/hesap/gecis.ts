/**
 * 1.2.0 hesap kurtarma: bu cihazı başka bir hesaba geçir (e-postayla giriş ya da yöneticinin geri alma kodu) ya da yeni hesapla başlat.
 *
 * Sıra: bağlantı kapanır → yerel oyun kaydı kurtarılan hesabın SUNUCUDAKİ ilerlemesinden kurulur (bölüm yıldızları, en iyi puan, XP;
 * jeton, kristal, yetenek ve kozmetik bağlanınca sunucudan gelir) → yeni oturum anahtarı normal anahtarın yerine yazılır, önceki
 * hesabın bekleyen kayıtları atılır → uygulama yeniden kurulur ve o hesapla bağlanır.
 *
 * Neden yerel kayıt sıfırdan: bu cihazdaki (çoğu zaman yeni kurulumun) ilerlemesi ve bekleyen ödülleri kurtarılan hesaba yazılmasın.
 * Kurtarılan ilerlemeden açılan başarımlar yerelde "zaten sayılmış" işaretlenir (gonderilmis): sunucuya ikinci kez ödül gitmez.
 * Ayarlar (ses, yazı boyu, titreşim, bilgi düzeyi) olduğu gibi kalır. Hikâye ve tanıtımlar ilerlemeye göre görülmüş sayılır.
 */
import { DEFAULT_SKILLS } from '@odi/content';
import { migrateMeta, settle } from '@odi/meta';
import type { KurtarmaIlerleme } from '@odi/shared';
import { freezeStorage, platform } from '../platform';
import { oturumuDegistir } from '../net';
import { useStore, type LevelProgress } from '../store';
import { normalizeFtue } from '../ftue/features';
import { ledgerKey } from '../odul-durum';

/** cihazda bekleyen takma ad (Onboarding) önceki hesabındı */
const AD_BEKLIYOR = 'odi.adBekliyor';

/** sunucu ilerlemesinden yerel oyun kaydı (saf; test edilir) */
export function yerelKayit(ilerleme: KurtarmaIlerleme | null) {
  const progress: Record<number, LevelProgress> = {};
  for (const b of ilerleme?.best ?? []) if (b.stars > 0 && b.level > 0) progress[b.level] = { stars: Math.min(3, b.stars), best: Math.max(0, b.score), plays: 1 };
  const xp = Math.max(0, Math.floor(ilerleme?.xp ?? 0));
  const { core } = settle({ progress, coins: 0, xp, streak: 0, lastDay: '', failStreak: 0, skills: { ...DEFAULT_SKILLS }, meta: migrateMeta(undefined, progress) });
  // jeton sunucu cüzdanından gelir; yerel başarım jetonu sayılmaz (gönderilmiş işaretli)
  return { progress: core.progress, xp: Math.max(xp, core.xp), meta: core.meta, gonderilmis: core.meta.ledger.map((g) => ledgerKey(g.at, g.reason)), ftue: normalizeFtue(undefined, core.progress) };
}

let suruyor = false;
/** token null: yeni hesap (TASINDI sonrası "yeni hesapla başla"). İlerleme null: boş kayıt. */
export async function hesabaGec(token: string | null, ilerleme: KurtarmaIlerleme | null): Promise<void> {
  if (suruyor) return;
  suruyor = true;
  const k = yerelKayit(ilerleme);
  const s = useStore.getState();
  s.reset();
  useStore.setState({ progress: k.progress, xp: k.xp, meta: k.meta, coins: 0, teamShields: 0, failStreak: 0, recentStars: [], ftue: k.ftue, knowledgeAsked: true, odiColor: null, chosenColor: null, toasts: [] });
  try { localStorage.removeItem(AD_BEKLIYOR); } catch { /* yok */ }
  // oyun kaydını hemen yaz (kalıcı depo zustand persist ile aynı biçim), sonra oturum anahtarı ve kuyruklar
  const o = useStore.persist.getOptions();
  if (o.name && o.partialize) await platform().storage.setItem(o.name, JSON.stringify({ state: o.partialize(useStore.getState()), version: o.version })).catch(() => undefined);
  await oturumuDegistir(token, k.gonderilmis);
  // eski oturumdan kalan yazmalar arkadan gelip üzerine yazmasın
  freezeStorage();
  await new Promise((r) => setTimeout(r, 250));
  const p = platform();
  if (p.restartApp) p.restartApp(); else location.reload();
}
