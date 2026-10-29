# Reels: "Akrabalara 'odyoloji okuyorum' deyince" (24,4 sn, 9:16)

Video: `marketing/reels/akrabalar-odyoloji.mp4` · Kapak: `marketing/reels/akrabalar-odyoloji-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 High yuv420p + AAC 48 kHz stereo, faststart, −13,9 LUFS, gerçek tepe −3,9 dBTP. Boyut ≈2,5 MB.
6. dalga (öğrenci içeriği, A bölümü). Yayından önce paylaşılabilir ("Çok yakında").

## Fikir
Her odyoloji öğrencisinin yaşadığı aile grubu sahnesi. Genel tasarımlı bir sohbet ekranında (hiçbir mesajlaşma uygulamasının
taklidi değil: kendi renklerimiz, baş harfli yuvarlak avatarlar, "Aile grubu" başlığı) sen "Odyoloji okuyorum" yazarsın; ardından
akrabalar birer birer klasik sorularla gelir, Odi her birine yüz ifadesiyle tepki verir ("…", "Hı hı.", "Yok.", "Değil."). Sonra
"Sen yazıyor…" ve büyük, gururlu cevap balonu: **"Odyoloji; işitme ve dengeyi değerlendiren, rehabilite eden ve koruyan bilim
dalıdır."** Ardından amcaya küçük bir not: "Kulak çınlaması da konumuz: önce odyolojik değerlendirme." Kapanış çağrısı: "Sen de
duydun mu? Arkadaşına gönder."

## Neden paylaşılır
- Ortak dert: bölümü akrabalara anlatmak; izleyen "aynısı" deyip arkadaşına gönderir.
- Gururlu, doğru tanım: öğrencinin bir dahaki aile sofrasında kullanabileceği tek cümle (kaydetme sebebi).
- Açık tetikleyici: "Sen de duydun mu? Arkadaşına gönder."

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses |
|---|---|---|---|---|
| 0,0–3,1 | Sohbet ekranı ("Aile grubu", baş harfli avatarlar), karartılmış | AKRABALARA **"ODYOLOJİ OKUYORUM"** DEYİNCE · senin balonun: "Odyoloji okuyorum" | "Akrabalara odyoloji okuyorum deyince…" | vuruş, yazma tıkırtısı, bildirim |
| 3,1–5,6 | "yazıyor…" → Teyze balonu; Odi yan bakış | Teyze: Kulak mı temizliyorsun? · Odi: "…" | — | lofi ritim girer; pop + zil, cızırtı |
| 5,6–8,1 | Amca balonu; Odi şaşkın, terli | Amca: Benim de kulağım çınlıyor, bir bak · "Hı hı." | — | pop + zil, boing |
| 8,1–10,6 | Hala balonu; Odi uykulu | Hala: Cihaz mı satıyorsun? · "Yok." | — | pop + zil, bonk |
| 10,6–13,1 | Dayı balonu; Odi kaygılı | Dayı: Kulak burun boğaz gibi bir şey mi? · "Değil." | — | pop + zil, trombon |
| 13,1–19,4 | "Sen yazıyor…" → büyük altın cevap balonu; yıldız gözlü Odi; ikinci küçük balon | **Odyoloji;** işitme ve dengeyi **değerlendiren, rehabilite eden** ve **koruyan** bilim dalıdır. · GURURLA. · Kulak çınlaması da konumuz: önce odyolojik değerlendirme. | "Odyoloji; işitme ve dengeyi değerlendiren, rehabilite eden ve koruyan bilim dalıdır." | parıltı; müzik kalkar |
| 19,4–22,5 | Cevap balonu karartılır | **SEN DE DUYDUN MU?** · Arkadaşına gönder | "Sen de duydun mu? Arkadaşına gönder." | savrulma, pop |
| 22,5–24,4 | Kapanış kartı | ODİ: Sesin Yolu · Odyoloji camiası için yapıldı · Çok yakında · App Store ve Google Play'de · Takip et + | — | boom, parıltı |

Anlatıcı yalnız kanca, tanım ve çağrıda; akraba replikleri anlatıcıyla okunmaz (tek erkek ses dört akrabayı inandırıcı taşıyamazdı;
balonlar + bildirim sesi + Odi'nin tepkisi "meme" ritmini taşıyor). Bütün metin ekranda.

## İçerik notları ve kaynaklar
- Tanım: "Odyoloji; işitme ve dengenin değerlendirilmesi, rehabilitasyonu ve korunmasıyla ilgilenen bilim dalıdır."
  (`docs/odyoloji-icerik.md` › Odyolog / Odyoloji Merkezi; Katz, *Handbook of Clinical Audiology*, giriş).
- "Kulak çınlaması da konumuz: önce odyolojik değerlendirme." Tinnitus değerlendirmesinde odyolojik testler kullanılır
  (`docs/odyoloji-icerik.md` › Kulak çınlaması; Katz, tinnitus). Tıbbi öneri değil, yönlendirme.
- Akrabalar rol adıdır (Teyze, Amca, Hala, Dayı); gerçek kişi, isim, yüz yok. Sohbet arayüzü genel tasarım, marka taklidi yok.

## Ses
Müzik: `reklam_ses.py` "lofi" stili (Mi bemol majör 7'liler, 96 BPM: sessiz kanca → tozlu ritim → cevapta kalkış → final).
Efektler: yazma tıkırtısı, bildirim pop + zil, cızırtı, boing, bonk, trombon (tepkiler), parıltı. Anlatıcı: projenin onaylı erkek
Türkçe sesi (Chatterbox Multilingual, MIT; sentetik referans).

Whisper large-v3-turbo denetimi:
- Satırlar (tek tek, `tools/reels/vo/secim.json`): e1, e2, e3 hata 0.
- Son karışım (birebir): "Akrabalara odyoloji okuyorum deyince" · "Odyoloji, işitme ve dengeyi değerlendiren, rehabilite eden ve
  koruyan bilim dalıdır." · "Sen de duydun mu? Arkadaşına gönder." "Odyoloji" kelimesinin altında müzik ve efekt ayrıca kısılır (`dip`).

## Gönderi metni (Instagram / TikTok)
Akrabalara "odyoloji okuyorum" deyince 😅
"Kulak mı temizliyorsun?" "Benim de kulağım çınlıyor, bir bak." "Cihaz mı satıyorsun?" "Kulak burun boğaz gibi bir şey mi?"
Cevap: Odyoloji; işitme ve dengeyi değerlendiren, rehabilite eden ve koruyan bilim dalıdır. (Kulak çınlaması da konumuz: önce odyolojik değerlendirme.)
Sen de duydun mu? Arkadaşına gönder 👇

#odyoloji #odyolojiöğrencisi #odyolog #akrabalar #aile #üniversite #işitme #odisesinyolu

Paylaşım zamanı önerisi: bayram/tatil öncesi ya da pazar akşamı 19.00–21.00 (aile buluşmalarının olduğu günler).

## Yeniden üretmek
```
HF_HOME=/home/user/ses-ortam/hf nice -n 5 /home/user/ses-ortam/venv/bin/python tools/reels/vo.py --only akrabalar-odyoloji
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel akrabalar-odyoloji
python3 tools/reels/compose.py --reel akrabalar-odyoloji
python3 tools/reels/denetle.py akrabalar-odyoloji --asr /home/user/ses-ortam/venv/bin/python
```
Sahneler ve çizimler: `tools/reels/reklamlar6.mjs`.
