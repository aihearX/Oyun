/**
 * Kod yönetimi (sunucu makinesinde): `npm run kod -- <komut>` (docs/10-sunucu.md "Kodlar").
 *   ekle KOD [--jeton N] [--kristal N] [--kalkan N] [--kozmetik a,b] [--m5 N] [--m60 N] [--s8 N] [--max N] [--baslangic YYYY-AA-GG] [--bitis YYYY-AA-GG] [--not "metin"]
 *   liste
 *   kapat KOD | ac KOD
 *   ozet [--denetle] → yönetici kodu için yeni özet üretir (kodu standart girdiden okur; ODI_ADMIN_CODE_HASH'e yazılır).
 *                     Kod 16–32 karakter, harf/rakam/tire olmalı; --denetle yalnız uygunluğu söyler.
 *   hesap ARKADAŞ-KODU                     → hesabın özeti (ad, son bağlantı, takım, şikâyet)
 *   hesap-sil ARKADAŞ-KODU --onay [--zorla] → uygulama dışı silme isteği (/hesap-sil): yalnız 14 gündür bağlanmamış hesap
 *   sikayetler [--gun 7]                   → son günlerin şikâyetleri (oyuncu başına, gizlenen iletilerle)
 *   sustur ARKADAŞ-KODU --gun N            → sohbet ve özel mesajı N gün kapatır (0: kaldırır)
 *   cokme [--gun 7]                        → çökme raporları imza başına (YN-011; kişisel veri yok): sayı, ileti, yığın, sürüm, ekran
 *   geribildirim [--gun 7]                 → beta geri bildirimleri, yeniden eskiye: zaman, konu, platform, sürüm, ekran, metin (oyuncu yok)
 *   kurucu --adet N                        → N tek kullanımlık Kurucu Yolcu kodu (KURUCU-XXXX-XXXX; YN-041). Kodlar YALNIZ bu terminale
 *                                            yazılır: depoya, sohbete, ekran görüntüsüne koymayın; her kurucuya ayrı ayrı verin.
 *   avci --adet N                          → N tek kullanımlık Hata Avcısı unvan kodu (AVCI-XXXX-XXXX)
 *   unvan ARKADAŞ-KODU hata-avcisi [--kaldir] → unvanı doğrudan ver / geri al (yönetim kaydına yazılır)
 *   kurucular                              → kurucu sayısı (kaçı Kurucular ekranında görünmeyi seçti); ad yazılmaz
 * Veritabanı: ODI_DB (yoksa apps/server/data/odi.sqlite). Tarihler İstanbul saatiyle; bitiş günü dahildir.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_PATTERN, COMM_RULES, FEEDBACK_TOPIC_LABEL, normalizeCode, ROZETLER, SOCIAL_LIMITS } from '@odi/shared';
import { App, OdiError, type ServerConfig } from './app';
import { createCode, createRozetCodes, hashAdminCode, listCodes, rewardText, rozetVer, setCodeActive } from './codes';
import { isRozetId, kurucuSayisi } from './rozet';
import { crashDetails } from './hata';
import { feedbackList } from './geribildirim';
import { HESAP_SIL_BEKLEME_GUN, hesapBul, hesapSilIstegi, sikayetler, sustur, type HesapOzeti } from './yonetim';

/** üretim yönetici kodu için en kısa uzunluk (docs/18-sunucu-kurulum.md) */
const ADMIN_CODE_MIN = 16;

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
const hesapYaz = (h: HesapOzeti) => console.log([
  `${h.ad} · arkadaş kodu ${h.arkadasKodu}${h.silindi ? ' · SİLİNMİŞ' : ''}`,
  `  açılış ${fmt(h.acilis)} · son bağlantı ${fmt(h.sonBaglanti)} · takım ${h.takim ?? '—'}`,
  `  son 90 günde şikâyet eden ${h.sikayet90} kişi · mesaj kapalı: ${h.susturmaBitis > Date.now() ? `${fmt(h.susturmaBitis)}'e kadar` : 'hayır'}`,
].join('\n'));

async function main(): Promise<void> {
  if (cmd === 'ozet') {
    const chunks: Buffer[] = []; for await (const c of process.stdin) chunks.push(c as Buffer);
    const code = Buffer.concat(chunks).toString('utf8').trim();
    if (!code) throw new Error('kodu standart girdiden ver: ör. `read -s K; printf %s "$K" | npm run kod -- ozet`');
    // oyunda "Kod gir" yalnız CODE_PATTERN'e uyan kodu kabul eder: uymayan kodun özeti hiç açılmayan bir yönetici kodu olurdu
    const norm = normalizeCode(code);
    if (!CODE_PATTERN.test(norm)) throw new Error('yönetici kodu en çok 32 karakter olmalı ve yalnız harf (A–Z, Ç Ğ İ Ö Ş Ü), rakam ve tire içermeli (boşluklar yok sayılır)');
    if (norm.length < ADMIN_CODE_MIN) throw new Error(`yönetici kodu en az ${ADMIN_CODE_MIN} karakter olmalı (boşluklar sayılmaz)`);
    if (argv.includes('--denetle')) { console.log('uygun'); return; }
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
    } else if (cmd === 'hesap') {
      const h = hesapBul(app, argv[1] ?? ''); if (!h) throw new Error('bu arkadaş koduyla hesap yok');
      hesapYaz(h);
    } else if (cmd === 'hesap-sil') {
      const kod = argv[1] ?? ''; const h = hesapBul(app, kod); if (!h) throw new Error('bu arkadaş koduyla hesap yok');
      hesapYaz(h);
      if (!argv.includes('--onay')) { console.log('Silmek için --onay ekleyin (geri alınamaz).'); return; }
      const r = hesapSilIstegi(app, kod, { zorla: argv.includes('--zorla') });
      if (r.ok) console.log(`✓ ${r.ad} silindi (account.delete ile aynı işlem; yedeklerden en geç 7 günde çıkar)`);
      else if (r.neden === 'etkin') throw new Error(`hesap ${r.gun} gün önce bağlandı: ${HESAP_SIL_BEKLEME_GUN} gün bağlanmamış olmalı (oyuncuya oyun içindeki Ayarlar › Hesabı sil yolunu yazın)`);
      else throw new Error(r.neden === 'silinmis' ? 'hesap zaten silinmiş' : 'bu arkadaş koduyla hesap yok');
    } else if (cmd === 'sikayetler') {
      const list = sikayetler(app, num('gun') ?? 7);
      if (!list.length) console.log('(şikâyet yok)');
      for (const r of list) {
        console.log(`${String(r.kisi).padStart(3)} kişi  ${r.arkadasKodu.padEnd(10)} ${r.ad}  [${r.nedenler.join(', ')}]  son ${fmt(r.son)}${r.susturmaBitis > Date.now() ? `  · mesaj kapalı ${fmt(r.susturmaBitis)}'e kadar` : ''}`);
        for (const t of r.gizlenen) console.log(`        gizlenen: «${t}»`);
      }
    } else if (cmd === 'sustur') {
      const g = num('gun'); if (g == null) throw new Error('--gun N eksik (0: susturmayı kaldırır)');
      const h = sustur(app, argv[1] ?? '', g); if (!h) throw new Error('bu arkadaş koduyla (silinmemiş) hesap yok');
      hesapYaz(h);
    } else if (cmd === 'cokme') {
      const list = crashDetails(app, num('gun') ?? 7);
      if (!list.length) console.log('(çökme raporu yok)');
      for (const r of list) {
        console.log(`${String(r.n).padStart(5)} × ${r.imza}  ${r.kind}: ${r.message}`);
        console.log(`        ${r.platformlar} · sürüm ${r.surumler} · ekran ${r.ekranlar || '—'} · ilk ${fmt(r.ilk)} · son ${fmt(r.son)}`);
        for (const l of r.stack.slice(0, 8)) console.log(`          ${l}`);
      }
    } else if (cmd === 'geribildirim') {
      const gun = num('gun') ?? 7;
      const list = feedbackList(app, gun);
      if (!list.length) console.log(`(son ${gun} günde geri bildirim yok)`);
      for (const r of list) {
        console.log(`${fmt(r.at)}  ${FEEDBACK_TOPIC_LABEL[r.topic] ?? r.topic} · ${r.platform} ${r.app}${r.build ? `+${r.build}` : ''} · ekran ${r.screen || '—'}`);
        console.log(`  ${r.text}`);
      }
      if (list.length) console.log(`— ${list.length} kayıt (son ${gun} gün${list.length >= 500 ? '; en yeni 500' : ''})`);
    } else if (cmd === 'kurucu' || cmd === 'avci') {
      const adet = num('adet'); if (!adet) throw new Error(`--adet N eksik: npm run kod -- ${cmd} --adet 50`);
      const rozet = cmd === 'kurucu' ? 'kurucu' : 'hata-avcisi';
      const codes = app.run(() => createRozetCodes(app, rozet, adet));
      // kodlar yalnız bu terminale: depoya, sohbete ya da ekran görüntüsüne koymayın
      for (const c of codes) console.log(c);
      console.error(`✓ ${codes.length} tek kullanımlık ${ROZETLER[rozet].ad} kodu üretildi (her kod bir hesaba bir kez işler). Kodları kişiye özel verin; listeyi saklamayın.`);
    } else if (cmd === 'unvan') {
      const h = hesapBul(app, argv[1] ?? ''); if (!h || h.silindi) throw new Error('bu arkadaş koduyla (silinmemiş) hesap yok');
      const r = argv[2] ?? ''; if (!isRozetId(r) || ROZETLER[r].tur !== 'unvan') throw new Error('unvan adı: hata-avcisi');
      const kaldir = argv.includes('--kaldir');
      const c = app.run(() => rozetVer(app, h.id, r, kaldir));
      console.log(c ? `✓ ${h.ad}: ${ROZETLER[r].ad} ${kaldir ? 'geri alındı' : 'verildi'} (yönetim kaydında)` : `${h.ad}: değişiklik yok (${kaldir ? 'unvan zaten yok' : 'unvan zaten var'})`);
    } else if (cmd === 'kurucular') {
      const k = kurucuSayisi(app);
      console.log(`${k.toplam} Kurucu Yolcu · ${k.listede} kişi Kurucular ekranında görünmeyi seçti`);
    } else {
      console.log('Kullanım: npm run kod -- ekle KOD [--jeton N] [--kristal N] [--kalkan N] [--kozmetik a,b] [--m5 N] [--m60 N] [--s8 N] [--max N] [--baslangic YYYY-AA-GG] [--bitis YYYY-AA-GG] [--not "metin"] | liste | kapat KOD | ac KOD | ozet | hesap ARKADAŞ-KODU | hesap-sil ARKADAŞ-KODU --onay | sikayetler [--gun 7] | sustur ARKADAŞ-KODU --gun N | cokme [--gun 7] | geribildirim [--gun 7] | kurucu --adet N | avci --adet N | unvan ARKADAŞ-KODU hata-avcisi [--kaldir] | kurucular');
    }
  } finally { app.close(); }
}

main().catch((e: unknown) => { console.error(`✗ ${e instanceof OdiError ? e.message : (e as Error).message}`); process.exit(1); });
