import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { Db } from '../src/db';
import { MIGRATIONS, addColumn, runMigrations, userVersion, type Migration } from '../src/migrations';

let tmp = '';
afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); tmp = ''; });

describe('şema sürümü ve göçler', () => {
  it('yeni veritabanı en son sürümde açılır; sürümsüz eski dosya (user_version 0) verisiyle birlikte yükseltilir', () => {
    const fresh = new Db(':memory:');
    expect(userVersion(fresh.raw)).toBe(MIGRATIONS.length);
    fresh.close();
    // eski sürümün yazdığı dosya: tablolar var, user_version 0
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-goc-'));
    const file = path.join(tmp, 'eski.sqlite');
    const old = new Db(file);
    old.raw.exec('PRAGMA user_version = 0');
    old.run("INSERT INTO meta(k, v) VALUES('eski', 'veri')");
    old.close();
    const db = new Db(file);
    expect(userVersion(db.raw)).toBe(MIGRATIONS.length);
    expect(db.metaGet('eski')).toBe('veri');
    db.close();
  });

  it('bekleyenler sırayla uygulanır, addColumn tekrar güvenli; hatalı göç geri alınır ve sürüm ilerlemez; yeni şema uyarı verir', () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, a TEXT); INSERT INTO t(a) VALUES (\'x\')');
    const list: Migration[] = [
      { name: 'b ekle', up: (d) => addColumn(d, 't', 'b', "INTEGER NOT NULL DEFAULT 7") },
      { name: 'b tekrar', up: (d) => addColumn(d, 't', 'b', "INTEGER NOT NULL DEFAULT 7") },
    ];
    expect(runMigrations(raw, list)).toEqual({ from: 0, to: 2 });
    expect(raw.prepare('SELECT a, b FROM t').get()).toEqual({ a: 'x', b: 7 });
    expect(runMigrations(raw, list)).toEqual({ from: 2, to: 2 });
    const bad: Migration[] = [...list, { name: 'bozuk', up: (d) => { d.exec('UPDATE t SET a = \'y\''); d.exec('ALTER TABLE yok ADD COLUMN c INTEGER'); } }];
    expect(() => runMigrations(raw, bad)).toThrow(/Şema göçü 3 \(bozuk\)/);
    expect(userVersion(raw)).toBe(2);
    expect(raw.prepare('SELECT a FROM t').get()).toEqual({ a: 'x' }); // yarım göç geri alındı
    expect(runMigrations(raw, list.slice(0, 1)).warning).toMatch(/yeni/);
    raw.close();
  });
});
