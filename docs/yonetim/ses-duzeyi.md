# Ses düzeyi ölçümü (MK-018)

> Anlatıcı (Tüy Dede), müzik ve efektler birbirine göre dengeli mi? Anlatıcı müziğin altında kalıyor mu, patlayan efekt var mı?
> Ölçüm: 2026-10-25, `node tools/voice/duzey.mjs --oyun` (ffmpeg 6.1.1 `ebur128=peak=true`, ITU-R BS.1770 / EBU R128).
> Onaylı ses dosyalarına dokunulmadı; oyun kodunda değişiklik yapılmadı (aşağıdaki ölçütlerle düzeltme gerektiren durum çıkmadı).

## Nasıl ölçüldü

| Katman | Yöntem |
|---|---|
| Anlatıcı dosyaları | `apps/web/public/voice/*.mp3` (208 satır, mono 24 kHz MP3) doğrudan ffmpeg ile: bütünleşik yükseklik **I** (LUFS), gerçek tepe **TP** (dBTP), en yüksek anlık yükseklik **M** (400 ms). |
| Oyunda duyulan | Müzik ve efektler çalışma anında sentezleniyor (varlık dosyası yok). Oyunun **kendi motoru** (`packages/audio` `Engine`) Playwright Chromium'da `OfflineAudioContext` ile çalıştırıldı; çıktı 32 bit WAV olarak ffmpeg'e ölçtürüldü. Böylece oyuncunun duyduğu zincir ölçüldü: kaynak → anlatıcı / müzik (+ kısma) / efekt veriyolu → kompresör (eşik −14 dB, oran 6, Chromium'un otomatik telafi kazancı dahil) → ana kazanç 0,9. Hesapla tahmin değil, gerçek işleme. |
| Varsayılan ayarlar | `apps/web/src/store.ts`: müzik **0,6**, efekt **0,9**. Anlatıcı kazancı = efekt düzeyi (`apps/web/src/ftue/voice.ts`: `audio.voice(buf, sfxVol)`, 0,2–1 arası) → varsayılanda **0,9**. Efektler `vol: 1` ile (çağrı yerlerinin çoğu; bazıları 0,6–0,9 ile daha kısık çalar). |
| Müzik | Her parçanın tam döngüsü (8–16 ölçü, 9–38 sn); bir kez normal, bir kez anlatıcı konuşurken olduğu gibi kısık (duck 0,3). |
| Karışım | 5 tipik satır, müziğin üstünde aynı motorda birlikte işlendi (ortak kompresör, gerçek kısma). |

Notlar: mono dosya ffmpeg'de tek kanal ölçülür; oyunda iki kanala kopyalandığı için stereo ölçümde +3 LU artar. Karşılaştırmalar bu yüzden "oyunda duyulan" sütunlarıyla yapıldı. 400 ms'den kısa efektlerde bütünleşik değer anlamsızdır; efektler için **M en yüksek** (en yüksek 400 ms'lik pencere) kullanıldı. 3 sn'den kısa satırlarda LRA güvenilmez (0 ya da 20 çıkar), tabloya alınmadı.

Yeniden üretmek: `PLAYWRIGHT_CHROMIUM=… node tools/voice/duzey.mjs --oyun` (~6 dk; `--muzik 1 --efekt 0.2` gibi başka kaydırıcı ayarları; `--sakla` işlenen WAV'ları dinlemek için bırakır). Yalnız dosyalar: `node tools/voice/duzey.mjs` (~15 sn). JSON: `tools/harness/out/duzey/duzey.json`.

## 1. Anlatıcı satırlarının dağılımı

| | Dosya I (LUFS, mono) | Oyunda I (LUFS, stereo, varsayılan) | Dosya TP (dBTP) | Oyunda TP (dBTP) |
|---|---|---|---|---|
| en düşük | −24,0 | −19,0 | −2,2 | −3,9 |
| %10 | −17,1 | −14,2 | −1,8 | −3,6 |
| **ortanca** | **−16,7** | **−13,7** | −1,6 | −3,3 |
| ortalama | −16,9 | −13,8 | −1,5 | −3,3 |
| %90 | −16,5 | −13,3 | −1,2 | −3,1 |
| en yüksek | −16,2 | −12,8 | **+0,4** | −2,8 |
| standart sapma | 0,9 | 0,7 | 0,3 | 0,2 |

Dağılım (dosya I, 1 LU'luk dilimler): −17…−16: **186** satır · −18…−17: 8 · −19…−18: 6 · −20…−19: 1 · −21…−20: 4 · −22…−21: 2 · −24…−23: 1.

Süreye göre: 4 sn'den uzun 168 satır ortanca −16,7 (−17,7…−16,3); 3–4 sn 25 satır ortanca −16,6; **3 sn ve kısa 15 satır ortanca −19,8 (−24,0…−16,2)**.

- Üretim hedefi −16 LUFS idi; dosyaların ortancası −16,7 (sondaki `alimiter=0.8` ve MP3 kodlaması ~0,7 dB alıyor) — tutarlı ve sorun değil.
- **Kısa satırlar sistematik olarak kısık.** Neden (büyük olasılıkla): `generate.mjs`'teki iki geçişli `loudnorm` bu satırlarda doğrusal kazancı tepe sınırını (−1,5 dBTP) aşmadan uygulayamıyor, dinamik kipe düşüyor; dinamik kip 3 sn'lik pencereyle çalıştığından 3 sn'den kısa kliplerde neredeyse hiç kazanç vermiyor. Bu satırların tepe/yükseklik oranı yüksek (I −24, TP −1,9).
- 13 dosyanın gerçek tepesi −1 dBTP'nin üstünde (en yüksek `sozluk-01` +0,4 dBTP, MP3 kodlama aşımı). Oyunda kazanç 0,9 ve kompresörden sonra en yüksek −2,8 dBTP: duyulur bozulma yok.
- Oyun zinciri dağılımı daraltıyor (kompresör): dosyada 7,8 LU olan açıklık oyunda 6,2 LU. Yine de en kısık satır ortancanın 5,3 LU altında: duyulur fark.

### En yüksek 10 satır (dosya I)

| Satır | Süre | Dosya I | Dosya TP | Oyunda I | Oyunda TP |
|---|---|---|---|---|---|
| kamp-insa-02-depo | 3,0 sn | −16,2 | −1,3 | −14,0 | −3,1 |
| kamp-insa-04 | 4,3 sn | −16,3 | −1,5 | −13,0 | −3,3 |
| kamp-ziyaret-01 | 6,5 sn | −16,3 | −1,5 | −13,3 | −3,3 |
| not-yon | 3,3 sn | −16,3 | −1,7 | −13,1 | −3,5 |
| pat-otoskleroz | 6,3 sn | −16,3 | −1,6 | −13,4 | −3,5 |
| etkinlik-02 | 3,1 sn | −16,4 | −1,8 | −13,4 | −3,3 |
| hikaye-04 | 4,3 sn | −16,4 | −1,5 | −13,3 | −3,3 |
| ipucu-ogret-yuz | 3,1 sn | −16,4 | −1,2 | −13,5 | −3,3 |
| kamp-sv-depo-2 | 6,3 sn | −16,4 | −0,8 | −13,9 | −3,1 |
| kamp-sv-kabin-2 | 6,0 sn | −16,4 | −1,6 | −13,4 | −3,1 |

En yüksek satır ile ortanca arasında yalnız 0,5 LU fark var: "bağıran" satır yok.

### En kısık 10 satır (dosya I)

| Satır | Süre | Dosya I | Dosya TP | Oyunda I | Ortancadan fark (oyunda) |
|---|---|---|---|---|---|
| ipucu-tazele-kayma | 2,9 sn | **−24,0** | −1,9 | **−19,0** | **−5,3 LU** |
| ipucu-perde-kay | 2,9 sn | −21,8 | −2,2 | −16,8 | −3,1 LU |
| ipucu-ogret-cevir | 2,5 sn | −21,3 | −1,9 | −16,9 | −3,2 LU |
| harita-04 | 2,6 sn | −20,4 | −2,2 | −15,8 | −2,1 LU |
| sekme-kamp | 1,9 sn | −20,3 | −2,0 | −15,8 | −2,1 LU |
| kg-h7-son | 2,4 sn | −20,2 | −2,2 | −16,1 | −2,4 LU |
| harita-02 | 2,9 sn | −20,1 | −1,8 | −15,4 | −1,7 LU |
| ipucu-ogret-trambolin | 2,7 sn | −19,8 | −2,0 | −15,8 | −2,1 LU |
| bugun-03 | 2,9 sn | −19,0 | −2,0 | −15,1 | −1,4 LU |
| sekme-takim | 2,1 sn | −18,7 | −1,9 | −14,5 | −0,8 LU |

Oyunda ortancanın 1 LU'dan fazla altında kalan satırlar: yukarıdaki ilk 9 + `kg-vaka-ilk` (−14,8; 6,4 sn) = **10 satır**.

## 2. Anlatıcı, müzik ve efektler (varsayılan ayarlar: müzik 0,6, efekt 0,9)

### Müzik

| Parça | I (normal) | I (anlatıcı konuşurken, kısık 0,3) | Anlatıcı ortancası − müzik (normal) | Anlatıcı ortancası − müzik (kısık) | TP |
|---|---|---|---|---|---|
| harita | −21,5 | −31,8 | 7,8 LU | 18,1 LU | −5,9 |
| menu | **−26,6** | −37,0 | 12,9 LU | 23,3 LU | −12,6 |
| biyom:dis-kulak | −24,0 | −34,4 | 10,3 LU | 20,7 LU | −5,9 |
| biyom:kanal | **−20,8** | −31,1 | 7,1 LU | 17,4 LU | −7,2 |
| biyom:zar | −23,0 | −33,4 | 9,3 LU | 19,7 LU | −5,9 |
| biyom:kemikcikler | −24,1 | −34,4 | 10,4 LU | 20,7 LU | −9,0 |
| biyom:koklea-1 | −23,1 | −33,3 | 9,4 LU | 19,6 LU | −12,9 |
| biyom:koklea-2 | −22,3 | −32,5 | 8,6 LU | 18,8 LU | −8,9 |
| biyom:koklea-3 | −22,4 | −32,8 | 8,7 LU | 19,1 LU | −11,4 |
| biyom:sinir | −26,0 | −36,4 | 12,3 LU | 22,7 LU | −11,4 |
| biyom:beyin-sapi | −24,1 | −34,4 | 10,4 LU | 20,7 LU | −3,2 |
| biyom:korteks | −22,9 | −33,0 | 9,2 LU | 19,3 LU | −13,2 |
| boss | −24,1 | −34,5 | 10,4 LU | 20,8 LU | −8,7 |
| zafer (tek seferlik) | −21,6 | −31,9 | 8,1 LU | 18,2 LU | −6,0 |
| **ortanca** | **−23,0** | **−33,3** | **9,3 LU** | **19,6 LU** | |

### Efektler (tek başına, `vol: 1`; anlatıcının oyundaki ortancası −13,7 LUFS'a göre)

| Efekt | M en yüksek (LUFS) | Anlatıcıya göre | TP (dBTP) |
|---|---|---|---|
| star3 | −12,7 | **+1,0 LU** | −4,8 |
| levelUp | −14,0 | −0,3 LU | −4,7 |
| biomeAwaken | −14,4 | −0,7 LU | −6,3 |
| fanfare | −14,6 | −0,9 LU | −3,7 |
| star2 | −14,9 | −1,2 LU | −5,4 |
| coinBurst | −15,0 | −1,3 LU | −8,2 |
| chestOpen | −15,3 | −1,6 LU | −6,2 |
| restore | −15,7 | −2,0 LU | −8,9 |
| win | −15,9 | −2,2 LU | −6,1 |
| questDone | −16,5 | −2,8 LU | −7,4 |
| … (orta grup: unlock, star1, countdownGo, newRecord, perfect, xpFill, gameOver, flagPlant, streak, chestShake, coin, notify) | −17,0 … −23,1 | −3,3 … −9,4 LU | −6,2 … −15,4 |
| … (oyun içi: whoosh, power, error, pathDraw, itemReveal, countdown, combo, nodePop, hit, bounce, jump, doubleJump) | −23,8 … −31,6 | −10 … −18 LU | −12,9 … −22,3 |
| tab, pop, back, land, odiStep, toggle, tap, countTick, tick | −34,1 … −47,5 | −20 … −34 LU | −19,4 … −31,4 |

43 efektin hiçbiri anlatıcıdan 1 LU'dan fazla yüksek değil (en yüksek star3, anlık en yüksek değerde +1,0 LU; anlatıcının kendi anlık en yüksek ortancası −10,8 LUFS, yani star3 konuşmanın tepelerinin altında). Kırpılma yok; en yüksek efekt tepesi −3,7 dBTP.

### Karışım (anlatıcı + müzik aynı anda, gerçek kısma ve ortak kompresör)

| Satır + parça | Karışım I | Ayrı ölçümlerin güç toplamı | TP |
|---|---|---|---|
| akis-01 + harita | −13,6 | −13,4 | −3,2 |
| kamp-sira-01 + menu | −13,5 | −13,4 | −3,0 |
| pat-otitis-eksterna + biyom:dis-kulak | −13,9 | −13,6 | −3,5 |
| pat-otoskleroz + biyom:kemikcikler | −13,4 | −13,4 | −3,5 |
| akis-02 + boss | −14,0 | −13,9 | −3,1 |

Karışım, ayrı ölçümlerin toplamından en çok 0,3 LU sapıyor: ortak kompresör konuşma sırasında müziği "pompalamıyor", kısma tek başına belirleyici.

### Kaydırıcıların uç ayarları (aynı yöntemle)

| Ayar | Anlatıcı ortancası | Müzik ortancası (normal / kısık) | Anlatıcı − kısık müzik |
|---|---|---|---|
| varsayılan (müzik 0,6, efekt 0,9) | −13,7 | −23,0 / −33,3 | 17,4 … 23,3 LU |
| müzik 1, efekt 0,9 | −13,7 | −18,8 / −29,0 | 13,1 … 18,9 LU |
| müzik 1, efekt 0,2 (en kötü durum) | −23,4 | −18,8 / −29,0 | **3,4 … 9,2 LU** |

## 3. Bulgular

1. **Anlatıcı müziğin altında kalmıyor.** Varsayılanda anlatıcı, kısılmamış müziğin bile 7–13 LU üstünde; konuşurken müzik 0,3'e kısıldığı için fark 17–23 LU. Oyun konuşmasında yaygın hedef müziğin 10–15 LU üstü; buradaki kısma bunun da ötesinde (konuşma sırasında müzik −31…−37 LUFS, neredeyse duyulmuyor).
2. **Patlayan efekt yok.** En yüksek efekt (star3) anlatıcıdan yalnız +1 LU (anlık en yüksek değerde); ~6 LU eşiğinin çok altında. Ödül efektleri (star, levelUp, fanfare, biomeAwaken) anlatıcıyla aynı düzeyde, arayüz tıkları (tap, tick, toggle) 30 LU altında — kasıtlı olarak çok hafif.
3. **Anlatıcı satırları kendi içinde tutarlı, 10 kısa satır dışında.** 198 satır ortancanın ±1 LU'su içinde. 3 sn'den kısa satırlar dosyada 2–8 LU kısık; oyunda (kompresör farkı yarıya yakın kapatıyor) en kötüsü `ipucu-tazele-kayma` 5,3 LU, `ipucu-perde-kay` ve `ipucu-ogret-cevir` ~3 LU kısık. Bu satırların çoğu bölüm içi ipuçları ve sekme tanıtımları: müzik çalarken söyleniyorlar ama kısık müziğin yine ≥ 12 LU üstündeler, yani **anlaşılır**; yalnız komşu satırlara göre belirgin biçimde daha kısık.
4. **Anlatıcı sesi efekt kaydırıcısına bağlı.** `speakLine` kazancı `sfxVol`'dan alıyor (0,2'nin altına inmez). Ayarlar ekranı "Müzik ve efektler ayrı ayarlanır" diyor, anlatıcıdan söz etmiyor. Tıkları kısmak için efekti 0,2'ye çeken ve müziği sonuna kadar açan oyuncuda anlatıcı kısık müziğin yalnız 3–9 LU üstünde kalıyor (en kötü: biyom:kanal 3,4 LU) — hâlâ maskelenmiyor ama sınıra yakın.
5. **Kısma (duck) çakışmaları (kod incelemesi).** `Engine.duck()` tek bir paylaşılan düzey tutuyor, sahip/sayaç yok:
   - Anlatıcı konuşurken `AUTO_DUCK` efekti (fanfare 2,4 sn, levelUp 1,6 sn, biomeAwaken 3 sn …) gelirse, efektin süresi dolunca müzik **konuşma bitmeden** tam düzeye döner. Bu durumda bile anlatıcı müziğin 7–13 LU üstünde (bulgu 1), yani maskeleme yok; ama cümlenin ortasında müzik belirgin biçimde yükselir.
   - Satır bitince `voice()` `duck(0, 1)` çağırıyor: duraklatma menüsünün kısması (0,25, `LevelHost`) ya da süren bir kutlama kısması (`CelebrationLayer`, 3–6 sn) erken kalkıyor.
6. **Müzik parçaları arasında 5,8 LU fark var.** `menu` (−26,6) ve `biyom:sinir` (−26,0) en kısık; `biyom:kanal` (−20,8) ve `harita` (−21,5) en yüksek. Parçalar arası geçişte (harita → bölüm) düzey sıçraması duyulabilir. Anlatıcı dengesini etkilemiyor.
7. Platform notu: ölçüm Chromium'un `DynamicsCompressorNode`'u ile yapıldı (Android WebView ile aynı). iOS WebKit'in kompresörü aynı kökten gelir ama birebir aynı değildir; iOS'ta ±1 dB oynama beklenebilir.

## 4. Öneriler (hiçbiri bu işte uygulanmadı)

Bu işin değişiklik ölçütleri (anlatıcının müzikle maskelenmesi ya da bir efektin anlatıcıdan ~6 LU yüksek olması) varsayılan ayarlarda gerçekleşmediği için kodda düzey değiştirilmedi. Sahibin kararına:

1. **Kısa satırlar (öncelikli, P2).** İki yol:
   - **a) Dosyaları yeniden düzeylemek (önerilen, sahip onayı gerekir).** Ses ve metin aynı kalır, yalnız kazanç: `generate.mjs`'te kısa kliplerde `loudnorm` yerine ölçülen I'ya göre doğrusal kazanç + mevcut `alimiter` (ya da klibi ölçüm için 3 sn'nin üstüne sessizlikle uzatıp sonra kırpmak). Etkilenen 15 satır (dosya I < −17,5 LUFS): yukarıdaki "en kısık 10" + `sekme-bugun` (−18,6), `kamp-insa-02`, `sekme-harita`, `sekme-profil` (−18,5) ve `kg-vaka-ilk` (−17,7; tek uzun satır). 14'ü 3 sn'den kısa. Onaylı dosyalar değiştiği için bu işte yapılmadı.
   - **b) Oynatma kazancı tablosu (dosyaya dokunmadan).** `speakLine` içinde satır kimliğine göre çarpan. Ölçüm aracı bunu sınadı (`--oyun` çıktısında "öneri sınaması"): kompresör kazancın yaklaşık yarısını geri aldığı ve `voice()` kazancı 1,5'te kestiği için tek geçişte açık ancak yarı yarıya kapanıyor:

     | Satır | Önce | Çarpan | Sonra | TP sonra |
     |---|---|---|---|---|
     | ipucu-tazele-kayma | −19,0 | ×1,67 (+4,4 dB, sınırda) | −16,2 | −1,1 |
     | ipucu-ogret-cevir | −16,9 | ×1,45 (+3,2 dB) | −15,6 | −2,5 |
     | ipucu-perde-kay | −16,8 | ×1,43 (+3,1 dB) | −15,2 | −3,0 |
     | kg-h7-son | −16,1 | ×1,32 (+2,4 dB) | −14,9 | −2,8 |
     | harita-04, ipucu-ogret-trambolin, sekme-kamp | −15,8 | ×1,27 (+2,1 dB) | −14,5…−14,7 | −3,3…−3,4 |
     | harita-02 | −15,4 | ×1,22 (+1,7 dB) | −14,4 | −3,2 |
     | bugun-03 | −15,1 | ×1,17 (+1,4 dB) | −14,4 | −3,3 |
     | kg-vaka-ilk | −14,8 | ×1,14 (+1,1 dB) | −14,4 | −3,1 |

     Tam eşitlik için çarpanların yaklaşık iki katı (dB olarak) gerekir; `ipucu-tazele-kayma` yine de 1,5 sınırına takılır. Bu yüzden (a) daha temiz; (b) yalnız dosya değişikliği onaylanmazsa.
2. **Anlatıcı için ayrı düzey ya da açıklama.** En az: Ayarlar'da efekt kaydırıcısının altına "Tüy Dede'nin sesi de bu düzeyi izler" notu. Daha iyisi: anlatıcıyı efekt kaydırıcısından ayırmak (sabit 1,0 ya da ayrı kaydırıcı). Tıkları kısan oyuncu anlatıcıyı da kısmış olmasın.
3. **Kısma sahipliği.** `duck()`'a sahip/sayaç: anlatıcı kısması sürerken `AUTO_DUCK` ve kutlama kısmaları müziği yükseltmesin (en düşük düzey ve en geç bitiş kazanır); satır bitince yalnız anlatıcının kısması kalksın. Küçük, test edilebilir bir değişiklik (motor tek dosya), ayrı iş olarak önerilir.
4. **Kısma derinliği (dinleyerek karar).** Konuşmada 0,3 (−10,5 dB) müziği neredeyse siliyor (anlatıcı 17–23 LU üstte). 0,45–0,5 (−6…−7 dB) ile fark 14–20 LU olur, müzik sürekliliği korunur; anlaşılırlık için yine bol pay. Ölçütte sorun olmadığından değiştirilmedi; sahip kulakla seçmeli.
5. **Parçalar arası denge.** `menu` ve `biyom:sinir`'in `gain` değerleri ~+3 dB (ör. 0,8 → 1,1), `biyom:kanal` ~−1,5 dB alınırsa parçalar ortanca −23 LUFS'un ±1,5 LU'su içine girer. Önce tek tek dinlenmeli (karakter farkı kasıtlı olabilir).
6. **Araç rutin olsun.** Ses içeriği (yeni satır, yeni parça, efekt tasarımı) değiştiğinde `node tools/voice/duzey.mjs` (dosyalar, ~15 sn) koşulsun; dosya I'sı −17,5 LUFS'un altında kalan yeni satır üretimde düzeltilsin.
