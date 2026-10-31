# Oyuncu testi (LLM kişiler)

On LLM "oyuncu" ajanı, her biri farklı bir kullanıcı tipi olarak (öğrenci, klinik odyolog, rekabetçi oyuncu, hiç oyun
oynamamış biri, az gören, sesi kapalı oynayan, eski telefon, sosyal kaptan, dikkatli harcayan…) **bütün oyunu** oynar: 40 bölüm
ve meta özellikler (Bugün, Kamp, Takım, Profil, Mağaza, bilgi yarışmaları, Kulak Kartları, Ayarlar). Oynadıkça geri bildirim
yazar; geliştiriciler düzelttikçe yeni sürümde oynamaya devam eder. Oyunu bitiren kişinin profili sıfırlanır ve güncel sürümde
baştan başlar.

LLM gerçek zamanlı tepki veremez. Bu yüzden:
- **menüler ve ekranlar** ajanın kendisi tarafından adım adım sürülür (ekran görüntüsü + metin özeti → dokun → yeni ekran);
- **bölümün kendisi** tarayıcıdaki test botuna oynatılır, ama kusursuz değil: kişinin becerisindeki **insan eli modeliyle**
  (`packages/game-core/src/play/human.ts`; tepki gecikmesi, zamanlama sapması, kaçan dokunuş). Düşük becerili kişi gerçekten
  kaybeder ve tekrar dener.

Bütün kişiler **tek bir yerel oyun sunucusunu** paylaşır: birbirini arkadaş ekleyebilir, takım kurabilir, yarışabilir.
Her şey yerelde çalışır; üretim sunucusuna hiç bağlanılmaz.

## Kişiler

Tanımlar: [`tools/harness/oyuncu/kisiler.json`](../../../tools/harness/oyuncu/kisiler.json) (ad, açıklama, cihaz, beceri, ses,
odak alanları, oyun tarzı). Her ajan yalnız kendi girdisini okur.

| Kimlik | Kim | Cihaz | Beceri |
|---|---|---|---|
| `ogrenci-birinci` | Odyoloji 1. sınıf, kısa oturumlar | iPhone 390×844, WebKit | 0,5 |
| `sinav-adayi` | Sınava hazırlanan son sınıf: yarışmalar, Kulak Kartları, Günün Sorusu, vakalar | 390×844 Chromium | 0,6 |
| `uzman-odyolog` | Klinik odyolog: tıbbi doğruluk denetimi | tablet 768×1024 Chromium | 0,4 |
| `rekabetci` | 3 yıldız, lig, yarış, sıralama | 390×844 Chromium | 0,95 |
| `ilk-kez-oyun` | Neredeyse hiç mobil oyun oynamamış | 360×740 Chromium | 0,1 (ilk kez oynayan modeli) |
| `buyuk-yazi` | Az gören: Büyük yazı + hareket azaltma | 390×844 WebKit | 0,4 |
| `sessiz-oyuncu` | İşitme cihazı kullanıcısı, ses kapalı | 390×844 Chromium | 0,5 |
| `eski-telefon` | Eski küçük Android, yavaş ve kopan ağ | 320×640 Chromium, ağ + işlemci yavaşlatılmış | 0,5 |
| `takim-kaptani` | Sosyal: arkadaş, sohbet, takım, kamp, davet | 390×844 Chromium | 0,7 |
| `ekonomi-denetci` | Mağaza, jeton, ödüller, pay-to-win, gizlilik | 390×844 WebKit | 0,5 |

## Bir oturum (ajan için)

1. `node tools/harness/oyuncu.mjs baslat` — her oturumun başında. Kodda yeni commit varsa test derlemesini kurar ve sunucuyu
   yeniden başlatır (veritabanı ve kişilerin ilerlemesi kalır); yoksa hemen döner.
2. Kendi girdini (`kisiler.json`) ve günlüğünü (`kisiler/<kimlik>.md`) oku; `durum --kisi <kimlik>` ile nerede kaldığını gör.
3. `ekran` → ne görüyorsun? Ekran görüntüsüne (yazdırılan PNG yolu) bak. `dokun`, `yaz`, `kaydir`, `geri` ile ilerle.
4. Bölüm açılınca (`BÖLÜM AÇIK ve bekliyor`) `bolum` çalıştır: bölüm senin becerinle oynanır; 3 ara kare + sonuç ekranı gelir.
   Kaybedersen gerçek oyuncu gibi karar ver: tekrar dene, haritaya dön, başka şeyle uğraş.
5. Fark ettiğin her şeyi hemen `geri-bildirim.jsonl`'ye bir satır olarak yaz (aşağıda). Kişiliğinin gözüyle bak.
6. Oturum sonunda günlüğüne bir bölüm ekle (ne yaptın, ilerleme, ruh hâli, yarım kalanlar).
7. `durum` → `"oyunBitti": true` ise (40 bölümün hepsi geçildi) günlüğe "Tur N bitti" yaz ve `sifirla` çalıştır: hesap ve profil
   silinir, bir sonraki oturumda oyunu yeni sürümde ilk kez açıyormuş gibi baştan oynarsın.

## Komutlar

Her çağrı tek komut; durum çağrılar ve günler arasında kalır. `--kisi <kimlik>` her kişi komutunda gerekir.

```
node tools/harness/oyuncu.mjs baslat [--zorla]          derleme (HEAD değiştiyse) + ortak sunucu + önizleme
node tools/harness/oyuncu.mjs kisiler                   kişi listesi (açık oturumlar işaretli)
node tools/harness/oyuncu.mjs yuvalar                   bölüm yuvalarını kim tutuyor
node tools/harness/oyuncu.mjs durdur                    bütün oturumları, sunucuyu ve önizlemeyi kapat

node tools/harness/oyuncu.mjs ekran   --kisi K          görüntü + görünen metin + numaralı dokunulabilir öğeler
node tools/harness/oyuncu.mjs dokun 3 --kisi K          numarayla (son ekrandaki liste)
node tools/harness/oyuncu.mjs dokun "Yola çık" --kisi K görünen metinle (tam → başı → içinde geçen; Türkçe büyük/küçük harf duyarsız)
node tools/harness/oyuncu.mjs dokun @195,420 --kisi K   koordinatla (tuvaldeki şeyler: harita düğümleri, kamp binaları)
node tools/harness/oyuncu.mjs yaz "Merhaba" [--enter] --kisi K   odaktaki (yoksa ilk görünen) yazı alanına
node tools/harness/oyuncu.mjs kaydir asagi|yukari --kisi K       sayfa ya da harita
node tools/harness/oyuncu.mjs surukle 200,600 200,200 --kisi K   sürükle (harita, kamp)
node tools/harness/oyuncu.mjs geri --kisi K             görünür Geri/Kapat düğmesi, yoksa Escape
node tools/harness/oyuncu.mjs bekle 30 --kisi K         bekle (en çok 300 sn), sonra ekran (inşaat, sandık, sunucu olayı)
node tools/harness/oyuncu.mjs yenile --kisi K           sayfayı yenile (uygulamayı kapatıp açmak gibi)
node tools/harness/oyuncu.mjs ag kapat|ac --kisi K      bağlantıyı kes / geri getir (uçak modu gibi)
node tools/harness/oyuncu.mjs bolum [--zaman 600] --kisi K   açık bölümü oynat; sonuç + kareler
node tools/harness/oyuncu.mjs durum --kisi K            ilerleme JSON
node tools/harness/oyuncu.mjs sifirla [--evet] --kisi K hesabı ve profili sil, yeni tur (oyun bitmediyse --evet gerekir)
node tools/harness/oyuncu.mjs kapat --kisi K            oturumu kapat (ilerleme kalır; zaten 20 dk boşta kendiliğinden kapanır)
```

Eylem komutları (dokun, yaz, kaydir, surukle, geri, bekle, yenile, ag) eylemden sonra yeni ekranı yazar; ayrıca `ekran`
çağırmaya gerek yok.

**Çıktı örneği (`ekran`):**
```
[ogrenci-birinci] 390×844 webkit · sürüm 01ec5518 · görüntü: tools/harness/out/oyuncular/ogrenci-birinci/ekran/0017-sonuc.png
--- metin ---
# Harika!
77
jeton / 98
…
--- dokunulabilir ---
1. düğme "Sonraki"
2. düğme "Tekrar"
3. düğme "Meydan oku: Bölüm 8'de açılır" (devre dışı)
4. düğme "Harita"
```
- `#` başlık, `[pencere: …]` açık iletişim kutusu, `! …` komutun notu (ne yapıldı, yeni sürüm yüklendi, bekleme…),
  `⚠ … hata` uygulamanın konsol/sayfa hataları (bunlar genellikle **hata** geri bildirimidir), `BÖLÜM AÇIK` bölüm başladı ve
  `bolum` bekliyor.
- Metin yalnız ekranda görünen kısımdır (açık pencerenin arkası yazılmaz). Ayrıntı için ekran görüntüsünü oku: özet bir yardımcıdır,
  oyuncunun gördüğü şey görüntüdür (renk, kontrast, taşma, kesilen yazı yalnız görüntüde görülür).
- Tuval (harita, kamp, bölüm) içindekiler listede yoktur; görüntüye bakıp `dokun @x,y` kullan (koordinatlar CSS pikseli, görüntüyle aynı).

**Süreler:** `ekran` ~1 sn, eylemler 2-5 sn (ekran durulana kadar bekler), oturumun ilk komutu 5-15 sn (tarayıcı açılır),
`bolum` gerçek sürede bölüm süresinin ~yarısı (bot ×2 hızla oynar; 30-120 sn) + boş yuva beklemesi. **`bolum`'u Bash zaman
sınırı 600000 ms ile çağır.** Komut zaman aşımıyla koparsa bölüm yine biter; bir sonraki `bolum` o sonucu yazar.

**`durum`** (JSON): `oyunBitti`, `gecilenBolum` ("12/40"), `siradakiBolum`, `yildizlar` ("1:3 2:2 …"), `ucYildiz`, `jetonCihaz`,
`xp`, `oyuncuSeviyesi`, `seri`, `ayarlar`, `sunucu` (takma ad, **arkadaş kodu**, jeton, kristal, takım, lig), `acikYerler`,
`kilitliYerler` ("Takım (5)": 5 bölüm geçilince açılır), `denemeler` (bu turda deneme/kayıp, en çok takılınan bölümler), `tur`.

## Beceri modeli

`bolum` sırasında bölümü oyunun kendi test botu oynar; kişinin `beceri` değeri (0 hiç oynamamış … 1 kusursuz) ona "el" verir:
- **0,99 ve üstü:** kusursuz planlayıcı (bot.mjs ile aynı).
- **0,25–0,99:** oyuncu kitlesi modeli `playerAt((0,95 − beceri) / 0,55)`: 0,95 usta ucu (tepki 200 ms, sapma σ 60 ms), 0,4 ve altı
  acemi ucu (260 ms, σ 100 ms, %3 kaçan dokunuş, %10 geç kalma). İleri bakış 1,2–1,4 sn (boss arenasında 0,6 sn).
- **0,25 altı:** ilk kez oynayan modeli `firstTimerOf(k)` (tepki 320–450 ms, σ 120–160 ms, %4–6 kaçan dokunuş, kazara kaydırma).

Her deneme başka bir "el"dir (yeni tohum): aynı bölümü tekrar oynamak sonucu değiştirebilir. Öğretici anlarda oyun yavaşlar
ve el de buna göre zaman bulur (`LevelScene` → `botHand.slow`). Ölçülen zorluk: [`docs/12-zorluk-egrisi.md`](../../12-zorluk-egrisi.md).

**Teknik:** test derlemesinde (`VITE_ODI_E2E=1`) `?oyun-bot=1&oyun-beceri=<0..1>[&oyun-tohum=N]` (`apps/web/src/App.tsx`) → modül
`apps/web/src/e2e/oyuncu-eli.ts` `import()` ile yüklenir → `LevelOptions.botHand` (`packages/game-core/src/bridge.ts`) → planlayıcı
`human.ts` `humanHand` tercihleriyle kurulur. `oyun-beceri` yoksa bot eskisi gibi kusursuzdur (bot.mjs ve bütün e2e takımları
değişmez). Üretim derlemesinde ne parametre ne modül vardır:
```
(cd apps/web && npx vite build --outDir /tmp/odi-uretim --emptyOutDir) && grep -rlE "oyun-beceri|__odiEl|oyuncu-eli" /tmp/odi-uretim || echo "üretimde yok"
```

## Geri bildirim biçimi

Tek dosya, **her madde bir satır** (JSON Lines): [`geri-bildirim.jsonl`](geri-bildirim.jsonl). Satır ekle, var olan satırı
değiştirme (yalnız proje yöneticisi `durum`u değiştirir). Yazmadan önce dosyada aynı sorunu ara: varsa yenisini yazma; yeni
kanıtı/sürümü günlüğüne not et.

```json
{"id":"OT-uzman-odyolog-7","kisi":"uzman-odyolog","tarih":"2026-11-02","surum":"01ec5518","ekran":"Kulak Kartları › Timpanogram","tur":"tibbi-dogruluk","onem":3,"baslik":"Timpanogram tek başına tanı koyduruyor","ayrinti":"Kart 'B tipi = orta kulak iltihabı' diyor. Doğrusu: B tipi düz eğri; efüzyon, perforasyon ya da buşon olabilir, tanı otoskopi ve diğer bulgularla konur. Önerilen metin: …","kanit":"tools/harness/out/oyuncular/uzman-odyolog/ekran/0142-dokun.png","durum":"yeni"}
```

| Alan | Değer |
|---|---|
| `id` | `OT-<kisi>-<n>`; `n` o kişinin bir sonraki numarası (dosyadaki en büyük + 1), hiç tekrar kullanılmaz (sıfırlamadan sonra da) |
| `kisi` | kişi kimliği |
| `tarih` | `YYYY-AA-GG` |
| `surum` | ekran başlığındaki sürüm (8 karakter commit) |
| `ekran` | nerede: "Harita", "Sonuç (Bölüm 7)", "Kamp › Tedavi Odası", "Ayarlar" … |
| `tur` | `hata` (bozuk/yanlış çalışan), `oneri` (iyileştirme), `kafa-karisikligi` (anlaşılmadı), `erisilebilirlik`, `tibbi-dogruluk`, `denge` (zorluk, ödül, ekonomi), `metin` (yazım, ton, çeviri), `performans` (yavaşlık, takılma) |
| `onem` | 1 küçük · 2 orta (oyuncuyu rahatsız eder) · 3 büyük (ilerleyemez, yanlış bilgi, para/güven sorunu) |
| `baslik` | tek satır, ne olduğu |
| `ayrinti` | ne yaptın, ne bekledin, ne oldu; nasıl tekrarlanır; öneri varsa öneri. Kişiliğinin sesiyle ama somut |
| `kanit` | isteğe bağlı: ekran görüntüsü yolu (depo köküne göre; `tools/harness/out/` git'e girmez, kanıt yalnız bu makinede durur) |
| `durum` | ajan her zaman `"yeni"` yazar. Proje yöneticisi sonra: `"is-listesi:YN-042"` (iş açıldı), `"reddedildi: <neden>"`, `"kopya: OT-…"` |

Ekleme (tek satır, dosya sonuna): `echo '<json>' >> docs/yonetim/oyuncu-testi/geri-bildirim.jsonl` — JSON'u tek satırda, geçerli
olarak yaz (tırnakları kaçır). Dosyayı aynı anda başka kişiler de yazar: yalnız ekle (`>>`), dosyayı yeniden yazma.

## Günlük

Her kişinin günlüğü: `kisiler/<kimlik>.md`. Oturum başına bir bölüm (en yenisi en altta):

```markdown
## Oturum 4 · 2026-11-02 · sürüm 01ec5518 · tur 1
- Başlangıç: 11/40, seri 3 gün. Bitiş: 14/40.
- Ne yaptım: 12-14 (13'te 3 kayıp), Kamp'ta Tedavi Odası, ilk takım yarışı.
- Hissettiğim: …
- Yazdığım geri bildirimler: OT-…-12, OT-…-13
- Yarım kalan / sonraki oturum: …
- Sosyal (varsa): arkadaş kodum ABC123; takımım "…" (kod …); arkadaşlarım …
```
Başa bir kez kişinin özeti ve ilerleme tablosu (tur, bitirme tarihi) konur. Diğer kişiler arkadaş kodunu ve takım kodunu
günlüklerden bulur.

## Altyapı (geliştirici)

- `tools/harness/oyuncu.mjs` CLI; `tools/harness/oyuncu/` yardımcılar: `altyapi.mjs` (derleme, sunucu, önizleme), `daemon.mjs`
  (kişi oturumu), `sayfa.mjs` (sayfa içi özet), `ortak.mjs` (yollar, yuva kilidi), `kisiler.json`.
- Çıktılar `tools/harness/out/oyuncular/` (git'e girmez): `dist/` test derlemesi, `sunucu/server.mjs`, `sunucu.sqlite` (kalıcı ortak
  veritabanı), `durum.json` (sürüm, portlar, pid'ler), `<kisi>/profil` (kalıcı tarayıcı profili: localStorage, IndexedDB, hesap
  anahtarı), `<kisi>/ekran/NNNN-*.png`, `<kisi>/kayit.jsonl` (komut ve bölüm sonuçları), `<kisi>/daemon.log`, `<kisi>/tur.json`.
- **Sabit portlar** 4791 (önizleme) ve 4792 (sunucu): kayıtlar kökene (port dahil) bağlı; port değişirse kişiler ilerlemesini
  kaybeder. Gerekirse `ODI_OYUNCU_ONIZLEME_PORT` / `ODI_OYUNCU_SUNUCU_PORT`.
- **Kişi oturumu (daemon):** ilk komutta kendiliğinden açılır (`launchPersistentContext`, `nice -n 10`), sayfayı açık tutar, komutları
  sırayla yürütür, 20 dk boşta kalınca kapanır (`ODI_OYUNCU_BOSTA_DK`). Komutlar arasında sayfanın `requestAnimationFrame`'i durdurulur
  (Phaser harita/kamp/bölüm döngüleri işlemci yemez); WebSocket ve zamanlayıcılar sürer (kişi çevrimiçi görünür).
- **Yuva kilidi:** bölüm oynatma ve derleme `flock` ile 3 yuvadan birini tutar (`ODI_OYUNCU_SLOT`); fazlası sırada bekler (`yuvalar`).
  Bölüm ekranı açılınca, `bolum` izin verene kadar donar: bölüm hiçbir zaman yuva dışında koşmaz. 4 çekirdek / 15 GB'ta 10 açık oturum
  + 3 bölüm aynı anda sığar (oturum başına ~300-500 MB).
- **Yeni sürüm:** `baslat` HEAD'i derler (`dist.yeni` → değiş tokuş), sunucuyu yeniden başlatır (göçler çalışır); açık oturumlar bir
  sonraki komutta sayfayı yeniler ve `! yeni sürüm yüklendi` yazar. Service worker kapalıdır (eski kabuk önbellekten gelmesin).
- **Sunucu:** `ODI_TEST_STORE=1` (web TEST mağazası; para çekmez), `ODI_LOG=0`, yönetici kodu her açılışta rastgele bir kodun özeti
  (kimse bilmez; depodaki varsayılan kullanılmaz). Baskın penceresi, serbest yazı eşiği vb. gerçek ayarlarda.
- **Bot kipinin gerçek oyundan farkları:** bölüm içi Şanslı Nota çıkmaz; Revir bonusu (ilk hasarı yok sayma) uygulanmaz; bölüm içi ses
  kapalıdır (başsız tarayıcı zaten duymaz — sesle ilgili geri bildirim metin/görsel karşılık üzerinden verilir); kişinin dokunuşları
  yerine el modeli oynar (dokunma hassasiyeti, kaydırma algısı gibi şeyler ölçülmez). Canlı yarışta yarış başlayınca hemen `bolum`.
- **Geliştirici komutları** (oyuncu ajanları kullanmaz): `gelistirici-ac <n> --kisi K` 1..n−1 bölümleri geçilmiş sayar ve rehberi kapatır
  (duman testi); `ODI_OYUNCU_KISILER=<dosya>` başka bir kişi dosyası (harness'in kendi testleri için); `ODI_OYUNCU_HIZ` bot hızı
  (varsayılan 2; sonucu değiştirmez, el modeli oyun saatiyle çalışır).
- Temizlik: `node tools/harness/oyuncu.mjs durdur`; ekran görüntüleri birikir (`tools/harness/out/oyuncular/*/ekran`), geri bildirimler
  işlendikten sonra silinebilir.
