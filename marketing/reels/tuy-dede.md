# Reels: "Tüy Dede'yle tanışın" (28,3 sn, 9:16)

Video: `marketing/reels/tuy-dede.mp4` · Kapak: `marketing/reels/tuy-dede-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC, faststart, ≈ −14 LUFS. Boyut: ≈7,8 MB.
Karakter Reels'i: anlatıcı Tüy Dede kendi kayıtlı sesiyle (`apps/web/public/voice/*.mp3`) hikâyeyi anlatıyor; ağzı sesin
genliğine göre oynuyor. Tüy Dede ve Odi çizimleri oyundaki SVG'lerin (`ftue/Narrator.tsx`, `TitleScreen.tsx`) aynısı.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Ses (Tüy Dede, altyazılı) |
|---|---|---|---|
| 0–5,8 | Büyük Tüy Dede portresi, konuşuyor | **Bu dede bir tüy hücresi! 👀** · Başındaki altın tüyler: basamak basamak dizilmiş **stereosilya** | "Merhaba! Ben Tüy Dede, iç kulağın en yaşlı tüy hücresiyim. Seni bekliyordum." |
| 5,8–7,7 | Odi | BU ODİ: MİNİK BİR SES | "Bu Odi: minik bir ses. Annesinin ninnisini taşıyor." |
| 7,7–9,9 | 4. bölüm oynanışı | GÖREVİ: NİNNİYİ BEYNE TAŞIMAK 🎵 | ↑ |
| 9,9–12,4 | 20. bölüm, Serumen Golemi | **Serumen Golemi** · kanalın sonunda | "Ama Büyük Sessizlik geliyor! Gürültü canavarları kulağın ışıklarını söndürüyor." |
| 12,4–15 | 40. bölüm, Gürültü Canavarı | **Gürültü Canavarı** · son kapı | ↑ |
| 15–18 | Kamp: yeni anıt yükseliyor (Üç Kemikçik) | KAMPINDA BÖLGE ANITLARI | "Tüy hücresi anıtı geldi! Benim akrabalarım: sesle eğilir ve elektrik sinyalini başlatırlar." |
| 18–21 | Kamp Sv 15, on anıt | KULAK KEPÇESİNDEN HESCHL’E 10 ANIT | ↑ |
| 21–24,7 | Tüy Dede ve Odi yan yana | YALNIZ DEĞİLSİN 🤝 | "Yalnız değilsin: arkadaşların ve takımın yardım eder." |
| 24,7–28,3 | Bitiş kartı (Odi + Tüy Dede) | **ODİ · Sesin Yolu** · **Yakında yayında** · Takip et, ilk duyan sen ol 🔔 · Tüy Dede’ye selam yaz 👇 | müzik finali (müzik kutusu) |

## Gönderi metni
İç kulağın en yaşlı tüy hücresi Tüy Dede ve minik ses Odi’yle tanışın. 👴🎵 Başındaki altın tüyler stereosilya! ODİ: Sesin Yolu yakında yayında.
Tüy Dede’ye yorumlardan selam yaz 👇

#odyoloji #odyolog #odyolojiöğrencisi #işitme #tüyhücresi #stereosilya #koklea #kulak #oyun #mobiloyun #yakında #odisesinyolu

Ses: Tüy Dede kayıtları Coqui TTS, Fatih Akademi Türkçe modeli (MIT) ile üretildi (`docs/anlatici-metinleri.md`); müzik özgün sentez.

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel tuy-dede
python3 tools/reels/compose.py --reel tuy-dede
```
