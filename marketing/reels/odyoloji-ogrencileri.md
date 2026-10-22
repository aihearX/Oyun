# Reels: "Odyoloji öğrencileri, bu sizin için" (29,7 sn, 9:16)

Video: `marketing/reels/odyoloji-ogrencileri.mp4` · Kapak: `marketing/reels/odyoloji-ogrencileri-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC, faststart, ≈ −14 LUFS. Boyut: ≈9,1 MB.
Kurgu: başta bir soru ("B tipi timpanogram ne anlatır?"), sonda cevabı; arada oyundaki gerçek patolojiler, Tedavi Odası, Kulak
Sözlüğü ve Günün Sorusu. Yorum ve paylaşım için tasarlandı: izleyici cevabı tahmin edip yoruma yazar, arkadaşını etiketler.
Ses: erkek anlatıcı, altyazılı; teknik terimler yalnız ekranda.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı |
|---|---|---|---|
| 0–2,5 | Kulak Zarı (10. bölüm) oynanışı | **Timpanogram Tip B ne anlatır? 🤔** · "Cevap videonun sonunda 👇" | "B tipi timpanogram ne anlatır?" |
| 2,5–5,4 | Kart | ODYOLOJİ ÖĞRENCİLERİ, BU SİZİN İÇİN · sayaç **0 → 18** · gerçek kulak patolojisi, bölümlerin içinde · Kaynak: ders kitapları · Katz, Gelfand, Pickles | "Odyoloji öğrencileri, bu oyun tam size göre!" |
| 5,4–6,8 | 8. bölüm, oyundaki "✚ Kulak kiri tıkacı" etiketi | **Serumen tıkacı** · dış kulak yolu | "On sekiz gerçek kulak patolojisi var ve hepsini bölümlerde oynayarak tanıyorsun." |
| 6,8–8,2 | 12. bölüm, "✚ Kulak zarı deliği" | **Perforasyon** · timpanik membranda delik | ↑ |
| 8,2–9,6 | 16. bölüm, "✚ Üzengi kemiği takılması" | **Otoskleroz** · üzengi tabanı oval pencerede takılır | ↑ |
| 9,6–11,0 | 14. bölüm, "✚ Orta kulakta sıvı" | **Seröz otitis media** · orta kulakta sıvı | |
| 11,0–12,4 | 30. bölüm, "✚ Meniere hastalığı" | **Meniere** · endolenfatik hidrops | |
| 12,4–13,8 | 37. bölüm, "✚ Kulak çınlaması" | **Tinnitus** · kulak çınlaması | |
| 13,8–17,7 | Kamp › Tedavi Odası tarif paneli (gerçek ekran) | KAMP · TEDAVİ ODASI · Ventilasyon tüpü · Stapes protezi · Kemikçik protezi · Koklear implant · Uzaktan mikrofon | "Tedavi Odası'nda malzemeni hazırla, engeli etkisiz kıl." |
| 17,7–19,7 | Kulak Sözlüğü, "Daha fazla" açık (gerçek ekran) | KULAK SÖZLÜĞÜ · "DAHA FAZLA" | "Sözlükte önce sade, sonra derin anlatım." |
| 19,7–21,7 | Takım sohbetinde Günün Sorusu kartı (gerçek ekran) | GÜNÜN SORUSU · HER GÜN TAKIMINA | |
| 21,7–26,1 | Kart: şematik Tip A / Tip B timpanogram | CEVAP · **Tip B = düz timpanogram** · Orta kulakta sıvı ya da zar delinmesi düşündürür; kanal hacmi ikisini ayırt ettirir. · Jerger sınıflaması · Katz, Handbook of Clinical Audiology | "Cevap: B tipi, yani düz timpanogram." · "Sıvı mı, delik mi? Kanal hacmine bak!" |
| 26,1–29,7 | Bitiş kartı | **ODİ · Sesin Yolu** · **Yakında yayında** · Takip et, ilk duyan sen ol 🔔 · Sınıf arkadaşını etiketle 👇 · "Eğitsel içerik; tanı ve tedavi için hekim ve odyolog." | "Odi: Sesin Yolu. Çok yakında!" |

Cevap `docs/odyoloji-icerik.md`'den: Jerger sınıflaması, "B düz eğri (ör. orta kulakta sıvı ya da zar delinmesi; kanal hacmine
bakılır)" (Katz). Patoloji adları ve terimleri oyunun `patolojiler.ts` tablosundaki gibi (oyun etiketi "Meniere hastalığı" yazımını
kullanır). Tedavi Odası listesi `remedies.ts`'teki malzemelerden; tıbbi öneri değildir.

## Ses
Erkek anlatıcı: Chatterbox Multilingual (Resemble AI, MIT lisansı) ile bir kez üretildi ve depoya işlendi (`tools/reels/vo/`);
ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`),
gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan "Perth" filigranı vardır. Müzik özgün sentezdir (`tools/reels/music.py`).

## Gönderi metni
Timpanogram Tip B ne anlatır? Cevabı videoda; sen önce yorumlara yaz 👇 Serumenden tinnitusa 18 patoloji, Tedavi Odası ve Kulak Sözlüğü: ODİ: Sesin Yolu yakında yayında.
Sınıf arkadaşını etiketle!

#odyoloji #odyolog #odyolojiöğrencisi #timpanometri #işitme #işitmekaybı #otoskleroz #tinnitus #koklearimplant #oyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel odyoloji-ogrencileri
python3 tools/reels/compose.py --reel odyoloji-ogrencileri
```
Ekran görüntüleri `tools/harness/tanitim.mjs` çekiminden (`tools/harness/out/tanitim/img/**`); sahneler `tools/reels/teasers.mjs`;
anlatıcı `tools/reels/vo/odyoloji-ogrencileri/*.mp3` (`tools/reels/vo.py`).
