/**
 * Sunucu makinesindeki işletmen araçları (yalnız `npm run kod -- …`, ağdan erişilemez; docs/10-sunucu.md "Hesap ve şikâyet"):
 *  - uygulama dışı hesap silme isteği (Google Play "hesap silme" adresi /hesap-sil; e-postayla gelen istek, arkadaş koduyla)
 *  - şikâyet listesi ve uzun süreli susturma (App Store 1.2: şikâyetlere zamanında yanıt, kötüye kullananı engelleme)
 *
 * Kimlik doğrulama: hesaplarda e-posta ya da şifre yok. Başkası birinin adına silme isteyemesin diye yalnız son
 * HESAP_SIL_BEKLEME_GUN gün içinde oyuna bağlanmamış hesap silinir (gizlilik metni, /hesap-sil §2). `zorla` yalnız yasal
 * zorunlulukta ya da oyuncunun hesabın kendisine ait olduğunu başka yoldan kanıtladığı durumda kullanılır.
 */
import type { App } from './app';
import { deleteAccount, isDeleted } from './account';
import { DAY_MS } from './time';

export const HESAP_SIL_BEKLEME_GUN = 14;

export interface HesapOzeti {
  id: string; ad: string; arkadasKodu: string; acilis: number; sonBaglanti: number; silindi: boolean;
  takim: string | null; sikayet90: number; susturmaBitis: number;
}

export function hesapBul(app: App, kod: string): HesapOzeti | null {
  const p = app.db.get<{ id: string; name: string; friend_code: string; created_at: number; last_seen: number; team_id: string | null; chat_muted_until: number }>(
    'SELECT id, name, friend_code, created_at, last_seen, team_id, chat_muted_until FROM players WHERE friend_code = ?', kod.trim().toUpperCase());
  if (!p) return null;
  const takim = p.team_id ? app.db.get<{ name: string }>('SELECT name FROM teams WHERE id = ?', p.team_id)?.name ?? null : null;
  const sikayet90 = app.db.get<{ n: number }>('SELECT COUNT(DISTINCT reporter) AS n FROM player_reports WHERE target = ? AND at > ?', p.id, app.now() - 90 * DAY_MS)!.n;
  return { id: p.id, ad: p.name, arkadasKodu: p.friend_code, acilis: p.created_at, sonBaglanti: p.last_seen, silindi: isDeleted(app, p.id), takim, sikayet90, susturmaBitis: p.chat_muted_until };
}

export type SilSonuc = { ok: true; ad: string } | { ok: false; neden: 'yok' | 'silinmis' | 'etkin'; gun?: number };

/** uygulama dışından gelen silme isteği: hesap son 14 günde bağlanmadıysa siler (zorla: bekleme şartı aranmaz) */
export function hesapSilIstegi(app: App, kod: string, opt: { zorla?: boolean } = {}): SilSonuc {
  const h = hesapBul(app, kod);
  if (!h) return { ok: false, neden: 'yok' };
  if (h.silindi) return { ok: false, neden: 'silinmis' };
  const gun = Math.floor((app.now() - h.sonBaglanti) / DAY_MS);
  if (!opt.zorla && (gun < HESAP_SIL_BEKLEME_GUN || app.online.has(h.id))) return { ok: false, neden: 'etkin', gun };
  app.run(() => deleteAccount(app, h.id));
  return { ok: true, ad: h.ad };
}

export interface SikayetSatiri { arkadasKodu: string; ad: string; kisi: number; nedenler: string[]; son: number; susturmaBitis: number; gizlenen: string[] }

/** son `gun` günün şikâyetleri: şikâyet edilen oyuncu başına farklı şikâyetçi sayısı, nedenler ve gizlenen iletileri */
export function sikayetler(app: App, gun = 7): SikayetSatiri[] {
  const since = app.now() - gun * DAY_MS;
  const rows = app.db.all<{ target: string; kisi: number; nedenler: string; son: number }>(
    `SELECT target, COUNT(DISTINCT reporter) AS kisi, GROUP_CONCAT(DISTINCT reason) AS nedenler, MAX(at) AS son
     FROM player_reports WHERE at > ? GROUP BY target ORDER BY kisi DESC, son DESC LIMIT 100`, since);
  return rows.map((r) => {
    const p = app.db.get<{ name: string; friend_code: string; chat_muted_until: number }>('SELECT name, friend_code, chat_muted_until FROM players WHERE id = ?', r.target);
    const gizlenen = app.db.all<{ text: string }>('SELECT text FROM chat WHERE from_id = ? AND hidden = 1 AND at > ? ORDER BY at DESC LIMIT 5', r.target, since).map((x) => x.text);
    return { arkadasKodu: p?.friend_code ?? '?', ad: p?.name ?? '?', kisi: r.kisi, nedenler: (r.nedenler ?? '').split(',').filter(Boolean), son: r.son, susturmaBitis: p?.chat_muted_until ?? 0, gizlenen };
  });
}

/** hesabın sohbet ve özel mesaj göndermesini `gun` gün kapatır (0: susturmayı kaldırır) */
export function sustur(app: App, kod: string, gun: number): HesapOzeti | null {
  const h = hesapBul(app, kod);
  if (!h || h.silindi) return null;
  app.db.run('UPDATE players SET chat_muted_until = ? WHERE id = ?', gun > 0 ? app.now() + gun * DAY_MS : 0, h.id);
  return hesapBul(app, kod);
}
