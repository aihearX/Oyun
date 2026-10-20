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
| Dış Kulak | 1-5 | 0,02 | 0,30 |
| Kanal | 6-8 | 0,15 | 0,70 |
| Zar | 9-12 | 0,20 | 0,85 |
| Kemikçikler | 13-19 (+ boss 20: 1,60) | 0,30 | 1,00 |
| Koklea Taban | 21-23 | 0,35 | 1,10 |
| Koklea Orta | 24-26 | 0,45 | 1,20 |
| Koklea Apeks | 27-30 | 0,50 | 1,30 |
| Sinir | 31-33 | 0,55 | 1,40 |
| Beyin Sapı | 34-36 | 0,60 | 1,50 |
| Korteks | 37-39 (+ boss 40: 2,00) | 0,80 | 1,60 |

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
| 1 | 0.02 | 4 | 0.5 / 1.5 | 2 | 0.00 | 0.75 | 0.8 | 1.25 | 0.7 | 0.17 | 0.75 / 0.8 | – |
| 2 | 0.07 | 5 | 0.7 / 1.5 | 2 | 0.13 | 0.84 | 0.85 | 1.19 | 0.66 | 0.162 | 0.8 / 0.84 | – |
| 3 | 0.10 | 6 | 0.8 / 1.5 | 2 | 0.25 | 0.94 | 0.9 | 1.14 | 0.61 | 0.155 | 0.85 / 0.88 | – |
| 4 | 0.21 | 7 | 1.3 / 3.8 | 3 | 0.38 | 1.03 | 0.95 | 1.08 | 0.57 | 0.147 | 0.9 / 0.92 | – |
| 5 | 0.30 | 8 | 1.7 / 5.2 | 9 | 0.51 | 1.13 | 1 | 1.02 | 0.53 | 0.14 | 0.95 / 0.96 | – |
| 6 | 0.15 | 5 | 1.1 / 3.6 | 2 | 0.07 | 0.8 | 0.83 | 1.22 | 0.68 | 0.166 | 0.78 / 0.82 | – |
| 7 | 0.37 | 7 | 2.0 / 4.5 | 3 | 0.31 | 0.98 | 0.92 | 1.11 | 0.59 | 0.151 | 0.87 / 0.9 | – |
| 8 | 0.45 | 9 | 2.4 / 5.9 | 9 | 0.55 | 1.16 | 1.02 | 1 | 0.51 | 0.137 | 0.97 / 0.98 | – |
| 9 | 0.20 | 6 | 1.3 / 3.8 | 3 | 0.11 | 0.83 | 0.85 | 1.2 | 0.66 | 0.163 | 0.8 / 0.84 | – |
| 10 | 0.36 | 7 | 2.0 / 4.5 | 3 | 0.28 | 0.96 | 0.91 | 1.13 | 0.61 | 0.153 | 0.86 / 0.89 | – |
| 11 | 0.58 | 7 | 3.0 / 5.5 | 4 | 0.44 | 1.08 | 0.98 | 1.05 | 0.55 | 0.144 | 0.93 / 0.94 | – |
| 12 | 0.85 | 9 | 4.1 / 7.6 | 9 | 0.61 | 1.2 | 1.04 | 0.98 | 0.49 | 0.134 | 0.99 / 0.99 | – |
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

## 4. Uyarlanabilir yardım (profil)

Profil artık yalnızca **yumuşak bir yardım**dır (`generateLevel` → `levelKnobs`):
- aynı bölümde üst üste **3 başarısızlık → bir kademe** kolaylaştırır (λ ×0,72, bir oda eksik, oda tavanı ×0,75, sıkılık −0,15;
  finalden bir sınav odası düşer, yalnız görsel değiştiriciler kalır), **5 başarısızlık → iki kademe**;
- usta oyuncu (son 5 bölüm ortalaması ≥ 2,8 yıldız) yalnızca 6. bölümden sonra, final ve boss olmayan bölümlerde çok küçük bir
  ek alır (λ +0,06). **İlk bölümler asla zorlaşmaz.**

## 5. Dürüstlük kuralları

- Fizik sabittir (koşu, zıplama, coyote 0,1 sn, tampon 0,12 sn): zorluk hissi değil, içerik ve pencere genişliği değişir.
- Bağışlayıcı vuruş kutuları korunur (tehlike görselin 8 px içi, nota yarıçapı geniş). Her tehlike görünür ve uyarılıdır:
  nabız tehlikesi 0,45 sn, atıcı 0,55 sn önce titrer; boss uyarıları en az ×0,6 (≥ 0,45 sn, tepki süresinin iki katı).
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

<!-- tablo:basla -->
_Ölçüm: 48 oyuncu (tohum) × 40 bölüm (bölüm tuzu 0 — oyuncunun gördüğü bölüm), varsayılan profil; önce: 24 tohum, eski eğri._

| Bölüm | Bölge | Rol | Hedef | Önce: bitirme | Önce: can kaybı | Önce: puan | Sonra: bitirme | Sonra: can kaybı ± SE | Sonra: yakın/dk | Sonra: puan ± SE |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Dış Kulak | giriş (nefes) | 0.6 | 100% | 0.21 | 1.4 | 100% | 0.08 ± 0.04 | 10.9 | 0.8 ± 0.1 |
| 2 | Dış Kulak |  | 0.7 | 100% | 0.54 | 2.4 | 100% | 0.06 ± 0.04 | 10.8 | 0.7 ± 0.1 |
| 3 | Dış Kulak |  | 0.9 | 100% | 0.63 | 2.9 | 100% | 0.06 ± 0.04 | 12.3 | 0.8 ± 0.1 |
| 4 | Dış Kulak |  | 1.1 | 96% | 0.58 | 2.5 | 100% | 0.17 ± 0.06 | 16.4 | 1.3 ± 0.2 |
| 5 | Dış Kulak | **final** | 1.4 | 96% | 0.54 | 2.5 | 100% | 0.29 ± 0.08 | 15.5 | 1.7 ± 0.2 |
| 6 | Kulak Kanalı | giriş (nefes) | 0.9 | 75% | 1.21 | 4.4 | 100% | 0.29 ± 0.08 | 16.5 | 1.7 ± 0.2 |
| 7 | Kulak Kanalı |  | 1.6 | 88% | 1.00 | 3.6 | 100% | 0.48 ± 0.10 | 13.1 | 2.1 ± 0.3 |
| 8 | Kulak Kanalı | **final** | 2.6 | 100% | 0.63 | 2.6 | 96% | 0.71 ± 0.13 | 14.0 | 2.8 ± 0.4 |
| 9 | Kulak Zarı | giriş (nefes) | 1.1 | 100% | 0.08 | 0.6 | 100% | 0.06 ± 0.04 | 5.6 | 0.5 ± 0.1 |
| 10 | Kulak Zarı |  | 1.6 | 100% | 0.29 | 1.2 | 100% | 0.33 ± 0.08 | 5.5 | 1.3 ± 0.2 |
| 11 | Kulak Zarı |  | 2.3 | 100% | 0.21 | 1.0 | 100% | 0.60 ± 0.10 | 7.1 | 2.2 ± 0.3 |
| 12 | Kulak Zarı | **final** | 3.0 | 100% | 0.21 | 1.0 | 92% | 0.85 ± 0.14 | 10.0 | 3.1 ± 0.4 |
| 13 | Kemikçikler | giriş (nefes) | 1.4 | 75% | 1.54 | 5.2 | 100% | 0.38 ± 0.09 | 9.6 | 1.6 ± 0.3 |
| 14 | Kemikçikler |  | 1.6 | 88% | 0.83 | 3.0 | 98% | 0.46 ± 0.10 | 9.4 | 1.8 ± 0.3 |
| 15 | Kemikçikler |  | 1.9 | 100% | 0.75 | 2.6 | 98% | 0.40 ± 0.10 | 7.2 | 1.5 ± 0.3 |
| 16 | Kemikçikler |  | 2.3 | 96% | 0.79 | 3.0 | 98% | 0.40 ± 0.10 | 10.3 | 1.7 ± 0.3 |
| 17 | Kemikçikler |  | 2.6 | 96% | 0.54 | 2.1 | 98% | 0.69 ± 0.12 | 9.9 | 2.6 ± 0.4 |
| 18 | Kemikçikler |  | 3.1 | 96% | 0.79 | 2.7 | 98% | 0.56 ± 0.11 | 12.9 | 2.3 ± 0.3 |
| 19 | Kemikçikler | **final** | 3.5 | 100% | 0.63 | 2.3 | 88% | 0.94 ± 0.15 | 8.9 | 3.3 ± 0.4 |
| 20 | Kemikçikler | **boss** | 5.3 | 63% | 1.67 | 5.1 | 77% | 1.60 ± 0.15 | 1.7 | 4.9 ± 0.5 |
| 21 | Koklea · Taban | giriş (nefes) | 1.6 | 100% | 0.21 | 1.1 | 100% | 0.17 ± 0.05 | 7.7 | 0.9 ± 0.2 |
| 22 | Koklea · Taban |  | 2.5 | 100% | 0.50 | 2.1 | 94% | 0.56 ± 0.12 | 8.5 | 2.1 ± 0.4 |
| 23 | Koklea · Taban | **final** | 3.8 | 92% | 0.58 | 2.6 | 85% | 1.13 ± 0.15 | 11.1 | 3.9 ± 0.5 |
| 24 | Koklea · Orta | giriş (nefes) | 1.9 | 100% | 0.29 | 1.3 | 100% | 0.17 ± 0.05 | 7.8 | 0.9 ± 0.2 |
| 25 | Koklea · Orta |  | 2.8 | 92% | 0.54 | 2.3 | 94% | 0.54 ± 0.13 | 9.5 | 2.1 ± 0.4 |
| 26 | Koklea · Orta | **final** | 4.1 | 67% | 1.00 | 3.4 | 79% | 1.27 ± 0.16 | 12.2 | 4.4 ± 0.5 |
| 27 | Koklea · Apeks | giriş (nefes) | 2.0 | 100% | 0.38 | 1.6 | 100% | 0.44 ± 0.10 | 7.6 | 1.7 ± 0.3 |
| 28 | Koklea · Apeks |  | 2.6 | 100% | 0.13 | 0.9 | 100% | 0.40 ± 0.08 | 12.1 | 1.8 ± 0.2 |
| 29 | Koklea · Apeks |  | 3.4 | 100% | 0.21 | 1.2 | 96% | 0.56 ± 0.11 | 10.8 | 2.2 ± 0.3 |
| 30 | Koklea · Apeks | **final** | 4.4 | 100% | 0.38 | 1.7 | 77% | 1.38 ± 0.17 | 11.9 | 4.7 ± 0.5 |
| 31 | İşitme Siniri | giriş (nefes) | 2.1 | 92% | 0.54 | 2.1 | 100% | 0.33 ± 0.07 | 8.8 | 1.4 ± 0.2 |
| 32 | İşitme Siniri |  | 3.2 | 100% | 0.25 | 1.4 | 90% | 0.71 ± 0.14 | 12.5 | 2.8 ± 0.4 |
| 33 | İşitme Siniri | **final** | 4.7 | 92% | 0.58 | 2.3 | 73% | 1.44 ± 0.17 | 14.6 | 5.0 ± 0.5 |
| 34 | Beyin Sapı | giriş (nefes) | 2.3 | 96% | 0.67 | 2.7 | 90% | 0.65 ± 0.15 | 13.3 | 2.6 ± 0.4 |
| 35 | Beyin Sapı |  | 3.4 | 100% | 0.33 | 1.5 | 90% | 0.90 ± 0.14 | 10.7 | 3.2 ± 0.4 |
| 36 | Beyin Sapı | **final** | 5.0 | 100% | 0.67 | 2.8 | 71% | 1.52 ± 0.17 | 13.1 | 5.2 ± 0.5 |
| 37 | İşitme Korteksi | giriş (nefes) | 2.9 | 96% | 0.54 | 2.1 | 94% | 0.67 ± 0.13 | 10.0 | 2.5 ± 0.4 |
| 38 | İşitme Korteksi |  | 3.9 | 100% | 0.33 | 1.4 | 85% | 0.88 ± 0.16 | 10.4 | 3.1 ± 0.5 |
| 39 | İşitme Korteksi | **final** | 5.3 | 92% | 0.38 | 1.7 | 67% | 1.60 ± 0.17 | 13.4 | 5.5 ± 0.5 |
| 40 | İşitme Korteksi | **boss** | 6.5 | 96% | 0.50 | 1.5 | 60% | 1.98 ± 0.15 | 0.0 | 5.9 ± 0.4 |
<!-- tablo:bitir -->

## 7. Komutlar

```bash
node tools/harness/zorluk.mjs --odalar --k 16            # oda ölçümü → packages/content/src/chunks/puanlar.ts (~12 dk, 4 çekirdek; --ids a,b yalnız yeni odalar)
node tools/harness/zorluk.mjs --kalibre --k 16 --v 10    # bölüm başına varyant → packages/level-gen/src/kalibrasyon.ts (~40 dk; --levels 8,12 kısmi)
node tools/harness/zorluk.mjs --bolumler --k 48 --tag sonra   # 40 bölüm × 48 oyuncu (~30 dk)
node tools/harness/zorluk.mjs --belge --once once --sonra sonra   # bu belgedeki tablolar + docs/img/zorluk-egrisi.svg
```
`npm test` içindeki `play/zorluk-*.test.ts`, eğrinin biçimini (alıştırma kolay, bölge finali > bölge girişi, girişler ve finaller
yükselir, final grupları zinciri (8,12) < (19,23) < (26,30) < (33,36,39), boss'lar doruk, 40 en zor ama ≥ %50 bitirilir) sabit tohumlarla ve alt örneklemle denetler.

## 8. Sonuç özeti ve bilinen sınırlar

Sayılar 48 oyuncuyla ölçülen ortalama can kaybıdır (± standart hata); bölgeler arası farkları okurken SE ~0,1-0,17'dir.

- **Alıştırma:** 1-3'te herkes bitirir, oyuncu başına 0,06-0,08 can (önce 0,2-0,6).
- **Final zinciri (üçüncü geçiş):** her üst kademenin finali bir öncekinden zor — 8 → 0,71 ± 0,13 · 12 → 0,85 ± 0,14 ·
  19 → 0,94 ± 0,15 · [boss 20 → 1,60 ± 0,15, %77 bitirme] · 23 → 1,13 ± 0,15 · 26 → 1,27 ± 0,16 · 30 → 1,38 ± 0,17 ·
  33 → 1,44 ± 0,17 · 36 → 1,52 ± 0,17 · 39 → 1,60 ± 0,17 · [boss 40 → 1,98 ± 0,15, %60 bitirme]. Ardışık finaller arası adım
  0,06-0,19 can; 48 oyuncuda tek bir ardışık çiftin farkı gürültü düzeyindedir (z ≈ 0,3-0,9). İki kademe arayla fark belirginleşir
  (19 → 26 z ≈ 1,5; 23 → 30 z ≈ 1,1), dört grup ortalaması (8,12) 0,78 → (19,23) 1,03 → (26,30) 1,32 → (33,36,39) 1,52 kesin yükselir
  (`play/zorluk-4.test.ts`, 16 oyunculuk alt örneklemle; denetimler 48 oyuncunun 16'şarlık her diliminde geçer, 12'lik bir
  dilimde Korteks grubu Sinir/Beyin Sapı grubunun altında kaldığı için test 16 oyuncu kullanır).
- **Bölge içi rampa:** her bölgede giriş < … < final: Kanal 0,29 → 0,48 → 0,71 · Zar 0,06 → 0,33 → 0,60 → 0,85 · Koklea Taban
  0,17 → 0,56 → 1,13 · Orta 0,17 → 0,54 → 1,27 · Sinir 0,33 → 0,71 → 1,44 · Beyin Sapı 0,65 → 0,90 → 1,52 · Korteks 0,67 → 0,88
  → 1,60 → boss 1,98. Boss ve final sonrası girişler nefes bölümleridir: 21 (0,17), 24 (0,17), 27 (0,44), 31 (0,33).
- **Bölge içinde gürültü düzeyinde kalan dalgalar:** Kemikçikler 17 (0,69) > 18 (0,56) (z ≈ 0,8) ve 13-16 düz (0,38-0,46);
  Koklea Apeks 27 (0,44) ≈ 28 (0,40).
- **Nasıl ayarlandı:** final hedefleri (λ, §1) yükseltildi; Koklea Orta ve Beyin Sapı finalleri ikinci sınav odasını aldı;
  Sinir finali (33) `hız + yankı` aldı (`sis`/`gece` insan modelinin ölçümünü değiştirmez: model konumu kusursuz görür); Kanal
  finali `gain 0,65` ile hafifletildi; bölüm varyantları 48 oyunculuk taramayla seçildi (`kalibrasyon.ts`: 8, 11, 12, 18, 19,
  23-26, 30, 32, 33, 36, 39). Kalibrasyon aracının 32 oyunculuk seçimi farklı tohumlarla ölçtüğünden tek başına yetmedi.
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
