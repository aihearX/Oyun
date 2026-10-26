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

/** açılış yedeği için en kısa aralık: sunucu art arda yeniden başlarsa (çökme döngüsü) eski yedekler hızla silinmesin */
export const STARTUP_BACKUP_MIN_GAP_MS = 15 * 60_000;

/** klasördeki en yeni yedeğin yaşı (ms); yedek yoksa null */
export function newestBackupAge(dir: string, now = Date.now()): number | null {
  let newest = -1;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.startsWith(PREFIX) || !f.endsWith('.sqlite')) continue;
      newest = Math.max(newest, fs.statSync(path.join(dir, f)).mtimeMs);
    }
  } catch { return null; }
  return newest < 0 ? null : Math.max(0, now - newest);
}

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
