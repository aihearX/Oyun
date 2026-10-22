# 16 · Takım rekabeti: Canlı Takım Yarışı ve Takım Ligi

Sahibin isteği: "canlı takım yarışı" ve "takım ligi". Kurucu ilke aynen geçerli: **dürüst tasarım**. Sahte takım, sahte rakip ya da
uydurma geri sayım yok. Eşleşecek takım yoksa bunu açıkça söyleriz ve dostluk daveti ya da sonra yeniden aramayı öneririz. Tüm zamanlama
ve sonuçlar sunucudadır.

## 1. Canlı Takım Yarışı

**Akış**
1. Lider ya da yardımcı Takım › **Takım Yarışı** sekmesinde **3'e 3** ya da **5'e 5** lobi açar. Takım sohbetine bir duyuru düşer.
2. Üyeler lobiye katılıp **Hazırım** der. Lobi canlı güncellenir: hazır, bekliyor ya da çevrimdışı.
3. **Rakip ara** için en az 2 hazır ve çevrimiçi üye gerekir. Eşleşme kuralları:
   - Aynı boyutta arayan bir takımla, benzer **takım gücüyle** eşleşilir. Güç, Sıralama'daki "Takım gücü" tablosundan gelir.
   - Pencere en az 300 ya da büyük takımın gücünün %25'idir. Her 20 sn'de iki katına çıkar, 60 sn sonra herhangi bir takımla eşleşilir.
   - Arayan başka takım yoksa not bunu açıkça yazar: "Şu an arayan başka takım yok…".
   - 3 dk sonra arama kendiliğinden durur: "Şu an benzer güçte arayan takım bulunamadı…".
4. **Takıma meydan oku**: lider ya da yardımcı belirli bir takıma dostluk daveti gönderir.
   - Davet 10 dk geçerlidir; karşı takımın sohbetine düşer ve çevrimiçi üyelerine bildirilir.
   - Kabul için iki tarafta da en az 2 hazır üye gerekir.
5. Eşleşince iki takımın hazır üyeleri doğrudan geri sayımla **aynı bölümü** (aynı tuz) koşar. Bölüm, katılanların en düşük açık bölümüdür.
   - Mevcut canlı yarış altyapısı kullanılır (`race.ts`): hayaletler, 3-2-1 sayımı, sunucu zamanlaması.
   - Kendi takımın turkuaz, rakip takım pembe görünür ve hayaletlerin adında takım amblemi vardır.
   - Üstte canlı takım şeridi çıkar: iki takımın ilerlemesi ve bitirenlerin sıra puanı.
   - Sağda takım arkadaşlarına hızlı tepkiler vardır (🔥 💪 👏 🏁 😅). Rakip takım bunları görmez.
6. Bitince sonuç ekranı açılır: iki takımın skoru ve bireysel puanlar. Sonuç iki takımın akışına **kart** olarak düşer ve kartta **Rövanş** düğmesi vardır.

**Puan** (`TEAM_RACE_RULES`, bilgi sayfasında aynen gösterilir)
- Genel bitiş sırası puanı: 1. 10, 2. 8, 3. 6, 4. 5, 5. 4, 6. 3, 7. 2, 8. ve sonrası 1.
- Bitirenin her yıldızı +2. Bitiremeyen ve ayrılan 0 alır.
- Takım puanı = üyelerin toplamı × **denge çarpanı**. Az kişili takımın toplamı büyük takımın kişi sayısına ölçeklenir; ör. 3'e 2'de ×1,5.
- Yıldızlar doğrulanmış koşudan gelir (`progress.submit { raceId }`). Sonuç, son bitirenin yıldızı gelince ya da en geç 15 sn sonra **bir kez** yazılır (`tr_match.finalized`).

**Ödül ve lig puanı** (yarış lige sayılırsa)
- Kazanan takımın katılanları: 60 jeton + 3 kristal.
- Berabere: 30 jeton.
- Kaybeden takımda bitirenler: 20 jeton.
- Oyuncu başına günde 5 ödüllü yarış.
- Takım Ligi puanı: kazanma 20, beraberlik 8, kayıp 4. Takım başına günde 10 yarış sayılır.

**Hile önleme**
- Bir takımın aynı anda tek yarışı olur.
- Takım başına günde 40 arama ve 10 dostluk daveti.
- En az bir bitiren yoksa yarış lige ve ödüle sayılmaz. Aynı iki takım günde en çok 2 kez sayılır.
- Bağlantısı kopan oyuncu **20 sn** içinde dönmezse ayrılmış (bitiremedi) sayılır.
- Yarış en geç 3 dk sürer. İlk bitirenden sonra diğerleri için bekleme süresi `raceFinishGraceMs`.

## 2. Takım Ligi

- **Sezon** 2 ISO haftadır ve Pazartesi 00:00'da (İstanbul) başlar. 1. sezon 12 Ekim 2026'da başladı.
- **Kademeler**: Bronz → Gümüş → Altın → Platin → Koklea.
- **Gruplar**: kademe başına en çok 15 takım.
  - Sezon açılışında üyesi olan takımlar, kademe içinde güce göre gruplara yerleşir.
  - Sezon ortasında gelen takım, kademesinde boş yeri olan gruba girer.
- **Lig puanı** sunucu kayıtlarından hesaplanır; istemci sayı söylemez. Haftalık üst sınırlarla:

| Kaynak | Kural |
|---|---|
| Bölge Savaşı | her 100 savaş puanı 1 (haftada en çok 60) |
| Baskın | her 200 hasar 1 (haftada en çok 40) |
| Bilgi | açıklanmış Günün Sorusu doğruları 1'er (haftada en çok 30) |
| Düello | kazanma 40, beraberlik 15, kayıp 5 |
| Takım Yarışı | kazanma 20, beraberlik 8, kayıp 4 (günde en çok 10 yarış) |

- **Sezon sonu** bir kez işlenir (`tl_closed:<sezon>`):
  - Grupta en az 6 takım varsa ilk 3 yükselir, son 3 düşer. Daha küçük gruplarda üçte biri yükselir ya da düşer.
  - Puanı 0 olan yükselmez. Bronz düşmez, Koklea yükselmez.
  - Geçmiş kaydı tutulur (`tl_history`).
- **Ödül**: üye başına kristal, bir kez (`tl_rewards`).
  - Kademe tabanları: Bronz 5, Gümüş 8, Altın 12, Platin 16, Koklea 20.
  - Taban, sıraya göre çarpılır: 1. ×3, 2. ×2, 3. ×1,5, puanı olan diğer takımlar ×1.
- **Duyuru**: takım sohbetine sistem mesajı düşer (`meta.event = 'tlig'`).
- **Rozet**: geçen sezon ilk 3'e girdiyse amblem çerçevesi kademenin renginde gösterilir.
- **Takım › Lig** ekranında şunlar var:
  - grup sıralaması ve yükselme/düşme bölgeleri,
  - kaynak kaynak puanlarımız,
  - kalan süre,
  - geçmiş sezonlar,
  - kurallar sayfası.
- **Sıralama**'ya "Takım Ligi" tablosu eklendi: bu sezonun lig puanı (`t-lig`).

## 3. İlk deneyim (FTUE)

| Özellik | Açılış | Tüy Dede satırları |
|---|---|---|
| Takım Ligi (`tlig`) | 6 bölüm | `tlig-01`, `tlig-02` |
| Canlı Takım Yarışı (`tyaris`) | 9 bölüm | `tyaris-01`, `tyaris-02` |

Satırların kayıtlı sesi yok; `tools/voice/generate.mjs` ile üretilmeli (o zamana dek altyazı ve cihaz sesi).

## 4. Protokol ve testler

- Protokol (`packages/shared/src/social.ts`, TAKIM REKABETİ bölümü):
  - `trace.state/open/join/leave/ready/search/close/challenge/accept/decline/rematch/result/react`, `tlig.state`
  - olaylar `trace.updated/matched/result/reaction/challenged`
  - `RaceRoom.team` ve `RacePlayer.side` (isteğe bağlı alanlar)
- Sunucu: `apps/server/src/teamrace/` (`index.ts` yarış, `league.ts` lig).
- Birim testleri: `apps/server/test/teamrace.test.ts`. Kapsadıkları:
  - eşleşme ve güç penceresi
  - dürüst not ve arama süresi
  - şeffaf puan ve denge çarpanı
  - sonucun bir kez yazılması
  - ödüller ve lig puanı
  - dostluk daveti ve rövanş
  - bağlantı kopması → bitiremedi
  - sezon kapanışı: yükselme/düşme, ödülün ve duyurunun bir kez olması
- Uçtan uca testler:
  - `node tools/harness/teamrace-e2e.mjs [--browsers chromium,webkit] [--target web|dom|both]`: beş tarayıcı oyuncusu ve iki takım (3'e 2). Akış: lobi → arama → eşleşme → yarış (bot, `&oyun-hiz=3`) → sonuç → akış kartı → lig puanı. dom'da telefon lideri lobi açar.
  - Turlar: `comm-e2e.mjs --only-tour`.
