# 10 · Sosyal Sunucu ve Ağ İstemcisi

ODİ'nin takım (ittifak) katmanı tek bir Node 22 sürecinde çalışır: **HTTP + WebSocket aynı portta**, veritabanı yerleşik **`node:sqlite`** (WAL). Yerel derleme gerektiren paket yoktur; Windows, macOS ve Linux'ta aynı komutla çalışır.

- Sunucu: `apps/server` (`@odi/server`) — TypeScript kaynağı, esbuild ile tek dosyaya paketlenir: `apps/server/dist/server.mjs`.
- İstemci: `packages/net` (`@odi/net`) — yalnızca standart `WebSocket` kullanır; tarayıcıda ve React Native'de çalışır.
- Protokol sözleşmesi: `packages/shared/src/social.ts` (OpMap/EvtMap, Wire*, SOCIAL_LIMITS, formüller). Sunucu ve istemci bu dosyayı paylaşır.

## 1. Çalıştırma

```bash
npm install --legacy-peer-deps
npm run server          # derler + çalıştırır (Windows'ta da aynı)
```

Çıktıda sağlık adresi ve aynı ağdaki telefonlar için bağlantı adresi yazar:

```
ODİ sunucusu hazır → http://localhost:8787  (sağlık: /saglik)
  Aynı Wi-Fi'daki telefondan: ws://192.168.1.23:8787
```

- `GET /saglik` → `{ ok, version, players, online }`
- `GET /` → kısa Türkçe açıklama
- WebSocket: herhangi bir yol (`ws://<adres>:8787`)

Yalnızca derlemek: `npm run build:server` (ya da `npm run build -w @odi/server`).
Testler: `npm test` (sunucu testleri `apps/server/test/*.test.ts`; her test sunucuyu `:memory:` veritabanı ve rastgele portla başlatır, gerçek WebSocket istemcileriyle `@odi/net` üzerinden konuşur).

### Telefondan bağlanma (aynı Wi-Fi)
1. Bilgisayarda `npm run server`.
2. Bilgisayarın yerel IP'sini çıktıdan al (Windows: `ipconfig` → IPv4 Adresi).
3. Uygulamada sunucu adresi olarak `ws://<bilgisayar-ip>:8787` ver.
4. Windows Güvenlik Duvarı ilk çalıştırmada Node için izin sorar: **Özel ağlar** için izin ver.
5. Bağlanmazsa: telefon ile bilgisayar aynı ağda mı, misafir ağı istemciler arası trafiği engelliyor mu, kontrol et.

## 2. Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `8787` | HTTP + WebSocket portu |
| `HOST` | `0.0.0.0` | dinlenen arayüz |
| `ODI_DB` | `apps/server/data/odi.sqlite` | sqlite dosyası (`:memory:` = bellek içi) |
| `ODI_RAID_ALWAYS` | kapalı | `1` → baskın tüm hafta açık (test) |
| `ODI_TEST_STORE` | — | `1` → TEST mağazası açık. `NODE_ENV` `production` değilse zaten açıktır |
| `NODE_ENV` | — | `production` olduğunda test mağazası kapanır (ODI_TEST_STORE=1 değilse) |
| `REVENUECAT_API_KEY` | — | gerçek mağaza makbuz doğrulaması; yoksa App Store / Play satın alımları **reddedilir** |
| `ODI_LOG` | açık | `0` → bağlantı günlüğünü kapat |

## 3. İstemci (`@odi/net`)

```ts
import { createClient } from '@odi/net';

const net = createClient({
  url: 'ws://192.168.1.23:8787',
  getToken: () => localStorage.getItem('odi.token'),
  saveToken: (t) => localStorage.setItem('odi.token', t),
  getQueue: () => JSON.parse(localStorage.getItem('odi.queue') ?? '[]'),
  saveQueue: (q) => localStorage.setItem('odi.queue', JSON.stringify(q)),
  name: 'Ayşe',
});
net.connect();
net.onStatus((s) => console.log(s));          // 'kapalı' | 'bağlanıyor' | 'bağlı' | 'çevrimdışı'
const { wallet } = await net.call('wallet.get', {});
const off = net.on('chat', ({ msg }) => console.log(msg.text));
net.fire('race.pos', { x, y, pct });           // yalnızca yarışta, en çok 8 Hz
```

- Bağlanınca otomatik `hello`; anahtar yoksa sunucu yeni oyuncu açar ve anahtarı `saveToken` ile saklatır. Sunucu anahtarı tanımazsa (ör. veritabanı sıfırlandı) istemci anahtarı siler ve yeni hesapla devam eder.
- Yeniden bağlanma: üstel bekleme (0,5 sn → en çok 15 sn). `kicked` gelirse (hesap başka cihazda açıldı) yeniden bağlanmaz.
- İstek zaman aşımı 10 sn. Bağlanırken yapılan çağrılar bağlantıyı bekler.
- `progress.submit` her zaman kalıcı kuyruktan gider: çevrimdışıyken saklanır, bağlanınca sırayla gönderilir. Sunucunun reddettiği kayıt kuyruktan atılır (takılıp kalmaz). Her kayıt bir `runId` taşır; verilmezse istemci üretir (`crypto.randomUUID`, yoksa zaman + rastgele) ve kuyrukta korur. Kısayol: `net.submitProgress({...})` (runId isteğe bağlı), `newRunId()` dışa aktarılır.
- React yardımcısı (isteğe bağlı): `import { useNet, bindNet } from '@odi/net/store'` → `bindNet(net)` bir kez; bileşenlerde `useNet((s) => s.wallet)`. Durum: `status, me, wallet, team, extra, camp, war, raid, race, inboxCount, giftCount, unread, messages, campHelp, presence, raceInvite`. React ve zustand peer dependency'dir; `@odi/net` kökü React'e bağımlı değildir.

Hata nesnesi: `NetError { code, message }` (mesaj Türkçe). Başlıca kodlar: `GECERSIZ`, `YETKI`, `YOK`, `YETERSIZ`, `LIMIT`, `HIZ`, `DOLU`, `TEKRAR`, `SART`, `SURE`, `MESGUL`, `MAKS`, `TAKIM_YOK`, `TAKIMDA`, `ISIM`, `SUSTURULDU`, `MAKBUZ`, `TEST_KAPALI`, `HARCAMA_SINIRI`, `OTURUM`, `TOKEN`, `SURUM`, `CEVRIMDISI`, `ZAMAN_ASIMI`, `KOPTU`, `KAPALI`, `SUNUCU`.

## 4. Kurallar ve formüller (sunucu yetkili)

Sunucu saati tek kaynaktır; takvim hesapları **Europe/Istanbul** yerel saatine göredir.

**Kimlik.** 32 bayt rastgele gizli anahtar (sunucuda yalnızca SHA-256 özeti saklanır), 6 karakterlik arkadaş kodu (karışmayan harfler: I, O, L, 0, 1 yok). İsim 3–16 karakter; harf/rakam/boşluk/_ (Türkçe harfler dahil); küfür filtresi (küçük harf, ı→i, ş→s…, rakam/simge benzerleri → harf, tekrar eden harfler teke). Varsayılan isim `OdiNNNN`. Aynı anahtar ikinci bağlantıdan gelirse eskisine `kicked` gider.

**İlerleme (`progress.submit`).** `runId` zorunlu; aynı oyuncu + `runId` ikinci kez gelirse ilk `ProgressAck` aynen döner, hiçbir şey tekrar sayılmaz (kayıtlar 30 gün tutulur). Makullük: bölüm 1–40, yıldız 0–3, skor ≤ 50 000, jeton ≤ 400, süre ≥ 5 sn, en yüksek açık bölüm + 1'den büyük bölüm reddedilir; tamamlanmayan bölüm yıldız veremez.
- Jeton = yuvarla(min(jeton, 400) × (1 + laboratuvar seviyesi × 3/100 + takım "Ortak Kazanç" × 3/100)).
- Savaş puanı = `warPointsFor` × (1 + kule × 2/100 + "Savaş Borusu" × 3/100) → bölgeye yazılır (aşağıya bakın).
- Baskın hasarı = `raidDamageFor` × (1 + "Baskın Gücü" × 4/100), pencere açıksa.
- Lig puanı = `leaguePointsFor` (+ `raceId` verilirse yarış derecesi; her yarış bir kez bağlanır).
- XP = `xpForRun`; seviye = `levelFromXp`. En iyi yıldız/skor bölüm başına saklanır.
- Takım: katkı tablosuna yıldız, takım XP'sine yıldız × 2; hedeflere yıldız / tamamlanan bölüm / uygulanan baskın hasarı.

**Kalkan ve profil.** Ödül kutusundaki `kalkan` alınınca `MyProfile.shields` artar (cüzdanda değildir); `cosmetics` mağaza/ödülle, `cards` ödül kutusundaki kartlarla dolar. Bölümde kullanılan kalkan sunucuya bildirilmez; istemci yerelde düşer.

**Etkiler (`me.bonuses`).** `{ coinPct, shieldChancePct, firstHitIgnorePct, warPct, raidPct }` — kamp + takım teknolojisi toplamı: jeton = laboratuvar×3 + Ortak Kazanç×3; kalkan şansı = atölye×4 + Ortak Kalkan×4; ilk hasarı yok sayma = revir×3; savaş = kule×2 + Savaş Borusu×3; baskın = Baskın Gücü×4. Sunucu jeton/savaş/baskın hesaplarında aynı değerleri kullanır; kalkan ve revir şansını istemci uygular.

**Arkadaşlar.** Kodla karşılıklı ekleme (en çok 200), listeleme (çevrimiçi önce), silme. Bağlanma/kopma `presence` olarak arkadaşlara ve takım arkadaşlarına gider.

**Sohbet.** Odalar `genel`, `takim:<id>` (yalnız üyeler), `dm:<a>:<b>` (a<b; yalnız ikisi ve arkadaşlarsa). Geçmiş son 50. Mesaj aralığı ≥ 1,2 sn, en çok 200 karakter, küfürler yıldızla maskelenir. 3 farklı kişiden şikâyet → mesaj gizlenir, gönderen 10 dk susturulur. `chat.mute` kişisel engel (geçmişte ve canlıda gizler). Takım ve özel odalarda mesaj, odaya katılmamış olsa da çevrimiçi üyelere gider (okunmamış sayaçları için); `genel` yalnızca katılanlara. Kayıtlar 30 gün tutulur.

**Takım.** Ad benzersiz (büyük/küçük harf duyarsız), 3–20; amblem tek emoji; `minLevel` katılım şartı (kurucunun bölümünden yüksek olamaz). Liste: açık takımlar, güç (üyelerin toplam yıldızı) sırasıyla; kapalı takıma yalnızca davet koduyla girilir. En çok 30 üye. Lider ayrılırsa en kıdemli yardımcıya, yoksa en kıdemli üyeye devreder; son kişi ayrılırsa takım silinir. Atma: lider herkesi, yardımcı yalnızca üyeleri. Rol değişimi yalnızca lider (`lider` rolü vermek = devretmek).
Takım seviyesi: eşik(l) = 300 × (l−1)^1,6; XP = yıldızlar × 2 + bağışlanan jeton / 10.

**Bölüm yardımı.** Günde 3 istek (İstanbul günü), istek 24 saat açık (`expiresAt`), en çok 5 yardımcı. Her yardım: isteyenin ödül kutusuna 1 kalkan, yardım edene 5 jeton.

**Kulak Kampı.** Başlangıç: Kamp Merkezi 1, diğerleri 0; başlangıç cüzdanı 100 jeton. Maliyet/süre `buildCost`; diğer binalar ≤ merkez seviyesi; aynı anda 1 inşaat; "Hızlı İnşaat" süreyi −%2/seviye kısaltır. `camp.help.request` inşaatı takımın yardım listesine koyar (`team.campHelpNeeded`). Her yardım `helpReductionSec(kalan)` düşer; inşaat başına en çok 5 + "Dayanışma" seviyesi; bir kişi aynı inşaata bir kez. Yardım edene günün ilk 30 yardımı için 2'şer jeton. Hızlandırıcılar: 5 dk / 60 dk / 8 sa (ihtiyaçtan fazlası harcanmaz); kristal: `crystalsToFinish(kalan)`. Süre dolunca hem sorgu anında hem 5 sn'lik zamanlayıcıyla tamamlanır (`camp.updated`). Depo: seviye × 20 jeton/saat, en çok 8 saat birikir.

**Takım teknolojisi.** `team.donate` jetonu düşer, ilerleme `techCost(seviye)` dolunca seviye atlar (sistem mesajı). En üst seviyeyi aşan kısım alınmaz.

**Takım hediyeleri** (içerik sabit, şans yok; 24 saat içinde alınır, liste son 7 gün):
- Mağazada `teamGift` ürün alınınca diğer tüm üyelere — fiyat < 50 TL: 20 kristal + 50 jeton; < 100 TL: 50 kristal + 100 jeton; ≥ 100 TL: 100 kristal + 200 jeton.
- Baskında canavar yenilince tüm üyelere: 30 kristal + 200 jeton.
- Takım hedef kademesi tamamlanınca o anki tüm üyelere kademe ödülü (hafta sonuna kadar; `team.goal.claim` ya da `team.gift.claim` ile).

**Haftalık takım hedefleri** (3 hedef × 4 kademe; ödüller görünür):

| Hedef | Ölçü | Kademeler | Ödüller |
|---|---|---|---|
| Yıldız Avı | yıldız | 30 / 90 / 180 / 300 | 100 J · 150 J + 10 K · 250 J + 20 K · 400 J + 40 K |
| Bölüm Maratonu | tamamlanan bölüm | 20 / 60 / 120 / 200 | aynı |
| Canavar Avı | baskın hasarı | 500 / 1500 / 3000 / 6000 | aynı |

**Bölge Savaşı.** ISO hafta: Pazartesi 00:00 – Pazar 23:59 (İstanbul). Lider/yardımcı en çok 3 hedef bölge seçer. Puan, biyomu eşleşen ilk hedefe; eşleşen yoksa ve `merkez` hedefse merkeze; yoksa yalnızca kişisel ve takım haftalık puanına yazılır. Bölge sahibi = en yüksek puan; eşitlikte mevcut sahip kalır. El değiştirince iki takımın sohbetine `war` mesajı ve herkese `war.updated`. Hafta kapanınca (ilk erişimde, tembel) sahip takımın üyelerine bölge başına 50 kristal + 300 jeton ödül kutusuna; puanlar yeni haftada sıfırdan başlar. Hedef seçimi haftalar arası korunur.

**Baskın.** Pencere Cuma 20:00 – Cumartesi 20:00 (İstanbul); `ODI_RAID_ALWAYS=1` ile tüm hafta. Ortak can = 400 + 120 × üye sayısı; takımın penceredeki ilk erişiminde sabitlenir. Sıralama: yenme süresi (pencere açılışından itibaren) küçük olan önde, sonra hasar.

**Lig.** Haftalık; oyuncu haftadaki ilk lig etkinliğinde (bölüm sonucu ya da `league.state`) kendi kademesindeki ilk boş 30'luk gruba girer (katılım sırası). Hafta kapanınca her grupta ilk 7 bir üst kademeye, ilk 7'ye girmeyenlerden son 5 bir alt kademeye geçer (Bronz'dan düşülmez, Koklea'dan çıkılmaz). Not: 7 kişiden küçük gruplarda herkes yükselir.

**Mağaza.** Gerçek para yalnızca App Store / Google Play (RevenueCat). Web'de TEST mağazası açıkça TEST'tir, para çekmez; yalnızca `ODI_TEST_STORE=1` ya da üretim dışı ortamda açıktır. Gerçek mağaza: `verifyReceipt` RevenueCat REST API'sinden (`/v1/subscribers/<oyuncuId>`) işlem kimliğini doğrular; anahtar yoksa açık hata ile reddeder (sahte doğrulama yok); aynı makbuz iki kez kullanılamaz. Ürün sınırı (`limit`) ve aylık harcama sınırı (varsayılan 1000 TL; düşürme hemen, yükseltme 24 saat sonra geçerli — bekleyen yükseltme `pendingLimitTry` / `pendingLimitAt` ile görünür). `shop.list` takım hediyeli ürünlerde `teamGiftContents` alanını doldurur. Aylık toplam İstanbul takvim ayına göredir ve TEST satın alımlarını da sayar (sınır davranışı test edilebilsin diye). Sezon Kartı: 28 gün boyunca her günün ilk girişinde (`hello` ya da `inbox.list`) ödül kutusuna 30 kristal.

**Sağlamlık.** Her işlem zod şemasıyla doğrulanır; her işlem tek SQLite işleminde (transaction) çalışır ve olaylar yalnızca başarılı işlemden sonra gönderilir. Bağlantı başına 30 mesaj/sn, mesaj boyutu en çok 8 KB (aşılırsa bağlantı 1009 ile kapanır), 25 sn'de bir ping/pong.

## 5. Bilinen sınırlar
- Canlı yarış odaları bellektedir: sunucu yeniden başlarsa açık odalar kaybolur. Lobiden ayrılan oyuncu listeden çıkar; yarış başladıktan sonra ayrılan `left` olarak kalır. 30 dk başlamayan lobi kapanır.
- Tek süreç; yatay ölçekleme yok (sohbet/olaylar bellek içi abonelikle dağıtılır).
- Kartlar (`MyProfile.cards`) şimdilik sunucuda yalnızca ödül kutusundan `kart` alınınca dolar; istemci senkronu için ayrı bir işlem yok.
- Gerçek mağaza akışında harcama sınırı, ödeme ekranı açılmadan önce istemci tarafından `shop.list` ile kontrol edilmelidir (sözleşmede "satın alma niyeti" işlemi yok).

## 6. Render.com'a dağıtım (ücretsiz web servisi)
1. Depoyu GitHub'a gönder. Render → **New → Blueprint** → depoyu seç; kökteki `render.yaml` okunur (Docker: `apps/server/Dockerfile`, bağlam depo kökü, sağlık yolu `/saglik`).
2. `REVENUECAT_API_KEY` değerini panelden gir (gerçek satın alma doğrulaması için; boş kalırsa gerçek satın alımlar reddedilir). Test dağıtımında web TEST mağazası isteniyorsa `ODI_TEST_STORE=1`.
3. Dağıtım bitince adres `https://odi-sunucu.onrender.com` gibi olur; istemci `wss://odi-sunucu.onrender.com` ile bağlanır. Render `PORT` değişkenini kendisi verir.
4. **Uyarı:** ücretsiz planda disk kalıcı değildir; her dağıtım/yeniden başlatmada sqlite dosyası sıfırlanır (oyuncular yeni hesapla başlar — istemci bunu otomatik yönetir). Ücretsiz servis 15 dk hareketsizlikte uyur; ilk bağlantı ~30-60 sn sürebilir. Kalıcılık için: ücretli plana kalıcı disk ekleyip `ODI_DB`'yi diskin yoluna (ör. `/var/data/odi.sqlite`) ver, ya da ileride Postgres'e geç.

Yerelde Docker ile: `docker build -f apps/server/Dockerfile -t odi-sunucu . && docker run -p 8787:8787 -v odi-veri:/app/data odi-sunucu`.
