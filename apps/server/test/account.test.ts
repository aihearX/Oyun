import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { DELETED_PLAYER_NAME } from '@odi/shared';
import { VERI_SINIFI, type Kural } from '../src/account-veri';
import { Db } from '../src/db';
import { run, setup, type Env, type TC } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
async function befriend(a: TC, b: TC) {
  const r = await a.call('friends.request', { id: b.me!.id });
  await b.call('friends.respond', { requestId: r.request!.id, accept: true });
}

describe('hesabı silme (account.delete)', () => {
  it('takımdan çıkar (liderlik devreder), arkadaşlık/özel mesaj/sohbet silinir, ad anonim, anahtar geçersiz, sıralama ve aramada yok', async () => {
    env = await setup({ freeTextCleared: 0 });
    const app = env.srv.app;
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora'); const c = await env.connect('Cem');
    const aid = a.me!.id;
    await a.call('progress.submit', run(1, { stars: 3 }));
    await c.call('progress.submit', run(1, { stars: 1 }));
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await b.call('team.join', { teamId: t.id });
    await befriend(a, c);
    env.clock.advance(1000);
    await a.call('dm.send', { to: c.me!.id, text: 'selam Cem' });
    await a.call('chat.send', { room: `takim:${t.id}`, text: 'takıma selam' });
    expect((await c.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.map((r) => r.name)).toContain('Ayşe');
    c.drain();

    expect(await a.call('account.delete', {})).toEqual({ deleted: true });
    // aynı bağlantıyla silinen hesap adına işlem yapılamaz
    await expect(a.call('wallet.get', {})).rejects.toMatchObject({ code: 'OTURUM' });

    // takım: Bora kaldı ve lider oldu
    const team = (await b.call('team.detail', {})).team!;
    expect(team.roster.map((m) => m.id)).toEqual([b.me!.id]);
    expect(team.roster[0]!.role).toBe('lider');
    // arkadaş: Cem'e bildirildi, listeden düştü; özel mesaj konuşması yok
    expect((await c.waitFor('friend.removed')).id).toBe(aid);
    expect((await c.call('friends.list', {})).friends).toEqual([]);
    expect((await c.call('dm.threads', {})).threads).toEqual([]);
    // sohbet mesajı silindi
    expect(app.db.all('SELECT 1 AS x FROM chat WHERE from_id = ?', aid)).toEqual([]);
    // ad anonim, aramada ve sıralamada yok
    expect(app.player(aid).name).toBe(DELETED_PLAYER_NAME);
    expect((await c.call('players.search', { query: 'Silinmiş' })).players).toEqual([]);
    expect((await c.call('players.search', { query: 'Ayşe' })).players).toEqual([]);
    expect((await c.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.map((r) => r.name)).toEqual(['Cem']);
    // eski anahtar artık tanınmaz: istemci yeni hesapla başlar
    const again = await env.connect(undefined, a.token);
    expect(again.me!.id).not.toBe(aid);
    expect(app.db.get('SELECT player_id FROM deleted_players WHERE player_id = ?', aid)).toEqual({ player_id: aid });
  });

  it('takımın son üyesi silinince takım da silinir', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const t = (await a.call('team.create', { name: 'Tekler', emblem: '👂' })).team;
    await a.call('account.delete', {});
    expect(env.srv.app.db.get('SELECT 1 AS x FROM teams WHERE id = ?', t.id)).toBeUndefined();
  });

  it('/saglik players silinen hesabı saymaz (uzak denetim D5: sayı başlangıçtaki değere döner)', async () => {
    env = await setup();
    const saglik = async () => (await (await fetch(env!.srv.httpUrl + '/saglik')).json()) as { players: number };
    const a = await env.connect('Ayşe');
    const b = await env.connect('Bora');
    expect((await saglik()).players).toBe(2);
    await b.call('account.delete', {});
    expect((await saglik()).players).toBe(1);
    await a.call('account.delete', {});
    expect((await saglik()).players).toBe(0);
  });
});

describe('IP başına yeni hesap sınırı (ODI_NEW_PER_IP_HOUR)', () => {
  it('kapalıyken sınırsız; açıkken saatte N yeni hesap, sonra HIZ; anahtarlı giriş etkilenmez; saat geçince açılır', async () => {
    const { allowNewAccount } = await import('../src/players');
    env = await setup({ newAccountsPerIpHour: 2 });
    const a = await env.connect('Ayşe'); await env.connect('Bora');
    // üçüncü anahtarsız hello (aynı IP: 127.0.0.1) reddedilir
    const ws = new WebSocket(env.srv.url);
    await new Promise((r) => ws.addEventListener('open', r));
    const res = await new Promise<{ ok: boolean; code?: string }>((r) => { ws.addEventListener('message', (m) => r(JSON.parse(String(m.data)))); ws.send(JSON.stringify({ t: 'req', id: 1, op: 'hello', data: { version: 1, name: 'Cem' } })); });
    ws.close();
    expect(res).toMatchObject({ ok: false, code: 'HIZ' });
    // var olan hesap anahtarıyla girer
    const again = await env.connect(undefined, a.token);
    expect(again.me!.name).toBe('Ayşe');
    env.clock.advance(3_600_000);
    expect(allowNewAccount(env.srv.app, '127.0.0.1')).toBe(true);
    // farklı IP ayrı sayılır; sınır kapalıyken hep açık
    expect(allowNewAccount(env.srv.app, '10.0.0.9')).toBe(true);
    expect(allowNewAccount({ cfg: {}, now: () => 0 } as never, '1.1.1.1')).toBe(true);
  });
});

// ------------------------------------------------------------------ YN-029: sınıflandırma tablosu ve tam silme

type Tur = 'oyuncu' | 'takim';
const KIMLIK_RE = /^(id|a|b|room|pair|mentor|apprentice|reporter|target|starter|carrier|last_runner|team_a|team_b|owner)$|_id$|_by$|(^|_)name$/;
interface Col { name: string; type: string; pk: number }
const tablolar = (db: DatabaseSync) => (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
const sutunlar = (db: DatabaseSync, t: string) => db.prepare(`PRAGMA table_info(${t})`).all() as unknown as Col[];
const say = (db: DatabaseSync, sql: string, ...p: SQLInputValue[]) => (db.prepare(`SELECT COUNT(*) AS n FROM (${sql})`).get(...p) as { n: number }).n;
const kosul = (c: string, k: Kural) => k.kosul ?? `${c} = ?`;
const soru = (sql: string) => (sql.match(/\?/g) ?? []).length;
const kurallar = (tur: Tur) => Object.entries(VERI_SINIFI).flatMap(([t, d]) => Object.entries(d[tur] ?? {}).map(([c, k]) => ({ t, c, k })));

/** Kimliği her kurala ayrı bir yapay satırla yazar (gerçek akışın üretmediği tablolar da kapsansın); bağlı tablolara da çocuk satır. */
function yapayVeri(db: DatabaseSync, tur: Tur, id: string, ad: string): void {
  let n = 0;
  const ekle = (t: string, ozel: Record<string, SQLInputValue>) => {
    const cols = sutunlar(db, t); const names: string[] = []; const vals: SQLInputValue[] = [];
    const rowidPk = cols.filter((c) => c.pk).length === 1 && cols.some((c) => c.pk && /INT/i.test(c.type));
    for (const c of cols) {
      if (c.name in ozel) { names.push(c.name); vals.push(ozel[c.name]!); continue; }
      if (rowidPk && c.pk) continue;
      n++; names.push(c.name); vals.push(/INT|REAL/i.test(c.type) ? 1_000_000 + n : `yapay${n}`);
    }
    db.prepare(`INSERT OR IGNORE INTO ${t}(${names.join(', ')}) VALUES(${names.map(() => '?').join(', ')})`).run(...vals);
  };
  for (const { t, c, k } of kurallar(tur)) {
    if (t === 'players' || t === 'deleted_players' || t === 'teams') continue;
    const ozel: Record<string, SQLInputValue> = {};
    if (t === 'chat' && c === 'meta') ozel.meta = JSON.stringify({ type: 'yardim', pid: id, pname: ad });
    else if (t === 'chat' && c === 'room') ozel.room = `takim:${id}`;
    else if (t === 'tr_match' && c === 'room') ozel.room = JSON.stringify({ players: [{ id, name: ad, hat: 'tac' }, { id: 'baska', name: 'Başka', hat: '' }] });
    else ozel[c] = id;
    for (const x of Object.keys(k.degistir ?? {})) if (VERI_SINIFI[t]!.adKopyasi?.[x]) ozel[x] = ad;
    ekle(t, ozel);
  }
  for (const [t, d] of Object.entries(VERI_SINIFI)) {
    for (const b of d.bagli ?? []) {
      if (b.tur !== tur) continue;
      const parent = db.prepare(b.kaynak).all(...Array<string>(soru(b.kaynak)).fill(id)) as Record<string, string>[];
      expect(parent.length, `${t}.${b.sutun}: yapay üst satır yok`).toBeGreaterThan(0);
      ekle(t, { [b.sutun]: Object.values(parent[0]!)[0]! });
    }
  }
}

/** silme sonrası: "sil" kurallarında satır yok, bağlı satırlar yok, anonim/tut satırları duruyor */
function silindiMi(db: DatabaseSync, tur: Tur, id: string, bagliOnce: Map<string, string[]>, tutulan = true): void {
  for (const { t, c, k } of kurallar(tur)) {
    const where = kosul(c, k); const args = Array<string>(soru(where)).fill(id);
    const kalan = say(db, `SELECT 1 FROM ${t} WHERE ${where}`, ...args);
    if (k.karar === 'sil') expect(kalan, `${t}.${c} (sil): satır kaldı`).toBe(0);
    else if (!tutulan) continue;
    else if (t === 'purchases') expect(say(db, "SELECT 1 FROM purchases WHERE player_id = 'silinmis'"), 'purchases: silindi işareti').toBeGreaterThan(0);
    else if (!(c in (k.degistir ?? {})) && t !== 'players') expect(kalan, `${t}.${c} (${k.karar}): satır tutulmalıydı`).toBeGreaterThan(0);
  }
  for (const [key, ids] of bagliOnce) {
    const [t, c] = key.split('.') as [string, string];
    expect(say(db, `SELECT 1 FROM ${t} WHERE ${c} IN (${ids.map(() => '?').join(', ')})`, ...ids), `${key} (bağlı): satır kaldı`).toBe(0);
  }
}
function bagliKimlikler(db: DatabaseSync, tur: Tur, id: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [t, d] of Object.entries(VERI_SINIFI)) for (const b of d.bagli ?? []) {
    if (b.tur !== tur) continue;
    const ids = (db.prepare(b.kaynak).all(...Array<string>(soru(b.kaynak)).fill(id)) as Record<string, string>[]).map((r) => Object.values(r)[0]!);
    if (ids.length) m.set(`${t}.${b.sutun}`, [...(m.get(`${t}.${b.sutun}`) ?? []), ...ids]);
  }
  return m;
}
/** veritabanının hiçbir metin sütununda ad geçmez */
function adYok(db: DatabaseSync, ad: string): void {
  const bulunan: string[] = [];
  for (const t of tablolar(db)) for (const c of sutunlar(db, t)) {
    const n = say(db, `SELECT 1 FROM ${t} WHERE instr(CAST(${c.name} AS TEXT), ?) > 0`, ad);
    if (n) bulunan.push(`${t}.${c.name} (${n})`);
  }
  expect(bulunan, `"${ad}" adı kaldı`).toEqual([]);
}

describe('veri sınıflandırması (YN-029, account-veri.ts)', () => {
  it('şemadaki her tablo ve oyuncu/takım/ad sütunu sınıflandırılmış; sınıflandırma şemayla tutarlı (yeni tablo eklenince bu test düşer)', () => {
    const db = new Db(':memory:');
    try {
      const sema = tablolar(db.raw);
      const eksikTablo = sema.filter((t) => !VERI_SINIFI[t]);
      expect(eksikTablo, 'account-veri.ts VERI_SINIFI içinde olmayan tablolar: her biri için sil / anonim / tut kararı yazın').toEqual([]);
      expect(Object.keys(VERI_SINIFI).filter((t) => !sema.includes(t)), 'şemada olmayan tablo sınıflandırılmış').toEqual([]);
      const eksik: string[] = []; const yok: string[] = []; const gerekce: string[] = [];
      for (const t of sema) {
        const d = VERI_SINIFI[t]!; const cols = new Set(sutunlar(db.raw, t).map((c) => c.name));
        const degistirilen = new Set([...Object.values(d.oyuncu ?? {}), ...Object.values(d.takim ?? {})].flatMap((k) => Object.keys(k.degistir ?? {})));
        const karar = new Set([...Object.keys(d.oyuncu ?? {}), ...Object.keys(d.takim ?? {}), ...(d.degil ?? []), ...Object.keys(d.adKopyasi ?? {}), ...degistirilen]);
        for (const c of cols) if (KIMLIK_RE.test(c) && !karar.has(c)) eksik.push(`${t}.${c}`);
        const anilan = [...karar, ...(d.bagli ?? []).map((b) => b.sutun), ...(d.metinAd ?? []).flatMap((m) => [m.sutun, m.zaman]), ...Object.values(d.adKopyasi ?? {})];
        for (const c of anilan) if (!cols.has(c)) yok.push(`${t}.${c}`);
        for (const [tur, rules] of [['oyuncu', d.oyuncu], ['takim', d.takim]] as const) for (const [c, k] of Object.entries(rules ?? {})) {
          if (k.karar !== 'sil' && !k.neden) gerekce.push(`${t}.${c} (${tur}): neden yok`);
          if (k.karar === 'tut' && !k.sure) gerekce.push(`${t}.${c} (${tur}): süre yok`);
        }
        // ad kopyası: kimliği anonim/tut kalan bir satırdaki ad, o kuralda silinmeli
        for (const [ad, kimlik] of Object.entries(d.adKopyasi ?? {})) {
          const k = d.oyuncu?.[kimlik];
          if (k && k.karar !== 'sil' && t !== 'players' && !(ad in (k.degistir ?? {}))) gerekce.push(`${t}.${ad}: ${kimlik} ${k.karar} ama ad kopyası silinmiyor`);
        }
      }
      expect(eksik, 'kimlik/ad gibi görünen ama sınıflandırılmamış sütunlar (account-veri.ts: oyuncu / takim / degil / adKopyasi)').toEqual([]);
      expect(yok, 'sınıflandırmada adı geçen ama şemada olmayan sütunlar').toEqual([]);
      expect(gerekce).toEqual([]);
    } finally { db.close(); }
  });

  it('her kategoride veri üreten oyuncu silinince "sil" tablolarında satırı, hiçbir yerde adı kalmaz; takım arkadaşı, arkadaş ve sıralama bozulmaz', async () => {
    env = await setup({ freeTextCleared: 0 });
    const app = env.srv.app; const raw = app.db.raw;
    const AD = 'Zeyrekqx';
    const z = await env.connect(AD); const b = await env.connect('Bora'); const c = await env.connect('Cem'); const d = await env.connect('Derya');
    const zid = z.me!.id;
    // gerçek akış: ilerleme, takım, sohbet, yardım isteği, arkadaşlık, hediye, özel mesaj, kamp
    for (const lv of [1, 2, 3]) await z.call('progress.submit', run(lv, { stars: 3 }));
    await b.call('progress.submit', run(1, { stars: 2 }));
    await c.call('progress.submit', run(1, { stars: 1 }));
    const t = (await z.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await b.call('team.join', { teamId: t.id });
    await z.call('chat.send', { room: `takim:${t.id}`, text: 'takıma selam' });
    await z.call('team.help.request', { level: 2 });
    await befriend(z, c); await befriend(c, d);
    await z.call('friends.gift', { id: c.me!.id });
    await z.call('dm.send', { to: c.me!.id, text: 'selam Cem' });
    await z.call('camp.state', {});
    // takımın toplamı satırların toplamı olan bir tablo (anonim): düello puanı
    raw.prepare('INSERT INTO ev_duel_pts(period, team_id, player_id, points) VALUES(?, ?, ?, ?), (?, ?, ?, ?)').run('P1', t.id, zid, 30, 'P1', t.id, b.me!.id, 20);
    yapayVeri(raw, 'oyuncu', zid, AD);
    const bagli = bagliKimlikler(raw, 'oyuncu', zid);
    const sira = async () => (await c.call('rank.board', { board: 'guc', scope: 'herkes' })).view.rows.map((r) => [r.name, r.value]);
    const once = { team: (await b.call('team.detail', {})).team!, sira: (await sira()).filter(([n]) => n !== AD) };
    expect(say(raw, 'SELECT 1 FROM buildings WHERE player_id = ?', zid)).toBeGreaterThan(1);

    expect(await z.call('account.delete', {})).toEqual({ deleted: true });

    silindiMi(raw, 'oyuncu', zid, bagli);
    adYok(raw, AD);
    // takım arkadaşı: takım, lider, takım XP'si ve düello toplamı aynı
    const sonra = (await b.call('team.detail', {})).team!;
    expect(sonra.roster.map((m) => [m.id, m.role])).toEqual([[b.me!.id, 'lider']]);
    expect(sonra.xp).toBe(once.team.xp);
    expect(raw.prepare("SELECT SUM(points) AS p FROM ev_duel_pts WHERE period = 'P1' AND team_id = ?").get(t.id)).toEqual({ p: 50 });
    // arkadaş: Cem'in listesinde Derya kaldı
    expect((await c.call('friends.list', {})).friends.map((f) => f.id)).toEqual([d.me!.id]);
    // sıralama: başkalarının sırası ve değeri aynı
    expect(await sira()).toEqual(once.sira);
    // anonim oyuncu satırı: kişisel ve ilerleme alanları sıfır
    expect(raw.prepare('SELECT name, xp, highest, stars, jeton, cosmetics, team_id FROM players WHERE id = ?').get(zid))
      .toEqual({ name: DELETED_PLAYER_NAME, xp: 0, highest: 1, stars: 0, jeton: 0, cosmetics: '[]', team_id: null });
  });

  it('takımın tek üyesi hesabını silince takım ve takıma bağlı bütün veri (ev_* dahil) silinir; rakip takımın geçmişi kalır', async () => {
    env = await setup();
    const raw = env.srv.app.db.raw;
    const a = await env.connect('Tekin');
    const t = (await a.call('team.create', { name: 'Tekler', emblem: '👂' })).team;
    await a.call('progress.submit', run(1, { stars: 3 }));
    await a.call('chat.send', { room: `takim:${t.id}`, text: 'merhaba' });
    yapayVeri(raw, 'takim', t.id, 'Tekler');
    const bagli = bagliKimlikler(raw, 'takim', t.id);
    await a.call('account.delete', {});
    silindiMi(raw, 'takim', t.id, bagli);
  });

  it('göç: sınıflandırmadan önce silinmiş hesapların ve silinmiş takımların artıkları temizlenir; yeniden açılışta kamp tohumu geri gelmez', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'odi-hesapsil-'));
    const file = path.join(dir, 'odi.sqlite');
    try {
      const old = new Db(file);
      const pid = 'p_eski'; const tid = 't_eski';
      old.raw.prepare(`INSERT INTO players(id, token_hash, name, color, friend_code, depot_at, created_at, last_seen, xp, jeton) VALUES(?, ?, ?, 1, 'F1', 0, 0, 0, 500, 900)`).run(pid, `silindi:${pid}`, DELETED_PLAYER_NAME);
      old.raw.prepare('INSERT INTO deleted_players(player_id, at) VALUES(?, 1)').run(pid);
      yapayVeri(old.raw, 'oyuncu', pid, 'Eski');
      yapayVeri(old.raw, 'takim', tid, 'Eski Takım');
      const bagliO = bagliKimlikler(old.raw, 'oyuncu', pid); const bagliT = bagliKimlikler(old.raw, 'takim', tid);
      old.raw.exec("INSERT OR IGNORE INTO buildings(player_id, id, level) VALUES('p_eski', 'tedavi', 0)");
      old.raw.exec('PRAGMA user_version = 1'); // göç 2 henüz uygulanmamış eski dosya
      old.close();
      const db = new Db(file);
      try {
        // yapay satırların öteki sütunları var olmayan takımlara işaret eder: göç onları da sahipsiz takım satırı olarak siler
        silindiMi(db.raw, 'oyuncu', pid, bagliO, false);
        silindiMi(db.raw, 'takim', tid, bagliT, false);
        expect(db.raw.prepare('SELECT xp, jeton FROM players WHERE id = ?').get(pid)).toEqual({ xp: 0, jeton: 0 });
      } finally { db.close(); }
      // yeniden açılış: kamp şeması silinen hesaba bina satırı eklemez
      const again = new Db(file);
      try { expect(say(again.raw, 'SELECT 1 FROM buildings WHERE player_id = ?', pid)).toBe(0); } finally { again.close(); }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('şikâyet kayıtları silinen hesaptan sonra 90 gün tutulur, sonra silinir', async () => {
    const { pruneDeletedReports } = await import('../src/account');
    env = await setup();
    const app = env.srv.app;
    const a = await env.connect('Ayşe'); const b = await env.connect('Bora');
    app.db.run("INSERT INTO player_reports(target, reporter, msg_id, reason, at) VALUES(?, ?, '', 'kufur', ?)", a.me!.id, b.me!.id, app.now());
    await a.call('account.delete', {});
    pruneDeletedReports(app);
    expect(app.db.all('SELECT 1 AS x FROM player_reports')).toHaveLength(1);
    env.clock.advance(91 * 24 * 3_600_000);
    pruneDeletedReports(app);
    expect(app.db.all('SELECT 1 AS x FROM player_reports')).toHaveLength(0);
  });
});
