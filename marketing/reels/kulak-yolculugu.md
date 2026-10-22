# Reels: "Kulağın içinden bir yolculuk" (27,5 sn, 9:16)

Video: `marketing/reels/kulak-yolculugu.mp4` · Kapak: `marketing/reels/kulak-yolculugu-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC, faststart, ses yüksekliği ≈ −14 LUFS. Boyut: ≈15,6 MB.
Hedef kitle: odyoloji öğrencileri ve odyologlar. Mesaj: oyun kulağın gerçek anatomisini kulak kepçesinden işitsel kortekse
bölge bölge oynatıyor; her bölgede doğru terim ekranda. Sonu: **Yakında yayında**.

Görüntüler oyunun kendisinden: otomatik oyuncu (bot) bölümleri gerçekten oynuyor, her bölge o bölgenin bölümünden
(bölüm numarası parantez içinde). Oyun içindeki küçük ✚ etiketler oyunun kendi patoloji etiketleridir.
Ses: erkek anlatıcı (aşağıda), altyazılı; özgün müzik anlatıcının altında kısılır.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı |
|---|---|---|---|
| 0–3,0 | Koklea · Taban (22. bölüm), Odi perilenfte yüzüyor | **Kokleanın içinde koşan bir oyun hiç gördün mü? 👀** · "Kulaktan beyne" | "Kokleanın içinde koşan bir oyun hiç gördün mü?" |
| 3,0–5,2 | Dış Kulak (4. bölüm) | yolculuk şeridi 1/9 · DIŞ KULAK · **Aurikula** · kulak kepçesi · sesi toplar | "Ses, kulak kepçesinden yola çıkar," |
| 5,2–7,2 | Kulak Kanalı (7. bölüm), duvardan duvara | DIŞ KULAK YOLU · **≈2,5 cm** · bir ucu kapalı tüp · 2,5–3 kHz rezonans | "daracık kanaldan geçer," |
| 7,2–9,2 | Kulak Zarı (10. bölüm), zar sıçrayışı | ORTA KULAK · **Timpanik membran** · kulak zarı · ≈0,1 mm · üç katman | "kulak zarında zıplar," |
| 9,2–10,7 | 13. bölüm «Çekiç», kancada sallanma | KEMİKÇİKLER · **Malleus** · çekiç | "üç minik kemikle iç kulağa uçar." |
| 10,7–12,2 | 14. bölüm «Örs» | **İnkus** · örs | ↑ |
| 12,2–13,7 | 15. bölüm «Üzengi» | **Stapes** · üzengi · vücudun en küçük kemiği | |
| 13,7–15,7 | Koklea · Taban (22. bölüm) | KOKLEA · BAZ · **Yüksek frekans** · tabanda ince sesler | "Kokleanın içinde her frekansın kendi adresi var." |
| 15,7–17,7 | Koklea · Apeks (27. bölüm «Bas Diyarı») | KOKLEA · APEKS · **Tonotopi** · tepede kalın sesler · her frekansa bir adres | ↑ |
| 17,7–19,7 | İşitme Siniri (31. bölüm), ses darbesi | İŞİTME SİNİRİ · **VIII. sinir** · ≈30.000 lif · vestibülokoklear | "Sinirden ışık hızıyla beyne!" |
| 19,7–21,7 | Beyin Sapı (34. bölüm) | BEYİN SAPI · **Superior oliver** · iki kulağın sesi ilk burada buluşur | "İki kulak burada buluşur," |
| 21,7–23,7 | İşitme Korteksi (37. bölüm) | İŞİTSEL KORTEKS · **Heschl girusu** · ses burada anlama dönüşür | "ve ses, anlama dönüşür." |
| 23,7–27,5 | Bitiş kartı | Odi · **ODİ · Sesin Yolu** · **Yakında yayında** · Takip et, ilk duyan sen ol 🔔 · Sınıf arkadaşını etiketle 👇 | "Odi: Sesin Yolu. Çok yakında! Takip et, ilk duyan sen ol." |

Bilgiler `docs/odyoloji-icerik.md` maddelerinden: aurikula (Gelfand), dış kulak yolu ≈2,5 cm ve 2,5–3 kHz rezonans, zar ≈0,1 mm
ve üç katman, malleus/inkus/stapes ve "vücudun en küçük kemiği", baz yüksek / apeks alçak frekans (tonotopi), işitme siniri ≈30.000
lif ve VIII. kafa siniri, superior oliver kompleks (iki kulaktan gelen bilgi ilk kez burada birleşir), Heschl girusu.

## Ses
Erkek anlatıcı: Chatterbox Multilingual (Resemble AI, MIT lisansı) ile bir kez üretildi ve depoya işlendi (`tools/reels/vo/`);
ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`),
gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan "Perth" filigranı vardır. Müzik özgün sentezdir (`tools/reels/music.py`).

## Gönderi metni
Aurikuladan Heschl girusuna: Odi kulağın içinden koşuyor, sen her bölgede gerçek terimi öğreniyorsun. 👂🎮
ODİ: Sesin Yolu yakında yayında. Takip et, ilk duyan sen ol!

#odyoloji #odyolog #odyolojiöğrencisi #işitme #koklea #tonotopi #kulak #anatomi #oyun #mobiloyun #yakında #odisesinyolu

## Yeniden üretmek
Anlatıcı sesi önceden üretilmiştir (`tools/reels/vo/kulak-yolculugu/*.mp3`; metin `tools/reels/vo/metin.json`, üretim `tools/reels/vo.py`).
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel kulak-yolculugu
python3 tools/reels/compose.py --reel kulak-yolculugu
```
Sahneler ve yazılar: `tools/reels/teasers.mjs`; zaman çizelgesi: `node tools/reels/record.mjs --reel kulak-yolculugu --zaman`.
