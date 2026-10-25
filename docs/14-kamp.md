# 14 · Kulak Kampı: odyoloji temalı binalar, Tedavi Odası, açılımlar ve bölge anıtları

Kamp artık süs değil, kulak/odyoloji yolculuğunun bir parçası: her bina gerçek bir odyolojik işlevi temsil eder, seviyeler
oynanışa ve bilgiye dönük şeyler açar, Tedavi Odası bölümlere götürülen koruma/tedavi malzemesi üretir, haritada ulaşılan her
bölge kampa bir anıt getirir. Tasarım dürüst: gizli şans yok, sahte baskı yok; malzemeler öğretmek içindir, tıbbi öneri değildir.

> **Kamp Görevleri ve kamp etkinlikleri** (Hasta Vakaları / Odyoloji Kliniği, Vaka Defteri, Kampın Hikâyesi, günlük ve haftalık
> kamp görevleri, başarılar, Ton Avı, Timpanogram Eşleştir, Konsültasyon): ayrı belge [17-kamp-gorevleri.md](17-kamp-gorevleri.md).

Kod: `packages/content/src/kamp.ts` (bina açıklamaları, açılım tablosu, kamp terimleri, anıtlar), `packages/content/src/remedies.ts`
(malzeme kaydı ve üretim kuralları), `apps/server/src/camp.ts` + `camp-schema.ts` (sunucu), `packages/game-core/src/camp/**`
(sahne: Tedavi Odası binası, Kulak Yolu anıtları), `apps/web/src/camp/**` (paneller, çanta, Tüy Dede kartı).

## 1. Binalar (kimlikler kalıcı)

Kimlikler değişmedi (kayıtlar ve sunucu satırları bunlara bağlı); adlar, açıklamalar ve "Daha fazla" satırları değişti.

| kimlik | ad | oyun etkisi (değişmedi) | odyolojik karşılık |
|---|---|---|---|
| `merkez` | **Odyoloji Merkezi** | diğer binaların en yüksek seviyesi | test bataryası, çapraz kontrol ilkesi |
| `laboratuvar` | **Odyometri Odası** | bölüm jetonu +%3/Sv ("ölçtükçe daha çok öğrenirsin") | saf ses ve konuşma odyometrisi, hava/kemik yolu |
| `atolye` | **İşitme Cihazı Atölyesi** | bölüm başı kalkan şansı +%4/Sv ("ayarlı cihaz destek olur") | amplifikasyon, NAL-NL2 / DSL, kulak kalıbı |
| `depo` | **Kulak Deposu** (ad korunur: FTUE satırı kayıtlı) | saatte Sv × 20 jeton, 8 saatte dolar ("kulak kiri gibi birikir") | serumen ve epitel göçü |
| `kule` | **Timpanometri Kulesi** | savaş puanı +%2/Sv | 226 Hz prob, timpanogram tipleri, akustik refleks |
| `revir` | **Odyoloji Kliniği** | ilk hasarı yok sayma şansı +%3/Sv ("erken tanı korur") | otoskopi, tarama, kayıp dereceleri |
| `tedavi` | **Tedavi Odası** (YENİ) | malzeme üretir (§3) | koruma ve tedavi yöntemleri |

Bina panelinde "Odyolojide" kutusu: sade cümle + "Daha fazla" teknik satır + kaynak (`BUILDING_INFO`). Kısa ad (`BUILDINGS[].short`)
üst göstergede kullanılır (Merkez, Odyometri, Atölye, Depo, Kule, Klinik, Tedavi).

**Tüy Dede**: her yükseltmede binanın işleviyle ilgili tek satır (bina başına 3 satır, seviyeye göre sırayla:
`kamp-sv-<bina>-1..3`); kamp ekranının altındaki kartta görünür, kayıt varsa kayıtla, yoksa cihaz sesiyle (ayar kapalıysa sessiz).

## 2. Seviye açılımları

| bina | Sv | açılan |
|---|---|---|
| Odyometri Odası | 2 | Sözlük: Saf ses odyometrisi |
| Odyometri Odası | 3 | Dolap: **Sol Kulak Mavisi** (odyogramda sol kulak mavi çarpı) |
| Odyometri Odası | 5 | Sözlük: Hava yolu ve kemik yolu |
| Odyometri Odası | 6 | Dolap: **Sağ Kulak Kırmızısı** |
| Odyometri Odası | 9 | Sözlük: Konuşma odyometrisi (SRT, ayırt etme) |
| İşitme Cihazı Atölyesi | 3 / 7 | Sözlük: Kulak kalıbı / Uyum reçetesi (NAL-NL2, DSL) |
| İşitme Cihazı Atölyesi | 9 | Dolap: **İmplant Ustası Kostümü** (renk + koklea tokası) |
| Kulak Deposu | 3 | Sözlük: Epitel göçü |
| Timpanometri Kulesi | 2 / 6 | Sözlük: Timpanogram tipleri / Eşdeğer kulak kanalı hacmi |
| Timpanometri Kulesi | 5 | Dolap: **Tip A Turkuazı** |
| Odyoloji Kliniği | 2 / 6 | Sözlük: Otoskopi / İşitme kaybı dereceleri |
| Odyoloji Kliniği | 4 | Dolap: **Klinik Yeşili** |
| Odyoloji Merkezi | 4 | Sözlük: Odyolojik test bataryası |
| Odyoloji Merkezi | 8 | Dolap: **Diyapazon Kostümü** (renk + nota anteni) |
| Odyoloji Merkezi | 12 | Çantaya +1 yer |
| Tedavi Odası | 1–13 | Tarifler (§3) |
| Tedavi Odası | 2 / 5 / 8 | Sözlük: İşitme koruyucu ve gürültü sınırı / Timpanostomi / Stapedotomi |
| Tedavi Odası | 3 | Dolap: **Kulak Koruyucu Kostümü** (turuncu + kulaklık) |
| Tedavi Odası | 6 | Çantaya +1 yer |

- **Kozmetikler** yalnızca görünüştür; mevcut şapka çizimlerini kullanır (yeni şapka çizimi oyun ekibinin `render/**` dosyasında
  olurdu). Sunucu inşaat bitince ya da kamp açılınca bir kez verir (`camp_unlocks` + `players.cosmetics`); istemci kamp durumu
  gelince hemen Dolap'a ekler (`net.ts › syncCampUnlocks`). Kilit metni: "Kamp: Odyometri Odası Sv 3".
- **Kulak Sözlüğü**: "Kulak Kampı" bölümü (14 terim). Açık terimler tam görünür (sade + Daha fazla + açan bina), kilitliler
  "Odyometri Odası Sv 5 · yeni terim" satırıyla. Bölge terimleriyle aynı sözleşme (`GlossaryTerm`); kimlikler çakışmaz (test).
- **Pasif güç**: bilinçli olarak yeni yüzde eklenmedi (mevcut bina etkileri zaten pasif güç). Tek ek: çanta yeri 2 → 3 (Tedavi
  Odası Sv 6) → 4 (Merkez Sv 12). Bir malzeme bir engeli bir kez aşar; bölüm zorluğu ölçümlerini bozmaz.
- Bina panelinde "Sv N ile açıldı" ve "Sv N açar" çipleri; yükseltme kutlamasında açılanlar afişte yazılı.
- **Yükseltme kutlaması** (afiş "<Bina> Sv N!", görsel kademe değişince Sv 4/7/10/13'te büyük "Seviye" anı; ikisinde de Tüy Dede
  satırı): her bina seviyesi oyuncu başına **tam bir kez** (`apps/web/src/camp/built.ts`). Aynı bitiş istemciye birkaç yoldan gelir
  (kristalle bitirmede işlem yanıtı + `camp.updated` itmesi; takım yardımında art arda iki itme; süre dolunca itme + istemcinin
  tazelemesi); kutlama gelen seviyeleri oyuncunun gördüğü seviyelerle karşılaştırır, Phaser sahnesinin saatine ve görünüme (üs/liste)
  bağlı değildir. Taban oturumun ilk kamp durumudur; kamp dışındayken biten inşaat kampa dönülünce kutlanır; yalnız +1 seviye
  kutlanır. Açık paneldeki inşaat bitince panel kapanır (kutlama, sahnedeki yükseliş ve Tüy Dede kartı görünsün); sırada bekleyen
  "inşaatı başladı" bildirimi düşer.

## 3. Tedavi Odası ve malzemeler

Akış: tarif seç → bina sürekli hazırlar → raf dolunca (yoksa durur) topla → çanta → bölüm kartında "Çanta"ya koy → Oyna.

**Kurallar** (`remedies.ts`, sunucu ve istemci aynı formül):
- bir adetin süresi `dakika × max(0,55; 1 − 0,03 × (Sv − 1))`;
- raf `2 + ⌊Sv/3⌋` (dolu rafta üretim durur, "Topla" ister); toplamada sığmayan rafta kalır;
- çantada bir malzemeden en çok 9; raftakiler çantaya sığmıyorsa tarif değiştirilemez (`DOLU`, kayıp yok);
- bölüme götürme: en çok `carrySlots` (2/3/4); **yalnız kullanılan adet düşer**, kullanılmayan kaybolmaz.

| malzeme (kimlik) | Sv | süre (Sv 1) | etkisiz kıldığı patoloji kimlikleri |
|---|---|---|---|
| Kulak tıkacı (`kulak-tikaci`) | 1 | 20 dk | `gurultu-hasari`, `eksostoz` |
| Kulak kiri yumuşatıcı damla (`serumen-damlasi`) | 1 | 30 dk | `serumen-tikaci` |
| Dış kulak damlası (`dis-kulak-damlasi`) | 2 | 40 dk | `otitis-eksterna` |
| Zar yaması (`zar-yamasi`) | 3 | 60 dk | `perforasyon` |
| Ventilasyon tüpü (`ventilasyon-tupu`) | 4 | 60 dk | `otitis-media`, `ostaki`, `retraksiyon` |
| Kemikçik protezi (`kemikcik-protezi`) | 6 | 90 dk | `zincir-kopuk` |
| Stapes protezi (`stapes-protezi`) | 7 | 90 dk | `otoskleroz` |
| İşitme cihazı (`isitme-cihazi`) | 8 | 120 dk | `presbiakuzi`, `timpanoskleroz` |
| Ses üreteci (`ses-ureteci`) | 10 | 90 dk | `tinnitus` |
| Uzaktan mikrofon (`uzaktan-mikrofon`) | 11 | 120 dk | `merkezi`, `noropati` |
| Koklear implant (`koklear-implant`) | 13 | 240 dk | `ototoksisite`, `presbiakuzi` |

`meniere` ve `noroma` için bilinçli olarak malzeme yok: tedavileri hekimin yönettiği süreçlerdir (test bunu sabitler).
Her malzemede sade satır, teknik satır, kaynak, renk; kartlarda dürüstlük notu (`REMEDY_DISCLAIMER`). Bölüm kartında
"Bu bölgede işe yarayabilir" ipucu `REGION_PATHOLOGIES`'ten gelir (bölümde gerçekte neyin çıktığını oyun belirler).

## 4. Oyun ekibiyle sözleşme (malzemenin bölümdeki etkisi)

Bu ekip `packages/game-core/src/play/**`, `render/**`, `LevelScene.ts` dosyalarına dokunmadı. Uygulama oyun ekibinde:

1. **Giriş** — `LevelOptions.remedies?: { id: string; count: number }[]` (`bridge.ts`). Kabuk, bölüm kartında seçilen çantayı
   verir (yarışta ve etkinlikte verilmez; bot modunda verilmez). Kimlikler `@odi/content` `REMEDIES`, `remedyById(id).counters`
   hangi patoloji kimliklerine karşı işe yaradığını söyler (`remediesFor(pathologyId)` tersini).
2. **Etki** — Oyuncu bir patoloji engeline çarpınca (ya da engel tetiklenince), elinde `counters` listesinde o patolojiyi içeren bir
   malzeme varsa bir adet harcanır ve engel **bir kez** etkisiz kalır (öneri: engel sönükleşir, malzemenin simgesi parlar, kısa
   yazı "Kulak tıkacı korudu!"). Birden çok uygun malzeme varsa en ucuz (en düşük `level`) olan harcanır. Can kaybı, puan cezası
   yoksa aynı kalır; malzeme zorluk eğrisini bozmaz (bölüm başına en çok 4 adet).
3. **Bildirim** — her kullanımda `GameEvent { type: 'remedy', id, pathology, left }` (isteğe bağlı; kabuk ses/titreşim için dinleyebilir).
4. **Sonuç** — `RunResult.remediesUsed?: { id, count }[]` (yalnız kullanılanlar). Kabuk bunu `progress.submit.remediesUsed` ile
   gönderir; sunucu envanterden **runId başına bir kez** düşer (sıfırın altına inmez, bilinmeyen kimlik yok sayılır, yarışta düşmez).
5. **Patoloji kimlikleri** (geçici; hizalanınca aynı kalır): `serumen-tikaci, otitis-eksterna, eksostoz, perforasyon, timpanoskleroz,
   retraksiyon, otitis-media, ostaki, otoskleroz, zincir-kopuk, gurultu-hasari, presbiakuzi, ototoksisite, meniere, noroma, noropati,
   tinnitus, merkezi` (`PATHOLOGY_IDS`) — oyun ekibinin `packages/content/src/patolojiler.ts` → `PATOLOJI_IDS` listesiyle birebir aynı;
   `REGION_PATHOLOGIES` da oradaki `bolge` eşlemesinin aynısıdır. Yeni bir kimlik eklenirse `PATHOLOGY_IDS`/`PATHOLOGY_NAMES`'e de eklensin.
6. Not: `LevelScene.ts` içindeki "Revir korudu!" yazısı "Klinik korudu!" olmalı (bina adı değişti; dosya oyun ekibinde).

Test kancası: `window.__odi.remedies` bölüme verilen malzemeyi gösterir (camp-e2e B9).

## 5. Bölge anıtları ("Kulak Yolu")

Ön kıyıda, iskele yolunun iki yanında zikzak iki sıra halinde 10 kaide; soldan sağa kulaktan beyne. Haritada bir bölgeye ulaşınca
(Kulak Sözlüğü ile aynı kural: geçilen bölümler + sıradaki bölümün bölgesi) o bölgenin anıtı yükselir:

| bölge | anıt |
|---|---|
| Dış Kulak | Kulak Kepçesi Heykeli (heliks, antiheliks, konka, tragus) |
| Kanal | Kanal Kemeri (S kıvrımı, girişte kulak kılları, sonda inci zar ışığı) |
| Zar | Kulak Zarı Davulu (timpanik halka, çekiç sapı/umbo, ışık üçgeni) |
| Kemikçikler | Üç Kemikçik Anıtı (çekiç, örs, üzengi) |
| Koklea 1 | Koklea Sarmalı (2,5 tur; oval ve yuvarlak pencere) |
| Koklea 2 | Tüy Hücresi Demeti (basamaklı stereosilya, uç bağlantıları) |
| Koklea 3 | Tonotopi Arpı (tabanda kısa teller, tepede uzun) |
| Sinir | Sinir Lifi Feneri (nöron, miyelinli akson) |
| Beyin Sapı | İki Kulak Kavşağı (iki yol ortadaki düğümde buluşur) |
| Korteks | Heschl Işığı (beyin, şakak lobunda yanan Heschl girusu) |

Ulaşılmayan bölgenin yerinde kesik çizgili hayalet çerçeveli boş kaide durur (hedef görünür). Yeni anıt: kamera kayar, anıt
topraktan yükselir, toz + ışık + ışın + konfeti + havai fişek (azaltılmış harekette sade), Tüy Dede satırı (`anit-<bölge>`).
Bir ziyarette en çok bir kutlama (görülmemişlerin en ilerisi); "görüldü" listesi cihazda (`odi.kamp.anitlar`); kamp öğreticisi
bitmeden kutlama yapılmaz. Anıta dokununca sessiz bilgi kartı (ad + bölge + kısa bilgi).

## 6. Sunucu

- Yeni tablolar (`camp-schema.ts`, her açılışta yalnız ekleyen): `remedy_inv`, `remedy_prod`, `remedy_use`, `camp_unlocks`;
  eski oyunculara `tedavi` satırı `INSERT OR IGNORE` ile Sv 0 eklenir (göç testi: var olan veritabanında iki kez açılış).
- `CampState.remedy?: { item, since, inv }` (eski istemciler yok sayar). Yeni işlemler: `camp.remedy.make { item | null }`
  (raftakiler önce çantaya), `camp.remedy.collect {}` (zamana bağlı; hemen ikinci çağrı 0). `progress.submit.remediesUsed`.
- Hata kodları: `SART` (bina kurulmadı / tarif seviyesi), `YOK` (bilinmeyen tarif), `DOLU` (raftakiler çantaya sığmıyor).

## 7. Doğrulama

- Birim: `apps/server/test/kamp-tedavi.test.ts` (üretim zamanı, raf/çanta sınırı, idempotent toplama ve kullanım, açılım bir kez,
  göç), `packages/content/src/kamp.test.ts` (içerik eşsizliği ve Türkçe denetimi, kurallar, açılım tablosu), `apps/web/src/ftue/kamp-lines.test.ts`.
- Uçtan uca: `node tools/harness/camp-e2e.mjs` (önizleme; Chromium + WebKit gerçek akış; anıt; dom hedefi; `--only kutlama`:
  kristal / süre / takım yardımıyla biten inşaatta afiş ve Tüy Dede kartı tam bir kez, Chromium + WebKit + dom) ve
  `node tools/harness/ui-mobile-check.mjs --only kamp` (Tedavi Odası paneli 390×844 ve 320×640).
- Üst bant: kamp başlığının altındaki gösterge çipleri (Kamp Seviyesi, İnşaatçı, hızlandırıcılar, Görevler/Klinik, ziyaretteki
  alkış sayısı) sığmazsa alt satıra geçer; hiçbiri kırpılmaz, yatay kaydırma yok. Hızlandırıcı çipi yalnız eldeki türleri gösterir
  (hiç yoksa çip görünmez). `tools/harness/hud-fit.mjs` bunu ölçer:
  ui-mobile-check her ekranda (boşta, inşaat sürerken, görev çipleriyle; `--only kamp,gorev`), camp-e2e ziyaret kipinde 390 ve 320 px'te.
- Kamp büyümesi: `apps/server/test/kamp-buyume.test.ts` (XP ve ref ile bir kez, seviye ödülleri bir kez, Akustik Kabin bonusu,
  geriye dönük tohum ve anıt XP'si, eski istemci, süs yerleştir/taşı/kaldır/çakışma/sınır, `grantDecoration`, Kütüphane, depo süresi,
  güç tavanı, ziyaret izinleri ve günde bir alkış, göç iki kez), `packages/content/src/kamp-buyume.test.ts` (seviye ödülleri tutarlı,
  bölgeler çakışmaz, arsalar kendi bölgesinde, ızgara kuralları, süslemeler Türkçe), `apps/web/src/ftue/kamp-lines.test.ts`
  (bölge/seviye/süs/ziyaret satırları; yeni satırlarda "jeton" yok). Uçtan uca: `node tools/harness/camp-e2e.mjs --only buyume`
  (önizleme Kamp Sv 1/9/30; gerçek akış: Kamp Seviyesi kutlaması tam bir kez, süsleme, Sessiz Koru açılır, ziyaret + alkış, eski
  istemci; dom: Kamp Sv 30'da doku belleği < 140 MB). Görünüm: `node tools/harness/kamp-sheet.mjs` (§11).

## 8. Kamp Seviyesi ve Kamp XP (kamp büyümesi)

Kamptaki her emek **Kamp XP** verir; XP **Kamp Seviyesi**ni (1–30) yükseltir, her seviyenin önceden yazılı ve görünür bir ödülü
vardır. Formüller şeffaftır (`packages/content/src/kamp-seviye.ts`); para ile XP alınmaz, sahte sayaç yoktur.

- Seviye eğrisi: `campXpNeed(L) = round(30 · L^1,4) + 30` (Sv 1→2: 60 XP, Sv 10→11: 783, Sv 29→30: ~3400). `campXpState(total)`.
- Kaynaklar (`CAMP_XP`): inşaat bitişi `20 + 10 × Sv` (merkez ×1,5; `bina:<id>:<Sv>` ile bir kez), Tedavi Odası rafından malzeme
  başına 3, depo toplama (her 40 jetona 1, en çok 20), bölge anıtı 40 (`anit:<bölge>` bir kez), bir süs türünü ilk kez yerleştirme 5,
  ziyarette tepki bırakma 2 (günde 5 kez) / alma 5 (günde 10 kez), Odyoloji Kütüphanesi okuma köşesi, kamp görevleri.
- **Akustik Kabin** her kaynaktan gelen XP'ye +%3/Sv ekler.
- Eski oyuncular: ilk okumada XP, var olan bina seviyelerinden geriye dönük tohumlanır (`ensureCampXp`); ulaşılmış bölgelerin anıt
  XP'si ve anıt süsü de bir kez verilir (`syncCampRewards`, `camp.state` içinde).

### Dışa açık API (görev sistemi ve diğerleri)

Sunucu (`apps/server/src/camp-xp.ts`), çağıranın işleminde (`app.run`) çalışır; seviye ödüllerini bir kez verir, işlem bitince
`camp.updated` iter (`opts.silent` ile kapatılır):

```ts
grantCampXp(app, pid, amount, reason, ref?, opts?) → { gained, level, levelsUp }
//   amount: taban XP (Akustik Kabin bonusu eklenir); ref (ör. 'gorev:<id>') verilirse aynı ref ikinci kez XP vermez
grantDecoration(app, pid, id, n = 1, ref?, opts?) → eklenen adet
//   id: DECORATIONS kimliği (bilinmeyen → 0); envanterde bir süsten en çok 20; ref verilirse bir kez
campXpOf(app, pid) → CampXpState     campLevelOf(app, pid) → number
```

İçerik (`@odi/content`): `campXpState`, `campXpNeed`, `campXpTotalFor`, `CAMP_XP`, `CAMP_LEVEL_REWARDS`, `campLevelRewards(L)`,
`campTitle(L)`, `DECORATIONS`, `decorById(id)`. Görevlere özel süsler (`from: ['gorev']`): `vaka-panosu`, `dede-banki`; görevler
diğer süsleri de verebilir.

Protokol (yalnız ekleme): `CampState.xp?: { level, total, into, need }`, `CampState.decor?`, `CampState.libAt?`, `CampState.cheers?`.

### Seviye ödülleri (önceden yazılı; `CAMP_LEVEL_REWARDS`)

| Kamp Sv | ödül |
|---|---|
| 1 | unvan **Kamp Çırağı**, Diyapazon Heykeli, Odyogram Çiçek Tarhı |
| 2 | Odyogram Çiçek Tarhı ×2, +2 süs yeri |
| 3 | **arazi: Sessiz Koru** + **bina: Akustik Kabin**, Stereosilya Çimi ×2 |
| 4 | Kemikçik Bankı ×2, +1 yer |
| 5 | unvan **Kulak Kaşifi**, Otoskop Lambası ×2, +2 yer |
| 6 | **arazi: Koklea Koyu** + **bina: Yenidoğan İşitme Tarama Birimi**, Ses Dalgası Çiti ×3 |
| 7 | Dolap: **Sessiz Koru Yeşili**, Kulaklık Salıncağı |
| 8 | Koklea Çeşmesi, +2 yer |
| 9 | **bina: İşitsel Rehabilitasyon Parkı** (Koklea Koyu), Stereosilya Çimi ×2 |
| 10 | unvan **Odyoloji Gönüllüsü**, Kulak Kepçesi Çardağı, +2 yer |
| 11 | İşitme Cihazı Saksısı ×3 |
| 12 | **arazi: Denge Tepesi** + **bina: Vestibüler Laboratuvar**, Yarım Daire Kanalları Heykeli |
| 13 | Dolap: **Koklea Koyu Mavisi**, Tüy Hücresi Lambası ×2 |
| 14 | **çanta**: bir malzemeden en çok 12, Kulak Tıkacı Pufu ×2, +1 yer |
| 15 | unvan **Ses Ustası**, Ses Dalgası Havuzu, +2 yer |
| 16 | **arazi: Araştırma Yerleşkesi** + **bina: Odyoloji Kütüphanesi**, Desibel Sütunları ×2 |
| 17–19 | İmplant Bobini Heykeli; Tonotopi Ağacı ×2; Östaki Kemeri ×2; +3 yer |
| 20 | **arazi: Kulak Kılı Ormanı**, unvan **Koklea Bilgesi**, Işık Üçgeni Feneri ×2, +3 yer |
| 21–23 | Altın Diyapazon; Dolap: **Kamp Rehberi Kostümü**; Koklea Çeşmesi; +3 yer |
| 24 | **çanta**: en çok 15, Yarım Daire Kanalları Heykeli |
| 25 | unvan **Kulak Adası Rehberi**, Altın Kulak Heykeli, +2 yer |
| 26–29 | Kemikçik Bankı ×2; Tüy Hücresi Lambası ×3; Ses Dalgası Çiti ×4; Kulak Kepçesi Çardağı; +3 yer |
| 30 | unvan **Kulak Adası Efsanesi**, Altın Kulak Heykeli, +3 yer |

Çanta yeri (bölüme götürülen en çok 4 malzeme) değişmedi: oyun ekibiyle sözleşme (§4) bölüm başına en çok 4 adet der; Kamp
Seviyesi yalnız envanter sınırını (bir malzemeden en çok 9 → 12 → 15) büyütür.

**Kutlama**: Kamp Seviyesi atlaması oyuncu başına **tam bir kez** kutlanır (`apps/web/src/camp/seviye.ts`, `built.ts` ile aynı ilke:
gelen seviye "görülen" seviyeyle karşılaştırılır; taban oturumun ilk kamp durumu). Büyük "KAMP · Kamp Seviyesi N!" anı, yazılı
ödüller; arazi açıldıysa Tüy Dede o bölgeyi anlatır (`kamp-bolge-<bölge>`), yoksa `kamp-seviye-up`. Sahnede açılan bölge sisten
çıkar (ışık, konfeti, havai fişek, kamera bölgeye kayar). Kamp sekmesinin üstünde rozet + XP çubuğu + unvan; dokununca seviye paneli.

## 9. Arazi: ana ada ve Kamp Seviyesiyle açılan bölgeler

Ana adanın çevresinde beş uydu ada (`packages/content/src/kamp-arazi.ts` `DISTRICTS`; geometri saf, sunucu süs yerleşimini aynı
kuralla doğrular). Kilitli bölge sisli, soluk bir siluettir; üstünde "<ad> · Kamp Sv N" tabelası (dokununca bilgi). Açılınca köprü
kurulur, bölge zemini, kenar ağaçları ve bina arsası görünür.

| bölge | Kamp Sv | bina(lar) | zemin |
|---|---|---|---|
| Sessiz Koru (`koru`) | 3 | Akustik Kabin | çam korusu, sessiz gölet ve basamak taşları |
| Koklea Koyu (`koy`) | 6 | Yenidoğan İşitme Tarama Birimi (Sv 6), İşitsel Rehabilitasyon Parkı (Sv 9) | kumsal, 2,5 tur dönen sarmal lagün |
| Denge Tepesi (`tepe`) | 12 | Vestibüler Laboratuvar | tepe basamakları, birbirine dik üç patika (yarım daire kanalları) |
| Araştırma Yerleşkesi (`yerleske`) | 16 | Odyoloji Kütüphanesi | taş döşeli meydan |
| Kulak Kılı Ormanı (`orman`) | 20 | — (geniş süs alanı) | kıl ağaçları, yaprak örtüsü, orman patikası |

Kamera bütün takımadayı gezer (kilitli bölgeler de görünür ki hedef belli olsun); yakınlaştırma 0,2–1,8.

## 10. Yeni binalar (bölgelerde; etkiler ekonomi / üretim / bilgi / süs — bölüm gücü değil)

| kimlik | ad | Kamp Sv | etki | odyolojik karşılık |
|---|---|---|---|---|
| `kabin` | **Akustik Kabin** | 3 | Kamp XP +%3/Sv | sessiz oda, ortam gürültüsü (ANSI S3.1), maskeleme |
| `tarama` | **Yenidoğan İşitme Tarama Birimi** | 6 | Tedavi Odası hazırlık süresi −%2/Sv (en çok −%40) | OAE / AABR taraması, 1-3-6 hedefi |
| `park` | **İşitsel Rehabilitasyon Parkı** | 9 | +2 süs yeri/Sv, gezen tüy hücresi yardımcıları | Erber basamakları, işitsel eğitim |
| `denge` | **Vestibüler Laboratuvar** | 12 | depo dolma süresi 8 sa + 0,5 sa/Sv | VNG, kalorik test, vHIT, VEMP, BPPV / Epley |
| `kutuphane` | **Odyoloji Kütüphanesi** | 16 | okuma köşesi: saatte Sv × 2 Kamp XP (12 saatte dolar, dokununca toplanır) | kanıta dayalı uygulama, kanıt düzeyleri, PICO |

En yüksek Sv 20. Her birinde `BUILDING_INFO` (sade + Daha fazla + kaynak), iki Kulak Sözlüğü terimi (`ortam-gurultusu`,
`tarama-136`, `aabr`, `isitsel-egitim`, `vng`, `bppv`, `kanit`) ve Tüy Dede'nin üç satırı (`kamp-sv-<bina>-1..3`).
Eski binalar Sv 25'e çıktı; **bina gücü (jeton, kalkan, ilk hasar, savaş yüzdeleri) Sv 15'te tavan yapar** (`CAMP_POWER_LEVEL`;
sunucu `bonusesFor` ve panel metni). Sv 16–25 maliyeti yumuşak doğrusal büyür (en uzun inşaat ~13 sa, Merkez ~18 sa; takım
yardımı ve hızlandırıcılar geçerli, depo/raf/okuma köşesi çevrimdışı birikir).

**Eski istemciler**: `hello.campV` göndermeyen bağlantıya `camp.state` yalnız eski 7 binayı, takım yardım listesi yalnız eski
binaların isteklerini gönderir (`LEGACY_BUILDINGS`); yeni alanlar isteğe bağlıdır. Göç yalnız ekler (`INSERT OR IGNORE`, iki kez açılış testi).

## 11. Her adım büyük: seviye seviye görünüm

- Kademeler: 1–3 Ahşap, 4–6 Taş, 7–9 Tuğla, 10–12 Metal, 13–15 Altın, **16–20 Kristal**, **21–25 Efsane** (kademe değişince büyük
  "Seviye" anı). Kristal: köşelerde her seviye bir kristal sütun daha, zeminde ışık halkası, Sv 20 süzülen kristal. Efsane sade ve
  büyük parçalarla ilerler (az ama iri, birbirini örtmeyen; oyuncak gibi duran gökkuşağı, gezegen, nota yağmuru yok): kristaller
  altına döner (21), süzülen kristalin yerini altın kulak amblemi alır (22), önde iki altın fener (23), amblemde defne çelengi (24),
  amblemde yumuşak ışık (25).
- Sv 2–15 her seviye binanın önüne görünür bir ekleme koyar (saksı, fener, bank, çiçek tarhı, bayrak, çalı, tabela, lamba, heykel,
  flama, fener çifti, çeşme, çiçek kemeri, altın bayrak; `buildings2.ts › garnish`).
- **Odyoloji Merkezi her seviyede kendi büyük parçasını alır** (birikir, o anki kademenin malzemesiyle çizilir):

| Sv | Merkez'e eklenen | Sv | Merkez'e eklenen |
|---|---|---|---|
| 1 | kulak kepçesi çadırı | 14 | gözlem kubbesi |
| 2 | odyogram panosu (kırmızı O, mavi X) | 15 | tüy hücresi ekibi heykelleri |
| 3 | diyapazon kulesi | 16 | kristal dikilitaşlar |
| 4 | taş merkez (kademe) | 17 | süzülen kristal halka (Efsane'de kalkar) |
| 5 | kulak çeşmesi | 18 | iki kuleden göğe ışık sütunları |
| 6 | sol kanat | 19 | kapı kemerinde kristal taç |
| 7 | tuğla kale (kademe) | 20 | dev kristal kule |
| 8 | odyogram kadranlı saat kulesi | 21 | kubbede altın iğne; dikilitaşlar altına döner |
| 9 | flamalı giriş kapısı | 22 | meydanda altın koklea mozaiği |
| 10 | metal merkez (kademe) | 23 | tek büyük altın tüy hücresi heykeli (üç küçük heykelin yerine) |
| 11 | sağ kanat | 24 | yaldız: ışık sütunları ve kristal kule altına döner |
| 12 | ABR çanak anten direği | 25 | iki altın direkli sancak, iğnenin ucunda fener ışığı |
| 13 | altın saray (kademe) | | |

- Denetim: `node tools/harness/kamp-sheet.mjs` her binayı Sv 1..en yüksek yan yana tek PNG'ye çizer
  (`tools/harness/out/kamp-sayfa/<bina>.png`, süsler `susler.png`) ve ardışık seviyeler arası piksel farkını ölçer: Merkez ≥ %3,
  diğerleri ≥ %1 (altında kalırsa çıkış kodu 1).
- Sahnede: Kamp Seviyesi ve Park büyüdükçe gezen "tüy hücresi" yardımcılar çoğalır (1 + Sv/3 + Park/4, en çok 10); durup dinler, nota çıkarır.
- Bellek: her bina seviyesi ayrı bir tuval dokusudur; yükselince önceki seviyenin dokusu bırakılır. Bölge zemini yalnız açılınca
  tam çözünürlükte boyanır (kilitliyken 0,3 ölçekli siluet). Oyun: DPR ≤ 2, `disablePreFX/PostFX`.

## 12. Süslemeler

24 odyoloji temalı süs (`kamp-susler.ts`; çizimler `game-core/camp/decor.ts`): Diyapazon Heykeli, Odyogram Çiçek Tarhı,
Stereosilya Çimi, Kemikçik Bankı, Otoskop Lambası, Ses Dalgası Çiti, Koklea Çeşmesi, Kulaklık Salıncağı, Kulak Kepçesi Çardağı (2×2),
İşitme Cihazı Saksısı, Yarım Daire Kanalları Heykeli, Tüy Hücresi Lambası, Kulak Tıkacı Pufu, Ses Dalgası Havuzu (2×2), Desibel
Sütunları, İmplant Bobini Heykeli, Tonotopi Ağacı, Östaki Kemeri, Işık Üçgeni Feneri, Altın Diyapazon, Altın Kulak Heykeli (2×2),
Heschl Işık Kemeri (2×2) ve görevlere özel Vaka Panosu, Tüy Dede Bankı. Her birinde kısa, doğru bir bilgi (dokununca Tüy Dede kartı).

- Kaynaklar: Kamp Seviyesi ödülleri, bölge anıtları (`MONUMENT_DECOR`, bölgeye ulaşınca bir kez), kamp görevleri (`grantDecoration`).
- Yerleşim: izometrik ızgara (hücre 16 birim; `cellPoint`/`pointCell`), açık arazide, bina arsalarının ve anıtların dışında, başka
  süsle çakışmadan (`cellFree` + kapladığı hücreler). Aynı anda en çok `decorSlots` süs (4 + seviye ödülleri + Park 2/Sv); envanterde
  bir süsten en çok 20. Sunucu her yerleşimi doğrular (`YER`, `DOLU`, `YOK`).
- Süsleme kipi (Kamp → **Süsle**): alt panelde envanter; bir süse dokun → kampta hayaleti belirir (yeşil taban: konabilir, kırmızı:
  konamaz) → sürükle ya da yere dokun → **Yerleştir**. Yerleşik süse dokun → **Taşı / Çevir / Depoya**. 320 px'te çalışır.
  Süsün altında kalan ağaç/çiçekler gizlenir. Bir süs türünü ilk kez yerleştirmek 5 Kamp XP.
- İşlemler: `camp.decor.place {id, gx, gy, flip?}`, `camp.decor.move {uid, gx, gy, flip?}`, `camp.decor.store {uid}`.

## 13. Kamp ziyareti ve alkış

Arkadaşın ya da takım arkadaşının profil kartında **Kampını gez** (Kamp açıksa): salt okunur kamp (binalar, süsler, bölgeler,
anıtlar; inşaat ve toplama düğmeleri yok). Altta dört hazır tepki (serbest yazı yok): "Alkış!", "Kampın çok güzel!", "İlham verdin!",
"Süslemeler harika!" — kişi başına günde bir. Bırakan 2 Kamp XP (günde en çok 5 kez), alan 5 Kamp XP (günde en çok 10 kez) ve
`camp.cheered` bildirimi alır. Gizlilik: yalnız arkadaş ya da aynı takım; engel varsa görünmez (`camp.visit`, `camp.cheer`;
hata `YETKI`, `TEKRAR`). İlk ziyarette Tüy Dede `kamp-ziyaret-01`.

## 14. İnşaat sırası (MK-011, ekonomi önerisi Ö3)

Aynı anda yine tek inşaat yapılır; ek olarak **bir sonraki inşaat sıraya alınabilir**. Amaç: günde bir kez oynayan oyuncunun kampı o
yokken boş beklemesin (ölçüm: `docs/yonetim/ekonomi-olcum.md` §7; günde 1 oturum takımsız taşkın günü 13 → 2).

- **Bedel peşin**: sıraya alırken jeton düşer, sonradan sürpriz maliyet yok. **Sıradan çıkar** bedelin tamamını geri verir.
- **Kendiliğinden başlar**: süren inşaat bitince sunucu sıradakini öncekinin bittiği anda başlatır (`completeDue`; sorgu anında ve
  5 sn'lik zamanlayıcıyla). Oyuncu çevrimdışıyken ya da sunucu kapalıyken iki inşaatın süresi de dolduysa açılışta/ilk sorguda ikisi
  de biter. Başlarken bina seviyesi değişmişse (ör. yönetici ayarı) inşaat başlamaz, bedel geri verilir.
- **Tek sıra yeri**. Süren binanın kendisi sıraya alınamaz (`MESGUL`); sıra doluysa `DOLU`.
- **Kurallar sıraya alırken denetlenir**: en yüksek seviye (`MAKS`), bölgenin Kamp Seviyesi ve Merkez sınırı (`SART`). Merkez sınırı
  süren inşaat bittikten sonraki Merkez seviyesine göre: Merkez 1 → 2 yapılırken Odyometri Sv 2 sıraya alınabilir.
- **Hızlandırıcı, kristal ve takım yardımı yalnız süren inşaata.** Sıradaki inşaat başlayınca normal inşaat olur (yardım isteği
  sıfırdan; "Hızlı İnşaat" teknolojisi başlama anındaki takıma göre). Hızlandırıcının artan süresi sıradakine taşmaz: hızlandırılan
  inşaat en erken "şimdi" biter.
- Kamp Görevleri: "Kampta bir inşaat başlat" sıradaki inşaat **başlayınca** sayılır (sıraya alıp çıkarmak sayılmaz).
- Sahte aciliyet yok: sıra bir hatırlatma ya da geri sayım baskısı göstermez; "Sırada: X" yalnız bilgi.

**Arayüz.** Başka bir bina yapılırken bina panelinde "Kur/Yükselt" yerine **Sıraya al · <jeton> bedel** (altında "X bitince
kendiliğinden başlar; bedel şimdi ödenir, sıradan çıkarırsan tamamı geri gelir"). Sıradaki binanın panelinde "Sırada · Sv N ·
<jeton> ödendi" ve **Sıradan çıkar · <jeton> geri**; süren inşaatın panelinde "Sırada: X Sv N · bu bitince başlar". Liste
görünümünde bina kartlarında "Sıraya al" / "Sıradan çıkar", inşaat kartında sıradaki satırı. Üs görünümünün üst bandında kısa
**Sırada: X** çipi (dokununca sıradaki binanın paneli açılır); 320 px'te sığmazsa alt satıra geçer, kırpılmaz. İkonlar resimli
(`hourglass`, `coin`); emoji yok. Kamp öğreticisi (`camp-build`) değişmedi: öğretici yalnız boştaki inşaatçıyla başlar, o anda sıra
düğmesi görünmez.

**Protokol.** `camp.queue { id }` → `{ camp, wallet, started }` (süren inşaat yoksa hemen başlar, `started: true`),
`camp.unqueue {}` → `{ camp, wallet, refunded }`. `CampState.queued?: { id, toLevel, jeton, at } | null` yalnız `hello.campV ≥ 3`
(`CAMP_V_SIRA`) gönderen istemciye gider; eski istemci alanı görmez, sıradaki inşaat başladığında onu süren inşaat olarak görür
(`camp.upgrade` yine `MESGUL`). Bina listesi süzgeci `CAMP_V_BOLGE = 2` ile değişmedi. Tablo: `camp_queue` (`camp-schema.ts`, yeni
tablo; göç gerekmez). Önizleme: `?demo=kamp&insaat=<bina>&sira=<bina>`.

**Doğrulama.** `apps/server/test/camp-queue.test.ts` (sıraya alma, peşin bedel, tek yer, süren binayla aynı olamaz, Merkez ve
Kamp Seviyesi kuralı, zamanlayıcıyla kendiliğinden başlama ve başlama anı, sunucu kapalıyken iki inşaatın bitmesi, sıradan çıkarınca
tam iade, hızlandırıcı/yardım yalnız süren inşaata, görev sayacı, eski istemci, seviye değişince iade); `node tools/ekonomi/simule.mjs`.
