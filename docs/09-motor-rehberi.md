# 09 · Motor Rehberi (geliştirici / içerik ekibi)

Bu belge ODİ oynanış çekirdeğinin (v2, bkz. `docs/11-bolum-yeniden-tasarim.md`) nasıl genişletileceğini anlatır.

## Yapı
```
packages/shared      tipler (EntityType, AbilityId, LevelSpec…), rng, sabitler, ekonomi (scoreRun: yıldız kuralı)
packages/content     biyomlar, yetenekler (abilities.ts), odalar (chunks/*.ts), yolculuk planı, boss'lar, hedefler
packages/level-gen   generateLevel(journey, number, profile, salt) → LevelSpec (deterministik; 3 bölüm-içi bölüm)
packages/game-core
  play/consts.ts     fizik sabitleri (koşu, zıplama, coyote 0,1 sn, tampon 0,12 sn, duvar, süzülme…)
  play/world.ts      LevelSpec → World (dünya koordinatlı varlıklar + x kovaları)
  play/sim.ts        deterministik adım: step(world, state, input) — 1/60 sn, Phaser'sız
  play/boss.ts       Serumen Golemi ve Gürültü Canavarı (saf mantık)
  play/planner.ts    otomatik oyuncu: aynı adım üzerinde ileriye bakan arama
  play/visuals.ts    GÖRSEL SEAM'LER (tüm çizim buradan; görsel ekip render/** ile değiştirir)
  play/tutorial.ts   öğretici an (yavaşlatma + büyük el işareti)
  LevelScene.ts      girdi → adımlar → olaylar (ses/ışık/kutlama) → çizim eşitleme; yarış, Şanslı Nota, sonuç
apps/web             React kabuk, ?bot=1 test modu
tools/harness/bot.mjs  Playwright: bölümleri botla oynatır
```
Komutlar (kökten): `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:web`,
`PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/harness/bot.mjs --levels 1-40 --parallel 3 --timeout 300`
(`--idle 1`: boşta oyuncu; hiçbir bölüm bitmemeli).

## Koordinatlar
- Ekran 390×780. Zemin `GROUND_Y = 640`. Kahraman ayak noktası (x, y); gövde 30×42 (kayarken 22).
- Dünya: `START_PAD 220` + odalar + `END_PAD 260`; kapı sona eklenir; sol sınır duvarı. Düşme: y > 640 + 420.
- Yazım kuralı (oda içi x): dikdörtgenler sol-üst (platform, wall, crumble, barrier, door, freqgate, beat, echo, lift, water,
  gravzone, hazard, current); ayaklılar x orta / y taban (enemy, spring, trampoline, launcher, switch, checkpoint, gate);
  noktalar merkez (coin, note, collect, secret, powerup, fork, bubble, hook). `spike`: x sol, y taban.

## Fizik ve yetenekler (play/sim.ts)
- Otomatik koşu 260 px/sn (yerde `vx = dir·RUN`). Hava kontrolü yok; yön yalnızca duvar zıplamasıyla ya da engelde 0,3 sn
  takılınca döner (oyuncu asla mahsur kalmaz).
- Zıplama: dokun ≈ 69 px yüksek / 117 px ileri, tam basılı ≈ 158 px / 221 px (değişken yükseklik: yükselirken bırakınca kesilir).
- Yetenekler bölüm numarasına göre açılır (`content/abilities.ts`): zıpla 1, kayma 3, duvar 6, süzülme + zar 9, kanca 13,
  çakılma 15, yüzme 21, ses darbesi 31, yerçekimi çevirme 35. Açık olmayan yetenek motor tarafından yok sayılır;
  üretici de o yeteneği isteyen odayı seçmez (`chunkNeeds`).
- Girdi (`SimInput`): `down/pressed/released` (dokun/basılı), `swipeDown` (kay / havada çakıl), `dash` (koşu yönüne kaydır), `turn`
  (koşunun tersine kaydır: geri dön — her zaman açık; `switch` props.by 'temas' anahtarları ve geri oyuklar bunu ister).
  Dokunmatik girdide basış 70 ms içinde kaydırma olmazsa kesinleşir (kaydırma ile zıplama karışmaz).
- Değiştiriciler simde: `yanki` girdileri 140 ms geciktirir, `hiz` ×1,3, `tek-can`, `ters-yercekimi` (tavan güvenliyse 8 sn'de bir),
  `ayna` ileri kaydırmayı sola çevirir; `sis/gece/cihaz-kapali` yalnızca görsel/ses.

## Oda yazmak (`packages/content/src/chunks/<biyom>.ts`)
`helpers.ts`: `ground, plat, block, spike, coin(s), coinCol, enemy, power, hazard, secret, checkpoint, spring, trampoline,
moving, wall, hook, crumble, barrier, sw, door, fork, fgate, beat, beatSlide, echo, launcher, water, current, bubble, grav,
lift, collect, tutor, pool, bank`. `chunk(id, mechanic, zorluk 1-5, uzunluk, varlıklar, { tags, biomes, needs, setPiece, rest })`.
- Uzunluk 160–3200; giriş/çıkış zemin seviyesinde, en az 120 px düz; her odada bir `secret` adayı (üretici her bölüm-içi bölümde
  bir tanesini tutar → bölüm başına 3 altın koklea).
- Otomatik koşuda **beklenemez**: zamanlamalı öğeler faza dayanıklı olmalı (ritim platformlarında %75 açık desen, hareketli
  platform menzili her fazda ulaşılabilir). Kayılacak asılı engel alt kenarı zemin−24 (`curtain`).
- Boşta oyuncu ölmeli: duvar kuyusu/anahtar odası gibi "gidip gelme" odalarından önce kısa bir çukur koy.
- Doğrulama: `npm test` — şema, üretici kuralları ve **40 bölümün planlayıcı botla bitirilmesi** (`play/levels-*.test.ts`).
  Hızlı deneme: `play/testkit.ts` → `playLevel(n, { salt, idle })`.

## Bot (play/planner.ts)
Makro eylemler (`press` + basılı süre, `swipe`, `dash`) motorun kendi adımıyla ~1,9 sn ileriye simüle edilir; plan her 0,1 sn
doğrulanır, hasar ya da ilerlemesizlik görülünce yeniden aranır (tek eylem → mevcut plana ek → iki eylem; çakılma hedefleri
için yörüngeden önerilen adım). Simülasyon deterministik olduğundan kare hızından bağımsızdır.

## Boss
`spec.boss` varsa arena tek ekran: iki yanda tırmanılabilir duvar. Golem: gölgeli yumruk (zıplayarak kaçılır), saplı yumruğa
çakılma −2. Canavar: duvardan dalgalar (alçak: zıpla, yüksek: kay), 3 nota → kalp iner → ses darbesi/çakılma −3.

## Görsel seam'ler
`play/visuals.ts` başındaki açıklamaya bakın: `paintBiome`, `makeTerrain`, `drawEntity`, `createHeroView`, `createHud`,
`createBossView`, `createProjectileLayer`. LevelScene başka çizim çağırmaz.
