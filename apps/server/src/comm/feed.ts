import { BUILDINGS, COMM_RULES, type ChatMessage, type FeedType } from '@odi/shared';
import { HUMAN_JOURNEY } from '@odi/content';
import { fail, parseJson, type App, type PlayerRow } from '../app';
import { postCard, teamRoom, updateCard } from '../chat';
import { dayKey, DAY_MS } from '../time';
import { commNotice, feedShareOn, metric } from './settings';

/**
 * Takım Akışı: sunucunun gördüğü GERÇEK olaylardan takım sohbetine kart (kind 'feed').
 * Spam önleme: aynı oyuncunun aynı türdeki kartı 30 dk içinde yeniden gelirse mevcut kart güncellenir (birleşir);
 * takım başına saatte en çok 20 yeni kart (üye/yardım/meydan okuma kartları sınırsız: seyrek ve kişinin kendi eylemi).
 */
type Meta = Record<string, string | number | boolean>;
type Data = Record<string, number | string | (number | string)[]>;
const MERGE: Partial<Record<FeedType, true>> = { bolum: true, koklea: true, bina: true };
const UNCAPPED: Partial<Record<FeedType, true>> = { uye: true, yardim: true, meydan: true };
const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
const levelName = (n: number) => HUMAN_JOURNEY.levels[n - 1]?.name ?? `${n}. bölüm`;
/** "1–4, 6, 8–9" (art arda bölümler aralık olarak) */
export function ranges(ns: number[]): string {
  const out: string[] = []; const xs = [...new Set(ns)].sort((x, y) => x - y);
  for (let i = 0; i < xs.length; i++) { let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j]! + 1) j++; out.push(j > i ? `${xs[i]}–${xs[j]}` : `${xs[i]}`); i = j; }
  return out.join(', ');
}

function textFor(type: FeedType, name: string, d: Data): string {
  const lv = (d.levels as number[] | undefined) ?? [];
  switch (type) {
    case 'bolum':
      if (lv.length > 1) return `${name} ${lv.length} bölümde ilerledi (${ranges(lv)}) · toplam ${d.stars} yıldız.`;
      return d.first ? `${name} ${lv[0]}. bölümü ${d.stars} yıldızla geçti.` : `${name} ${lv[0]}. bölümde 3 yıldıza ulaştı.`;
    case 'boss': return `${name}, ${d.level}. bölümün canavarını yendi: ${levelName(Number(d.level))}!`;
    case 'koklea': return lv.length > 1 ? `${name} ${d.n} altın koklea buldu (bölüm ${lv.join(', ')}).` : `${name} ${lv[0]}. bölümde ${d.n} altın koklea buldu.`;
    case 'bina': { const b = (d.items as string[]) ?? []; return b.length > 1 ? `${name} kampında ${b.length} binayı geliştirdi: ${b.join(', ')}.` : `${name} kampında ${b[0]} yaptı.`; }
    case 'uye': return `${name} takıma katıldı.`;
    case 'seri': return `${name} ${d.days} gündür her gün oynuyor!`;
    case 'yardim': return `${name} ${d.level}. bölümü takımının yardımıyla geçti! Teşekkürler: ${d.helpers}.`;
    case 'meydan': return `${name} ${d.level}. bölümde ${fmt(Number(d.score))} puanla meydan okuyor. Geçebilir misin?`;
    case 'sira': return `${name} geçen haftanın sıralamasında ${d.rank}. oldu!`;
  }
}
function metaFor(type: FeedType, p: PlayerRow, d: Data): Meta {
  const m: Meta = { type, pid: p.id, pname: p.name, pc: p.color, ph: p.hat };
  for (const [k, v] of Object.entries(d)) m[k] = Array.isArray(v) ? v.join(',') : v;
  return m;
}
function merge(type: FeedType, a: Data, b: Data): Data {
  const uniq = <T,>(x: T[]) => [...new Set(x)];
  switch (type) {
    case 'bolum': {
      // bölüm başına en iyi yıldız (aynı bölüm önce 2★ sonra 3★ gelirse iki kez sayılmaz)
      const best = new Map<number, number>();
      for (const x of [...((a.sl as string[]) ?? []), ...((b.sl as string[]) ?? [])]) { const [l, st] = String(x).split(':').map(Number); best.set(l!, Math.max(best.get(l!) ?? 0, st!)); }
      const levels = [...best.keys()].sort((x, y) => x - y);
      return { levels, sl: levels.map((l) => `${l}:${best.get(l)}`), stars: [...best.values()].reduce((x, y) => x + y, 0), first: Number(a.first) || Number(b.first) };
    }
    case 'koklea': return { levels: uniq([...(a.levels as number[]), ...(b.levels as number[])]).sort((x, y) => x - y), n: Number(a.n) + Number(b.n) };
    case 'bina': return { items: [...(a.items as string[]), ...(b.items as string[])].slice(-6) };
    default: return b;
  }
}

/** akışa olay yaz (birleştir ya da yeni kart); takımda değilse ya da paylaşım kapalıysa hiçbir şey yapmaz */
export function feedEvent(app: App, pid: string, type: FeedType, data: Data, opts: { force?: boolean } = {}): ChatMessage | null {
  const p = app.playerOrNull(pid);
  if (!p?.team_id) return null;
  if (!opts.force && type !== 'uye' && !feedShareOn(app, pid)) return null;
  const teamId = p.team_id; const room = teamRoom(teamId); const now = app.now();
  if (MERGE[type]) {
    const rec = app.db.get<{ msg_id: string; at: number; data: string }>('SELECT msg_id, at, data FROM feed_recent WHERE team_id = ? AND player_id = ? AND type = ?', teamId, pid, type);
    if (rec && now - rec.at < COMM_RULES.feedMergeMs && app.db.get('SELECT 1 AS x FROM chat WHERE id = ? AND hidden = 0', rec.msg_id)) {
      const d = merge(type, parseJson<Data>(rec.data, {}), data);
      app.db.run('UPDATE feed_recent SET data = ? WHERE team_id = ? AND player_id = ? AND type = ?', JSON.stringify(d), teamId, pid, type);
      updateCard(app, rec.msg_id, textFor(type, p.name, d), metaFor(type, p, d));
      metric(app, 'feed.merge');
      return null;
    }
  }
  if (!UNCAPPED[type]) {
    const n = app.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM chat WHERE room = ? AND kind = 'feed' AND at > ?", room, now - 3_600_000)!.n;
    if (n >= COMM_RULES.feedPerTeamHour) { metric(app, 'feed.capped'); return null; }
  }
  const msg = postCard(app, room, { kind: 'feed', text: textFor(type, p.name, data), meta: metaFor(type, p, data) });
  if (MERGE[type]) app.db.run('INSERT INTO feed_recent(team_id, player_id, type, msg_id, at, data) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(team_id, player_id, type) DO UPDATE SET msg_id = excluded.msg_id, at = excluded.at, data = excluded.data',
    teamId, pid, type, msg.id, now, JSON.stringify(data));
  metric(app, 'feed.card');
  return msg;
}

/** kamp binası seviye atladı (camp.ts inşaat tamamlama anı) */
export function feedBuilding(app: App, pid: string, building: string, level: number): void {
  const def = BUILDINGS.find((b) => b.id === building);
  if (!def) return;
  feedEvent(app, pid, 'bina', { items: [level <= 1 ? `${def.name} kurdu` : `${def.name} ${level}. seviye`] });
}

/** sunucunun saydığı ardışık oyun günü (her İstanbul gününün ilk bölüm sonucunda) → dönüm noktasında kart */
export function trackPlayDay(app: App, pid: string): void {
  const now = app.now(); const today = dayKey(now);
  if (!app.db.run('INSERT OR IGNORE INTO play_days(player_id, day) VALUES(?, ?)', pid, today)) return;
  const days = new Set(app.db.all<{ day: string }>('SELECT day FROM play_days WHERE player_id = ? ORDER BY day DESC LIMIT 120', pid).map((r) => r.day));
  let streak = 0;
  while (days.has(dayKey(now - streak * DAY_MS))) streak++;
  if ((COMM_RULES.streakMilestones as readonly number[]).includes(streak)) feedEvent(app, pid, 'seri', { days: streak });
}

// ------------------------------------------------------------------ meydan okuma
/** takıma meydan oku: oyuncunun sunucudaki en iyi skoru (istemcinin söylediği değil) */
export function postChallenge(app: App, pid: string, level: number): ChatMessage {
  const p = app.player(pid);
  if (!p.team_id) return fail('TAKIM_YOK', 'Meydan okumak için bir takımda olmalısın.');
  const best = app.db.get<{ stars: number; score: number }>('SELECT stars, score FROM level_best WHERE player_id = ? AND level = ?', pid, level);
  if (!best || best.stars <= 0) fail('SART', 'Önce bu bölümü geçmelisin.');
  const day = dayKey(app.now());
  const n = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM challenges WHERE player_id = ? AND day = ?', pid, day)!.n;
  if (n >= COMM_RULES.challengePerDay) fail('LIMIT', `Günde en çok ${COMM_RULES.challengePerDay} meydan okuma gönderebilirsin.`);
  const until = app.now() + COMM_RULES.challengeMs;
  const msg = feedEvent(app, pid, 'meydan', { level, score: best.score, stars: best.stars, until }, { force: true })!;
  app.db.run('INSERT INTO challenges(msg_id, team_id, player_id, level, score, until, day) VALUES(?, ?, ?, ?, ?, ?, ?)', msg.id, p.team_id, pid, level, best.score, until, day);
  metric(app, 'challenge');
  return msg;
}

/** takım arkadaşı meydan okumayı geçti mi (bölüm sonucu): kartın konusuna sunucu yazar, meydan okuyana bildirim */
export function checkChallenges(app: App, pid: string, level: number, score: number): void {
  const p = app.player(pid);
  if (!p.team_id) return;
  const open = app.db.all<{ msg_id: string; player_id: string; score: number }>('SELECT msg_id, player_id, score FROM challenges WHERE team_id = ? AND level = ? AND until > ? AND player_id != ? AND score < ?', p.team_id, level, app.now(), pid, score);
  for (const c of open) {
    if (!app.db.run('INSERT OR IGNORE INTO challenge_beats(msg_id, player_id, score, at) VALUES(?, ?, ?, ?)', c.msg_id, pid, Math.round(score), app.now())) continue;
    const beats = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM challenge_beats WHERE msg_id = ?', c.msg_id)!.n;
    postCard(app, teamRoom(p.team_id), { kind: 'system', text: `${p.name} ${fmt(score)} puanla geçti!`, replyTo: c.msg_id, meta: { event: 'meydan', pid } });
    updateCard(app, c.msg_id, null, { beaten: beats });
    commNotice(app, c.player_id, { kind: 'challenge', title: 'Meydan okuman geçildi!', text: `${p.name}, ${level}. bölümde ${fmt(score)} puan yaptı. Rövanş?`, from: app.publicProfile(p), room: teamRoom(p.team_id), msgId: c.msg_id });
    metric(app, 'challenge.beaten');
  }
}

/** bölüm sonucu → akış kartları (bölüm, boss, koklea) — yalnızca ilk kez olanlar */
export function feedFromRun(app: App, pid: string, d: { level: number; completed: boolean; stars: number; mechanic: string; cochleas?: number }, prev: { stars: number } | undefined): void {
  if (!d.completed) return;
  const first = !prev || prev.stars <= 0;
  if (first || (d.stars === 3 && prev!.stars < 3)) feedEvent(app, pid, 'bolum', { levels: [d.level], sl: [`${d.level}:${d.stars}`], stars: d.stars, first: first ? 1 : 0 });
  if (first && d.mechanic === 'boss') feedEvent(app, pid, 'boss', { level: d.level });
  const k = Math.max(0, Math.min(3, Math.floor(d.cochleas ?? 0)));
  if (k > 0) {
    const had = app.db.get<{ n: number }>('SELECT n FROM level_koklea WHERE player_id = ? AND level = ?', pid, d.level)?.n ?? 0;
    if (k > had) {
      app.db.run('INSERT INTO level_koklea(player_id, level, n) VALUES(?, ?, ?) ON CONFLICT(player_id, level) DO UPDATE SET n = excluded.n', pid, d.level, k);
      feedEvent(app, pid, 'koklea', { levels: [d.level], n: k - had });
    }
  }
}
