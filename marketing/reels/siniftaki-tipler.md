# Reels: "Odyoloji sınıfındaki 5 tip" (@@SURE@@ sn, 9:16)

Video: `marketing/reels/siniftaki-tipler.mp4` · Kapak: `marketing/reels/siniftaki-tipler-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 High yuv420p + AAC 48 kHz stereo, faststart, @@LUFS@@ LUFS, gerçek tepe @@TP@@ dBTP. Boyut ≈@@MB@@ MB.
6. dalga (öğrenci içeriği, A bölümü). Yayından önce paylaşılabilir ("Çok yakında").

## Fikir
"Her sınıfta bir tane vardır" kalıbı, odyoloji sınıfına özel. Beş tip, beş Odi çeşidi (gerçek kişi yok; kurgusal karakter Odi'nin
yüz ifadeleri ve aksesuarları): yıldız gözlü diyapazon hayranı, gözlüklü maskeleme anlatıcısı, her eğriye "TİP A" damgası basan,
sembolleri ezberlemiş kartçı, saat 03.00'te kahveyle çalışan. Her tip ~3 sn: büyük numara, sahne, espri cümlesi, küçük alt not.
Sonda beşinin ızgarası + "Sen hangisisin?" kutusu: "Sınıfında hangisi var? Etiketle."

## Neden paylaşılır
- Etiketleme: herkesin sınıfında bu tiplerden biri var; izleyen arkadaşını etiketler ("bu tam sen").
- Ders esprileri yalnız odyoloji okuyanların anlayacağı ayrıntılarda (maskeleme, Tip A/Tip B, O X < > [ ]).
- Son ızgara karesi hikâyede tek başına anlamlı.

## Sahne akışı
@@TABLO@@

## İçerik notları ve kaynaklar
- Maskeleme tahtası: "Test edilmeyen kulağa gürültü: çapraz işitmeyi önle!" (Katz, *Handbook of Clinical Audiology*, klinik
  maskeleme; `docs/odyoloji-icerik.md` › maskeleme). Sayı verilmedi.
- "Her timpanogramı Tip A sanan": eğri ekranda dümdüz çizilir ve damga "TİP A" der; alt not şakayı düzeltir: "(o eğri dümdüz…
  Tip B)". Jerger sınıflaması: düz eğri Tip B (Katz, timpanometri).
- Sembol kartları ASHA odyogram simgeleri: sağ hava yolu O (kırmızı), sol hava yolu X (mavi), maskesiz kemik yolu < >, maskeli
  kemik yolu [ ] (Katz, saf ses odyometrisi; ASHA 1990 simgeleri).
- Diyapazon üzerinde 512 Hz (Rinne/Weber için yaygın çatal; Katz, diyapazon testleri).
- "Sınavdan bir gece önce başlayan": saat 03.00'ten akar, kupa "x4". Tıbbi iddia yok.
- Karakterler kurgusal (Odi); gerçek kişi, isim, yüz yok.

## Ses
Müzik: `reklam_ses.py` "komedi" stili (Fa majör, tuba + pizzicato, 112 BPM: sessiz kanca → oynak → parlak → final). Efektler: vuruş,
cızırtı, boing, savrulma, pop, damga + bonk, kâğıt, tik-tak, zil, karalama. Anlatıcı: projenin onaylı erkek Türkçe sesi
(Chatterbox Multilingual, MIT; sentetik referans). Satırlar ekrandaki yazıyla aynı ve bir cümle gibi akar: "…götüren, …anlatan, …sanan, sembolleri çoktan ezberleyen, ve …başlayan."

Whisper large-v3-turbo denetimi:
@@WHISPER@@

## Gönderi metni (Instagram / TikTok)
Odyoloji sınıfındaki 5 tip 😄
1) Diyapazonu her yere götüren
2) Herkese maskelemeyi anlatan
3) Her timpanogramı "Tip A" sanan
4) Odyogram sembollerini çoktan ezberleyen
5) Sınavdan bir gece önce başlayan
Sınıfında hangisi var? Etiketle 👇 (Karakterler kurgusaldır.)

#odyoloji #odyolojiöğrencisi #odyolog #üniversite #sınıf #öğrencihayatı #vize #odisesinyolu

Paylaşım zamanı önerisi: pazartesi ya da salı akşamı 20.00–22.00 (hafta başı ders sohbeti) ya da vize haftasının hemen öncesi.

## Yeniden üretmek
```
HF_HOME=/home/user/ses-ortam/hf nice -n 5 /home/user/ses-ortam/venv/bin/python tools/reels/vo.py --only siniftaki-tipler
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel siniftaki-tipler
python3 tools/reels/compose.py --reel siniftaki-tipler
python3 tools/reels/denetle.py siniftaki-tipler --asr /home/user/ses-ortam/venv/bin/python
```
Sahneler ve çizimler: `tools/reels/reklamlar6.mjs`.
