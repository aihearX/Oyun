import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { NetError } from '@odi/net';
import { TEAM_APPLY_RULES, type TeamBrowseRow, type TeamDetail } from '@odi/shared';
import { setup, run, type Env, type TC } from './helpers';
import { hashAdminCode } from '../src/codes';

let env: Env;
afterEach(async () => { await env?.close(); });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };
/** listedeki satır (ada göre) */
const rowOf = async (c: TC, name: string, filter?: 'hepsi' | 'acik' | 'basvuru' | 'uygun'): Promise<TeamBrowseRow> => (await c.call('team.list', { query: name, ...(filter ? { filter } : {}) })).teams.find((t) => t.name === name)!;
/** bölüm geçerek en yüksek açık bölümü yükselt */
async function climb(c: TC, upTo: number) { for (let l = 1; l < upTo; l++) await c.call('progress.submit', run(l)); }

describe('takım bulma ve başvuru', () => {
  it('her takım listede: güç sırası, arama, filtreler, sayfalama, satır durumu ve salt okunur profil', async () => {
    env = await setup();
    const [a, b, c, d] = [await env.connect('Ayşe'), await env.connect('Bora'), await env.connect('Cem'), await env.connect('Deniz')];
    const ta = (await a.call('team.create', { name: 'Açık Kulaklar', emblem: '👂', description: 'Herkes gelsin' })).team;
    const tb = (await b.call('team.create', { name: 'Başvurulu Kepçe', emblem: '🐚', open: false })).team;
    await climb(c, 3);
    const tc = (await c.call('team.create', { name: 'Şartlı Çekiç', emblem: '🔨', open: false, minLevel: 3 })).team;
    await a.call('progress.submit', run(1));
    await climb(b, 3); // b daha güçlü
    const all = await d.call('team.list', {});
    expect(all.total).toBe(3);
    expect(all.next).toBeNull();
    // Sıralama "Takım gücü" sırası (b: 2 bölüm, c: 2 bölüm, a: 1 bölüm; eşitlikte ada göre)
    expect(all.teams.map((t) => t.name)).toEqual(['Başvurulu Kepçe', 'Şartlı Çekiç', 'Açık Kulaklar']);
    expect(all.teams.map((t) => t.rank)).toEqual([1, 1, 3]);
    expect(all.teams[0]!.rankPower).toBeGreaterThan(all.teams[2]!.rankPower!);
    expect(all.teams.map((t) => t.state)).toEqual(['basvur', 'seviye', 'katil']);
    expect(all.teams.every((t) => t.code === '' && t.leagueTier === 'bronz')).toBe(true);
    // filtreler
    expect((await d.call('team.list', { filter: 'acik' })).teams.map((t) => t.id)).toEqual([ta.id]);
    expect((await d.call('team.list', { filter: 'basvuru' })).teams.map((t) => t.id).sort()).toEqual([tb.id, tc.id].sort());
    expect((await d.call('team.list', { filter: 'uygun' })).teams.map((t) => t.id).sort()).toEqual([ta.id, tb.id].sort());
    expect((await d.call('team.list', { query: 'kepç' })).teams.map((t) => t.id)).toEqual([tb.id]);
    expect((await d.call('team.list', { query: 'Şartlı Çekiç' })).teams.map((t) => t.id)).toEqual([tc.id]);
    // sayfalama: 50 ile sınırlı değil
    const p1 = await d.call('team.list', { limit: 2 });
    expect(p1.teams).toHaveLength(2); expect(p1.next).toBe(2);
    const p2 = await d.call('team.list', { limit: 2, offset: p1.next! });
    expect(p2.teams.map((t) => t.id)).toEqual([ta.id]); expect(p2.next).toBeNull();
    // üyeye kendi takımının kodu görünür, başkasına görünmez (team.detail de)
    expect((await rowOf(a, 'Açık Kulaklar')).code).toBe(ta.code);
    expect((await d.call('team.detail', { teamId: tb.id })).team!.code).toBe('');
    expect((await b.call('team.detail', {})).team!.code).toBe(tb.code);
    // profil: üyeler + roller, güç, lig kademesi, düğme durumu; takımdaysa 'takimda'
    const prof = (await d.call('team.profile', { teamId: tb.id })).team;
    expect(prof).toMatchObject({ id: tb.id, joinMode: 'basvuru', state: 'basvur', code: '', leagueTier: 'bronz', rank: 1 });
    expect(prof.roster.map((m) => [m.name, m.role])).toEqual([['Bora', 'lider']]);
    expect((await a.call('team.profile', { teamId: tb.id })).team.state).toBe('takimda');
    expect((await a.call('team.profile', { teamId: ta.id })).team.state).toBe('uye');
  });

  it('başvur → lider bildirimi → kabul: oyuncu takımda, akış kartı, başvurana karar; ret ve hazır gerekçe', async () => {
    env = await setup();
    const [lead, b, c] = [await env.connect('Lider'), await env.connect('Bora'), await env.connect('Cem')];
    const t = (await lead.call('team.create', { name: 'Kepçe', emblem: '🐚', open: false })).team;
    expect((await err(b.call('team.join', { teamId: t.id }))).code).toBe('BASVURU');
    const ap = (await b.call('team.apply', { teamId: t.id, noteId: 'hergun' })).application;
    expect(ap).toMatchObject({ teamId: t.id, teamName: 'Kepçe', status: 'bekliyor', note: 'hergun', noteKind: 'hazir' });
    expect(ap.expiresAt - ap.at).toBe(TEAM_APPLY_RULES.ttlMs);
    const ev = await lead.waitFor('team.applications', (x) => x.applications.length === 1);
    expect(ev.applications[0]!.player.name).toBe('Bora');
    expect((await rowOf(b, 'Kepçe')).state).toBe('gonderildi');
    expect((await err(b.call('team.apply', { teamId: t.id }))).code).toBe('TEKRAR');
    const cAp = (await c.call('team.apply', { teamId: t.id })).application;
    expect(cAp.noteKind).toBe('yok');
    expect((await lead.call('team.applications', {})).applications.map((x) => x.player.name)).toEqual(['Bora', 'Cem']);
    // kabul
    const res = await lead.call('team.apply.decide', { applicationId: ap.id, accept: true });
    expect(res.application.status).toBe('kabul');
    expect(res.team.roster.map((m) => m.name).sort()).toEqual(['Bora', 'Lider']);
    expect(res.applications.map((x) => x.player.name)).toEqual(['Cem']);
    expect((await b.waitFor('team.apply.updated')).application.status).toBe('kabul');
    expect((await b.waitFor('team.updated', (x) => !!x.team)).team!.id).toBe(t.id);
    const hist = await lead.call('chat.join', { room: `takim:${t.id}` });
    expect(hist.history.some((m) => m.kind === 'feed' && m.text === 'Bora takıma katıldı.')).toBe(true);
    // ret: gerçek gerekçe yalnızca listeden
    expect((await err(lead.call('team.apply.decide', { applicationId: cAp.id, accept: false, reason: 'kotu' }))).code).toBe('GECERSIZ');
    const rej = await lead.call('team.apply.decide', { applicationId: cAp.id, accept: false, reason: 'aktif' });
    expect(rej.application).toMatchObject({ status: 'red', reason: 'aktif' });
    const upd = (await c.waitFor('team.apply.updated')).application;
    expect(upd).toMatchObject({ status: 'red', reason: 'aktif', seen: false });
    // başvurularım: karar görünür, görüldü işaretlenir
    const mine = (await c.call('team.apply.mine', {})).applications;
    expect(mine.map((x) => [x.status, x.seen])).toEqual([['red', false]]);
    expect((await c.call('team.apply.mine', { seen: true })).applications[0]!.seen).toBe(true);
    // karara bağlanmış başvuru ikinci kez karara bağlanamaz
    expect((await err(lead.call('team.apply.decide', { applicationId: cAp.id, accept: true }))).code).toBe('KARAR');
    // açık takıma başvurulmaz, doğrudan katılınır
    await lead.call('team.settings', { joinMode: 'acik' });
    expect((await err(c.call('team.apply', { teamId: t.id }))).code).toBe('ACIK');
    expect((await c.call('team.join', { teamId: t.id })).team.members).toBe(3);
  });

  it('lider ve yardımcı onaylar (üye onaylayamaz); karar veren kaydedilir ve takımda yazılır; aynı anda iki karar: ilki geçerli', async () => {
    env = await setup();
    const [lead, y, u, x, w] = [await env.connect('Lider'), await env.connect('Yardımcı'), await env.connect('Üye'), await env.connect('Aday'), await env.connect('İkinci')];
    const t = (await lead.call('team.create', { name: 'Onay', emblem: '👑' })).team;
    await y.call('team.join', { teamId: t.id }); await u.call('team.join', { teamId: t.id });
    await lead.call('team.role', { id: y.me!.id, role: 'yardimci' });
    await lead.call('team.settings', { joinMode: 'basvuru' });
    expect((await err(y.call('team.settings', { joinMode: 'acik' }))).code).toBe('YETKI'); // ayarlar yalnızca liderde
    const ap = (await x.call('team.apply', { teamId: t.id, noteId: 'merhaba' })).application;
    // üye onaylayamaz, listeyi göremez, bildirim almaz
    expect((await err(u.call('team.apply.decide', { applicationId: ap.id, accept: true }))).code).toBe('YETKI');
    expect((await err(u.call('team.applications', {}))).code).toBe('YETKI');
    // lider ve yardımcı bildirim alır ve listeyi görür
    await lead.waitFor('team.applications', (e) => e.applications.length === 1);
    await y.waitFor('team.applications', (e) => e.applications.length === 1);
    expect(u.log.some((e) => e.ev === 'team.applications')).toBe(false);
    expect((await y.call('team.applications', {})).applications.map((a) => a.id)).toEqual([ap.id]);
    // yardımcı kabul eder: karar veren kaydedilir, takım sohbetinde yazılır
    const res = await y.call('team.apply.decide', { applicationId: ap.id, accept: true });
    expect(res.application.decidedBy).toEqual({ id: y.me!.id, name: 'Yardımcı' });
    expect(res.team.members).toBe(4);
    expect((await x.waitFor('team.apply.updated')).application.decidedBy?.name).toBe('Yardımcı');
    const hist = await lead.call('chat.join', { room: `takim:${t.id}` });
    expect(hist.history.map((m) => m.text)).toContain('Yardımcı, Aday adlı oyuncunun başvurusunu kabul etti.');
    // aynı anda iki karar (lider kabul, yardımcı ret): yalnızca ilki geçer, ikincisi "zaten karara bağlandı"
    const aw = (await w.call('team.apply', { teamId: t.id })).application;
    const both = await Promise.allSettled([
      lead.call('team.apply.decide', { applicationId: aw.id, accept: true }),
      y.call('team.apply.decide', { applicationId: aw.id, accept: false, reason: 'ara' }),
    ]);
    expect(both.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const second = (both.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason as NetError;
    expect(second.code).toBe('KARAR'); expect(second.message).toMatch(/zaten karara bağlandı/);
    const final = (await w.call('team.apply.mine', {})).applications.find((a) => a.id === aw.id)!;
    expect(final.status).toBe('kabul');
    expect(final.decidedBy?.name).toBe('Lider');
    // yardımcı ret de kaydedilir (gerekçe hazır listeden)
    const z = await env.connect('Üçüncü');
    const az = (await z.call('team.apply', { teamId: t.id })).application;
    const rej = await y.call('team.apply.decide', { applicationId: az.id, accept: false, reason: 'tanidik' });
    expect(rej.application).toMatchObject({ status: 'red', reason: 'tanidik', decidedBy: { name: 'Yardımcı' } });
    expect((await lead.call('chat.join', { room: `takim:${t.id}` })).history.map((m) => m.text)).toContain('Yardımcı, Üçüncü adlı oyuncunun başvurusunu kabul etmedi.');
    // yardımcı üyeliğe düşürülünce onaylayamaz
    await lead.call('team.role', { id: y.me!.id, role: 'uye' });
    const v = await env.connect('Dördüncü');
    const av = (await v.call('team.apply', { teamId: t.id })).application;
    expect((await err(y.call('team.apply.decide', { applicationId: av.id, accept: true }))).code).toBe('YETKI');
  });

  it('sınırlar: en çok 3 bekleyen, red sonrası 24 saat, geri çekme beklemesi, 7 günde düşme, bölüm şartı, günlük sınır', async () => {
    env = await setup();
    const leads = await Promise.all(Array.from({ length: 12 }, (_, i) => env.connect(`Lider${i}`)));
    const teams: TeamDetail[] = [];
    for (const [i, l] of leads.entries()) teams.push((await l.call('team.create', { name: `Takım ${String.fromCharCode(65 + i)}`, emblem: '🎵', open: false })).team);
    const p = await env.connect('Gezgin');
    const a0 = (await p.call('team.apply', { teamId: teams[0]!.id })).application;
    await p.call('team.apply', { teamId: teams[1]!.id });
    await p.call('team.apply', { teamId: teams[2]!.id });
    expect((await err(p.call('team.apply', { teamId: teams[3]!.id }))).code).toBe('LIMIT');
    expect((await rowOf(p, 'Takım D')).state).toBe('sinir');
    // geri çek → hemen aynı takıma değil (10 dk), başka takıma olur
    await p.call('team.apply.cancel', { applicationId: a0.id });
    expect((await err(p.call('team.apply.cancel', { applicationId: a0.id }))).code).toBe('KARAR');
    expect((await err(p.call('team.apply', { teamId: teams[0]!.id }))).code).toBe('BEKLE');
    expect((await rowOf(p, 'Takım A')).state).toBe('bekle');
    await p.call('team.apply', { teamId: teams[3]!.id });
    env.clock.advance(TEAM_APPLY_RULES.recancelMs + 1);
    // red → 24 saat bekleme
    const pend = (await p.call('team.apply.mine', {})).applications.filter((x) => x.status === 'bekliyor');
    const onB = pend.find((x) => x.teamId === teams[1]!.id)!;
    await leads[1]!.call('team.apply.decide', { applicationId: onB.id, accept: false });
    const e = await err(p.call('team.apply', { teamId: teams[1]!.id }));
    expect(e.code).toBe('BEKLE'); expect(e.message).toMatch(/24 saat/);
    const row = await rowOf(p, 'Takım B');
    expect(row.state).toBe('bekle'); expect(row.until).toBe(env.clock.t + TEAM_APPLY_RULES.cooldownMs);
    env.clock.advance(TEAM_APPLY_RULES.cooldownMs + 1);
    // 7 gün: kalan başvurular düşer (zamanlayıcı), lider artık karar veremez
    const left = (await p.call('team.apply.mine', {})).applications.filter((x) => x.status === 'bekliyor');
    expect(left).toHaveLength(2);
    env.clock.advance(TEAM_APPLY_RULES.ttlMs);
    env.srv.sweep();
    expect((await p.waitFor('team.apply.updated', (x) => x.application.status === 'sure')).application.status).toBe('sure');
    const gone = left[0]!; const goneLead = leads[teams.findIndex((t) => t.id === gone.teamId)]!;
    expect((await err(goneLead.call('team.apply.decide', { applicationId: gone.id, accept: true }))).code).toBe('SURE');
    expect((await goneLead.call('team.applications', {})).applications).toHaveLength(0);
    expect((await p.call('team.apply.mine', {})).applications.filter((x) => x.status === 'bekliyor')).toHaveLength(0);
    // red beklemesi bitti: aynı takıma yeniden başvurulur
    await p.call('team.apply', { teamId: teams[1]!.id });
    // bölüm şartı (başvuruda ve kabulde)
    await leads[4]!.call('progress.submit', run(1)); await leads[4]!.call('progress.submit', run(2));
    await leads[4]!.call('team.settings', { minLevel: 3 });
    expect((await err(p.call('team.apply', { teamId: teams[4]!.id }))).code).toBe('SART');
    expect((await rowOf(p, 'Takım E')).state).toBe('seviye');
    const onF = (await p.call('team.apply', { teamId: teams[5]!.id })).application;
    await leads[5]!.call('progress.submit', run(1)); await leads[5]!.call('team.settings', { minLevel: 2 });
    expect((await err(leads[5]!.call('team.apply.decide', { applicationId: onF.id, accept: true }))).code).toBe('SART');
    // günlük sınır (İstanbul günü): bugün yapılan başvurular sayılır
    const q = await env.connect('Hızlı');
    const free = teams.filter((_, i) => i !== 4 && i !== 5);
    for (let i = 0; i < TEAM_APPLY_RULES.perDay; i++) {
      const a = (await q.call('team.apply', { teamId: free[i]!.id })).application;
      await q.call('team.apply.cancel', { applicationId: a.id });
    }
    env.clock.advance(TEAM_APPLY_RULES.recancelMs + 1);
    const lim = await err(q.call('team.apply', { teamId: free[0]!.id }));
    expect(lim.code).toBe('LIMIT'); expect(lim.message).toMatch(/Bugün/);
  });

  it('kabul engelleri ve yarış: dolu takım, iki kabul aynı anda tek yeri dolduramaz, başka takıma giren oyuncu', async () => {
    env = await setup();
    const lead = await env.connect('Lider');
    const t = (await lead.call('team.create', { name: 'Kalabalık', emblem: '🎺', open: false })).team;
    // 28 üye kodla (kod kısayolu başvuruyla takıma da doğrudan katılır)
    for (let i = 0; i < 28; i++) { const c = await env.connect(`Üye ${i}`); await c.call('team.join', { code: t.code }); }
    const [x, y, z] = [await env.connect('Xu'), await env.connect('Yu'), await env.connect('Zu')];
    const ax = (await x.call('team.apply', { teamId: t.id })).application;
    const ay = (await y.call('team.apply', { teamId: t.id })).application;
    // aynı anda iki kabul: biri girer, öbürü "dolu"
    const both = await Promise.allSettled([
      lead.call('team.apply.decide', { applicationId: ax.id, accept: true }),
      lead.call('team.apply.decide', { applicationId: ay.id, accept: true }),
    ]);
    expect(both.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rej = both.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rej.reason as NetError).code).toBe('DOLU');
    expect((await lead.call('team.detail', {})).team!.members).toBe(30);
    // dolu takıma başvuru yok
    expect((await err(z.call('team.apply', { teamId: t.id }))).code).toBe('DOLU');
    expect((await rowOf(z, 'Kalabalık')).state).toBe('dolu');
    // kabul ile kod aynı anda: yine 30'u geçemez
    const loser = both[0]!.status === 'fulfilled' ? y : x; const loserAp = loser === y ? ay : ax;
    const victim = (await lead.call('team.detail', {})).team!.roster.find((m) => m.role === 'uye')!;
    await lead.call('team.kick', { id: victim.id });
    const race = await Promise.allSettled([lead.call('team.apply.decide', { applicationId: loserAp.id, accept: true }), z.call('team.join', { code: t.code })]);
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await lead.call('team.detail', {})).team!.members).toBe(30);
  });

  it('bir takıma giren oyuncunun diğer başvuruları kendiliğinden düşer (kabul, doğrudan katılma, kod, takım kurma)', async () => {
    env = await setup();
    const [l1, l2, l3, l4, p] = [await env.connect('L1'), await env.connect('L2'), await env.connect('L3'), await env.connect('L4'), await env.connect('Oyuncu')];
    const [t1, t2, t3] = [
      (await l1.call('team.create', { name: 'Birinci', emblem: '🎵', open: false })).team,
      (await l2.call('team.create', { name: 'İkinci', emblem: '🎵', open: false })).team,
      (await l3.call('team.create', { name: 'Üçüncü', emblem: '🎵', open: false })).team,
    ];
    const t4 = (await l4.call('team.create', { name: 'Dördüncü', emblem: '🎵' })).team;
    const a1 = (await p.call('team.apply', { teamId: t1.id })).application;
    const a2 = (await p.call('team.apply', { teamId: t2.id })).application;
    await p.call('team.apply', { teamId: t3.id });
    // doğrudan açık takıma katıldı → üç başvuru da düşer, liderlerin listesi boşalır
    await p.call('team.join', { teamId: t4.id });
    const mine = (await p.call('team.apply.mine', {})).applications;
    expect(mine.filter((x) => x.status === 'bekliyor')).toHaveLength(0);
    for (const l of [l1, l2, l3]) expect((await l.waitFor('team.applications', (e) => e.applications.length === 0)).applications).toHaveLength(0);
    // eski başvuru kabul edilemez
    expect((await err(l1.call('team.apply.decide', { applicationId: a1.id, accept: true }))).code).toBe('KARAR');
    // kabul ile: başka bekleyenler düşer
    await p.call('team.leave', {});
    const b1 = (await p.call('team.apply', { teamId: t1.id })).application;
    env.clock.advance(1);
    const b2 = (await p.call('team.apply', { teamId: t2.id })).application;
    await l2.call('team.apply.decide', { applicationId: b2.id, accept: true });
    expect((await err(l1.call('team.apply.decide', { applicationId: b1.id, accept: true }))).code).toBe('KARAR');
    // kodla katılım bekleyen başvuruyu "kabul" sayar; takım kurmak da düşürür
    await p.call('team.leave', {});
    const c1 = (await p.call('team.apply', { teamId: t3.id })).application;
    await p.call('team.join', { code: t3.code });
    expect((await p.call('team.apply.mine', {})).applications.find((x) => x.id === c1.id)!.status).toBe('kabul');
    await p.call('team.leave', {});
    const d1 = (await p.call('team.apply', { teamId: t1.id })).application;
    await p.call('team.create', { name: 'Benim', emblem: '🎵' });
    expect((await err(l1.call('team.apply.decide', { applicationId: d1.id, accept: true }))).code).toBe('KARAR');
    expect((await err(l2.call('team.apply.decide', { applicationId: a2.id, accept: false }))).code).toBe('KARAR');
  });

  it('not: 8 bölümden önce yalnızca hazır not (chat ile aynı kural), sonra serbest yazı + küfür süzgeci; gerekçe hazır listeden', async () => {
    env = await setup({ freeTextCleared: 8 });
    const [lead, p] = [await env.connect('Lider'), await env.connect('Yeni')];
    const t = (await lead.call('team.create', { name: 'Notlar', emblem: '🎵', open: false })).team;
    expect((await err(p.call('team.apply', { teamId: t.id, note: 'Merhaba, katılmak isterim' }))).code).toBe('SERBEST_KAPALI');
    expect((await err(p.call('team.apply', { teamId: t.id, noteId: 'uydurma' }))).code).toBe('GECERSIZ');
    const ok = (await p.call('team.apply', { teamId: t.id, noteId: 'merhaba' })).application;
    expect(ok).toMatchObject({ noteKind: 'hazir', note: 'merhaba' });
    await p.call('team.apply.cancel', { applicationId: ok.id });
    env.clock.advance(TEAM_APPLY_RULES.recancelMs + 1);
    await climb(p, 8);
    expect((await p.call('comm.state', {})).settings.canFreeText).toBe(false);
    expect((await err(p.call('team.apply', { teamId: t.id, note: 'Merhaba' }))).code).toBe('SERBEST_KAPALI');
    await p.call('progress.submit', run(8)); // 8 bölüm geçildi
    expect((await err(p.call('team.apply', { teamId: t.id, note: 'siktir git' }))).code).toBe('UYGUNSUZ');
    expect((await err(p.call('team.apply', { teamId: t.id, note: 'a'.repeat(TEAM_APPLY_RULES.noteMax + 1) }))).code).toBe('GECERSIZ');
    const free = (await p.call('team.apply', { teamId: t.id, note: '  Her   akşam oynuyorum, savaşa katkı veririm!  ' })).application;
    expect(free).toMatchObject({ noteKind: 'serbest', note: 'Her akşam oynuyorum, savaşa katkı veririm!' });
    expect((await lead.call('team.applications', {})).applications[0]!.note).toBe('Her akşam oynuyorum, savaşa katkı veririm!');
  });

  it('yönetici hesabı takıma başvurabilir; takım gücü sıralamasındaki dışlama aynen sürer', async () => {
    const TEST_ADMIN = 'TESTYONETICI9';
    env = await setup({ adminCodeHash: hashAdminCode(TEST_ADMIN) });
    const [lead, adm] = [await env.connect('Lider'), await env.connect('Yönetici')];
    expect((await adm.call('code.redeem', { code: TEST_ADMIN })).result.kind).toBe('yonetici');
    const t = (await lead.call('team.create', { name: 'Karma', emblem: '🎵', open: false })).team;
    await lead.call('progress.submit', run(1));
    const before = (await rowOf(adm, 'Karma')).rankPower;
    const ap = (await adm.call('team.apply', { teamId: t.id, note: 'Yönetici modunda serbest yazı açık' })).application;
    await lead.call('team.apply.decide', { applicationId: ap.id, accept: true });
    await adm.call('progress.submit', run(1));
    expect((await rowOf(adm, 'Karma')).rankPower).toBe(before);
  });

  it('geçiş: eski veritabanındaki "yalnızca kodla" (open = 0) takımlar başvuruya geçer; iki kez açmak güvenli', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'odi-basvuru-'));
    const file = join(dir, 'eski.db');
    try {
      // eski sürüm: takım başvuru tablosu yok, kapalı takım kodla
      env = await setup({ dbFile: file });
      const lead = await env.connect('Eski Lider');
      const old = (await lead.call('team.create', { name: 'Eski Kulüp', emblem: '🎵', open: false })).team;
      const leadToken = lead.token;
      await env.close();
      const raw = new DatabaseSync(file);
      raw.exec('DROP TABLE team_apps');
      expect(raw.prepare('SELECT open FROM teams WHERE id = ?').get(old.id)).toEqual({ open: 0 });
      raw.close();
      // yeni sürüm açılır (1. kez)
      env = await setup({ dbFile: file });
      const p = await env.connect('Yeni');
      const row = await rowOf(p, 'Eski Kulüp');
      expect(row).toMatchObject({ open: false, joinMode: 'basvuru', state: 'basvur' });
      const ap = (await p.call('team.apply', { teamId: old.id })).application;
      const pToken = p.token;
      await env.close();
      // 2. kez: veri korunur, tablo/dizin yeniden kurulmaya çalışılmaz
      env = await setup({ dbFile: file });
      const lead2 = await env.connect(undefined, leadToken);
      expect((await lead2.call('team.applications', {})).applications.map((x) => x.id)).toEqual([ap.id]);
      await lead2.call('team.apply.decide', { applicationId: ap.id, accept: true });
      const p2 = await env.connect(undefined, pToken);
      expect((await p2.call('team.detail', {})).team!.name).toBe('Eski Kulüp');
      // kod kısayolu hâlâ geçerli
      const q = await env.connect('Kodlu');
      expect((await q.call('team.join', { code: old.code })).team.members).toBe(3);
    } finally {
      await env.close().catch(() => undefined);
      env = await setup(); // afterEach kapatır
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
