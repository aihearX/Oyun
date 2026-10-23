# 17 · Kamp Görevleri ve kamp etkinlikleri: Hasta Vakaları, Kampın Hikâyesi, günlük/haftalık görevler, kamp oyunları, Konsültasyon

Amaç: oyuncu kampta daha çok ve anlamlı vakit geçirsin. Kamp; bina kurulan bir yer olmaktan çıkıp her gün uğranan bir
**odyoloji kliniğine** dönüşür: hastalar gelir, testler istenir, karar verilir, takım danışır, Tüy Dede kampın hikâyesini anlatır.
İlke: dürüst ama bağımlılık yaratan tasarım — sahte aciliyet, sahte sayaç, sahte oyuncu yok; ödüller önceden görünür, sunucuda bir
kez verilir; bölüm zorluk eğrisini bozmaz (jeton az, Kamp XP / süs / bilgi ağırlıklı). Vakalar kurgusaldır, tıbbi öneri değildir.

Kod: `packages/content/src/kamp-gorev.ts` (görev tanımları, kurallar, ödüller, oyun turları), `kamp-gorev-vaka.ts` (vaka modeli,
test kataloğu, tanı kataloğu, odyogram/timpanogram sınıflaması, puanlama, **tıbbi tutarlılık denetimi**), `kamp-gorev-vakalar.ts`
(32 vaka); `apps/server/src/camp-quests.ts` (sayaçlar, durum, ödül alma, kancalar), `camp-quests-vaka.ts`, `camp-quests-oyun.ts`,
`camp-quests-adapter.ts` (kamp büyümesi: Kamp XP, süs), `camp-quests-schema.ts`, `camp-quests-schemas.ts`; `apps/web/src/camp/gorev/**`.
Protokol: `packages/shared/src/social.ts` → "KAMP GÖREVLERİ" bölümü (yalnız ekleme).

## 1. Açılış (Tüy Dede ile adım adım)

| özellik | açıldığı yer | tur |
|---|---|---|
| Kamp Görevleri (Hikâye, Günlük, Başarı) | 4 bölüm geçilince (`KG_ACILIS.gorev`) | `gorev`: açılış kartı + "Görevler" düğmesi |
| Kamp oyunları (Ton Avı, Timpanogram Eşleştir) | 6 bölüm (`KG_ACILIS.oyun`) + ilgili bina kurulu | `kampoyun` |
| Hasta Vakaları (Odyoloji Kliniği) | 7 bölüm (`KG_ACILIS.vaka`) + Odyoloji Kliniği kurulu | `vaka` |

Turlar yalnız kamptayken başlar (başka akışı bölmez; `ftue/Director.tsx`). Sunucu da aynı eşikleri uygular (geçilen bölüm =
`highest − 1`; yönetici modunda hepsi açık). Kilitli şeyler dürüstçe yazılır ("Bölüm 7’de açılır", "Odyoloji Kliniği’ni kur").

## 2. Hasta Vakaları (amiral gemisi)

Akış: **bekleme salonu → hasta (öykü, belirtiler) → testler → karar (tanı + yönetim) → sonuç** (yıldızlar, açıklama, Kulak Sözlüğü
terimi, kaynak). Test kataloğu: otoskopi, saf ses odyometrisi (gerçek odyogram: sağ hava yolu **kırmızı O**, sol hava yolu **mavi
X**, kemik yolu sağ **<** sol **>**, yanıt yoksa aşağı ok; ASHA 1990), timpanometri (Jerger tipleri A/As/Ad/B/C; normal bölge
gölgeli; kanal hacmi), akustik refleks, OAE, ABR, konuşma odyometrisi (SRT, ayırt etme), işitsel işlemleme testleri.

- **Bilgi düzeyi** (Ayarlar): *genel* → sade sonuç metni ("iç kulak kaynaklı hafif kayıp"), 3 tanı + 3 yönetim seçeneği, odyogramda
  normal bölge; *odyoloji öğrencisi* → sayılar (SSO, hava–kemik aralığı, daPa, ml), teknik tanı adları, 4 + 4 seçenek.
- **Kademe**: Odyoloji Kliniği Sv 1 → 1. kademe (10 vaka), Sv 4 → 2. kademe (12), Sv 7 → 3. kademe (10). Kliniği büyütmek yeni vaka getirir.
- **Puan**: doğru tanı 1★ (vaka çözülür), doğru yönetim +1★, **verimli test** (anahtar testlerin hepsi istendi ve toplam ≤ anahtar + 1)
  +1★. Yanlış tanıda 0★, hasta salonda kalır; açıklama yine gösterilir (öğrenmek için). Sunucu puanlar (`vakaPuanla`); aynı deneme
  kimliği ikinci kez sayılmaz (ağ tekrarı aynı sonucu döndürür).
- **Dürüst takvim**: her İstanbul günü ilk girişte en çok **3 yeni hasta** gelir; bekleme salonu **6** kişi; hastalar bekler (süre
  baskısı yok). Salon doluysa o gün gelmez. Ekranda "Yeni hastalar yarın gelir" ya da "yeni vakalar Klinik Sv 4 ile" yazar.
- **Vaka Defteri**: 32 yuva, tamamlanma %, yıldız toplamı, görülen patoloji sayısı (18'den). Çözülen vaka yeniden oynanır; yalnız
  **yeni kazanılan yıldız** ödüllenir.
- **Ödül** (`KG_ODUL`): ilk çözüm 10 jeton + 15 Kamp XP + yıldız başına 5 jeton / 5 XP; ilk çözümde 2★+ ile vakanın patolojisine
  uygun en basit Tedavi Odası malzemesinden 1 (çanta sınırı 9). Başarılar ve hikâye bölümleri süs verir (kamp büyümesi kataloğu).

### Vaka listesi (32; kaynak her vakada `kaynak` alanında, uzman incelemesi için `docs/odyoloji-icerik.md` › "Hasta Vakaları")

| kademe | vakalar |
|---|---|
| 1 | normal işitme (konser sonrası), serumen, çocukta OME, Östaki (uçak), mesleki gürültü (4 kHz çentiği), presbiakuzi, otitis eksterna, yenidoğan taraması (geçti), tinnitus (normal işitme), travmatik perforasyon |
| 2 | otoskleroz (Carhart çentiği, As, refleks yok), timpanoskleroz, retraksiyon cebi, eksostoz, Meniere, ototoksisite izlemi (sisplatin), müzisyende gürültü, 3 aydır süren OME (tüp), taramada kalan bebek (tanısal ABR), ani işitme kaybı (acil), kronik perforasyonda mikst kayıp, işitme cihazı kullanıcısında serumen |
| 3 | asimetrik SNİK + orantısız düşük ayırt etme (retrokoklear → MR), yoğun bakım bebeğinde işitsel nöropati (OAE var, ABR yok, CM), çocukta işitsel işlemleme bozukluğu, travma sonrası kemikçik zinciri kopukluğu (Ad), ototoksisite sonrası implant adaylığı, ileri otoskleroz (mikst), pulsatil tinnitus (hekim), yetişkinde tek taraflı OME (nazofarenks), akustik travma (havai fişek), ergende işitsel nöropati |

Kapsam: 18 patolojinin hepsi (+ normal, tarama, ani kayıp); iletim, sensörinöral ve mikst; bebek, çocuk, genç, yetişkin, yaşlı.

### Tıbbi tutarlılık (birim testi)

`vakaTutarsizliklari(v)` her vaka için: odyogram sınıfı = bildirilen kayıp tipi (hava–kemik aralığı ≥15 dB en az iki frekansta;
kemik yolu >25 dB HL; kemik yolu hava yolundan en çok 10 dB kötü; kemik yolu cihaz sınırı); timpanogram değerleri tipine uygun
(Jerger: A −100…+50 daPa, 0,3–1,7 ml; As <0,3; Ad >1,7; B düz; C <−100 daPa; yaşa göre kanal hacmi); otoskopi ↔ timpanogram ↔ hacim
(kir → B küçük hacim, delik → B büyük hacim, efüzyon → B normal hacim); OAE ↔ orta kulak ve eşik; refleks ↔ iletim kaybı ve ileri
koklear kayıp; ABR (gecikme yalnız retrokoklear, yalnız CM nöropatide); SRT ↔ saf ses ortalaması ±10 dB; kategoriye özgü örüntüler
(gürültü çentiği 3–6 kHz ve 8 kHz'te iyileşme, presbiakuzi simetrik inen, Meniere tek taraflı alçak frekans, ani kayıp ≥30 dB üç
frekans, otoskleroz Carhart, zincir kopukluğu Ad + büyük aralık, nöropati OAE var/ABR yok…). Yanıltıcı seçenekler doğru kategoriyle
çakışamaz. Bozulmuş vakaların yakalandığı da sınanır.

## 3. Konsültasyon (takım)

Bekleme salonundaki bir hasta için "Takımına danış" (günde 3; takımda başka üye yoksa açılmaz — dürüstçe yazılır). Takım sohbetine
**Konsültasyon kartı** düşer: hasta ve öykü + 3 hazır tanı seçeneği. Takım arkadaşları **yalnız hazır seçenekle** oy verir (serbest
yazı yok; kartın konusunda güvenli sohbet kuralı: 8. bölüme kadar yalnız hazır sözler). Görüş bildirene 5 jeton + 3 Kamp XP (günde 5
ödüllü oy); soran vakayı çözünce kart kapanır, doğru tanı işaretlenir ve en az bir görüş geldiyse sorana bir kez 5 jeton + 3 XP.

**Takım kliniği**: takımca bu hafta ilk kez çözülen vaka sayısı (hedef 12) → katkı veren her üyeye 3 kristal + 40 Kamp XP (bir kez).
**Yönetici hesapları** (`codes.ts`) sayılmaz ve bu ödülü alamaz (test: `kamp-gorev.test.ts`).

## 4. Kamp Görevleri paneli ("Görevler" düğmesi, rozet = alınmayı bekleyen ödül)

- **Hikâye — Kampın Hikâyesi** (Tüy Dede, 10 bölüm × 3 adım; her bölümün giriş ve bitiş satırı seslendirilmiş):
  1 Kampa Hoş Geldin (Depo kur, depodan topla, Merkez Sv 2) · 2 Klinik Açılıyor (Klinik, Odyometri, Kule) · 3 Ölçmeyi Öğren (Ton Avı,
  Timpanogram Eşleştir, binalar toplamı 12) · 4 İlk Hastalar (ilk vaka, 3 vaka, 6 yıldız) · 5 Koruma Sanatı (Tedavi Odası, 3 malzeme,
  bölümde malzeme kullan) · 6 Takım Ruhu (takıma katıl, 3 yardım, konsültasyon) · 7 Kampını Güzelleştir (süs yerleştir, kamp ziyareti,
  Kamp Seviyesi 3) · 8 Uzman Klinik (Klinik Sv 4, 12 vaka, 5 kez 3★) · 9 Kulağın Derinlikleri (Koklea bölgesi, Kule Sv 5, 10 patoloji)
  · 10 Büyük Kamp (Merkez Sv 8, Klinik Sv 7, 25 vaka). Adımlar gerçek kamp eylemleri ve anlık durumla dolar; bölüm ödülü bir kez.
- **Günlük**: her gün 3 görev (havuzdan oyuncunun açık binalarına göre sabit tohumla; gün içinde değişmez), **bir kez değiştirme**;
  görev başına 15 jeton + 15 Kamp XP. **Haftalık kamp hedefi** (günlük görev / vaka / oyun / malzeme; 3 basamak: jeton+XP, kristal+XP,
  kristal+XP+hızlandırıcı).
- **Etkinlik**: Klinik, Ton Avı, Timpanogram Eşleştir (bugünkü ödüllü tur sayısı), takım kliniği.
- **Başarı**: 12 başarı, 3–4 basamak (Vaka Defteri, yıldız, patoloji, Ton Avı, eğri, malzeme, yardım, konsültasyon, depo, mimar,
  hikâye, her gün kampta); bazı basamaklar süs verir.

Sunucu yetkili: kamp işleyicileri (`camp.collect`, `camp.remedy.*`, `camp.upgrade`, `team.camp.help*`, `progress.submit`, kamp
büyümesinin `camp.decor.place` ve `camp.visit`) sarılır (`withKgHooks`) ve sayaçlar (`kg_count`: toplam/gün/hafta) artar; olay
anahtarlıysa (koşu kimliği, oyun turu, vaka denemesi) bir kez sayılır (`kg_seen`). Ödüller `kg_claim (player_id, ref)` birincil
anahtarıyla **tam bir kez**; ikinci istek `TEKRAR`. İstemcide düğme istek sürerken kilitli; kutlama yalnız başarılı yanıtta, bir kez
(e2e: iki hızlı dokunuş → bir ödül, bir kutlama). Sunucu her değişiklikten sonra `kg.updated` iter.

## 5. Kamp oyunları (günde 5 ödüllü tur, sonrası eğlence)

- **Ton Avı** (Odyometri Odası): 8 deneme — "Ses var mı?" (rahat düzeyde bir ton çalar ya da çalmaz) ve "Hangisi daha ince?" (genel
  düzeyde büyük, odyoloji düzeyinde küçük perde farkı). **Bir işitme testi değildir** (ekranda, oyun girişinde ve Tüy Dede'nin
  sözünde). Ses kapalıysa / isteyene **görsel ipucu** (nabız halkası, perde yüksekliği).
- **Timpanogram Eşleştir** (Timpanometri Kulesi): 5 eğri, 4 seçenek; genel düzeyde A / B-normal / C / B-büyük, odyoloji düzeyinde 7 tür
  (As, Ad, B-küçük dahil) ve sayısal değerler. Her cevaptan sonra kısa açıklama.
- Tur tohumu sunucuda üretilir, cevaplar sunucuda puanlanır; tur en az 9,6 / 7,5 sn sürer; ödül tur başına 4 jeton + 5 Kamp XP.

## 6. Ödül ekonomisi ve sınırlar

Günlük jeton tavanı yaklaşık: 3 görev × 15 + 3 yeni vaka × 25 + 2 oyun × 5 tur × 4 = **160** (test: ≤200). Kamp XP ve süsler kamp
büyümesi sistemine gider (`grantCampXp` / `grantDecoration`, ref ile bir kez; `camp-quests-adapter.ts`; sistem yoksa `kg_pending`
tablosunda bekler ve gelince bir kez uygulanır). Kristal yalnız hikâye, haftalık, başarı ve takım kliniğinde. Malzemeler çanta
sınırına tabidir. Bölüm gücü veren hiçbir ödül yok.

## 7. Arayüz

Kamp üst göstergesinin altında "Görevler" (rozet) ve "Klinik" (bekleyen hasta) düğmeleri; liste görünümünde de aynı düğmeler.
Bina panellerinde: Odyoloji Kliniği → "Hasta Vakaları", Odyometri Odası → "Ton Avı oyna", Kule → "Timpanogram Eşleştir". Paneller
bina paneliyle aynı koyu cam alt sayfa (`.bp`); resimli ikonlar (`camp/gorev/art.tsx`), kurgusal hasta çizimleri, emoji yok.
Takım sohbetinde Konsültasyon kartı (`camp/gorev/KonsultCard.tsx`). Test kancası: `window.__kg` (durum, panel, sayaç, kutlama sayısı).

## 8. Doğrulama

- Birim: `packages/content/src/kamp-gorev.test.ts` (≥30 vaka, kapsam, **tıbbi tutarlılık**, denetleyicinin bozuk vakayı yakalaması,
  Türkçe metin, seçenekler, puanlama, odyogram sınıflaması, görev/ödül tanımları, günlük jeton tavanı, oyun turları ve Jerger
  değerleri), `apps/server/test/kamp-gorev.test.ts` (kilit, hikâye ödülü bir kez, günlük görev/değiştirme, idempotent sayaçlar,
  haftalık/başarı basamakları, vaka takvimi ve kademe, malzeme ödülü, konsültasyon, **yönetici hariç** takım kliniği, oyunların
  sunucu puanı/hız/günlük sınırı, kamp büyümesi bağlantısı), `apps/web/src/ftue/kamp-gorev-lines.test.ts` (Tüy Dede satırları ve turlar).
- Uçtan uca: `node tools/harness/vaka-e2e.mjs` (Chromium + WebKit: takım, depo toplama → hikâye ödülü iki dokunuşta bir kez + bir
  kutlama, günlük görev + değiştirme, vaka çözümü (odyogram sembolleri) → 3★ + Vaka Defteri, konsültasyon (B hazır seçenekle oy verir,
  A görür), Ton Avı ve Timpanogram Eşleştir turları; dom: Görevler, Klinik, vaka) ve
  `node tools/harness/ui-mobile-check.mjs --only takim,gorev` (390×844 ve 320×640, web ve dom).
