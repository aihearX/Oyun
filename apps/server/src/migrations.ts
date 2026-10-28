/**
 * Şema sürümü ve göçler (docs/10-sunucu.md "Şema sürümü ve göçler").
 * Tablolar her açılışta `CREATE TABLE IF NOT EXISTS` ile kurulur; var olan tabloya sütun eklemek, veri dönüştürmek gibi
 * değişiklikler burada SIRALI göç olarak yazılır. `PRAGMA user_version` uygulanan göç sayısıdır.
 * Kurallar: yalnızca sona ekle, var olan göçü değiştirme ya da silme; her göç tekrar çalışsa da güvenli olsun (addColumn gibi).
 */
import type { DatabaseSync } from 'node:sqlite';
import { silinmisArtiklariTemizle } from './account-veri';
import { CRASH_SCHEMA } from './hata';

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
 */
export const MIGRATIONS: Migration[] = [
  { name: 'taban', up: () => { /* taban: şema CREATE TABLE IF NOT EXISTS ile kurulu */ } },
  { name: 'silinmis-hesap-artiklari', up: (db) => { silinmisArtiklariTemizle(db); } },
  { name: 'cokme-raporlari', up: (db) => { db.exec(CRASH_SCHEMA); } },
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
