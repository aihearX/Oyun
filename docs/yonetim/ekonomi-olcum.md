# Kamp ekonomisi ölçümü (MK-001)

İlk 14 günde jeton ve kristal geliri, harcama yerleri ve inşaat temposu. Üç oturum profili (günde 1 / 3 / 6 oturum), her biri
takımsız ve takımlı: altı profil. İlk ölçüm (6c1f4ac) oyun kodunu değiştirmedi; öneriler sahibin kararına bırakıldı.
**Ö1, Ö2, Ö3 ve Ö4 uygulandı** (§7). §1, §4-§6 metni ilk ölçümü (öneriler öncesi) anlatır; §3 tabloları bugünkü kodla ve yenilenen
insan ölçümüyle yeniden üretildi (temel: inşaat sırası açık; "Uygulanan değişiklikler" tablosu eski kuralları kancayla kurar).

- Komut: `node tools/ekonomi/simule.mjs` (tablolar stdout'a), `--belge` (§3'ü bu dosyaya yazar), `--json` (ham gün gün).
  Aynı girdiyle iki çalıştırma bayt bayt aynı çıktıyı verir (rastgelelik yok; beklenen değer modeli).
- Girdi: formüller derlenerek okunur (esbuild; `@odi/shared`, `@odi/content`, `@odi/meta`, sunucu sabitleri `apps/server/src/*`,
  açılış bölümleri `apps/web/src/ftue/features.ts`). Kopya formül yok; değişirse ölçüm kendiliğinden güncellenir.
- Bölüm verisi: bitirme oranı `docs/12-zorluk-egrisi.md` §6 tablolarından okunur (48 oyuncu; 1-12 ilk kez oynayan, 13-40 kitle);
  süre, toplanan nota, yıldız ve hasar insan modeliyle ölçüldü: `node tools/ekonomi/simule.mjs --olc --k 16` →
  `tools/ekonomi/insan-olcum.json` (16 oyuncu × 40 bölüm, `playHumanStars`; ~25 dk, sonuç dosyası depoda).

## 1. Bulgular (özet)

1. **14 günde duvar yok.** Altı profilin hiçbirinde kamp açıkken inşaatsız gün yok. 14. gün sıradaki en ucuz bina en çok
   0,82 günlük gelir tutuyor. Her gün en az bir inşaat başlıyor: 14 günün 14'ü "anlamlı".
   Eğri sağlıklı bir testere dişi çiziyor: binalar Merkez seviyesine yetişince Merkez tek başına pahalı adım oluyor (×1,4).
   Sonra yine ucuz adımlar geliyor.
2. **Az oynayan oyuncuda jeton taşıyor.** _(Ö3 ile giderildi: inşaat sırası, §7. Günde 1 oturum takımsız taşkın 13 → 2 gün.)_
   - Günde 1 oturumda 14 günün 12-13'ü "taşkın": cüzdan sıradaki binanın 2 katından fazla. 14. gün cüzdanı 3.567 jeton (takımsız) ve 2.108 (takımlı).
   - Sebep para değil, kuyruk. Erken inşaatlar dakikalar sürüyor (Sv 2: 4,6 dk; `buildCost`), aynı anda tek inşaat var ve oyuncu
     oturum başına ancak iki inşaat başlatabiliyor (bölümden önce ve sonra). Kuyruk 14 günün %99-100'ünde boş ve oyuncu yok.
   - 3 ve 6 oturumda kuyruk %48-80 oranında "jeton yok" yüzünden boş: oyuncu kazandığını harcıyor. Taşkın 0-4 gün.
3. **Bölümler erken bitiyor.** 40 bölümün beklenen süresi 68,8 dk.
   - Bölüm 40'a 6 oturumla 2. gün, 3 oturumla 3. gün, 1 oturumla 9. gün varılıyor.
   - Sonrası tekrar oynama: 6 oturumda günde ~2.000 jeton yalnız tekrardan geliyor.
   - İkinci haftada depo en büyük kaynak oluyor (3-6 oturumda 14. gün 2.200-2.880 jeton/gün).
4. **Takımsız oyuncunun hikâyesi 5. bölümde duruyor.** _(Ö2 ile giderildi: takımsız 14 günde 8-9/10, §7.)_
   - Kampın Hikâyesi sıralı ilerliyor ve 6. bölüm takıma katılmayı istiyor. Takımsız profiller 14 günde 5/10'da kalıyor; takımlılar 9/10'a ulaşıyor.
   - Kaybedilen ödüller: 6-10. bölümlerin 43 kristali, 1.220 Kamp XP'si, 5 × 60 dk hızlandırıcı ve 3 süsü.
5. **Klinikte boş günler var.** _(Ö4 ile giderildi, §7.)_
   - 1. kademede 10 vaka var; günde 3 hasta geliyor.
   - 2. kademe Odyoloji Kliniği Sv 4 ister. Bu yüzden 3 gün sonra salon boşalıyor, Klinik Sv 4 olana dek yeni hasta gelmiyor.
   - Vakaların açık olduğu günlerin yalnız 4/12'sinde (1 oturum, takımsız) ya da 8/14'ünde yeni hasta var.
6. **Dürüst oyun yerel ödül sınırına çarpıyor.** _(Ö1 ile giderildi: sınır 1.500, §7.)_
   - Günlük görev, takvim, sandık, hazine, başarım ve Şanslı Nota jetonları günde en çok 600 (`LOCAL_JETON_DAILY_MAX`, `apps/server/src/wallet.ts:11`).
   - 3 ve 6 oturumlu oyuncu ilk 3 günde 616 / 963 jetonu bu sınırda kaybediyor (ilk günlerin başarım patlaması).
   - Kod yorumu "günlük üst sınır dürüst oyunda aşılmaz" diyor; ölçüm bunun tersini gösteriyor.
   - İstemci bunu dürüstçe bildiriyor ("… jeton hesaba eklenmedi", `apps/web/src/net.ts:114`), yine de vaat edilen ödül kayboluyor.
7. **Kristal takımdan geliyor ve harcanacak yeri yok.**
   - 14 günde takımsız oyuncu 39-67, takımlı oyuncu 563-881 kristal kazanıyor (×10-15).
   - Kristalin tek harcama yeri inşaat hızlandırma (`crystalsToFinish`: dakika başına 1). 14 günde en uzun inşaat Merkez Sv 6: 72 dk. Takımlı oyuncunun stoku 9-15 saatlik hızlandırma ediyor.
   - Parayla güç alınmıyor (pay-to-win yok): kristal yalnız süre kısaltıyor, bina gücü Sv 15'te tavan yapıyor.
8. **Ödül temposu.** İlk gün çok yoğun: 6 oturumda 1. gün 15 açılış ve olay (Kamp Sv 1 → 6), sonra her 1-2 günde bir Kamp Sv.
   - Kamp Sv 14. gün 11 (1 oturum) ile 17 (6 oturum, takımlı) arasında.
   - Denge Tepesi (Kamp Sv 12): 4-11. gün; 1 oturum takımsız 14 günde ulaşamıyor. Merkez Sv 8 hiçbir profilde yok, bu yüzden hikâye 10 kapalı.
   - Sahte aciliyet yok; her ödül önceden yazılı. Gelir oturum sayısıyla orantılıya yakın: takımsız 14 günlük gelir 1 : 3 : 6 oturumda 1 : 2,8 : 4,4 (13.500 / 38.174 / 59.937).

## 2. Yöntem, varsayımlar ve kaynaklar

### 2.1 Model

Her profil 14 gün oynanır. Gün 1 Pazartesi 2026-11-02'dir; haftalık ödüller hafta içi konuma bağlıdır. Her oturumda sırasıyla:

1. Kamp işleri (kamp açıksa, 3 bölüm geçilince):
   - süresi dolan inşaatları bitir;
   - anıt XP'si;
   - depoyu topla;
   - Tedavi Odası rafını topla;
   - bekleyen vakaları çöz;
   - kamp oyunlarından birer tur;
   - takım yardımı ve konsültasyon;
   - yeni süsleri yerleştir;
   - hikâye ve başarı ödüllerini al;
   - inşaat başlat.
2. Bölüm oynama: 8 dk (aşağıda). Sonra günlük görevler, sandık, takvim ve başarımlar alınır; kamp işleri yeniden yapılır: yeni jetonla inşaat ve yetenek.

**Bölüm oynama (beklenen değer).** Bölüm n için:

- `deneme = 1 / bitirme`
- `süre = (deneme − 1) × (bitiremeyen süresi + 20 sn) + (bitiren süresi + 20 sn)`
- `nota = (deneme − 1) × bitiremeyen notası + bitiren notası`

Oturumun 8 dakikası bu süreye bölünür: oyuncu sıradaki bölümde ilerler, jeton ve görev sayaçları harcanan süreyle orantılı akar,
bölüm bittiğinde yıldız, hazine ve açılım işlenir. 40'tan sonra 1-40 sırayla tekrar oynanır. Rastgele çekiliş yoktur, bu yüzden çıktı deterministiktir.

**İnşaat seçimi.**
- Sıra: önce hikâyenin şu anki bölümünün bina adımı (gerekiyorsa Merkez), sonra ucuzdan pahalıya. Oyuncu bu sıradaki ilk karşılanabilir inşaatı başlatır.
- Birikim için beklemez. Aynı anda tek inşaat vardır (`camp.upgrade`, `MESGUL`); süren inşaat varken sıradaki ilk karşılanabilir
  inşaat sıraya alınır (Ö3, `camp.queue`): parası o an ödenir, süren bitince kendiliğinden başlar. Sıraya alırken Merkez sınırı süren
  Merkez inşaatı bittikten sonraki seviyeye göre. Sıradaki inşaata hızlandırıcı ve takım yardımı gelmez (yalnız teknoloji indirimi);
  "inşaat başlat" görevi inşaat başlayınca sayılır.
- Bedava hızlandırıcılar yalnız boşa gitmeyecekse kullanılır. Kristal harcanmaz; stok raporlanır.
- Yetenek ağacından en ucuz uygun yetenek, sıradaki binanın parası cüzdanda kalacaksa alınır.
- Takım teknolojisine bağış yapılmaz. Bu sınırsız bir jeton çukurudur (`techCost`, `packages/shared/src/social.ts:222`).

**Ölçüler.**
- **Duvar günü**: kamp açıkken hiçbir inşaat başlatılamayan ve sıradaki inşaata jeton yetmeyen gün.
- **Taşkın günü**: gün sonunda cüzdan ≥ 2 × en ucuz sıradaki bina.
- **Kuyruk**: oturum sonundan bir sonraki oturuma kadar geçen süre üç sınıfa ayrılır.
  - dolu;
  - boş, jeton yok: cüzdan en ucuz binaya yetmiyor;
  - boş, oyuncu yok: para var, oyuncu oyunda değil.
- **Anlamlı gün**: yeni bölüm, inşaat, vaka ya da hikâye bölümünden en az biri olan gün.

### 2.2 Varsayımlar (`tools/ekonomi/simule.mjs` → `V` ve `PROFILLER`; hepsi tek yerde)

| # | Varsayım | Değer | Gerekçe |
|---|---|---|---|
| A1 | Oturum saatleri | 1: 19:00 · 3: 08:00, 13:00, 20:00 · 6: 08:00, 11:00, 14:00, 17:00, 20:00, 22:30 | Gün içine yayılmış tipik mobil kullanım |
| A2 | Oturum başına bölüm süresi | 8 dk oyun saati; oturum toplam 10 dk | Kısa mobil oturum. 40 bölümün tamamı 68,8 dk (§3), yani 1 oturumda ~5 bölüm/gün |
| A3 | Deneme başına ek süre | 20 sn (bölüm kartı, sonuç ekranı, harita) | Ölçülen oyun saatine eklenir |
| A4 | Bitirme oranları | docs/12 §6: 1-12 ilk kez oynayan, 13-40 kitle (en az 1/48) | Ölçülmüş, 48 oyuncu |
| A5 | Süre, nota, yıldız, hasar | `insan-olcum.json`: 16 oyuncu, aynı kademeler | İnsan modeli. 16 oyuncudaki bitirme docs/12'yle uyumlu, ör. 8: 14/16 ↔ %79; 40: 9/16 ↔ %60 |
| A6 | Vaka ilk çözüm yıldızı | sırayla 3, 2, 1 (ortalama 2★) | Doğru tanı 1★, yönetim ve verimli test +1'er (`vakaPuanla`) |
| A7 | Kamp oyunları | her oturumda Ton Avı ve Timpanogram'dan 1'er tur (günde 5 ödüllü) | Kısa (≥ 9,6 / 7,5 sn) |
| A8 | Günlük kamp görevleri | 3'ü de yapılır (bir değiştirme hakkıyla) | Görevler basit kamp eylemleri |
| A9 | Haftalık kamp hedefi | `h-gunluk` (günlük görev sayısı) | Sunucu oyuncu+hafta özetiyle seçer (`camp-quests.ts:144`) |
| A10 | Tedavi Odası | kulak tıkacı hazırlanır, oturum başına 1 malzeme bölümde kullanılır | Hikâye 5 ister |
| A11 | Kombo-10 ve meydan okuma görevi | sayılmaz (0) | İnsan modeli kombo ölçmez. Alt sınır |
| A12 | Takımlı profiller: takım | 10 üye, teknoloji Sv 0. Takım günlük görevlerinden 2/3, Ses Avı 6/8 kademe. Haftalık hedefler: Yıldız 2, Bölüm 2, Canavar 1 kademe. Düello 1 galibiyet + 1 yenilgi; baskın canavarı yenilir; bayrak parkuru biter; bölge sahibi değil | "Orta takım". Turnuva, meydan okuma sıralaması, İkili Görev ve mağaza hediyesi dışarıda |
| A13 | Takımlı profiller: oyuncu | ralli (kazanılan) ve bilgi yarışması günde 0 / 1 / 2 (1 / 3 / 6 oturum), 7/10 doğru. Günün Sorusu %70 doğru. Oturum başına 3 inşaat yardımı. Kendi inşaatına 5 yardım hemen gelir. Oturum başına 1 konsültasyon oyu, günde 1 soru. 3 arkadaşla hediyeleşme. Günde 1 alkış ver/al, 1 bölüm yardımı | Etkinlik saatleri: bilgi yarışması 13:00 / 20:00 |
| A14 | Takımsız profiller | takım, arkadaş, ziyaret yok. Hikâye 6–7'de "ya da" adımlarını yapar; adım Vaka Defteri'nden yeniden çözme isterse oturumda 1 vaka yeniden çözülür (yeni yıldız sayılmaz) | Ö2 (§7): oyuncu ekrandaki adıma yönelir |
| A15 | Dışarıda | promosyon kodları, mağaza ve Sezon Kartı (gerçek para), yönetici modu | İş emri |

### 2.3 Gelir ve harcama kaynakları (formül → dosya:satır)

| Kaynak | Formül / kural | Dosya:satır |
|---|---|---|
| Bölüm jetonu | `round(min(nota, 400) × (1 + Odyometri Sv×3/100 + Ortak Kazanç×3/100))`; Odyometri gücü Sv 15'te tavan | `apps/server/src/progress.ts:57`, `:29`, `:12`; `packages/shared/src/social.ts:180` |
| Bölüm XP'si (başarımlar) | `20 + 10 × yıldız`, bitiremeyen 5 | `packages/shared/src/economy.ts:32` |
| Şanslı Nota | %10 olasılık × 25 jeton; toplanma olasılığı ≈ bölümün nota oranı | `packages/content/src/rewards.ts:23` |
| Günlük görevler | günün 3 görevi tarih tohumuyla; 20-30 jeton | `packages/meta/src/daily.ts:11`, `packages/content/src/daily.ts:11-26` |
| Günlük sandık | 50 jeton + koruyucu + sıradaki sandık kartı (yoksa 30 jeton) | `packages/content/src/daily.ts:30`, `packages/meta/src/daily.ts:51`, `packages/meta/src/unlocks.ts:77` |
| Takvim | 7 günlük döngü; 2. döngüde kozmetikler kopya → 50 jeton | `packages/content/src/daily.ts:33-41`, `packages/content/src/rewards.ts:21` |
| Harita hazineleri | 5, 10, …, 40. bölüm | `packages/content/src/daily.ts:44-53` |
| Başarımlar | Bronz 15 / Gümüş 40 / Altın 100 jeton. Ölçülen ölçütler: bitirme, yıldız, nota, oyun, görev, sandık, takvim, seri, gün, en yüksek bölüm, XP, 3★, hasarsız, par, boss, yetenek, koruyucu, biyom yıldızı | `packages/content/src/achievements.ts:15`, `:33-67` |
| Yerel ödül sınırı | günlük 1.500 jeton (yukarıdaki yedi kaynak; Ö1 öncesi 600) | `packages/shared/src/social.ts` (`LOCAL_JETON_DAILY_MAX`), uygulama `apps/server/src/wallet.ts:37-38` |
| Depo | `floor(min(geçen, dolma) / 1 sa × Sv × 20)`; dolma `8 + 0,5 × Denge Sv` sa; her 40 jetona 1 Kamp XP (en çok 20) | `apps/server/src/camp.ts:13`, `:229-236`; `packages/content/src/kamp-seviye.ts:46`, `:29` |
| Kamp Görevleri | günlük 3 × (15 jeton + 15 XP); haftalık 40 jeton / 3 kristal / 5 kristal + 60 dk | `packages/content/src/kamp-gorev.ts:50`, `:183-187` |
| Kampın Hikâyesi | 10 bölüm, sıralı (ilk alınmamış bölüm) | `packages/content/src/kamp-gorev.ts:96-153` (6–7. bölümde "ya da" adımları, Ö2); `apps/server/src/camp-quests.ts:157-180` |
| Kamp başarıları | 12 başarı, basamaklarda jeton, kristal, XP, süs | `packages/content/src/kamp-gorev.ts:193-218` |
| Hasta Vakaları | gün başına en çok 3 hasta, salon 6; kademe Klinik Sv 1/2/3 (Ö4 öncesi 1/4/7). İlk çözüm `10 + 5×yıldız` jeton, `15 + 5×yıldız` XP | `apps/server/src/camp-quests-vaka.ts:33-35`, `:83`; `packages/content/src/kamp-gorev.ts:26-30`, `:45-48`, `:235` |
| Kamp oyunları | tur başına 4 jeton + 5 XP, günde 5 ödüllü tur | `packages/content/src/kamp-gorev.ts:32`, `:49`; `apps/server/src/camp-quests-oyun.ts:84` |
| Konsültasyon, takım kliniği | oy 5 jeton + 3 XP (günde 5); soran 5 + 3; takım kliniği 3 kristal + 40 XP/hafta | `packages/content/src/kamp-gorev.ts:51-53` |
| İnşaat yardımı | yardım edene 2 jeton (günde 30); her yardım `max(60, %1 kalan)` sn; inşaat başına 5 | `apps/server/src/camp.ts:11-12`, `:153`; `packages/shared/src/social.ts:209`, `:364` |
| Takım hediyeleri | takım günlük görevi 60 jeton + 5 kristal; Ses Avı kademe `30 + 10k` jeton (k=4,7: +10 kristal); düello 400+80 / 100+15; baskın 200 + 30; haftalık hedef kademeleri; bayrak 120 + 10 | `apps/server/src/events/quests.ts:20`, `events/hunt.ts:12-15`, `events/duel.ts:8`, `raid.ts:10`, `teamextra.ts:19-23`, `events/relay.ts:14` |
| Ralli, bilgi yarışması, Günün Sorusu | ralli 150 jeton + 10 kristal (günde en çok 5); doğru başına 10 jeton; Günün Sorusu 10 jeton | `packages/shared/src/social.ts:425`, `:431`; `apps/server/src/events/quiz.ts:19`; `packages/shared/src/social.ts:718` |
| Arkadaş hediyesi, bölüm yardımı | alınan 10, gönderen 2 jeton; kalkan veren 5 jeton | `packages/shared/src/social.ts:567`; `apps/server/src/teams.ts:12` |
| **Harcama:** inşaat | `80 × (Merkez 1,4) × Sv^1,9` jeton, `60 × (1,4) × Sv^2,2` sn (Sv > 15 doğrusal); diğerleri ≤ Merkez | `packages/shared/src/social.ts:182-187`; `apps/server/src/camp.ts:192-196` |
| **Harcama:** yetenek | 11 yetenek, toplam 2.720 jeton | `packages/content/src/skills.ts:4-16`; `apps/server/src/wallet.ts:44-53` |
| **Harcama:** kristal | yalnız hızlandırma: kalan dakika başına 1 | `packages/shared/src/social.ts:257`; `apps/server/src/camp.ts:206-209` |
| Kamp XP, Kamp Sv | `need(L) = round(30 × L^1,4) + 30`. İnşaat `20 + 10 × Sv` (Merkez ×1,5); malzeme 3; anıt 40; ilk süs 5; Kabin +%3/Sv | `packages/content/src/kamp-seviye.ts:12`, `:23-36`, `:40`; `apps/server/src/camp-xp.ts:53`, `:100` |
| Açılışlar | Bugün 2, Kamp 3, Yetenek 3, Görevler 4, Takım 5, Kamp oyunları 6, Vaka 7, Etkinlik 7, Günün Sorusu 9 geçilen bölüm | `apps/web/src/ftue/features.ts:22-42`; `packages/content/src/kamp-gorev-acilis.ts` |
| Tedavi Odası | süre `dk × max(0,55; 1 − 0,03(Sv−1))`; raf `2 + ⌊Sv/3⌋`; çanta 9 | `packages/content/src/remedies.ts:128-151` |

Ölçülmeyen (alt sınır): gizli koklea, kombo, melodi, eskort ve süreli hedef başarımları; meydan okuma; turnuva; İkili Görev;
Usta-Çırak; bölge savaşı ödülü; takım teknolojisinin gelir etkisi.

## 3. Sonuçlar

<!-- simule:basla -->
### Bölüm verisi (girdi)

_Bitirme: docs/12 §6 (1-12 ilk kez oynayan, 13-40 oyuncu kitlesi; 48 oyuncu). Süre, nota, yıldız: `insan-olcum.json` (16 oyuncu, aynı kademeler). Beklenen deneme = 1 / bitirme; beklenen süre = (deneme − 1) × (bitiremeyen süresi + 20 sn) + (bitiren süresi + 20 sn)._

| Bölüm | Bitirme | Deneme | Bitiren süre (sn) | Nota / bitiriş | Toplam nota (bölüm) | Beklenen süre (sn) | Beklenen nota | Yıldız (bitiren) |
|---|---|---|---|---|---|---|---|---|
| 1 | %100 | 1,00 | 57,6 | 84,2 | 98 | 78 | 84,2 | 2,06 |
| 2 | %100 | 1,00 | 65,6 | 82,9 | 99 | 86 | 82,9 | 2,06 |
| 3 | %100 | 1,00 | 60,1 | 79,9 | 98 | 80 | 79,9 | 2,00 |
| 4 | %100 | 1,00 | 46,7 | 83,0 | 100 | 67 | 83,0 | 2,94 |
| 5 | %98 | 1,02 | 45,0 | 64,4 | 98 | 66 | 65,7 | 1,87 |
| 6 | %100 | 1,00 | 44,9 | 80,6 | 99 | 65 | 80,6 | 2,06 |
| 7 | %85 | 1,18 | 68,2 | 73,9 | 98 | 100 | 79,8 | 2,47 |
| 8 | %79 | 1,27 | 90,1 | 71,8 | 100 | 131 | 80,4 | 2,00 |
| 9 | %100 | 1,00 | 81,6 | 49,8 | 100 | 102 | 49,8 | 1,06 |
| 10 | %94 | 1,06 | 84,4 | 54,7 | 98 | 109 | 55,8 | 1,27 |
| 11 | %92 | 1,09 | 72,8 | 49,3 | 100 | 99 | 51,8 | 2,00 |
| 12 | %73 | 1,37 | 93,3 | 49,2 | 93 | 145 | 57,1 | 1,00 |
| 13 | %100 | 1,00 | 51,6 | 70,2 | 95 | 72 | 70,2 | 2,00 |
| 14 | %94 | 1,06 | 60,6 | 72,7 | 100 | 86 | 77,3 | 2,00 |
| 15 | %98 | 1,02 | 82,4 | 74,4 | 99 | 105 | 76,0 | 2,50 |
| 16 | %94 | 1,06 | 67,8 | 67,0 | 99 | 96 | 70,4 | 1,87 |
| 17 | %94 | 1,06 | 67,8 | 62,6 | 99 | 94 | 65,5 | 1,73 |
| 18 | %92 | 1,09 | 65,3 | 72,9 | 98 | 91 | 75,5 | 2,27 |
| 19 | %88 | 1,14 | 94,6 | 72,1 | 93 | 127 | 77,8 | 2,00 |
| 20 | %77 | 1,30 | 23,6 | 0,0 | 0 | 55 | 0,0 | 2,00 |
| 21 | %100 | 1,00 | 71,2 | 47,6 | 100 | 91 | 47,6 | 1,69 |
| 22 | %100 | 1,00 | 82,6 | 49,8 | 98 | 103 | 49,8 | 1,75 |
| 23 | %81 | 1,23 | 89,3 | 54,4 | 98 | 124 | 59,7 | 2,38 |
| 24 | %98 | 1,02 | 69,2 | 55,1 | 89 | 91 | 56,3 | 2,00 |
| 25 | %90 | 1,11 | 69,1 | 59,4 | 100 | 98 | 64,1 | 1,71 |
| 26 | %77 | 1,30 | 97,2 | 59,8 | 99 | 146 | 71,1 | 2,00 |
| 27 | %100 | 1,00 | 87,0 | 55,1 | 99 | 107 | 55,1 | 1,94 |
| 28 | %98 | 1,02 | 60,2 | 51,4 | 99 | 82 | 52,4 | 1,88 |
| 29 | %94 | 1,06 | 64,5 | 74,5 | 97 | 89 | 77,1 | 2,00 |
| 30 | %75 | 1,33 | 83,8 | 46,3 | 96 | 129 | 54,6 | 2,80 |
| 31 | %100 | 1,00 | 77,1 | 65,8 | 100 | 97 | 65,8 | 1,94 |
| 32 | %98 | 1,02 | 63,0 | 79,6 | 100 | 85 | 81,2 | 2,00 |
| 33 | %71 | 1,41 | 76,7 | 77,9 | 99 | 125 | 90,5 | 2,58 |
| 34 | %96 | 1,04 | 72,3 | 64,3 | 98 | 96 | 65,8 | 2,60 |
| 35 | %90 | 1,11 | 86,1 | 62,6 | 100 | 113 | 64,8 | 1,79 |
| 36 | %67 | 1,49 | 95,7 | 59,9 | 98 | 170 | 82,8 | 1,78 |
| 37 | %96 | 1,04 | 79,9 | 60,4 | 98 | 104 | 61,8 | 1,60 |
| 38 | %90 | 1,11 | 108,7 | 43,4 | 89 | 140 | 46,1 | 1,00 |
| 39 | %63 | 1,59 | 90,0 | 61,6 | 100 | 163 | 83,4 | 2,20 |
| 40 | %60 | 1,67 | 60,8 | 0,0 | 0 | 123 | 0,0 | 1,44 |
| **1-40** | | | | | | **68,8 dk** | **2.593** | |

### Profil özeti (14 gün)

| Profil | Bölüm 40 bitti (gün) | İlk duvar günü | İnşaatsız gün | Taşkın günü | Yeni hasta gelen gün / vaka açık gün (boş gün, vaka bitmeden) | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (%) | Sıradaki bina = kaç günlük gelir (14. gün) | 14. gün cüzdan | 14. gün kristal | Kamp Sv | Hikâye bölümü | Anlamlı gün |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 oturum, takımsız | 9 | 13 | 1 | 2 | 11/13 (1) | %1 / %62 / %38 | 0,94 | 993 | 98 | 14 | 7/10 | 14/14 |
| 3 oturum, takımsız | 3 | yok | 0 | 0 | 11/14 (0) | %3 / %94 / %4 | 0,52 | 1.076 | 122 | 16 | 9/10 | 14/14 |
| 6 oturum, takımsız | 2 | yok | 0 | 0 | 11/14 (0) | %5 / %93 / %2 | 0,50 | 858 | 134 | 17 | 9/10 | 14/14 |
| 1 oturum, takımlı | 9 | yok | 0 | 0 | 11/13 (1) | %1 / %92 / %8 | 0,64 | 296 | 592 | 15 | 8/10 | 14/14 |
| 3 oturum, takımlı | 3 | yok | 0 | 0 | 11/14 (0) | %2 / %96 / %1 | 0,56 | 1.775 | 754 | 17 | 9/10 | 14/14 |
| 6 oturum, takımlı | 2 | yok | 0 | 0 | 11/14 (0) | %5 / %94 / %1 | 0,72 | 613 | 914 | 18 | 9/10 | 14/14 |

### Açılış günleri (gün; – = 14 günde yok)

| Profil | Kamp Görevleri | Vakalar (Klinik kurulu) | Tedavi Odası | Kamp Sv 3 (Sessiz Koru) | Akustik Kabin | Kamp Sv 6 (Koklea Koyu) | Tarama Birimi | Kamp Sv 9 (Park) | Kamp Sv 12 (Denge Tepesi) | Merkez Sv 5 | Merkez Sv 8 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 oturum, takımsız | 1 | 2 | 3 | 2 | 3 | 3 | 4 | 6 | 10 | – | – |
| 3 oturum, takımsız | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 3 | 6 | 11 | – |
| 6 oturum, takımsız | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 5 | 7 | – |
| 1 oturum, takımlı | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 5 | 8 | – | – |
| 3 oturum, takımlı | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 5 | 9 | – |
| 6 oturum, takımlı | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 4 | 6 | – |

### Gelir kaynakları (14 gün toplamı, jeton)

| Profil | Bölüm | Yerel (görev, takvim, sandık, hazine, başarım) | Depo | Kamp Görevleri ve vakalar | Takım ve arkadaş | Toplam | Harcanan: bina | Harcanan: yetenek | Kristal geliri | Yerel sınırda kırpılan |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 oturum, takımsız | 4.617 | 4.066 | 4.880 | 1.901 | 0 | **15.464** | 13.121 | 1.450 | 98 | 0 |
| 3 oturum, takımsız | 14.095 | 5.212 | 18.996 | 2.165 | 0 | **40.468** | 39.001 | 490 | 122 | 0 |
| 6 oturum, takımsız | 28.599 | 5.535 | 25.236 | 2.397 | 0 | **61.768** | 60.519 | 490 | 134 | 0 |
| 1 oturum, takımlı | 4.680 | 4.026 | 5.790 | 2.090 | 6.133 | **22.720** | 22.033 | 490 | 592 | 0 |
| 3 oturum, takımlı | 14.213 | 5.212 | 21.476 | 2.494 | 9.388 | **52.783** | 50.887 | 220 | 754 | 0 |
| 6 oturum, takımlı | 28.895 | 5.535 | 28.087 | 2.871 | 12.720 | **78.109** | 77.375 | 220 | 914 | 0 |

### Gün gün: 1 oturum, takımsız

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 935 (507 / 383 / 0 / 45 / 0) | 0 | 838 | 197 | Depo 1, Merkez 2 | 0,1 / 0,0 / 4,7 | Odyometri 1 (80; 0,09) | 1 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6) |
| 2 | 10 | 792 (275 / 192 / 160 / 165 / 0) | 0 | 890 | 99 | Klinik 1, Odyometri 1, Kule 1, Atölye 1 | 0,0 / 0,0 / 23,8 | Tedavi 1 (80; 0,09) | 4 | Kamp Sv 2; Kamp Sv 3: Sessiz Koru; Hasta Vakaları (bölüm 7); Kamp Sv 4; hikâye 1 |
| 3 | 15 | 926 (340 / 313 / 160 / 113 / 0) | 6 | 539 | 486 | Tedavi 1, Kabin 1, Tarama 1, Odyometri 2 | 0,1 / 0,0 / 23,7 | Atölye 2 (299; 0,34) | 6 | Kamp Sv 5; Kamp Sv 6: Koklea Koyu; hikâye 2; 3 vaka |
| 4 | 20 | 975 (305 / 357 / 160 / 153 / 0) | 8 | 1.196 | 265 | Atölye 2, Depo 2, Kule 2, Klinik 2 | 0,2 / 4,7 / 19,0 | Tedavi 2 (299; 0,33) | 7 | Kamp Sv 7; 3 vaka |
| 5 | 25 | 1.252 (278 / 442 / 320 / 213 / 0) | 14 | 897 | 621 | Tedavi 2, Kabin 2, Tarama 2 | 0,1 / 23,8 / 0,0 | Merkez 3 (903; 0,86) | 8 | Kamp Sv 8; hikâye 3; hikâye 4; 3 vaka |
| 6 | 29 | 998 (293 / 152 / 320 / 233 / 0) | 3 | 1.282 | 337 | Park 1, Merkez 3, Park 2 | 0,1 / 23,7 / 0,0 | Odyometri 3 (645; 0,60) | 9 | Kamp Sv 9; hikâye 5; 3 vaka |
| 7 | 34 | 1.290 (363 / 494 / 320 / 113 / 0) | 10 | 1.290 | 337 | Odyometri 3, Atölye 3 | 0,2 / 23,6 / 0,0 | Depo 3 (645; 0,55) | 10 | Kamp Sv 10; 3 vaka |
| 8 | 37 | 913 (249 / 231 / 320 / 113 / 0) | 11 | 645 | 605 | Depo 3 | 0,0 / 23,8 / 0,0 | Kule 3 (645; 0,60) | 11 | Kamp Sv 11; hikâye 6; 3 vaka |
| 9 | 40 | 1.485 (305 / 547 / 480 / 153 / 0) | 5 | 1.290 | 800 | Kule 3, Klinik 3 | 0,2 / 19,0 / 4,6 | Tedavi 3 (645; 0,52) | 11 | hikâye 7; 3 vaka |
| 10 | 40 | 1.349 (480 / 276 / 480 / 113 / 0) | 3 | 1.830 | 319 | Tedavi 3, Kabin 3 | 0,2 / 0,0 / 23,6 | Denge 1 (80; 0,06) | 12 | Kamp Sv 12: Denge Tepesi; 3 vaka |
| 11 | 40 | 985 (261 / 101 / 480 / 143 / 0) | 26 | 1.024 | 280 | Denge 1, Tarama 3, Denge 2 | 0,1 / 4,7 / 19,0 | Park 3 (645; 0,51) | 13 | Kamp Sv 13; 3 vaka |
| 12 | 40 | 1.266 (414 / 120 / 540 / 193 / 0) | 0 | 1.290 | 257 | Park 3, Denge 3 | 0,2 / 23,6 / 0,0 | Merkez 4 (1.560; 1,30) | 13 | 3 vaka |
| 13 | 40 | 993 (259 / 66 / 570 / 98 / 0) | 12 | 0 | 1.250 | – | 0,0 / 23,8 / 0,0 | Merkez 4 (1.560; 1,44) | 13 | 2 vaka |
| 14 | 40 | 1.303 (288 / 392 / 570 / 53 / 0) | 0 | 1.560 | 993 | Merkez 4 | 0,3 / 23,5 / 0,0 | Odyometri 4 (1.114; 0,94) | 14 | Kamp Sv 14 |

### Gün gün: 3 oturum, takımsız

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 15 | 2.234 (1.122 / 683 / 236 / 193 / 0) | 3 | 2.066 | 268 | Depo 1, Merkez 2, Klinik 1, Odyometri 1, Kule 1, Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Atölye 2 | 0,3 / 3,7 / 11,5 | Depo 2 (299; 0,13) | 5 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); Kamp Sv 2; Kamp Sv 3: Sessiz Koru; Hasta Vakaları (bölüm 7); Kamp Sv 4; Kamp Sv 5; hikâye 1; hikâye 2; 3 vaka |
| 2 | 29 | 2.531 (876 / 626 / 640 / 389 / 0) | 14 | 2.777 | 22 | Tarama 1, Depo 2, Kule 2, Klinik 2, Tedavi 2, Kabin 2, Tarama 2, Merkez 3 | 0,4 / 23,1 / 0,0 | Odyometri 3 (645; 0,27) | 8 | Kamp Sv 6: Koklea Koyu; Kamp Sv 7; Kamp Sv 8; hikâye 3; hikâye 4; hikâye 5; 3 vaka |
| 3 | 40 | 2.853 (918 / 1.007 / 800 / 129 / 0) | 22 | 2.314 | 561 | Odyometri 3, Park 1, Park 2, Atölye 3, Klinik 3 | 0,6 / 22,9 / 0,0 | Depo 3 (645; 0,25) | 10 | Kamp Sv 9; Kamp Sv 10; hikâye 6; hikâye 7; 3 vaka |
| 4 | 40 | 2.641 (1.155 / 167 / 1.040 / 279 / 0) | 8 | 2.580 | 622 | Depo 3, Kule 3, Tedavi 3, Kabin 3 | 0,4 / 23,1 / 0,0 | Tarama 3 (645; 0,24) | 11 | Kamp Sv 11; 3 vaka |
| 5 | 40 | 2.462 (897 / 236 / 1.200 / 129 / 0) | 10 | 2.850 | 234 | Tarama 3, Park 3, Merkez 4 | 0,7 / 22,8 / 0,0 | Odyometri 4 (1.114; 0,42) | 11 | 3 vaka |
| 6 | 40 | 2.651 (1.004 / 318 / 1.200 / 129 / 0) | 8 | 2.138 | 747 | Denge 1, Klinik 4, Denge 2, Denge 3 | 0,4 / 23,1 / 0,0 | Odyometri 4 (1.114; 0,43) | 12 | Kamp Sv 12: Denge Tepesi; hikâye 8; 3 vaka |
| 7 | 40 | 2.912 (1.054 / 400 / 1.290 / 169 / 0) | 0 | 3.342 | 317 | Kule 4, Odyometri 4, Atölye 4 | 0,7 / 22,8 / 0,0 | Depo 4 (1.114; 0,42) | 13 | Kamp Sv 13; 3 vaka |
| 8 | 40 | 2.916 (960 / 297 / 1.530 / 129 / 0) | 6 | 2.228 | 1.005 | Depo 4, Tedavi 4 | 0,7 / 22,8 / 0,0 | Kabin 4 (1.114; 0,39) | 13 | 3 vaka |
| 9 | 40 | 3.203 (1.064 / 249 / 1.720 / 169 / 0) | 21 | 3.342 | 866 | Kabin 4, Tarama 4, Park 4 | 0,7 / 22,8 / 0,0 | Denge 4 (1.114; 0,37) | 14 | Kamp Sv 14; 3 vaka |
| 10 | 40 | 3.070 (974 / 247 / 1.720 / 129 / 0) | 3 | 3.498 | 438 | Denge 4, Merkez 5 | 0,8 / 22,7 / 0,0 | Odyometri 5 (1.703; 0,56) | 14 | 3 vaka |
| 11 | 40 | 3.134 (993 / 268 / 1.760 / 114 / 0) | 27 | 3.406 | 166 | Kule 5, Klinik 5 | 1,2 / 22,3 / 0,0 | Odyometri 5 (1.703; 0,54) | 15 | Kamp Sv 15; hikâye 9; 2 vaka |
| 12 | 40 | 3.031 (1.068 / 134 / 1.760 / 69 / 0) | 0 | 1.703 | 1.494 | Odyometri 5 | 0,4 / 23,1 / 0,0 | Atölye 5 (1.703; 0,55) | 15 | – |
| 13 | 40 | 3.071 (990 / 112 / 1.900 / 69 / 0) | 0 | 3.785 | 781 | Atölye 5, Depo 5, Kütüphane 1, Kütüphane 2 | 1,1 / 22,4 / 0,0 | Tedavi 5 (1.703; 0,55) | 16 | Kamp Sv 16: Araştırma Yerleşkesi |
| 14 | 40 | 3.757 (1.021 / 467 / 2.200 / 69 / 0) | 0 | 3.462 | 1.076 | Kütüphane 3, Tedavi 5, Kütüphane 4 | 0,8 / 22,7 / 0,0 | Kabin 5 (1.703; 0,52) | 16 | – |

### Gün gün: 6 oturum, takımsız

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 29 | 4.060 (1.998 / 1.230 / 396 / 437 / 0) | 14 | 3.940 | 220 | Depo 1, Merkez 2, Klinik 1, Odyometri 1, Kule 1, Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Atölye 2, Depo 2, Kule 2, Tarama 1, Klinik 2, Tedavi 2, Kabin 2, Tarama 2 | 0,7 / 8,8 / 5,5 | Merkez 3 (903; 0,22) | 7 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); Kamp Sv 2; Kamp Sv 3: Sessiz Koru; Hasta Vakaları (bölüm 7); Kamp Sv 4; Kamp Sv 5; Kamp Sv 6: Koklea Koyu; Kamp Sv 7; hikâye 1; hikâye 2; hikâye 3; hikâye 4; hikâye 5; 3 vaka |
| 2 | 40 | 4.226 (2.057 / 934 / 900 / 335 / 0) | 19 | 3.862 | 583 | Merkez 3, Park 1, Park 2, Klinik 3, Odyometri 3, Atölye 3, Depo 3 | 0,6 / 22,4 / 0,0 | Kule 3 (645; 0,16) | 10 | Kamp Sv 8; Kamp Sv 9; Kamp Sv 10; hikâye 6; hikâye 7; 3 vaka |
| 3 | 40 | 3.760 (1.901 / 364 / 1.350 / 145 / 0) | 6 | 3.225 | 1.118 | Kule 3, Tedavi 3, Kabin 3, Tarama 3, Park 3 | 0,6 / 22,4 / 0,0 | Merkez 4 (1.560; 0,39) | 11 | Kamp Sv 11; 3 vaka |
| 4 | 40 | 3.818 (1.997 / 286 / 1.350 / 185 / 0) | 8 | 4.902 | 35 | Merkez 4, Klinik 4, Odyometri 4, Atölye 4 | 1,4 / 21,6 / 0,0 | Depo 4 (1.114; 0,28) | 11 | 3 vaka |
| 5 | 40 | 3.845 (2.038 / 261 / 1.400 / 145 / 0) | 18 | 3.252 | 628 | Denge 1, Denge 2, Denge 3, Kule 4, Depo 4 | 0,8 / 22,2 / 0,0 | Tedavi 4 (1.114; 0,29) | 13 | Kamp Sv 12: Denge Tepesi; Kamp Sv 13; hikâye 8; 3 vaka |
| 6 | 40 | 4.356 (2.050 / 242 / 1.920 / 145 / 0) | 6 | 4.456 | 528 | Tedavi 4, Kabin 4, Tarama 4, Park 4 | 0,9 / 22,1 / 0,0 | Denge 4 (1.114; 0,28) | 13 | 3 vaka |
| 7 | 40 | 4.403 (1.959 / 379 / 1.920 / 145 / 0) | 0 | 3.498 | 1.433 | Denge 4, Merkez 5 | 1,0 / 22,0 / 0,0 | Odyometri 5 (1.703; 0,41) | 14 | Kamp Sv 14; 3 vaka |
| 8 | 40 | 4.436 (2.049 / 322 / 1.920 / 145 / 0) | 10 | 5.109 | 760 | Kule 5, Klinik 5, Odyometri 5 | 1,6 / 21,4 / 0,0 | Atölye 5 (1.703; 0,39) | 14 | hikâye 9; 3 vaka |
| 9 | 40 | 4.565 (2.079 / 271 / 2.030 / 185 / 0) | 29 | 5.109 | 216 | Atölye 5, Depo 5, Tedavi 5 | 1,6 / 21,4 / 0,0 | Kabin 5 (1.703; 0,38) | 15 | Kamp Sv 15; 3 vaka |
| 10 | 40 | 4.788 (1.974 / 269 / 2.400 / 145 / 0) | 3 | 3.486 | 1.518 | Kabin 5, Tarama 5, Kütüphane 1 | 1,0 / 22,0 / 0,0 | Park 5 (1.703; 0,37) | 16 | Kamp Sv 16: Araştırma Yerleşkesi; 3 vaka |
| 11 | 40 | 5.006 (2.183 / 294 / 2.400 / 130 / 0) | 21 | 5.464 | 1.061 | Kütüphane 2, Park 5, Kütüphane 3, Kütüphane 4, Denge 5 | 1,4 / 21,6 / 0,0 | Kütüphane 5 (1.703; 0,36) | 16 | 2 vaka |
| 12 | 40 | 4.802 (2.159 / 158 / 2.400 / 85 / 0) | 0 | 5.074 | 788 | Kütüphane 5, Merkez 6 | 0,6 / 22,4 / 0,0 | Odyometri 6 (2.408; 0,49) | 17 | Kamp Sv 17 |
| 13 | 40 | 4.592 (1.974 / 134 / 2.400 / 85 / 0) | 0 | 4.816 | 565 | Klinik 6, Odyometri 6 | 1,4 / 21,6 / 0,0 | Atölye 6 (2.408; 0,50) | 17 | – |
| 14 | 40 | 5.109 (2.182 / 392 / 2.450 / 85 / 0) | 0 | 4.816 | 858 | Atölye 6, Depo 6 | 1,6 / 21,4 / 0,0 | Kule 6 (2.408; 0,50) | 17 | – |

### Gün gün: 1 oturum, takımlı

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 1.096 (507 / 383 / 0 / 45 / 161) | 10 | 1.068 | 128 | Depo 1, Merkez 2, Odyometri 1 | 0,0 / 0,0 / 4,8 | Atölye 1 (80; 0,07) | 2 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); takıma katıldı; Kamp Sv 2 |
| 2 | 10 | 978 (283 / 192 / 160 / 169 / 174) | 13 | 998 | 108 | Klinik 1, Kule 1, Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Atölye 2 | 0,0 / 4,8 / 19,0 | Depo 2 (299; 0,29) | 5 | Kamp Sv 3: Sessiz Koru; Kamp Sv 4; Hasta Vakaları (bölüm 7); Kamp Sv 5; hikâye 1; hikâye 2 |
| 3 | 15 | 1.580 (350 / 273 / 160 / 223 / 574) | 101 | 1.575 | 113 | Tarama 1, Depo 2, Kule 2, Klinik 2, Tedavi 2, Kabin 2 | 0,0 / 23,8 / 0,0 | Tarama 2 (299; 0,25) | 7 | Kamp Sv 6: Koklea Koyu; Kamp Sv 7; hikâye 3; hikâye 4; 3 vaka |
| 4 | 20 | 1.679 (305 / 357 / 320 / 193 / 504) | 31 | 1.202 | 590 | Tarama 2, Merkez 3 | 0,0 / 23,8 / 0,0 | Odyometri 3 (645; 0,46) | 8 | Kamp Sv 8; 3 vaka |
| 5 | 25 | 1.496 (278 / 442 / 320 / 283 / 174) | 29 | 1.669 | 418 | Klinik 3, Park 1, Park 2, Odyometri 3 | 0,1 / 23,7 / 0,0 | Atölye 3 (645; 0,41) | 10 | Kamp Sv 9; Kamp Sv 10; hikâye 5; hikâye 6; hikâye 7; 3 vaka |
| 6 | 29 | 1.370 (301 / 152 / 320 / 123 / 474) | 58 | 1.290 | 498 | Atölye 3, Depo 3 | 0,1 / 23,7 / 0,0 | Kule 3 (645; 0,43) | 10 | 3 vaka |
| 7 | 34 | 2.244 (374 / 494 / 480 / 123 / 774) | 43 | 2.674 | 68 | Merkez 4, Klinik 4 | 0,6 / 23,2 / 0,0 | Kule 3 (645; 0,38) | 11 | Kamp Sv 11; 3 vaka |
| 8 | 37 | 1.707 (249 / 231 / 480 / 123 / 624) | 38 | 1.669 | 107 | Kule 3, Denge 1, Denge 2, Tedavi 3 | 0,1 / 23,7 / 0,0 | Kabin 3 (645; 0,36) | 12 | Kamp Sv 12: Denge Tepesi; hikâye 8; 3 vaka |
| 9 | 40 | 1.729 (305 / 547 / 540 / 163 / 174) | 10 | 1.759 | 77 | Kabin 3, Kule 4 | 0,3 / 23,6 / 0,0 | Tarama 3 (645; 0,34) | 12 | 3 vaka |
| 10 | 40 | 1.993 (480 / 276 / 540 / 123 / 574) | 97 | 1.935 | 135 | Tarama 3, Park 3, Denge 3 | 0,3 / 23,5 / 0,0 | Odyometri 4 (1.114; 0,62) | 13 | Kamp Sv 13; 3 vaka |
| 11 | 40 | 1.629 (261 / 101 / 570 / 193 / 504) | 46 | 1.114 | 650 | Odyometri 4 | 0,1 / 23,7 / 0,0 | Atölye 4 (1.114; 0,62) | 14 | Kamp Sv 14; 3 vaka |
| 12 | 40 | 1.452 (425 / 120 / 570 / 163 / 174) | 10 | 1.114 | 988 | Atölye 4 | 0,1 / 23,7 / 0,0 | Depo 4 (1.114; 0,66) | 14 | 3 vaka |
| 13 | 40 | 1.485 (266 / 66 / 570 / 108 / 474) | 67 | 2.228 | 244 | Depo 4, Tedavi 4 | 0,5 / 23,4 / 0,0 | Kabin 4 (1.114; 0,73) | 14 | 2 vaka |
| 14 | 40 | 2.280 (296 / 392 / 760 / 58 / 774) | 39 | 2.228 | 296 | Kabin 4, Tarama 4 | 0,5 / 23,4 / 0,0 | Park 4 (1.114; 0,64) | 15 | Kamp Sv 15 |

### Gün gün: 3 oturum, takımlı

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 15 | 2.667 (1.140 / 683 / 236 / 207 / 400) | 23 | 2.693 | 73 | Depo 1, Merkez 2, Odyometri 1, Klinik 1, Kule 1, Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Atölye 2, Depo 2, Kule 2, Klinik 2 | 0,0 / 10,7 / 4,8 | Tarama 1 (80; 0,03) | 6 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); takıma katıldı; Kamp Sv 2; Kamp Sv 3: Sessiz Koru; Kamp Sv 4; Hasta Vakaları (bölüm 7); Kamp Sv 5; Kamp Sv 6: Koklea Koyu; hikâye 1; hikâye 2; 3 vaka |
| 2 | 29 | 3.187 (876 / 626 / 800 / 479 / 406) | 50 | 2.904 | 356 | Tarama 1, Tedavi 2, Kabin 2, Tarama 2, Park 1, Park 2, Merkez 3, Klinik 3 | 0,1 / 23,4 / 0,0 | Odyometri 3 (645; 0,22) | 9 | Kamp Sv 7; Kamp Sv 8; Kamp Sv 9; hikâye 3; hikâye 4; hikâye 5; hikâye 6; hikâye 7; 3 vaka |
| 3 | 40 | 3.819 (918 / 1.007 / 940 / 149 / 806) | 106 | 4.140 | 35 | Odyometri 3, Atölye 3, Depo 3, Kule 3, Merkez 4 | 0,5 / 23,0 / 0,0 | Tedavi 3 (645; 0,20) | 10 | Kamp Sv 10; 3 vaka |
| 4 | 40 | 3.557 (1.155 / 167 / 1.200 / 299 / 736) | 38 | 2.580 | 1.012 | Tedavi 3, Kabin 3, Tarama 3, Park 3 | 0,1 / 23,4 / 0,0 | Odyometri 4 (1.114; 0,32) | 11 | Kamp Sv 11; 3 vaka |
| 5 | 40 | 2.888 (897 / 236 / 1.200 / 149 / 406) | 42 | 3.252 | 648 | Klinik 4, Denge 1, Kule 4, Denge 2, Denge 3 | 0,4 / 23,1 / 0,0 | Odyometri 4 (1.114; 0,33) | 12 | Kamp Sv 12: Denge Tepesi; hikâye 8; 3 vaka |
| 6 | 40 | 3.486 (1.022 / 318 / 1.290 / 149 / 706) | 69 | 3.342 | 791 | Odyometri 4, Atölye 4, Depo 4 | 0,5 / 23,0 / 0,0 | Tedavi 4 (1.114; 0,34) | 13 | Kamp Sv 13; 3 vaka |
| 7 | 40 | 4.388 (1.073 / 400 / 1.720 / 189 / 1.006) | 49 | 4.456 | 723 | Tedavi 4, Kabin 4, Tarama 4, Park 4 | 1,0 / 22,5 / 0,0 | Denge 4 (1.114; 0,31) | 13 | 3 vaka |
| 8 | 40 | 3.982 (960 / 297 / 1.720 / 149 / 856) | 40 | 3.498 | 1.207 | Denge 4, Merkez 5 | 0,7 / 22,8 / 0,0 | Odyometri 5 (1.703; 0,43) | 14 | Kamp Sv 14; 3 vaka |
| 9 | 40 | 3.669 (1.064 / 249 / 1.760 / 189 / 406) | 51 | 3.406 | 1.469 | Kule 5, Klinik 5 | 0,7 / 22,8 / 0,0 | Odyometri 5 (1.703; 0,42) | 15 | Kamp Sv 15; hikâye 9; 3 vaka |
| 10 | 40 | 3.955 (993 / 247 / 1.760 / 149 / 806) | 103 | 5.109 | 315 | Odyometri 5, Atölye 5, Depo 5 | 1,1 / 22,4 / 0,0 | Tedavi 5 (1.703; 0,44) | 15 | 3 vaka |
| 11 | 40 | 4.357 (1.019 / 268 / 2.200 / 134 / 736) | 47 | 3.841 | 831 | Kütüphane 1, Kütüphane 2, Kütüphane 3, Kütüphane 4, Tedavi 5 | 0,6 / 22,9 / 0,0 | Kabin 5 (1.703; 0,43) | 16 | Kamp Sv 16: Araştırma Yerleşkesi; 2 vaka |
| 12 | 40 | 3.909 (1.085 / 134 / 2.200 / 84 / 406) | 20 | 3.406 | 1.334 | Kabin 5, Tarama 5 | 0,7 / 22,8 / 0,0 | Park 5 (1.703; 0,42) | 16 | – |
| 13 | 40 | 4.092 (990 / 112 / 2.200 / 84 / 706) | 65 | 5.109 | 318 | Park 5, Denge 5, Kütüphane 5 | 1,1 / 22,4 / 0,0 | Merkez 6 (3.371; 0,82) | 16 | – |
| 14 | 40 | 4.828 (1.021 / 467 / 2.250 / 84 / 1.006) | 51 | 3.371 | 1.775 | Merkez 6 | 0,1 / 23,4 / 0,0 | Odyometri 6 (2.408; 0,56) | 17 | Kamp Sv 17 |

### Gün gün: 6 oturum, takımlı

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 29 | 4.876 (2.016 / 1.230 / 457 / 536 / 638) | 60 | 4.653 | 323 | Depo 1, Merkez 2, Odyometri 1, Klinik 1, Kule 1, Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Atölye 2, Depo 2, Tarama 1, Kule 2, Klinik 2, Tedavi 2, Kabin 2, Tarama 2, Merkez 3, Park 1 | 0,1 / 12,1 / 2,8 | Odyometri 3 (645; 0,13) | 9 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); takıma katıldı; Kamp Sv 2; Kamp Sv 3: Sessiz Koru; Kamp Sv 4; Hasta Vakaları (bölüm 7); Kamp Sv 5; Kamp Sv 6: Koklea Koyu; Kamp Sv 7; Kamp Sv 8; Kamp Sv 9; hikâye 1; hikâye 2; hikâye 3; hikâye 4; hikâye 5; hikâye 6; hikâye 7; 3 vaka |
| 2 | 40 | 5.018 (2.066 / 934 / 1.010 / 365 / 644) | 33 | 4.814 | 527 | Klinik 3, Park 2, Odyometri 3, Atölye 3, Depo 3, Kule 3, Tedavi 3, Kabin 3 | 0,3 / 22,7 / 0,0 | Tarama 3 (645; 0,13) | 10 | Kamp Sv 10; 3 vaka |
| 3 | 40 | 4.834 (1.901 / 364 / 1.350 / 175 / 1.044) | 124 | 5.078 | 283 | Tarama 3, Park 3, Merkez 4, Klinik 4, Odyometri 4 | 1,1 / 21,9 / 0,0 | Atölye 4 (1.114; 0,23) | 11 | Kamp Sv 11; 3 vaka |
| 4 | 40 | 4.968 (2.033 / 286 / 1.460 / 215 / 974) | 48 | 4.366 | 885 | Denge 1, Denge 2, Denge 3, Atölye 4, Depo 4, Kule 4 | 0,8 / 22,2 / 0,0 | Tedavi 4 (1.114; 0,23) | 12 | Kamp Sv 12: Denge Tepesi; 3 vaka |
| 5 | 40 | 5.039 (2.038 / 261 / 1.920 / 175 / 644) | 54 | 5.570 | 354 | Tedavi 4, Kabin 4, Tarama 4, Park 4, Denge 4 | 1,3 / 21,7 / 0,0 | Merkez 5 (2.384; 0,48) | 13 | Kamp Sv 13; hikâye 8; 3 vaka |
| 6 | 40 | 5.330 (2.050 / 242 / 1.920 / 175 / 944) | 85 | 4.087 | 1.597 | Merkez 5, Kule 5 | 1,2 / 21,8 / 0,0 | Odyometri 5 (1.703; 0,33) | 14 | Kamp Sv 14; hikâye 9; 3 vaka |
| 7 | 40 | 5.721 (2.003 / 379 / 1.920 / 175 / 1.244) | 53 | 6.812 | 507 | Klinik 5, Odyometri 5, Atölye 5, Depo 5 | 1,7 / 21,3 / 0,0 | Tedavi 5 (1.703; 0,32) | 14 | 3 vaka |
| 8 | 40 | 6.087 (2.096 / 322 / 2.400 / 175 / 1.094) | 58 | 5.109 | 1.484 | Tedavi 5, Kabin 5, Tarama 5 | 1,1 / 21,9 / 0,0 | Park 5 (1.703; 0,30) | 15 | Kamp Sv 15; 3 vaka |
| 9 | 40 | 5.609 (2.079 / 271 / 2.400 / 215 / 644) | 59 | 5.544 | 1.550 | Kütüphane 1, Kütüphane 2, Kütüphane 3, Kütüphane 4, Park 5, Denge 5 | 1,1 / 21,9 / 0,0 | Kütüphane 5 (1.703; 0,29) | 16 | Kamp Sv 16: Araştırma Yerleşkesi; 3 vaka |
| 10 | 40 | 5.862 (1.974 / 269 / 2.400 / 175 / 1.044) | 113 | 5.074 | 2.338 | Kütüphane 5, Merkez 6 | 0,3 / 22,7 / 0,0 | Odyometri 6 (2.408; 0,41) | 17 | Kamp Sv 17; 3 vaka |
| 11 | 40 | 6.045 (2.218 / 294 / 2.400 / 160 / 974) | 61 | 7.224 | 1.159 | Klinik 6, Odyometri 6, Atölye 6 | 2,0 / 21,0 / 0,0 | Depo 6 (2.408; 0,41) | 17 | 2 vaka |
| 12 | 40 | 5.817 (2.215 / 158 / 2.690 / 110 / 644) | 38 | 4.816 | 2.160 | Depo 6, Kule 6 | 1,6 / 21,4 / 0,0 | Tedavi 6 (2.408; 0,41) | 18 | Kamp Sv 18 |
| 13 | 40 | 6.093 (2.025 / 134 / 2.880 / 110 / 944) | 75 | 7.224 | 1.029 | Tedavi 6, Kabin 6, Tarama 6 | 2,0 / 21,0 / 0,0 | Park 6 (2.408; 0,40) | 18 | – |
| 14 | 40 | 6.808 (2.182 / 392 / 2.880 / 110 / 1.244) | 53 | 7.224 | 613 | Park 6, Denge 6, Kütüphane 6 | 2,2 / 20,8 / 0,0 | Merkez 7 (4.518; 0,72) | 18 | – |

### Uygulanan değişiklikler (14 gün; eski kural → bugünkü kod)

_Aynı ölçüm ve model; "eski" sütunu eski kuralı simülasyon kancasıyla yeniden kurar. Yerel talep: sınır olmasa o gün istenecek en yüksek yerel ödül jetonu._

| Değişiklik | Profil | Gelir (jeton) | Başlatılan inşaat | 14. gün cüzdan | Taşkın günü | Kamp Sv | Hikâye | Kristal geliri | Kırpılan yerel jeton (ilk 3 gün) | Kırpılan yerel jeton (14 gün) | En yoğun gün yerel talep | Yeni hasta gelen gün | Boş klinik günü (vaka bitmeden) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 1 oturum, takımsız | 15.464 | 33 | 993 | 2 | 14 | 7 | 98 | 0 | 0 | 547 | 11/13 → 11/13 | 1 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 3 oturum, takımsız | 39.690 → **40.468** | 54 | 299 → **1.076** | 0 | 16 | 9 | 122 | 516 → **0** | 516 → **0** | 1.007 | 11/14 → 11/14 | 0 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 6 oturum, takımsız | 60.149 → **61.768** | 63 → **64** | 1.648 → **858** | 0 | 17 | 9 | 134 | 963 → **0** | 963 → **0** | 1.230 | 11/14 → 11/14 | 0 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 1 oturum, takımlı | 22.720 | 41 | 296 | 0 | 15 | 8 | 592 | 0 | 0 | 547 | 11/13 → 11/13 | 1 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 3 oturum, takımlı | 52.067 → **52.783** | 60 | 1.059 → **1.775** | 0 | 17 | 9 | 754 | 516 → **0** | 516 → **0** | 1.007 | 11/14 → 11/14 | 0 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 6 oturum, takımlı | 76.611 → **78.109** | 70 → **71** | 1.524 → **613** | 0 | 18 | 9 | 914 | 963 → **0** | 963 → **0** | 1.230 | 11/14 → 11/14 | 0 |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 1 oturum, takımsız | 14.824 → **15.464** | 31 → **33** | 803 → **993** | 1 → **2** | 11 → **14** | 5 → **7** | 39 → **98** | 0 | 0 | 547 | 4/13 → **11/13** | 9 → **1** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 3 oturum, takımsız | 40.057 → **40.468** | 51 → **54** | 1.100 → **1.076** | 0 | 15 → **16** | 9 | 89 → **122** | 0 | 0 | 1.007 | 8/14 → **11/14** | 6 → **0** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 6 oturum, takımsız | 61.509 → **61.768** | 64 | 599 → **858** | 0 | 16 → **17** | 9 | 101 → **134** | 0 | 0 | 1.230 | 8/14 → **11/14** | 6 → **0** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 1 oturum, takımlı | 22.415 → **22.720** | 39 → **41** | 949 → **296** | 0 | 14 → **15** | 8 | 553 → **592** | 0 | 0 | 547 | 8/13 → **11/13** | 5 → **1** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 3 oturum, takımlı | 52.577 → **52.783** | 60 | 864 → **1.775** | 0 | 16 → **17** | 9 | 713 → **754** | 0 | 0 | 1.007 | 8/14 → **11/14** | 6 → **0** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 6 oturum, takımlı | 77.894 → **78.109** | 71 | 398 → **613** | 0 | 18 | 9 | 881 → **914** | 0 | 0 | 1.230 | 8/14 → **11/14** | 6 → **0** |
| Ö1 + Ö4 ikisi birlikte | 1 oturum, takımsız | 14.824 → **15.464** | 31 → **33** | 803 → **993** | 1 → **2** | 11 → **14** | 5 → **7** | 39 → **98** | 0 | 0 | 547 | 4/13 → **11/13** | 9 → **1** |
| Ö1 + Ö4 ikisi birlikte | 3 oturum, takımsız | 39.429 → **40.468** | 51 → **54** | 473 → **1.076** | 0 | 15 → **16** | 9 | 89 → **122** | 516 → **0** | 516 → **0** | 1.007 | 8/14 → **11/14** | 6 → **0** |
| Ö1 + Ö4 ikisi birlikte | 6 oturum, takımsız | 59.949 → **61.768** | 63 → **64** | 1.448 → **858** | 0 | 16 → **17** | 9 | 101 → **134** | 963 → **0** | 963 → **0** | 1.230 | 8/14 → **11/14** | 6 → **0** |
| Ö1 + Ö4 ikisi birlikte | 1 oturum, takımlı | 22.415 → **22.720** | 39 → **41** | 949 → **296** | 0 | 14 → **15** | 8 | 553 → **592** | 0 | 0 | 547 | 8/13 → **11/13** | 5 → **1** |
| Ö1 + Ö4 ikisi birlikte | 3 oturum, takımlı | 51.861 → **52.783** | 60 | 148 → **1.775** | 0 | 16 → **17** | 9 | 713 → **754** | 516 → **0** | 516 → **0** | 1.007 | 8/14 → **11/14** | 6 → **0** |
| Ö1 + Ö4 ikisi birlikte | 6 oturum, takımlı | 76.336 → **78.109** | 70 → **71** | 1.249 → **613** | 0 | 17 → **18** | 9 | 881 → **914** | 963 → **0** | 963 → **0** | 1.230 | 8/14 → **11/14** | 6 → **0** |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 1 oturum, takımsız | 15.464 | 34 → **33** | 419 → **993** | 1 → **2** | 13 → **14** | 5 → **7** | 82 → **98** | 0 | 0 | 547 | 11/13 → 11/13 | 1 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 3 oturum, takımsız | 41.621 → **40.468** | 52 → **54** | 961 → **1.076** | 0 | 15 → **16** | 5 → **9** | 88 → **122** | 0 | 0 | 1.007 | 11/14 → 11/14 | 0 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 6 oturum, takımsız | 63.113 → **61.768** | 64 | 2.204 → **858** | 0 | 17 | 5 → **9** | 100 → **134** | 0 | 0 | 1.230 | 11/14 → 11/14 | 0 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 1 oturum, takımlı | 22.720 | 41 | 296 | 0 | 15 | 8 | 592 | 0 | 0 | 547 | 11/13 → 11/13 | 1 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 3 oturum, takımlı | 52.783 | 60 | 1.775 | 0 | 17 | 9 | 754 | 0 | 0 | 1.007 | 11/14 → 11/14 | 0 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 6 oturum, takımlı | 78.109 | 71 | 613 | 0 | 18 | 9 | 914 | 0 | 0 | 1.230 | 11/14 → 11/14 | 0 |
| Ö3 Bir inşaat sıraya alınabilir (parası peşin; MK-011) | 1 oturum, takımsız | 13.713 → **15.464** | 23 → **33** | 1.881 → **993** | 13 → **2** | 13 → **14** | 8 → **7** | 94 → **98** | 0 | 0 | 547 | 10/12 → **11/13** | 2 → **1** |
| Ö3 Bir inşaat sıraya alınabilir (parası peşin; MK-011) | 3 oturum, takımsız | 38.328 → **40.468** | 50 → **54** | 1.871 → **1.076** | 0 | 16 | 9 | 122 | 0 | 0 | 1.007 | 11/14 → 11/14 | 1 → **0** |
| Ö3 Bir inşaat sıraya alınabilir (parası peşin; MK-011) | 6 oturum, takımsız | 60.530 → **61.768** | 62 → **64** | 2.206 → **858** | 0 | 17 | 9 | 134 | 0 | 0 | 1.230 | 11/14 → 11/14 | 0 |
| Ö3 Bir inşaat sıraya alınabilir (parası peşin; MK-011) | 1 oturum, takımlı | 18.988 → **22.720** | 22 → **41** | 2.343 → **296** | 12 → **0** | 13 → **15** | 9 → **8** | 584 → **592** | 0 | 0 | 547 | 11/12 → **11/13** | 1 |
| Ö3 Bir inşaat sıraya alınabilir (parası peşin; MK-011) | 3 oturum, takımlı | 49.262 → **52.783** | 58 → **60** | 828 → **1.775** | 3 → **0** | 17 | 9 | 754 | 0 | 0 | 1.007 | 11/14 → 11/14 | 1 → **0** |
| Ö3 Bir inşaat sıraya alınabilir (parası peşin; MK-011) | 6 oturum, takımlı | 76.121 → **78.109** | 69 → **71** | 942 → **613** | 1 → **0** | 18 | 9 | 914 | 0 | 0 | 1.230 | 11/14 → 11/14 | 0 |

### Öneri denemeleri (14 gün; temel → öneriyle)

| Öneri | Profil | Gelir (jeton) | Başlatılan inşaat | 14. gün cüzdan | Taşkın günü | Kamp Sv | Hikâye | Kristal geliri | Kırpılan yerel jeton | Yeni hasta gelen gün | Boş klinik günü (vaka bitmeden) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 1 oturum, takımsız | 15.464 → **18.024** | 33 → **36** | 993 → **211** | 2 | 14 | 7 → **8** | 98 → **106** | 0 | 11 | 1 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 3 oturum, takımsız | 40.468 → **43.574** | 54 → **56** | 1.076 → **776** | 0 | 16 | 9 | 122 | 0 | 11 | 0 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 6 oturum, takımsız | 61.768 → **62.169** | 64 | 858 → **1.259** | 0 | 17 | 9 | 134 | 0 | 11 | 0 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 1 oturum, takımlı | 22.720 → **25.925** | 41 → **42** | 296 → **328** | 0 | 15 | 8 | 592 | 0 | 11 | 1 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 3 oturum, takımlı | 52.783 → **55.599** | 60 → **61** | 1.775 → **2.184** | 0 | 17 | 9 | 754 | 0 | 11 | 0 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 6 oturum, takımlı | 78.109 → **78.349** | 71 | 613 → **853** | 0 | 18 | 9 | 914 | 0 | 11 | 0 |

<!-- simule:bitir -->

## 4. Elle doğrulama (formülden hesap ↔ simülasyon)

1. **Merkez Sv 5 maliyeti**, `buildCost('merkez', 5)` (`packages/shared/src/social.ts:186`):
   - jeton: `80 × 1,4 × 5^1,9`. `5^1,9 = e^(1,9 × ln 5) = e^(1,9 × 1,6094) = e^3,0579 = 21,28`; `112 × 21,28 = 2.383,6` → **2.384**.
   - süre: `60 × 1,4 × 5^2,2 = 84 × e^3,5407 = 84 × 34,49 = 2.897 sn` ≈ 48 dk.
   - Simülasyon: "Merkez 5 (2.384; …)" (3 oturum, takımsız, 11. gün "Sıradaki" sütunu). ✔
2. **Günde 1 oturumda Depo Sv 1 geliri** (`apps/server/src/camp.ts:229-232`): oturumlar arası 24 sa, dolma süresi 8 sa (Denge Sv 0).
   `floor(min(24, 8) × 1 × 20) = 160` jeton/gün. Simülasyon: 1 oturum, takımsız, 2-7. gün depo sütunu **160**. ✔
   Depo Sv 2 olduktan sonra (7. gün) 8-13. gün **320**. ✔
3. **Bölüm 8'in beklenen süresi ve notası**:
   - bitirme %79 (docs/12 §6 ilk kez oynayan tablosu), `deneme = 1/0,79 = 1,266`;
   - ölçüm (`insan-olcum.json`, 16 oyuncu): 14 bitiren ortalama 90,14 sn ve 71,79 nota; 2 bitiremeyen 57,85 sn ve 32,5 nota;
   - süre `0,266 × (57,85 + 20) + (90,14 + 20) = 20,7 + 110,1 = 130,8` sn → tabloda **131**;
   - nota `0,266 × 32,5 + 71,79 = 80,4` → tabloda **80,4**. ✔
4. (Ek) **Kamp görevi**: 1. gün 1 oturumda kamp geliri 45 = 3 × 15 (`KG_ODUL.gunluk`, `packages/content/src/kamp-gorev.ts:50`).
   O gün henüz vaka ve kamp oyunu yok: 6 bölümde oyun açılır ama Odyometri ve Kule kurulu değil. ✔

## 5. Değerlendirme

**Her gün yapılacak anlamlı bir şey var mı?**
- Kamp tarafında evet: her profilde her gün en az bir inşaat başlıyor ve Kamp Sv 1-2 günde bir artıyor.
- Bölüm tarafında 6 oturumda 2., 3 oturumda 3., 1 oturumda 9. günden sonra yeni bölüm yok; bu oyuncular için gün tekrar oynama, depo ve kamp etrafında dönüyor.
- Klinikte boşluklar var: 1. kademenin 10 vakası 3-4 günde bitiyor.
  - 1 oturum takımsız, Klinik Sv 4'e 14 günde varamıyor; bu yüzden 8-14. günlerde yeni hasta yok.
  - 3-6 oturumda 2. kademe de Klinik Sv 7'den önce tükeniyor, ör. 6 oturum takımsızda 11-14. gün.
- Takımsız oyuncunun hikâyesi 3. (6 oturum: 2.) günden sonra kilitliydi. _(Ö2 ile giderildi, §7.)_

**Duvar ya da taşkın var mı?**
- 14 günde duvar yok. Sıradaki bina hiçbir profilde 1 günlük gelirden pahalı değil: 14. gün 0,06-0,82.
- Taşkın günde 1 oturum oynayan oyuncuda var. Sebep jeton fazlası değil, tek inşaat kuyruğu: inşaatlar kısa, oyuncu seyrek uğruyor. Bu oyuncu "biriktirdim ama harcayamıyorum" yaşıyor.
- Takımlı profillerde ikinci bir taşkın kristalde. Stok büyüyor, harcanacak tek yer hızlandırma ve inşaatlar zaten kısa.

**Ödül temposu dürüst ve çekici mi?**
- Dürüst. Tüm ödüller önceden yazılı, şans yok, süre baskısı yok, kristal yalnız süre kısaltıyor (pay-to-win yok).
- İki istisna dürüstlükle ilgili:
  - Yerel ödül sınırı: gösterilen ödül, dürüst oyunda 3 gün boyunca kesiliyor.
  - Takımsız oyuncunun hikâyesi: 6. bölüm "Takım Ruhu" sosyal adım olmadan geçilemiyor. Sahte aciliyet değil ama zorunlu sosyalleşme. _(Ö2 ile giderildi, §7.)_
- Çekicilik: ilk gün çok yoğun, 6 oturumda 15 açılış ve olay, Kamp Sv 1 → 6. İkinci haftada tempo yumuşuyor: 1-2 günde bir Kamp Sv, her gün 2-3 inşaat.
  - Uzun hedefler (Merkez Sv 8, hikâye 10, Denge Tepesi) 14 günde 1 oturumlu oyuncuya uzak.

## 6. Öneriler (ilk ölçüm; Ö1, Ö2, Ö3 ve Ö4 uygulandı, §7. Ö5 sahibin kararında; sayısal etki §3 "Öneri denemeleri" tablosunda)

Öneriler yalnız simülasyon kancalarıyla denendi (`simule(P, H)`); oyun kodu değişmedi.

**Ö1 · (uygulandı: 1.500, §7) Yerel ödül sınırını dürüst oyunun üstüne çıkarın: 600 → 1000 jeton/gün** (ya da ilk 3 günü sınırsız tutun).
- Etki: 3 oturumda kırpılan jeton 616 → 67, 6 oturumda 963 → 270; takımlı 3 oturumda 616 → 0.
- Toplam gelir %1-3 artar; taşkın günü 3 oturum takımsızda 4 → 1.
- Sınır hâlâ sahte istemciye karşı koruyor (1000 jeton ≈ yarım günlük oyun).

**Ö2 · (uygulandı, §7) Takımsız oyuncuya hikâye 6-7 için tek kişilik eşdeğer adım** (ör. "takıma katıl" yerine "3 vaka çöz" ya da "Kamp Sv 4").
Takım yolu açık kalır; bu yalnız zorunlu sosyalleşmeyi kaldırır.
- Etki: takımsız profillerde hikâye 5/10 → 8-9/10, kristal +34 (39 → 73, 55 → 89, 67 → 101), Kamp Sv +1.

**Ö3 · (uygulandı, §7) Bir inşaatı sıraya alma** (parası peşin, süren bitince kendiliğinden başlar; yeni para birimi ya da satın alma yok).
- Etki, günde 1 oturum: başlatılan inşaat takımsız 24 → 31, takımlı 22 → 40; taşkın günü 13 → 1 ve 12 → 0; 14. gün cüzdanı 3.567 → 223.
- 3-6 oturumda etki küçük (+1-6 inşaat); onlar zaten jetonla sınırlı.
- Seyrek oynayanı cezalandırmaz, sık oynayana avantaj vermez.

**Ö4 · (uygulandı, §7) Vaka kademelerini Klinik Sv 1/4/7 yerine 1/2/3'te açın** (ya da kademe bitince salonda "yeni vakalar Klinik Sv N ile" yerine bir sonraki kademeden bir vaka gelsin).
- Etki: yeni hasta gelen gün 1 oturum takımsız 4 → 8, diğer profillerde 8 → 11; kristal +10-33 (başarı basamakları).
- Toplam vaka sayısı (32) değişmez; vakalar yalnız daha düzenli dağılır.

**Ö5 · Kristale güç vermeyen bir harcama yeri ekleyin ya da takım kristalini dengeleyin.** Simülasyonla ölçülmedi; etkisi stok üzerinden hesaplandı.
- 14. günde takımlı oyuncunun kullanılmayan kristali 563-881. Bu 9-15 saatlik hızlandırma, oysa 14 günün en uzun inşaatı 72 dk.
- Seçenekler, hepsi pay-to-win değil:
  - (a) kristalle süs ya da Dolap kozmetiği (önceden yazılı fiyat);
  - (b) takım hediyelerindeki kristali yarıya indirmek: 14 günde ~260-410 kristal az (takımlı − takımsız farkının yarısı);
  - (c) takımsız oyuncuya da haftalık bir kristal yolu: Ö2 bunun bir kısmını karşılıyor.
- Hızlandırma için daha çok kristal vermek önerilmez: inşaatlar zaten kısa.

**Denendi, önerilmez · Depo dolma süresi 8 → 12 sa.**
- Günde 1 oturumun depo geliri artar (13.500 → 15.180), ama taşkın da artar: cüzdan 3.567 → 5.247, takımlı 3 oturumda taşkın 2 → 5.
- Az oynayanın sorunu gelir değil kuyruk (Ö3).

**İzlenecek (öneri değil).**
- 6 oturumlu oyuncu 2. günden sonra günde ~32 tekrar denemesinden ~2.000 jeton alıyor. Bölüm içeriği arttıkça bu doğal olarak azalır.
- İçerik büyümezse, tekrar oynamanın jetonu 40. bölümden sonra ekonominin en büyük ikinci kaynağı olarak kalır.
- Yetenek ağacı (2.720 jeton) çoğu profilde 2-5. günde bitiyor; sonrası için jeton çukuru yalnız inşaat ve takım teknolojisi.

## 7. Uygulandı: Ö1, Ö4, Ö2, Ö3

Yenilenen insan ölçümüyle (`--olc --k 16`; af0dd99'daki yüzme 2★ kuralıyla 21, 22, 24, 26-28. bölümlerde bitirenin ortalama
yıldızı 1,1-1,7 → 1,7-2,0; süre, nota ve bitirme değişmedi) ve bugünkü kodla. Ayrıntı §3 "Uygulanan değişiklikler" tablosunda: "eski"
sütunu eski kuralı simülasyon kancasıyla aynı ölçüm ve aynı modelle yeniden kurar.

**Ö1 · Yerel ödül sınırı 600 → 1.500 jeton/gün** (`LOCAL_JETON_DAILY_MAX`, `packages/shared/src/social.ts`; sunucu uygular,
`apps/server/src/wallet.ts`; istemci bildirimi aynı sabiti gösterir, `apps/web/src/net.ts`).
- Sınır olmasa istenecek en yüksek günlük yerel ödül (ölçülen dürüst talep): 6 oturum 1. gün **1.270**, 3 oturum 3. gün 1.107
  (takımlı 1.007), 1 oturum 587. Belgenin önerdiği 1000 yetmiyordu: 6 oturumda 270, 3 oturumda 107 jeton yine kesilirdi.
- 1.500 = en yoğun dürüst gün + ~%18 pay (beklenen değer modeli; Şanslı Nota ve oturum uzunluğu sapması). Sahte istemci günde en çok
  1.500 jeton basabilir: 6 oturumlu dürüst oyuncunun 14 günlük ortalama günlük gelirinin (~4.400) üçte birinden az.
- Kesilen yerel jeton (ilk 3 gün): 3 oturum **656 → 0**, 6 oturum **1.003 → 0** (takımsız ve takımlı). İlk ölçümde 616 / 963'tü; fark
  yeni yüzme yıldızlarının açtığı başarımlar. Hiçbir profilde 14 gün boyunca kesilen jeton kalmadı.
- 14 günlük gelir +%1,6-2,5 (3 oturum takımsız 38.284 → 38.952; 6 oturum 59.963 → 61.369); taşkın günü değişimi ±1.
- Kod yorumu ölçülen gerekçeyi yazar (eski "dürüst oyunda aşılmaz" ölçümle çelişiyordu). Test: `apps/server/test/wallet.test.ts`.

**Ö4 · Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3** (`KG_KURAL.kademeSv`, `packages/content/src/kamp-gorev.ts:30`). Günde 3 hasta,
salon 6 ve Bilgi düzeyi kuralları değişmedi; vakalar yine kademe sırasıyla gelir.

| Profil | Yeni hasta gelen gün / vaka açık gün | Boş klinik günü (vaka bitmeden) | Kristal (14 gün) |
|---|---|---|---|
| 1 oturum, takımsız | 4/12 → **8/12** | 8 → **4** | 39 → 49 |
| 3 oturum, takımsız | 8/14 → **11/14** | 6 → **1** | 55 → 88 |
| 6 oturum, takımsız | 8/14 → **11/14** | 6 → **0** | 67 → 100 |
| 1 oturum, takımlı | 8/12 → **11/12** | 4 → **1** | 563 → 584 |
| 3 oturum, takımlı | 8/14 → **11/14** | 6 → **1** | 713 → 754 |
| 6 oturum, takımlı | 8/14 → **11/14** | 6 → **0** | 881 → 914 |

- 11/14 bu modelde tavandır: 32 vaka ÷ günde 3 hasta = 11 gün; sonrasında klinikte yeni vaka kalmaz (Vaka Defteri'nden tekrar oynanır).
  Bu yüzden "vaka açık günlerin ≥ %85'i" ölçütü 14 günde 3-6 oturumlu profillerde hiçbir kademe düzeniyle tutmaz; doğru ölçüt
  "vaka bitmeden boş gün". Kalan tek boş gün çoğu profilde Kliniğin kurulduğu gün (o gün o oturumdan sonra hasta gelmez).
- Günde 1 oturum takımsızda 4 boş gün kalıyor (kuruluş günü, 8., 13. ve 14. gün): model oyuncusu binaları "en ucuz önce" sırasıyla
  kuruyor ve klinikteki "Yeni vakalar Odyoloji Kliniği Sv N ile gelir" uyarısına göre Kliniği öne almıyor. Denenen Sv 1/1/2
  (§3, "Ö4b") bu profilde boş günü 1'e indirir ama 2. kademeyi Sv 1'e çeker ve Klinik Sv 3'ün vaka getirmesini kaldırır; uygulanmadı.
- Anlatıcı satırları eski seviyeyi söylemiyor (`kg-h8-giris` "Kliniğini büyüt: zor vakalar uzman ister" doğru kalıyor);
  seslendirilmiş satır değişmedi. Hikâyenin "Klinik Sv 4" (8. bölüm) ve "Klinik Sv 7" (10. bölüm) adımları hikâye hedefidir,
  değişmedi. Testler: `packages/content/src/kamp-gorev.test.ts`, `apps/server/test/kamp-gorev.test.ts` (kademe 1 bitince ertesi
  gün Sv 2 ile 2. kademeden 3 hasta).

**Ö2 · Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı** (`KgAdim.ya`, `packages/content/src/kamp-gorev.ts` `KG_HIKAYE`;
sunucu `storyAlt`, `apps/server/src/camp-quests.ts`). Takım yolu aynı kaldı; adım iki yoldan biriyle biter. "Ya da" adımı bölüm
açıldıktan sonra yapılanı sayar (sunucu bölüm açılınca sayacın değerini bir kez saklar, `kg_story_base`): eskiden biriken sayaç adımı
kendiliğinden bitirmez.

| Bölüm | Takım yolu (aynı) | ya da (takımsız) |
|---|---|---|
| 6 Takım Ruhu | Bir takıma katıl | Bu bölümde klinikte 3 vaka çöz (yeni ya da Vaka Defteri’nden) |
| 6 | Takım arkadaşlarının inşaatına 3 yardım et | Bu bölümde kamp oyunlarında 3 tur oyna |
| 6 | Bir konsültasyon iste ya da görüş bildir | Bu bölümde Vaka Defteri’nden bir vakayı yeniden çöz |
| 7 Kampını Güzelleştir | Bir arkadaşının ya da takım arkadaşının kampını ziyaret et | Bu bölümde kampında 2 inşaat başlat |

8–10. bölümlerde takıma bağlı adım yok. Emek: takım yolu bir oturumda biter; takımsız yol 1 oturumda 1-2 gün (yeni hasta günde 3 gelir,
ödüllü oyun turu oturum başına 2), 3-6 oturumda aynı ya da ertesi gün. Modelde oyuncu "ya da" adımı Vaka Defteri'nden yeniden çözme
isterse bir vakayı yeniden çözer (yeni yıldız sayılmaz).

| Profil | Hikâye (14 gün) | 6. / 7. bölüm biten gün | Kristal (14 gün) | Kamp Sv |
|---|---|---|---|---|
| 1 oturum, takımsız | 5 → **8** | – → 9. / 10. gün | 49 → **94** | 11 → **13** |
| 3 oturum, takımsız | 5 → **9** | – → 4. / 4. gün | 88 → **122** | 15 → **16** |
| 6 oturum, takımsız | 5 → **9** | – → 3. / 3. gün | 100 → **134** | 16 → **17** |
| takımlı (1, 3, 6 oturum) | 9 (değişmedi) | 7. / 3. / 2. gün (değişmedi) | değişmedi | değişmedi |

- Takımsız oyuncu 10. bölüme yine ulaşamıyor: Merkez Sv 8 14 günde hiçbir profilde yok (takımlı da 9/10).
- Takımsız 14. gün cüzdanı 1 oturumda 3.847 → 1.881: hikâyenin 8. bölümü Klinik Sv 4 istediği için jeton binaya gidiyor.
- Bölüm 6–7'de ortadayken sürüm gelen oyuncu: takım yolundaki ilerlemesi olduğu gibi kalır; "ya da" adımının tabanı ilk bakışta
  yazılır (o andan sonra yapılan sayılır). Bitmiş ve ödülü alınmış bölümler değişmez. Testler: `apps/server/test/kamp-gorev.test.ts`
  ("ya da" yolu, idempotent taban, eski kayıt göçü, takım yolu), `packages/content/src/kamp-gorev.test.ts`.
- Seslendirilmiş satırlar değişmedi. `kg-h6-giris` ("Takımına katıl, yardım et, zor vakada danış.") takım yolunu söylüyor; ekranda
  "ya da" satırları yazılı. Yeni satır önerisi sahipte (rapor).

**Ö3 · İnşaat sırası** (MK-011; `camp.queue` / `camp.unqueue`, `apps/server/src/camp.ts`; tablo `camp_queue`; kurallar
docs/14-kamp.md §14). Süren inşaata ek olarak bir sonraki inşaat sıraya alınır; bedeli o an düşer, sıradan çıkarılınca tamamı geri
verilir. Süren inşaat bitince sunucu sıradakini öncekinin bittiği anda başlatır (`completeDue`; oyuncu çevrimdışıyken ve sunucu
kapalıyken de). Tek sıra yeri; hızlandırıcı ve takım yardımı yalnız süren inşaata; Merkez sınırı sıraya alırken süren inşaat
bittikten sonraki Merkez seviyesine göre. Simülasyon temeli bu kural (`H.sira`, varsayılan açık); "eski" sütunu sırasız kuraldır
(Ö1, Ö2, Ö4 uygulanmış; aşağıdaki "önce" değerleri 4. tur Ö2 sonrası temeldir).

| Profil | Taşkın günü | 14. gün cüzdan | Başlatılan inşaat (14 gün) | Kamp Sv | Hikâye | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (%) |
|---|---|---|---|---|---|---|
| 1 oturum, takımsız | 13 → **2** | 1.881 → **993** | 23 → **33** | 13 → **14** | 8 → **7** | %0 / %0 / %100 → %1 / %62 / %38 |
| 1 oturum, takımlı | 12 → **0** | 2.343 → **296** | 22 → **41** | 13 → **15** | 9 → **8** | %1 / %0 / %99 → %1 / %92 / %8 |
| 3 oturum, takımsız | 0 | 1.871 → **1.076** | 50 → **54** | 16 | 9 | %2 / %50 / %48 → %3 / %94 / %4 |
| 3 oturum, takımlı | 3 → **0** | 828 → **1.775** | 58 → **60** | 17 | 9 | %2 / %41 / %56 → %2 / %96 / %1 |
| 6 oturum, takımsız | 0 | 2.206 → **858** | 62 → **64** | 17 | 9 | %4 / %80 / %16 → %5 / %93 / %2 |
| 6 oturum, takımlı | 1 → **0** | 942 → **613** | 69 → **71** | 18 | 9 | %5 / %82 / %13 → %5 / %94 / %1 |

- Az oynayan oyuncunun jetonu artık kampa dönüşüyor. Günde 1 oturum takımsızda kalan iki taşkın günü 1. gün (cüzdan 197, sıradaki
  bina 80 jeton; iki yer de dolu) ve 10. gün (319 / 80). Kuyruk "oyuncu yok" yüzünden boş kalma payı %100 → %38: inşaatlar hâlâ
  dakikalar sürüyor, sıra iki inşaatı karşılıyor. İkinci sıra yeri önerilmez (sık oynayana avantaj, karmaşıklık).
- Aynı profilde 13. gün inşaatsız ("ilk duvar günü" 13): bütün binalar Merkez 3 sınırında, Merkez 4 (1.560) cüzdandan (1.250)
  pahalı; ertesi gün başlar. Sıra eski taşkın jetonunu erken binalara harcattığı için Merkez adımına birikim bir gün gecikiyor.
- Günde 1 oturumda Kampın Hikâyesi 14. günde bir bölüm geride (takımsız 8 → 7, takımlı 9 → 8): model oyuncusu sırayı en ucuz
  binayla dolduruyor, hikâyenin pahalı bina adımına (Merkez) jeton biriktirmiyor. Oyun kodu bir şeyi kapatmıyor; oyuncu sırayı
  boş bırakabilir ya da çıkarabilir. İzlenecek: gerekirse sıra seçiminde hikâye adımını öne alan bir ipucu (arayüz), kural değil.
- 3-6 oturumda etki küçük (+2-4 inşaat); bu oyuncular zaten jetonla sınırlı ("jeton yok" payı arttı, çünkü sıra parayı erken bağlar).
- Yeni para birimi, satın alma ya da süre baskısı yok; sıradaki inşaat görünür ("Sırada: X" çipi) ve her an ücretsiz geri alınır.
- Ölçüm farkı (ilk Ö3 denemesine göre): sıradaki inşaata takım yardımı gelmez (sunucu kuralı), "inşaat başlat" görevi başlayınca
  sayılır, sıradaki inşaat kuyruk "dolu" süresine eklenir, Merkez sınırı süren Merkez bitince olacak seviyeye göre.
  Testler: `apps/server/test/camp-queue.test.ts`.
