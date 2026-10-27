# Reels: "10 saniyede 3 kulak bilgisi" (16,9 sn, 9:16)

Video: `marketing/reels/10-saniyede.mp4` · Kapak: `marketing/reels/10-saniyede-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -13,7 LUFS, gerçek tepe -3,1 dBTP. Boyut: ≈5,5 MB.

## Fikir
Viral “10 saniyede” biçimi. İlk karede dev sayaç **10,00** ve **“10 saniyede 3 kulak bilgisi”**, “Hazır mısın?”. Sonra sayaç gerçek zamanlı akar (iki ondalık, son 3 saniye kırmızı) ve üç şaşırtıcı bilgi tam 10,00 saniyeye sığar; her bilgi oyundaki karşılığıyla eşleşir ve iki kesmeyle gelir: **1/3 En küçük kemik: üzengi** (Kamp › Kulak Yolu › Üç Kemikçik anıtı → Kulak Kartı “En Küçük Kemik”), **2/3 En küçük iskelet kası: stapedius** (Kulak Kartı “Minik Koruyucu Kas” → 15. bölüm «Üzengi»), **3/3 Sağlıklı kulak kendi sesini üretir** (Kulak Kartı “Kulağın Yankısı” → Tüy Hücresi Demeti anıtı). Sayaç sıfırda zil: **Daha fazlası oyunda!** ve Kulak Kartları albümü, **Yakında**.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–3,0 | Gece zemini | **10,00** · **10 SANİYEDE 3 KULAK BİLGİSİ** · Hazır mısın? | “10 saniyede 3 kulak bilgisi. Hazır mısın?” | vuruş, bip; tik-tak sayımı + yükselen süpürme |
| 3,0–6,3 | Kamp › Kulak Yolu › Üç Kemikçik anıtı (oyunun çizimi) → Kulak Kartı “En Küçük Kemik” (gerçek ekran) | sayaç 10,00 → 6,67 · 1/3 · **EN KÜÇÜK KEMİK: ÜZENGİ** · Üç Kemikçik anıtı | “1: Vücudun en küçük kemiği kulakta. Üzengi!” | vuruş + savrulma; dört vuruşlu koşu başlar |
| 6,3–9,7 | Kulak Kartı “Minik Koruyucu Kas” → 15. bölüm «Üzengi» oynanışı | 6,67 → 3,33 · 2/3 · **EN KÜÇÜK İSKELET KASI: STAPEDİUS** · 15. bölüm «Üzengi»: stapedius üzengiye bağlıdır | “2: En küçük iskelet kası da orada. Stapedius!” | vuruş + savrulma |
| 9,7–13,0 | Kulak Kartı “Kulağın Yankısı” → Tüy Hücresi Demeti anıtı | 3,33 → 0,00 (kırmızı) · 3/3 · **SAĞLIKLI KULAK KENDİ SESİNİ ÜRETİR** · otoakustik emisyon: dış tüy hücreleri | “3: Sağlıklı kulak, kendi çok hafif sesini üretir!” | vuruş + savrulma |
| 13,0–16,9 | Gece zemini; eğik telefon kartında Kulak Kartları albümü | **0,00** · **DAHA FAZLASI OYUNDA!** · Yakında | “Daha fazlası oyunda! Yakında.” | buzzer, gümbürtü, parıltı; son akor |

Bilgiler oyunun Kulak Kartları ve Kulak Sözlüğü'nden (`docs/odyoloji-icerik.md`): “En Küçük Kemik” — üzengi, yaklaşık 3 mm boyuyla vücuttaki en küçük kemiktir (sözlük: Üzengi (stapes), vücudun en küçük kemiği); “Minik Koruyucu Kas” — üzengiye bağlı stapedius, vücudun en küçük iskelet kasıdır, çok yüksek seste kasılır (anlatıcı ve ekran “iskelet kası” der); “Kulağın Yankısı” — sağlıklı bir kulak kendi çok hafif seslerini üretir, bebeklerin işitmesi bununla taranabilir (otoakustik emisyon, dış tüy hücresi işlevinin yan ürünü; Katz, Handbook of Clinical Audiology). Kart ekranları gerçek arayüzden (`tools/reels/cekim4.mjs --only kart`), anıtlar oyunun çizim kodundan (`tools/reels/kamp-cekim.mjs --only anit`). Sayaç dürüsttür: üç bilgi tam 10,00 saniye sürer ve sayaç gerçek zamanlı akar.

## Ses
Müzik: `reklam_ses.py` yeni **“hizli”** stili (La minör, 140 BPM: tik-tak sayımı ve yükselen süpürme → dört vuruşlu elektronik koşu, süpersaw akorları, arpej → son akor). Efektler: vuruş, bip, savrulma, buzzer, gümbürtü, parıltı. Sayaç overlay'in yeni `timer` katmanıdır. Anlatıcı satırları tek tek Whisper ile hatasız. Son karışımın Whisper dökümü metinle aynı; yalnız hızlı okumada müzik altında “çok hafif” birleşik duyuldu (“çokaklis”).

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/10-saniyede/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`); son karışım da
Whisper ile yazıya döküldü.
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendisidir: Kulak Kartları gerçek ekranlardan (yerel kayıtta kartlar açık; `tools/reels/cekim4.mjs`), anıtlar `kamp-cekim.mjs` ile oyunun çiziminden, 15. bölüm botun gerçek koşusundan. Yönetici modu kullanılmadı.

## Gönderi metni (Instagram / TikTok)
10 saniyede 3 kulak bilgisi ⏱️ 1) Vücudun en küçük kemiği kulakta: üzengi (yaklaşık 3 mm). 2) En küçük iskelet kası da orada: üzengiye bağlı stapedius. 3) Sağlıklı kulak kendi çok hafif sesini üretir; bebeklerin işitmesi bununla taranabilir.
Daha fazlası oyunda: ODİ: Sesin Yolu, Kulak Kartları. Yakında! Hangisini biliyordun? 👇

#odyoloji #odyolog #odyolojiöğrencisi #bilgi #biliyormuydun #kulak #işitme #anatomi #mobiloyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/cekim4.mjs --only kart && node tools/reels/kamp-cekim.mjs --only anit
HF_HOME=… nice -n 10 <venv>/bin/python tools/reels/vo.py --only 10-saniyede     # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel 10-saniyede
python3 tools/reels/compose.py --reel 10-saniyede
python3 tools/reels/denetle.py 10-saniyede                                     # kare tabakaları + LUFS/tepe denetimi
```
