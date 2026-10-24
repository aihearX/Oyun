/**
 * Veritabanı yedeği (docs/10-sunucu.md "Yedek"). ODI_BACKUP_DIR verilirse sunucu açılışta ve her ODI_BACKUP_HOURS saatte bir
 * `VACUUM INTO` ile tutarlı bir kopya yazar (WAL açıkken de güvenli), en yeni ODI_BACKUP_KEEP dosyayı tutar, eskileri siler.
 * Dış servis yok: kopya aynı makinededir. Diskin kendisi kaybolursa korumaz; makine dışı kopya sahibin kararına bağlı.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { App } from './app';

const PREFIX = 'odi-yedek-';
const stamp = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');

/** bir yedek al; dosya yolunu döndürür */
export function backupNow(app: App, dir: string, keep: number): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${PREFIX}${stamp(Date.now())}.sqlite`);
  if (fs.existsSync(file)) fs.rmSync(file);
  app.db.raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const all = fs.readdirSync(dir).filter((f) => f.startsWith(PREFIX) && f.endsWith('.sqlite')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - Math.max(1, keep)))) fs.rmSync(path.join(dir, old), { force: true });
  return file;
}
