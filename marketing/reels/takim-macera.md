# Reels: "Kim daha hızlı duyar?" (23,1 sn, 9:16)

Video: `marketing/reels/takim-macera.mp4` · Kapak: `marketing/reels/takim-macera-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -14,0 LUFS, gerçek tepe -2,0 dBTP. Boyut: ≈8,8 MB.

## Fikir
Spor reklamı enerjisi. Stadyum ışıkları, kalabalık uğultusu ve dev sayılar: **3 · 2 · 1** — düdük, boru, tezahürat: **BAŞLA!** Hız çizgileri arasında koşu; “Aynı bölüm. Aynı anda. Takımınla!” Canlı Takım Yarışı ekranı, “Birinci!” sonucu, Takım Ligi kademeleri birer birer çakılır (Bronz → Gümüş → Altın → Platin → Koklea), sıralama podyumu, Gürültü Canavarı'na ağır çekimde vuruş: “Hep beraber!” Kapanış: “Takımın seni bekliyor.” ve izleyiciye meydan okuma: “Kim daha hızlı duyar? Arkadaşını etiketle!”

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–1,9 | Stadyum (dönen ışık huzmeleri, tribün silueti) | **3 · 2 · 1** (her vuruşta çarpar) | “Üç! İki! Bir!” | kalabalık uğultusu, bip ×3, yükselen süpürme |
| 1,9–2,8 | Stadyum + hız çizgileri | **BAŞLA!** |  | hakem düdüğü + stadyum borusu + tezahürat; marş başlar |
| 2,8–5,2 | Dış kulakta koşu (4. bölüm), ×1,2 hız, ritmik yakınlaşmalar | **AYNI BÖLÜM · AYNI ANDA · TAKIMINLA!** | “Aynı bölüm. Aynı anda. Takımınla!” | savrulmalar |
| 5,2–8,9 | Takım yarışı sürerken (eğik telefon kartı) → canlı yarış sonucu (arkadaşlarla Yarış odası) | **CANLI TAKIM YARIŞI** · **BİRİNCİ!** | “Önde bitir, yıldızları kap!” | savrulma + tezahürat |
| 8,9–11,7 | Stadyum | **TAKIM LİGİ** · BRONZ · GÜMÜŞ · ALTIN · PLATİN · **KOKLEA** | “Bronzdan Koklea ligine tırman!” | her kademede vuruş, Koklea'da boom + parıltı |
| 11,7–14,1 | Sıralama › podyum (eğik telefon kartı) | **SIRALAMA** | “Sıralamada adını yukarı taşı!” | savrulma |
| 14,1–16,9 | Gürültü Canavarı'na vuruş (40. bölüm), ağır çekim (×0,25) | **HEP BERABER!** | “Canavarı hep beraber devirin!” | boom + vuruş, tezahürat |
| 16,9–19,7 | Bitiş kartı: Odi, logo, “Yakında” | Takımın **seni bekliyor** | “ODİ: Sesin Yolu. Takımın seni bekliyor.” | marş filtreli (ara bölüm) |
| 19,7–23,1 | Stadyum + hız çizgileri | **KİM DAHA HIZLI DUYAR?** · Arkadaşını **etiketle**, meydan oku! · logo | “Kim daha hızlı duyar? Arkadaşını etiketle!” | boru + tezahürat, final akoru |

Kurallar `docs/16-takim-rekabeti.md` ve `docs/13-iletisim.md`'den (canlı takım yarışı: aynı bölüm aynı anda; Takım Ligi kademeleri Bronz → Gümüş → Altın → Platin → Koklea). Ekranlar oyunun gerçek ekranlarıdır; adlar (Ayşe, Bora, Cem, Deniz…) tanıtım çekimindeki örnek oyunculardır, sahte sayı ya da sahte rakip yok. Ekrandaki 3-2-1 bir reklam geri sayımıdır, tarih değildir.

## Ses
Müzik: `reklam_ses.py` “spor” stili (Mi minör stadyum marşı: büyük davullar → geri sayım gerilimi → dört vuruşlu “drop” + bakır nakarat → filtreli ara → final), 128 BPM, kesmeler vuruş ızgarasında. Efektler (hepsi sentez): kalabalık uğultusu ve tezahürat, hakem düdüğü, stadyum borusu, bip, vuruş, boom, savrulma, parıltı.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/takim-macera/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`).
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendi çizimleri ve gerçek ekranlarıdır.

## Gönderi metni (Instagram / TikTok)
Üç, iki, bir… kim daha hızlı duyar? 🏁 Takımınla aynı bölümü aynı anda koş, Bronz’dan Koklea ligine tırman, canavarı hep beraber devir. ODİ: Sesin Yolu yakında. Takımın seni bekliyor!
Arkadaşını etiketle, meydan oku 👇

#odyoloji #odyolojiöğrencisi #odyolog #işitme #kulak #takım #yarış #mobiloyun #oyun #yakında #odisesinyolu

## Yeniden üretmek
```
HF_HOME=… nice -n 5 <venv>/bin/python tools/reels/vo.py --only takim-macera      # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel takim-macera
python3 tools/reels/compose.py --reel takim-macera
python3 tools/reels/denetle.py takim-macera                                     # kare tabakaları + LUFS/tepe denetimi
```
