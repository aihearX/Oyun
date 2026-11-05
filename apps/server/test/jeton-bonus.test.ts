/**
 * YN-240 (OT-ekonomi-denetci-43): progress.submit bölüm jetonu bonusunu kaynak kaynak döner (Odyometri Odası, Timpanometri Kulesi,
 * takımın Ortak Kazanç teknolojisi): seviye, yüzde, pay. Payların toplamı sunucunun fazladan verdiğiyle (jeton − notalar) birebir;
 * kaynak kaynak yuvarlamanın farkı ayrı 'yuvarlama' kaynağı. Sonuç ekranı (meta earnLines) her kaynağı ayrı satır yazar.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { earnLines } from '@odi/meta';
import { setup, run, type Env } from './helpers';

let env: Env | undefined;
afterEach(async () => { await env?.close(); env = undefined; });
const setLevels = (e: Env, pid: string, levels: Record<string, number>) => {
  for (const [id, l] of Object.entries(levels)) e.srv.app.db.run('UPDATE buildings SET level = ? WHERE player_id = ? AND id = ?', l, pid, id);
};
const g = (coins: number) => [{ reason: 'bolum:3', items: [{ kind: 'jeton' as const, amount: coins }] }];

describe('bölüm jetonu bonusunun dökümü (progress.submit jetonBonus)', () => {
  it('bonus yoksa boş; Odyometri Odası Sv 1: 86 notanın %3\'ü = 3, cüzdan farkıyla birebir', async () => {
    const e = env = await setup();
    const a = await e.connect('Ayşe'); const pid = a.me!.id;
    await a.call('camp.state', {});
    const w0 = (await a.call('wallet.get', {})).wallet.jeton;
    const r0 = await a.call('progress.submit', run(1, { coins: 50 }));
    expect([r0.jeton, r0.jetonBonus]).toEqual([50, []]);
    setLevels(e, pid, { laboratuvar: 1 });
    const r1 = await a.call('progress.submit', run(2, { coins: 86 }));
    expect(r1.jeton).toBe(89);
    expect(r1.jetonBonus).toEqual([{ kaynak: 'laboratuvar', seviye: 1, pct: 3, jeton: 3 }]);
    const lines = earnLines({ grants: g(86) }, r1.jeton - 86, r1.jetonBonus);
    expect(lines.map((l) => [l.label, l.jeton])).toEqual([['Toplanan notalar', 86], ["Odyometri Odası Sv 1: notaların %3'ü", 3]]);
    expect(lines.reduce((x, l) => x + l.jeton, 0)).toBe((await a.call('wallet.get', {})).wallet.jeton - w0 - 50);
  });
  it('bina + kule + takım teknolojisi: her kaynak ayrı, yuvarlama farkı ayrı; satırların toplamı = cüzdan farkı', async () => {
    const e = env = await setup();
    const a = await e.connect('Ayşe'); const pid = a.me!.id;
    await a.call('camp.state', {});
    await a.call('team.create', { name: 'Kulak Ekibi', emblem: '🦉' });
    const teamId = e.srv.app.player(pid).team_id!;
    e.srv.app.db.run('INSERT INTO team_tech(team_id, tech, level, progress) VALUES(?, ?, ?, 0) ON CONFLICT(team_id, tech) DO UPDATE SET level = excluded.level', teamId, 'jeton', 1);
    setLevels(e, pid, { laboratuvar: 1, kule: 1 });
    for (const coins of [85, 86, 87, 99, 100, 7]) {
      const w0 = (await a.call('wallet.get', {})).wallet.jeton;
      const r = await a.call('progress.submit', run(1, { coins }));
      expect(r.jetonBonus!.filter((p) => p.kaynak !== 'yuvarlama').map((p) => [p.kaynak, p.seviye, p.pct])).toEqual([['laboratuvar', 1, 3], ['kule', 1, 2], ['takim', 1, 3]]);
      expect(r.jetonBonus!.reduce((x, p) => x + p.jeton, 0)).toBe(r.jeton - coins);
      expect(Math.abs(r.jetonBonus!.find((p) => p.kaynak === 'yuvarlama')?.jeton ?? 0)).toBeLessThanOrEqual(1);
      const lines = earnLines({ grants: g(coins) }, r.jeton - coins, r.jetonBonus);
      expect(lines.reduce((x, l) => x + l.jeton, 0)).toBe((await a.call('wallet.get', {})).wallet.jeton - w0);
      expect(lines.some((l) => l.label === "Ortak Kazanç (takım) Sv 1: notaların %3'ü")).toBe(true);
    }
  });
});
