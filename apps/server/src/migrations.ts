/**
 * Şema sürümü ve göçler (docs/10-sunucu.md "Şema sürümü ve göçler").
 * Tablolar her açılışta `CREATE TABLE IF NOT EXISTS` ile kurulur; var olan tabloya sütun eklemek, veri dönüştürmek gibi
 * değişiklikler burada SIRALI göç olarak yazılır. `PRAGMA user_version` uygulanan göç sayısıdır.
 * Kurallar: yalnızca sona ekle, var olan göçü değiştirme ya da silme; her göç tekrar çalışsa da güvenli olsun (addColumn gibi).
 */
import type { DatabaseSync } from 'node:sqlite';
import { silinmisArtiklariTemizle } from './account-veri';
import { CRASH_SCHEMA } from './hata';
import { FEEDBACK_SCHEMA } from './geribildirim';
import { ROZET_SCHEMA } from './rozet';
import { LEAGUE_RUNS_SCHEMA } from './league';
import { dayNumber, DAY_MS } from './time';

/** göç 7: `players.spend_limit` sütununun eski varsayılanı (db.ts); bu değerde kalmış, bekleyen yükseltmesi olmayan sınır seçilmemiş sayılır */
const OLD_DEFAULT_SPEND_LIMIT_TRY = 1000;
/** göç 8: eski Sezon Kartı hep 28 günlüktü (tek ürün, hesap başına 1) */
const ESKI_KART_GUN = 28;

export interface Migration { name: string; up: (db: DatabaseSync) => void }

/** sütun yoksa ekle (tekrar çalışması güvenli) */
export function addColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * Uygulamanın göçleri. 1: taban sürüm (2026-10-24 itibarıyla tüm tablolar CREATE ile; veri değişikliği yok).
 * 2: YN-029 — sınıflandırmadan (account-veri.ts) önce silinmiş hesapların ve silinmiş takımların artık satırları temizlenir.
 * 3: YN-011 — çökme raporları tablosu (`crash_reports`, hata.ts; oyuncu sütunu yok, 30 gün).
 * 4: beta geri bildirimi tablosu (`feedback`, geribildirim.ts; oyuncu sütunu yok, 90 gün).
 * 5: YN-041 — kalıcı rozetler (`player_badges`, rozet.ts; Kurucu Yolcu, Hata Avcısı; hesap silinince silinir).
 * 6: YN-054 / karar 26 — lig puanı tekrar sınırı sayacı (`league_level_runs`, league.ts; haftalık, hesap silinince silinir).
 * 7: YN-056 / karar 28 — `players.spend_chosen`: aylık sınırı oyuncu seçti mi. Sınırı 1000 TL varsayılanından değiştirmiş ya da
 *    yükseltme bekleyen oyuncu seçmiş sayılır; diğerleri bir sonraki satın almadan önce seçer.
 * 8: YN-058 / karar 30 — Sezon Kartı birikir: `players.pass_start` (başlangıç günü, dayNumber), `pass_days`, `pass_paid`. Eski kart
 *    (`pass_until` = satın alma + 28 × 24 sa) yeni biçime çevrilir: başlangıç günü satın alma günü, ödenen gün = verilmiş Sezon Kartı
 *    ödül kutusu satırları (en çok 28); kalan günler bir sonraki girişte birikmiş olarak gelir.
 */
export const MIGRATIONS: Migration[] = [
  { name: 'taban', up: () => { /* taban: şema CREATE TABLE IF NOT EXISTS ile kurulu */ } },
  { name: 'silinmis-hesap-artiklari', up: (db) => { silinmisArtiklariTemizle(db); } },
  { name: 'cokme-raporlari', up: (db) => { db.exec(CRASH_SCHEMA); } },
  { name: 'geri-bildirim', up: (db) => { db.exec(FEEDBACK_SCHEMA); } },
  { name: 'rozetler', up: (db) => { db.exec(ROZET_SCHEMA); } },
  { name: 'lig-bolum-tekrar', up: (db) => { db.exec(LEAGUE_RUNS_SCHEMA); } },
  { name: 'harcama-siniri-secimi', up: (db) => {
    addColumn(db, 'players', 'spend_chosen', 'INTEGER NOT NULL DEFAULT 0');
    db.exec(`UPDATE players SET spend_chosen = 1 WHERE spend_chosen = 0 AND (spend_limit <> ${OLD_DEFAULT_SPEND_LIMIT_TRY} OR spend_pending IS NOT NULL)`);
  } },
  { name: 'sezon-karti-birikir', up: (db) => {
    addColumn(db, 'players', 'pass_start', 'INTEGER NOT NULL DEFAULT 0');
    addColumn(db, 'players', 'pass_days', 'INTEGER NOT NULL DEFAULT 0');
    addColumn(db, 'players', 'pass_paid', 'INTEGER NOT NULL DEFAULT 0');
    const eski = db.prepare('SELECT id, pass_until FROM players WHERE pass_until > 0 AND pass_start = 0').all() as { id: string; pass_until: number }[];
    const odenen = db.prepare("SELECT COUNT(*) AS n FROM inbox WHERE player_id = ? AND ref = 'odi.pass' AND kind = 'kristal'");
    const yaz = db.prepare('UPDATE players SET pass_start = ?, pass_days = ?, pass_paid = ? WHERE id = ?');
    for (const r of eski) {
      const start = dayNumber(r.pass_until - ESKI_KART_GUN * DAY_MS);
      yaz.run(start, ESKI_KART_GUN, Math.min(ESKI_KART_GUN, (odenen.get(r.id) as { n: number }).n), r.id);
    }
  } },
];

export const userVersion = (db: DatabaseSync) => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

/**
 * Bekleyen göçleri sırayla, her biri kendi işleminde uygular; hata olursa o göç geri alınır ve hata fırlatılır
 * (sunucu yarım şemayla açılmaz). Veritabanı koddan yeniyse (geri alınmış dağıtım) dokunmaz, uyarı döndürür.
 */
export function runMigrations(db: DatabaseSync, list: Migration[] = MIGRATIONS): { from: number; to: number; warning?: string } {
  const from = userVersion(db);
  if (from > list.length) return { from, to: from, warning: `Veritabanı şeması (${from}) bu sunucunun bildiğinden (${list.length}) yeni; göç yapılmadı.` };
  for (let i = from; i < list.length; i++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      list[i]!.up(db);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* yok */ }
      throw new Error(`Şema göçü ${i + 1} (${list[i]!.name}) başarısız: ${(e as Error).message}`, { cause: e });
    }
  }
  return { from, to: list.length };
}
