# Reels: "Başaramadın mı?" (29,5 sn, 9:16)

Video: `marketing/reels/basaramadin-mi.mp4` · Kapak: `marketing/reels/basaramadin-mi-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -13,8 LUFS, gerçek tepe -3,7 dBTP. Boyut: ≈10,7 MB.

## Fikir
Herkesin bildiği bir an, kendine gülen bir meme diliyle. İlk karede Odi kıl perdesine kafa atar, görüntü donar, plak cızırtısı ve dev meme yazısı: **“Ben, 4. bölüm, 14. deneme.”** Anlatıcı kuru bir ciddiyetle okur. Sonra montaj: “Plan: zıplarım, geçerim.” → ağır çekimde ikinci kafa (çizgi film “tonk”, kaset yavaşlaması, yay sesi); son can, Odi boşluğa düşer, hüzünlü trombon. Oyunun gerçek sonuç ekranı: **Bu sefer olmadı** ve oyunun kendi teşvik satırı. Dönüş: Tüy Dede belirir, konuşma balonunda oyundaki gerçek cümlesi: **“Kıl perdesi alçak. Aşağı kaydır, altından kay!”** Bu sefer oyunun kendi ipucu (el işaretli “Aşağı kaydır: altından kay”) ekranda, Odi perdenin altından kayar: **Kaydım!** Ritimli temiz koşu montajı ve gerçek sonuç: **Mükemmel! 3 yıldız.** Kapanış: **Her kulak bir gün duyar.** Oyuncuyla alay yok; espri “ben” diliyle kendine yöneliktir. “14. deneme” bir şaka başlığıdır, istatistik değildir.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–2,7 | 4. bölüm «Rüzgârla Yarış»: hep zıplayan koşu kıl perdesine çarpar; çarpma anında donma, siyah-beyaz | **BEN, 4. BÖLÜM, 14. DENEME** (meme yazısı) | “Ben. 4. bölüm. 14. deneme.” | tonk + plak cızırtısı, müzik yok |
| 2,7–5,9 | 4. bölüm: ikinci perdeye yine zıplar, ağır çekimde çarpma | **PLAN: “ZIPLARIM, GEÇERİM.”** | “Zıplamak, işe yaramadı.” | kaset yavaşlaması, tonk, yay sesi; tuba + pizzicato “um-pa” başlar |
| 5,9–8,6 | 4. bölüm: hiç dokunmayan koşu, son can, boşluğa düşüş (ağır çekim, gri) | **SON CAN…** |  | müzik durur; alçalan ses + hüzünlü trombon |
| 8,6–11,3 | Gerçek sonuç ekranı (eğik telefon kartı, teşvik satırı görünecek kadar kaydırılmış): 4. Rüzgârla Yarış · **Bu sefer olmadı** · “Yolun %6'sını geçtin. Bir dahakine daha ileri!” | altyazı | “Bu sefer olmadı.” | savrulma |
| 11,2–15,0 | Gece zemini, Tüy Dede (oyundaki çizim) ve konuşma balonu | TÜY DEDE · **Kıl perdesi alçak. Aşağı kaydır, altından kay!** · 3–8. bölümler: ilk kıl perdesinden önce Tüy Dede | “Sonra bir ipucu geldi: kıl perdesi alçak. Aşağı kaydır, altından kay!” | pop + parıltı; gerilim tremolosu |
| 15,0–18,8 | 4. bölüm, bot oynar; oyunun kendi ipucu (el işaretli “Aşağı kaydır: altından kay”), Odi perdenin altından kayar (ağır çekim) | **BU SEFER…** → **KAYDIM!** |  | savrulma; parlak tam düzen |
| 18,8–22,5 | 4. bölüm: ikinci ve üçüncü perdenin altından kayış, altın koklea; vuruş başına kesme | **AKIŞ MODU** |  | savrulmalar |
| 22,5–25,7 | Gerçek sonuç ekranı: 4. Rüzgârla Yarış · **Mükemmel!** · 3 yıldız · “50 saniyede bitir” görevi ✓ | altyazı | “Bu sefer oldu: üç yıldız!” | zil, parıltı, alkış |
| 25,7–29,5 | Gece zemini, Odi, logo | **HER KULAK BİR GÜN DUYAR.** · ODİ · Sesin Yolu · Yakında | “Her kulak bir gün duyar. Yakında.” | gümbürtü + parıltı, bakır + glokenşpil “ta-da” |

Her şey oyunun kendisinden ve gerçek koşulardan: başarısız çekimler oyunun gerçek simülasyonunda iki “oyuncu” ile alındı: kaymayı zıplamaya çeviren bot (kıl perdesine gerçekten çarpar, gerçek hasar) ve hiç dokunmayan oyuncu (ilk boşluğa düşer; üç can biter, gerçek başarısızlık). Sonuç ekranları gerçek koşulardan (bellek içi sunucuda kurgusal takma adlı örnek oyuncu “Nota Avcısı”, `tools/reels/cekim4.mjs --only sonuc --bolum 4 --mod bos`): önce hiç dokunmayan koşu → “Bu sefer olmadı” (`L04-basarisiz-alt.png`: aynı ekran, oyunun teşvik satırı yapışkan düğmelerin üstünde tam görünecek kadar kaydırılmış), sonra aynı bölümü bot oynar → 3 yıldız (92/100 jeton, 47 sn, “50 saniyede bitir” görevi). Tüy Dede'nin cümlesi oyundaki seslendirme metniyle aynı (`apps/web/src/ftue/script.ts › ipucu-perde-kay`); kayma ipucu 3–8. bölümlerde ilk kıl perdelerinden önce çıkar (`docs/12-zorluk-egrisi.md`). “14. deneme” bir şaka başlığıdır; oyuncu sayısı, puan ya da istatistik iddiası yoktur.

## Ses
Müzik: `reklam_ses.py` “komedi” stili (Fa majör, 112 BPM: tuba + pizzicato “um-pa”, susmalar, gerilim tremolosu, parlak tam düzen, “ta-da” sonu). Yeni efektler: **bonk** (çizgi film kafa çarpması), **trombone** (hüzünlü dört nota, özgün sentez), **tapestop** (kaset yavaşlaması); ayrıca plak cızırtısı, yay, alçalan ses, pop, parıltı, zil, alkış. Kesmeler vuruş ızgarasında. Anlatıcıdaki ipucu cümlesi Tüy Dede’nin oyundaki gerçek repliğidir (`ipucu-perde-kay`); “Tüy Dede” adı sentezde anlaşılmadığı için “Sonra bir ipucu geldi” diye söylendi, ad ekranda balonda görünür. “kaydır” 15,00'teki kesmeye (parlak tam düzen + savrulma) denk gelir; son r'si gömülmesin diye yalnız o kelimenin altında müzik ve efektler ayrıca −5 dB kısılır ve 1–5 kHz'de −6 dB oyulur (`vo.dip`, `compose.py`; yeniden seslendirme yok). Son karışımın Whisper dökümü metinle örtüşüyor; z4 bölümü: “Sonra bir ipucu geldi, kıl perdesi alçak, aşağı kaydır, altından kay.” (oyuktan önce “kaydı”).

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/basaramadin-mi/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`); son karışım da
Whisper ile yazıya döküldü.
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendisidir: bölüm klipleri sanal saatle kare kare (`tools/reels/clip.html`; yeni `mode: 'zipla' | 'bos'` ve `hints` seçenekleri), sonuç ekranları gerçek koşudan (`tools/reels/cekim4.mjs`). Tüy Dede ve Odi oyundaki SVG çizimlerin aynısı. Yönetici modu kullanılmadı.

## Gönderi metni (Instagram / TikTok)
Ben, 4. bölüm, 14. deneme. 😅 Zıplamak işe yaramadı… Tüy Dede “Kıl perdesi alçak. Aşağı kaydır, altından kay!” dedi; bu sefer oldu: üç yıldız! ⭐⭐⭐
Her kulak bir gün duyar. ODİ: Sesin Yolu yakında. Sen hangi bölümde takıldın? 👇

#oyun #mobiloyun #gamer #komik #pesetme #odyoloji #işitme #kulak #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/cekim4.mjs --only sonuc --bolum 4 --mod bos   # sonuç ekranları
HF_HOME=… nice -n 10 <venv>/bin/python tools/reels/vo.py --only basaramadin-mi     # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel basaramadin-mi
python3 tools/reels/compose.py --reel basaramadin-mi
python3 tools/reels/denetle.py basaramadin-mi                                     # kare tabakaları + LUFS/tepe denetimi
```
