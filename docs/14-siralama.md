# 14 · Sıralama: en güçlü oyuncular ve takımlar

Sahibin isteği: "Bir yerde en güçlü takımlar ve en güçlü oyuncular sıralı gösterilsin ki rekabet artsın." Kurucu ilke aynen geçerli:
**dürüst tasarım** — sahte oyuncu, sahte puan ya da uydurma geri sayım yok; her sayı sunucunun doğruladığı olaylardan gelir ve nasıl
hesaplandığı oyuncuya açıkça gösterilir.

## 1. Tablolar

| Tablo | Tür | Değer (sunucu hesaplar) |
|---|---|---|
| **Güç** | oyuncu, kalıcı | yıldız × 10 + geçilen bölüm × 20 + kamp binası seviyeleri toplamı × 15 + Günün Sorusu doğruları × 5 |
| **Haftalık yıldız** | oyuncu, haftalık | bu hafta kazanılan **yeni** yıldız (bir bölümün en iyi yıldızı artınca; tekrar oynamak saymaz) |
| **Haftalık nota** | oyuncu, haftalık | bölümlerde toplanan nota, **günde en çok 2.000** sayılır |
| **Günün Sorusu** | oyuncu, haftalık | bu hafta açıklanan sorulara doğru cevap |
| **Yarış galibiyeti** | oyuncu, haftalık | en az iki kişinin bitirdiği canlı yarışta birincilik, **günde en çok 10** |
| **Takım gücü** | takım, kalıcı | üyelerin güç toplamı + takım teknolojisi seviyeleri × 100 |
| **Bölge Savaşı** | takım, haftalık | haftanın savaş puanı (`team_week`) |
| **Baskın** | takım, haftalık | bu haftaki baskında verilen toplam hasar (`raid_damage`) |
| **Bilgi** | takım, haftalık | üyelerin bu hafta Günün Sorusu doğruları |

Kurallar tek yerde: `RANK_BOARDS`, `RANK_RULES` (`packages/shared/src/social.ts`); bilgi sayfası ("Nasıl hesaplanır?") bu sabitleri aynen gösterir.

Not: takım başlığındaki ⭐ sayısı (`TeamSummary.power`) üyelerin toplam yıldızıdır; "Takım gücü" tablosu yukarıdaki formüldür.

## 2. Kapsamlar ve görünüm

- **Herkes**: ilk 100 (ilk 3 podyumda, her oyuncunun kendi Odi rengi ve şapkasıyla; takımlarda amblem).
- **Arkadaşlar**: ben + arkadaşlarım (takım tablolarında: benim ve arkadaşlarımın takımları).
- **Yakınım**: benim sıramın ±5'i.
- **Benim satırım** listede görünmüyorsa altta sabit durur. Eşit puan eşit sıra (1, 2, 2, 4).
- **▲▼**: gün başındaki (İstanbul günü) sıraya göre değişim; ilk erişimde günün sırası kaydedilir (`rank_snap`, 3 gün saklanır).
- Geçen haftanın ilk 3'ü haftalık tablolarda ayrı kutuda ve 👑 rozetiyle görünür.
- Satıra dokun → profil kartı: arkadaş ekle, mesaj, **takıma davet et** (arkadaşa; davet metnini ve kodu sunucu yazar, kart özel
  mesajda "Takıma katıl" düğmesiyle gelir), hediye, yarış (meydan okuma).

Giriş: Profil › **Sıralama** kutucuğu ve Takım › **Sıralama** sekmesi. Açılış: **5 bölüm** (takımla birlikte), Tüy Dede turu
`sira-01`, `sira-02`, `sira-03` (`apps/web/src/ftue/script.ts`; ses dosyaları `tools/voice/generate.mjs` ile üretilmeli).

## 3. Hafta kapanışı ve ödüller

Haftalık tablolar **Pazartesi 00:00 (Europe/Istanbul)** kapanır (sunucunun hafta anahtarı; ilk erişimde ya da 5 sn'lik süpürmede).
Kapanışta: ilk 10'un son sıralaması `rank_final`'a yazılır; ödüller ödül kutusuna **bir kez** düşer (`rank_rewards` birincil anahtarı
— ikinci kapanış denemesi ödül vermez):

| | 1. | 2. | 3. | 4–10. |
|---|---|---|---|---|
| Oyuncu tabloları | 50 kristal | 30 | 20 | 10 |
| Takım tabloları (her üyeye) | 20 kristal | 12 | 8 | – |

Duyuru (yalnızca ilk 3): takım tablosu → o takımın sohbetine sistem mesajı (`meta.event = 'sira'`); oyuncu tablosu → oyuncunun
takımına Takım Akışı kartı (`type: 'sira'`, oyuncunun "başarılarım akışta görünsün" ayarı açıksa).

## 4. Hile önleme

- Bölüm/yıldız yalnızca `progress.submit` doğrulamasından geçen koşulardan (`rank_level`); aynı `runId` ikinci kez sayılmaz.
  Çevrimdışı eşitleme (`progress.sync`) **sayılmaz** (istemci bildirimi). Sonuç: tablo, yayından sonra oynanan bölümlerle dolar.
- Nota ve yarış galibiyeti günlük üst sınırlı (`rank_day`); yarış birinciliği için en az iki bitiren gerekir.
- Günün Sorusu yalnızca açıklanmış (doğrulanmış) cevaplardan.
- Tablolar 15 sn önbellekli (`rank.board`), tüm hesap sunucuda.

## 5. Protokol ve testler

`rank.board { board, scope } → { view: RankBoardView }`. Sunucu: `apps/server/src/rank/index.ts`; birim testleri
`apps/server/test/rank.test.ts` (formül, eşitleme sayılmaz, haftalık sınırlar, kapsamlar ve ▲▼, kapanış + bir kez ödül + duyuru +
rozet, takıma davet). Uçtan uca: `node tools/harness/comm-e2e.mjs --only-rank` (üç oyuncu: sıra, arkadaşlar, yakınım, bilgi,
profil kartı → takıma davet → katılım, Takım › Sıralama) ve `--only-tour` (5. bölüm turu). Ekran denetimi `ui-mobile-check.mjs` (390/320).
