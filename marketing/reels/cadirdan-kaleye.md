# Reels: "Çadırdan kaleye" (28,5 sn, 9:16)

Video: `marketing/reels/cadirdan-kaleye.mp4` · Kapak: `marketing/reels/cadirdan-kaleye-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -14,0 LUFS, gerçek tepe -3,0 dBTP. Boyut: ≈12,9 MB.

## Fikir
Doyurucu bir zaman atlaması. İlk kare: çizgili bir kulak kepçesi çadırı ve dev yazı **“Bir çadırla başladı.”** Sonra her vuruşta bir seviye: Odyoloji Merkezi Sv 1’den Sv 25’e, oyunun gerçek kamp sahnesinde, sabit kadrajda büyür (çevredeki binalar, süsler ve gezen tüy hücresi yardımcıları da onunla birlikte). Kademe değişiminde damga: Ahşap → Taş → Tuğla → Metal → Altın → Kristal → Efsane; her seviyede yükselen bir çan. Anlatıcı yalnız dönüm noktalarında konuşur: “Sonra bir kale oldu.” (tuğla kale, Sv 7) · “Sonra bir kampüs.” (mor kubbeli altın saray, Sv 13) · “Ve sonunda, bir efsane!” (Sv 21). Sv 25’te kamera, oyunun gerçek yakınlaştırma basamaklarıyla geri çekilir: ada, köprüler ve beş bölge görünür, adları tek tek belirir. Süsle ekranı ve “Kampını gez · Alkış!” ile kapanış: **Kampını büyüt.**

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–1,5 | Kamp önizlemesi, Odyoloji Merkezi Sv 1 (kulak kepçesi çadırı), hafif yakınlaşma | **BİR ÇADIRLA BAŞLADI.** | “Bir çadırla başladı.” | boom (yumuşak), çan |
| 1,5–5,5 | Zaman atlaması Sv 2–9: odyogram panosu, diyapazon kulesi, taş merkez, kulak çeşmesi, sol kanat, tuğla kale, saat kulesi, flamalı kapı; her vuruşta darbe yakınlaşması | Odyoloji Merkezi · **Sv N** · kademe: Ahşap → Taş → Tuğla | “Sonra bir kale oldu.” | her vuruşta yükselen çan; kademe değişiminde savrulma + damga |
| 5,5–11,0 | Sv 10–20: metal merkez, sağ kanat, ABR çanak anten, altın saray, gözlem kubbesi, tüy hücresi heykelleri, kristal dikilitaşlar, süzülen kristal halka, ışık sütunları, kristal taç, dev kristal kule | **Sv N** · Metal → Altın → Kristal | “Sonra bir kampüs.” | çanlar (oktav yükselir), damga |
| 11,0–15,0 | Sv 21–25 Efsane: altın iğne, altın koklea mozaiği, altın tüy hücresi heykeli, yaldız, sancaklar; Sv 25’te parlama ve yavaş yakınlaşma | **Sv 25 · EFSANE** | “Ve sonunda, bir efsane!” | çanlar, parlama, sarsıntı |
| 15,0–21,0 | Gerçek yakınlaştırma basamaklarıyla geri çekilme (her biri ×0,9): ana ada, köprüler, beş bölge (Kamp Sv 30 önizlemesi) | **Kamp Seviyesi 30** · Sessiz Koru · Koklea Koyu · Denge Tepesi · Araştırma Yerleşkesi · Kulak Kılı Ormanı | “Köprüleri kur, beş bölgeyi aç.” | uzun savrulma, etiket başına “pop”, parıltı |
| 21,0–24,5 | Eğik telefon kartı: Kamp › Süsle kipi (envanter: Odyogram Çiçek Tarhı, Stereosilya Çimi, Kemikçik Bankı, Otoskop Lambası) | **SÜSLE** · Kampını gez · Alkış! | “Süsle, arkadaşına kampını gezdir.” | savrulma, pop |
| 24,5–28,5 | Bitiş kartı: Odi, logo | Yakında · Çadırdan kaleye: **kampını büyüt** | “Kampını büyüt. ODİ: Sesin Yolu. Yakında!” | boom + parıltı, final akoru |

Bilgiler `docs/14-kamp.md`’den: Kamp Seviyesi 1–30, beş bölge ve açıldıkları Kamp Sv (Sessiz Koru 3, Koklea Koyu 6, Denge Tepesi 12, Araştırma Yerleşkesi 16, Kulak Kılı Ormanı 20), Odyoloji Merkezi’nin her seviyede aldığı parça (§11 tablosu) ve kademe adları, Süsle kipi, Kampını gez + alkış (§13). Görüntüler `?demo=kamp&seviye=1..25&kampsv=…` önizlemesinden (yalnız oyun tuvali; önizleme etiketi ve üst bant gizli); seviyeler sırayla aynı kamera konumundan çekildi (`tools/reels/kamp-cekim.mjs --only zaman,ada`). Sayaç, puan, oyuncu sayısı ya da tarih yok.

## Ses
Müzik: `reklam_ses.py` yeni **“kur”** stili (Re majör, 120 BPM: pırıltılı arpej girişi → dört vuruşlu büyüme → bakır ve süpersaw ile yükseliş → geniş, havadar geri çekilme → final akoru). Her seviye vuruşunda Re majör dizisinde yükselen bir çan (yeni “chime” efekti); kesmeler vuruş ızgarasında. Efektler: boom, çan, savrulma, damga, pop, parıltı.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/cadirdan-kaleye/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`); son karışım da
Whisper ile yazıya döküldü.
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendi çizimleri ve gerçek ekranlarıdır
(`tools/reels/kamp-cekim.mjs` çeker, `tools/reels/hazirla3.py` kare dizisine çevirir); oyuncu verisi yok (kamp önizlemesi yerel örnek
durum; klinik ve oyun ekranları bellek içi sunucuda tek bir örnek oyuncuyla), yönetici modu kullanılmadı.

## Gönderi metni (Instagram / TikTok)
Bir çadırla başladı. 🏕️ Sonra bir kale oldu, sonra bir kampüs… ve sonunda bir efsane. Odyoloji Merkezi her seviyede gözle görülür biçimde büyür; köprüleri kur, beş bölgeyi aç, kampını süsle, arkadaşına gezdir.
ODİ: Sesin Yolu yakında. Kampın hangi seviyede olurdu? 👇

#odyoloji #odyolog #odyolojiöğrencisi #işitme #kulak #kamp #şehirkurma #mobiloyun #oyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/kamp-cekim.mjs --only zaman,ada,susle   # oyun ekranları
python3 tools/reels/hazirla3.py                                                     # kare dizileri
HF_HOME=… nice -n 5 <venv>/bin/python tools/reels/vo.py --only cadirdan-kaleye     # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel cadirdan-kaleye
python3 tools/reels/compose.py --reel cadirdan-kaleye
python3 tools/reels/denetle.py cadirdan-kaleye                                     # kare tabakaları + LUFS/tepe denetimi
```
