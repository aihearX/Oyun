# 11 · Bölümlerin Yeniden Tasarımı (v2)

Kullanıcı geri bildirimi: "Genel görünüm çok güzel. Ama oyun içleri çok basit kalmış… mekanikler de çok basit… görünümü kalitesiz. Oyunları baştan yapabilirsin." Harita ve kamp kalitesine çıkıyoruz. Referans: **Rayman Jungle Run / Rayman Fiesta Run** (otomatik koşu, tek dokunuşla derin hareket), **Ori** (ışık ve atmosfer), **Geometry Dash** (müzikle senkron), **Alto's Odyssey** (katmanlı, ışıklı arka planlar).

## 1. Değişmeyen sözleşmeler (kırmızı çizgi)
- `packages/game-core/src/bridge.ts`: `LevelOptions`, `GameEvent`, `LevelHandle`, `startLevel(parent, opts)` imzaları geriye uyumlu kalır (alan EKLENEBİLİR, silinemez). Kabuk, yarış, etkinlikler, sonuç ekranı buna bağlı.
- `RunResult` biçimi aynı (ek alanlar serbest: `maxCombo`, `pct`, `luckyNote`, `firsts` vb. korunur).
- `window.__odi` test köprüsü ve `globalThis.__odiScene` (harness) çalışmaya devam eder; bot modu (`opts.bot`), boşta modu (`opts.botIdle`), `timeScale` desteklenir.
- Korunan özellikler: canlı yarış hayaletleri (`race.ts`, `opts.race`), kozmetik şapka/renk, Şanslı Nota, seri çarpanı ve "Güzel/Mükemmel" sözleri, Revir bonusu (`firstHitIgnorePct`), kalkan, değiştiriciler (sis, gece, ayna, yankı, hız, tek can, ters yerçekimi, cihaz kapalı), son güvenli zeminden yeniden doğma, ses motoru çağrıları (`@odi/audio`).
- Kabul: `node tools/harness/bot.mjs --levels 1-40` → 40/40; `--idle 1` → 0/40 (dokunmadan hiçbir bölüm bitmez); tüm e2e betikleri geçer.

## 2. Kontroller (tek el, otomatik koşu)
| Hareket | Giriş | Açıldığı yer |
|---|---|---|
| Zıpla / yüksek zıpla | dokun / basılı tut | Dış Kulak (1) |
| Kayma | aşağı kaydır (yerde) | Dış Kulak (3) |
| Duvar tırmanma + duvardan zıplama | duvara değince kısa tırmanır; dokun → karşı yöne zıplar ve koşu yönü döner | Kanal (6) |
| Süzülme | havada basılı tut (ses dalgası kanatları) | Kulak Zarı (9) |
| Trambolin zamanlaması | zara değdiğin an dokun (mevcut kural: dokunmazsan sönük) | Kulak Zarı (9) |
| Kancada sallanma | kancanın yakınında basılı tut → sallan, bırak → fırla | Kemikçikler (13) |
| Yere çakılma | havada aşağı kaydır (çatlak zemini kırar, anahtarı tetikler) | Kemikçikler (15) |
| Yüzme | sıvı bölgelerinde basılı tut → yüksel (mevcut yüzme hissi, nefes) | Koklea (21) |
| Ses darbesi (atılma) | ileri/sağa kaydır: kısa atılma; gürültü duvarını kırar, düşmanı dağıtır, yankı yollarını görünür kılar | Sinir (31) |
| Yerçekimi çevirme | çevirici bölgelerde dokun | Beyin Sapı (35) |

İlk açılışta her yetenek için 3-4 sn'lik, oynanarak öğrenilen bir "öğretici an" (ekranda büyük el işareti + yavaşlatılmış zaman, başarıyla devam).

Fizik hissi: coyote time (0,1 sn), zıplama tamponu (0,12 sn), değişken zıplama yüksekliği, yumuşak iniş, duvar kayması sürtünmesi, hava kontrolü yok (otomatik koşu) ama süzülme/darbe ile yön ve mesafe yönetimi.

## 3. Sese dayalı imza mekanikler
- **Ritim platformları** (`beat`): biyom müziğinin vuruşuna (`@odi/audio` sıralayıcı saatine) göre belirir/kaybolur ya da hareket eder; görsel nabız ile vuruş önceden okunur. Müzik kapalıyken de görsel nabızla oynanabilir.
- **Frekans kapıları** (`freqgate` + `fork`): tonotopi renginde diyapazon (`fork`) topla → aynı renkteki kapılar açılır; yanlış renkte kapı katıdır. Koklea'da kısa bulmacalar.
- **Yankı yolları** (`echo`): yalnızca ses darbesinden sonra birkaç saniye görünen platformlar.
- **Gürültü** (`hazard`/`noise`): sürüklenen ya da nabız atan gürültü bulutları; ses darbesiyle dağıtılabilen türleri var.
- **Anahtar ve kapılar** (`switch`/`door`): yere çakılma ya da darbe ile tetiklenir; gizli odalara açılır.

## 4. Öğe türleri (EntityType eklemeleri)
Mevcutlar korunur. Eklenecekler (props ile):
`wall` (dikey yüzey; tırmanılabilir), `hook` (kanca; props.r ip uzunluğu), `crumble` (çatlak zemin; basınca 0,4 sn sonra düşer ya da çakılmayla kırılır), `barrier` (gürültü duvarı; darbe ile kırılır), `switch` (props.id), `door` (props.id, açık/kapalı), `fork` (props.color 0..1 tonotopi), `freqgate` (props.color), `beat` (props.pattern: '1010' vuruş deseni, props.mode: 'belir'|'kay'), `echo` (gizli platform), `launcher` (fırlatıcı; props.vx, vy), `water` (sıvı bölgesi: yüzme fiziği), `gravzone` (yerçekimi çevirme bölgesi), `lift` (yükselen platform), `collect` (büyük nota ödülü, 5 nota değerinde).
Düşmanlar `enemy` props.kind: `devriye` (yürür, kenarda döner), `ucan` (sinüs uçar), `atici` (ses mermisi atar), `ziplayan`, `kalkanli` (yalnız darbe/çakılma ile yenilir). Hepsinin anlaşılır "uyarı" animasyonu olur.

## 5. Bölüm yapısı
- Her bölüm 3 bölüm-içi bölümden oluşur (giriş → gelişim → final), sonunda kapı. Arada kontrol noktaları.
- Toplanabilirler: **notalar** (her bölümde 100'e kadar), **3 altın koklea** (gizli yerlerde; eski tek "secret" yerine), Şanslı Nota.
- Yıldız: 1★ bitir; 2★ notaların %60'ı; 3★ %90 nota **ya da** bölüm hedefi (mevcut hedef türleri korunur, `scoreRun` bu kurala göre güncellenir).
- İçerik: biyom başına el yapımı "odalar" (chunk) + her biyomda 1-2 elle tasarlanmış "set piece" (ör. kulak zarı titreşim koridoru, koklea spiral iniş, sinirde ışık treni kaçışı). Üretici (level-gen) yetenek açıklığına ve ritim eğrisine göre dizer; her bölüm farklı hissettirir.

## 6. Görsel yön ("Kulak Gecesi" ile uyumlu, oynanış okunaklı)
- Biyom başına 4-5 katmanlı, elle boyanmış görünümlü arka plan (gökyüzü/derinlik ışığı, uzak siluetler, orta katman, yakın katman, ön plan örtücüleri) — harita ekibinin `paint.ts` yaklaşımı (Canvas 2D ile bir kez çizim, gradyan, suluboya dokusu) ve kamp ekibinin ışık dili.
- Zemin: düz dikdörtgen değil; kenarlı, gölgeli, üstü biyoma özgü (kıl/tüy, serumen, zar dokusu, kemik, tüylü hücreler, sinir lifi, nöron), iç kısmı karanlığa doğru geçişli, yuvarlatılmış köşeler.
- Işık: Odi'nin etrafında yumuşak ışık halesi, notaların parıltısı, tehlikelerde kırmızı nabız, sisli derinlik, ekran kenarında hafif vinyet.
- Odi: degrade küre + parlaklık, göz kırpma ve ileri bakma, koşu zıplayışı, zıplamada uzama, inişte basılma, darbe izi, süzülmede ses dalgası kanatları, kozmetik şapka.
- Oyun içi gösterge (HUD): koyu cam üzerine altın; nota sayacı (toplanınca uçan nota), 3 altın koklea yuvası, can, ilerleme çubuğu, duraklat düğmesi. Beyaz çubuk kaldırılır.
- Okunaklılık: tehlike = sıcak kırmızı/mor, güvenli = biyom zemini, etkileşim = altın/turkuaz parıltı.

## 7. Ekipler ve sahiplik
- **Oynanış motoru**: `packages/game-core/src/play/**` (yeni denetleyici, yetenekler, öğe davranışları, sıvı/yerçekimi bölgeleri, ritim saati bağlantısı), `LevelScene.ts`, `mechanics/**`, `bot.ts`, `input.ts`, `packages/shared/src/types.ts` (eklemeler), `packages/content/src/{journeys.ts,chunks/**,objectives.ts}`, `packages/level-gen/**`, `packages/shared/src/economy.ts` (yıldız kuralı).
- **Görsel**: `packages/game-core/src/render/**` (biyom ressamı, zemin, dekor, ışık, parçacık, karakter ve düşman çizimleri, oyun içi HUD), `parallax.ts`, `art.ts`, `hero.ts`, `entities.ts` içindeki çizim kısımları, `ui.ts` oyun içi kısım. Motor, görsel ekibin dışa aktardığı fabrika işlevlerini çağırır:
  - `paintBiome(scene, biome, worldW, worldH): BiomeBackdrop` (`update(cam)` ile paralaks)
  - `makeTerrain(scene, rects, biome): void` (katı zeminlerin görselini toptan çizer; fizik gövdeleri motorda)
  - `entitySprite(scene, e: Entity, biome): Phaser.GameObjects.GameObject` (her EntityType için görsel; fizik gövdesini motor ekler)
  - `heroSkin(scene, cosmetic) → anahtar/animasyon` ve `HeroFx` (ışık halesi, iz, kanatlar)
  - `LevelHud` (nota, altın koklea, can, ilerleme, seri, duraklat)
  Görsel ekip, motor hazır olmadan da bu işlevleri bağımsız bir "vitrin" sahnesinde (tools/harness/scratch) geliştirip ekran görüntüsüyle doğrular.
- **Bölüm tasarımı ve boss'lar**: motorun API'si oturunca ayrı ekip(ler).
