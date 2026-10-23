# Reels: "Sınav gecesi" (25,3 sn, 9:16)

Video: `marketing/reels/sinav-gecesi.mp4` · Kapak: `marketing/reels/sinav-gecesi-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -13,9 LUFS, gerçek tepe -1,9 dBTP. Boyut: ≈6,7 MB.

## Fikir
Odyoloji öğrencileri için bir skeç. Gece 03.00, kırmızı dijital saat tik-takla yanıp söner: “Sınav sabah dokuzda.” Saat hızla akarken ekrana not kâğıtları yağar (örs, çekiç, üzengi, koklea, Corti, tonotopi, stria vaskülaris, Heschl, Tip B?, oval pencere, baziler membran, stereosilya, dB HL, OAE), müzik gerildikçe görüntü titrer. Plak cızırtısı → siyah ekranda **DUR.** → “Ya oynayarak öğrenseydin?” Müzik neşeli bir ritme döner: çekiç, örs, üzengi bölümleri vuruş vuruş, Kulak Sözlüğü, 50 Kulak Kartı, 128 soru. Sabah 09.00: saat sakin turkuaz, ekrana Tüy Dede düşer. Espri: “Corti mi? Eski dost.” (Tüy Dede, Corti organındaki bir tüy hücresidir.)

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–1,9 | Gece masası, kırmızı dijital saat 03:00 (iki nokta yanıp söner) | **03:00** · **SINAV: 09.00** | “Gece üç. Sınav sabah dokuzda.” | tik-tak, alçak uğultu, gümbürtü |
| 1,9–6,6 | Not kâğıtları dört yandan uçup üst üste yığılır; köşedeki saat hızla akar (03:00 → 07:00), görüntü titrer | Örs · Çekiç · Üzengi · Koklea · Corti · Tonotopi · Stria vaskülaris · Heschl · Tip B? · Oval pencere · Baziler membran · Stereosilya · dB HL · OAE | “Örs mü, çekiç mi? Corti nerede?” “Tonotopi neydi?” | panik: yükselen 16'lık yaylılar, dört vuruş davul, hızlanan tik-tak, kâğıt hışırtıları |
| 6,6–7,5 | Siyah | **DUR.** (damga) |  | plak cızırtısı → sessizlik |
| 7,5–9,8 | Gece arka planı, Odi yukarıdan düşer | **YA · OYNAYARAK · ÖĞRENSEYDİN?** (kelime kelime) | “Ya oynayarak öğrenseydin?” | pop ×3 + boing |
| 9,8–12,7 | Çekiç (13. bölüm: kanca), Örs (14), Üzengi (15: çakılma) — vuruş başına kesme | **ÇEKİÇ** malleus · **ÖRS** inkus · **ÜZENGİ** stapes | “Çekiç, örs, üzengi: zıpla, sallan, çakıl!” | yükselen süpürme → neşeli groove başlar; her kesmede vuruş |
| 12,7–15,0 | Kulak Sözlüğü ekranı (eğik telefon kartı) | **KULAK SÖZLÜĞÜ** · Önce sade · sonra “Daha fazla” | “Her terim önce sade, sonra derin.” | savrulma |
| 15,0–16,9 | Kulak Kartları albümü | **50 KART** | “50 Kulak Kartı topla.” | savrulma + parıltı |
| 16,9–19,2 | Kulak Bilgi Yarışması sorusu | **128 SORU** | “128 soruyla kendini sına.” | savrulma + doğru cevap zili |
| 19,2–22,0 | Sabah masası, turkuaz saat 09:00, Tüy Dede düşer | **09:00** · **ESKİ DOST.** · Tüy Dede: Corti organında bir tüy hücresi | “Sabah dokuz. Corti mi? Eski dost.” | zil + parıltı |
| 22,0–25,3 | Bitiş kartı: Odi, logo, “Yakında” | Sınav arkadaşını **etiketle** | “ODİ: Sesin Yolu. Yakında!” | final akoru |

Sayılar `docs/odyoloji-icerik.md`'den: 39 sözlük terimi (sade + “Daha fazla”), 50 Kulak Kartı, 128 quiz sorusu (66 Meraklı, 62 Odyoloji). Not kâğıtlarındaki terimlerin hepsi oyunun sözlük/kart/soru içeriğinde geçer. Reklam ders çalışmanın yerine geçtiğini iddia etmez; espri “Corti'yi oyunda zaten tanıyorsun” üzerinedir.

## Ses
Müzik: `reklam_ses.py` “panik” stili (Do minör gerilim: tik-tak → yükselen 16'lık yaylılar; plak cızırtısıyla kesilir → Do majör neşeli groove → final akoru), 128 BPM, kesmeler vuruş ızgarasında. Efektler: tik/tak, kâğıt hışırtısı, plak cızırtısı, pop, boing, yükselen süpürme, vuruş, zil, parıltı.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/sinav-gecesi/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`).
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendi çizimleri ve gerçek ekranlarıdır.

## Gönderi metni (Instagram / TikTok)
Gece üç. Sınav sabah dokuzda. Örs mü çekiç mi, Corti nerede? 😵‍💫
Ya oynayarak öğrenseydin? Kemikçikleri zıplayarak, terimleri Kulak Sözlüğü’nde, 50 Kulak Kartı ve 128 soruyla. ODİ: Sesin Yolu yakında!
Sınav arkadaşını etiketle 👇

#odyoloji #odyolojiöğrencisi #odyolog #sınavhaftası #vize #final #işitme #anatomi #koklea #oyun #yakında #odisesinyolu

## Yeniden üretmek
```
HF_HOME=… nice -n 5 <venv>/bin/python tools/reels/vo.py --only sinav-gecesi      # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel sinav-gecesi
python3 tools/reels/compose.py --reel sinav-gecesi
python3 tools/reels/denetle.py sinav-gecesi                                     # kare tabakaları + LUFS/tepe denetimi
```
