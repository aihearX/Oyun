# Reels: "Eğri yarışması" (34,2 sn, 9:16)

Video: `marketing/reels/egri-yarismasi.mp4` · Kapak: `marketing/reels/egri-yarismasi-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -14,1 LUFS, gerçek tepe -1,7 dBTP. Boyut: ≈10,6 MB.

## Fikir
Yarışma programı enerjisi: mor stüdyo, dönen ışık huzmeleri, ampul dizileri, bakır fanfar, davul gürlemesi. **“3 saniyede söyle! Bu eğri ne anlatıyor?”** Dört hızlı tur: dev timpanogram çizilir, 3-2-1 halkası geri sayar, zil çalar; cevap **bulgu** olarak çakılır (tanı değil): Tip A — tepe 0 daPa civarında, zar rahat hareket ediyor · Tip B — düz eğri, kanal hacmi normal, zar hareket etmiyor · Tip C — tepe −200 daPa, orta kulak basıncı negatif · Tip B — düz eğri, kanal hacmi büyük (3,2 ml). Ardından oyunun gerçek Timpanogram Eşleştir ekranı ve ders: **“Eğri ipucu verir. Tanıyı bütün testler birlikte koyar.”** Kapanış: **Timpanogram Eşleştir · 88 soru seni bekliyor.**

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–2,3 | Stüdyo; timpanogram çizilir | **3 SANİYEDE SÖYLE!** · Bu eğri ne anlatıyor? | “Üç saniyede söyle: bu eğri ne anlatıyor?” | vuruş, boru, davul gürlemesi; fanfar |
| 2,3–8,4 | Tur 1: Tip A eğrisi (tepe 0 daPa, admitans 0,9 ml, kanal hacmi 1,2 ml); 3-2-1 halkası → cevap | 1/4 · **TİP A** · Tepe 0 daPa civarında · zar rahat hareket ediyor | “Tepe sıfıra yakın: zar rahat hareket ediyor.” | tik-tak “düşünme” müziği, buzzer → zil + alkış |
| 8,4–14,5 | Tur 2: Tip B, kanal hacmi 1,1 ml | 2/4 · **TİP B** · Düz eğri · kanal hacmi normal · zar hareket etmiyor | “Dümdüz! Zar hareket etmiyor, kanal hacmi normal.” | aynı düzen |
| 14,5–20,6 | Tur 3: Tip C (tepe −200 daPa) | 3/4 · **TİP C** · Tepe −200 daPa · orta kulak basıncı negatif | “Tepe eksi tarafta: orta kulak basıncı düşük.” | aynı düzen |
| 20,6–26,7 | Tur 4: Tip B, kanal hacmi 3,2 ml | 4/4 · **TİP B** · Düz eğri · kanal hacmi büyük · 3,2 ml: normalin çok üstünde | “Yine düz, ama bu kez kanal hacmi büyük!” | aynı düzen |
| 26,7–30,5 | Eğik telefon kartı: Timpanogram Eşleştir › “Kısa vaka” sorusu (öykü + eğri + otoskopi) | **EĞRİ İPUCU VERİR.** · Tanıyı bütün testler birlikte koyar: öykü, otoskopi, odyogram… | “Eğri ipucu verir. Tanıyı bütün testler birlikte koyar.” | savrulma, zil |
| 30,5–34,2 | Bitiş kartı | Yakında · Timpanogram Eşleştir · **88 soru seni bekliyor** | “Timpanogram Eşleştir. Kulede seni bekliyor!” | boom, parıltı, fanfar finali |

Eğriler oyunun çizim koduyla aynı (`charts.tsx › TimpanogramSvg` → overlay `TIMP`: Jerger eğrisi, normal bölge −100…+50 daPa ve 0,3–1,7 ml, “Kanal hacmi … ml”) ve oyunun üretim aralıklarında. Cevaplar Timpanogram Eşleştir’in bulgu etiketleriyle uyumlu (`packages/content/src/kamp-gorev-timpano.ts › EGRI_ADI`): **timpanogram tek başına tanı koydurmaz**; sıvı, delik, tüp, kir gibi olası nedenler videoda söylenmez. 88 soruluk banka `origin/main` üzerinde (`kamp-gorev-timpano.ts`, genel havuz 36, odyoloji havuzu hepsi); oyun ekranı bu sürümden çekildi.

## Ses
Müzik: `reklam_ses.py` yeni **“yarisma”** stili (Si bemol majör, 128 BPM: bakır fanfar → tik-tak “düşünme” bölümü → parlak dönüş groove’u → fanfar finali). Efektler: davul gürlemesi (yeni “drumroll”), bip, buzzer, zil, alkış, vuruş, savrulma, boom, parıltı. Stüdyo ışık huzmeleri döner.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/egri-yarismasi/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`); son karışım da
Whisper ile yazıya döküldü.
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendi çizimleri ve gerçek ekranlarıdır
(`tools/reels/kamp-cekim.mjs` çeker, `tools/reels/hazirla3.py` kare dizisine çevirir); oyuncu verisi yok (kamp önizlemesi yerel örnek
durum; klinik ve oyun ekranları bellek içi sunucuda tek bir örnek oyuncuyla), yönetici modu kullanılmadı.

## Gönderi metni (Instagram / TikTok)
3 saniyede söyle: bu eğri ne anlatıyor? ⏱️ Tepe nerede, eğri düz mü, kanal hacmi kaç ml? Eğri ipucu verir; tanıyı bütün testler birlikte koyar.
Timpanogram Eşleştir, ODİ: Sesin Yolu’nda Timpanometri Kulesi’nde. Kaçını bildin? Yorumlara yaz 👇

#odyoloji #odyolog #odyolojiöğrencisi #timpanometri #timpanogram #işitme #kulak #quiz #mobiloyun #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/kamp-cekim.mjs --only oyun   # oyun ekranları
python3 tools/reels/hazirla3.py                                                     # kare dizileri
HF_HOME=… nice -n 5 <venv>/bin/python tools/reels/vo.py --only egri-yarismasi     # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel egri-yarismasi
python3 tools/reels/compose.py --reel egri-yarismasi
python3 tools/reels/denetle.py egri-yarismasi                                     # kare tabakaları + LUFS/tepe denetimi
```
