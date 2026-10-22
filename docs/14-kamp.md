# 14 · Kulak Kampı: odyoloji temalı binalar, Tedavi Odası, açılımlar ve bölge anıtları

Kamp artık süs değil, kulak/odyoloji yolculuğunun bir parçası: her bina gerçek bir odyolojik işlevi temsil eder, seviyeler
oynanışa ve bilgiye dönük şeyler açar, Tedavi Odası bölümlere götürülen koruma/tedavi malzemesi üretir, haritada ulaşılan her
bölge kampa bir anıt getirir. Tasarım dürüst: gizli şans yok, sahte baskı yok; malzemeler öğretmek içindir, tıbbi öneri değildir.

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
