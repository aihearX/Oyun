# Reels: 29 Ekim, "Bir sesin içinde ne saklıdır?" (33,0 sn, 9:16)

**29 Ekim'de paylaşılır.** (Cumhuriyetin 103. yılı, 29 Ekim 2026)

Video: `marketing/reels/29-ekim-spektrogram.mp4` · Kapak: `marketing/reels/29-ekim-spektrogram-kapak.png` (1080×1920)
1080×1920, 30 kare/sn, H.264 High yuv420p, AAC 48 kHz stereo, faststart, −14 LUFS, gerçek tepe ≤ −1 dBTP.
Üretim (kökten): `python3 tools/reels/29-ekim-spektrogram.py` (ses + spektrogram verisi) → `node tools/reels/29-ekim-spektrogram.mjs --video`
(görüntü, `tools/reels/29-ekim-spektrogram.html`) → `python3 tools/reels/29-ekim-spektrogram.py --mux` (birleştirme).

## Fikir
Önce bir ses dinletilir: kulağa yalnızca yumuşak bir hışırtı gibi gelir, dalga biçimi de bir şey anlatmaz. Sonra odyologların sese
baktığı yoldan, spektrogramdan bakılır. Aynı ses kayan ısı haritasında çalınca ay ve yıldız gürültü tabanının içinden çıkar. Isı
haritasının renkleri kırmızı ve beyaza döner, gürültü tabanı söner ve şekil resmî bayrağa oturur. Bayrak sesin içinden doğar.
Bunu ancak spektrogram okuyan biri düşünür, ve gösterilen görüntü bir çizim değil, gerçek bir ölçümdür.

## Neden paylaşılır (odyolog ve odyoloji öğrencisi gözüyle)
- **Gerçek:** Ekrandaki spektrogram, videoda duyulan sesin gerçek STFT'sidir. Piksel elle çizilmedi (teknik aşağıda). Akustikçi isterse
  sesi indirip kendi programında (Praat, Audacity, Sonic Visualiser) açabilir. Logaritmik frekans ekseni 250–8000 Hz aralığında aynı
  ay-yıldızı görür.
- **Meslek dili:** Frekans ekseni 250–8000 Hz, odyogramın oktav aralığıdır. Bayrağın eni tam **5 oktav** tutar. Bağlam sahnesinde
  sentez bir kadın sesi "aaa → iii" der: harmonikler, vibrato ve formant geçişi (F1 düşer, F2 yükselir) görünür. Bir de kuş
  cıvıltısının çırpıntıları vardır. Spektrogram okumayı öğrenen her öğrenci bu görüntüyü tanır.
- **Anlamlı geçiş:** Kesme yoktur. Isı haritası renk haritasını değiştirerek bayrak olur: düşük enerji kırmızıya, yüksek enerji
  beyaza döner. Bayrağın ay-yıldızı sesin enerjisidir.
- **Dürüst:** Videoda küçük bir not yer alır: "Bu sesin spektrogramı gerçektir: çizim değil, ölçüm." Bitiş kartında da şu yazar: "Bu
  ay-yıldız, bir sesin gerçek spektrogramından doğdu."
- Son kare tek başına hikâye görseli olarak paylaşılabilir: resmî bayrak, "Sesimizin içinde Cumhuriyet var.", kutlama ve küçük
  "ODİ · Sesin Yolu" imzası. Ürün tanıtımı yoktur.

## Teknik (kısaca)
1. **Maske:** Resmî bayrak geometrisinden (bayrak.svg ile birebir aynı: ay dış dairesi merkez 0,5G r 0,25G, iç daire merkez 0,5625G
   r 0,2G, yıldız merkezi 0,8208G) 1500×1000 birimlik bir maske çıkarılır. Beyaz bölgeler 1, kırmızı alan 0'dır. Kenarlar σ = 3 birim
   ile yumuşatılır.
2. **Eşleme:** Yatay eksen zamandır: bayrağın boyu (1,5G) 8 saniyeye denk gelir. Dikey eksen logaritmik frekanstır: bayrağın eni (G)
   250–8000 Hz, yani 5 oktavdır. Ekranda 1 sütun 1/116,25 sn, 1 satır 1/124 oktavdır, böylece 930×620 panelde bayrağın 3:2 oranı korunur.
   Ay ve yıldız 595–3364 Hz arasına düşer. Bu aralık kulağa yumuşak gelir, ne boğuktur ne tizdir.
3. **Ses sentezi:** Sesin iki katmanı vardır.
   - (a) Ters STFT: 2048 noktalık Hann penceresi ve 256 örnek adımla çalışır. Her kutunun büyüklüğü maske değeri × pembe eğimdir
     (oktav başına eşit enerji), fazı rastgeledir ve örtüştür-topla yöntemiyle birleştirilir. Sonuç, şekli taşıyan yumuşak bir hışırtıdır.
   - (b) Fa majör pentatonik sinüsler (F5…G7, 12 nota): her biri kendi frekans satırında maske açıkken çalar. Hışırtının içinde cam
     gibi bir akor duyulur ve ekranda ince yatay çizgiler olarak görünür.
4. **Analiz (görüntü):** Bu karışık sinyalin (bağlamdaki ünlü ve kuş sesi, gürültü tabanı ve bayrak sesi) STFT'si alınır: 2048 nokta
   Hann, her video sütunu için bir pencere. Ardından güç dB'ye çevrilir. Praat'taki ön vurgu fikriyle oktav başına +3 dB eğim uygulanır
   (pembe eğimi düzler). Dinamik aralık 52 dB'dir ve sonuç log frekans satırlarına örneklenir (`spek.png`). Tarayıcı bu veriyi yalnızca
   renklendirir (inferno renk haritası) ve kaydırır.
5. **Dönüşüm:** Renk haritası inferno'dan kırmızı-beyaza geçer. Eşik 0,60'tır. Bu değer, eşiklenmiş spektrogramla resmî maskenin
   örtüşmesini en büyük yapan değer olarak ölçüldü (IoU = 0,85). Çerçeve tam oturduğu anda (18,6 sn) görüntü kesin resmî bayrağa
   (bayrak.svg, #E30A17 ve beyaz) geçer.
- Kancada çalan ses, spektrogramda görünen sesle aynı örneklerdir. Analiz 5,0. saniyede başlar; kanca daha önce çaldığı için panel boş
  açılır.
- Denetim: Son MP4'ün AAC sesinden 10,6–18,6. saniyelerin spektrogramı yeniden hesaplandı. Ay ve yıldız açıkça görünüyor.
  Çerçevenin sağındaki kırmızı alana 15,5. saniyeden sonra müziğin kreşendosu düşer.
- Müzik 15,5. saniyeye kadar yalnızca 250 Hz'in altında çalar (alçak Fa pedalı). Bu bölge spektrogram aralığının dışında kalır, yani
  duyulan her şey görünür. 15,5. saniyeden sonra başlayan tören müziği bu analize dahil değildir. Spektrogram bayrak sesinin
  (ve öncesindeki ünlü ile kuş seslerinin) ölçümüdür.

## Sahne akışı (ekran yazıları; sessiz izlenebilir)
| Süre | Görüntü | Ses | Ekran yazısı |
|---|---|---|---|
| 0–4,5 | Karanlık; aynı sesin altın renkli dalga biçimi soldan sağa yazılır | Bayrak sesi (yumuşak hışırtı + cam akor), alçak Fa pedalı | SESİ AÇ · Bu sesi **dinle.** → Sadece bir hışırtı… **değil mi?** |
| 4,5–5,3 | Dalga çizgisi incelir ve spektrogram düzlemi olarak açılır; eksenler 250 Hz–8 kHz, "CANLI" | — | |
| 5,3–10,2 | Kayan ısı haritası: ünlünün harmonikleri ve formantları, kuş çırpıntıları; içerikle kayan etiketler | "aaa → iii" (sentez kadın sesi), kuş cıvıltısı | Odyologlar sesi böyle de görür: **spektrogram.** |
| 10,4–13,7 | Gürültü tabanı; sağ kenardan ay belirir | Bayrak sesi yeniden | Şimdi bir de **görüntüsüne bak.** |
| 13,9–18,4 | Ay ve yıldız tamamlanır; 15,6'dan sonra ısı haritası kırmızı-beyaza döner, gürültü tabanı söner, eksenler kaybolur | Yaylılar Csus4 kreşendosu, timpani tremolosu; 18,35'te 0,25 sn sessizlik | Az önce dinlediğin ses, **işte bu.** · *Bu sesin spektrogramı gerçektir: çizim değil, ölçüm.* |
| 18,6 | Çerçeve oturur ve kesin resmî bayrağa geçer; parlama, arkada ses halkaları, kıvılcımlar | Fa majör büyük vuruş (bakırlar, timpani, zil) + pentatonik parıltı | |
| 18,95–22,2 | Bayrak, ışık huzmeleri, toz | 72 BPM tören müziği: F | Bazı sesler, **bir milletin kimliğini taşır.** |
| 22,4–25,35 | ↑ | B♭ | **29 Ekim** · 1923 |
| 25,55–28,5 | ↑ | C (sus4 → C), timpani tremolosu | Cumhuriyetimizin **103. yılı** kutlu olsun! |
| 28,6–33,0 | Bayrak yukarı alınır ve küçülür; bitiş kartı (son ≈2 sn sabit) | Son Fa akoru; piyanoda bayrak sesinin notaları (F6–C6–A5–F5) | 29 EKİM 1923 · 2026 · Sesimizin içinde **Cumhuriyet** var. · Cumhuriyetimizin 103. yılı kutlu olsun! · Bu ay-yıldız, bir sesin gerçek spektrogramından doğdu. · ODİ · Sesin Yolu |

Yazılar Instagram'ın üst ~250 px ve alt ~340 px alanının dışında kalır (panel 470–1090 px, yazılar ≈1200–1530 px).

## Doğruluk ve kaynaklar
- Bayrak: Türk Bayrağı Kanunu (2994 sayılı, 1983) ve Türk Bayrağı Kanunu Uygulama Yönetmeliği'ndeki oranlar. Yıldız merkezi 0,8208G'dir,
  yıldız düzgün beş köşelidir ve bir ucu uçkurluğa bakar. Son bayrak `bayrak.svg` ile birebir aynıdır, yalnız bütün olarak ölçeklenir
  ve üstüne hiçbir şey konmaz. Spektrogramdaki ara görüntü ölçümdür, bu yüzden STFT çözünürlüğü kadar yumuşaktır.
- Ünlü formantları: Peterson, G. E. & Barney, H. L. (1952). *Control methods used in a study of the vowels.* JASA 24(2), 175–184.
  Kadın ortalamaları kullanıldı: /a/ ≈ 850/1220/2810 Hz, /i/ ≈ 310/2790/3310 Hz. f0 220 → 262 Hz (A3 → C4), vibrato 5,3 Hz.
- Spektrogram: kısa zamanlı Fourier dönüşümü (STFT), Hann penceresi. Ön vurgu fikri Praat'tan alındı (Boersma & Weenink, *Praat:
  doing phonetics by computer*; Praat'ın varsayılanı +6 dB/oktav, burada pembe eğimi düzlemek için +3 dB/oktav kullanıldı).
- Odyogram frekans aralığı (250–8000 Hz oktav frekansları): ASHA, *Guidelines for Manual Pure-Tone Threshold Audiometry* (2005).
- Gerçek kişi görüntüsü, fotoğraf, kayıt, marş yoktur (İstiklal Marşı ve 10. Yıl Marşı da yoktur). Tüm sesler numpy ile sentezlendi.

## Ses
Ses tamamen özgündür. Bayrak sesi yumuşaktır: 595–3364 Hz arasında pembe eğimli bir hışırtı ve Fa majör pentatonik bir cam akor.
Kuru olarak karıştırılır, yani analiz edilen örneklerin aynısı duyulur. Bayrak sesinin bölümü ≈ −17 LUFS'tır, tören müziği ≈ −12 LUFS.
Bu yüzden bayrak sesi hiçbir zaman yüksek ya da delici değildir, ama açılışta net duyulur. Müziğin akışı şöyledir: alçak Fa pedalı
(250 Hz altı) → Csus4 yaylı kreşendosu → kısa sessizlik → bayrakta Fa majör büyük vuruş → 72 BPM'de F–B♭–C tören ezgisi (bakırlar,
yaylılar, "lub-dub" timpani) → son Fa akoru. Akordan sonra piyano, bayrak sesinin pentatonik notalarını tek tek çalar. Anlatıcı yoktur.

## Önerilen gönderi metni
Bu sesi dinle. Sadece bir hışırtı… değil mi? Şimdi bir de spektrogramına bak. 🇹🇷

Bu bir çizim değil: Videodaki sesin gerçek spektrogramı. Ay-yıldızı zaman–frekans düzlemine yerleştirdik (250–8000 Hz, tam 5 oktav,
odyogramın aralığı) ve ondan bir ses ürettik. Sonra o sesi ölçtük. Bayrak sesin içinden çıktı.

Bazı sesler, bir milletin kimliğini taşır. Sesimizin içinde Cumhuriyet var.
29 Ekim 1923. Cumhuriyetimizin 103. yılı kutlu olsun!

(Sesi indirip Praat'ta logaritmik frekans ekseniyle açan meslektaşlar aynı ay-yıldızı görecek: 11,9–15,5. saniyeler.)

#29Ekim #CumhuriyetBayramı #103Yıl #odyoloji #odyolog #spektrogram #akustik #odyolojiöğrencisi #işitme #Cumhuriyet #odisesinyolu
