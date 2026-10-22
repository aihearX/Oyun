/**
 * Kod yönetimi (sunucu makinesinde): `npm run kod -- <komut>` (docs/10-sunucu.md "Kodlar").
 *   ekle KOD [--jeton N] [--kristal N] [--kalkan N] [--kozmetik a,b] [--m5 N] [--m60 N] [--s8 N] [--max N] [--baslangic YYYY-AA-GG] [--bitis YYYY-AA-GG] [--not "metin"]
 *   liste
 *   kapat KOD | ac KOD
 *   ozet            → yönetici kodu için yeni özet üretir (kodu standart girdiden okur; ODI_ADMIN_CODE_HASH'e yazılır)
 * Veritabanı: ODI_DB (yoksa apps/server/data/odi.sqlite). Tarihler İstanbul saatiyle; bitiş günü dahildir.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMM_RULES, SOCIAL_LIMITS } from '@odi/shared';
import { App, OdiError, type ServerConfig } from './app';
import { createCode, hashAdminCode, listCodes, rewardText, setCodeActive } from './codes';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'yardim';
const flag = (k: string) => { const i = argv.indexOf(`--${k}`); return i < 0 ? undefined : argv[i + 1]; };
const num = (k: string) => { const v = flag(k); if (v == null) return undefined; const n = Number(v); if (!Number.isInteger(n) || n < 0) throw new Error(`--${k} bir tam sayı olmalı`); return n; };
/** YYYY-AA-GG → o günün 00:00'ı (İstanbul, +03:00) */
const day = (k: string, end = false) => {
  const v = flag(k); if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`--${k} biçimi YYYY-AA-GG olmalı`);
  const t = Date.parse(`${v}T00:00:00+03:00`); if (Number.isNaN(t)) throw new Error(`--${k} geçersiz tarih`);
  return end ? t + 86_400_000 : t;
};
const fmt = (t: number | null) => (t == null ? '—' : new Date(t).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }));

async function main(): Promise<void> {
  if (cmd === 'ozet') {
    const chunks: Buffer[] = []; for await (const c of process.stdin) chunks.push(c as Buffer);
    const code = Buffer.concat(chunks).toString('utf8').trim();
    if (!code) throw new Error('kodu standart girdiden ver: ör. `read -s K; printf %s "$K" | npm run kod -- ozet`');
    console.log(hashAdminCode(code));
    return;
  }
  const dbFile = process.env.ODI_DB || path.resolve(here, '../data/odi.sqlite');
  const cfg = { port: 0, host: '127.0.0.1', dbFile, now: () => Date.now(), raidAlways: false, testStore: false, revenueCatKey: null, raceCountdownMs: SOCIAL_LIMITS.raceCountdownMs, raceFinishGraceMs: 60_000, sweepMs: 5000, pingMs: 25_000, msgPerSec: 30, log: false, version: 'cli', eventsFast: false, eventsEpoch: 0, freeTextCleared: COMM_RULES.freeTextLevel, adminCodeHash: process.env.ODI_ADMIN_CODE_HASH } as ServerConfig;
  const app = new App(cfg);
  try {
    if (cmd === 'ekle') {
      const code = argv[1]; if (!code || code.startsWith('--')) throw new Error('kod adı eksik: npm run kod -- ekle KOD --jeton 500');
      const koz = flag('kozmetik');
      const v = app.run(() => createCode(app, {
        code, by: 'cli', note: flag('not'), maxUses: num('max') ?? null, startsAt: day('baslangic'), endsAt: day('bitis', true),
        rewards: { jeton: num('jeton'), kristal: num('kristal'), kalkan: num('kalkan'), kozmetik: koz ? koz.split(',').map((x) => x.trim()) : undefined, hizlandirici: { m5: num('m5'), m60: num('m60'), s8: num('s8') } },
      }));
      console.log(`✓ ${v.code} eklendi: ${rewardText(v.rewards)} · en çok ${v.maxUses ?? 'sınırsız'} kullanım · ${fmt(v.startsAt)} → ${fmt(v.endsAt)}`);
    } else if (cmd === 'liste') {
      const list = listCodes(app);
      if (!list.length) console.log('(kod yok)');
      for (const c of list) console.log(`${c.active ? '●' : '○'} ${c.code.padEnd(16)} ${String(c.uses).padStart(5)}/${c.maxUses ?? '∞'}  ${rewardText(c.rewards)}  ${fmt(c.startsAt)} → ${fmt(c.endsAt)}${c.note ? `  «${c.note}»` : ''}`);
    } else if (cmd === 'kapat' || cmd === 'ac') {
      const code = argv[1]; if (!code) throw new Error('kod adı eksik');
      const v = app.run(() => setCodeActive(app, code, cmd === 'ac'));
      console.log(`✓ ${v.code} ${v.active ? 'açıldı' : 'kapatıldı'}`);
    } else {
      console.log('Kullanım: npm run kod -- ekle KOD [--jeton N] [--kristal N] [--kalkan N] [--kozmetik a,b] [--m5 N] [--m60 N] [--s8 N] [--max N] [--baslangic YYYY-AA-GG] [--bitis YYYY-AA-GG] [--not "metin"] | liste | kapat KOD | ac KOD | ozet');
    }
  } finally { app.close(); }
}

main().catch((e: unknown) => { console.error(`✗ ${e instanceof OdiError ? e.message : (e as Error).message}`); process.exit(1); });
