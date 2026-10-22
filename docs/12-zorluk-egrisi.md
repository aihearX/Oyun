# 12 · Zorluk Eğrisi (ölçülen)

Ürün sahibinin geri bildirimi: "Oyunu genel olarak beğendim ama zorluk seviyelerini beğenmedim. Oyuncuyu alıştırmak için ilk
bölümler kolay olmalı, sonra giderek zorlaşmalı. Her ana bölümün (biyomun) son bölümleri zor olmalı. Her üst kademeye
geçildiğinde zorluk artmalı." Eski üretici zorluğu 1 → 40 arasında **doğrusal** artırıyor, odaları elle verilmiş 1-5 etiketiyle
seçiyor, değiştiricileri (tek can dahil) 15. bölümden sonra rastgele ekliyordu; ölçünce eğri düzensiz çıktı: alıştırma bölümleri 2-3'te
oyuncu başına ~0,6 can gidiyor, 6. bölüm (duvar öğreticisi) ve 13. bölüm (kanca öğreticisiyle birlikte zincir kanca odası) oyuncuların
%25'ini eliyor, 26. bölümde rastgele "tek can" değiştiricisi var, 40. boss ise 39'dan kolay (aşağıdaki "önce" sütunları).

Bu belge yeni eğrinin **hedefini**, **düğmelerini** ve **ölçümünü** anlatır. Kod: `packages/level-gen/src/curve.ts` (eğri ve
düğmeler), `level-gen/src/rooms.ts` (oda ölçüleri), `level-gen/src/generate.ts` (uygulama), `game-core/src/play/human.ts`
(insan benzeri oyuncu modeli), `tools/harness/zorluk.mjs` (ölçüm aracı), `game-core/src/play/zorluk-*.test.ts` (biçim testi).

![Zorluk eğrisi](img/zorluk-egrisi.svg)

## 1. Hedef biçim: yükselen testere dişi

- **Bölgeler** haritanın ana bölümleridir (biyom bölgeleri; 17 ve 20 kemikçik bölgesinde kalır): Dış Kulak 1-5, Kanal 6-8,
  Zar 9-12, Kemikçikler 13-20, Koklea Taban 21-23, Orta 24-26, Apeks 27-30, Sinir 31-33, Beyin Sapı 34-36, Korteks 37-40.
- **Alıştırma (1-3):** geniş zemin, kısa çukur (≤ 160 px), alçak diken, geniş iniş (≥ 100 px), **düşman yok** (3'te yalnız öğretici
  odadaki tek devriye), odada en çok iki beceri ailesi, en bağışlayıcı zamanlama; kitlenin her oyuncusu bitirir.
- **Bölge içi rampa:** bölgenin ilk bölümü yeni yeteneği yumuşakça öğretir (kısa bir "nefes" düşüşü), sonra zorluk tırmanır;
  bölgenin **son normal bölümü finaldir** (sınav): en zor gösteri parçası, sınav odaları, en çok oda, en sıkı zamanlama,
  sabit değiştirici (ileri bölgelerde).
- **Bölgeler arası:** her bölgenin girişi bir öncekinin girişinden, finali bir öncekinin finalinden yüksek. **Boss'lar büyük
  doruklardır:** 20 kendinden önceki her bölümden, 40 bütün oyundan zor ama kitlenin yarısından fazlası 3 canla yener.
  Boss'tan sonra (21) kısa bir nefes.

Hedef birimi **beklenen can kaybı (λ)**: insan modelinin bölümde kaybettiği ortalama can (bitiremeyen 3). Bölge girişi `lo`,
finali `hi`; aradaki bölümler `lo + (hi − lo)·u^1,3` (u: bölgedeki konum, 0 giriş … 1 final). Grafikteki hedef puan ≈ 3·λ + 0,5.

| Bölge | Bölümler | Giriş λ | Final λ |
|---|---|---|---|
| Dış Kulak | 1-5 | 0,01 | 0,20 |
| Kanal | 6-8 | 0,08 | 0,55 |
| Zar | 9-12 | 0,20 | 0,85 |
| Kemikçikler | 13-19 (+ boss 20: 1,60) | 0,30 | 1,00 |
| Koklea Taban | 21-23 | 0,35 | 1,10 |
| Koklea Orta | 24-26 | 0,45 | 1,20 |
| Koklea Apeks | 27-30 | 0,50 | 1,30 |
| Sinir | 31-33 | 0,55 | 1,40 |
| Beyin Sapı | 34-36 | 0,60 | 1,50 |
| Korteks | 37-39 (+ boss 40: 2,00) | 0,80 | 1,60 |

**İlk bölümlerin hedefi ilk kez oynayan kademeyle ölçülür** (§2): 1-3'te herkes bitirir ve oyuncu başına en çok 0,1 can
kaybeder, 4-6'da en az %90'ı bitirir (`play/zorluk-ilk.test.ts`). İlk iki bölge bu yüzden bir kademe aşağı çekildi (Dış Kulak
finali 0,30 → 0,20, Kanal 0,15-0,70 → 0,08-0,55); sonraki yapı (bölge rampaları, yükselen finaller, boss'lar) aynı.

**Final zinciri:** finaller 8 → 12 → 19 → 23 → 26 → 30 → 33 → 36 → 39 kesin yükselen bir zincirdir (her kademe bir öncekinden
~0,1 can zor), boss'lar zincirin üstünde iki büyük sıçrayıştır. Üretici finalde λ'yı doğrudan kullanır; tek istisna Kanal
finalidir (`gain: 0,65`: oda puanlarının toplamı orada zorluğu eksik tahmin ediyor, ölçülen değer hedefi aşıyordu).

## 2. Ölçüm: insan benzeri oyuncu modeli (`game-core/src/play/human.ts`)

Planlayıcı botun (`play/planner.ts`) "niyeti" + insan eli, aynı deterministik 1/60 sn adımı üzerinde:

- **Tepki gecikmesi:** yeni karar ancak 200-260 ms sonra uygulanabilir; o ana dek planlanmış girdiler değişmez. Süren basılı
  tutmanın bırakılışı (kanca, süzülme) tepki süresinden sonrası için yeniden zamanlanabilir.
- **Sınırlı ileri bakış:** 1,2-1,4 sn (ekranın sağ kenarı; bot 1,9 sn). Boss arenasında 0,6 sn: saldırının yönü ve türü
  ancak uyarı (telegraf) görünce bilinir — planlayıcı geleceği "bilmesin".
- **Zamanlama sapması:** her girdi N(0, σ) kadar erken/geç (σ 60-100 ms, en çok ±1,5σ); basılı tutma süresi ±%15-25 sapar.
- **Kusurlar:** %4-10 olasılıkla 100-200 ms geç kalma, %1-3 olasılıkla kaçan girdi (fark edilince tepki süresiyle düzeltilir).
- **Kare-mükemmel numara yok:** sapma, dar pencereli her çözümü doğal olarak cezalandırır.
- **Kitle:** her koşu (tohum) bir oyuncudur; beceri dört kademede ustadan (σ 60 ms, tepki 200 ms) acemiye (σ 100 ms, tepki 260 ms)
  döner — ortalama tepki ~230 ms, sapma ~80 ms. Gizli koklealara sapmaz (ana yol oyuncusu), notalara gider.
- **İlk kez oynayan kademe (`firstTimerOf`):** gerçek cihaz geri bildirimi ("ilk bölümler hâlâ çok zor") modelin ilk
  oyuncuyu fazla becerikli saydığını gösterdi. İlk bölümlerin hedefleri artık bu kademeyle ölçülür: tepki 320-450 ms, sapma σ
  120-160 ms, girdilerin %10-15'i 100-250 ms geç, %4-6'sı kaçar, %2-4'ü dokunuş yerine kazara yatay kaydırma olur (zıplama
  yutulur), ileri bakış ~0,9 sn; her oyuncu bu aralıklardan tohumla çekilir.
- **Öğretici ağır çekim:** oyundaki gibi yeni yeteneğin ilk anında oyun ×0,3 yavaşlar (en çok 8 gerçek sn, hareket yapılınca
  biter); model o arada tepki ve sapmayı oyun saatinde ×0,3 alır.
- **Faz:** zamanlamalı öğelerin (hareketli platform, düşman, nabız, ritim) varış anındaki evresi şansın işidir; her koşu saati
  rastgele bir evreden (0-12 sn) başlatır → zorluk evrelere göre beklenen değerdir (boss hariç).
- Tohumlu ve deterministik: aynı bölüm + tohum → aynı sonuç.

Ölçülenler (bölüm × tohum): bitirme (3 canla), kaybedilen can, düşme (yeniden doğma), **yakın kaçış** (tehlikeye/düşmana/mermiye
8 px'ten yakın hasarsız geçiş ve kenara 10 px'ten yakın iniş). **Zorluk puanı** (0-10) = 3 × ortalama can kaybı (bitiremeyen 3) +
yakın kaçış yoğunluğu (dakikada 20 = 1 puan, en çok 1). Tek tanım: `scoreRuns` (`play/human.ts`).

## 3. Düğmeler (`level-gen/src/curve.ts` → `knobsFor`, üretici uygular)

| Düğme | Ne yapar | Alıştırma (1-3) | Bölge girişi | Final / son |
|---|---|---|---|---|
| λ hedefi | beklenen can kaybı; oda seçiminin hedefi | ≤ 0,1 | `lo` | `hi` |
| Oda sayısı | bölüm uzunluğu (öğretici, kontrol noktası, mikro ve gösteri odaları hariç) | 4-5 | 4-7 | +1 (en çok 11) |
| Oda puanı hedefi / tavanı | ölçülen oda puanına (aşağıda) göre seçim; bölüm-içi bölümler ×0,7 / ×1 / ×1,25, her bölüm-içi bölümün son odası +0,5 | tavan 1,5 | hedef + 2,5 | hedef + 3,5 |
| Tek oda tavanı | bir odanın tahmini can kaybı ≤ max(0,07; λ/2): tek odalık ani sıçrama yok | | | |
| Mekanik ailesi | bir odada birleşebilen beceri ailesi (çukur, diken, düşman, zamanlama, duvar, süzülme, zar, kanca, çakılma, geri dönüş, su, kayma, darbe, çevirme, frekans) | 2 | 2-7 | sınırsız |
| Düşman türleri | izinli türler: devriye 3+, uçan 4+, zıplayan 9+, atıcı 13+, kalkanlı 15+ | yok (3: devriye) | | |
| Zemin boşluğu / iniş | odada en geniş çukur ve boşluk üstündeki en dar basamak | ≤ 160 / ≥ 100 px | 4-8: ≤ 230 / ≥ 60 px | serbest |
| Sıkılık | 0 (bağışlayıcı) … 1 (sıkı) = 0,55 × genel ilerleme + 0,45 × bölgedeki konum; aşağıdaki geometri ve zamanlama ondan türer | ~0 | düşük | yüksek |
| Diken genişliği | ×0,75 … ×1,5 (yalnız zemindeki diken, zeminden taşmaz) | dar | | geniş |
| Çukur genişliği | ×0,8 … ×1,2 (yalnız içi boş zemin çukuru, en çok 190 px; duvar odalarında değil) | dar | | geniş |
| Basamak genişliği | hareketli/ritim/ufalanan/yankı basamağı ×1,25 … ×0,8 (en az 60 px) | geniş | | dar |
| Ufalanma gecikmesi | çatlak zemin 0,7 … 0,36 sn sonra düşer (motor varsayılanı 0,4) | 0,7 | | 0,36 |
| Zar penceresi | zara değince dokunma penceresi 0,17 … 0,11 sn (varsayılan 0,12) | | 0,17 | 0,11 |
| Düşman temposu | devriye hızı, uçan salınımı, atıcı ve zıplayan temposu ×0,75 … ×1,15 | | yavaş | hızlı |
| Platform temposu | hareketli platform ve sürüklenen tehlike ×0,8 … ×1,12 | | | |
| Gösteri parçası | bölge girişinde biyomun en kolay, finalde en zor gösterisi (tahmini can kaybı ≤ λ/2) | İlk Ninni Yolu | en kolay | en zor |
| Sınav odası | yalnız bölge finalinde, gösteriden hemen önce: Kanal `kn-damla-asansor`, Zar `zr-ritim-merdiven` + `zr-ritim-koridor`, Kemikçikler `km-disli`, Koklea `k1-sinav-havuz` / `k3-sinav-bas`, Sinir `sn-sinav` + `sn-sinav-kopru`, Beyin Sapı `bs-sinav`, Korteks `kx-sinav-karma` + `kx-sinav-ritim`. Zar, Koklea Orta, Koklea Apeks, Sinir, Beyin Sapı ve Korteks finallerinde iki sınav; Beyin Sapı girişi (34) ve Korteks'in diğer bölümleri (37, 38) birer "prova" sınavı (tahminen en ağırı) alır; yardım kademesi başına bir sınav düşer | – | – | 1-2 oda |
| Kalibrasyon varyantı | aynı düğmelerle üretilebilen bölümlerden, insan modeliyle ölçülünce hedefe en yakın olanı; finalde hedefin altı, girişte üstü ek cezalı (`level-gen/src/kalibrasyon.ts`, üretilmiş). Önceki iki bölümün odalarına bakan çeşitlilik kuralı komşuların varsayılan varyantını kullanır: bir bölümün kalibrasyonu komşusunu değiştirmez | | | |
| Değiştiriciler | yalnızca ileri bölgelerde, çoğunlukla finallerde, sabit tablo (rastgele değil); tek can ve ters yerçekimi yolculukta yok | yok | yok | 19 sis · 23 sis · 26 gece · 29 sis · 30 hız+yankı · 32 gece · 33 hız+yankı · 35 sis · 36 yankı · 38 gece · 39 hız+gece |
| Boss | can, uyarı (telegraf, en az ×0,6) ve saldırı temposu (mermi hızı √tempo) | | | 20: can 14, uyarı ×1,0, tempo ×1,2 · 40: can 32, uyarı ×0,8, tempo ×1,8 |
| Kontrol noktası / güvenli zemin | her bölüm 3 bölüm-içi bölüm, 2. ve 3. kontrol noktası odasıyla başlar; düşen son güvenli zemine döner | | | |

Bölüm başına değerler (varsayılan profil):

<!-- dugmeler:basla -->
| Bölüm | λ hedef | Oda | Oda puanı hedefi / tavan | Aile ≤ | Sıkılık | Diken × | Çukur × | Basamak × | Ufalanma (sn) | Zar penceresi (sn) | Düşman / platform temposu | Değiştirici |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.01 | 4 | 0.4 / 1.5 | 2 | 0.00 | 0.75 | 0.8 | 1.25 | 0.7 | 0.17 | 0.75 / 0.8 | – |
| 2 | 0.04 | 5 | 0.6 / 1.5 | 2 | 0.13 | 0.84 | 0.85 | 1.19 | 0.66 | 0.162 | 0.8 / 0.84 | – |
| 3 | 0.09 | 6 | 0.8 / 1.5 | 2 | 0.25 | 0.94 | 0.9 | 1.14 | 0.61 | 0.155 | 0.85 / 0.88 | – |
| 4 | 0.14 | 5 | 1.0 / 3.5 | 3 | 0.38 | 1.03 | 0.95 | 1.08 | 0.57 | 0.147 | 0.9 / 0.92 | – |
| 5 | 0.20 | 6 | 1.3 / 4.8 | 9 | 0.51 | 1.13 | 1 | 1.02 | 0.53 | 0.14 | 0.95 / 0.96 | – |
| 6 | 0.08 | 3 | 0.8 / 3.3 | 2 | 0.07 | 0.8 | 0.83 | 1.22 | 0.68 | 0.166 | 0.78 / 0.82 | – |
| 7 | 0.27 | 7 | 1.6 / 4.1 | 3 | 0.31 | 0.8 | 0.92 | 1.11 | 0.59 | 0.151 | 0.87 / 0.9 | – |
| 8 | 0.36 | 9 | 2.0 / 5.5 | 9 | 0.55 | 0.8 | 1.02 | 1 | 0.51 | 0.137 | 0.97 / 0.98 | – |
| 9 | 0.20 | 6 | 1.3 / 3.8 | 3 | 0.11 | 0.8 | 0.85 | 1.2 | 0.66 | 0.163 | 0.8 / 0.84 | – |
| 10 | 0.36 | 7 | 2.0 / 4.5 | 3 | 0.28 | 0.8 | 0.91 | 1.13 | 0.61 | 0.16 | 0.86 / 0.89 | – |
| 11 | 0.58 | 7 | 3.0 / 5.5 | 4 | 0.44 | 0.8 | 0.98 | 1.05 | 0.55 | 0.16 | 0.93 / 0.94 | – |
| 12 | 0.85 | 9 | 4.1 / 7.6 | 9 | 0.61 | 0.8 | 1.04 | 0.98 | 0.49 | 0.16 | 0.99 / 0.99 | – |
| 13 | 0.30 | 6 | 1.7 / 4.2 | 3 | 0.17 | 0.88 | 0.87 | 1.17 | 0.64 | 0.16 | 0.82 / 0.85 | – |
| 14 | 0.37 | 7 | 2.0 / 4.5 | 4 | 0.26 | 0.94 | 0.9 | 1.13 | 0.61 | 0.155 | 0.85 / 0.88 | – |
| 15 | 0.47 | 7 | 2.5 / 5.0 | 4 | 0.35 | 1.01 | 0.94 | 1.09 | 0.58 | 0.149 | 0.89 / 0.91 | – |
| 16 | 0.58 | 7 | 3.0 / 5.5 | 4 | 0.44 | 1.08 | 0.97 | 1.05 | 0.55 | 0.144 | 0.92 / 0.94 | – |
| 17 | 0.71 | 8 | 3.5 / 6.0 | 5 | 0.53 | 1.14 | 1.01 | 1.01 | 0.52 | 0.138 | 0.96 / 0.97 | – |
| 18 | 0.85 | 8 | 4.2 / 6.7 | 5 | 0.61 | 1.21 | 1.05 | 0.97 | 0.49 | 0.133 | 1 / 1 | – |
| 19 | 1.00 | 10 | 4.8 / 8.3 | 9 | 0.70 | 1.28 | 1.08 | 0.93 | 0.46 | 0.128 | 1.03 / 1.03 | sis |
| 20 | 1.60 | boss | can 14, uyarı ×1, tempo ×1.2 | – | – | – | – | – | – | – | – | – |
| 21 | 0.35 | 7 | 1.9 / 4.4 | 4 | 0.28 | 0.96 | 0.91 | 1.12 | 0.6 | 0.153 | 0.86 / 0.89 | – |
| 22 | 0.65 | 8 | 3.3 / 5.8 | 5 | 0.52 | 1.14 | 1.01 | 1.02 | 0.52 | 0.139 | 0.96 / 0.97 | – |
| 23 | 1.10 | 10 | 5.2 / 8.7 | 9 | 0.76 | 1.32 | 1.1 | 0.91 | 0.44 | 0.124 | 1.05 / 1.04 | sis |
| 24 | 0.45 | 7 | 2.4 / 4.9 | 5 | 0.32 | 0.99 | 0.93 | 1.1 | 0.59 | 0.151 | 0.88 / 0.9 | – |
| 25 | 0.75 | 8 | 3.7 / 6.2 | 6 | 0.56 | 1.17 | 1.03 | 1 | 0.51 | 0.136 | 0.98 / 0.98 | – |
| 26 | 1.20 | 10 | 5.7 / 9.2 | 9 | 0.80 | 1.35 | 1.12 | 0.89 | 0.43 | 0.122 | 1.07 / 1.06 | gece |
| 27 | 0.50 | 8 | 2.6 / 5.1 | 5 | 0.37 | 1.02 | 0.95 | 1.09 | 0.58 | 0.148 | 0.9 / 0.92 | – |
| 28 | 0.69 | 8 | 3.4 / 5.9 | 6 | 0.53 | 1.15 | 1.01 | 1.01 | 0.52 | 0.138 | 0.96 / 0.97 | – |
| 29 | 0.97 | 9 | 4.7 / 7.2 | 6 | 0.69 | 1.27 | 1.08 | 0.94 | 0.46 | 0.128 | 1.03 / 1.02 | sis |
| 30 | 1.30 | 11 | 6.1 / 9.6 | 9 | 0.86 | 1.39 | 1.14 | 0.86 | 0.41 | 0.118 | 1.09 / 1.07 | hiz, yanki |
| 31 | 0.55 | 8 | 2.8 / 5.3 | 6 | 0.42 | 1.07 | 0.97 | 1.06 | 0.56 | 0.145 | 0.92 / 0.94 | – |
| 32 | 0.90 | 9 | 4.3 / 6.8 | 7 | 0.66 | 1.25 | 1.06 | 0.95 | 0.47 | 0.13 | 1.01 / 1.01 | gece |
| 33 | 1.40 | 11 | 6.6 / 10.1 | 9 | 0.90 | 1.43 | 1.16 | 0.84 | 0.39 | 0.116 | 1.11 / 1.09 | hiz, yanki |
| 34 | 0.60 | 9 | 3.0 / 5.5 | 6 | 0.47 | 1.1 | 0.99 | 1.04 | 0.54 | 0.142 | 0.94 / 0.95 | – |
| 35 | 0.97 | 10 | 4.7 / 7.2 | 7 | 0.70 | 1.28 | 1.08 | 0.93 | 0.46 | 0.128 | 1.03 / 1.03 | sis |
| 36 | 1.50 | 11 | 7.0 / 10.5 | 9 | 0.94 | 1.46 | 1.18 | 0.83 | 0.38 | 0.113 | 1.13 / 1.1 | yanki |
| 37 | 0.80 | 9 | 3.9 / 6.4 | 7 | 0.51 | 1.13 | 1 | 1.02 | 0.53 | 0.14 | 0.95 / 0.96 | – |
| 38 | 1.12 | 10 | 5.3 / 7.8 | 8 | 0.75 | 1.31 | 1.1 | 0.91 | 0.45 | 0.125 | 1.05 / 1.04 | gece |
| 39 | 1.60 | 11 | 7.4 / 10.9 | 9 | 0.99 | 1.49 | 1.19 | 0.81 | 0.36 | 0.111 | 1.14 / 1.12 | hiz, gece |
| 40 | 2.00 | boss | can 32, uyarı ×0.8, tempo ×1.8 | – | – | – | – | – | – | – | – | – |
<!-- dugmeler:bitir -->

### Bölüm nasıl kurulur

1. Düğmeler (yukarıdaki tablo) ve uyarlanabilir yardım → λ, oda sayısı, sıkılık, sınav sayısı.
2. Havuz: biyoma uyan, açık yeteneklerle oynanabilen odalar; düğmelere uymayanlar (aile, düşman türü, çukur/iniş, puan tavanı, tek
   oda tavanı) elenir, yetmezse kısıtlar kademeli gevşer.
3. Gösteri ve (finalde) sınav odaları seçilir; kalan **can kaybı bütçesi** = λ − gösteri − sınav − öğretici − mikro payı, bölüm-içi
   bölümlere %27 / %33 / %40 dağıtılır. Her oda, bütçeden ona düşen paya en yakın **tahmini can kaybıyla** (ölçülen) seçilir.
4. Tempo (ölü yol yok), risk yolu, tırmanış, zar kuralları, koklea ve nota sınırları eskisi gibi; en sonda geometri ve zamanlama
   düğmeleri odaların varlıklarına yazılır (oda tanımları değişmez, motor bunları `props` üzerinden okur).

### Oda puanları (hesaplanır, tahmin edilmez)

`packages/content/src/chunks/puanlar.ts` **üretilmiş** dosyadır (`node tools/harness/zorluk.mjs --odalar`): her oda tek başına
(önünde/arkasında düz zemin), rastgele başlangıç evresiyle 16'şar kez oynanır — acemi modelle düğmesiz, oyuncu kitlesiyle en
bağışlayıcı (sıkılık 0) ve en sıkı (sıkılık 1) düğmelerle. `level-gen/src/rooms.ts` bundan ve odanın yapısından (aileler, düşman
türleri, en geniş çukur, en dar iniş, tehlike ve zamanlamalı öğe sayısı) **oda puanını** (0-10) ve verilen sıkılıktaki **tahmini
can kaybını** hesaplar. Ölçüm olmayan (yeni) oda yapısından kaba bir tahmin alır; oda ekleyince ölçümü yenileyin.

Yeni odalar: alıştırma odaları `dk-cimen`, `dk-kucuk-cukur`, `dk-alcak-basamak`, `dk-tuy-yolu`, alıştırma gösterisi `dk-sp-ilk-yol`;
bölge finalleri için **sınav odaları** `k1-sinav-havuz`, `k3-sinav-bas`, `sn-sinav`, `bs-sinav`, `sn-sinav-kopru`, `kx-sinav-ritim`, `kx-sinav-karma`
(öğrenilen her şey bir arada; her tehlike görünür ve telgraflı, gizli koklea ana yolda değil).

## 4. İlk bölümlerin yardımları ve uyarlanabilir yardım

**İlk bölümler (1-12; `curve.ts` → `assistFor`, `LevelSpec.assist`, motor deterministik kalır):**

| Bölüm | Koşu (px/sn) | Coyote / tampon (sn) | Can götürmeyen düşüş | Geri dönüş | İçerik |
|---|---|---|---|---|---|
| 1 | 190 | 0,16 / 0,20 | ilk 2 | açık değil | diken, düşman, tehlike yok (zemindeki diken 60-70 px çukura döner); çukur ≤ 70 px |
| 2 | 205 | 0,16 / 0,20 | ilk 2 | yalnız gerektiği yerde | öğretici odası dışında diken/düşman yok; çukur ≤ 70 px |
| 3 | 220 | 0,16 / 0,20 | ilk 1 | yalnız gerektiği yerde | öğretici odası dışında diken/düşman yok; çukur ≤ 90 px |
| 4-5 | 235 / 242 | 0,13 / 0,15 | ilk 1 | yalnız gerektiği yerde | kontrol noktası odaları güvenli; iki oda kısa |
| 6 | 248 | 0,12 / 0,14 | ilk 1 | serbest | kontrol noktası odası güvenli; iki oda kısa; serumen/perde dar, diken ≤ ×0,8 |
| 7-8 | 255 / 260 | 0,12 / 0,14 | ilk 2 | serbest | serumen yığını dar ve alçak (52 px), perde ×0,7, diken ≤ ×0,8; kontrol noktası odası güvenli |
| 9-12 | 260 | 0,12 / 0,14 | ilk 1 | serbest | zar penceresi ≥ 0,16 sn ("Mükemmel" yalnız ödül); serumen/perde dar, diken ≤ ×0,8; kontrol noktası odası güvenli |
| 13+ | 260 | 0,10 / 0,12 | – | serbest | – |

- **Her odada kontrol noktası** (1-12); 1-3'te hareketli, ritim, ufalanan, yankı ve asansör basamağı yok.
- **Öğretici odasında can gitmez** (1-12): yeni hareketi öğrenirken çarpma yalnız geri iter, düşüş aynı yerden yeniden başlatır
  (en çok 3 kez — boşta oyuncu orada sonsuza dek kalmasın).
- **Kazara kaydırma döndürmez:** geri dönüş 2. bölümde öğretilir (öncesinde hiç yok); 1-5'te yalnız kapısı kapalı bir temas
  anahtarı ya da frekans kapısı yakınken çalışır (ileri yöne dönüş her zaman serbest); yatay kaydırma eşiği 42 yerine 64 px;
  basamağa takılan kahraman geri koşmaz, zıplamayı bekler (kapıda döner). Normal odalarda dönüş bulmacası 6. bölümden itibaren.
- **Öğretici ağır çekim** ×0,35 yerine ×0,3 ve 6 yerine en çok 8 gerçek saniye.
- Yavaş koşuda tempo kuralı aynı süreyi tutar: sessiz yol sınırı koşu hızıyla ölçeklenir, yayın/fırlatıcının uçuşu altında kalan
  diken girdi sayılmaz, odanın kendi sessiz yolları sınırı aşan odalar ilk bölümlerde seçilmez.

**Diken seyrekliği (altıncı geçiş; oyuncu: "yerden çıkan kırmızı dikenler oyunu çok zorlaştırıyor"):** oyuncunun "yerden
çıkan diken" diye gördüğü öğe kırmızı parlayan `spike` (zemin ve platform dikeni, havuz tabanı dikeni); serumen yığını ve
gürültü bulutları gözlü bulut olarak çizilir, nabız (zamanlı) tehlikeler yalnız Sinir/Beyin Sapı/Korteks odalarında var.
Üretici (`generate.ts` → `capSpikes`) tempo kuralından önce uygular, sonradan eklenen mikro odalara ikinci kez:

| Bölümler | Önce: diken (1000 px başına) | Sonra | Kural |
|---|---|---|---|
| 1-5 | 34 (0,59) | 0 | hiç diken yok: zemindeki diken 60-110 px'lik çukura döner, yükseltideki kalkar |
| 6-12 | 93 (0,94) | 18 (0,18) | bölüm-içi bölüm başına en çok bir, yalnız zeminde; kontrol noktası ve geri dönüş odasında, inişten sonraki 160 px'te hiç |
| 13-19 | 137 (1,31) | 56 (0,54) | her beş dikenden ikisi kalır (kontrol noktası odasında hiç); havuz tabanı dikeni kalır |
| 21-30 | 225 (1,26) | 98 (0,56) | 〃 |
| 31-39 | 181 (0,95) | 75 (0,39) | 〃 |

Kalkan zemin dikeni, iki yanda en az 100 px zemin kalıyorsa çukura döner (zıplama ritmi ve tempo kuralı korunur; anahtar ve
kapının 200 px yakınında çukur açılmaz); dönüşemeyen diken, kalkınca odada zorunlu engeller arasında 480 px'ten uzun boşluk
bırakacaksa kalır. Kalan dikenler daha bağışlayıcı: vuruş kutusu görselin ortadaki %60'ı ve uç bandı (eskiden genişliğin
tamamı), 6-12'de her odada dikene ilk değiş yalnız geri iter ("Dikkat, diken!"). Nabız tehlikesi açılmadan 0,65 sn önce
parlar ve titrer (eskiden 0,45 sn, görsel uyarı yoktu). Denetim: `level-gen/src/diken.test.ts`.

**Kıl perdesi okunur hâle geldi (oyuncu: "5. bölümdeki içinde şimşek olan bulut ne, nasıl geçilir?"):** altından kayılan
asılı tehlike (`curtain`: G-170'ten G-24'e) genel gürültü bulutuyla (şimşek, kızgın gözler) aynı çiziliyordu. Artık
`props.curtain` ile işaretlenir ve ayrı çizilir (`render/items.ts` → `buildCurtain`): tutturma çubuğundan sarkan tül, net
beyaz alt kenar, altında aydınlık açıklık ve aşağı oklar, "KAY ↓" yazısı. Geometri belirsiz değil: üstünde yer varsa perde
G-290'a uzar (tam zıplama 163 px: aşılamaz), 1-12'de alt kenar G-27 (kayan kahramanla 17 px pay; ayaktaki kahraman değer).
3-8'de bölümün ilk üç perdesinden ~320 px önce el işaretli "Aşağı kaydır: altından kay" ipucu çıkar. **5. bölümde kayma
tazelenir:** ilk perdeden 260 px önce (önünde kontrol noktası, en az 300 px koşu payı) 3. bölümdeki dersin aynısı —
ağır çekim, büyük aşağı kaydırma eli, "Aşağı kaydır: perdenin altından kay!". Ders önceden tamamlanmış olsa da gösterilir,
bir koşuda bir kez (yeniden doğunca tekrar açılmaz); oyuncu 5. bölümde iki perdeyi hasarsız geçince kalıcı olarak kapanır
(`tazele-kayma` anahtarı). Öncesi / sonrası:

![Perde önce](img/perde-once.png) ![Perde sonra](img/perde-sonra.png)

**Uyarlanabilir yardım (profil):**

Profil artık yalnızca **yumuşak bir yardım**dır (`generateLevel` → `levelKnobs`):
- aynı bölümde üst üste **3 başarısızlık → bir kademe** kolaylaştırır (λ ×0,72, bir oda eksik, oda tavanı ×0,75, sıkılık −0,15;
  finalden bir sınav odası düşer, yalnız görsel değiştiriciler kalır), **5 başarısızlık → iki kademe**;
- usta oyuncu (son 5 bölüm ortalaması ≥ 2,8 yıldız) yalnızca 6. bölümden sonra, final ve boss olmayan bölümlerde çok küçük bir
  ek alır (λ +0,06). **İlk bölümler asla zorlaşmaz.**

## 5. Dürüstlük kuralları

- Fizik 13. bölümden itibaren sabittir (koşu 260 px/sn, coyote 0,1 sn, tampon 0,12 sn); ilk on iki bölümün yardımları (§4) bölüm
  düğmesidir ve motor deterministik kalır: zorluk hissi değil, içerik ve pencere genişliği değişir.
- Bağışlayıcı vuruş kutuları korunur (tehlike görselin 8 px içi, nota yarıçapı geniş). Her tehlike görünür ve uyarılıdır:
  nabız tehlikesi 0,65 sn (parlama + titreme), atıcı 0,55 sn önce titrer; boss uyarıları en az ×0,6 (≥ 0,45 sn, tepki süresinin iki katı).
- Kör zıplama yok: çukur en çok 190 px (tam zıplama 221 px), geometri düğmeleri duvar odalarına ve içinde etkin öğe olan
  çukurlara dokunmaz; tek oda bölümün can bütçesinin yarısını aşamaz.
- Mükemmel planlayıcı bot 40 bölümün hepsini bitirir; dokunmayan oyuncu hiçbirini bitiremez (kabul ölçütü değişmedi).
- Boss arenası kapalıdır: saplanan yumruk kahramanın üstüne inerse kahraman yumruğun en yakın kenarına (arena içinde) alınır;
  eskiden çarpışma onu sağ duvarın ötesine itip "düşme" ile can kaybettirebiliyordu (`play/boss.test.ts` → arena sınırı).
- Gizli koklea rafları ana yolda değildir ama ulaşılabilir: duvar odalarının, raflı gösterilerin ve `gn-geri-anahtar`'ın
  koklealarına hedefe yönelik planlayıcı ulaşır (`play/rooms.test.ts` → koklea rafları). Kuyu odalarında (`gn-kuyu`,
  `kn-kuyu-dusman`, `kx-kuyu-cevir`) koklea kuyunun tepesinden sol yan rafa alındı (tırmanan ana yol oyuncusu artık istemeden
  almıyordu); `gn-geri-anahtar`'da raf anahtarın sağına, kapıya dönüş yoluna alındı (soldaki raf botu anahtarı kaçırıp geri
  koşmaya sürüklüyordu).

## 6. Sonuç: önce / sonra

**İlk kez oynayan oyuncu (1-12):**

<!-- ilk:basla -->
_İlk kez oynayan kademe (§2), 48 oyuncu × bölüm; önce: aynı kademe eski oyunda (48 oyuncu)._

| Bölüm | Hedef | Önce: bitirme | Önce: can kaybı | Sonra: bitirme | Sonra: can kaybı ± SE |
|---|---|---|---|---|---|
| 1 | 100%, ≤ 0,1 can | 94% | 0.67 | 100% | 0.00 ± 0.00 |
| 2 | 100%, ≤ 0,1 can | 90% | 0.88 | 100% | 0.00 ± 0.00 |
| 3 | 100%, ≤ 0,1 can | 88% | 1.10 | 100% | 0.04 ± 0.04 |
| 4 | ≥ %90 | 71% | 1.52 | 100% | 0.15 ± 0.05 |
| 5 | ≥ %90 | 44% | 2.44 | 100% | 0.56 ± 0.10 |
| 6 | ≥ %90 | 60% | 2.00 | 100% | 0.29 ± 0.08 |
| 7 | ≥ %80 | 46% | 2.23 | 85% | 1.21 ± 0.15 |
| 8 | ≥ %70 | 38% | 2.46 | 85% | 1.21 ± 0.15 |
| 9 | ≥ %65 | 94% | 0.81 | 100% | 0.10 ± 0.05 |
| 10 | ≥ %65 | 90% | 1.00 | 96% | 0.35 ± 0.11 |
| 11 | ≥ %65 | 46% | 2.15 | 94% | 0.67 ± 0.14 |
| 12 | ≥ %65 | 40% | 2.40 | 73% | 1.50 ± 0.17 |
<!-- ilk:bitir -->

**Oyuncu kitlesi (40 bölüm):**

<!-- tablo:basla -->
_Ölçüm: 48 oyuncu (tohum) × 40 bölüm (bölüm tuzu 0 — oyuncunun gördüğü bölüm), varsayılan profil; önce: 24 tohum, eski eğri._

| Bölüm | Bölge | Rol | Hedef | Önce: bitirme | Önce: can kaybı | Önce: puan | Sonra: bitirme | Sonra: can kaybı ± SE | Sonra: yakın/dk | Sonra: puan ± SE |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dış Kulak | giriş (nefes) | 0.5 | 100% | 0.21 | 1.4 | 100% | 0.00 ± 0.00 | 6.6 | 0.3 ± 0.0 |
| 2 | Dış Kulak |  | 0.6 | 100% | 0.54 | 2.4 | 100% | 0.00 ± 0.00 | 8.3 | 0.4 ± 0.0 |
| 3 | Dış Kulak |  | 0.8 | 100% | 0.63 | 2.9 | 100% | 0.00 ± 0.00 | 7.6 | 0.4 ± 0.0 |
| 4 | Dış Kulak |  | 0.9 | 96% | 0.58 | 2.5 | 100% | 0.04 ± 0.03 | 12.6 | 0.8 ± 0.1 |
| 5 | Dış Kulak | **final** | 1.1 | 96% | 0.54 | 2.5 | 100% | 0.15 ± 0.05 | 13.4 | 1.1 ± 0.2 |
| 6 | Kulak Kanalı | giriş (nefes) | 0.7 | 75% | 1.21 | 4.4 | 100% | 0.06 ± 0.04 | 8.7 | 0.6 ± 0.1 |
| 7 | Kulak Kanalı |  | 1.3 | 88% | 1.00 | 3.6 | 100% | 0.15 ± 0.06 | 9.7 | 0.9 ± 0.2 |
| 8 | Kulak Kanalı | **final** | 2.1 | 100% | 0.63 | 2.6 | 100% | 0.13 ± 0.06 | 10.7 | 0.9 ± 0.2 |
| 9 | Kulak Zarı | giriş (nefes) | 1.1 | 100% | 0.08 | 0.6 | 100% | 0.00 ± 0.00 | 5.4 | 0.3 ± 0.0 |
| 10 | Kulak Zarı |  | 1.6 | 100% | 0.29 | 1.2 | 100% | 0.00 ± 0.00 | 5.4 | 0.3 ± 0.0 |
| 11 | Kulak Zarı |  | 2.3 | 100% | 0.21 | 1.0 | 100% | 0.08 ± 0.05 | 5.1 | 0.5 ± 0.2 |
| 12 | Kulak Zarı | **final** | 3.0 | 100% | 0.21 | 1.0 | 100% | 0.21 ± 0.07 | 6.7 | 1.0 ± 0.2 |
| 13 | Kemikçikler | giriş (nefes) | 1.4 | 75% | 1.54 | 5.2 | 100% | 0.29 ± 0.08 | 7.0 | 1.2 ± 0.2 |
| 14 | Kemikçikler |  | 1.6 | 88% | 0.83 | 3.0 | 96% | 0.52 ± 0.12 | 8.6 | 2.0 ± 0.4 |
| 15 | Kemikçikler |  | 1.9 | 100% | 0.75 | 2.6 | 98% | 0.31 ± 0.09 | 6.4 | 1.3 ± 0.3 |
| 16 | Kemikçikler |  | 2.3 | 96% | 0.79 | 3.0 | 94% | 0.42 ± 0.11 | 7.8 | 1.6 ± 0.3 |
| 17 | Kemikçikler |  | 2.6 | 96% | 0.54 | 2.1 | 94% | 0.77 ± 0.13 | 9.2 | 2.8 ± 0.4 |
| 18 | Kemikçikler |  | 3.1 | 96% | 0.79 | 2.7 | 92% | 0.73 ± 0.13 | 10.2 | 2.7 ± 0.4 |
| 19 | Kemikçikler | **final** | 3.5 | 100% | 0.63 | 2.3 | 88% | 0.98 ± 0.15 | 10.3 | 3.5 ± 0.4 |
| 20 | Kemikçikler | **boss** | 5.3 | 63% | 1.67 | 5.1 | 77% | 1.60 ± 0.15 | 1.7 | 4.9 ± 0.5 |
| 21 | Koklea · Taban | giriş (nefes) | 1.6 | 100% | 0.21 | 1.1 | 100% | 0.25 ± 0.07 | 6.5 | 1.1 ± 0.2 |
| 22 | Koklea · Taban |  | 2.5 | 100% | 0.50 | 2.1 | 100% | 0.42 ± 0.08 | 6.7 | 1.6 ± 0.2 |
| 23 | Koklea · Taban | **final** | 3.8 | 92% | 0.58 | 2.6 | 92% | 1.10 ± 0.13 | 9.7 | 3.8 ± 0.4 |
| 24 | Koklea · Orta | giriş (nefes) | 1.9 | 100% | 0.29 | 1.3 | 98% | 0.38 ± 0.10 | 6.5 | 1.5 ± 0.3 |
| 25 | Koklea · Orta |  | 2.8 | 92% | 0.54 | 2.3 | 90% | 0.65 ± 0.15 | 7.2 | 2.3 ± 0.4 |
| 26 | Koklea · Orta | **final** | 4.1 | 67% | 1.00 | 3.4 | 77% | 1.23 ± 0.17 | 9.9 | 4.2 ± 0.5 |
| 27 | Koklea · Apeks | giriş (nefes) | 2.0 | 100% | 0.38 | 1.6 | 100% | 0.17 ± 0.06 | 6.0 | 0.8 ± 0.2 |
| 28 | Koklea · Apeks |  | 2.6 | 100% | 0.13 | 0.9 | 98% | 0.31 ± 0.09 | 9.6 | 1.4 ± 0.3 |
| 29 | Koklea · Apeks |  | 3.4 | 100% | 0.21 | 1.2 | 94% | 0.63 ± 0.13 | 8.6 | 2.3 ± 0.4 |
| 30 | Koklea · Apeks | **final** | 4.4 | 100% | 0.38 | 1.7 | 75% | 1.35 ± 0.17 | 10.0 | 4.6 ± 0.5 |
| 31 | İşitme Siniri | giriş (nefes) | 2.1 | 92% | 0.54 | 2.1 | 100% | 0.31 ± 0.09 | 8.0 | 1.3 ± 0.3 |
| 32 | İşitme Siniri |  | 3.2 | 100% | 0.25 | 1.4 | 98% | 0.33 ± 0.10 | 10.0 | 1.5 ± 0.3 |
| 33 | İşitme Siniri | **final** | 4.7 | 92% | 0.58 | 2.3 | 71% | 1.42 ± 0.18 | 13.0 | 4.9 ± 0.5 |
| 34 | Beyin Sapı | giriş (nefes) | 2.3 | 96% | 0.67 | 2.7 | 96% | 0.44 ± 0.11 | 12.3 | 1.9 ± 0.3 |
| 35 | Beyin Sapı |  | 3.4 | 100% | 0.33 | 1.5 | 90% | 0.90 ± 0.15 | 8.8 | 3.1 ± 0.4 |
| 36 | Beyin Sapı | **final** | 5.0 | 100% | 0.67 | 2.8 | 67% | 1.58 ± 0.17 | 12.0 | 5.4 ± 0.5 |
| 37 | İşitme Korteksi | giriş (nefes) | 2.9 | 96% | 0.54 | 2.1 | 96% | 0.50 ± 0.12 | 7.9 | 1.9 ± 0.4 |
| 38 | İşitme Korteksi |  | 3.9 | 100% | 0.33 | 1.4 | 90% | 0.75 ± 0.14 | 8.9 | 2.7 ± 0.4 |
| 39 | İşitme Korteksi | **final** | 5.3 | 92% | 0.38 | 1.7 | 63% | 1.65 ± 0.18 | 8.6 | 5.4 ± 0.5 |
| 40 | İşitme Korteksi | **boss** | 6.5 | 96% | 0.50 | 1.5 | 60% | 1.98 ± 0.15 | 0.0 | 5.9 ± 0.4 |
<!-- tablo:bitir -->

## 7. Komutlar

```bash
node tools/harness/zorluk.mjs --odalar --k 16            # oda ölçümü → packages/content/src/chunks/puanlar.ts (~12 dk, 4 çekirdek; --ids a,b yalnız yeni odalar)
node tools/harness/zorluk.mjs --kalibre --k 16 --v 10    # bölüm başına varyant → packages/level-gen/src/kalibrasyon.ts (~40 dk; --levels 8,12 kısmi)
node tools/harness/zorluk.mjs --bolumler --k 48 --tag sonra   # 40 bölüm × 48 oyuncu (~30 dk)
node tools/harness/zorluk.mjs --bolumler --levels 1-12 --k 48 --ilk 1 --tag ilk   # ilk kez oynayan kademe (1-12)
node tools/harness/zorluk.mjs --belge --once once --sonra sonra   # bu belgedeki tablolar + docs/img/zorluk-egrisi.svg (ilk.json varsa ilk kez oynayan tablosu da)
```
`npm test` içindeki `play/zorluk-*.test.ts`, eğrinin biçimini (alıştırma kolay, bölge finali > bölge girişi, girişler ve finaller
yükselir, final grupları zinciri (8,12) < (19,23) < (26,30) < (33,36,39), boss'lar doruk, 40 en zor ama ≥ %50 bitirilir) sabit tohumlarla ve alt örneklemle denetler.

## 8. Sonuç özeti ve bilinen sınırlar

Sayılar 48 oyuncuyla ölçülen ortalama can kaybıdır (± standart hata); bölgeler arası farkları okurken SE ~0,1-0,17'dir.

- **Diken ve perde geçişi (altıncı geçiş, oyuncu geri bildirimi: "yerden çıkan kırmızı dikenler çok zorlaştırıyor"; "5. bölümdeki
  şimşekli bulut nedir, nasıl geçilir?"):** diken sayısı 1-5'te 34 → 0, 6-12'de 93 → 18 (bölüm-içi bölüm başına en çok bir,
  kontrol noktası odasında ve inişin/dönüşün hemen ardında hiç), 13+'da 1000 px başına ~1,2 → ~0,5 (§4 tablosu); kalkan dikenin
  yerini çoğunlukla aynı yerde dar bir çukur alır. Kalan dikenin vuruş kutusu her yandan %20 içeride; 6-12'de her odadaki ilk
  diken teması can götürmez, geri iter ("Dikkat, diken!"). Nabızlı (zamanlı) tehlike ilk iki bölgede (1-8) yok, uyarısı 0,65 sn.
  Kıl perdesi artık "altından kay" diye okunur: asılı tül, aydınlık boşluk, aşağı oklar, "KAY ↓"; 3-12'de alt kenarı kahramanın
  ayakta geçemeyeceği, kayarak rahat geçeceği yükseklikte ve üstünden atlanamayacak kadar uzun (ya da tavana değer); 3-8'de ilk
  üç perdeden önce aşağı kaydırma ipucu. 5. bölümün ilk perdesinden önce uzun koşu yolu ve kayma tazeleme dersi (yavaşlama + el +
  "Aşağı kaydır: perdenin altından kay!"; koşu başına bir kez, 5'te iki başarılı kaymadan sonra bir daha yok).
  `level-gen/src/diken.test.ts` diken üst sınırlarını, `play/ilk-bolumler.test.ts` diken affını, vuruş kutusunu, perde boşluğunu
  ve 5'teki tazeleme dersini denetler.
- **İlk kez oynayan oyuncu:** 1-6'da herkes bitirir (can kaybı 0,00-0,56; eski oyunda %44-94 bitirip 0,67-2,44 can); 7 ve 8
  (Kanal finali) → %85 (eskisi %46 ve %38), 9-12 → %73-100 (Zar finali 12: %40 → %73, 1,50 can). Kanal/Zar için: serumen yığını
  dar ve alçak, perde dar, diken seyrek ve affedici, zar penceresi en az 0,16 sn ("Mükemmel" ödül olarak kalır), kontrol noktası
  odaları güvenli, her odada kontrol noktası, 7-8'de iki bedava düşüş, 9-12'de bir.
  Ne değişti: §4'teki yardımlar (yavaş koşu, uzun coyote/tampon, bedava ilk düşüşler, öğretici odasında can kaybı yok,
  kazara dönüşün kilidi, basamakta geri koşmama, her odada kontrol noktası), 1-5'te diken yok, 1-3'te küçük çukurlar;
  ilk iki bölge bir kademe aşağı, 4-6 iki oda kısa. Eski oyunda ilk kez oynayanın en büyük kaybı açılış çukurlarıydı: 2.
  bölümde anahtara dönen kahraman geri koşup başlangıç çukuruna düşüyordu (ileri dönüş artık her zaman serbest).
- **Alıştırma (kitle):** 1-3'te herkes bitirir, can kaybı 0; 4 → 0,04 · 5 → 0,15 (Dış Kulak finali) · Kanal 6 → 0,06 ·
  7 → 0,15 · 8 → 0,13 ± 0,06 (Kanal finali) · Zar 9 → 0,00 · 10 → 0,00 · 11 → 0,08 · 12 → 0,21 ± 0,07 (Zar finali).
  **Bilinen sınır:** Kanal'da 7 ile final 8 hem kitle (0,15 / 0,13) hem ilk kez oynayan (1,21 / 1,21) için eşittir; ilk kez
  oynayan hedefini tutan 8 varyantlarının hiçbiri 7'den belirgin zor değildi. Kanal rampası 6 → 7'de yükselir, 7 → 8'de düzdür.
- **Final zinciri (diken geçişinden sonra yeniden ayarlandı):** her üst kademenin finali bir öncekinden zor — 8 → 0,13 ± 0,06 ·
  12 → 0,21 ± 0,07 · 19 → 0,98 ± 0,15 · [boss 20 → 1,60 ± 0,15, %77 bitirme] · 23 → 1,10 ± 0,13 · 26 → 1,23 ± 0,17 ·
  30 → 1,35 ± 0,17 · 33 → 1,42 ± 0,18 · 36 → 1,58 ± 0,17 · 39 → 1,65 ± 0,18 · [boss 40 → 1,98 ± 0,15, %60 bitirme]. Diken
  seyrekleşince 13+'nın zorluğunu taşıyan dikenler değil sınav odaları ve hareketli engellerdi; finallerin çoğu yerinde kaldı,
  zincirdeki dalgalar (23 ≈ 26, 30 < 26, 39 < 36) bölüm varyantlarıyla düzeltildi. Ardışık finaller arası adım 0,07-0,77 can;
  48 oyuncuda tek bir ardışık çiftin farkı gürültü düzeyindedir. Dört grup ortalaması (8,12) 0,17 → (19,23) 1,04 → (26,30) 1,29
  → (33,36,39) 1,55 kesin yükselir (`play/zorluk-4.test.ts`, sabit 16 oyunculuk alt örneklemle).
- **Bölge içi rampa:** her bölgede giriş < … < final (Kanal 7 ≈ 8 dışında): Kemikçikler 0,29 → 0,52 → … → 0,98 · Koklea Taban
  0,25 → 0,42 → 1,10 · Orta 0,38 → 0,65 → 1,23 · Apeks 0,17 → 0,31 → 0,63 → 1,35 · Sinir 0,31 → 0,33 → 1,42 · Beyin Sapı
  0,44 → 0,90 → 1,58 · Korteks 0,50 → 0,75 → 1,65 → boss 1,98. Bölge girişleri (13, 27, 37) artık ardından gelen bölümden
  kolaydır (önce 13 = 0,56, 27 = 0,67, 37 = 0,85 idi).
- **Bölge içinde gürültü düzeyinde kalan dalgalar:** Kemikçikler 14 (0,52) > 15 (0,31) ve 17 (0,77) ≈ 18 (0,73).
- **Nasıl ayarlandı:** final hedefleri (λ, §1) yükseltildi; Koklea Orta ve Beyin Sapı finalleri ikinci sınav odasını aldı;
  Sinir finali (33) `hız + yankı` aldı (`sis`/`gece` insan modelinin ölçümünü değiştirmez: model konumu kusursuz görür); Kanal
  finali `gain 0,65` ile hafifletildi; bölüm varyantları 48 oyunculuk taramayla seçildi (`kalibrasyon.ts`: 8, 11-13, 18, 19,
  22-27, 30, 32-34, 36, 37, 39). Kalibrasyon aracının 32 oyunculuk seçimi farklı tohumlarla ölçtüğünden tek başına yetmedi.
- **Üretici düzeltmeleri (ikinci geçiş):** zarlı çukurla başlayan bölümde boşta oyuncu sonsuza dek sekiyordu (11, 39) — zarlı çukur
  artık "ölüm çukuru" sayılmaz ve başa giriş çukuru konur; ilk odanın engeli ilk 200 px'teyse giriş çukurunun iniş zemini uzar
  (12'de planlayıcı ve insan modeli çukurdan inip hemen gelen dikene yetişemiyordu — eski 12 ölçümündeki fazla zorluğun bir kısmı
  buydu).
- **Boss arenası:** yere inen yumruk kahramanla çakışınca çarpışma kahramanı yumruğun kenarından sağ duvarın ötesine
  itiyordu (x > 390'da düşme). `bossStep` artık kahramanı en yakın kenara itip `[RUN_L, RUN_R]` içine sıkıştırır; `boss.test.ts`
  "arena sınırı" 20 ve 40'ta 6 oyuncuyla denetler.
- **Gizli koklea rafları:** `kn-sp-baca`, `sn-kuyu-bariyer`, `sn-sp-sinaps-firtinasi` kokleaları yan raflarda; `rooms.test.ts`
  "gizli koklea rafları ulaşılabilir" hedefe yönelik planlayıcıyla (`reachSecret`) her duvar odasının gizlisine ulaşıldığını denetler.
- Model, oyunu insanlardan daha iyi "görür" (konum algısı kusursuz; yalnız el ve tepki kusurlu): mutlak sayılar gerçek oyunculardan
  iyimserdir, biçim (sıralama) anlamlıdır.
- Biçim testleri (4-8 oyuncu; final zinciri 16 oyuncu) tek tek bölümleri değil, girişlerin ve finallerin ortalamalarını, final
  gruplarını, boss'ları ve alıştırmayı denetler; aynı denetimler 48 oyuncunun tamamında da geçer.
- Kalibrasyon varyantları gürültülü ölçümle seçildi (32-48 oyuncu): içerik değişince `--kalibre` ile yenilenmeli; varyant
  değişince bölümün odaları değişir (oyuncunun kayıtlı ilerlemesi etkilenmez).
- Oda puanı tek başına ölçülür; odalar arka arkaya gelince geçişlerden doğan ek zorluk bölüm ölçümünde görünür. Düzeltilen beş
  odanın (`kn-sp-baca`, `sn-kuyu-bariyer`, `sn-sp-sinaps-firtinasi`, `dk-sp-ilk-yol`, `ogret-cevir`) puanları yeniden ölçüldü.
  Yalnız gizli koklea rafı taşınan dört oda (`gn-kuyu`, `kn-kuyu-dusman`, `kx-kuyu-cevir`, `gn-geri-anahtar`) da yeniden ölçüldü;
  farklar 16 oyunculuk gürültü içindeydi (en çok 0,19 can) ve ana yolları değişmediği için eski puanlar tutuldu (yenileri seçimi
  oynatıp kalibre edilmiş bölümlerin odalarını değiştiriyordu).
