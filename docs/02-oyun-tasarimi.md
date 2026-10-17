# 02 · Oyun Tasarımı

## 1. Çekirdek döngü (30 saniye)
```
Bölüme gir (ortalama 60-120 sn) → koş/zıpla/kay/yüz/uç → ses jetonu topla, engeli aş,
mini hedefi tamamla → bölüm sonu: yıldız (1-3), ödül sandığı değil, GÖRÜNÜR ödül →
haritada bir adım ilerle → yeni mekanik/biyom "kapıyı araladı" → bir bölüm daha
```
Bir oturum (5-15 dk): 3-8 bölüm + 1 meta eylem (Odi'yi geliştir, takım görevine katkı, arkadaşa yardım).

## 2. Kontrol
Tek elle, dikey ekran. Varsayılan: Odi otomatik ilerler; dokun = zıpla, basılı tut = yüksek zıpla, aşağı kaydır = kay, iki parmak = özel yetenek. Bölüm türüne göre kontrol değişir ama hep tek elle:
- **Koşu** (kanal, dış kulak): zıpla/kay.
- **Yüzme** (koklea sıvısı): basılı tut = yüksel, bırak = alçal (Flappy benzeri ama yumuşak).
- **Trambolin** (orta kulak): zamanlamalı dokunuş = daha güçlü sıçrama.
- **Makine** (kemikçikler): dişlilere tutun, doğru anda bırak.
- **Sinir impulsu** (işitme siniri): sağ/sol kaydırarak şerit değiştir, hızlı.
- **Rüya** (korteks): yerçekimi yönü değişir; dokun = yerçekimini çevir.

## 3. Sonsuz dünya: nasıl hiç bitmez ve her bölüm nasıl farklılaşır
Üç katmanlı üretim:

### 3.1 Yolculuk hattı (makro)
Harita, sonsuz bir "ses yolculuğu" dizisidir. Her yolculuk 40-60 bölüm:
1. İnsan kulağı (öğretici yolculuk): Dış Kulak → Kanal → Zar → Kemikçikler → Koklea (3 kıvrım, tonotopi) → Sinir → Beyin Sapı → Korteks.
2. Sonra **tür yolculukları**: Yarasa (ekolokasyon, karanlıkta ses dalgalarıyla gör), Balina (dev ölçek, yavaş, derin bas), Baykuş (asimetrik kulak, ses yönü bulmacaları), Fil (kızılötesi, yer titreşimi), Kedi (hareketli kulak kepçesi, hız), Köpek, Yunus, Güve (en basit kulak), Çekirge (bacakta kulak!)...
3. Sonra **durum yolculukları**: Bebek kulağı (küçük ve yumuşak), Yaşlı kulak (presbiakuzi: yüksek frekans bölgeleri soluyor), Konser sonrası (geçici eşik kayması: dünya bulanık), Otitis fırtınası, Gürültü Fabrikası, Sessizlik Vadisi.
4. Sonra **fantastik yolculuklar**: Ses Ağacı, Frekans Okyanusu, Yankı Şehri, Sessiz Ay. Burada tasarım özgürlüğü sınırsızdır.
Yolculuklar haftalık canlı operasyonla eklenir; üretim hattı (bkz. 06) haftada bir yolculuk çıkarır. Oyuncu içeriğin önüne geçerse, **sonsuz mod** (prosedürel) devreye girer ve ilerleme hiç durmaz.

### 3.2 Bölüm = biyom × mekanik × hedef × modifikatör (mezo)
Her bölüm dört değişkenin birleşimidir; kombinasyon uzayı binlerce:
- **Biyom** (görsel ve fizik): 8 insan + 10 tür + 6 durum + ∞ fantastik.
- **Ana mekanik:** koşu, yüzme, trambolin, makine, impuls, rüya, boss.
- **Hedef:** uca ulaş · tüm notaları topla · süreye karşı · bir sesi eskort et (yavaş hareket eden "fısıltı"yı koru) · gürültü canavarını yen (boss) · gizli altın kokleayı bul · hiç hasar alma · belirli frekans jetonlarını sırayla topla (melodi bölümü: doğru sırada toplarsan gizli şarkı çalar).
- **Modifikatör** (bölüm 20'den sonra): ters yerçekimi, sis (görüş kısa), yankı (hareketler gecikmeli tekrar eder), hız x1.3, tek can, ayna (sağ-sol ters), gece (sadece ses dalgaları görünür), "işitme cihazı kapalı" (jetonlar görünmez, sadece duyulur: sesle oyna).

### 3.3 Parça kütüphanesi ve el yapımı dokunuş (mikro)
Bölümler, el yapımı **parçalardan** (chunk) kurulur: lansmanda 300 parça, her hafta +20. Parçalar zorluk, mekanik ve biyomla etiketlidir; üretici, bölümün "ritim eğrisini" (kolay-zor-nefes-zor-final) takip ederek parçaları dizer. Her 10. bölüm tamamen el yapımıdır (boss, hikâye, sürpriz). Seed, bölüm numarasına bağlıdır: herkes aynı bölümü oynar; bu paylaşım ve "şu bölümde takıldım" sohbetini mümkün kılar.

## 4. Zorluk ve akış
- Zorluk bölüm numarasıyla değil, **oyuncu performansıyla** ayarlanır (dinamik zorluk): son 5 bölümde 3 yıldız alıyorsa modifikatör ekle; iki kez kaybettiyse bir "nefes bölümü" ver.
- Her bölüm 1-3 dakika. Ölüm ucuz: kontrol noktası, anında yeniden dene.
- "Neredeyse" tasarımı: başarısızlıkta bitişe ne kadar kaldığı görünür ("%92 · 3 jeton kaldı"), tekrar deneme tek dokunuş.

## 5. Meta ilerleme (uzun vadeli sebep)
- **Odi seviyesi ve yetenek ağacı:** çift zıplama, uzun kayma, su altı nefesi, mıknatıs, kalkan, yankı görüşü. Yetenekler bölüm türleriyle etkileşir.
- **Yol arkadaşları:** küçük ses parçacıkları (Fısıltı, Çınlama, Bas, Tiz) her biri pasif yetenek; toplanır, geliştirilir. 40+ yol arkadaşı, koleksiyon defteri.
- **Gereçler:** işitme cihazı (kalkan), koklear implant (mıknatıs), kulaklık (hız), kulak tıkacı (gürültü bölümlerinde dokunulmazlık). Geliştirilebilir.
- **Kostümler:** Odi şapkaları ve renkleri; kozmetik, oyun gücü yok.
- **Frekans Kartları:** her biyomda toplanan kartlar; tamamlanan setler gerçek bilgi kartı açar ("Yarasalar 100 kHz'i duyar").
- **Yıldızlar:** bölüm başına 3; yıldız kapıları yeni yolculukları açar (geri dönüp 3 yıldız alma sebebi).

## 6. Hikâye
Odi, "Büyük Sessizlik"in yaklaştığı bir dünyada sesleri beyne taşıyan son parçacıklardan biridir. Her yolculuk bir "ses"tir: annenin ninnisi, ilk kelime, deniz sesi, bir arkadaşın adı. Hikâye kısa, duygusal, atlanabilir; bölüm sonlarında tek cümlelik "ses anıları".

## 7. Odyoloji dokusu (gizli öğretim)
Tonotopi (renk ve ses), kemikçik zinciri, kulak zarı, kıl hücreleri (hasar görünce bir daha büyümez: oyunda "gürültü bölümlerinde kaybedilen kıl hücresi geri gelmez" mekaniği), ses hızı ortamlara göre, yarasa ekolokasyonu, presbiakuzi, gürültü dozu. Her biri önce oyun hissi, sonra kart.
