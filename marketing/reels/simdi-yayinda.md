# Reels: "Şimdi yayında" (25,2 sn, 9:16) · lansman

> **Yalnız uygulama mağazada yayınlandığı gün paylaşılır.**

Video: `marketing/reels/simdi-yayinda.mp4` · Kapak: `marketing/reels/simdi-yayinda-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 High yuv420p + AAC (48 kHz stereo), faststart, -13,9 LUFS, gerçek tepe -2,3 dBTP. Boyut: ≈12,6 MB.

## Fikir
Sinema fragmanı dilinde bir “geldi” anı. İlk karede Gürültü Canavarı'nın gözü, kalın bir “bıraam” ve gümüş-altın fragman yazısı: **BEKLEYİŞ BİTTİ.** Sonra nefes: Odi yakın planda, ağır çekim, kalp atışı; “Bir ses, beyne ulaşmak için yola çıkıyor.” Ritim hızlanır: kulağın bölgeleri vuruş başına bir kesmeyle (Kulak Kılı Ormanı → Kulak Zarı → Kemikçikler → Koklea → İşitme Siniri → İşitme Korteksi), her birinde oyundaki gerçek bölüm numarası. Serumen Golemi ağır çekimde vurur, bir vuruş siyah, Gürültü Canavarı bütün ekranı sarsar. Sonra siyahtan altın ışınlara: **ŞİMDİ YAYINDA** çarpar; bitiş kartında uygulama simgesi, logo, “Şimdi yayında” rozeti, mağaza satırı ve **Hemen indir** düğmesi.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–1,8 | 40. bölüm: Gürültü Canavarı'nın gözü (yakın, sarsıntı, RGB kayması) | **BEKLEYİŞ BİTTİ.** | “Bekleyiş bitti.” | bıraam + gümbürtü (ilk kare) |
| 1,8–5,4 | 2. bölüm: Odi yakın plan, ağır çekim | altyazı | “Bir ses, beyne ulaşmak için yola çıkıyor.” | alçak uğultu (drone), kalp atışı |
| 5,4–10,2 | 3. Kulak Kılı Ormanı · 10. «Titreşim» · 15. «Üzengi» · 22. «İnce Sesler»: vuruş başına kesme | KULAK KILI ORMANI · KULAK ZARI · KEMİKÇİKLER · KOKLEA (+ bölüm etiketi) | “40 bölüm. Kulaktan beyne.” | nabız; her kesmede savrulma + vuruş |
| 10,2–11,4 | 31. «Elektrik» · 37. «Anlam Bahçesi» (yarım vuruşlu kesmeler) | İŞİTME SİNİRİ · İŞİTME KORTEKSİ |  | yükselme (build) |
| 11,4–14,4 | 20. bölüm: Serumen Golemi'nin vuruşu, ağır çekim | **SERUMEN GOLEMİ** |  | gümbürtü + metalik vuruş |
| 14,4–15,0 | siyah |  |  | sessizlik |
| 15,0–18,6 | 40. bölüm: Gürültü Canavarı | **GÜRÜLTÜ CANAVARI** | “Ve yolun sonunda: Gürültü Canavarı.” | bıraam, tam orkestra |
| 18,6–21,6 | altın ışınlar, Odi düşer | **ŞİMDİ YAYINDA** · ODİ: Sesin Yolu | “ODİ: Sesin Yolu. Şimdi yayında.” | büyük darbe + bıraam + parıltı (açılış vuruşu) |
| 21,6–25,2 | bitiş kartı: uygulama simgesi, logo | Şimdi yayında · “App Store ve Google Play'de” · **Hemen indir** | “Hemen indir.” | final akoru |

## Anlatıcı satırları
| # | başlangıç (sn) | metin | Whisper dökümü (satır) | hata | seçim |
|---|---|---|---|---|---|
| y1 | 0,3 | Bekleyiş bitti. | Bekleyiş bitti. | 0 | tohum 1, ×1.10, 1,1 sn |
| y2 | 2,1 | Bir ses, beyne ulaşmak için yola çıkıyor. | Bir ses, beyne ulaşmak için yola çıkıyor. | 0 | tohum 1, ×1.00, 2,9 sn |
| y3 | 5,5 | Kırk bölüm. Kulaktan beyne. | 40 bölüm kulaktan beyne. | 0 | tohum 3, ×1.10, 1,8 sn |
| y4 | 15,2 | Ve yolun sonunda: Gürültü Canavarı. | Ve yolun sonunda gürültü canavarı. | 0 | tohum 1, ×1.00, 2,4 sn |
| y5 | 18,9 | ODİ: Sesin Yolu. Şimdi yayında. | Odi, sesin yolu. Şimdi yayında. | 0 | tohum 2, ×1.10, 2,7 sn |
| y6 | 22,5 | Hemen indir. | Hemen indir. | 0 | tohum 1, ×1.05, 0,9 sn |

Son karışımın Whisper dökümü (bütün video):
```
  0.00-  1.18 Bekleyiş bitti.
  2.12-  4.80 Bir ses, beyne ulaşmak için yola çıkıyor.
  5.60-  7.22 Kırk bölüm kulaktan beyne.
 14.56- 17.48 Ve yolun sonunda gürültü canavarı.
 18.94- 20.18 Odi sesin yolu.
 20.64- 21.36 Şimdi yayında.
 22.56- 23.18 Hemen indir.
```
Bütün satırlar karışımda da birebir duyuluyor; maskelenen sözcük olmadığı için `dip` gerekmedi.

## Kaynaklar (tıbbi ve içerik bilgileri)
- 40 bölüm ve bölge/bölüm adları: `packages/content/src/journeys.ts` (HUMAN_JOURNEY: 3 «Kulak Kılı Ormanı», 10 «Titreşim», 15 «Üzengi», 20 «Serumen Golemi», 22 «İnce Sesler», 31 «Elektrik», 37 «Anlam Bahçesi», 40 «Gürültü Canavarı»).
- Sesin yolu (dış kulak → kulak zarı → kemikçikler → koklea → işitme siniri → beyin sapı → işitme korteksi): `docs/odyoloji-icerik.md` (kaynak dosyalar `packages/content/src/…`; ilke: Gelfand, Katz, Pickles ders kitabı düzeyi), bölge bilgileri `packages/content/src/biomes.ts`.
- “Serumen” = kulak kiri (`docs/odyoloji-icerik.md › Kulak Sözlüğü`); Serumen Golemi ve Gürültü Canavarı oyunun kurgusal boss'larıdır, tıbbi iddia değildir.

## Dürüstlük notları
- **Yalnız uygulama mağazada yayınlandığı gün paylaşılır.** (Bu video uygulamanın mağazada olduğunu söyler; o güne dek paylaşılmaz.)
- Bitiş kartındaki mağaza satırı tek bir değerdir: `tools/reels/reklamlar5.mjs › MAGAZA` (şu an “App Store ve Google Play'de”). Bir mağaza önce açılırsa yalnız bu satır değiştirilip video yeniden üretilir (`record.mjs --reel simdi-yayinda --no-clips` + `compose.py --reel simdi-yayinda`). Apple/Google rozeti ya da marka taklidi yok: düz yazı.
- Uygulama simgesi tek bir dosyadır: `apps/mobile/assets/icon.png` (`reklamlar5.mjs › IKON`). Bitiş kartında ikon çalışmasının yeni simgesi (A · Odi; `main` 87cf349) kullanıldı.
- Sahte kullanıcı, yorum, yıldız puanı, indirme sayısı, sıralama, “#1” ya da “milyonlar” yok. Sahte süre, son tarih ya da kıtlık yok. Ödeme/üstünlük (pay-to-win) mesajı yok.
- Bütün görüntüler `origin/main` derlemesinden bu dalgada yeniden çekilen gerçek oyun ekranlarıdır (bot oyunun kendi simülasyonunu oynar; arayüz ekranları bellek içi sunucuda kurgusal, kulak temalı takma adlı örnek oyuncularla). Yönetici modu kullanılmadı. Görsellerde emoji yok.
- Tıbbi dil: her zaman “Koklea” (asla “Salyangoz”), “Kulak Kılı Ormanı”; timpanogram tek başına tanı koydurmaz.

## Ses
Müzik: `reklam_ses.py` “fragman” stili (Re minör, 100 BPM: sessizlik → uğultu → nabız → yükselme → tam orkestra → açılış vuruşu → final), kesmeler vuruş ızgarasında. Anlatıcı fragman sesiyle (aynı anlatıcı; alt frekans dolgunluğu + hafif salon yankısı). Efektler: bıraam, gümbürtü, kalp atışı, savrulma, metalik vuruş, parıltı, pop.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı; depoda: `tools/reels/vo/simdi-yayinda/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan "Perth" filigranı vardır. Ses ortamı bu dalgada depodaki betikle yeniden kuruldu (`tools/voice/ortam-kur.sh`). Her satır Whisper large-v3-turbo (MIT) ile birebir denetlendi (her sözcük, hata oranı 0: `tools/reels/vo/secim.json`); son karışım da Whisper ile yazıya döküldü (aşağıda).
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok). Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`).

## Gönderi metni (Instagram / TikTok) — yalnız yayın günü
Bekleyiş bitti. Bir ses, beyne ulaşmak için yola çıkıyor: Kulak Kılı Ormanı, kulak zarı, kemikçikler, Koklea, işitme siniri… ve yolun sonunda Gürültü Canavarı.
ODİ: Sesin Yolu şimdi yayında. 40 bölüm, kulaktan beyne. Hemen indir!

#odisesinyolu #yayında #yenioyun #mobiloyun #oyun #odyoloji #işitme #kulak #koklea

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/cekim4.mjs --only takim,kart     # arayüz ekranları
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/kamp-cekim.mjs --only zaman,vaka,oyun && python3 tools/reels/hazirla3.py
tools/voice/ortam-kur.sh                                                                   # ses ortamı (bir kez)
HF_HOME=tools/harness/out/ses/hf nice -n 5 tools/harness/out/ses/venv/bin/python tools/reels/vo.py --only simdi-yayinda   # anlatıcı (depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel simdi-yayinda
python3 tools/reels/compose.py --reel simdi-yayinda
python3 tools/reels/denetle.py simdi-yayinda --asr tools/harness/out/ses/venv/bin/python             # kare tabakaları, LUFS/tepe, Whisper (HF_HOME ayarlı)
```
