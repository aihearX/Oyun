# Reels: "Kulağın içinden bir yolculuk" (26,6 sn, 9:16)

Video: `marketing/reels/kulak-yolculugu.mp4` · Kapak: `marketing/reels/kulak-yolculugu-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC, faststart, ses yüksekliği ≈ −14 LUFS. Boyut: ≈14,0 MB.
Hedef kitle: odyoloji öğrencileri ve odyologlar. Mesaj: oyun kulağın gerçek anatomisini kulak kepçesinden işitsel kortekse
bölge bölge oynatıyor; her bölgede doğru terim. Sonu: **Yakında yayında**.

Görüntüler oyunun kendisinden: otomatik oyuncu (bot) bölümleri gerçekten oynuyor, her bölge o bölgenin bölümünden
(bölüm numarası parantez içinde). Oyun içindeki küçük ✚ etiketler oyunun kendi patoloji etiketleridir.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Ses |
|---|---|---|---|
| 0–2,5 | Koklea · Taban (22. bölüm), Odi perilenfte yüzüyor | **Kokleanın içinde koşan bir oyun hiç gördün mü? 👀** · "Kulaktan beyne" | müzik girişi (yükselen süpürme) |
| 2,5–4,5 | Dış Kulak (4. bölüm) | yolculuk şeridi 1/9 · DIŞ KULAK · **Aurikula** · kulak kepçesi · sesi toplar | Tüy Dede: "Ninni kulaktan girer, kanalı geçer, kulak zarına ve kemikçiklere ulaşır; kokleadan işitme siniriyle beyne gider." (altyazılı) |
| 4,5–6,5 | Kulak Kanalı (7. bölüm), duvardan duvara | DIŞ KULAK YOLU · **≈2,5 cm** · bir ucu kapalı tüp · 2,5–3 kHz rezonans | ↑ |
| 6,5–8,5 | Kulak Zarı (10. bölüm), zar sıçrayışı | ORTA KULAK · **Timpanik membran** · kulak zarı · ≈0,1 mm · üç katman | ↑ |
| 8,5–10 | 13. bölüm «Çekiç», kancada sallanma | KEMİKÇİKLER · **Malleus** · çekiç | |
| 10–11,5 | 14. bölüm «Örs» | **İnkus** · örs | |
| 11,5–13 | 15. bölüm «Üzengi» | **Stapes** · üzengi · vücudun en küçük kemiği | |
| 13–15 | Koklea · Taban (22. bölüm) | KOKLEA · BAZ · **Yüksek frekans** · tabanda ince sesler | Tüy Dede: "Kokleanın tabanı ince seslere, tepesi kalın seslere yanıt verir." |
| 15–17 | Koklea · Apeks (27. bölüm «Bas Diyarı») | KOKLEA · APEKS · **Tonotopi** · tepede kalın sesler · her frekansa bir adres | ↑ |
| 17–19 | İşitme Siniri (31. bölüm), ses darbesi | İŞİTME SİNİRİ · **VIII. sinir** · ≈30.000 lif · vestibülokoklear | |
| 19–21 | Beyin Sapı (34. bölüm) | BEYİN SAPI · **Superior oliver** · iki kulağın sesi ilk burada buluşur | |
| 21–23 | İşitme Korteksi (37. bölüm) | İŞİTSEL KORTEKS · **Heschl girusu** · ses burada anlama dönüşür | |
| 23–26,6 | Bitiş kartı | Odi · **ODİ · Sesin Yolu** · **Yakında yayında** · Takip et, ilk duyan sen ol 🔔 · Sınıf arkadaşını etiketle 👇 | müzik finali |

Bilgiler `docs/odyoloji-icerik.md` maddelerinden: aurikula (Gelfand), dış kulak yolu ≈2,5 cm ve 2,5–3 kHz rezonans, zar ≈0,1 mm
ve üç katman, malleus/inkus/stapes ve "vücudun en küçük kemiği", baz yüksek / apeks alçak frekans (tonotopi), işitme siniri ≈30.000
lif ve VIII. kafa siniri, superior oliver kompleks (iki kulaktan gelen bilgi ilk kez burada birleşir), Heschl girusu.

## Gönderi metni
Aurikuladan Heschl girusuna: Odi kulağın içinden koşuyor, sen her bölgede gerçek terimi öğreniyorsun. 👂🎮
ODİ: Sesin Yolu yakında yayında. Takip et, ilk duyan sen ol!

#odyoloji #odyolog #odyolojiöğrencisi #işitme #koklea #tonotopi #kulak #anatomi #oyun #mobiloyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel kulak-yolculugu
python3 tools/reels/compose.py --reel kulak-yolculugu
```
Sahneler, yazılar ve sesler: `tools/reels/teasers.mjs`. Kullanım ayrıntısı: `tools/reels/record.mjs` başındaki açıklama.
