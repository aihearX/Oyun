# 13 · İletişim: oyuncuları birbirine bağlamak

Sahibin isteği: "Oyunu, insanların birbiriyle iletişimini artıracak şekilde kur." Kurucu ilke aynen geçerli: **dürüst tasarım** —
sahte kullanıcı yok, sahte mesaj yok, sahte baskı (uydurma "3 kişi seni bekliyor", sahte geri sayım) yok. Güçlü ve meşru sosyal
motivasyon serbest: gerçek başarıları görünür kılmak, yardım etmeyi kolay ve ödüllü yapmak, birlikte öğrenmek.

Kitle: çoğunluğu **odyoloji öğrencileri** (birbirini tanıyan sınıf/ders grupları), ayrıca genel oyuncular ve çocuklar.

## 1. Hedefler

| # | Hedef | Neden | Nasıl ölçülür (bkz. §6) |
|---|---|---|---|
| H1 | Sohbet başlatmanın eşiğini düşürmek | Boş sohbet kutusu korkutur; "ne yazayım?" | ilk mesaja kadar geçen süre, hazır söz kullanımı |
| H2 | Gerçek olayları konuşulacak şeye çevirmek | "Ayşe boss'u yendi" → tepki, tebrik | akış kartı başına tepki/yanıt |
| H3 | Takılan oyuncunun yalnız kalmaması | Yardım iste → ipucu/kalkan/yarış → teşekkür döngüsü | çözülen yardım isteği oranı |
| H4 | Deneyimlinin yeniyi kanatlandırması | Usta–Çırak: yeni oyuncu kopmasın | çırak başına ulaşılan dönüm noktası |
| H5 | Öğrencilerin birlikte çalışması | Günün Sorusu + tartışma, Çalışma Grubu | günlük cevaplayan oranı, tartışma yanıtları |
| H6 | İki kişilik bağlar | İkili Görev: haftalık ortak hedef | tamamlanan ikili görev |
| H7 | Güvenlik | Yeni oyuncuya hazır sözler, küfür filtresi, şikâyet/engel her yüzeyde | şikâyet oranı, susturma sayısı |

## 2. Özellikler (bu sürümde)

Açılış düzeyi = art arda geçilen bölüm sayısı (FTUE, `apps/web/src/ftue/features.ts`). Her biri Tüy Dede'nin 1–3 satırlık turuyla duyurulur.

| Özellik | Açılış | Kısaca |
|---|---|---|
| **Takım Akışı** + tepkiler + "Tebrik et" | 6 | Gerçek olaylar takım sohbetine kart olarak düşer; tek dokunuşla tepki, hazır tebrik; yanıtlar kartın altında konu (thread) olur |
| **Hızlı Sohbet** (hazır sözler) | sohbetle birlikte (4/5) | Türkçe hazır sözler: takım, özel mesaj, yarış lobisi ve yarış sonucu; yeni oyuncu için güvenli varsayılan |
| **Yardım İste** (genişletilmiş) | takımla (5) | 3 başarısız denemede "Takımdan yardım iste" → kart; ipucu, gerçek kalkan ya da birlikte yarış; geçince ikisine de ödül + teşekkür |
| **Takıma meydan oku** | yarışla (8) | Sonuç ekranından takım sohbetine sunucu doğrulamalı skor kartı; geçen olursa kartın altına otomatik yazılır |
| **Günün Sorusu** / Çalışma Grubu | 9 | Tüy Dede her gün takıma bir kulak sorusu bırakır; 20:00'de cevap + açıklama; haftalık takım tablosu; Çalışma Grubu = öğrenci düzeyi sorular |
| **İkili Görev** | 10 | Bir arkadaşla haftalık ortak nota hedefi; ikisi de katkı verir, ortak sandık |
| **Usta–Çırak** | 11 (usta olmak için 10 bölüm geçmiş olmak) | Usta, yeni bir arkadaşına/takım arkadaşına çırak teklif eder; çırak ilerledikçe ikisi de ödül alır, ustaya "tebrik et" dürtmesi |
| **@bahsetme** + "Kim çevrimiçi" | takımla (5) | `@İsim` bildirim ve rozet; takım sohbetinin üstünde çevrimiçi üyeler |

Sonraki aşama (bu sürümde yok): bölüm içinde arkadaşların bıraktığı "hayalet notlar" (ör. "burada basılı tut!"), sesli mesaj, takım
etkinlik takvimi, ders grubu (sınıf) davet bağlantısı.

## 3. Akışlar

### 3.1 Takım Akışı
- Sunucu, **yalnızca gerçek olaylardan** kart üretir (sohbet türü `feed`, gönderen `sistem`, `meta.type`):
  `bolum` (ilk kez geçilen bölüm ya da ilk 3★), `boss` (boss ilk kez yenildi), `koklea` (bölümde altın koklea bulundu — istemci
  sonuçla bildirir, bölüm başına en çok 3), `bina` (kamp binası seviye atladı, sunucunun inşaat tamamlama anı), `uye` (yeni üye),
  `seri` (sunucunun saydığı ardışık oyun günü: 3, 7, 14, 30, 60, 100), `yardim` (yardımla geçti), `meydan` (meydan okuma).
- **Spam önleme (toplama):** aynı oyuncunun aynı türdeki kartı 30 dk içinde yeniden gelirse yeni kart açılmaz; mevcut kart
  güncellenir ("Ayşe 3 bölüm geçti: 4, 5, 6 · 8★") ve `chat.updated` yayınlanır. Takım başına saatte en çok 20 yeni kart; aşılırsa
  yalnızca mevcut kartlar güncellenir. Oyuncu Profil › Birlikte › Sohbet ayarları'ndan "Başarılarım akışta görünsün" seçeneğini
  kapatabilir (`comm.settings { feedShare }`): kapalıyken onun hakkında kart üretilmez (yeni üye kartı hariç).
- **Tepkiler:** `chat.react { msgId, reaction }` — sabit 5 tepki (`alkis`, `kalp`, `ates`, `yildiz`, `guc`; arayüzde resimli
  ikon), mesaj başına kişi başı bir tepki, aynısı geri alır. Takım, yarış ve genel sohbette her mesajda. Kendi kartına tepki
  verilebilir (sevinç), ama kendi kartına "Tebrik et" düğmesi görünmez.
- **Tebrik et / yanıt:** `chat.send { room, text, kind, replyTo }` — yanıt kartın altında konu olarak görünür (son 2 + "N yanıt");
  `chat.thread { msgId }` tüm yanıtları getirir (en çok 50). Yanıtlar sohbet akışına ayrıca düşmez.

### 3.2 Hızlı Sohbet (hazır sözler)
- `QUICK_PHRASES` (shared): her söz `{ id, text, ctx }`; `ctx`: `genel`, `tebrik`, `yaris`, `ipucu`, `tesekkur`. Gönderim
  `kind: 'hazir'`, `text` = söz kimliği; sunucu kimliği doğrular, metni kendisi yazar (`meta.p` = kimlik). DM'de `dm.send kind 'hazir'`.
- Yerler: takım sohbeti (söz şeridi), özel mesaj (söz şeridi), yarış lobisi ve yarış sonucu (yarış odası sohbeti), akış kartı
  ("Tebrik et"), yardım kartı (ipucu sözleri), usta dürtmesi.
- **Güvenli varsayılan:** 10. bölüme ulaşmamış (en yüksek açık bölüm < 10) oyuncu serbest yazı gönderemez; hazır sözler, emoji
  ve çıkartma her zaman açık. Oyuncu istediği an `comm.settings { freeText: true }` ile serbest yazıyı açar (sohbet altındaki
  "Serbest yazıyı aç" ya da giriş kutusuna dokun → kuralları özetleyen onay sayfası; Birlikte › Sohbet ayarları'ndan kapatılabilir).
  Sunucu tarafında zorunludur (`SERBEST_KAPALI`). Test/geliştirme atlaması (`ftue.bypass`) serbest yazıyı da açar.

### 3.3 Yardım İste
1. Sonuç ekranı: aynı bölümde art arda 3 başarısızlık (ya da `failStreak ≥ 3`) ve takımdaysa → "Takımdan yardım iste" kartı.
   (Takım sekmesindeki Yardım > Bölüm yardımı da aynı işlem.) Günde 3 istek (mevcut kural).
2. Takım sohbetine **yardım kartı** düşer (`kind: 'help'`, `meta.requestId/level`). Kartta üç gerçek eylem:
   - **İpucu ver** — `help.tip { requestId, phrase | text }`: ipucu sözü ya da (serbest yazı açıksa) kısa metin; kartın altına yanıt
     olarak yazılır. Kişi başı istek başına 1 ipucu.
   - **Kalkan gönder** — mevcut `team.help.give` (isteyenin ödül kutusuna gerçek kalkan, yardım edene 5 jeton).
   - **Birlikte yarış** — `help.race { requestId }`: yardım eden o bölümde canlı yarış odası kurar ve isteyene davet gider
     (arkadaş olmasalar da açık yardım isteği bu daveti meşru kılar). Yardım edenin o bölümü açmış olması, isteyenin çevrimiçi olması gerekir.
3. İsteyen o bölümü 24 saat içinde **geçerse** (sunucu `progress.submit` ile görür): istek çözülür (bir kez):
   isteyene 15 jeton ("Takımınla geçtin"), her yardım edene 20 jeton (ödül kutusu) + `help.thanks` olayı ("Ayşe 7. bölümü
   geçti, yardımın için teşekkür ediyor") ve "Rica ederim" düğmesi (hazır söz `rica`, kartın konusuna yanıt). Akışa `yardim` kartı.
   Ödüller mütevazı ve sabittir; yardım eden başına istek başına bir kez.

### 3.4 Takıma meydan oku
`feed.challenge { level }`: sunucu, oyuncunun **kendi kayıtlı en iyi skorunu** (level_best) kullanır — istemcinin söylediği skor değil.
Günde 3. Kart 48 saat açık; bu sürede bir takım arkadaşı aynı bölümde daha yüksek skor yaparsa sunucu kartın konusuna yazar
("Bora 2.910 puanla geçti!") ve meydan okuyana bildirim gider. Kartta "Oyna" (bölüm açıksa).

### 3.5 Günün Sorusu
- Her İstanbul günü, takımın sohbetine Tüy Dede bir soru bırakır (`kind: 'soru'`), ilk erişimde ya da zamanlayıcıda (09:00'dan sonra).
  Soru bankası: `packages/content` QUIZ_QUESTIONS (128 soru, "Meraklı" + "Odyoloji öğrencisi" düzeyi); seçim gün + takım
  anahtarından sabit (herkese aynı, gizli olasılık yok). Çalışma Grubu modunda öğrenci düzeyinden.
- `dq.answer { choice }` (bir kez, değiştirilemez). Açıklanmadan önce yalnızca **kaç kişinin** cevapladığı görünür.
- Açıklama **20:00** (İstanbul; 20:00'den sonra açılan soru 23:59'da; `ODI_EVENTS_FAST=1` testte soru açıldıktan 45 sn sonra): doğru şık, açıklama, doğru bilenler.
  Doğru bilene 10 jeton (ödül kutusu, günde bir). Kartın konusu tartışma alanıdır.
- `dq.state`: bugünün sorusu, benim cevabım, haftalık takım tablosu (doğru sayısı).
- **Çalışma Grubu:** lider/yardımcı `team.study { on }` ile açar; takım kartında "Çalışma Grubu" rozeti, sorular öğrenci düzeyinden.

### 3.6 İkili Görev
- `duo.invite { friendId }` (yalnız arkadaş, engel yok, ikisinin de bu hafta görevi yok) → `duo.respond { duoId, accept }`.
- Hedef (ISO hafta): birlikte **300 nota** (bölüm notaları = sunucuya giden bölüm jetonu), ikinci kademe 800. Kademe dolunca ikisine de
  ödül kutusuna sabit ödül (300: 120 jeton + 10 kristal; 800: 200 jeton + 20 kristal), her kademe bir kez. Haftaya özgüdür.
- `duo.state`: bu haftaki görev, iki kişinin katkısı, kademeler; bekleyen davetler. `duo.updated` olayı.

### 3.7 Usta–Çırak
- Usta: en az 10 bölüm geçmiş (en yüksek ≥ 11). Çırak: en yüksek < 10, arkadaş ya da takım arkadaşı, başka ustası yok.
- `mentor.offer { id }` → çırağa `mentor.offered`; `mentor.respond { offerId, accept }`. Usta en çok 3 çırak. `mentor.end`.
- Dönüm noktaları (çırağın en yüksek açık bölümü): 5, 10, 15, 20 (20 = mezun, bağ kapanır). **Yalnızca bağdan sonra ulaşılanlar**
  sayılır; çırak başına her dönüm noktası bir kez (başka ustayla yeniden kazanılamaz). Çırak: 40 jeton, usta: 30 jeton + 5 kristal.
- Dönüm noktasında ustaya `mentor.milestone` ("Çırağın Cem 10. bölüme ulaştı — bir tebrik gönder") → tek dokunuş hazır söz DM.

### 3.8 @bahsetme ve çevrimiçi
- Takım sohbetinde `@İsim` (takım üyesi adı, büyük/küçük harf duyarsız). Mesaj başına en çok 3 kişi. Bahsedilen, gönderen onu
  sessize almadıysa/engellemediyse `comm.notice` (kind `mention`) alır: bildirim şeridi ("Sohbete git"), Takım sekmesi ve Sohbet alt sekmesi
  rozetine eklenir, mesaj altın çerçeveyle vurgulanır.
- Takım sohbetinin üstünde "Kim çevrimiçi": çevrimiçi üyeler (gerçek bağlantı), dokununca profil kartı. Giriş kutusunda "@" yazınca
  üye önerileri.

## 4. Moderasyon ve güvenlik
- **Küfür filtresi** (`apps/server/src/profanity.ts`, Türkçe + İngilizce, normalize edilmiş): sohbet, yanıt, ipucu metni, özel mesaj;
  isim ve takım adı reddedilir. Liste genişletildi; masum kelimeleri yakalamaması test edilir.
- **Şikâyet / engel her yeni yüzeyde:** yanıtlar ve ipuçları sıradan sohbet mesajıdır (`chat.report`; 3 farklı kişi → gizle + 10 dk
  susturma). Susturulmuş oyuncu yanıt, ipucu, hazır söz dahil yazamaz (tepki verebilir). Engel/sessize alma: o kişinin tepkisi ve
  bahsetmesi bildirim üretmez; usta/çırak ve ikili görev davetleri engelde reddedilir.
- **Hız sınırları:** sohbet 1,2 sn (yanıtlar dahil); tepki 0,25 sn aralık + dakikada 60; meydan okuma günde 3; yardım isteği günde 3;
  ipucu istek başına 1; usta teklifi günde 5; ikili davet günde 5; akış toplama 30 dk + takım başına saatte 20 kart.
- **Yeni oyuncu varsayılanı:** 10. bölüme kadar yalnız hazır sözler (opt-in ile serbest yazı) — sunucuda zorunlu.
- **Sunucu doğrulaması:** her işlem zod şemasıyla; skor/ödüller sunucunun kendi kayıtlarından; ödüller idempotent (tablo birincil anahtarları).

## 5. Protokol eklemeleri (`packages/shared/src/social.ts`, yalnızca ekleme)
- `ChatKind` += `feed`, `hazir`, `soru`; `ChatMessage` += `reactions?`, `replyTo?`, `replies?`.
- `chat.send` += `kind: 'hazir'`, `replyTo?`; yeni: `chat.react`, `chat.thread`, `comm.settings`, `comm.state`, `feed.challenge`,
  `help.tip`, `help.race`, `dq.state`, `dq.answer`, `team.study`, `duo.state`, `duo.invite`, `duo.respond`, `mentor.state`,
  `mentor.offer`, `mentor.respond`, `mentor.end`. `ProgressSubmit` += `cochleas?` (0–3).
- Olaylar: `chat.updated`, `mention`, `help.thanks`, `duo.updated`, `mentor.offered`, `mentor.updated`, `mentor.milestone`.
- `DmKind` += `hazir`.

## 6. Ölçüm (gizlilik dostu)
Sunucu kişisel veri tutmadan günlük sayaç toplar (`comm_metrics(day, key, n)`), `GET /olcum` son 7 günü verir:
`msg.text`, `msg.hazir`, `msg.reply`, `react`, `feed.card`, `feed.merge`, `help.request`, `help.tip`, `help.shield`, `help.race`,
`help.resolved`, `dq.answer`, `dq.correct`, `duo.invite`, `duo.tier`, `mentor.link`, `mentor.milestone`, `mention`, `challenge`,
`challenge.beaten`, `freetext.optin`.
Başarı ölçütleri (ilk 4 hafta): sohbete en az bir şey gönderen günlük oyuncu oranı ≥ %35; akış kartı başına ≥ 1 tepki;
yardım isteklerinin ≥ %40'ı çözülür; günün sorusunu takım üyelerinin ≥ %30'u cevaplar.

## 7. Test
- Sunucu birim testleri: `apps/server/test/comm.test.ts` (her işlem: doğrulama, idempotentlik, hız sınırı, ödüllerin bir kez verilmesi).
- Uçtan uca: `node tools/harness/comm-e2e.mjs [--browsers chromium,webkit] [--target web|dom]` — 3 gerçek tarayıcı oyuncusu: akış
  kartı + tepki + tebrik, yardım isteği → ipucu/kalkan → geçiş → teşekkür, usta–çırak bağı, günün sorusu cevap/açıklama, ikili görev
  ilerlemesi, bahsetme. Ekran görüntüleri `tools/harness/out/iletisim/`, en iyileri `best/`.
- `ui-mobile-check.mjs`: yeni ekranlar 390×844 ve 320×640'ta (taşma yok, kaydırma çalışır, giriş kutusu sekme çubuğunun üstünde).
