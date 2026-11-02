import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INBOX_TEXT, TEAM_GIFT_ANON } from '@odi/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { Db } from '../src/db';
import { MIGRATIONS, addColumn, runMigrations, userVersion, type Migration } from '../src/migrations';
import { dayNumber } from '../src/time';

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

  it('göç 7–8: aylık sınırı değiştirmiş oyuncu seçmiş sayılır; eski Sezon Kartı birikir biçimine çevrilir', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-goc-'));
    const file = path.join(tmp, 'eski.sqlite');
    const old = new Db(file);
    const DAY = 86_400_000; const buy = Date.UTC(2026, 9, 14, 9); // 12:00 İstanbul
    const ins = (id: string, limit: number, pending: number | null, passUntil: number) => old.run(
      'INSERT INTO players(id, token_hash, name, color, friend_code, depot_at, created_at, last_seen, spend_limit, spend_pending, pass_until) VALUES(?, ?, ?, 0, ?, 0, 0, 0, ?, ?, ?)',
      id, `h${id}`, id, `K${id}`, limit, pending, passUntil);
    ins('varsayilan', 1000, null, 0); ins('dusurmus', 250, null, 0); ins('bekleyen', 1000, 2000, 0); ins('kartli', 1000, null, buy + 28 * DAY);
    for (let i = 0; i < 3; i++) old.run("INSERT INTO inbox(id, player_id, kind, amount, ref, reason, at, claimed) VALUES(?, 'kartli', 'kristal', 30, 'odi.pass', 'Sezon Kartı günlük ödülü', ?, 1)", `i${i}`, buy + i * DAY);
    old.raw.exec('PRAGMA user_version = 6');
    old.close();
    const db = new Db(file);
    expect(userVersion(db.raw)).toBe(MIGRATIONS.length);
    const sec = db.all<{ id: string; spend_chosen: number }>('SELECT id, spend_chosen FROM players ORDER BY id');
    expect(Object.fromEntries(sec.map((r) => [r.id, r.spend_chosen]))).toEqual({ bekleyen: 1, dusurmus: 1, kartli: 0, varsayilan: 0 });
    expect(db.get('SELECT pass_start, pass_days, pass_paid FROM players WHERE id = ?', 'kartli')).toEqual({ pass_start: dayNumber(buy), pass_days: 28, pass_paid: 3 });
    expect(db.get('SELECT pass_start, pass_days, pass_paid FROM players WHERE id = ?', 'varsayilan')).toEqual({ pass_start: 0, pass_days: 0, pass_paid: 0 });
    db.close();
  });

  it('göç 9: satın alma hediyesi jetonu sütunları eklenir; var olan cüzdan ve sıradaki inşaat bağışlanabilir jetonla başlar', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-goc-'));
    const file = path.join(tmp, 'eski.sqlite');
    const old = new Db(file);
    old.run('INSERT INTO players(id, token_hash, name, color, friend_code, depot_at, created_at, last_seen, jeton) VALUES(?, ?, ?, 0, ?, 0, 0, 0, 500)', 'p1', 'h1', 'p1', 'K1');
    old.run('INSERT INTO camp_queue(player_id, id, to_level, jeton, at) VALUES(?, ?, 1, 80, 0)', 'p1', 'depo');
    // göç 8 sonrası şema: göç 9'un sütunları yok
    old.raw.exec('ALTER TABLE players DROP COLUMN gift_jeton; ALTER TABLE camp_queue DROP COLUMN gift_jeton; PRAGMA user_version = 8');
    old.close();
    const db = new Db(file);
    expect(userVersion(db.raw)).toBe(MIGRATIONS.length);
    expect(db.get('SELECT jeton, gift_jeton FROM players WHERE id = ?', 'p1')).toEqual({ jeton: 500, gift_jeton: 0 });
    expect(db.get('SELECT jeton, gift_jeton FROM camp_queue WHERE player_id = ?', 'p1')).toEqual({ jeton: 80, gift_jeton: 0 });
    db.close();
  });

  it('göç 10 (YN-071): kayıtlı Takım Akışı kamp kartının bozuk cümlesi meta öğelerinden yeniden kurulur', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-goc-'));
    const file = path.join(tmp, 'eski.sqlite');
    const old = new Db(file);
    const kart = (id: string, text: string, items: string) => old.run("INSERT INTO chat(id, room, from_id, name, color, text, kind, at, meta) VALUES(?, 'takim:t1', 'sistem', 'Sistem', 0, ?, 'feed', 1, ?)",
      id, text, JSON.stringify({ type: 'bina', pid: 'p1', pname: 'DrMelis', items }));
    kart('m1', 'DrMelis kampında Timpanometri Kulesi kurdu yaptı.', 'Timpanometri Kulesi kurdu');
    kart('m2', 'DrMelis kampında Kulak Kepçesi 3. seviye yaptı.', 'Kulak Kepçesi 3. seviye');
    kart('m3', 'DrMelis kampında 2 binayı geliştirdi: Timpanometri Kulesi kurdu, Kulak Kepçesi 3. seviye.', 'Timpanometri Kulesi kurdu,Kulak Kepçesi 3. seviye');
    old.run("INSERT INTO chat(id, room, from_id, name, color, text, kind, at, meta) VALUES('m4', 'takim:t1', 'p1', 'DrMelis', 0, 'kurdu yaptı.', 'text', 1, NULL)");
    old.raw.exec('PRAGMA user_version = 9');
    old.close();
    const db = new Db(file);
    expect(userVersion(db.raw)).toBe(MIGRATIONS.length);
    const t = (id: string) => db.get<{ text: string }>('SELECT text FROM chat WHERE id = ?', id)?.text;
    expect(t('m1')).toBe('DrMelis kampında Timpanometri Kulesi kurdu.');
    expect(t('m2')).toBe('DrMelis kampında Kulak Kepçesi yapısını 3. seviyeye yükseltti.');
    expect(t('m3')).toBe('DrMelis kampında 2 binayı geliştirdi: Timpanometri Kulesi (yeni), Kulak Kepçesi (3. seviye).');
    expect(t('m4')).toBe('kurdu yaptı.'); // oyuncunun yazdığı metne dokunulmaz
    db.close();
  });

  it('göç 12 (YN-097, karar 39): satın alma hediyesinin kartı, ödül kutusu kopyası ve sohbet duyurusu adsız olur', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-goc-'));
    const file = path.join(tmp, 'eski.sqlite');
    const old = new Db(file);
    const hediye = (id: string, from: string, name: string, reason: string) => old.run(
      "INSERT INTO team_gifts(id, team_id, from_id, from_name, reason, contents, at, expires_at) VALUES(?, 't1', ?, ?, ?, '[]', 1, 2)", id, from, name, reason);
    hediye('g1', 'p1', 'Hesapli', 'Hesapli takıma hediye gönderdi (Başlangıç Paketi)');
    hediye('g2', 'sistem', 'Baskın', 'Gürültü Canavarı yenildi');
    old.run("INSERT INTO inbox(id, player_id, kind, amount, ref, reason, at) VALUES('i1', 'p2', 'jeton', 50, 'x', ?, 1)", INBOX_TEXT.giftMoved('Hesapli takıma hediye gönderdi (Başlangıç Paketi)'));
    old.run("INSERT INTO inbox(id, player_id, kind, amount, ref, reason, at) VALUES('i2', 'p2', 'jeton', 50, 'x', ?, 1)", INBOX_TEXT.giftMoved('Gürültü Canavarı yenildi'));
    const sohbet = (id: string, from: string, text: string, meta: string | null) => old.run(
      "INSERT INTO chat(id, room, from_id, name, color, text, kind, at, meta) VALUES(?, 'takim:t1', ?, 'x', 0, ?, 'system', 1, ?)", id, from, text, meta);
    sohbet('m1', 'sistem', 'Hesapli takıma hediye gönderdi! Hediye kutunuza bakın.', JSON.stringify({ product: 'odi.baslangic' }));
    sohbet('m2', 'p1', 'Hesapli takıma hediye gönderdi! Hediye kutunuza bakın.', null); // oyuncunun yazdığına dokunulmaz
    old.raw.exec('PRAGMA user_version = 11');
    old.close();
    const db = new Db(file);
    expect(userVersion(db.raw)).toBe(MIGRATIONS.length);
    expect(db.get('SELECT from_name, reason FROM team_gifts WHERE id = ?', 'g1')).toEqual({ from_name: TEAM_GIFT_ANON.fromName, reason: TEAM_GIFT_ANON.reason('Başlangıç Paketi') });
    expect(db.get('SELECT from_name, reason FROM team_gifts WHERE id = ?', 'g2')).toEqual({ from_name: 'Baskın', reason: 'Gürültü Canavarı yenildi' });
    const kutu = (id: string) => db.get<{ reason: string }>('SELECT reason FROM inbox WHERE id = ?', id)?.reason;
    expect(kutu('i1')).toBe(INBOX_TEXT.giftMoved(TEAM_GIFT_ANON.reason('Başlangıç Paketi')));
    expect(kutu('i2')).toBe(INBOX_TEXT.giftMoved('Gürültü Canavarı yenildi'));
    const t = (id: string) => db.get<{ text: string }>('SELECT text FROM chat WHERE id = ?', id)?.text;
    expect(t('m1')).toBe(TEAM_GIFT_ANON.chat);
    expect(t('m2')).toBe('Hesapli takıma hediye gönderdi! Hediye kutunuza bakın.');
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
