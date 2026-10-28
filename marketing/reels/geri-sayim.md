# Reels: "Geri sayım: 5 hareket" (21,0 sn, 9:16) · lansman

> **Yalnız uygulama mağazada yayınlandığı gün paylaşılır.**

Video: `marketing/reels/geri-sayim.mp4` · Kapak: `marketing/reels/geri-sayim-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 High yuv420p + AAC (48 kHz stereo), faststart, -14,0 LUFS, gerçek tepe -2,3 dBTP. Boyut: ≈9,3 MB.

## Fikir
Spor reklamı enerjisinde bir geri sayım; ama sayılan zaman değil, oyunun **beş gerçek hareketi**. Her sayı dev altın rakamla, davul ve parlamayla ekrana çarpar; altında hareketin adı ve oyundaki gerçek kontrolü, arkada o hareketi gerçekten yapan bot: **5 ZIPLA** (dokun) · **4 KAY** (aşağı kaydır) · **3 SÜZÜL** (havada basılı tut) · **2 ÇAKIL** (havada aşağı kaydır) · **1 ATIL** (koşu yönüne kaydır). Bir vuruş siyah ve ters zil… **YAYINDA!** Stadyum marşı patlar; dört hızlı kesme (Serumen Golemi, Koklea, Ters Dünya, Gürültü Canavarı) ve bitiş kartı: **Hemen oyna**.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–2,0 | 4. bölüm: bot zıplar | **5** · ZIPLA · Dokun | “Beş: zıpla!” | davul + vuruş + damga (ilk kare), sayım bası |
| 2,0–4,0 | 4. bölüm: kıl perdesinin altından kayış | **4** · KAY · Aşağı kaydır | “Dört: altından kay!” | aynı + yükselen gerilim |
| 4,0–6,0 | 10. bölüm: ses kanatlarıyla süzülme | **3** · SÜZÜL · Havada basılı tut | “Üç: süzül, havada kal!” | aynı |
| 6,0–8,0 | 15. bölüm «Üzengi»: yere çakılma, çatlak zemin | **2** · ÇAKIL · Havada aşağı kaydır | “İki: yere çakıl!” | aynı + tok darbe |
| 8,0–10,0 | 31. bölüm «Elektrik»: ses darbesiyle atılma | **1** · ATIL · Koşu yönüne kaydır | “Bir: ileri atıl!” | aynı |
| 10,0–11,0 | siyah |  |  | sessizlik → ters zil kabarması |
| 11,0–13,0 | altın ışınlar, Odi düşer | **YAYINDA!** · ODİ: Sesin Yolu | “ODİ yayında! Hemen oyna!” | büyük darbe + stadyum borusu + parıltı; marş (drop) başlar |
| 13,0–17,0 | 20. Serumen Golemi · 22. Koklea · 35. Ters Dünya · 40. Gürültü Canavarı (vuruş başına kesme) | etiketler |  | savrulma + vuruş |
| 17,0–21,0 | bitiş kartı | Şimdi yayında · “App Store ve Google Play'de” · **Hemen oyna** |  | final akoru + boru |

## Anlatıcı satırları
| # | başlangıç (sn) | metin | Whisper dökümü (satır) | hata | seçim |
|---|---|---|---|---|---|
| g1 | 0,1 | Beş: zıpla! | 5 zıpla. | 0 | tohum 3, ×1.25, 0,9 sn |
| g2 | 2,1 | Dört: altından kay! | Dört altından kay. | 0 | tohum 3, ×1.25, 1,2 sn |
| g3 | 4,1 | Üç: süzül, havada kal! | 3. Süzül, havada kal. | 0 | tohum 6, ×1.25, 1,4 sn |
| g4 | 6,1 | İki: yere çakıl! | 2. Yere Çakıl | 0 | tohum 2, ×1.23, 1,1 sn |
| g5 | 8,1 | Bir: ileri atıl! | 1. İleri atıl | 0 | tohum 2, ×1.25, 1,2 sn |
| g6 | 11,3 | ODİ yayında! Hemen oyna! | Odi yayında. Hemen oyna. | 0 | tohum 2, ×1.25, 1,6 sn |

Son karışımın Whisper dökümü (bütün video):
```
  0.00-  0.84 Beş, zıpla.
  1.98-  3.14 Dört, altından kay.
  3.98-  5.38 Üç, süzül havada kal.
  6.14-  7.04 İki, yere çakıl.
  8.00-  9.20 Bir, ileri atıl.
 11.04- 12.66 Odi yayında. Hemen oyna.
```
Bütün satırlar karışımda da birebir duyuluyor (rakamlar Whisper'da yazıyla da geçerli); `dip` gerekmedi. “Üç” satırı ilk metinde (“Üç: havada süzül!”) sondaki l yutulduğu için “Üç: süzül, havada kal!” olarak yeniden yazıldı.

## Kaynaklar (tıbbi ve içerik bilgileri)
- Kontroller oyunun kendi öğretici cümlelerinden (`apps/web/src/ftue/script.ts`): “Ekrana dokun, zıpla!” (ipucu-ogret-zipla), “Aşağı kaydır: alçak engelin altından kayarsın!” (ipucu-ogret-kayma), “Havada basılı tut: ses kanatlarınla süzülürsün.” (ipucu-ogret-suzul), “Havada aşağı kaydır: çatlak zemini kır…” (ipucu-ogret-cakil), “Koşu yönüne kaydır: ses darbesiyle gürültü duvarını kır!” (ipucu-ogret-darbe).
- Bölüm adları ve sayısı (40): `packages/content/src/journeys.ts`. Tıbbi iddia yok; “Koklea” bölge adıdır (`biomes.ts`).

## Dürüstlük notları
- **Yalnız uygulama mağazada yayınlandığı gün paylaşılır.** (Bu video uygulamanın mağazada olduğunu söyler; o güne dek paylaşılmaz.)
- Bitiş kartındaki mağaza satırı tek bir değerdir: `tools/reels/reklamlar5.mjs › MAGAZA` (şu an “App Store ve Google Play'de”). Bir mağaza önce açılırsa yalnız bu satır değiştirilip video yeniden üretilir (`record.mjs --reel geri-sayim --no-clips` + `compose.py --reel geri-sayim`). Apple/Google rozeti ya da marka taklidi yok: düz yazı.
- Uygulama simgesi tek bir dosyadır: `apps/mobile/assets/icon.png` (`reklamlar5.mjs › IKON`). Bitiş kartında ikon çalışmasının yeni simgesi (A · Odi; `main` 87cf349) kullanıldı.
- Sahte kullanıcı, yorum, yıldız puanı, indirme sayısı, sıralama, “#1” ya da “milyonlar” yok. Sahte süre, son tarih ya da kıtlık yok (5-4-3-2-1 bir açılış süslemesidir: her sayı oyundaki gerçek bir harekettir; tarih, saat ya da “son şans” yoktur). Ödeme/üstünlük (pay-to-win) mesajı yok.
- Bütün görüntüler `origin/main` derlemesinden bu dalgada yeniden çekilen gerçek oyun ekranlarıdır (bot oyunun kendi simülasyonunu oynar; arayüz ekranları bellek içi sunucuda kurgusal, kulak temalı takma adlı örnek oyuncularla). Yönetici modu kullanılmadı. Görsellerde emoji yok.
- Tıbbi dil: her zaman “Koklea” (asla “Salyangoz”), “Kulak Kılı Ormanı”; timpanogram tek başına tanı koydurmaz.

## Ses
Müzik: `reklam_ses.py` “spor” stili (Mi minör stadyum marşı, 120 BPM: sayım bası + davul → susma → tam marş ve bakır nakarat → final). Efektler: davul (taiko), metalik vuruş, damga, tok darbe, ters zil, gümbürtü, stadyum borusu, parıltı, savrulma.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı; depoda: `tools/reels/vo/geri-sayim/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan "Perth" filigranı vardır. Ses ortamı bu dalgada depodaki betikle yeniden kuruldu (`tools/voice/ortam-kur.sh`). Her satır Whisper large-v3-turbo (MIT) ile birebir denetlendi (her sözcük, hata oranı 0: `tools/reels/vo/secim.json`); son karışım da Whisper ile yazıya döküldü (aşağıda).
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok). Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`).

## Gönderi metni (Instagram / TikTok) — yalnız yayın günü
Beş: zıpla! Dört: altından kay! Üç: süzül, havada kal! İki: yere çakıl! Bir: ileri atıl!
ODİ: Sesin Yolu yayında. Beş hareket, kırk bölüm, kulaktan beyne tek yol. Hemen oyna!

#odisesinyolu #yayında #yenioyun #mobiloyun #platformoyunu #oyun #kulak #işitme

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/cekim4.mjs --only takim,kart     # arayüz ekranları
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/kamp-cekim.mjs --only zaman,vaka,oyun && python3 tools/reels/hazirla3.py
tools/voice/ortam-kur.sh                                                                   # ses ortamı (bir kez)
HF_HOME=tools/harness/out/ses/hf nice -n 5 tools/harness/out/ses/venv/bin/python tools/reels/vo.py --only geri-sayim   # anlatıcı (depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel geri-sayim
python3 tools/reels/compose.py --reel geri-sayim
python3 tools/reels/denetle.py geri-sayim --asr tools/harness/out/ses/venv/bin/python             # kare tabakaları, LUFS/tepe, Whisper (HF_HOME ayarlı)
```
