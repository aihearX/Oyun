# Reels: "Kulaklığını tak" (38,0 sn, 9:16)

Video: `marketing/reels/kulakligini-tak.mp4` · Kapak: `marketing/reels/kulakligini-tak-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -14,2 LUFS, gerçek tepe -3,8 dBTP. Boyut: ≈7,0 MB.

## Fikir
Kulaklık meydan okuması, Ton Avı’nın ruhuyla. Sakin, karanlık bir ekran ve kulaklık: **“Kulaklığını tak.”** Her karede: **“Bu bir oyundur, işitme testi değildir.”** Dört soru; dinleme anlarında müzik tamamen susar (dramatik sessizlik), sonra cevap: 1) Ses var mı? — 1000 Hz ton → **Vardı!** 2) Hangisi daha ince? — 1000 Hz, sonra 1500 Hz (ekranda yalnız sıra yanar: 1, 2) → **2.** 3) Ses var mı? — hiç ton yok → **Yoktu!** “Sessizliği duymak da önemli.” 4) Son soru, daha zor (oyunun odyoloji düzeyi farkı, ×1,15): 2000 Hz, sonra 1740 Hz → **1.** Ardından oyunun gerçek Ton Avı ekranı ve “Kaçını bildin? Yorumlara yaz.” Sahte istatistik yok (“%90 bilemedi” gibi bir şey söylenmez).

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–2,7 | Sakin karanlık zemin, kulaklık çizimi | **KULAKLIĞINI TAK.** · Bu bir oyundur, işitme testi değildir. | “Kulaklığını tak.” | yumuşak gümbürtü; çok alçak pad |
| 2,7–8,7 | Kulak simgesi (görsel ipucu yok) → cevapta nabız halkası | 1/4 · **SES VAR MI?** · Dinle… → **VARDI!** · 1000 Hz | “Birinci soru: ses var mı? Dinle.” “Cevap: vardı.” | müzik susar; 1000 Hz ton (0,45 sn) · cevapta zil |
| 8,7–15,3 | “1” ve “2” sırayla yanar (yalnız sıra) | **HANGİSİ DAHA İNCE?** → **2.** · 1000 Hz → 1500 Hz | “İkinci soru: hangisi daha ince?” “Cevap: ikincisi.” | müzik susar; 1000 Hz, 1500 Hz tonları · zil |
| 15,3–22,7 | Kulak simgesi | 3/4 · **SES VAR MI?** · Dinle… → **YOKTU!** | “Üçüncü soru: ses var mı?” “Bu sefer yoktu. Sessizliği duymak da önemli.” | müzik susar; ton YOK (sessizlik) · pop |
| 22,7–30,0 | “1” ve “2” sırayla yanar | **HANGİSİ DAHA İNCE?** → **1.** · 2000 Hz → 1740 Hz | “Son soru, biraz daha zor: hangisi daha ince?” “Cevap: birincisi.” | müzik susar; 2000 Hz, 1740 Hz tonları · zil |
| 30,0–34,7 | Eğik telefon kartı: Kamp › Odyometri Odası › Ton Avı (“Hangisi daha ince?”, “BU BİR İŞİTME TESTİ DEĞİLDİR”) | Ton Avı · Kamp · Odyometri Odası | “Ton Avı kampta seni bekliyor. Bu bir oyun, işitme testi değil.” | savrulma |
| 34,7–38,0 | Bitiş kartı | Yakında · Kaçını bildin? **Yorumlara yaz** · Bu bir oyundur, işitme testi değildir. | “Kaç tane bildin? Yorumlara yaz.” | parıltı, sıcak final akoru |

Ton Avı: `packages/content/src/kamp-gorev.ts › tonTuru` (ton frekansları 500–4000 Hz; “hangisi daha ince” genel düzeyde ×1,5–2, odyoloji düzeyinde ×1,12–1,26) ve `Oyunlar.tsx` (yalnız sesle oynanır; ekranda sesin çalıp çalmadığını ele veren ipucu yok; “BU BİR İŞİTME TESTİ DEĞİLDİR”). Uyarı her sahnede ekranda ve anlatıcının son satırında.

**Ses güvenliği:** tonlar saf sinüs, 0,45 sn, 20 ms yumuşak giriş/çıkış (tık ya da ani patlama yok), ayrı bir izde sabit ve ılımlı düzeyde (son karışımda −24 dBFS RMS, tepe −21 dBFS; anlatıcı konuşmasının belirgin biçimde altında; sıkıştırıcıya girmez), tonlar sırasında müzik ve efekt yok. En yüksek ton 2000 Hz; ani yüksek frekanslı ses yok. Son karışım −14 LUFS, gerçek tepe ≤ −1 dBTP.

## Ses
Müzik: `reklam_ses.py` yeni **“sessiz”** stili (Fa majör, 90 BPM: çok alçak, havadar pad; cevaplarda yumuşak nabız + glokenşpil; dinleme anlarında tamamen susar; sıcak final akoru). Tonlar `reklam_ses.py › sfx("tone")` ile üretilir ve `compose.py › mix_audio_ad` içinde ayrı izde karışır (`sahne.tones`). Efektler: gümbürtü, zil, pop, savrulma, parıltı.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/kulakligini-tak/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`); son karışım da
Whisper ile yazıya döküldü.
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendi çizimleri ve gerçek ekranlarıdır
(`tools/reels/kamp-cekim.mjs` çeker, `tools/reels/hazirla3.py` kare dizisine çevirir); oyuncu verisi yok (kamp önizlemesi yerel örnek
durum; klinik ve oyun ekranları bellek içi sunucuda tek bir örnek oyuncuyla), yönetici modu kullanılmadı.

## Gönderi metni (Instagram / TikTok)
Kulaklığını tak 🎧 Ses var mı? Hangisi daha ince? Dört soru, sessizlik dahil. Kaçını bildin? Yorumlara yaz 👇
Ton Avı, ODİ: Sesin Yolu’nda kampın Odyometri Odası’nda. Bu bir oyundur, işitme testi değildir; işitmenle ilgili bir kaygın varsa bir odyoloğa ya da hekime danış.

#odyoloji #odyolog #odyolojiöğrencisi #işitme #kulak #kulaklık #challenge #mobiloyun #oyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/kamp-cekim.mjs --only oyun   # oyun ekranları
python3 tools/reels/hazirla3.py                                                     # kare dizileri
HF_HOME=… nice -n 5 <venv>/bin/python tools/reels/vo.py --only kulakligini-tak     # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel kulakligini-tak
python3 tools/reels/compose.py --reel kulakligini-tak
python3 tools/reels/denetle.py kulakligini-tak                                     # kare tabakaları + LUFS/tepe denetimi
```
