# Reels: "Fark ettin mi?" (29,4 sn, 9:16)

Video: `marketing/reels/fark-ettin-mi.mp4` · Kapak: `marketing/reels/fark-ettin-mi-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -13,9 LUFS, gerçek tepe -1,8 dBTP. Boyut: ≈7,4 MB.

## Fikir
Ayrıntı reklamı, odyologlar için. Büyüteç Kulak Yolu’nun on anıtı üzerinde gezinir: **“Bunu sadece odyologlar fark eder.”** Sonra yedi gerçek ayrıntı, her biri üç saniye: görüntü donar (oyun sahnesi griye döner, deklanşör), ayrıntının yerinde altın bir halka ve büyüteç renkli olarak yakınlaştırır, etiket çakılır, numara sayar (01/07 … 07/07). Kapanış: **“Detaylar bizden. Merak senden.”**

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–3,0 | Kamp sahnesi: Kulak Yolu’nun 10 anıtı; büyüteç soldan sağa gezinir | **BUNU SADECE ODYOLOGLAR FARK EDER.** | “Bu detayları sadece odyologlar fark eder.” | büyüteç “tın”, gümbürtü |
| 3,0–6,6 | Hasta Vakaları › saf ses odyometrisi kartı (kurgusal vaka); büyüteç 250–500 Hz’te | 01/07 · **Sağ kulak: kırmızı O** · sol kulak: mavi X (ASHA sembolleri) | “Sağ kulak kırmızı daire, sol kulak mavi çarpı.” | savrulma, büyüteç, deklanşör |
| 6,6–9,6 | Aynı odyogram; büyüteç kemik yolu sembollerinde | 02/07 · **Kemik yolu: sağ < · sol >** | “Kemik yolu işaretleri bile yerli yerinde.” | savrulma, büyüteç |
| 9,6–13,2 | Kamp sahnesi (Kulak Yolu’nun dış kulak tarafı) donar, griye döner; büyüteçte Kanal Kemeri anıtı | 03/07 · **Kanal Kemeri** · kıllar ve kir girişte · S kıvrımı · sonda inci zar | “Kıllar ve kulak kiri: kanalın dış kısmında.” | deklanşör, parlama, büyüteç |
| 13,2–16,2 | Kamp sahnesi (koklea tarafı) donar; büyüteçte Koklea Sarmalı anıtı | 04/07 · **Koklea: 2,5 tur** | “Koklea, tam iki buçuk tur döner.” | deklanşör, büyüteç |
| 16,2–19,2 | Büyüteçte Tüy Hücresi Demeti anıtı | 05/07 · **Basamaklı stereosilya** · kısadan uzuna üç sıra, pembe uç bağlantıları | “Stereosilyalar basamak basamak dizilir.” | deklanşör, büyüteç |
| 19,2–22,2 | Hasta Vakaları › taramada kalan bebek, timpanometri kartı; büyüteç “1000 Hz prob tonla ölçüldü.” satırında | 06/07 · **Bebekte 1000 Hz prob** | “Bebeklerde prob tonu: 1000 Hz.” | savrulma, büyüteç |
| 22,2–25,2 | Kamp sahnesi (beyin tarafı) donar; büyüteçte Heschl Işığı anıtı | 07/07 · **Heschl girusu** · şakak lobunda yanan ışık: işitme korteksi | “Ve yolun sonu: işitme korteksi.” | deklanşör, büyüteç |
| 25,2–29,4 | Gece zemini, logo | **DETAYLAR BİZDEN. MERAK SENDEN.** · Yakında | “Detaylar bizden. Merak senden.” | boom, parıltı, final |

### Gösterilen ayrıntılar ve oyundaki yerleri (hepsi doğrulandı)
1. **Sağ kulak kırmızı O, sol kulak mavi X** — Kamp › Odyoloji Kliniği › Hasta Vakaları › Testler › Saf ses odyometrisi (`apps/web/src/camp/gorev/charts.tsx › OdyogramSvg`, ASHA 1990). Görüntü: “Gürültüde daha iyi duyan anne” vakası.
2. **Kemik yolu: sağ <, sol >** — aynı odyogram ve lejantı (maskesiz kemik yolu sembolleri).
3. **Kanal: kıllar ve kir yalnız dış kısımda, S kıvrımı, sonda zar** — Kamp › Kulak Yolu › Kanal Kemeri anıtı (`packages/game-core/src/camp/monuments.ts › kanal`: girişte kulak kılları ve kehribar kir damlası, S kıvrımı izi, tünelin sonunda inci rengi zar ışığı). Kıl folikülleri ve serumen bezleri kanalın dış (kıkırdak) bölümündedir.
4. **Koklea 2,5 tur** — Kulak Yolu › Koklea Sarmalı anıtı (`koklea1`, `turns = 2.5`; ayrıca Koklea Koyu’nun 2,5 tur dönen lagünü).
5. **Basamaklı stereosilya ve uç bağlantıları** — Kulak Yolu › Tüy Hücresi Demeti anıtı (`koklea2`: kısadan uzuna üç sıra, kısa sıranın ucundan uzun sıraya pembe uç bağlantısı). Tüy Dede’nin başındaki altın tüycükler de basamaklıdır (`apps/web/src/ftue/Narrator.tsx`).
6. **Bebekte 1000 Hz prob tonu** — Hasta Vakaları › “İki kez geçilemeyen tarama” vakası › Timpanometri (“1000 Hz prob tonla ölçüldü.”); test kataloğu: “226 Hz prob (6 aydan küçük bebekte 1000 Hz)”; Timpanogram Eşleştir bankasında da soru (JCIH 2019).
7. **Heschl girusu** — Kulak Yolu › Heschl Işığı anıtı (`korteks`: şakak lobunda, Sylvius yarığının altında yanan ışık).

Bilinçli olarak gösterilmeyenler: **Tonotopi Arpı** — belgede “tabanda kısa teller, tepede uzun” yazıyor ama çizimde tellerin boyu kemer gibi ortada en uzun, iki uçta kısa (`koklea3`, teller kemerin eğrisine göre çiziliyor); tabandan tepeye düzenli uzamadığı için reklamda kullanılmadı. **Otoskopi çizimi**: Işık üçgeni yönü doğru (sağda saat 5, solda saat 7), ancak çizimdeki çekiç sapının eğimi ayna görüntüsü olabilir (sağ kulakta üst uç arkaya/saat 11 yönüne bakıyor; klasik görünümde öne/saat 1 yönüne); oyun ekibi kontrol edene kadar bu reklamda büyütülmedi. Görüntüler oyunun kendi çizimleri; anıtların büyüteçteki hâli aynı çizim kodunun (`paintMonument`) yüksek çözünürlüklü çıktısıdır.

## Ses
Müzik: `reklam_ses.py` yeni **“detay”** stili (La minör → Do majör, 100 BPM: meraklı pizzicato + glokenşpil motifi, yumuşak nabız; ayrıntılar ilerledikçe hafif davul; parlak final). Efektler: büyüteç “tın” (yeni “lens”), deklanşör, savrulma, gümbürtü, boom, parıltı. Donma anında yalnız alttaki oyun görüntüsü griye döner (`fx.base`), büyüteç renkli kalır.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/fark-ettin-mi/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`); son karışım da
Whisper ile yazıya döküldü.
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendi çizimleri ve gerçek ekranlarıdır
(`tools/reels/kamp-cekim.mjs` çeker, `tools/reels/hazirla3.py` kare dizisine çevirir); oyuncu verisi yok (kamp önizlemesi yerel örnek
durum; klinik ve oyun ekranları bellek içi sunucuda tek bir örnek oyuncuyla), yönetici modu kullanılmadı.

## Gönderi metni (Instagram / TikTok)
Bunu sadece odyologlar fark eder 🔍 Sağ kulak kırmızı O, sol kulak mavi X; kemik yolu < ve >; kılları ve kiri girişte olan S kıvrımlı kanal; tam 2,5 tur dönen koklea; basamaklı stereosilya ve uç bağlantıları; bebekte 1000 Hz prob; ve yolun sonunda Heschl girusu.
Detaylar bizden, merak senden. ODİ: Sesin Yolu yakında. Sen hangisini fark ettin? 👇

#odyoloji #odyolog #odyolojiöğrencisi #odyogram #koklea #işitme #kulak #anatomi #mobiloyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/kamp-cekim.mjs --only anit,vaka   # oyun ekranları
python3 tools/reels/hazirla3.py                                                     # kare dizileri
HF_HOME=… nice -n 5 <venv>/bin/python tools/reels/vo.py --only fark-ettin-mi     # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel fark-ettin-mi
python3 tools/reels/compose.py --reel fark-ettin-mi
python3 tools/reels/denetle.py fark-ettin-mi                                     # kare tabakaları + LUFS/tepe denetimi
```
