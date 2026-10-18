# 09 · Motor Rehberi (geliştirici / içerik ekibi)

Bu belge ODİ çekirdeğinin nasıl genişletileceğini anlatır. Yeni bir mekanik, parça (chunk) veya boss eklerken buradan başla.

## Yapı
```
packages/shared      tipler, rng, sabitler, ekonomi (bağımlılığı yok)
packages/content     biyomlar, mekanik tanımları, parçalar (chunks/*.ts), yolculuklar, boss'lar, yetenekler
packages/level-gen   generateLevel(journey, number, profile, salt) → LevelSpec (deterministik)
packages/game-core   Phaser: LevelScene, Hero, TouchInput, entities, mechanics/*, bot (scan), ui, audio, art
apps/web             React kabuk (harita → bölüm → sonuç), zustand kalıcı durum, ?bot=1 test modu
tools/harness/bot.mjs  Playwright: bölümleri otomatik oyuncuyla oynatır, hata/ekran görüntüsü toplar
```
Komutlar (kökten): `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:web`, `npm run dev`,
`PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/harness/bot.mjs --levels 21-30 --tag yuzme --parallel 2 --shots 1`

## Koordinatlar
- Ekran 390×780 (FIT). Zemin `GROUND_Y = 640`. Kahraman origin (0.5, 1): `hero.y` = ayak.
- Parça (chunk) koordinatları parça içinde göreli; sahne `worldX + e.x` ile yerleştirir. `entryY/exitY` parça giriş-çıkış yüksekliği.
- Dünya: `START_PAD 220` + parçalar + `END_PAD 260`; kapı (`gate`) sona otomatik eklenir. Dünya sınırı y: −1200 … 940.

## Mekanik yazmak (`packages/game-core/src/mechanics/<id>.ts`)
```ts
export const yuzme: Mechanic = {
  id: 'yuzme',
  setup(ctx) { /* yerçekimi, hız, ipucu; ctx.state.custom.* kendi durumun */ },
  update(ctx, input, dt) { /* her kare: hız/zıplama/nefes… */ },
  spawn?(ctx, e, worldX) { /* mekaniğe özel varlık; true dönersen genel üretici atlar */ },
  onSpecial?(ctx, sprite, e) { /* gear/current/bubble/lane/flip temas; true = işledim */ },
  onDamage?(ctx) {},
  botTick(ctx, input, scan) { /* otomatik oyuncu: input.tap()/hold(ms)/swipeDown()/virtual */ },
  teardown?(ctx) {},
};
```
- `ctx.hero.body` Arcade body; `ctx.input` TouchInput; `input` o karenin InputState'i (`primaryPressed` tek kare, `primaryDown` basılı, `secondaryPressed` aşağı kaydırma, `dir` −1/0/1 sağ-sol yarım, `pointerX` 0..1).
- `ctx.damage('sebep')`, `ctx.finish()`, `ctx.fail()`, `ctx.float(x,y,'+50')`, `ctx.flash()`, `ctx.shake()`, `ctx.haptic('medium')`, `ctx.hint('metin', ms)`, `ctx.scan()`.
- `ctx.state`: lives, coins, score, timeSec, speedMult, gravityDir, shield, custom{}. Boss yenildiğinde `ctx.state.custom.bossDefeated = true` ve `ctx.finish()`.
- Ses: `sfx.jump/coin/hit/power/bounce/tick/toneAt(freq, dur)`. Doku: `emojiTexture`, `roundRectTexture`, `heroTexture`, `tonotopyColor(t)`.
- Bot `scan`: `hazard {dist,type,y,h}`, `gap {dist,width}`, `step {dist,y}`, `drop {dist,depth}`, `coin {dist,y}`. Serbest hareketli mekaniklerde (yüzme, impuls) kendi taraman gerekebilir: `ctx.groups.*.getChildren()`.
- Kayıt: `mechanics/index.ts` REGISTRY'de zaten tüm id'ler var; stub dosyayı gerçek uygulamayla değiştir.

## Parça yazmak (`packages/content/src/chunks/<mechanic>.ts`)
`helpers.ts`: `ground(x,w)`, `plat(x,y,w)`, `spike(x,w)`, `coin`, `coins(x,y,n,gap,arc)`, `enemy(x,y,kind,dx)`, `power(x,y,'shield'|'magnet'|'life'|'speed')`, `hazard(x,y,w,h)`, `text`, `secret`, `checkpoint(x)`, `spring(x,y,power)`, `trampoline(x,y,w,power)`, `moving(x,y,w,dx,dy,period)`. Diğer türler için `{ type:'gear', x, y, props:{ r:40, speed:1 } }` gibi ham Entity yaz.
- `chunk(id, mechanic, difficulty 1-5, length, entities, { entryY, exitY, tags, biomes, rest })`.
- Kurallar: uzunluk 160–2400; her varlık `0 ≤ x ≤ length`; id benzersiz; zorluk 1 = güvenli, 5 = usta. Her mekanikte en az: 2 `rest` parça (biri `checkpoint`), 2 `ogretici`, 1–2 `gizli` (`secret`), 12+ normal parça; zorluk dağılımı 1..5 her seviyede ≥2.
- Hedef türleri: `collect-all` parçalardaki `coin` sayısına bakar; `melody` için `{type:'note', x, y, props:{ idx:0.., t:0..1 }}` (sıralı notalar; `t` tonotopi rengi/frekansı); `escort` için `escortee` varlığı parçanın başında; `secret` için `secret` varlığı.
- Doğrulama: `npm test` `validateChunks` çalıştırır (packages/content/src/chunks.test.ts).
- Adil tasarım: diken ve düşman inişe denk gelmesin; boşluk ≤ 220 px (çift zıplamasız), platform farkı ≤ 160 px; engel sonrası en az 120 px nefes.

## Boss (`mechanics/boss.ts`)
`spec.boss` (`{id, name, hp, phases}`) var, `spec.chunks` boş; sahne düz arena üretir. Boss mekaniği arenayı, fazları, saldırı desenlerini ve bot'u kendisi kurar. Boss id'ye göre dallan (`serumen-golemi`, `gurultu-canavari`).

## Harness
`?bot=1&level=N[&ts=2][&skills=all][&salt=K]` → window.__odi {events, result, done, spec}; `globalThis.__odiScene` sahne. `--tag` ile ayrı dist/çıktı: aynı anda birden çok harness güvenle çalışır. Çıktı: `tools/harness/out/<tag>/L21-end.png`, `results.json` (`--json 1`).
Kabul ölçütü: her bölüm botla tamamlanır (`OK`), konsolda hata yok, ekran görüntüsünde dünya ve kahraman görünür.

## Oyun hissi kuralları (bot turlarından çıkan dersler)
- **Zıplama kaymayı iptal eder.** Kayarken zıplama tuşu yutulmamalı; koşu, makine ve boss arenasında böyle.
- **Ardışık tehditler arası süre, havada kalma süresinden uzun olmalı.** Tam zıplama ~0,9 sn sürer; alçak engeli atlayan oyuncu yüksek engelin önüne inmemeli.
- **Faz geçişinde nefes payı.** Boss sersemlemeden çıktıktan sonra ilk saldırı en az 900 ms sonra gelir.
- **Bot kare hızından bağımsız olmalı.** Harness ortak CPU'da 5-15 fps, WebKit'te 60 fps görür; ikisinde de geçmeyen bölüm ya tasarım ya bot hatasıdır, ikisi ayrı ayrı incelenir.
- **Düşen oyuncu çukurun gerisinden devam eder.** Sahne, sabit platform üstünde ve yakınında tehlike olmayan son konumları kaydeder; düşünce en az 180 px geriden yeniden doğar. Kontrol noktası olmayan bölümde bile oyuncu başa dönmez.
- **Hareketli platformlar geride kalınca silinmez**, yalnızca jeton, düşman ve güçlendiriciler silinir.
