# Kamp ekonomisi ölçümü (MK-001)

İlk 14 günde jeton ve kristal geliri, harcama yerleri ve inşaat temposu. Üç oturum profili (günde 1 / 3 / 6 oturum), her biri
takımsız ve takımlı: altı profil. İlk ölçüm (6c1f4ac) oyun kodunu değiştirmedi; öneriler sahibin kararına bırakıldı.
**Ö1 ve Ö4 uygulandı** (§7). §1, §4-§6 metni ilk ölçümü (Ö1/Ö4 öncesi) anlatır; §3 tabloları bugünkü kodla ve yenilenen insan
ölçümüyle yeniden üretildi.

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
2. **Az oynayan oyuncuda jeton taşıyor.**
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
- Birikim için beklemez. Aynı anda tek inşaat vardır (`apps/server/src/camp.ts:184`).
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
| 1 oturum, takımsız | 9 | yok | 0 | 13 | 10/12 (2) | %0 / %0 / %100 | 0,08 | 1.881 | 94 | 13 | 8/10 | 14/14 |
| 3 oturum, takımsız | 3 | yok | 0 | 0 | 11/14 (1) | %2 / %50 / %48 | 0,55 | 1.871 | 122 | 16 | 9/10 | 14/14 |
| 6 oturum, takımsız | 2 | yok | 0 | 0 | 11/14 (0) | %4 / %80 / %16 | 0,50 | 2.206 | 134 | 17 | 9/10 | 14/14 |
| 1 oturum, takımlı | 9 | yok | 0 | 12 | 11/12 (1) | %1 / %0 / %99 | 0,06 | 2.343 | 584 | 13 | 9/10 | 14/14 |
| 3 oturum, takımlı | 3 | yok | 0 | 3 | 11/14 (1) | %2 / %41 / %56 | 0,41 | 828 | 754 | 17 | 9/10 | 14/14 |
| 6 oturum, takımlı | 2 | yok | 0 | 1 | 11/14 (0) | %5 / %82 / %13 | 0,39 | 942 | 914 | 18 | 9/10 | 14/14 |

### Açılış günleri (gün; – = 14 günde yok)

| Profil | Kamp Görevleri | Vakalar (Klinik kurulu) | Tedavi Odası | Kamp Sv 3 (Sessiz Koru) | Akustik Kabin | Kamp Sv 6 (Koklea Koyu) | Tarama Birimi | Kamp Sv 9 (Park) | Kamp Sv 12 (Denge Tepesi) | Merkez Sv 5 | Merkez Sv 8 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 oturum, takımsız | 1 | 3 | 5 | 2 | 5 | 4 | 6 | 7 | 12 | – | – |
| 3 oturum, takımsız | 1 | 1 | 2 | 1 | 2 | 2 | 2 | 4 | 6 | 12 | – |
| 6 oturum, takımsız | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 5 | 8 | – |
| 1 oturum, takımlı | 1 | 3 | 4 | 2 | 5 | 4 | 5 | 7 | 10 | 13 | – |
| 3 oturum, takımlı | 1 | 1 | 2 | 1 | 2 | 2 | 2 | 3 | 6 | 7 | – |
| 6 oturum, takımlı | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 4 | 7 | – |

### Gelir kaynakları (14 gün toplamı, jeton)

| Profil | Bölüm | Yerel (görev, takvim, sandık, hazine, başarım) | Depo | Kamp Görevleri ve vakalar | Takım ve arkadaş | Toplam | Harcanan: bina | Harcanan: yetenek | Kristal geliri | Yerel sınırda kırpılan |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 oturum, takımsız | 4.530 | 4.166 | 3.200 | 1.817 | 0 | **13.713** | 9.212 | 2.720 | 94 | 0 |
| 3 oturum, takımsız | 13.959 | 5.352 | 16.856 | 2.161 | 0 | **38.328** | 33.836 | 2.720 | 122 | 0 |
| 6 oturum, takımsız | 28.425 | 5.675 | 24.036 | 2.393 | 0 | **60.530** | 55.703 | 2.720 | 134 | 0 |
| 1 oturum, takımlı | 4.547 | 4.166 | 2.080 | 2.062 | 6.133 | **18.988** | 14.025 | 2.720 | 584 | 0 |
| 3 oturum, takımlı | 14.050 | 5.352 | 17.986 | 2.486 | 9.388 | **49.262** | 45.813 | 2.720 | 754 | 0 |
| 6 oturum, takımlı | 28.697 | 5.675 | 26.166 | 2.863 | 12.720 | **76.121** | 72.559 | 2.720 | 914 | 0 |

### Gün gün: 1 oturum, takımsız

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 935 (507 / 383 / 0 / 45 / 0) | 0 | 770 | 265 | Depo 1 | 0,0 / 0,0 / 4,8 | Odyometri 1 (80; 0,09) | 1 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6) |
| 2 | 10 | 752 (275 / 232 / 160 / 85 / 0) | 0 | 718 | 299 | Merkez 2, Odyometri 1 | 0,0 / 0,0 / 23,8 | Atölye 1 (80; 0,09) | 3 | Kamp Sv 2; Kamp Sv 3: Sessiz Koru; Hasta Vakaları (bölüm 7) |
| 3 | 15 | 902 (340 / 273 / 160 / 129 / 0) | 3 | 1.100 | 101 | Klinik 1, Kule 1 | 0,0 / 0,0 / 23,8 | Atölye 1 (80; 0,09) | 5 | Kamp Sv 4; Kamp Sv 5; hikâye 1 |
| 4 | 20 | 967 (296 / 357 / 160 / 153 / 0) | 8 | 580 | 487 | Atölye 1, Tedavi 1 | 0,0 / 0,0 / 23,8 | Kabin 1 (80; 0,09) | 6 | Kamp Sv 6: Koklea Koyu; hikâye 2; 3 vaka |
| 5 | 25 | 985 (270 / 442 / 160 / 113 / 0) | 3 | 610 | 862 | Kabin 1, Tarama 1 | 0,0 / 0,0 / 23,8 | Odyometri 2 (299; 0,31) | 7 | Kamp Sv 7; 3 vaka |
| 6 | 29 | 810 (285 / 252 / 160 / 113 / 0) | 3 | 598 | 1.074 | Odyometri 2, Atölye 2 | 0,1 / 0,0 / 23,8 | Depo 2 (299; 0,32) | 7 | 3 vaka |
| 7 | 34 | 1.315 (363 / 494 / 160 / 298 / 0) | 11 | 379 | 2.010 | Park 1, Depo 2 | 0,1 / 0,0 / 23,8 | Kule 2 (299; 0,29) | 9 | Kamp Sv 8; Kamp Sv 9; hikâye 3; hikâye 4; hikâye 5; 1 vaka |
| 8 | 37 | 846 (242 / 231 / 320 / 53 / 0) | 0 | 598 | 2.258 | Kule 2, Klinik 2 | 0,1 / 0,0 / 23,8 | Tedavi 2 (299; 0,30) | 9 | – |
| 9 | 40 | 1.357 (297 / 587 / 320 / 153 / 0) | 14 | 598 | 3.017 | Tedavi 2, Kabin 2 | 0,1 / 0,0 / 23,8 | Tarama 2 (299; 0,25) | 10 | Kamp Sv 10; hikâye 6; 3 vaka |
| 10 | 40 | 1.136 (467 / 236 / 320 / 113 / 0) | 18 | 1.548 | 2.605 | Merkez 3, Klinik 3 | 0,2 / 0,0 / 23,6 | Tarama 2 (299; 0,27) | 11 | Kamp Sv 11; hikâye 7; 3 vaka |
| 11 | 40 | 818 (254 / 101 / 320 / 143 / 0) | 5 | 1.560 | 1.863 | Merkez 4 | 0,3 / 0,0 / 23,5 | Tarama 2 (299; 0,27) | 11 | 3 vaka |
| 12 | 40 | 995 (402 / 120 / 320 / 153 / 0) | 0 | 1.114 | 1.744 | Klinik 4 | 0,2 / 0,0 / 23,6 | Denge 1 (80; 0,08) | 12 | Kamp Sv 12: Denge Tepesi; 3 vaka |
| 13 | 40 | 791 (252 / 66 / 320 / 153 / 0) | 21 | 645 | 1.890 | Kule 3 | 0,0 / 0,0 / 23,8 | Denge 1 (80; 0,09) | 12 | hikâye 8; 3 vaka |
| 14 | 40 | 1.105 (280 / 392 / 320 / 113 / 0) | 8 | 1.114 | 1.881 | Kule 4 | 0,2 / 0,0 / 23,6 | Denge 1 (80; 0,08) | 13 | Kamp Sv 13; 3 vaka |

### Gün gün: 3 oturum, takımsız

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 15 | 2.210 (1.122 / 723 / 236 / 129 / 0) | 0 | 2.188 | 122 | Depo 1, Odyometri 1, Merkez 2, Klinik 1, Kule 1 | 0,1 / 0,0 / 15,4 | Atölye 1 (80; 0,04) | 4 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); Kamp Sv 2; Hasta Vakaları (bölüm 7); Kamp Sv 3: Sessiz Koru; Kamp Sv 4; hikâye 1 |
| 2 | 29 | 2.054 (859 / 626 / 400 / 169 / 0) | 3 | 1.738 | 438 | Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Tarama 1, Atölye 2 | 0,2 / 0,0 / 23,3 | Depo 2 (299; 0,14) | 6 | Kamp Sv 5; Kamp Sv 6: Koklea Koyu; hikâye 2; 3 vaka |
| 3 | 40 | 2.998 (902 / 1.107 / 640 / 349 / 0) | 17 | 2.244 | 1.192 | Depo 2, Kule 2, Klinik 2, Tedavi 2, Kabin 2, Tarama 2 | 0,2 / 0,0 / 23,3 | Merkez 3 (903; 0,37) | 8 | Kamp Sv 7; Kamp Sv 8; hikâye 3; hikâye 4; hikâye 5; 3 vaka |
| 4 | 40 | 2.329 (1.123 / 167 / 800 / 239 / 0) | 24 | 2.572 | 949 | Park 1, Park 2, Merkez 3, Klinik 3, Odyometri 3 | 0,3 / 0,0 / 23,2 | Atölye 3 (645; 0,26) | 10 | Kamp Sv 9; Kamp Sv 10; hikâye 6; hikâye 7; 3 vaka |
| 5 | 40 | 2.242 (897 / 236 / 940 / 169 / 0) | 3 | 1.935 | 1.256 | Atölye 3, Depo 3, Kule 3 | 0,1 / 0,0 / 23,4 | Tedavi 3 (645; 0,26) | 11 | Kamp Sv 11; 3 vaka |
| 6 | 40 | 2.691 (1.004 / 318 / 1.200 / 169 / 0) | 18 | 3.868 | 79 | Merkez 4, Klinik 4, Denge 1, Kule 4 | 0,9 / 10,1 / 12,5 | Denge 2 (299; 0,12) | 12 | Kamp Sv 12: Denge Tepesi; hikâye 8; 3 vaka |
| 7 | 40 | 2.803 (1.044 / 400 / 1.230 / 129 / 0) | 0 | 2.234 | 648 | Denge 2, Tedavi 3, Kabin 3, Tarama 3 | 0,2 / 19,5 / 3,8 | Park 3 (645; 0,25) | 12 | 3 vaka |
| 8 | 40 | 2.620 (934 / 297 / 1.260 / 129 / 0) | 0 | 2.404 | 864 | Park 3, Denge 3, Odyometri 4 | 0,2 / 3,6 / 19,6 | Atölye 4 (1.114; 0,41) | 13 | Kamp Sv 13; 3 vaka |
| 9 | 40 | 2.913 (1.064 / 249 / 1.430 / 169 / 0) | 0 | 3.342 | 435 | Atölye 4, Depo 4, Tedavi 4 | 0,7 / 22,8 / 0,0 | Kabin 4 (1.114; 0,40) | 13 | 3 vaka |
| 10 | 40 | 3.070 (974 / 247 / 1.720 / 129 / 0) | 30 | 3.342 | 163 | Kabin 4, Tarama 4, Park 4 | 0,9 / 22,6 / 0,0 | Denge 4 (1.114; 0,39) | 14 | Kamp Sv 14; 3 vaka |
| 11 | 40 | 3.109 (993 / 268 / 1.720 / 129 / 0) | 5 | 1.114 | 2.158 | Denge 4 | 0,4 / 23,1 / 0,0 | Merkez 5 (2.384; 0,79) | 14 | 3 vaka |
| 12 | 40 | 3.065 (1.057 / 134 / 1.760 / 114 / 0) | 22 | 4.087 | 1.136 | Merkez 5, Kule 5 | 1,2 / 18,1 / 4,2 | Odyometri 5 (1.703; 0,55) | 15 | Kamp Sv 15; hikâye 9; 2 vaka |
| 13 | 40 | 2.906 (965 / 112 / 1.760 / 69 / 0) | 0 | 3.406 | 636 | Klinik 5, Odyometri 5 | 0,8 / 22,7 / 0,0 | Atölye 5 (1.703; 0,56) | 15 | – |
| 14 | 40 | 3.317 (1.021 / 467 / 1.760 / 69 / 0) | 0 | 2.082 | 1.871 | Atölye 5, Kütüphane 1, Kütüphane 2 | 0,7 / 19,1 / 3,8 | Depo 5 (1.703; 0,55) | 16 | Kamp Sv 16: Araştırma Yerleşkesi |

### Gün gün: 6 oturum, takımsız

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 29 | 3.750 (1.981 / 1.270 / 286 / 213 / 0) | 3 | 3.506 | 343 | Depo 1, Odyometri 1, Merkez 2, Klinik 1, Kule 1, Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Atölye 2, Tarama 1 | 0,3 / 0,0 / 14,7 | Depo 2 (299; 0,08) | 6 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); Kamp Sv 2; Hasta Vakaları (bölüm 7); Kamp Sv 3: Sessiz Koru; Kamp Sv 4; Kamp Sv 5; Kamp Sv 6: Koklea Koyu; hikâye 1; hikâye 2; 3 vaka |
| 2 | 40 | 4.225 (2.037 / 934 / 740 / 515 / 0) | 14 | 4.141 | 428 | Depo 2, Kule 2, Klinik 2, Tedavi 2, Kabin 2, Tarama 2, Merkez 3, Odyometri 3, Park 1, Park 2 | 0,6 / 6,2 / 16,3 | Atölye 3 (645; 0,16) | 9 | Kamp Sv 7; Kamp Sv 8; Kamp Sv 9; hikâye 3; hikâye 4; hikâye 5; 3 vaka |
| 3 | 40 | 3.580 (1.901 / 364 / 1.130 / 185 / 0) | 22 | 3.870 | 138 | Atölye 3, Depo 3, Klinik 3, Kule 3, Tedavi 3, Kabin 3 | 0,6 / 19,6 / 2,8 | Tarama 3 (645; 0,17) | 10 | Kamp Sv 10; hikâye 6; hikâye 7; 3 vaka |
| 4 | 40 | 3.900 (1.978 / 386 / 1.350 / 185 / 0) | 8 | 3.300 | 737 | Tarama 3, Park 3, Merkez 4 | 0,4 / 20,6 / 2,0 | Odyometri 4 (1.114; 0,29) | 11 | Kamp Sv 11; 3 vaka |
| 5 | 40 | 3.740 (1.984 / 261 / 1.350 / 145 / 0) | 18 | 4.366 | 112 | Klinik 4, Denge 1, Denge 2, Denge 3, Kule 4, Odyometri 4 | 1,0 / 19,4 / 2,6 | Atölye 4 (1.114; 0,30) | 12 | Kamp Sv 12: Denge Tepesi; hikâye 8; 3 vaka |
| 6 | 40 | 4.046 (2.050 / 242 / 1.610 / 145 / 0) | 6 | 3.342 | 816 | Atölye 4, Depo 4, Tedavi 4 | 1,1 / 21,9 / 0,0 | Kabin 4 (1.114; 0,29) | 13 | Kamp Sv 13; 3 vaka |
| 7 | 40 | 4.403 (1.959 / 379 / 1.920 / 145 / 0) | 0 | 4.456 | 763 | Kabin 4, Tarama 4, Park 4, Denge 4 | 1,1 / 21,9 / 0,0 | Merkez 5 (2.384; 0,59) | 13 | 3 vaka |
| 8 | 40 | 4.428 (2.041 / 322 / 1.920 / 145 / 0) | 10 | 4.087 | 1.104 | Merkez 5, Kule 5 | 1,2 / 19,8 / 2,0 | Odyometri 5 (1.703; 0,40) | 14 | Kamp Sv 14; hikâye 9; 3 vaka |
| 9 | 40 | 4.430 (2.054 / 271 / 1.920 / 185 / 0) | 29 | 5.109 | 425 | Klinik 5, Odyometri 5, Atölye 5 | 1,4 / 21,6 / 0,0 | Depo 5 (1.703; 0,39) | 15 | Kamp Sv 15; 3 vaka |
| 10 | 40 | 4.598 (1.974 / 269 / 2.210 / 145 / 0) | 3 | 3.406 | 1.617 | Depo 5, Tedavi 5 | 1,0 / 22,0 / 0,0 | Kabin 5 (1.703; 0,38) | 15 | 3 vaka |
| 11 | 40 | 5.006 (2.183 / 294 / 2.400 / 130 / 0) | 17 | 5.544 | 1.079 | Kütüphane 1, Kütüphane 2, Kütüphane 3, Kütüphane 4, Kabin 5, Tarama 5 | 1,1 / 13,7 / 8,2 | Park 5 (1.703; 0,36) | 16 | Kamp Sv 16: Araştırma Yerleşkesi; 2 vaka |
| 12 | 40 | 4.802 (2.159 / 158 / 2.400 / 85 / 0) | 4 | 5.109 | 772 | Park 5, Denge 5, Kütüphane 5 | 1,4 / 21,6 / 0,0 | Merkez 6 (3.371; 0,70) | 17 | Kamp Sv 17 |
| 13 | 40 | 4.592 (1.974 / 134 / 2.400 / 85 / 0) | 0 | 3.371 | 1.994 | Merkez 6 | 0,2 / 20,2 / 2,6 | Odyometri 6 (2.408; 0,50) | 17 | – |
| 14 | 40 | 5.029 (2.151 / 392 / 2.400 / 85 / 0) | 0 | 4.816 | 2.206 | Klinik 6, Odyometri 6 | 1,6 / 21,4 / 0,0 | Atölye 6 (2.408; 0,50) | 17 | – |

### Gün gün: 1 oturum, takımlı

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 1.096 (507 / 383 / 0 / 45 / 161) | 10 | 990 | 206 | Depo 1 | 0,0 / 0,0 / 4,8 | Odyometri 1 (80; 0,07) | 2 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); takıma katıldı; Kamp Sv 2 |
| 2 | 10 | 934 (283 / 232 / 160 / 85 / 174) | 10 | 1.038 | 102 | Odyometri 1, Merkez 2 | 0,0 / 0,0 / 23,8 | Atölye 1 (80; 0,08) | 3 | Kamp Sv 3: Sessiz Koru; Hasta Vakaları (bölüm 7) |
| 3 | 15 | 1.481 (340 / 273 / 160 / 134 / 574) | 93 | 1.430 | 153 | Klinik 1, Kule 1 | 0,0 / 0,0 / 23,8 | Atölye 1 (80; 0,07) | 5 | Kamp Sv 4; Kamp Sv 5; hikâye 1 |
| 4 | 20 | 1.611 (296 / 457 / 160 / 193 / 504) | 28 | 160 | 1.604 | Atölye 1, Tedavi 1 | 0,0 / 0,0 / 23,8 | Kabin 1 (80; 0,06) | 6 | Kamp Sv 6: Koklea Koyu; hikâye 2; 3 vaka |
| 5 | 25 | 1.209 (270 / 442 / 160 / 163 / 174) | 13 | 160 | 2.652 | Kabin 1, Tarama 1 | 0,0 / 0,0 / 23,8 | Odyometri 2 (299; 0,21) | 7 | Kamp Sv 7; 3 vaka |
| 6 | 29 | 1.202 (293 / 152 / 160 / 123 / 474) | 58 | 598 | 3.256 | Odyometri 2, Atölye 2 | 0,0 / 0,0 / 23,8 | Depo 2 (299; 0,22) | 8 | Kamp Sv 8; 3 vaka |
| 7 | 34 | 2.099 (363 / 494 / 160 / 308 / 774) | 60 | 1.202 | 4.154 | Klinik 2, Merkez 3 | 0,0 / 0,0 / 23,8 | Park 1 (80; 0,05) | 10 | Kamp Sv 9; Kamp Sv 10; hikâye 3; hikâye 4; hikâye 5; hikâye 6; hikâye 7; 1 vaka |
| 8 | 37 | 1.380 (242 / 231 / 160 / 123 / 624) | 30 | 2.205 | 3.329 | Klinik 3, Merkez 4 | 0,4 / 0,0 / 23,4 | Park 1 (80; 0,05) | 10 | 3 vaka |
| 9 | 40 | 1.381 (297 / 587 / 160 / 163 / 174) | 23 | 1.114 | 3.595 | Klinik 4 | 0,1 / 0,0 / 23,7 | Park 1 (80; 0,05) | 11 | Kamp Sv 11; 3 vaka |
| 10 | 40 | 1.560 (467 / 236 / 160 / 123 / 574) | 105 | 944 | 4.212 | Kule 2, Kule 3 | 0,1 / 0,0 / 23,7 | Park 1 (80; 0,06) | 12 | Kamp Sv 12: Denge Tepesi; hikâye 8; 3 vaka |
| 11 | 40 | 1.172 (254 / 101 / 160 / 153 / 504) | 25 | 1.114 | 4.269 | Kule 4 | 0,1 / 0,0 / 23,7 | Park 1 (80; 0,06) | 12 | 3 vaka |
| 12 | 40 | 1.019 (402 / 120 / 160 / 163 / 174) | 23 | 2.384 | 2.904 | Merkez 5 | 0,6 / 0,0 / 23,3 | Park 1 (80; 0,06) | 13 | Kamp Sv 13; 3 vaka |
| 13 | 40 | 1.115 (252 / 66 / 160 / 163 / 474) | 63 | 1.703 | 2.317 | Kule 5 | 0,3 / 0,0 / 23,5 | Park 1 (80; 0,07) | 13 | 3 vaka |
| 14 | 40 | 1.729 (280 / 392 / 160 / 123 / 774) | 43 | 1.703 | 2.343 | Klinik 5 | 0,3 / 0,0 / 23,5 | Park 1 (80; 0,06) | 13 | hikâye 9; 3 vaka |

### Gün gün: 3 oturum, takımlı

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 15 | 2.624 (1.130 / 723 / 236 / 134 / 400) | 20 | 2.588 | 135 | Depo 1, Odyometri 1, Merkez 2, Klinik 1, Kule 1 | 0,0 / 0,0 / 15,5 | Atölye 1 (80; 0,03) | 4 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); takıma katıldı; Kamp Sv 2; Hasta Vakaları (bölüm 7); Kamp Sv 3: Sessiz Koru; Kamp Sv 4; hikâye 1 |
| 2 | 29 | 2.650 (859 / 726 / 400 / 259 / 406) | 23 | 1.788 | 997 | Atölye 1, Tedavi 1, Kabin 1, Tarama 1, Odyometri 2, Atölye 2 | 0,0 / 0,0 / 23,5 | Depo 2 (299; 0,11) | 6 | Kamp Sv 5; Kamp Sv 6: Koklea Koyu; hikâye 2; 3 vaka |
| 3 | 40 | 3.484 (902 / 1.007 / 400 / 369 / 806) | 133 | 3.786 | 695 | Klinik 2, Merkez 3, Klinik 3, Park 1, Depo 2, Merkez 4 | 0,4 / 0,0 / 23,1 | Kule 2 (299; 0,10) | 9 | Kamp Sv 7; Kamp Sv 8; Kamp Sv 9; hikâye 3; hikâye 4; hikâye 5; hikâye 6; hikâye 7; 3 vaka |
| 4 | 40 | 3.085 (1.123 / 167 / 800 / 259 / 736) | 38 | 2.310 | 1.470 | Klinik 4, Kule 2, Tedavi 2, Kabin 2, Tarama 2 | 0,1 / 0,0 / 23,4 | Park 2 (299; 0,10) | 10 | Kamp Sv 10; 3 vaka |
| 5 | 40 | 2.661 (890 / 236 / 940 / 189 / 406) | 27 | 3.524 | 607 | Park 2, Odyometri 3, Atölye 3, Depo 3, Kule 3, Tedavi 3 | 0,3 / 3,7 / 19,5 | Kabin 3 (645; 0,21) | 11 | Kamp Sv 11; 3 vaka |
| 6 | 40 | 3.417 (1.004 / 318 / 1.200 / 189 / 706) | 87 | 2.783 | 1.241 | Kule 4, Denge 1, Denge 2, Kabin 3, Tarama 3 | 0,2 / 8,0 / 15,3 | Park 3 (645; 0,21) | 12 | Kamp Sv 12: Denge Tepesi; hikâye 8; 3 vaka |
| 7 | 40 | 3.859 (1.044 / 400 / 1.260 / 149 / 1.006) | 43 | 4.788 | 312 | Merkez 5, Park 3, Denge 3, Odyometri 4 | 0,9 / 10,3 / 12,3 | Atölye 4 (1.114; 0,34) | 13 | Kamp Sv 13; 3 vaka |
| 8 | 40 | 3.692 (960 / 297 / 1.430 / 149 / 856) | 46 | 3.931 | 73 | Atölye 4, Depo 4, Kule 5 | 0,7 / 22,8 / 0,0 | Tedavi 4 (1.114; 0,30) | 13 | 3 vaka |
| 9 | 40 | 3.629 (1.064 / 249 / 1.720 / 189 / 406) | 30 | 2.228 | 1.474 | Tedavi 4, Kabin 4 | 0,4 / 19,4 / 3,7 | Tarama 4 (1.114; 0,30) | 14 | Kamp Sv 14; hikâye 9; 3 vaka |
| 10 | 40 | 3.896 (974 / 247 / 1.720 / 149 / 806) | 124 | 3.931 | 1.439 | Klinik 5, Tarama 4, Park 4 | 0,5 / 0,0 / 23,0 | Denge 4 (1.114; 0,30) | 15 | Kamp Sv 15; 3 vaka |
| 11 | 40 | 3.875 (1.003 / 268 / 1.720 / 149 / 736) | 35 | 4.520 | 794 | Denge 4, Odyometri 5, Atölye 5 | 0,9 / 9,9 / 12,7 | Depo 5 (1.703; 0,45) | 15 | 3 vaka |
| 12 | 40 | 3.519 (1.085 / 134 / 1.760 / 134 / 406) | 32 | 3.841 | 472 | Kütüphane 1, Kütüphane 2, Kütüphane 3, Kütüphane 4, Depo 5 | 0,8 / 17,9 / 4,8 | Tedavi 5 (1.703; 0,45) | 16 | Kamp Sv 16: Araştırma Yerleşkesi; 2 vaka |
| 13 | 40 | 4.092 (990 / 112 / 2.200 / 84 / 706) | 65 | 3.406 | 1.159 | Tedavi 5, Kabin 5 | 0,7 / 22,8 / 0,0 | Tarama 5 (1.703; 0,44) | 16 | – |
| 14 | 40 | 4.778 (1.021 / 467 / 2.200 / 84 / 1.006) | 51 | 5.109 | 828 | Tarama 5, Park 5, Denge 5 | 1,0 / 18,0 / 4,5 | Kütüphane 5 (1.703; 0,41) | 17 | Kamp Sv 17 |

### Gün gün: 6 oturum, takımlı

| Gün | Bölüm | Gelir (bölüm / yerel / depo / kamp / takım) | Kristal | Harcanan | Cüzdan | Başlatılan inşaat | Kuyruk dolu / boş: jeton yok / boş: oyuncu yok (sa) | Sıradaki (maliyet; kaç günlük gelir) | Kamp Sv | Açılanlar ve olaylar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 29 | 4.491 (1.989 / 1.270 / 286 / 308 / 638) | 33 | 3.926 | 664 | Depo 1, Odyometri 1, Merkez 2, Klinik 1, Kule 1, Atölye 1, Tedavi 1, Kabin 1, Odyometri 2, Tarama 1, Atölye 2 | 0,0 / 0,0 / 15,0 | Depo 2 (299; 0,07) | 6 | Bugün (bölüm 2); Kamp (bölüm 3); Yetenekler (bölüm 3); Kamp Görevleri (bölüm 4); Takım (bölüm 5); Kamp oyunları (bölüm 6); takıma katıldı; Kamp Sv 2; Hasta Vakaları (bölüm 7); Kamp Sv 3: Sessiz Koru; Kamp Sv 4; Kamp Sv 5; Kamp Sv 6: Koklea Koyu; hikâye 1; hikâye 2; 3 vaka |
| 2 | 40 | 4.768 (2.025 / 934 / 620 / 545 / 644) | 60 | 5.281 | 151 | Klinik 2, Merkez 3, Klinik 3, Park 1, Depo 2, Kule 2, Tedavi 2, Kabin 2, Tarama 2, Park 2, Merkez 4 | 0,4 / 3,3 / 19,3 | Odyometri 3 (645; 0,14) | 10 | Kamp Sv 7; Kamp Sv 8; Kamp Sv 9; Kamp Sv 10; hikâye 3; hikâye 4; hikâye 5; hikâye 6; hikâye 7; 3 vaka |
| 3 | 40 | 4.587 (1.893 / 364 / 1.070 / 215 / 1.044) | 124 | 4.339 | 399 | Odyometri 3, Atölye 3, Depo 3, Kule 3, Tedavi 3, Klinik 4 | 0,5 / 22,5 / 0,0 | Kabin 3 (645; 0,14) | 11 | Kamp Sv 11; 3 vaka |
| 4 | 40 | 4.822 (1.997 / 286 / 1.350 / 215 / 974) | 48 | 5.187 | 35 | Kabin 3, Tarama 3, Park 3, Odyometri 4, Denge 1, Denge 2, Denge 3, Atölye 4 | 0,5 / 22,5 / 0,0 | Depo 4 (1.114; 0,24) | 12 | Kamp Sv 12: Denge Tepesi; 3 vaka |
| 5 | 40 | 4.729 (2.038 / 261 / 1.610 / 175 / 644) | 54 | 4.456 | 307 | Kule 4, Depo 4, Tedavi 4, Kabin 4 | 1,1 / 21,9 / 0,0 | Tarama 4 (1.114; 0,24) | 13 | Kamp Sv 13; hikâye 8; 3 vaka |
| 6 | 40 | 5.330 (2.050 / 242 / 1.920 / 175 / 944) | 75 | 3.342 | 2.296 | Tarama 4, Park 4, Denge 4 | 0,5 / 22,5 / 0,0 | Merkez 5 (2.384; 0,48) | 14 | Kamp Sv 14; 3 vaka |
| 7 | 40 | 5.777 (1.959 / 479 / 1.920 / 175 / 1.244) | 63 | 7.943 | 130 | Merkez 5, Kule 5, Klinik 5, Odyometri 5 | 1,9 / 18,9 / 2,3 | Atölye 5 (1.703; 0,32) | 14 | hikâye 9; 3 vaka |
| 8 | 40 | 5.717 (2.096 / 322 / 2.030 / 175 / 1.094) | 58 | 5.109 | 738 | Atölye 5, Depo 5, Tedavi 5 | 1,3 / 21,7 / 0,0 | Kabin 5 (1.703; 0,30) | 15 | Kamp Sv 15; 3 vaka |
| 9 | 40 | 5.609 (2.079 / 271 / 2.400 / 215 / 644) | 59 | 5.544 | 803 | Kabin 5, Kütüphane 1, Kütüphane 2, Kütüphane 3, Kütüphane 4, Tarama 5 | 1,1 / 19,1 / 2,8 | Park 5 (1.703; 0,30) | 16 | Kamp Sv 16: Araştırma Yerleşkesi; 3 vaka |
| 10 | 40 | 5.862 (1.974 / 269 / 2.400 / 175 / 1.044) | 113 | 5.109 | 1.556 | Park 5, Denge 5, Kütüphane 5 | 1,1 / 21,9 / 0,0 | Merkez 6 (3.371; 0,59) | 16 | 3 vaka |
| 11 | 40 | 6.010 (2.183 / 294 / 2.400 / 160 / 974) | 57 | 5.779 | 1.787 | Merkez 6, Klinik 6 | 0,7 / 19,6 / 2,7 | Odyometri 6 (2.408; 0,41) | 17 | Kamp Sv 17; 2 vaka |
| 12 | 40 | 5.517 (2.206 / 158 / 2.400 / 110 / 644) | 42 | 7.224 | 81 | Odyometri 6, Atölye 6, Depo 6 | 2,2 / 20,8 / 0,0 | Kule 6 (2.408; 0,42) | 17 | – |
| 13 | 40 | 6.093 (2.025 / 134 / 2.880 / 110 / 944) | 75 | 4.816 | 1.358 | Kule 6, Tedavi 6 | 1,4 / 21,6 / 0,0 | Kabin 6 (2.408; 0,41) | 18 | Kamp Sv 18 |
| 14 | 40 | 6.808 (2.182 / 392 / 2.880 / 110 / 1.244) | 53 | 7.224 | 942 | Kabin 6, Tarama 6, Park 6 | 2,0 / 21,0 / 0,0 | Denge 6 (2.408; 0,39) | 18 | – |

### Uygulanan değişiklikler (14 gün; eski kural → bugünkü kod)

_Aynı ölçüm ve model; "eski" sütunu eski kuralı simülasyon kancasıyla yeniden kurar. Yerel talep: sınır olmasa o gün istenecek en yüksek yerel ödül jetonu._

| Değişiklik | Profil | Gelir (jeton) | Başlatılan inşaat | 14. gün cüzdan | Taşkın günü | Kamp Sv | Hikâye | Kristal geliri | Kırpılan yerel jeton (ilk 3 gün) | Kırpılan yerel jeton (14 gün) | En yoğun gün yerel talep | Yeni hasta gelen gün | Boş klinik günü (vaka bitmeden) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 1 oturum, takımsız | 13.713 | 23 | 1.881 | 13 | 13 | 8 | 94 | 0 | 0 | 587 | 10/12 → 10/12 | 2 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 3 oturum, takımsız | 37.463 → **38.328** | 50 | 1.007 → **1.871** | 3 → **0** | 16 | 9 | 122 | 656 → **0** | 656 → **0** | 1.107 | 11/14 → 11/14 | 1 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 6 oturum, takımsız | 59.137 → **60.530** | 62 | 1.263 → **2.206** | 0 | 17 | 9 | 134 | 1.003 → **0** | 1.003 → **0** | 1.270 | 11/14 → 11/14 | 0 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 1 oturum, takımlı | 18.988 | 22 | 2.343 | 12 | 13 | 9 | 584 | 0 | 0 | 587 | 11/12 → 11/12 | 1 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 3 oturum, takımlı | 48.049 → **49.262** | 56 → **58** | 1.354 → **828** | 2 → **3** | 16 → **17** | 9 | 754 | 656 → **0** | 656 → **0** | 1.007 | 11/14 → 11/14 | 1 |
| Ö1 Yerel ödül sınırı 600 → 1.500 jeton/gün | 6 oturum, takımlı | 74.824 → **76.121** | 68 → **69** | 2.052 → **942** | 0 → **1** | 18 | 9 | 914 | 1.003 → **0** | 1.003 → **0** | 1.270 | 11/14 → 11/14 | 0 |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 1 oturum, takımsız | 13.540 → **13.713** | 24 → **23** | 3.607 → **1.881** | 13 | 11 → **13** | 5 → **8** | 39 → **94** | 0 | 0 | 587 | 4/12 → **10/12** | 8 → **2** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 3 oturum, takımsız | 37.275 → **38.328** | 48 → **50** | 1.198 → **1.871** | 0 | 15 → **16** | 9 | 89 → **122** | 0 | 0 | 1.107 | 8/14 → **11/14** | 6 → **1** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 6 oturum, takımsız | 60.326 → **60.530** | 62 | 2.002 → **2.206** | 0 | 16 → **17** | 9 | 101 → **134** | 0 | 0 | 1.270 | 8/14 → **11/14** | 6 → **0** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 1 oturum, takımlı | 18.793 → **18.988** | 22 | 2.148 → **2.343** | 12 | 13 | 9 | 563 → **584** | 0 | 0 | 587 | 8/12 → **11/12** | 4 → **1** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 3 oturum, takımlı | 49.287 → **49.262** | 54 → **58** | 1.323 → **828** | 3 | 15 → **17** | 9 | 713 → **754** | 0 | 0 | 1.007 | 8/14 → **11/14** | 6 → **1** |
| Ö4 Vaka kademeleri Klinik Sv 1/4/7 → 1/2/3 | 6 oturum, takımlı | 75.716 → **76.121** | 69 | 537 → **942** | 1 | 17 → **18** | 9 | 881 → **914** | 0 | 0 | 1.270 | 8/14 → **11/14** | 6 → **0** |
| Ö1 + Ö4 ikisi birlikte | 1 oturum, takımsız | 13.540 → **13.713** | 24 → **23** | 3.607 → **1.881** | 13 | 11 → **13** | 5 → **8** | 39 → **94** | 0 | 0 | 587 | 4/12 → **10/12** | 8 → **2** |
| Ö1 + Ö4 ikisi birlikte | 3 oturum, takımsız | 37.226 → **38.328** | 48 → **50** | 1.148 → **1.871** | 2 → **0** | 15 → **16** | 9 | 89 → **122** | 656 → **0** | 656 → **0** | 1.107 | 8/14 → **11/14** | 6 → **1** |
| Ö1 + Ö4 ikisi birlikte | 6 oturum, takımsız | 58.868 → **60.530** | 62 | 994 → **2.206** | 0 | 16 → **17** | 9 | 101 → **134** | 1.003 → **0** | 1.003 → **0** | 1.270 | 8/14 → **11/14** | 6 → **0** |
| Ö1 + Ö4 ikisi birlikte | 1 oturum, takımlı | 18.793 → **18.988** | 22 | 2.148 → **2.343** | 12 | 13 | 9 | 563 → **584** | 0 | 0 | 587 | 8/12 → **11/12** | 4 → **1** |
| Ö1 + Ö4 ikisi birlikte | 3 oturum, takımlı | 48.034 → **49.262** | 54 → **58** | 1.739 → **828** | 2 → **3** | 15 → **17** | 9 | 713 → **754** | 656 → **0** | 656 → **0** | 1.007 | 8/14 → **11/14** | 6 → **1** |
| Ö1 + Ö4 ikisi birlikte | 6 oturum, takımlı | 74.609 → **76.121** | 68 → **69** | 1.837 → **942** | 0 → **1** | 17 → **18** | 9 | 881 → **914** | 1.003 → **0** | 1.003 → **0** | 1.270 | 8/14 → **11/14** | 6 → **0** |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 1 oturum, takımsız | 13.780 → **13.713** | 24 → **23** | 3.847 → **1.881** | 13 | 11 → **13** | 5 → **8** | 49 → **94** | 0 | 0 | 587 | 8/12 → **10/12** | 4 → **2** |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 3 oturum, takımsız | 38.952 → **38.328** | 49 → **50** | 1.171 → **1.871** | 2 → **0** | 15 → **16** | 5 → **9** | 88 → **122** | 0 | 0 | 1.107 | 11/14 → 11/14 | 1 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 6 oturum, takımsız | 61.369 → **60.530** | 63 → **62** | 638 → **2.206** | 0 | 16 → **17** | 5 → **9** | 100 → **134** | 0 | 0 | 1.270 | 11/14 → 11/14 | 0 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 1 oturum, takımlı | 18.988 | 22 | 2.343 | 12 | 13 | 9 | 584 | 0 | 0 | 587 | 11/12 → 11/12 | 1 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 3 oturum, takımlı | 49.262 | 58 | 828 | 3 | 17 | 9 | 754 | 0 | 0 | 1.007 | 11/14 → 11/14 | 1 |
| Ö2 Hikâye 6–7: takıma bağlı adımlara takımsız "ya da" adımı | 6 oturum, takımlı | 76.121 | 69 | 942 | 1 | 18 | 9 | 914 | 0 | 0 | 1.270 | 11/14 → 11/14 | 0 |

### Öneri denemeleri (14 gün; temel → öneriyle)

| Öneri | Profil | Gelir (jeton) | Başlatılan inşaat | 14. gün cüzdan | Taşkın günü | Kamp Sv | Hikâye | Kristal geliri | Kırpılan yerel jeton | Yeni hasta gelen gün | Boş klinik günü (vaka bitmeden) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ö3 Bir inşaat sıraya alınabilsin (parası peşin) | 1 oturum, takımsız | 13.713 → **15.494** | 23 → **33** | 1.881 → **203** | 13 → **1** | 13 | 8 → **7** | 94 → **98** | 0 | 10 → **11** | 2 → **1** |
| Ö3 Bir inşaat sıraya alınabilsin (parası peşin) | 3 oturum, takımsız | 38.328 → **40.368** | 50 → **54** | 1.871 → **556** | 0 | 16 | 9 | 122 | 0 | 11 | 1 → **0** |
| Ö3 Bir inşaat sıraya alınabilsin (parası peşin) | 6 oturum, takımsız | 60.530 → **61.606** | 62 → **64** | 2.206 → **37** | 0 | 17 | 9 | 134 | 0 | 11 | 0 |
| Ö3 Bir inşaat sıraya alınabilsin (parası peşin) | 1 oturum, takımlı | 18.988 → **22.658** | 22 → **39** | 2.343 → **233** | 12 → **0** | 13 → **14** | 9 → **8** | 584 → **586** | 0 | 11 | 1 |
| Ö3 Bir inşaat sıraya alınabilsin (parası peşin) | 3 oturum, takımlı | 49.262 → **52.383** | 58 → **60** | 828 → **145** | 3 → **0** | 17 | 9 | 754 | 0 | 11 | 1 → **0** |
| Ö3 Bir inşaat sıraya alınabilsin (parası peşin) | 6 oturum, takımlı | 76.121 → **77.739** | 69 → **70** | 942 → **1.722** | 1 → **0** | 18 | 9 | 914 | 0 | 11 | 0 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 1 oturum, takımsız | 13.713 → **15.313** | 23 | 1.881 → **3.481** | 13 | 13 | 8 | 94 | 0 | 10 | 2 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 3 oturum, takımsız | 38.328 → **40.076** | 50 → **52** | 1.871 → **1.272** | 0 → **2** | 16 | 9 | 122 | 0 | 11 | 1 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 6 oturum, takımsız | 60.530 → **60.786** | 62 → **63** | 2.206 → **505** | 0 | 17 | 9 | 134 | 0 | 11 | 0 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 1 oturum, takımlı | 18.988 → **20.020** | 22 → **23** | 2.343 → **3** | 12 → **13** | 13 → **14** | 9 | 584 | 0 | 11 | 1 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 3 oturum, takımlı | 49.262 → **51.564** | 58 | 828 → **1.463** | 3 | 17 | 9 | 754 | 0 | 11 | 1 |
| Ö5 (denendi, önerilmez) Depo dolma süresi 8 → 12 sa | 6 oturum, takımlı | 76.121 → **76.339** | 69 | 942 → **1.610** | 1 | 18 | 9 | 914 | 0 | 11 | 0 |
| Ö4b (denendi) Vaka kademeleri Klinik Sv 1/1/2 | 1 oturum, takımsız | 13.713 → **13.793** | 23 | 1.881 → **1.961** | 13 | 13 | 8 | 94 → **106** | 0 | 10 → **11** | 2 → **1** |
| Ö4b (denendi) Vaka kademeleri Klinik Sv 1/1/2 | 1 oturum, takımlı | 18.988 → **19.008** | 22 | 2.343 → **2.363** | 12 | 13 → **14** | 9 | 584 → **596** | 0 | 11 | 1 |

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

## 6. Öneriler (ilk ölçüm; Ö1, Ö2 ve Ö4 uygulandı, §7. Ö3, Ö5 sahibin kararında; sayısal etki §3 "Öneri denemeleri" tablosunda)

Öneriler yalnız simülasyon kancalarıyla denendi (`simule(P, H)`); oyun kodu değişmedi.

**Ö1 · (uygulandı: 1.500, §7) Yerel ödül sınırını dürüst oyunun üstüne çıkarın: 600 → 1000 jeton/gün** (ya da ilk 3 günü sınırsız tutun).
- Etki: 3 oturumda kırpılan jeton 616 → 67, 6 oturumda 963 → 270; takımlı 3 oturumda 616 → 0.
- Toplam gelir %1-3 artar; taşkın günü 3 oturum takımsızda 4 → 1.
- Sınır hâlâ sahte istemciye karşı koruyor (1000 jeton ≈ yarım günlük oyun).

**Ö2 · (uygulandı, §7) Takımsız oyuncuya hikâye 6-7 için tek kişilik eşdeğer adım** (ör. "takıma katıl" yerine "3 vaka çöz" ya da "Kamp Sv 4").
Takım yolu açık kalır; bu yalnız zorunlu sosyalleşmeyi kaldırır.
- Etki: takımsız profillerde hikâye 5/10 → 8-9/10, kristal +34 (39 → 73, 55 → 89, 67 → 101), Kamp Sv +1.

**Ö3 · Bir inşaatı sıraya alma** (parası peşin, süren bitince kendiliğinden başlar; yeni para birimi ya da satın alma yok).
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

## 7. Uygulandı: Ö1, Ö4, Ö2

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
