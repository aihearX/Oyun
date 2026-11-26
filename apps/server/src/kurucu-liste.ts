/**
 * Kurucular ekranı, yöneticinin düzenlediği liste (1.2.0). Yönetici kimin görüneceğini, hangi adla (görünen ad; boşsa takma adı),
 * hangi unvan satırıyla ve hangi sırayla görüneceğini seçer; fotoğrafı gizleyebilir (kurucu_liste, göç 20).
 *
 * Geçiş: yönetici listeye ilk kez dokunana dek (meta 'kurucu_kuratorlu' yok) ekran eski kuralla çalışır (Kurucu Yolcu rozeti +
 * "Adım listede görünsün"; rozet.ts kurucuListesi). İlk düzenlemede o an listede görünen kurucular sırasıyla bir kez listeye
 * taşınır, sonra yalnız yöneticinin listesi geçerlidir (boş bırakılırsa ekran boş görünür).
 *
 * Gizlilik: Kurucu Yolcu rozeti olan ve "Adım listede görünsün"ü kapatan oyuncu (oyuncunun kendi seçimi) yöneticinin listesinde
 * olsa da herkese açık ekranda görünmez; yönetici ekranı bunu yazar. Silinmiş hesaplar görünmez (satır hesap silinince silinir).
 */
import { ADMIN_PAGE, type AdminKurucu, type KurucuKisi } from '@odi/shared';
import { fail, type App, type Handlers, type Session } from './app';
import { requireAdmin } from './codes';
import { hasProfanity } from './profanity';
import { kurucuListesi } from './rozet';

const KEY = 'kurucu_kuratorlu';
/** herkese açık ekranda en çok bu kadar kişi */
export const KURUCU_EKRAN_MAX = 200;
export const kuratorlu = (app: App) => app.db.metaGet(KEY) === '1';

interface Row {
  player_id: string; sira: number; gorunen_ad: string; unvan: string; foto_gizli: number;
  name: string; friend_code: string; color: number; photo: number | null; rozet: number | null; listede: number | null;
}
const SELECT = `SELECT k.player_id, k.sira, k.gorunen_ad, k.unvan, k.foto_gizli, p.name, p.friend_code, p.color, ph.version AS photo,
  CASE WHEN b.player_id IS NULL THEN 0 ELSE 1 END AS rozet, b.listede
  FROM kurucu_liste k JOIN players p ON p.id = k.player_id
  LEFT JOIN player_photos ph ON ph.player_id = k.player_id AND ph.hidden = 0
  LEFT JOIN player_badges b ON b.player_id = k.player_id AND b.badge = 'kurucu'
  WHERE k.player_id NOT IN (SELECT player_id FROM deleted_players)`;

const kendisiGizledi = (r: Row) => !!r.rozet && !r.listede;
function toAdmin(r: Row): AdminKurucu {
  return {
    id: r.player_id, name: r.name, friendCode: r.friend_code, color: r.color, ...(r.photo ? { photo: r.photo } : {}),
    sira: r.sira, gorunenAd: r.gorunen_ad, unvan: r.unvan, fotoGizli: !!r.foto_gizli, rozet: !!r.rozet, ...(kendisiGizledi(r) ? { kendisiGizledi: true } : {}),
  };
}

/** herkese açık "Kurucular": düzenlenmişse yöneticinin listesi (sırasıyla), değilse eski kural */
export function kurucuEkrani(app: App): { names: string[]; gizli: number; kisiler?: KurucuKisi[] } {
  if (!kuratorlu(app)) return kurucuListesi(app);
  const rows = app.db.all<Row>(`${SELECT} ORDER BY k.sira, k.at LIMIT ?`, KURUCU_EKRAN_MAX * 2).filter((r) => !kendisiGizledi(r)).slice(0, KURUCU_EKRAN_MAX);
  const kisiler = rows.map((r): KurucuKisi => ({
    id: r.player_id, ad: r.gorunen_ad || r.name, color: r.color, ...(r.unvan ? { unvan: r.unvan } : {}), ...(r.photo && !r.foto_gizli ? { photo: r.photo } : {}),
  }));
  return { names: kisiler.map((k) => k.ad), gizli: 0, kisiler };
}

/** ilk düzenlemeden önce: o an ekranda görünen kurucular sırasıyla listeye (bir kez) */
function seed(app: App): void {
  if (kuratorlu(app)) return;
  const eski = app.db.all<{ player_id: string }>(
    `SELECT b.player_id FROM player_badges b WHERE b.badge = 'kurucu' AND b.listede = 1
     AND b.player_id NOT IN (SELECT player_id FROM player_flags WHERE admin = 1) AND b.player_id NOT IN (SELECT player_id FROM deleted_players)
     ORDER BY b.at, b.rowid`);
  eski.forEach((r, i) => app.db.run('INSERT OR IGNORE INTO kurucu_liste(player_id, sira, at) VALUES(?, ?, ?)', r.player_id, i + 1, app.now()));
  app.db.metaSet(KEY, '1');
}
/** sıraları 1..n yap (boşluk ve eşitlik kalmasın) */
function renumber(app: App): void {
  const ids = app.db.all<{ player_id: string }>('SELECT player_id FROM kurucu_liste ORDER BY sira, at, player_id');
  ids.forEach((r, i) => app.db.run('UPDATE kurucu_liste SET sira = ? WHERE player_id = ?', i + 1, r.player_id));
}
const one = (app: App, id: string) => app.db.get<Row>(`${SELECT} AND k.player_id = ?`, id);
const log = (app: App, s: Session, what: string) =>
  app.db.run('INSERT INTO promo_log(at, player_id, ip, code, result) VALUES(?, ?, ?, ?, ?)', app.now(), s.pid, 'panel', '', what.slice(0, 200));
const clean = (v: string | undefined, max: number) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export const kurucuAdminHandlers: Handlers = {
  'admin.kurucu.list': (app, s, { offset = 0 }) => {
    requireAdmin(app, s);
    if (!kuratorlu(app)) {
      // henüz düzenlenmedi: ekranda bugün görünenler (yazılmaz; ilk düzenlemede listeye taşınır)
      const eski = app.db.all<Omit<Row, 'sira' | 'gorunen_ad' | 'unvan' | 'foto_gizli'>>(
        `SELECT b.player_id, p.name, p.friend_code, p.color, ph.version AS photo, 1 AS rozet, b.listede FROM player_badges b JOIN players p ON p.id = b.player_id
         LEFT JOIN player_photos ph ON ph.player_id = b.player_id AND ph.hidden = 0
         WHERE b.badge = 'kurucu' AND b.listede = 1 AND b.player_id NOT IN (SELECT player_id FROM player_flags WHERE admin = 1)
         AND b.player_id NOT IN (SELECT player_id FROM deleted_players) ORDER BY b.at, b.rowid`);
      const items = eski.map((r, i) => toAdmin({ ...r, sira: i + 1, gorunen_ad: '', unvan: '', foto_gizli: 0 }));
      return { items: items.slice(offset, offset + ADMIN_PAGE), total: items.length, hasMore: offset + ADMIN_PAGE < items.length, kuratorlu: false };
    }
    const total = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM kurucu_liste k WHERE k.player_id NOT IN (SELECT player_id FROM deleted_players)')!.n;
    const rows = app.db.all<Row>(`${SELECT} ORDER BY k.sira, k.at LIMIT ? OFFSET ?`, ADMIN_PAGE, offset);
    return { items: rows.map(toAdmin), total, hasMore: offset + rows.length < total, kuratorlu: kuratorlu(app) };
  },
  'admin.kurucu.set': (app, s, d) => {
    requireAdmin(app, s);
    const gorunenAd = d.gorunenAd === undefined ? undefined : clean(d.gorunenAd, 24);
    const unvan = d.unvan === undefined ? undefined : clean(d.unvan, 40);
    if ((gorunenAd && hasProfanity(gorunenAd)) || (unvan && hasProfanity(unvan))) fail('GECERSIZ', 'Bu metin uygun değil.');
    seed(app);
    let id = d.id ?? '';
    if (d.code) {
      const code = d.code.trim().toUpperCase();
      const p = app.db.get<{ id: string }>('SELECT id FROM players WHERE friend_code = ? AND id NOT IN (SELECT player_id FROM deleted_players)', code);
      if (!p) fail('YOK', 'Bu arkadaş koduyla oyuncu yok.');
      id = p.id;
      if (!app.db.get('SELECT 1 AS x FROM kurucu_liste WHERE player_id = ?', id)) {
        const last = app.db.get<{ n: number | null }>('SELECT MAX(sira) AS n FROM kurucu_liste')!.n ?? 0;
        app.db.run('INSERT INTO kurucu_liste(player_id, sira, at) VALUES(?, ?, ?)', id, last + 1, app.now());
        log(app, s, `kurucu-ekle:${code}`);
      }
    } else if (!app.db.get('SELECT 1 AS x FROM kurucu_liste WHERE player_id = ?', id)) fail('YOK', 'Bu oyuncu listede değil.');
    if (gorunenAd !== undefined) app.db.run('UPDATE kurucu_liste SET gorunen_ad = ? WHERE player_id = ?', gorunenAd, id);
    if (unvan !== undefined) app.db.run('UPDATE kurucu_liste SET unvan = ? WHERE player_id = ?', unvan, id);
    if (d.fotoGizli !== undefined) app.db.run('UPDATE kurucu_liste SET foto_gizli = ? WHERE player_id = ?', d.fotoGizli ? 1 : 0, id);
    if (gorunenAd !== undefined || unvan !== undefined || d.fotoGizli !== undefined) log(app, s, `kurucu-duzenle:${id}`);
    const r = one(app, id);
    if (!r) fail('YOK', 'Oyuncu bulunamadı.');
    return { item: toAdmin(r) };
  },
  'admin.kurucu.remove': (app, s, { id }) => {
    requireAdmin(app, s);
    seed(app);
    if (!app.db.run('DELETE FROM kurucu_liste WHERE player_id = ?', id)) fail('YOK', 'Bu oyuncu listede değil.');
    renumber(app);
    log(app, s, `kurucu-cikar:${id}`);
    return {};
  },
  'admin.kurucu.move': (app, s, { id, sira }) => {
    requireAdmin(app, s);
    seed(app);
    const ids = app.db.all<{ player_id: string }>('SELECT player_id FROM kurucu_liste ORDER BY sira, at, player_id').map((r) => r.player_id);
    const from = ids.indexOf(id);
    if (from < 0) fail('YOK', 'Bu oyuncu listede değil.');
    ids.splice(from, 1);
    ids.splice(Math.min(ids.length, sira - 1), 0, id);
    ids.forEach((pid, i) => app.db.run('UPDATE kurucu_liste SET sira = ? WHERE player_id = ?', i + 1, pid));
    log(app, s, `kurucu-sira:${id}:${sira}`);
    return {};
  },
};
