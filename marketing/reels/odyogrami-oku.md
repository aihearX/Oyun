# Reels: "Bu odyogramı 5 saniyede oku" (@@SURE@@ sn, 9:16)

Video: `marketing/reels/odyogrami-oku.mp4` · Kapak: `marketing/reels/odyogrami-oku-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 High yuv420p + AAC 48 kHz stereo, faststart, @@LUFS@@ LUFS, gerçek tepe @@TP@@ dBTP. Boyut ≈@@MB@@ MB.
6. dalga (öğrenci içeriği, A bölümü). Yayından önce paylaşılabilir ("Çok yakında").

## Fikir
Üç turlu hız quizi. Her turda gerçek bir odyogram formu gibi beyaz kartta (ASHA simgeleri, frekans üstte 250–8000 Hz, dB HL aşağı
doğru artar, bir oktav = 20 dB oranı) bir desen çizilir; sağ üstte büyük **5-4-3-2-1** sayacı ve azalan çubuk, her saniye bip, sonda
buzzer. Ardından cevap **bulgu** olarak çakılır ("… ile uyumlu"), grafiğin üstünde vurgu (çentik halkası, hava–kemik aralığı
köşeli ayracı, eğim oku). Sonda "Kaçını bildin?" + "Cevabını yorumlara yaz".

## Neden paylaşılır
- Meydan okuma: 5 saniyelik sayaç izleyiciyi durdurur; cevabı yorumlara yazdırır ("3/3!").
- Sınav değeri: üç klasik desen (gürültü çentiği, iletim bileşeni, sensörinöral eğim) tek videoda; "sınavdan önce kaydet" içeriği.
- Doğru gösterim: simgeler ve eksenler ders kitabındaki gibi; öğrenciler grafiği ekran görüntüsü alıp paylaşabilir.

## Turlar ve kaynaklar
| Tur | Çizilen desen (dB HL) | Ekrandaki bulgu | Kaynak |
|---|---|---|---|
| 1 | İki kulak hava yolu: 250–2k 10–25, 3k 40–45, **4k 55–60**, 6k 45–50, 8k 25–30 | 4 kHz'te çentik, 8 kHz'te kısmi düzelme → **Gürültüye maruz kalmakla uyumlu** | Katz, *Handbook of Clinical Audiology*, gürültüye bağlı işitme kaybı (3–6 kHz, sıklıkla 4 kHz çentik, 8 kHz'te düzelme); `docs/odyoloji-icerik.md` |
| 2 | Sağ hava yolu 35–40, sağ **maskeli** kemik yolu [ 5; sol hava yolu 10–20 | Sağda hava–kemik aralığı (≈30 dB): kemik yolu iyi, hava yolu düşük → **İletim tipi bileşenle uyumlu** | Katz, saf ses ve kemik yolu odyometrisi (aralık > ~10 dB iletim tipi); `docs/odyoloji-icerik.md` › Hava yolu ve kemik yolu |
| 3 | İki kulak hava yolu 15–20 → 70–75 (tize doğru inen); maskesiz kemik yolu < > hava yoluyla aynı | Tize doğru inen kayıp, hava–kemik aralığı yok → **Sensörinöral tiple uyumlu** | Katz, odyogram yorumu (iletim / sensörinöral / mikst ayrımı); `docs/odyoloji-icerik.md` |

Simgeler (ASHA 1990; Katz): sağ hava yolu kırmızı **O**, sol hava yolu mavi **X**, maskesiz kemik yolu sağ **<** sol **>**,
maskeli kemik yolu sağ **[** sol **]**; kemik yolu simgeleri birleştirilmez, hava yolu simgeleri düz çizgiyle birleştirilir; kemik
yolu 4 kHz'e kadar. Kartın altında yalnız o grafikte kullanılan simgelerin açıklaması.
Her cevap bulgu olarak verilir (tanı değil); son kartta: "Odyogram deseni bir bulgudur; tanıyı öykü ve bütün testler birlikte koyar."
Sayılar örnek desenlerdir, gerçek hasta verisi değildir.

## Sahne akışı
@@TABLO@@

## Ses
Müzik: `reklam_ses.py` "yarisma" stili (Si bemol majör yarışma programı, 120 BPM: fanfar → tik-tak düşünme → parlak açılış →
final; saniye = 2 vuruş, bip sesleri saniyelere oturur). Efektler: vuruş, boru, davul gürlemesi, savrulma, karalama, bip, buzzer,
zil, alkış, boom, parıltı. Ses tonları yok (işitme testi değildir). Anlatıcı: projenin onaylı erkek Türkçe sesi (Chatterbox
Multilingual, MIT; sentetik referans).

Whisper large-v3-turbo denetimi:
@@WHISPER@@

## Gönderi metni (Instagram / TikTok)
Bu odyogramı 5 saniyede oku ⏱️
1) İki kulakta 4 kHz'te çentik, 8 kHz'te kısmi düzelme → gürültüye maruz kalmakla uyumlu
2) Sağda hava–kemik aralığı (maskeli kemik yolu iyi, hava yolu düşük) → iletim tipi bileşenle uyumlu
3) Tize doğru inen kayıp, aralık yok → sensörinöral tiple uyumlu
Simgeler (ASHA): O sağ hava yolu, X sol hava yolu, < > maskesiz kemik yolu, [ ] maskeli kemik yolu. Odyogram deseni bir bulgudur; tanıyı öykü ve bütün testler birlikte koyar.
Kaçını bildin? Cevabını yorumlara yaz 👇 Sınavdan önce kaydet.

#odyoloji #odyogram #odyolojiöğrencisi #odyolog #işitmekaybı #odyometri #quiz #odisesinyolu

Paylaşım zamanı önerisi: hafta içi 12.00–13.00 (öğle arası quiz) ya da final/vize haftasından 1–2 hafta önce ("kaydet" etkisi).

## Yeniden üretmek
```
HF_HOME=/home/user/ses-ortam/hf nice -n 5 /home/user/ses-ortam/venv/bin/python tools/reels/vo.py --only odyogrami-oku
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel odyogrami-oku
python3 tools/reels/compose.py --reel odyogrami-oku
python3 tools/reels/denetle.py odyogrami-oku --asr /home/user/ses-ortam/venv/bin/python
```
Odyogram çizimi: `tools/reels/reklamlar6.mjs › audiogram()`.
