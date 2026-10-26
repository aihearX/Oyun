import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { backupNow, newestBackupAge, STARTUP_BACKUP_MIN_GAP_MS } from '../src/backup';
import { configFromEnv, startServer, type OdiServer } from '../src/server';

let srv: OdiServer | undefined;
let tmp = '';
afterEach(async () => { await srv?.close(); srv = undefined; if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

describe('veritabanı yedeği', () => {
  it('açılışta tutarlı kopya yazar, en yeni N dosyayı tutar; ortam değişkenleri', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-yedek-'));
    const dir = path.join(tmp, 'yedek');
    srv = await startServer({ port: 0, host: '127.0.0.1', dbFile: path.join(tmp, 'odi.sqlite'), backupDir: dir, backupKeep: 2 });
    const first = fs.readdirSync(dir);
    expect(first.length).toBe(1);
    srv.app.db.run("INSERT INTO meta(k, v) VALUES('yedek-deneme', 'evet')");
    // aynı saniyede ikinci çağrı aynı adı kullanır; farklı adlar için bekle
    await new Promise((r) => setTimeout(r, 1100)); backupNow(srv.app, dir, 2);
    await new Promise((r) => setTimeout(r, 1100)); const last = backupNow(srv.app, dir, 2);
    expect(fs.readdirSync(dir).length).toBe(2);
    const copy = new DatabaseSync(last, { readOnly: true });
    expect(copy.prepare("SELECT v FROM meta WHERE k = 'yedek-deneme'").get()).toEqual({ v: 'evet' });
    copy.close();
    // art arda yeniden açılış (çökme döngüsü) yeni açılış yedeği yazmaz: eski yedekler korunur
    await srv.close();
    srv = await startServer({ port: 0, host: '127.0.0.1', dbFile: path.join(tmp, 'odi.sqlite'), backupDir: dir, backupKeep: 2 });
    expect(fs.readdirSync(dir).sort()).toContain(path.basename(last));
    expect(fs.readdirSync(dir).length).toBe(2);
    expect(newestBackupAge(dir)).toBeLessThan(STARTUP_BACKUP_MIN_GAP_MS);
    expect(newestBackupAge(path.join(tmp, 'yok'))).toBeNull();
    expect(configFromEnv({ ODI_BACKUP_DIR: '/veri/yedek', ODI_BACKUP_HOURS: '12', ODI_BACKUP_KEEP: '10' })).toMatchObject({ backupDir: '/veri/yedek', backupHours: 12, backupKeep: 10 });
  });
});
