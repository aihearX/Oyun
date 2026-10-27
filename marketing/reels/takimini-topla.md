# Reels: "Takımını topla" (28,9 sn, 9:16)

Video: `marketing/reels/takimini-topla.mp4` · Kapak: `marketing/reels/takimini-topla-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 + AAC (48 kHz stereo), faststart, -14,1 LUFS, gerçek tepe -3,1 dBTP. Boyut: ≈12,9 MB.

## Fikir
Soygun filmi parodisi, bir ekip toplama montajı. İlk karede Gürültü Canavarı ağır çekimde, soğuk renk, kırmızı damga **HEDEF**: “Bir plan. Beş oyuncu. Tek hedef: Gürültü Canavarı.” Mavi plan kâğıdı zemininde oyunun gerçek takım ekranları: Takım bul listesi ve “Başvuruyla” takıma hazır notla başvuru. Sonra dondurulmuş isim kartları, her biri deklanşör ve bakır vuruşuyla: **LİDER** Örs Kaptan (taç), **YARDIMCI** Zar Ustası (yıldız rozeti), **HIZLI** Hızlı Lif, **USTA** Koklea Kâşifi, **ÇAYLAK** Minik Nota (başvurusu az önce kabul edildi); kartların altında oyundaki gerçek üye satırları. Plan sohbette yalnız hazır sözlerle kurulur, canlı takım yarışında 3'e 3 lobide herkes hazır, baskında ortak can çubuğu erir; büyük vurgun: Gürültü Canavarı'na ağır çekim vuruş. Kapanış: **Takımını topla. Yakında.** Adlar kurgusal, kulak temalı takma adlardır.

## Sahne akışı
| Süre | Görüntü | Ekran yazısı | Anlatıcı | Ses tasarımı |
|---|---|---|---|---|
| 0,0–4,0 | 40. bölüm: Gürültü Canavarı bağırırken ağır çekim, soğuk renk; hedef halkası | **HEDEF** · **GÜRÜLTÜ CANAVARI** | “Bir plan. Beş oyuncu. Tek hedef: Gürültü Canavarı.” | gümbürtü + damga; parmak şıklatma ve yürüyen bas |
| 4,0–8,1 | Takım › Takım bul listesi (Sessiz Operasyon · Başvuruyla) → başvuru sayfası (hazır not seçili) | Takım › Takım bul · Başvuru · hazır not | “Önce ekibini bul.” | savrulma; fırça + vibrafon |
| 8,1–12,7 | Plan zemininde dondurulmuş isim kartları; altında Takım › Üyeler satırları (rol rozetleriyle) | **LİDER** Örs Kaptan · **YARDIMCI** Zar Ustası · **HIZLI** Hızlı Lif · **USTA** Koklea Kâşifi · **ÇAYLAK** Minik Nota | “Lider. Yardımcı. Hızlı olan. Usta. Ve bir çaylak.” | her kartta deklanşör + vuruş; kornet + zil darbesi, sonra yalnız bas |
| 12,7–15,0 | Takım sohbeti: Hoş geldin, Selam!, Birlikte oynayalım mı?, Bu hafta hedefe yetişelim!, Teşekkürler! | Takım sohbeti · yalnız hazır sözler | “Planı sohbette kurun.” | savrulma; tam caz düzeni (davul, kornet, sörf gitar) |
| 15,0–19,1 | Takım › Takım Yarışı: 3'e 3 lobi, üç üye hazır → canlı takım yarışı bölüm içinden | Canlı Takım Yarışı · 3’e 3 | “Canlı takım yarışında ısının.” | savrulma |
| 19,1–21,4 | Takım › Baskın: Gürültü Canavarı'nın ortak canı erirken, en çok vuranlar | Baskın · ortak can çubuğu | “Baskında, hep birlikte!” | savrulma |
| 21,4–24,9 | 40. bölüm: Gürültü Canavarı'na vuruş, ağır çekim, sarsıntı | altyazı | “Ve büyük vurgun: Gürültü Canavarı!” | gümbürtü + vuruş; taiko ve alçak drone |
| 24,9–28,9 | Plan zemini, logo | **TAKIMINI TOPLA.** · ODİ · Sesin Yolu · Yakında | “Takımını topla. Yakında.” | kornet son akoru, zil, vibrafon |

Ekranlar oyunun gerçek arayüzüdür (`tools/reels/cekim4.mjs --only takim`): bellek içi veritabanlı gerçek sunucu, web test derlemesi ve gerçek ağ çağrıları; takım “Sessiz Operasyon” (Başvuruyla) kurulur, Zar Ustası, Hızlı Lif ve Koklea Kâşifi davet koduyla katılır, lider Zar Ustası'nı yardımcı yapar; Minik Nota keşif listesinden hazır notla başvurur, lider kabul eder. Sohbette yalnız oyunun hazır sözleri vardır (serbest yazı gönderilmedi). Takım yarışı 3'e 3 lobide gerçek eşleşmeyle başlar; baskın sunucunun gerçek can hesabıyla (üyelerin bölüm sonuçları) erir. Roller Lider ve Yardımcı oyundaki gerçek rollerdir; “Hızlı”, “Usta” ve “Çaylak” parodi lakaplarıdır (Usta–Çırak oyunda vardır). Bütün adlar kurgusal, kulak temalı takma adlardır; gerçek kişi, sahte sayı, puan ya da sıralama iddiası yoktur (ekrandaki değerler bu çekimdeki örnek oyuncuların gerçek durumudur). Kurallar `docs/16-takim-rekabeti.md` ve `docs/13-iletisim.md`.

## Ses
Müzik: `reklam_ses.py` yeni **“soygun”** stili (Mi minör casus cazı, 104 BPM: parmak şıklatma ve yürüyen bas → fırça ve vibrafon → isim kartlarında kornet + zil darbesi ve bekleyen bas → davul, kornet vuruşları ve sörf gitar riff'i → canavarda alçak drone + taiko → son akor). Efektler: deklanşör, vuruş, damga, savrulma, gümbürtü, parıltı. İsim kartları anlatıcının kelimelerine kesilir (Whisper kelime zamanları). Anlatıcı satırları ve son karışımın Whisper dökümü metinle aynı.

Anlatıcı: uygulamadaki ve önceki Reels'lerdeki aynı akıcı erkek anlatıcı (Chatterbox Multilingual, Resemble AI, MIT lisansı;
bir kez üretildi, depoda: `tools/reels/vo/takimini-topla/`). Ses tamamen sentetiktir (Kokoro-82M, Apache-2.0, "am_michael" sentetik sesinden
türetilen Türkçe referans: `tools/reels/vo/ref-tr-erkek.wav`); gerçek bir kişinin sesi klonlanmadı. Çıktılarda Resemble'ın duyulmayan
"Perth" filigranı vardır. Her satır Whisper large-v3-turbo (MIT) ile denetlendi (hata oranı: `tools/reels/vo/secim.json`); son karışım da
Whisper ile yazıya döküldü.
Müzik ve bütün efektler özgün sentezdir (`tools/reels/reklam_ses.py`, numpy; örnek/sample ya da hazır ses paketi yok).
Yazı tipleri: Baloo 2 ve Nunito (SIL Open Font License, `tools/reels/fonts/`). Görüntüler oyunun kendisidir: takım ekranları gerçek arayüz çekimi (`tools/reels/cekim4.mjs`), Gürültü Canavarı klipleri botun gerçek koşusundan (`tools/reels/clip.html`). Yönetici modu kullanılmadı; karede yönetici rozeti, bildirim ya da hata öğesi olmadığı çekim sırasında denetlendi.

## Gönderi metni (Instagram / TikTok)
Bir plan. Beş oyuncu. Tek hedef: Gürültü Canavarı. 🦉 Lider, yardımcı, hızlı olan, usta… ve bir çaylak. Takımını bul, başvur, planı sohbette hazır sözlerle kur, canlı takım yarışında ısın, baskında hep birlikte vur.
Takımını topla. ODİ: Sesin Yolu yakında. Ekibine kimi alırdın? Etiketle 👇

#oyun #mobiloyun #takım #arkadaş #odyoloji #odyolojiöğrencisi #işitme #kulak #yakında #odisesinyolu

## Yeniden üretmek
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/cekim4.mjs --only takim   # takım ekranları
HF_HOME=… nice -n 10 <venv>/bin/python tools/reels/vo.py --only takimini-topla     # anlatıcı (bir kez; depoda hazır)
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/reels/record.mjs --reel takimini-topla
python3 tools/reels/compose.py --reel takimini-topla
python3 tools/reels/denetle.py takimini-topla                                     # kare tabakaları + LUFS/tepe denetimi
```
