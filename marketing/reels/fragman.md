# Reels: "ODİ: Sesin Yolu — Fragman" (40,1 sn, 9:16)

Video: `marketing/reels/fragman.mp4` · Kapak: `marketing/reels/fragman-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -14,0 LUFS, gerçek tepe -2,2 dBTP. Boyut: ≈21,9 MB.

## Fikir
Sinema fragmanı parodisi. Karanlık, kalp atışı, tok ve yankılı anlatıcı, her başlık kartında “bıraam”. Kulağın içindeki tehlikeler giderek büyür: Serumen Golemi, 18 patolojiden altısı (vuruş başına bir kesme), Gürültü Canavarı. Tam “kulağın tek bir umudu var” denirken spot ışığında… minicik Odi belirir (“evet, biraz küçük”) — komik kırılma. Ardından “Hızlı. Çevik. Durdurulamaz.” montajı, bir vuruşluk sessizlik ve logo darbesi. Kapanış espirisi: “Yakında. Kulağına çok yakın bir yerde.” Görüntü dili: sinema şeritleri (letterbox), turkuaz-turuncu renk, vinyet, hafif gren, sarsıntı, RGB kayması, ağır çekim (Golem yumruğu).

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–0,9 | Gürültü Canavarı'nın yüzüne çok yakın, tek darbe (40. bölüm) | — |  | bıraam + darbe, beyaz parlama, sarsıntı, RGB kayması |
| 0,9–5,7 | Dış kulak (4. bölüm) ve karanlık kanal (7. bölüm), ağır çekim, yavaş yaklaşma | altyazı (fragman tarzı, büyük harf) | “Bir ses, kulağa girdi.” “Ve geri dönmedi.” | kalp atışı ×4, alçak uğultu (drone) |
| 5,7–7,5 | Siyah ekran | **BİR KULAK.** (titreyerek yanar) |  | darbe |
| 7,5–10,5 | Gürültü Canavarı arenası (40. bölüm) | altyazı | “Büyük Sessizlik geliyor.” | tik-tak nabız ostinatosu, iki dijital bozulma |
| 10,5–14,7 | Serumen Golemi (20. bölüm): yumruk çakılırken ağır çekim (×0,25), sarsıntı | **SERUMEN GOLEMİ** (şeritli başlık) | “Kanalın sonunda bir dev bekliyor.” | darbe + boom + savrulma |
| 14,7–18,3 | 6 hızlı kesme (vuruş başına): Kulak kiri tıkacı (8), Kulak zarı deliği (12), Üzengi takılması (16), Orta kulakta sıvı (14), Meniere (30), Kulak çınlaması (37) | **01 / 18 … 06 / 18** + patoloji adı | “Derinlerde, 18 patoloji.” | her kesmede vuruş + savrulma; yükselen trampet ve tremolo |
| 18,3–23,1 | Bir vuruş siyah sessizlik → Gürültü Canavarı çığlığı (40. bölüm) | **GÜRÜLTÜ CANAVARI** | “Ve en dipte, Gürültü Canavarı.” | sessizlik → bıraam; davullar, bakır, koro |
| 23,1–27,9 | Karanlık, spot ışığı yanar… ışıkta minicik Odi | “(evet, biraz küçük)” (daktilo) | “Kulağın tek bir umudu var.” | uğultu → “boing!” + müzik kutusu |
| 27,9–32,1 | Sinir yolunda atılış (31), kokleada yüzme (22), Canavar'a vuruş (40) | **HIZLI. · ÇEVİK. · DURDURULAMAZ.** (çarparak) |  | bıraam + vuruşlar, tam orkestra |
| 32,1–36,3 | Bir vuruş sessizlik → Odi ve logo darbesi | **ODİ · Sesin Yolu** · Kulaktan beyne, bir sesin yolculuğu | “ODİ: Sesin Yolu.” | bıraam + boom + parıltı, Re majör final akoru |
| 36,3–40,1 | Siyah | **YAKINDA** · altyazı · minik Odi yukarıdan düşer | “Yakında. Kulağına çok yakın bir yerde.” | darbe; son espri: “pop” |

Bilgiler: 18 patoloji ve adları `docs/odyoloji-icerik.md` (bölümlerdeki patoloji tablosu); Serumen Golemi 20., Gürültü Canavarı 40. bölümün sonu; “Büyük Sessizlik” oyunun açılış hikâyesindendir. Tarih, indirme sayısı, ödül ya da yorum yok. Görüntüdeki “+Kulak kiri tıkacı” gibi etiketler oyunun kendi patoloji etiketleridir.

## Ses
Müzik: `reklam_ses.py` “fragman” stili (Re minör; uğultu → nabız → yükselen trampet/tremolo → taiko + bakır + koro → müzik kutusu parodisi → Re majör final), 100 BPM; bütün sahne kesmeleri vuruş ızgarasında. Efektler: bıraam, boom, darbe, kalp atışı, ters yankı, savrulma, dijital bozulma, boing, parıltı. Anlatıcı satırları fragman okuması (daha ağır ve tok; alçak frekans dolgunluğu + hafif salon yankısı) ile; ses aynı anlatıcıdır.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/fragman/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`).
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendi çizimleri ve gerçek ekranlarıdır.

## Gönderi metni (Instagram / TikTok)
Bir ses kulağa girdi. Ve geri dönmedi. 🎬
Serumen Golemi, 18 patoloji, Gürültü Canavarı… ve minicik bir kahraman. ODİ: Sesin Yolu yakında. Kulağına çok yakın bir yerde.
Takip et, ilk duyan sen ol!

#odyoloji #odyolog #odyolojiöğrencisi #işitme #kulak #fragman #oyun #mobiloyun #indieoyun #yakında #odisesinyolu

## Yeniden üretmek
```
HF_HOME=… nice -n 5 <venv>/bin/python tools/reels/vo.py --only fragman      # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel fragman
python3 tools/reels/compose.py --reel fragman
python3 tools/reels/denetle.py fragman                                     # kare tabakaları + LUFS/tepe denetimi
```
