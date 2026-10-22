# Reels: "Odyoloji öğrencileri, bu sizin için" (27,3 sn, 9:16)

Video: `marketing/reels/odyoloji-ogrencileri.mp4` · Kapak: `marketing/reels/odyoloji-ogrencileri-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC, faststart, ≈ −14 LUFS. Boyut: ≈8,7 MB.
Kurgu: başta bir soru ("Timpanogram Tip B ne anlatır?"), sonda cevabı; arada oyundaki gerçek patolojiler, Tedavi Odası, Kulak
Sözlüğü ve Günün Sorusu. Yorum ve paylaşım için tasarlandı: izleyici cevabı tahmin edip yoruma yazar, arkadaşını etiketler.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Ses |
|---|---|---|---|
| 0–2,5 | Kulak Zarı (10. bölüm) oynanışı | **Timpanogram Tip B ne anlatır? 🤔** · "Cevap videonun sonunda 👇" | müzik |
| 2,5–4,5 | Kart | ODYOLOJİ ÖĞRENCİLERİ, BU SİZİN İÇİN · sayaç **0 → 18** · gerçek kulak patolojisi, bölümlerin içinde · Kaynak: ders kitapları · Katz, Gelfand, Pickles | |
| 4,5–5,9 | 8. bölüm, oyundaki "✚ Kulak kiri tıkacı" etiketi | **Serumen tıkacı** · dış kulak yolu | |
| 5,9–7,3 | 12. bölüm, "✚ Kulak zarı deliği" | **Perforasyon** · timpanik membranda delik | |
| 7,3–8,7 | 16. bölüm, "✚ Üzengi kemiği takılması" | **Otoskleroz** · üzengi tabanı oval pencerede takılır | |
| 8,7–10,1 | 14. bölüm, "✚ Orta kulakta sıvı" | **Seröz otitis media** · orta kulakta sıvı | |
| 10,1–11,5 | 30. bölüm, "✚ Meniere hastalığı" | **Meniere** · endolenfatik hidrops | |
| 11,5–12,9 | 37. bölüm, "✚ Kulak çınlaması" | **Tinnitus** · kulak çınlaması | |
| 12,9–15,5 | Kamp › Tedavi Odası tarif paneli (gerçek ekran) | KAMP · TEDAVİ ODASI · Ventilasyon tüpü · Stapes protezi · Kemikçik protezi · Koklear implant · Uzaktan mikrofon | |
| 15,5–17,5 | Kulak Sözlüğü, "Daha fazla" açık (gerçek ekran) | KULAK SÖZLÜĞÜ · "DAHA FAZLA" | |
| 17,5–19,5 | Takım sohbetinde Günün Sorusu kartı (gerçek ekran) | GÜNÜN SORUSU · HER GÜN TAKIMINA | |
| 19,5–23,7 | Kart: şematik Tip A / Tip B timpanogram | CEVAP · **Tip B = düz timpanogram** · Orta kulakta sıvı ya da zar delinmesi düşündürür; kanal hacmi ikisini ayırt ettirir. · Jerger sınıflaması · Katz, Handbook of Clinical Audiology | Tüy Dede: "Düz bir timpanogram çoğu zaman orta kulakta sıvıyı düşündürür." (altyazılı) |
| 23,7–27,3 | Bitiş kartı | **ODİ · Sesin Yolu** · **Yakında yayında** · Takip et, ilk duyan sen ol 🔔 · Sınıf arkadaşını etiketle 👇 · "Eğitsel içerik; tanı ve tedavi için hekim ve odyolog." | |

Cevap `docs/odyoloji-icerik.md`'den: Jerger sınıflaması, "B düz eğri (ör. orta kulakta sıvı ya da zar delinmesi; kanal hacmine
bakılır)" (Katz). Patoloji adları ve terimleri oyunun `patolojiler.ts` tablosundaki gibi (oyun etiketi "Meniere hastalığı" yazımını
kullanır). Tedavi Odası listesi `remedies.ts`'teki malzemelerden; tıbbi öneri değildir.

## Gönderi metni
Timpanogram Tip B ne anlatır? Cevabı videoda; sen önce yorumlara yaz 👇 Serumenden tinnitusa 18 patoloji, Tedavi Odası ve Kulak Sözlüğü: ODİ: Sesin Yolu yakında yayında.
Sınıf arkadaşını etiketle!

#odyoloji #odyolog #odyolojiöğrencisi #timpanometri #işitme #işitmekaybı #otoskleroz #tinnitus #koklearimplant #oyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel odyoloji-ogrencileri
python3 tools/reels/compose.py --reel odyoloji-ogrencileri
```
Ekran görüntüleri `tools/harness/tanitim.mjs` çekiminden (`tools/harness/out/tanitim/img/**`); sahneler `tools/reels/teasers.mjs`.
