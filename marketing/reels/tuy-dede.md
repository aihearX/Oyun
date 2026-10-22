# Reels: "Tüy Dede'yle tanışın" (29,9 sn, 9:16)

Video: `marketing/reels/tuy-dede.mp4` · Kapak: `marketing/reels/tuy-dede-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC, faststart, ≈ −14 LUFS. Boyut: ≈9,0 MB.
Karakter Reels'i: Tüy Dede ve Odi ekranda (oyundaki SVG çizimlerin aynısı: `ftue/Narrator.tsx`, `TitleScreen.tsx`); hikâyeyi
erkek anlatıcı anlatıyor (altyazılı).

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı |
|---|---|---|---|
| 0–5,6 | Büyük Tüy Dede portresi | **Bu dede bir tüy hücresi! 👀** · Başındaki altın tüyler: basamak basamak dizilmiş **stereosilya** | "Bu dede aslında bir tüy hücresi!" · "Adı Tüy Dede; başındaki altın tüyler, stereosilya." |
| 5,6–7,5 | Odi | BU ODİ: MİNİK BİR SES | "Bu da Odi: minik bir ses." |
| 7,5–10,6 | 4. bölüm oynanışı | GÖREVİ: NİNNİYİ BEYNE TAŞIMAK 🎵 | "Görevi, annesinin ninnisini beyne taşımak." |
| 10,6–13,1 | 20. bölüm, Serumen Golemi | **Serumen Golemi** · kanalın sonunda | "Ama yolda Serumen Golemi var," |
| 13,1–16,2 | 40. bölüm, Gürültü Canavarı | **Gürültü Canavarı** · son kapı | "ve kulağın ışıklarını söndüren Gürültü Canavarı!" |
| 16,2–19,6 | Kamp: yeni anıt yükseliyor (Üç Kemikçik) | KAMPINDA BÖLGE ANITLARI | "Her yeni bölgeye ulaşınca kampında bir anıt yükselir." |
| 19,6–22,6 | Kamp Sv 15, on anıt | KULAK KEPÇESİNDEN HESCHL’E 10 ANIT | "Kulak kepçesinden kortekse, tam on anıt." |
| 22,6–26,3 | Tüy Dede ve Odi yan yana | YALNIZ DEĞİLSİN 🤝 | "Yalnız değilsin: Tüy Dede ve takımın hep yanında." |
| 26,3–29,9 | Bitiş kartı (Odi + Tüy Dede) | **ODİ · Sesin Yolu** · **Yakında yayında** · Takip et, ilk duyan sen ol 🔔 · Tüy Dede’ye selam yaz 👇 | "Odi: Sesin Yolu. Çok yakında!" |

## Ses
Erkek anlatıcı: Chatterbox Multilingual (Resemble AI, MIT lisansı) ile bir kez üretildi ve depoya işlendi (`tools/reels/vo/`);
ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`),
gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan "Perth" filigranı vardır. Müzik özgün sentezdir (`tools/reels/music.py`).

## Gönderi metni
İç kulağın en yaşlı tüy hücresi Tüy Dede ve minik ses Odi’yle tanışın. 👴🎵 Başındaki altın tüyler stereosilya! ODİ: Sesin Yolu yakında yayında.
Tüy Dede’ye yorumlardan selam yaz 👇

#odyoloji #odyolog #odyolojiöğrencisi #işitme #tüyhücresi #stereosilya #koklea #kulak #oyun #mobiloyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel tuy-dede
python3 tools/reels/compose.py --reel tuy-dede
```
