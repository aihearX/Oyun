# Reels: "Takımını kur, kulağı fethet" (24,2 sn, 9:16)

Video: `marketing/reels/takimini-kur.mp4` · Kapak: `marketing/reels/takimini-kur-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC, faststart, ≈ −14 LUFS. Boyut: ≈7,2 MB.
Mesaj: sınıfça/arkadaş grubuyla oynanan sosyal özellikler. Ekranlar oyunun gerçek ekranlarıdır (tanıtım çekimindeki örnek
oyuncular: Ayşe, Bora, Cem…); sahte rakip ya da sahte sayı yok. Ses: erkek anlatıcı, altyazılı.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı |
|---|---|---|---|
| 0–2,5 | İşitme Korteksi (37. bölüm) oynanışı | **Sınıfınla takım kurup yarışsanız? 🏁** | "Sınıfınla takım kurup yarışsanız?" |
| 2,5–4,9 | Takım › Takım Yarışı ekranı (3'e 3 / 5'e 5 lobi) | CANLI TAKIM YARIŞI · 3’e 3 ya da 5’e 5 · aynı bölüm, aynı anda | "Canlı takım yarışı: aynı bölüm, aynı anda!" |
| 4,9–6,9 | Takım yarışı sürerken (takım şeridi) | TAKIMIN TURKUAZ, RAKİP PEMBE | |
| 6,9–9,4 | Takım yarışı sonucu | BİTİŞ SIRASI + YILDIZ = TAKIM PUANI | "Önde bitir, takımına puan kazandır!" |
| 9,4–11,7 | Takım › Lig | TAKIM LİGİ · 2 HAFTALIK SEZON · Bronz → Gümüş → Altın → Platin → Koklea | "Ligde Bronz'dan en üst kademeye tırman." |
| 11,7–13,8 | Takım sohbetinde Günün Sorusu | GÜNÜN SORUSU · ÇALIŞMA GRUBU · Çalışma Grubu açıksa sorular odyoloji öğrencisi düzeyinde | "Günün Sorusu'yla birlikte çalışın." |
| 13,8–15,8 | Profil › Birlikte: Usta–Çırak | USTA–ÇIRAK | "Yeni başlayana ustalık et." |
| 15,8–17,8 | Bölge Savaşı haritası | BÖLGE SAVAŞI | "Bölgeleri birlikte fethedin," |
| 17,8–20,4 | 40. bölüm, Gürültü Canavarı'na vuruş | **Gürültü Canavarı’na hep beraber! 👹** | "canavarı hep beraber yenin!" |
| 20,4–24,2 | Bitiş kartı | **ODİ · Sesin Yolu** · **Yakında yayında** · Takımını şimdiden topla 🤝 · Sınıf arkadaşını etiketle 👇 | "Odi: Sesin Yolu. Yakında! Takımını şimdiden topla." |

Kurallar `docs/13-iletisim.md` ve `docs/16-takim-rekabeti.md`'den (3'e 3 / 5'e 5 lobi, 2 haftalık sezon, Bronz → Koklea
kademeleri, Çalışma Grubu = öğrenci düzeyi sorular, puan = bitiş sırası + yıldızlar).

## Ses
Erkek anlatıcı: Chatterbox Multilingual (Resemble AI, MIT lisansı) ile bir kez üretildi ve depoya işlendi (`tools/reels/vo/`);
ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`),
gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan "Perth" filigranı vardır. Müzik özgün sentezdir (`tools/reels/music.py`).

## Gönderi metni
Sınıfınla takım kurup yarışsanız? 🏁 Canlı Takım Yarışı, Takım Ligi, Günün Sorusu ile çalışma grubu ve usta–çırak: ODİ: Sesin Yolu yakında yayında.
Takımını şimdiden topla, sınıf arkadaşını etiketle 👇

#odyoloji #odyolojiöğrencisi #odyolog #işitme #kulak #takım #sınıf #mobiloyun #oyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel takimini-kur
python3 tools/reels/compose.py --reel takimini-kur
```
