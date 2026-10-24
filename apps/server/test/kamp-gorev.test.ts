import { afterEach, describe, expect, it } from 'vitest';
import type { KgState } from '@odi/shared';
import { KG_KURAL, KG_ODUL, VAKALAR, konsultSecenekleri, timpanoHavuzu, timpanoTuru, tonTuru, vakaById } from '@odi/content';
import type { NetError } from '@odi/net';
import { kgBump, kgCount } from '../src/camp-quests';
import { CAMP_GROWTH, applyPending, giveCampXp, setGrowth } from '../src/camp-quests-adapter';
import { campXpOf } from '../src/camp-xp';
import { DAY_MS } from '../src/time';
import { run, setup, type Env, type TC } from './helpers';

let env: Env | undefined;
afterEach(async () => { setGrowth(CAMP_GROWTH); await env?.close(); env = undefined; });
const err = async (p: Promise<unknown>): Promise<NetError> => { try { await p; } catch (e) { return e as NetError; } throw new Error('hata bekleniyordu'); };

/** test kısayolları: binalar, geçilen bölüm (highest = geçilen + 1), yönetici bayrağı */
function setLevels(e: Env, pid: string, levels: Record<string, number>) { for (const [id, l] of Object.entries(levels)) e.srv.app.db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', l, pid, id); }
const setCleared = (e: Env, pid: string, n: number) => e.srv.app.db.run('UPDATE players SET highest = ? WHERE id = ?', n + 1, pid);
const bump = (e: Env, pid: string, m: Parameters<typeof kgBump>[2], n = 1, key?: string) => e.srv.app.run(() => kgBump(e.srv.app, pid, m, n, key));
/** bir vakanın tam doğru cevabı (anahtar testler + doğru tanı + doğru yönetim) */
const perfect = (id: string, attempt: string) => { const v = vakaById(id)!; return { caseId: id, attempt, tests: [...v.anahtar], dx: v.tani.dogru, mg: v.yonetim[0].id }; };
async function player(e: Env, name: string, cleared = 10, levels: Record<string, number> = {}): Promise<TC> {
  const c = await e.connect(name); setCleared(e, c.me!.id, cleared); setLevels(e, c.me!.id, levels); return c;
}

describe('Kamp Görevleri (sunucu yetkili)', () => {
  it('kilit: 4 bölüm geçilmeden görevler kapalı, ödül alınamaz; açılınca hikâye 1. bölümle başlar', async () => {
    env = await setup();
    const a = await env.connect('Ayşe');
    const s0 = (await a.call('kg.state', {})).state;
    expect(s0.open).toEqual({ gorev: false, oyun: false, vaka: false });
    expect(s0.claimable).toBe(0);
    expect((await err(a.call('kg.claim', { ref: 'hikaye:1' }))).code).toBe('KILIT');
    setCleared(env, a.me!.id, 4);
    const s1 = (await a.call('kg.state', {})).state;
    expect(s1.open.gorev).toBe(true); expect(s1.open.oyun).toBe(false);
    expect(s1.story.chapter?.no).toBe(1);
    expect(s1.story.chapter!.steps.map((x) => x.id)).toEqual(['depo-1', 'depo-topla', 'merkez-2']);
  });

  it('hikâye: adımlar gerçek kamp eylemleriyle dolar; bölüm ödülü tam bir kez; sonra 2. bölüm', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 4); const pid = a.me!.id;
    setLevels(env, pid, { depo: 1, merkez: 2 });
    env.srv.app.db.run('UPDATE players SET depot_at = ? WHERE id = ?', env.clock.t - 3_600_000, pid);
    expect((await err(a.call('kg.claim', { ref: 'hikaye:1' }))).code).toBe('BITMEDI');
    const col = await a.call('camp.collect', {});
    expect(col.collected).toBeGreaterThan(0);
    const upd = await a.waitFor('kg.updated', (d) => !!d.state.story.chapter?.done);
    expect(upd.state.claimable).toBeGreaterThanOrEqual(1);
    const before = (await a.call('wallet.get', {})).wallet;
    const c = await a.call('kg.claim', { ref: 'hikaye:1' });
    expect(c.reward).toMatchObject({ jeton: 80, kampXp: 60, m5: 2 });
    expect(c.wallet.jeton).toBe(before.jeton + 80);
    expect(c.wallet.hizlandirici.m5).toBe(before.hizlandirici.m5 + 2);
    expect(c.state.story.chapter?.no).toBe(2);
    expect(c.state.pending.kampXp).toBe(0); // Kamp XP kamp büyümesi sistemine hemen gider
    expect(c.state.growth).toBe(true);
    expect((await err(a.call('kg.claim', { ref: 'hikaye:1' }))).code).toBe('TEKRAR');
    expect((await a.call('wallet.get', {})).wallet.jeton).toBe(before.jeton + 80);
  });

  it('günlük görevler: 3 görev, gün içinde sabit; ödül bir kez; bir kez değiştirme; ertesi gün yenilenir', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 10, { depo: 1, laboratuvar: 1, kule: 1, revir: 1, tedavi: 1 }); const pid = a.me!.id;
    const s = (await a.call('kg.state', {})).state;
    expect(s.daily.tasks).toHaveLength(KG_KURAL.gunlukGorev);
    expect((await a.call('kg.state', {})).state.daily.tasks.map((t) => t.id)).toEqual(s.daily.tasks.map((t) => t.id));
    const t0 = s.daily.tasks[0]!;
    expect((await err(a.call('kg.claim', { ref: t0.ref }))).code).toBe('BITMEDI');
    // görevin sayacını gerçek ölçütle doldur (günlük kapsam)
    const def = (await import('@odi/content')).KG_GUNLUK.find((g) => g.id === t0.id)!;
    bump(env, pid, def.olcut as never, def.need);
    const c = await a.call('kg.claim', { ref: t0.ref });
    expect(c.reward).toMatchObject(KG_ODUL.gunluk);
    expect((await err(a.call('kg.claim', { ref: t0.ref }))).code).toBe('TEKRAR');
    expect(kgCount(env.srv.app, pid, 'gunluk', 'week')).toBe(1);
    // alınmış görev değiştirilemez; diğeri bir kez değişir
    expect((await err(a.call('kg.reroll', { id: t0.id }))).code).toBe('GECERSIZ');
    const t1 = s.daily.tasks[1]!;
    const r = await a.call('kg.reroll', { id: t1.id });
    expect(r.state.daily.tasks.map((x) => x.id)).not.toContain(t1.id);
    expect(r.state.daily.rerollLeft).toBe(0);
    expect((await err(a.call('kg.reroll', { id: r.state.daily.tasks[2]!.id }))).code).toBe('LIMIT');
    env.clock.advance(DAY_MS);
    const n = (await a.call('kg.state', {})).state;
    expect(n.day).not.toBe(s.day); expect(n.daily.rerollLeft).toBe(1);
    expect(n.daily.tasks.every((x) => !x.claimed)).toBe(true);
  });

  it('idempotent sayaçlar: aynı koşu iki kez gönderilse de bir bölüm sayılır; malzeme kullanımı bir kez', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 4); const pid = a.me!.id;
    const r1 = run(1, { remediesUsed: [{ id: 'kulak-tikaci', count: 1 }] });
    await a.call('progress.submit', r1);
    await a.call('progress.submit', r1);
    expect(kgCount(env.srv.app, pid, 'bolum')).toBe(1);
    expect(kgCount(env.srv.app, pid, 'malzeme-kullan')).toBe(1);
    await a.call('progress.submit', run(2, { completed: false, stars: 0 }));
    expect(kgCount(env.srv.app, pid, 'bolum')).toBe(1);
    expect(bump(env, pid, 'ton', 1, 'ko:x')).toBe(true);
    expect(bump(env, pid, 'ton', 1, 'ko:x')).toBe(false);
    expect(kgCount(env.srv.app, pid, 'ton')).toBe(1);
    expect(kgCount(env.srv.app, pid, 'oyun')).toBe(1);
  });

  it('haftalık hedef ve başarılar: basamak basamak, her basamak bir kez', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 10, { depo: 1 }); const pid = a.me!.id;
    const w = (await a.call('kg.state', {})).state.weekly!;
    expect(w.tiers).toHaveLength(3);
    const def = (await import('@odi/content')).KG_HAFTA.find((h) => h.id === w.id)!;
    bump(env, pid, def.olcut, def.tiers[1]);
    const s = (await a.call('kg.state', {})).state;
    expect(s.weekly!.tiers.map((t) => t.reached)).toEqual([true, true, false]);
    await a.call('kg.claim', { ref: s.weekly!.tiers[0]!.ref });
    await a.call('kg.claim', { ref: s.weekly!.tiers[1]!.ref });
    expect((await err(a.call('kg.claim', { ref: s.weekly!.tiers[2]!.ref }))).code).toBe('BITMEDI');
    expect((await err(a.call('kg.claim', { ref: s.weekly!.tiers[0]!.ref }))).code).toBe('TEKRAR');
    bump(env, pid, 'depo-topla', 10);
    const b = (await a.call('kg.state', {})).state.achievements.find((x) => x.id === 'b-depo')!;
    expect(b.tiers[0]!.reached).toBe(true);
    const got = await a.call('kg.claim', { ref: b.tiers[0]!.ref });
    expect(got.reward.jeton).toBe(30);
    expect((await err(a.call('kg.claim', { ref: b.tiers[0]!.ref }))).code).toBe('TEKRAR');
    expect((await err(a.call('kg.claim', { ref: 'basari:b-depo:1' }))).code).toBe('BITMEDI');
  });
});

describe('Hasta Vakaları', () => {
  it('dürüst takvim: günde 3 hasta, salon 6, kademe Klinik seviyesine bağlı; doğru cevap 3 yıldız ve ödül bir kez', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 7); const pid = a.me!.id;
    expect((await a.call('vaka.state', {})).vaka.locked).toBe('Odyoloji Kliniği’ni kur');
    setLevels(env, pid, { revir: 1 });
    // kurulduğu gün ilk hastalar gelmez (o günün gelişi kilitliyken tüketilmedi) → ilk erişimde 3 hasta
    let v = (await a.call('vaka.state', {})).vaka;
    expect(v.waiting).toEqual(['kv01', 'kv02', 'kv03']);
    expect(v.arrivedToday).toBe(3);
    expect(v.nextArrivalAt).toBeGreaterThan(env.clock.t);
    const w0 = (await a.call('wallet.get', {})).wallet.jeton;
    const r = await a.call('vaka.answer', perfect('kv01', 'deneme-1'));
    expect(r.result).toMatchObject({ stars: 3, first: true, dxOk: true, mgOk: true, efficient: true });
    expect(r.result.reward).toMatchObject({ jeton: 25, kampXp: 30 });
    expect(r.wallet.jeton).toBe(w0 + 25);
    expect(r.vaka.waiting).toEqual(['kv02', 'kv03']);
    // aynı deneme (ağ tekrarı) aynı sonucu döndürür, ödül tekrar verilmez
    const again = await a.call('vaka.answer', perfect('kv01', 'deneme-1'));
    expect(again.result).toEqual(r.result); expect(again.wallet.jeton).toBe(w0 + 25);
    // Vaka Defteri'nden yeniden oynamak: yeni yıldız yoksa ödül yok
    const rep = await a.call('vaka.answer', perfect('kv01', 'deneme-2'));
    expect(rep.result).toMatchObject({ stars: 3, first: false, newStars: 0, reward: {} });
    // yanlış tanı: 0 yıldız, hasta salonda kalır
    const wrong = await a.call('vaka.answer', { ...perfect('kv02', 'deneme-3'), dx: 'perforasyon' });
    expect(wrong.result).toMatchObject({ stars: 0, correctDx: 'serumen' });
    expect(wrong.vaka.waiting).toContain('kv02');
    expect((await err(a.call('vaka.answer', perfect('kv20', 'deneme-4')))).code).toBe('YOK'); // salonda olmayan (2. kademe) vaka
    expect((await err(a.call('vaka.answer', { ...perfect('kv02', 'deneme-5'), dx: 'olmayan-tani' }))).code).toBe('GECERSIZ');
    // ertesi gün: 3 yeni hasta (salonda 2 vardı → 5)
    env.clock.advance(DAY_MS);
    v = (await a.call('vaka.state', {})).vaka;
    expect(v.waiting).toEqual(['kv02', 'kv03', 'kv04', 'kv05', 'kv06']);
    // ertesi gün salon 6 ile sınırlı (yalnız 1 gelir)
    env.clock.advance(DAY_MS);
    v = (await a.call('vaka.state', {})).vaka;
    expect(v.waiting).toHaveLength(KG_KURAL.vakaSalon);
    // 1. kademe bitince Klinik Sv 4 olmadan 2. kademe gelmez
    const all1 = VAKALAR.filter((x) => x.kademe === 1).map((x) => x.id);
    expect(v.waiting.every((id) => all1.includes(id))).toBe(true);
    expect(kgCount(env.srv.app, pid, 'vaka')).toBe(2);
    expect(kgCount(env.srv.app, pid, 'vaka-3yildiz')).toBe(1);
  });

  it('ilk çözümde 2+ yıldızla vakanın patolojisine uygun malzeme çantaya (bir kez)', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 7, { revir: 1 }); const pid = a.me!.id;
    await a.call('vaka.state', {});
    const r = await a.call('vaka.answer', perfect('kv02', 'malz-1')); // serumen → kulak kiri yumuşatıcı damla
    expect(r.result.reward).toMatchObject({ malzeme: 'serumen-damlasi', malzemeN: 1 });
    expect(env.srv.app.db.get<{ n: number }>("SELECT n FROM remedy_inv WHERE player_id = ? AND id = 'serumen-damlasi'", pid)!.n).toBe(1);
    const rep = await a.call('vaka.answer', perfect('kv02', 'malz-2'));
    expect(rep.result.reward.malzeme).toBeUndefined();
  });

  it('Konsültasyon: takım arkadaşı hazır seçenekle oy verir (bir kez, ödül), soran çözünce kart kapanır ve sorana bir kez ödül', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 7, { revir: 1 }); const b = await player(env, 'Bora', 7, { revir: 1 });
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await a.call('vaka.state', {});
    expect((await err(a.call('vaka.konsult', { caseId: 'kv02' }))).code).toBe('YALNIZ'); // takımda danışacak kimse yokken açılmaz (dürüst)
    await b.call('team.join', { teamId: t.id });
    await a.call('chat.join', { room: `takim:${t.id}` }); await b.call('chat.join', { room: `takim:${t.id}` });
    await a.call('vaka.state', {});
    expect((await err(b.call('vaka.konsult', { caseId: 'kv10' }))).code).toBe('YOK'); // Bora'nın salonunda değil
    const k = await a.call('vaka.konsult', { caseId: 'kv02' });
    expect(k.vaka.konsult).toHaveLength(1);
    expect((await err(a.call('vaka.konsult', { caseId: 'kv02' }))).code).toBe('TEKRAR');
    const card = await b.waitFor('chat', (d) => d.msg.meta?.type === 'konsultasyon');
    const msgId = card.msg.id;
    const opts = konsultSecenekleri(vakaById('kv02')!);
    expect([0, 1, 2].map((i) => card.msg.meta?.[`c${i}`])).toEqual(opts.map((o) => o.id));
    const right = opts.findIndex((o) => o.id === 'serumen');
    const w0 = (await b.call('wallet.get', {})).wallet.jeton;
    const vote = await b.call('vaka.oy', { msgId, choice: right });
    expect(vote.reward).toMatchObject(KG_ODUL.konsultOy);
    expect(vote.wallet.jeton).toBe(w0 + KG_ODUL.konsultOy.jeton);
    expect((await err(b.call('vaka.oy', { msgId, choice: 0 }))).code).toBe('TEKRAR');
    expect((await err(a.call('vaka.oy', { msgId, choice: 0 }))).code).toBe('GECERSIZ');
    const upd = await a.waitFor('vaka.updated');
    expect(upd.vaka.konsult[0]!.n).toBe(1);
    const wa = (await a.call('wallet.get', {})).wallet.jeton;
    const solved = await a.call('vaka.answer', perfect('kv02', 'kons-1'));
    expect(solved.wallet.jeton).toBe(wa + 25 + KG_ODUL.konsultSoran.jeton);
    const closed = await b.waitFor('chat.updated', (d) => d.msg.id === msgId && d.msg.meta?.done === true);
    expect(closed.msg.meta?.ans).toBe(right);
    expect((await err(b.call('vaka.oy', { msgId, choice: 1 }))).code).toBe('BITTI');
    expect(kgCount(env.srv.app, a.me!.id, 'konsult')).toBe(1);
    expect(kgCount(env.srv.app, b.me!.id, 'konsult')).toBe(1);
  });

  it('başvurusu kabul edilen oyuncuya görev durumu hemen gider (takıma katıl adımı)', async () => {
    env = await setup();
    const lead = await player(env, 'Lider', 7); const b = await player(env, 'Bora', 7);
    const t = (await lead.call('team.create', { name: 'Kepçe', emblem: '🐚', open: false })).team;
    await b.call('kg.state', {});
    const ap = (await b.call('team.apply', { teamId: t.id })).application;
    const seen = b.waitFor('kg.updated', () => true);
    expect((await lead.call('team.apply.decide', { applicationId: ap.id, accept: true })).application.status).toBe('kabul');
    expect((await seen).state.open.gorev).toBe(true);
  });

  it('takım kliniği: yönetici hesaplarının vakaları sayılmaz ve yönetici ödül alamaz', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 10, { revir: 7 }); const adm = await player(env, 'Yönetici', 10, { revir: 7 });
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await adm.call('team.join', { teamId: t.id });
    env.srv.app.db.run('INSERT INTO player_flags(player_id, admin, admin_on, admin_at) VALUES(?, 1, 1, ?)', adm.me!.id, env.clock.t);
    // aynı hafta içinde (Çarşamba → Cumartesi) her gün ikisi de salondaki 3 vakayı çözer
    for (let d = 0; d < 4; d++) {
      for (const [tag, c] of [["adm", adm], ["ays", a]] as const) { const w = (await c.call("vaka.state", {})).vaka.waiting; for (const id of w.slice(0, 3)) await c.call("vaka.answer", perfect(id, `${tag}-${d}-${id}`)); }
      if (d === 1) expect((await a.call('kg.state', {})).state.takim!.progress).toBe(6); // yalnız Ayşe'nin 6 vakası
      if (d < 3) env.clock.advance(DAY_MS);
    }
    const s = (await a.call('kg.state', {})).state;
    expect(s.takim).toMatchObject({ progress: KG_KURAL.takimHedef, reached: true, contributed: true, claimed: false });
    const got = await a.call('kg.claim', { ref: s.takim!.ref });
    expect(got.reward).toMatchObject(KG_ODUL.takim);
    expect((await err(adm.call('kg.claim', { ref: s.takim!.ref }))).code).toBe('SART');
    const sa = (await adm.call('kg.state', {})).state.takim!;
    expect(sa.contributed).toBe(false);
  });
});

describe('Kamp oyunları', () => {
  it('Ton Avı: sunucu puanlar, çok hızlı tur reddedilir, tur bir kez biter, günde 5 ödüllü tur', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 6);
    expect((await err(a.call('koyun.start', { oyun: 'ton', duzey: 'genel' }))).code).toBe('KILIT');
    setLevels(env, a.me!.id, { laboratuvar: 1 });
    const play = async (fast = false) => {
      const { round } = await a.call('koyun.start', { oyun: 'ton', duzey: 'genel' });
      const right = tonTuru(round.seed, 'genel').map((d) => (d.tur === 'var' ? (d.var ? 1 : 0) : d.dogru));
      if (!fast) env!.clock.advance(KG_KURAL.oyunEnAzMs.ton);
      return { round, res: fast ? null : await a.call('koyun.finish', { id: round.id, answers: right }), right };
    };
    const f = await play(true);
    expect((await err(a.call('koyun.finish', { id: f.round.id, answers: f.right }))).code).toBe('HIZLI');
    const first = await play();
    expect(first.res!.score).toBe(8); expect(first.res!.reward).toMatchObject(KG_ODUL.oyunTur);
    expect((await err(a.call('koyun.finish', { id: first.round.id, answers: first.right }))).code).toBe('TEKRAR');
    for (let i = 1; i < KG_KURAL.oyunOdulluTur; i++) expect((await play()).res!.reward.jeton).toBe(KG_ODUL.oyunTur.jeton);
    const extra = await play();
    expect(extra.round.rewarded).toBe(false); expect(extra.res!.reward).toEqual({});
    const g = extra.res!.state.oyun.find((x) => x.oyun === 'ton')!;
    expect(g).toMatchObject({ played: 6, rewarded: 5, cap: 5 });
    expect(kgCount(env.srv.app, a.me!.id, 'ton')).toBe(6);
    expect(kgCount(env.srv.app, a.me!.id, 'ton-iyi')).toBe(6);
  });
  it('Timpanogram Eşleştir: yanlış cevaplar puanı düşürür; Kule kurulu olmalı', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 6, { kule: 1 });
    const { round } = await a.call('koyun.start', { oyun: 'timpano', duzey: 'odyoloji' });
    expect(round.items).toHaveLength(KG_KURAL.timpanoBulmaca);
    const tur = timpanoTuru(round.seed, 'odyoloji', round.items);
    env.clock.advance(KG_KURAL.oyunEnAzMs.timpano);
    const res = await a.call('koyun.finish', { id: round.id, answers: tur.map((b, i) => (i < 3 ? b.dogru : (b.dogru + 1) % b.secenek.length)) });
    expect(res.score).toBe(3); expect(res.total).toBe(5);
    expect((await err(a.call('koyun.finish', { id: round.id, answers: [0, 0, 0] }))).code).toBe('TEKRAR');
  });
  it('Timpanogram Eşleştir: kişisel deste — havuz bitmeden aynı soru tekrar gelmez; yeni deste son görülenlerle başlamaz', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 6, { kule: 1 });
    const havuz = timpanoHavuzu('genel'); const per = KG_KURAL.timpanoBulmaca;
    const rounds = Math.floor(havuz.length / per);
    const seen: string[] = [];
    for (let k = 0; k < rounds; k++) {
      const { round } = await a.call('koyun.start', { oyun: 'timpano', duzey: 'genel' });
      for (const id of round.items!) expect(havuz).toContain(id);
      seen.push(...round.items!);
    }
    expect(new Set(seen).size).toBe(seen.length); // tekrar yok
    const last = seen.slice(-per);
    const { round: next } = await a.call('koyun.start', { oyun: 'timpano', duzey: 'genel' });
    expect(new Set(next.items).size).toBe(per);
    for (const id of next.items!) expect(last).not.toContain(id);
    // odyoloji destesi ayrı tutulur; puanlama turun sorularıyla yapılır (istemciyle aynı)
    const { round: o } = await a.call('koyun.start', { oyun: 'timpano', duzey: 'odyoloji' });
    env.clock.advance(KG_KURAL.oyunEnAzMs.timpano);
    const tur = timpanoTuru(o.seed, 'odyoloji', o.items);
    expect((await a.call('koyun.finish', { id: o.id, answers: tur.map((b) => b.dogru) })).score).toBe(per);
  });
});

describe('Kamp büyümesi bağlantısı (adaptör)', () => {
  it('Kamp XP ve dekor önce bekler; büyüme sistemi bağlanınca bir kez uygulanır', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 4); const pid = a.me!.id; const app = env.srv.app;
    setGrowth(null);
    app.run(() => { giveCampXp(app, pid, 50, 'test:1'); giveCampXp(app, pid, 50, 'test:1'); giveCampXp(app, pid, 20, 'test:2'); });
    let st: KgState = (await a.call('kg.state', {})).state;
    expect(st.growth).toBe(false); expect(st.pending.kampXp).toBe(70);
    const got: [string, number][] = [];
    setGrowth({ grantCampXp: (_a, p, n) => { got.push([p, n]); }, grantDecoration: () => true, campLevel: () => 3, decorCount: () => 0 });
    app.run(() => applyPending(app, pid)); app.run(() => applyPending(app, pid));
    expect(got).toEqual([[pid, 50], [pid, 20]]);
    st = (await a.call('kg.state', {})).state;
    expect(st.growth).toBe(true); expect(st.pending.kampXp).toBe(0);
  });
  it('gerçek kamp büyümesi: görev ödülündeki Kamp XP ve süs bir kez kampa gelir; süs yerleştirme ve ziyaret görev sayacını artırır', async () => {
    env = await setup();
    const a = await player(env, 'Ayşe', 4); const pid = a.me!.id; const app = env.srv.app;
    const x0 = campXpOf(app, pid).total;
    app.run(() => { giveCampXp(app, pid, 40, 'gorev-test:1'); giveCampXp(app, pid, 40, 'gorev-test:1'); });
    expect(campXpOf(app, pid).total).toBe(x0 + 40);
    const { giveDecoration } = await import('../src/camp-quests-adapter');
    app.run(() => { giveDecoration(app, pid, 'dede-banki', 'gorev-test:2'); giveDecoration(app, pid, 'dede-banki', 'gorev-test:2'); });
    expect(app.db.get<{ n: number }>("SELECT n FROM decor_inv WHERE player_id = ? AND id = 'dede-banki'", pid)!.n).toBe(1);
    // süsü kampa yerleştir: "dekor-yerlestir" sayacı (kamp büyümesi işlemi kancayla)
    const { cellFree } = await import('@odi/content');
    let spot: [number, number] | null = null;
    for (let gy = -20; gy <= 20 && !spot; gy++) for (let gx = -20; gx <= 20 && !spot; gx++) if (cellFree(gx, gy, campXpOf(app, pid).level)) spot = [gx, gy];
    expect(spot).not.toBeNull();
    await a.call('camp.decor.place', { id: 'dede-banki', gx: spot![0], gy: spot![1] });
    expect(kgCount(app, pid, 'dekor-yerlestir')).toBe(1);
    const b = await player(env, 'Bora', 4);
    const t = (await a.call('team.create', { name: 'Kulaklar', emblem: '👂' })).team;
    await b.call('team.join', { teamId: t.id });
    await b.call('camp.visit', { playerId: pid });
    expect(kgCount(app, b.me!.id, 'ziyaret')).toBe(1);
  });
});
