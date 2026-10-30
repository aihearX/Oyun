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

- `GET /saglik` → `{ ok, version, players, online }` (`players`: silinmemiş hesap sayısı; `account.delete` ile silinen hesap sayılmaz)
- `GET /olcum` → iletişim ölçümü: son 7 günün günlük toplam sayaçları (kişisel veri yok; bkz. `docs/13-iletisim.md` §6)
- `POST /hata` → çökme raporu (YN-011): en çok 8 KB JSON, katı şema (fazla alan → 400), IP başına dakikada 10 / günde 100 (IP yalnız
  bellekte), `crash_reports` tablosunda saat + imza başına sayaç, 30 gün. Alanlar ve temizleyici: `packages/shared/src/hata.ts`.
- `GET /hata/ozet` → son 7 gün imza başına toplam ve son 24 saat (yalnız sayılar; Caddy dışarı açmaz, `odi-durum` okur).
  Ayrıntı (ileti, yığın, sürüm, ekran): sunucu makinesinde `npm run kod -- cokme [--gun 7]`.
- `POST /geri-bildirim` → beta geri bildirimi (Ayarlar › Geri bildirim gönder): en çok 4 KB JSON, katı şema (fazla alan → 400;
  alanlar: konu, metin ≤ 500, ekran, sürüm, derleme, platform), metin sunucuda yeniden temizlenir (e-posta, telefon, uzun rakam
  dizisi), IP başına saatte 5 / günde 20 (IP yalnız bellekte), `feedback` tablosu (göç 4; oyuncu sütunu yok), 90 gün.
  Kurallar: `packages/shared/src/geribildirim.ts`, `apps/server/src/geribildirim.ts`.
- `GET /geri-bildirim/ozet` → son 24 saat ve son 7 gün kayıt sayısı (metin yok; Caddy dışarı açmaz, `odi-durum` okur).
  Okumak: sunucu makinesinde `npm run kod -- geribildirim [--gun 7]`.
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
| `HOST` | `0.0.0.0` | dinlenen arayüz (Oracle kurulumunda `127.0.0.1`: yalnız önündeki Caddy erişir) |
| `ODI_DB` | `apps/server/data/odi.sqlite` | sqlite dosyası (`:memory:` = bellek içi) |
| `ODI_RAID_ALWAYS` | kapalı | `1` → baskın tüm hafta açık (test) |
| `ODI_TEST_STORE` | — | `1` → TEST mağazası açık. `NODE_ENV` `production` değilse zaten açıktır |
| `NODE_ENV` | — | `production` olduğunda test mağazası kapanır (ODI_TEST_STORE=1 değilse) |
| `REVENUECAT_API_KEY` | — | gerçek mağaza makbuz doğrulaması; yoksa App Store / Play satın alımları **reddedilir** |
| `ODI_LOG` | açık | `0` → bağlantı günlüğünü kapat |
| `ODI_FREE_TEXT_AT` | `8` | yalnızca test: serbest yazı için geçilmesi gereken bölüm (güvenli sohbet; üretimde ayarlanmaz) |
| `ODI_ADMIN_CODE_HASH` | geliştirmede depodaki varsayılan özet; **üretimde (`NODE_ENV=production`) yok = yönetici kodu kapalı** | yönetici kodunun tuzlu scrypt özeti (`scrypt:tuz:özet`). Kodun düz metni hiçbir yerde tutulmaz; yeni özet: `npm run kod -- ozet` (kodu standart girdiden okur; kod 16–32 karakter, harf/rakam/tire olmalı, `--denetle` yalnız uygunluğu söyler; sunucuda `sudo odi-kod-degistir`). Depo herkese açık olduğundan varsayılan özet üretimde kullanılmaz; üretim için yeni ve uzun bir kod seçilip özeti burada verilmelidir |
| `ODI_BACKUP_DIR` | — | veritabanı yedek klasörü; verilirse açılışta ve her `ODI_BACKUP_HOURS` saatte `VACUUM INTO` ile kopya (bkz. "Yedek") |
| `ODI_BACKUP_HOURS` | `6` | yedek aralığı (saat) |
| `ODI_BACKUP_KEEP` | `28` | tutulan en yeni yedek sayısı (6 saatte bir → 7 gün) |
| `ODI_NEW_PER_IP_HOUR` | kapalı | IP başına saatte en çok yeni hesap (anahtarsız `hello`); aşılınca `HIZ`. Yalnızca `ODI_TRUST_PROXY` doğru ayarlıyken açın: vekil arkasında yanlış ayarda tüm oyuncular tek IP görünür. Öneri: 20 |
| `ODI_TRUST_PROXY` | `0` | sunucunun önündeki güvenilir vekil sayısı. `0`: `X-Forwarded-For` yok sayılır, soket adresi kullanılır. Render gibi tek vekil: `1` (başlığın en sağdaki girdisi; soldakileri istemci yazabilir). Kod denemesi IP sınırı bu adresi kullanır |

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

Hata nesnesi: `NetError { code, message }` (mesaj Türkçe). Başlıca kodlar: `GECERSIZ`, `YETKI`, `YOK`, `YETERSIZ`, `LIMIT`, `HIZ`, `DOLU`, `TEKRAR`, `SART`, `SURE`, `MESGUL`, `MAKS`, `TAKIM_YOK`, `TAKIMDA`, `ISIM`, `SUSTURULDU`, `MAKBUZ`, `TEST_KAPALI`, `HARCAMA_SINIRI`, `OTURUM`, `TOKEN`, `SURUM`, `CEVRIMDISI`, `ZAMAN_ASIMI`, `KOPTU`, `KAPALI`, `SUNUCU`; takım başvurusu: `BASVURU` (başvuruyla takıma `team.join` {teamId}), `ACIK` (açık takıma başvuru), `BEKLE` (ret/geri çekme beklemesi), `KARAR` (başvuru zaten karara bağlandı ya da düştü), `UYGUNSUZ` (notta küfür), `SERBEST_KAPALI` (8 bölümden önce serbest not).

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

**Etkiler (`me.bonuses`).** `{ coinPct, shieldChancePct, firstHitIgnorePct, warPct, raidPct }` — kamp + takım teknolojisi toplamı: jeton = laboratuvar×3 + Ortak Kazanç×3; kalkan şansı = atölye×4 + Ortak Kalkan×4; ilk hasarı yok sayma = revir (Odyoloji Kliniği)×3; savaş = kule×2 + Savaş Borusu×3; baskın = Baskın Gücü×4. Sunucu jeton/savaş/baskın hesaplarında aynı değerleri kullanır; kalkan ve revir şansını istemci uygular.

**Arkadaşlar.** Arkadaşlık istekle kurulur: `friends.request` {code | name | id} → karşı tarafa `friend.request`; `friends.respond` {requestId, accept} (kabul → isteği gönderene `friend.accepted` + `friend.updated`; ret sessizdir, yalnız gönderenin listesinden düşer), `friends.requests` (gelen/giden), `friends.cancel`. Eski `friends.add` {code} geriye uyumludur: istek gönderir; iki taraf da birbirini eklediyse (ters yönde bekleyen istek varsa) anında arkadaş olurlar. Sınırlar: en çok 200 arkadaş, günde 50 istek (İstanbul günü), en çok 100 bekleyen giden istek. Listeleme çevrimiçi önce; `friends.remove` karşı tarafa `friend.removed`. Bağlanma/kopma `presence` olarak arkadaşlara ve takım arkadaşlarına gider.

**Arama, öneri, profil kartı.** `players.search` {query, page}: en az 3 harf, isimde Türkçe harf katlamalı ("ayse" → "Ayşe") ya da 6 karakterlik kod; sayfa 20; kendisi, engellediği/engelleyeni ve varsayılan isimli hiç oynamamış hesaplar hariç. `friends.suggest`: takım arkadaşları ("Takım arkadaşın"), son yarıştaki rakipler ("Seninle yarıştı"), ortak arkadaşı olanlar ("N ortak arkadaşınız var"), bu haftaki lig grubundakiler ("Aynı ligdesiniz"); arkadaşlar, bekleyen istekler ve engelliler hariç, en çok 20. `profile.card` {id}: herkese açık profil (yıldız, en yüksek bölüm, lig, takım), arkadaş sayısı, ortak arkadaş, aramızdaki durum (`arkadas` / `istek-giden` / `istek-gelen` / `engelledin` / `yok`), mesaj izni, bugün hediye gönderildi mi. Başarımlar cihazda tutulduğu için kartta yok.

**Özel mesaj kutusu (dm).** Kalıcı (sqlite `dm`), konuşma başına son 500 mesaj. **İzin kuralı: arkadaşlar ve aynı takımdakiler birbirine yazabilir; diğer herkese kapalı** (önce arkadaşlık isteği). Engel her iki yönde mesajı, isteği, yarış davetini ve hediyeyi keser, arkadaşlığı ve bekleyen istekleri siler; engellenen kişi genel sohbette de sessize alınır. İşlemler: `dm.threads` (karşı taraf, son mesaj, okunmamış; en yeni üstte), `dm.open` {id, before?} (30'luk sayfa, `peerReadSeq` = karşı tarafın okuduğu son sıra), `dm.send` {to, text, kind: text | emoji | sticker | davet, meta?} (metin en çok 500 karakter, küfür yıldızlanır, mesajlar arası ≥ 0,6 sn, susturulmuşsa gönderemez; `emoji` yalnız emoji; `sticker` sabit Odi çıkartması kimliği; `davet` meta {type, roomId, level?, title?} — `yaris` türünde gönderen o yarış odasında olmalı, diğer türler serbesttir ve istemci uygun ekrana yönlendirir), `dm.read` {id, upTo?} (görüldü; yanıt vermek de okumak sayılır), `dm.typing` (WireFire, alıcıda 4 sn "yazıyor…", bağlantı başına en çok 1/sn), `dm.react` {msgId, emoji} (❤️ 😂 😮 😢 👍 🔥; mesaj başına kişi başı bir tepki, aynısı geri alır), `dm.delete` {msgId} (yalnız kendi mesajı; herkes için "silindi"), `dm.report` {msgId}. Olaylar: `dm.message` (yeni ya da silinen mesaj), `dm.read`, `dm.typing`, `dm.reaction`, `dm.unread` (toplam okunmamış). Şikâyet birikimi sohbetle aynı eşiktedir: 24 saatte **3 farklı kişiden** şikâyet (`dm.report` ya da `players.report`) → 10 dk susturma (sohbet + dm); şikâyet eden o mesajı artık görmez.

**Arkadaş hediyesi.** `friends.gift` {id}: günde her arkadaşa 1 kez, alıcının ödül kutusuna sabit 10 jeton ("🎁 X sana arkadaş hediyesi gönderdi"), gönderene 2 jeton "iyilik"; günde en çok 20 hediye. Alıcıya `friend.gift` + `inbox.new`.

**Sohbet.** Odalar `genel`, `takim:<id>` (yalnız üyeler), `dm:<a>:<b>` (a<b; yalnız ikisi ve arkadaşlarsa). Geçmiş son 50. Mesaj aralığı ≥ 1,2 sn, en çok 200 karakter, küfürler yıldızla maskelenir. 3 farklı kişiden şikâyet → mesaj gizlenir, gönderen 10 dk susturulur. `chat.mute` kişisel engel (geçmişte ve canlıda gizler). Takım ve özel odalarda mesaj, odaya katılmamış olsa da çevrimiçi üyelere gider (okunmamış sayaçları için); `genel` yalnızca katılanlara. Kayıtlar 30 gün tutulur.

**Takım.** Ad benzersiz (büyük/küçük harf duyarsız), 3–20; amblem tek emoji; `minLevel` katılım şartı (kurucunun bölümünden yüksek olamaz). Liste (`team.list`): **tüm takımlar** (açık + başvuruyla), Sıralama'daki "Takım gücü" sırasıyla; arama, filtre ve sayfalama. Katılım modu **Açık** (doğrudan katıl) ya da **Başvuruyla** (lider veya yardımcı onaylar); davet kodu iki modda da doğrudan katılım kısayoludur ve yalnızca üyelere gösterilir. Ayrıntı: `docs/16-takim-rekabeti.md` §5. En çok 30 üye. Lider ayrılırsa en kıdemli yardımcıya, yoksa en kıdemli üyeye devreder; son kişi ayrılırsa takım silinir. Atma: lider herkesi, yardımcı yalnızca üyeleri. Rol değişimi yalnızca lider (`lider` rolü vermek = devretmek).
Takım seviyesi: eşik(l) = 300 × (l−1)^1,6; XP = yıldızlar × 2 + bağışlanan jeton / 10.

**Bölüm yardımı.** Günde 3 istek (İstanbul günü), istek 24 saat açık (`expiresAt`), en çok 5 yardımcı. Her yardım: isteyenin ödül kutusuna 1 kalkan, yardım edene 5 jeton.

**Kulak Kampı** (ayrıntı: `docs/14-kamp.md`). Binalar (kimlik kalıcı): `merkez` Odyoloji Merkezi, `laboratuvar` Odyometri Odası, `atolye` İşitme Cihazı Atölyesi, `depo` Kulak Deposu, `kule` Timpanometri Kulesi, `revir` Odyoloji Kliniği, `tedavi` Tedavi Odası (yeni; eski oyunculara açılışta Sv 0 satırı eklenir). Başlangıç: Odyoloji Merkezi 1, diğerleri 0; başlangıç cüzdanı 100 jeton. Maliyet/süre `buildCost`; diğer binalar ≤ merkez seviyesi; aynı anda 1 inşaat, ek olarak 1 inşaat sıraya alınabilir (`camp.queue { id }` bedeli peşin düşer, süren bitince öncekinin bittiği anda kendiliğinden başlar; `camp.unqueue` bedeli tamamen geri verir; Merkez sınırı süren inşaat bittikten sonraki seviyeye göre; hızlandırıcı ve yardım yalnız süren inşaata; `CampState.queued` yalnız `hello.campV ≥ 3`; tablo `camp_queue`; ayrıntı `docs/14-kamp.md` §14); hızlandırıcının artan süresi bir sonrakine taşmaz (inşaat en erken "şimdi" biter); "Hızlı İnşaat" süreyi −%2/seviye kısaltır. `camp.help.request` inşaatı takımın yardım listesine koyar (`team.campHelpNeeded`). Her yardım `helpReductionSec(kalan)` düşer; inşaat başına en çok 5 + "Dayanışma" seviyesi; bir kişi aynı inşaata bir kez. Yardım edene günün ilk 30 yardımı için 2'şer jeton. Hızlandırıcılar: 5 dk / 60 dk / 8 sa (ihtiyaçtan fazlası harcanmaz); kristal: `crystalsToFinish(kalan)`. Süre dolunca hem sorgu anında hem 5 sn'lik zamanlayıcıyla tamamlanır (`camp.updated`). Depo: seviye × 20 jeton/saat, en çok 8 saat birikir. Tedavi Odası: `camp.remedy.make { item | null }` tarifi seçer (raftakiler önce çantaya), `camp.remedy.collect` raftakileri çantaya alır (zamana bağlı; ikinci çağrı 0); `CampState.remedy = { item, since, inv }`; `progress.submit.remediesUsed` kullanılan malzemeyi runId başına bir kez düşer (yarışta düşmez). Bina seviyesiyle açılan kamp kozmetikleri inşaat bitince / kamp açılınca bir kez profile yazılır (`camp_unlocks`).

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

**Canlı yarış.** Yalnızca gerçek oyuncular (bot/sahte rakip yok); oda en çok 4 kişi. Her odanın tuzu (`salt`) 1–999 arası rastgele; herkes `generateLevel('insan', level, DEFAULT_PROFILE, salt)` ile aynı bölümü oynar. En az 2 oyuncu ve herkes hazır → 4 sn geri sayım (`startsAt`, sunucu saati); geri sayımda ve sonrasında katılım kapalı (`BASLADI`), hızlı eşleşme yalnız lobideki odaları seçer. Konum `race.pos` (WireFire) en çok 8 Hz, yalnızca `yarista` iken diğer oyunculara iletilir. Bitiş: herkes bitirince, ilk bitirenden 60 sn sonra ya da başlangıçtan en geç **3 dk** sonra `bitti` (bitiremeyenin derecesi yok). Yarış başladıktan sonra ayrılan `left` işaretlenir. Oda sohbeti `race:<odaId>`: yalnızca odadaki (ayrılmamış) oyuncular okur/yazar; takım/genel sohbetten ayrıdır. Rövanş: son yarıştaki rakipler 30 dk boyunca arkadaş olmasalar da davet edilebilir ve o yarışın bölümünde (açık bölümden yüksek olsa da) oda kurulabilir.
İstemci saat farkı: `hello` yanıtındaki `serverTime` ile (`net.serverNow()`); `startsAt` yerel `performance.now()` tabanına çevrilir, böylece herkesin "Başla!"sı aynı ana denk gelir (hata ≈ yarım gidiş-dönüş süresi).
Test: `node tools/harness/race-e2e.mjs` (sunucu `ODI_DB=:memory:` + vite build/preview + 3 tarayıcı). Yarış test sayfası `apps/web/src/race/dev/yaris.html` yalnızca geliştirme/harness içindir (üretim derlemesine girmez); `?yaris-bot=1[&bot-gecikme=ms]` yalnızca bu sayfada bölümü harness botuna oynatır, uygulamada etkisizdir.

**Lig.** Haftalık; oyuncu haftadaki ilk lig etkinliğinde (bölüm sonucu ya da `league.state`) kendi kademesindeki ilk boş 30'luk gruba girer (katılım sırası). Hafta kapanınca her grupta ilk 7 bir üst kademeye, ilk 7'ye girmeyenlerden son 5 bir alt kademeye geçer (Bronz'dan düşülmez, Koklea'dan çıkılmaz). Not: 7 kişiden küçük gruplarda herkes yükselir.

**Yerel ödüller, yetenekler, çevrimdışı ilerleme.** Görev/takvim/sandık/hazine/Şanslı Nota/başarım jetonları istemcide hesaplanır ve `wallet.local { ledgerId, jeton, reason }` ile hesaba yazılır: `ledgerId` ile idempotent (aynı kayıt ikinci kez eklenmez), İstanbul günü başına en çok **1.500 jeton** (`LOCAL_JETON_DAILY_MAX`, `@odi/shared`; `credited` eklenen miktar, `dailyLeft` kalan). Sınır ölçüldü (`docs/yonetim/ekonomi-olcum.md`, Ö1): dürüst oyunun en yoğun günü 1.270 jeton (günde 6 oturum, 1. gün; ilk başarımlar ve hazineler), yani dürüst oyuncu sınıra çarpmaz; sahte istemci ise günde en çok 1.500 jeton basabilir. Eski 600 sınırı 3 ve 6 oturumlu oyuncunun ilk 3 gününde 616 / 963 jetonu kesiyordu. Bölüm jetonu bu yoldan değil, `progress.submit` ile gelir. `wallet.spend { jeton, reason: 'yetenek:<id>' }` yetenek alır: fiyat `SKILL_TREE` maliyetiyle aynı olmalı, ön koşul aranır, aynı yetenek ikinci kez alınamaz (`TEKRAR`); liste `skills.list`. `progress.sync { best }` cihazdaki çevrimdışı ilerlemeyi taşır: yalnızca en iyi yıldız/skor ve açık bölüm (ödül, savaş, baskın, lig puanı vermez).
Web/mobil arayüz (`apps/web/src/net.ts`): bağlıyken sunucu cüzdanı tek doğru kaynaktır; yerel jeton = sunucu jetonu + bekleyenler (kuyruktaki bölüm jetonları + gönderilmemiş yerel ödüller − gönderilmemiş harcamalar). Uçtan uca test: `node tools/harness/social-e2e.mjs` (iki tarayıcı + gerçek sunucu; ekran görüntüleri `tools/harness/out/sosyal/`).

**Mağaza.** Gerçek para yalnızca App Store / Google Play (RevenueCat). Web'de TEST mağazası açıkça TEST'tir, para çekmez; yalnızca `ODI_TEST_STORE=1` ya da üretim dışı ortamda açıktır. Gerçek mağaza: `verifyReceipt` RevenueCat REST API'sinden (`/v1/subscribers/<oyuncuId>`) işlem kimliğini doğrular; anahtar yoksa açık hata ile reddeder (sahte doğrulama yok); aynı makbuz iki kez kullanılamaz. Ürün sınırı (`limit`) ve aylık harcama sınırı (varsayılan 1000 TL; düşürme hemen, yükseltme 24 saat sonra geçerli — bekleyen yükseltme `pendingLimitTry` / `pendingLimitAt` ile görünür). `shop.list` takım hediyeli ürünlerde `teamGiftContents` alanını doldurur. Aylık toplam İstanbul takvim ayına göredir ve TEST satın alımlarını da sayar (sınır davranışı test edilebilsin diye). Sezon Kartı: 28 gün boyunca her günün ilk girişinde (`hello` ya da `inbox.list`) ödül kutusuna 30 kristal.

**Sağlamlık.** Her işlem zod şemasıyla doğrulanır; her işlem tek SQLite işleminde (transaction) çalışır ve olaylar yalnızca başarılı işlemden sonra gönderilir. Bağlantı başına 30 mesaj/sn, mesaj boyutu en çok 8 KB (aşılırsa bağlantı 1009 ile kapanır), 25 sn'de bir ping/pong.

## 5. Bilinen sınırlar
- Canlı yarış odaları bellektedir: sunucu yeniden başlarsa açık odalar kaybolur. Lobiden ayrılan oyuncu listeden çıkar; yarış başladıktan sonra ayrılan `left` olarak kalır. 30 dk başlamayan lobi kapanır. Rövanş hakkı (son rakipler) da bellektedir.
- Tek süreç; yatay ölçekleme yok (sohbet/olaylar bellek içi abonelikle dağıtılır).
- Kartlar (`MyProfile.cards`) şimdilik sunucuda yalnızca ödül kutusundan `kart` alınınca dolar; istemci senkronu için ayrı bir işlem yok.
- Gerçek mağaza akışında harcama sınırı, ödeme ekranı açılmadan önce istemci tarafından `shop.list` ile kontrol edilmelidir (sözleşmede "satın alma niyeti" işlemi yok).

## 6. Render.com'a dağıtım (ücretsiz web servisi)
> Önerilen üretim kurulumu artık **Oracle Cloud Always Free + DuckDNS + Caddy**: [`docs/18-sunucu-kurulum.md`](18-sunucu-kurulum.md)
> (`tools/sunucu/kur.sh`; kalıcı disk, otomatik yedek, HTTPS, web sürümü aynı adreste). Render aşağıda seçenek olarak duruyor.

1. Depoyu GitHub'a gönder. Render → **New → Blueprint** → depoyu seç; kökteki `render.yaml` okunur (Docker: `apps/server/Dockerfile`, bağlam depo kökü, sağlık yolu `/saglik`).
2. `REVENUECAT_API_KEY` değerini panelden gir (gerçek satın alma doğrulaması için; boş kalırsa gerçek satın alımlar reddedilir). Test dağıtımında web TEST mağazası isteniyorsa `ODI_TEST_STORE=1`.
3. Dağıtım bitince adres `https://odi-sunucu.onrender.com` gibi olur; istemci `wss://odi-sunucu.onrender.com` ile bağlanır. Render `PORT` değişkenini kendisi verir.
4. **Uyarı:** ücretsiz planda disk kalıcı değildir; her dağıtım/yeniden başlatmada sqlite dosyası sıfırlanır (oyuncular yeni hesapla başlar — istemci bunu otomatik yönetir). Ücretsiz servis 15 dk hareketsizlikte uyur; ilk bağlantı ~30-60 sn sürebilir. Kalıcılık için: ücretli plana kalıcı disk ekleyip `ODI_DB`'yi diskin yoluna (ör. `/var/data/odi.sqlite`) ver, ya da ileride Postgres'e geç.

Yerelde Docker ile: `docker build -f apps/server/Dockerfile -t odi-sunucu . && docker run -p 8787:8787 -v odi-veri:/app/data odi-sunucu`.


## Etkinlikler (grup ve bireysel)

Hepsi sunucu yetkilidir; saatler Europe/Istanbul'a göredir; ödüller ödül kutusu ya da takım hediyesi olarak gelir; aynı koşu (runId) iki kez sayılmaz.

| Etkinlik | Takvim | Kısaca |
|---|---|---|
| Ralli | her an (takım günde 6) | Üye mini canavara ralli başlatır, 10 dk içinde en az 2 üye katılıp ralli bölümünü oynar; can sıfırlanırsa katılan herkese ödül, takıma XP, düello puanı |
| Takım Düellosu | Pzt 00:00–Çar 00:00, Per 00:00–Cmt 00:00 | Güce en yakın takımla eşleşme; yıldız, ralli, bayrak puanları; son 2 saat bildirimi; kazanan/berabere/teselli ödülleri |
| Bayrak Yarışı | haftalık | 4 ayaklı parkur, bayrağı al-koş-devret; en iyi ayak süreleri toplamı takım sıralamasına |
| Ses Avı | 3 günlük (Pzt–Per, Cum–Pzt) | Bölüm jetonları ortak melodiye nota olarak sayılır; 8 kademe hediyesi; %100'de takım şarkısı + sandık |
| Kulak Bilgi Yarışması | 13:00 ve 20:00 (lider/yardımcı da başlatabilir) | 10 soru × 15 sn, açıklamalı; takım ortalaması; günlük sıralama |
| Günlük takım görevleri | her gün | 3 ortak görev, her biri tüm üyelere hediye; üçü birden ortak sandık |
| Günün Meydan Okuması | her gün | Herkese aynı bölüm, eşit şartlar, 3 deneme; genel ve arkadaş sıralaması |
| Haftalık Turnuva | haftalık | 5 bölümde en iyi skorlar toplamı; 50 kişilik gruplar |

Test modu: `ODI_EVENTS_FAST=1` → süreler dakikaya iner, dönemler sunucu açılışında başlar, bilgi yarışması her an açılabilir. Uçtan uca test: `node tools/harness/events-e2e.mjs`.


## İletişim (docs/13-iletisim.md)

Takım Akışı (gerçek olaylardan `feed` kartları, 30 dk birleştirme, takım başına saatte 20 kart), sohbet tepkileri (`chat.react`, 5 sabit tepki) ve konular
(`chat.send { replyTo }`, `chat.thread`), Hızlı Sohbet (`kind: 'hazir'`, `QUICK_PHRASES`; özel mesajda da), güvenli sohbet zorunlu (8 bölüm geçilene kadar serbest yazı `SERBEST_KAPALI`, açma seçeneği yok;
`comm.settings { feedShare }`), @bahsetme (`comm.notice`), Yardım İste (`help.tip`, `help.race`,
kalkan = `team.help.give`; isteyen 24 saat içinde geçince bir kez: isteyene 15, yardım edene 20 jeton), takıma meydan oku (`feed.challenge`, sunucudaki en iyi
skor, 48 saat, günde 3), Günün Sorusu (`dq.state`, `dq.answer`, 20:00 açıklama, doğruya 10 jeton; `team.study` Çalışma Grubu), İkili Görev (`duo.*`,
haftalık 300/800 nota), Usta–Çırak (`mentor.*`, dönüm noktaları 5/10/15/20). Tablolar `apps/server/src/comm/schema.ts`; testler `apps/server/test/comm.test.ts`;
uçtan uca `node tools/harness/comm-e2e.mjs [--browsers chromium,webkit] [--target web|dom]`.

## Sıralama (docs/15-siralama.md)

`rank.board { board, scope }`: oyuncu (güç, haftalık yıldız/nota/Günün Sorusu/yarış galibiyeti) ve takım (güç, Bölge Savaşı, Baskın, Bilgi)
tabloları; kapsam herkes (ilk 100) / arkadaşlar / yakınım (±5). Puanlar yalnızca doğrulanmış olaylardan (`rank_level`, `rank_week`, günlük sınırlar
`rank_day`); gün başı sıraları `rank_snap` (▲▼); hafta kapanışı (Pazartesi 00:00 İstanbul) `rank_final` + bir kez ödül `rank_rewards` + takım
sohbetine duyuru. Takıma davet: `dm.send { kind: 'davet', meta: { type: 'takim', roomId: <takım> } }` (yalnız kendi takımına; metni ve kodu sunucu
yazar). Serbest yazısı açılmamış oyuncunun davet metinlerini de sunucu yazar. Testler `apps/server/test/rank.test.ts`.

## Takım rekabeti (docs/16-takim-rekabeti.md)

**Canlı Takım Yarışı** (`trace.*`)
- Lobi bellekte tutulur. Eşleşme takım gücüyle olur ve pencere 20 sn'de bir genişler.
- Dostluk daveti 10 dk geçerlidir.
- Yarış odası `race.ts`'teki takım odasıdır (`createTeamRaceRoom`). Bağlantı koparsa `teamRaceGraceMs` beklenir; varsayılan 20 sn, testte kısa.
- Sonuç bir kez yazılır (`tr_match`, yıldızlar `tr_star`).

**Takım Ligi** (`tlig.state`)
- 2 haftalık sezon; tablolar `tl_*`.
- Puan sunucu kayıtlarından hesaplanır.
- Sezon kapanışı ve ödül bir kez işlenir.

Birim testleri: `apps/server/test/teamrace.test.ts`.

## Yedek

`ODI_BACKUP_DIR` verilirse sunucu açılışta ve her `ODI_BACKUP_HOURS` saatte bir `VACUUM INTO` ile tutarlı bir kopya yazar
(`odi-yedek-YYYYMMDD-HHMMSS.sqlite`, WAL açıkken de güvenli), en yeni `ODI_BACKUP_KEEP` dosyayı tutar.
Son yedek 15 dakikadan yeniyse açılış yedeği atlanır: sunucu art arda yeniden başlarsa (çökme döngüsü) eski yedekler
kısa sürede silinmesin. (Oracle kurulumunda `odi-guncelle` sürüm geçişinden hemen önce ayrıca anlık bir yedek alır.)
- Yedek klasörü kalıcı diskte olmalı (Render: ücretli plan + disk, ör. `ODI_DB=/var/data/odi.sqlite`, `ODI_BACKUP_DIR=/var/data/yedek`).
- Aynı diskteki kopya bozulmaya ve hatalı sürüme karşı korur, diskin kaybına karşı korumaz: makine dışı kopya (ör. haftalık
  indirme ya da nesne depolama) sahibin kararıdır.
- Oracle kurulumunda: `sudo odi-yedek-geri` (listeler, denetler, güvenli geri yükler; bkz. [`docs/18-sunucu-kurulum.md`](18-sunucu-kurulum.md)).
- Geri yükleme (elle): sunucuyu durdur → `ODI_DB` dosyasını ve yanındaki `-wal`/`-shm` dosyalarını kenara al → yedeği `ODI_DB` adıyla
  kopyala → sunucuyu başlat. Şema yalnızca `CREATE TABLE IF NOT EXISTS` ile ilerlediği için eski yedek yeni sürümde açılır.

## Şema sürümü ve göçler

Tablolar her açılışta `CREATE TABLE IF NOT EXISTS` ile kurulur (yeni tablo eklemek için bu yeterli). **Var olan tabloya sütun
eklemek ya da veriyi dönüştürmek** için `apps/server/src/migrations.ts` içindeki `MIGRATIONS` listesinin **sonuna** bir göç eklenir:

```ts
{ name: 'oyuncu-dil', up: (db) => addColumn(db, 'players', 'lang', "TEXT NOT NULL DEFAULT 'tr'") },
```

- `PRAGMA user_version` uygulanan göç sayısıdır; açılışta bekleyen göçler sırayla, her biri kendi işleminde uygulanır.
- Bir göç hata verirse geri alınır, sürüm ilerlemez ve sunucu açılmaz (yarım şemayla çalışmaz). Hata iletisinde göçün numarası ve adı yazar.
- Var olan göçü değiştirmeyin, silmeyin; her göç tekrar çalışsa da güvenli olsun (`addColumn` sütun varsa dokunmaz).
- Veritabanı koddan yeniyse (sürüm geri alındıysa) göç yapılmaz, yalnız uyarı yazılır: eklenen sütunlar varsayılan değerli olduğu için eski kod çalışır.
- Göç eklemeden önce yedek alın (`ODI_BACKUP_DIR`, açılışta otomatik). Test: `apps/server/test/migrations.test.ts`.
- Örnek (yeni tablo, göçsüz): inşaat sırası `camp_queue` (`camp-schema.ts`, `CREATE TABLE IF NOT EXISTS`); var olan tabloya
  dokunmadığı için `MIGRATIONS` değişmedi. Eski sunucuya geri dönülürse tablo yok sayılır; sıradaki inşaatın bedeli o tabloda
  kalır; sunucu yeniden güncellenince sıra boştaki inşaatçıyla başlar (seviye bu arada değiştiyse bedel geri verilir).

## Hesabı silme (`account.delete`)

Profil › Ayarlar › **Hesabı sil** (eski adı "Her şeyi sıfırla"), cihazı silmeden önce sunucudaki hesabı siler (KVKK m.7 / GDPR m.17
silme hakkı; App Store 5.1.1(v)). Oyuncuya anlatılan hâli: `/hesap-sil` ve `/gizlilik` §7 (`apps/web/src/yasal/metin.ts`).
Bağlantı yoksa istemci en çok 6 sn bekler; olmazsa yalnızca cihaz silinir (onay sayfası bunu açıkça söyler).
- Hangi tablonun **silindiği**, **anonimleştiği** (yalnız başkasının verisi bozulmasın diye: takım toplamını oluşturan düello puanı,
  takım yarışı yıldızı, ralli katılımı, takım kliniği; geçen haftanın son sıralaması) ya da **gerekçeyle tutulduğu** (makbuz, şikâyet
  90 gün, kod denemeleri 90 gün, `deleted_players`) tek tabloda yazılıdır: `apps/server/src/account-veri.ts` (`VERI_SINIFI`).
  Silme tek işlemde: önce ad anonimleşir, takımdan çıkar (lider ise liderlik devreder; son üyeyse takım silme yolu takıma bağlı
  bütün satırları — `ev_*` dahil — aynı tabloya göre siler), arkadaşlara `friend.removed`, sonra sınıflandırma uygulanır.
  Sistem iletilerinde, başkalarının ödül kutusu notlarında ve takım hediyesinde geçen ad "Silinmiş Oyuncu" olur.
- Yeni tablo ya da kimlik/ad sütunu (`*_id`, `*_by`, `a`/`b`, `*name` …) ekleyen `VERI_SINIFI`'na karar yazmak zorundadır:
  `apps/server/test/account.test.ts` şemayı `sqlite_master`'dan okur ve eksik kararla düşer.
- Oyuncu satırı kalır (anonim kayıtlar bu kimliğe bağlı) ama ad `Silinmiş Oyuncu` olur, oturum anahtarı özeti hiçbir anahtarla
  eşleşmeyecek biçimde değişir, arkadaş kodu yenilenir, ilerleme/cüzdan/kozmetik sıfırlanır; hesap `deleted_players`'a yazılır.
  Kamp şemasının açılıştaki tohumları (`buildings`) silinen hesapları atlar.
- Göç 2 (`silinmis-hesap-artiklari`): bu sınıflandırmadan önce silinmiş hesapların (`deleted_players`) ve silinmiş takımların artık
  satırlarını bir kez temizler.
- Silinmiş hesaplar yönetici hesaplarıyla aynı yoldan (`ADMIN_IDS_SQL`) rekabet tablolarından ve ödüllerden çıkarılır; arama ve
  öneri listelerinde görünmez. Geri alınamaz.
- Saklama bakımı (saatlik): sohbet 30 gün (`pruneChat`), bölüm gönderim kayıtları 30 gün (`pruneRuns`), kod denemeleri 90 gün
  (`prunePromoLog`), şikâyetler 90 gün (`pruneReports`), satın alma kayıtları işlem yılının sonundan 10 yıl (`prunePurchases`),
  hesap açma sınırının bellekteki IP kayıtları (`pruneNewAccountIps`). Süreler gizlilik metniyle aynıdır (`apps/web/src/legal.test.ts`).

## Hesap ve şikâyet (işletmen araçları)

Sunucu makinesinde, ağdan erişilemeyen komutlar: geliştirmede `npm run kod -- …`; Oracle kurulumunda
`sudo -u odi env ODI_DB=/var/lib/odi/odi.sqlite node /opt/odi/guncel/sunucu/kod.mjs …` (docs/18-sunucu-kurulum.md "Kodlar" ile aynı).
Kod: `apps/server/src/yonetim.ts`, test `apps/server/test/yonetim.test.ts`.

- `hesap ARKADAŞ-KODU`: ad, açılış ve son bağlantı, takım, son 90 günde şikâyet eden kişi sayısı, susturma.
- `hesap-sil ARKADAŞ-KODU --onay`: uygulama dışından (e-postayla, `/hesap-sil` sayfası) gelen silme isteği. Hesaplarda e-posta ya
  da şifre olmadığından, başkası birinin adına silme isteyemesin diye yalnız **son 14 gün bağlanmamış** hesap silinir
  (`HESAP_SIL_BEKLEME_GUN`); silme `account.delete` ile aynı işlemdir. `--zorla` bekleme şartını kaldırır: yalnız yasal
  zorunlulukta ya da hesabın sahibi başka yoldan kanıtlandığında. İsteğe 30 gün içinde yanıt verilir (KVKK m.13).
- `sikayetler [--gun 7]`: şikâyet edilen oyuncular (farklı şikâyetçi sayısı, nedenler, gizlenen iletiler). App Store 1.2 gereği
  şikâyetler düzenli (öneri: her gün) gözden geçirilir.
- `sustur ARKADAŞ-KODU --gun N`: sohbet ve özel mesajı N gün kapatır (`--gun 0` kaldırır). Oyuncu "N gün mesaj gönderemezsin" görür.

## Kodlar (Kod Gir)

Profil › **Kod gir** ve Ayarlar › **Kod gir**: oyuncu bir kod yazar, sunucu doğrular (`code.redeem`). İstemci kodu boşluksuz ve Türkçe güvenli büyük
harfe çevirir (i/ı/İ → I); geçerli biçim A–Z, 0–9, Ç Ğ Ö Ş Ü ve tire, 3–32 karakter.

**Ödül kodları** (`promo_codes`, kullanım `promo_uses`, her deneme `promo_log`):
- Her oyuncu bir kodu **bir kez** kullanır (`promo_uses` birincil anahtarı). Toplam kullanım sınırı koşullu artışla korunur, aynı anda iki istek sınırı aşamaz.
- Başlangıç ve bitiş tarihi isteğe bağlıdır; kod kapatılabilir.
- Ödüller mevcut yollardan gelir: jeton, kristal, kalkan ve kozmetik ödül kutusuna, hızlandırıcılar sunucu cüzdanına.
- Hata yanıtları dürüsttür: "Kod geçersiz.", "Bu kodu zaten kullandın.", "Bu kodun süresi dolmuş.", "Bu kodun kullanım hakkı doldu.",
  "Bu kod henüz geçerli değil.". Bunlar istek hatası değil sonuç olarak döner, böylece deneme kaydı geri alınmaz.
- Yanlış deneme sınırı: oyuncu başına 10 dakikada 5, aynı IP için 20 (`CODE_RULES`). Ayrıca sunucu genelinde 10 dakikada en çok 60 bilinmeyen kod yönetici özetiyle sınanır (`ADMIN_CHECKS_PER_WINDOW`): yeni hesap açmak ya da IP değiştirmek kaba kuvveti hızlandırmaz, pahalı scrypt hesabı sunucuyu meşgul edemez. Bütçe dolunca ödül kodları çalışmaya devam eder (önce ödül kodu tablosuna bakılır, scrypt'e girilmez).
- Kayıt: bilinmeyen kodun metni yazılmaz.

**Komut satırı** (sunucu makinesinde; veritabanı `ODI_DB`, yoksa `apps/server/data/odi.sqlite`):

```
npm run kod -- ekle ODIYAKINDA --jeton 500 --kristal 20 --max 1000 --bitis 2026-12-31 --not "Yakında!"
npm run kod -- ekle KAMPCI --kalkan 1 --m5 2 --kozmetik sapka-kasif --baslangic 2026-11-01
npm run kod -- liste
npm run kod -- kapat ODIYAKINDA      # ya da: ac ODIYAKINDA
```

Tarihler İstanbul saatine göredir ve bitiş günü dahildir. **Uygulama içi panel** de aynı işlemleri yapar (`code.create`, `code.list`, `code.close`):
Ayarlar › Kod gir › Kod paneli. Panel yalnızca yönetici modu açıkken çalışır.

**Yönetici kodu.** Doğru girilince hesap sunucuda **yönetici** olarak işaretlenir (`player_flags.admin`, kalıcı) ve yönetici modu açılır (`admin_on`).

Yönetici modunda:
- Tüm bölümler oynanabilir ve FTUE ile açılan tüm yerler açılır. Sunucu da modu tanır: bölüm sınırı ve serbest yazı açıktır.
- Gerçek ilerleme (`highest`) ileri atlamaz ve yıldızlar sahte değildir.

Ayarlar'da "Yönetici modu açık" rozeti ve bir anahtar vardır (`admin.set`):
- Anahtar kapatılınca bölümler gerçek ilerlemeye göre yeniden kilitlenir.
- Yeniden açmak kod gerektirmez.

Mod yerelde tutulur, çevrimdışı da sürer; bağlanınca sunucunun durumu esas alınır. Sıfırla yerel durumu siler.

Yönetici hesabı **adil rekabetten çıkarılır**:
- Sıralama tablolarına girmez: oyuncu tablolarında görünmez, takım gücüne, baskın ve bilgi toplamlarına sayılmaz.
- Savaş, baskın ve oyuncu ligi puanı kazanmaz; takıma katkısı yoktur.
- Haftalık sıralama ödülü ve Takım Ligi sezon ödülü almaz.
- Takım Yarışı ödülü almaz. Katıldığı takım yarışı lige sayılmaz.

Testlerde gerçek kod kullanılmaz; sunucu, test kodunun özetiyle kurulur (`apps/server/test/codes.test.ts`, `tools/harness/codes-e2e.mjs`).

## Rozetler: Kurucu Yolcu ve Hata Avcısı (YN-041)

Kapalı beta kurucuları oyunda kalıcı olarak anılır. **Yalnız görünüş:** güç, ekonomi, ödül kutusu ya da sıralama etkisi yok.
**Kişisel veri istenmez** (yalnız takma ad). Kod: `apps/server/src/rozet.ts`, `codes.ts` (`createRozetCodes`, `rozetVer`); test
`apps/server/test/rozet.test.ts`; istemci `apps/web/src/kurucu/`.

- **Tablo** `player_badges(player_id, badge, at, listede, cerceve)` (göç 5). Birincil anahtar oyuncu + rozet: aynı hesap aynı rozeti
  iki kez alamaz. Hesap silinince satır silinir (`account-veri.ts` "sil"); rozet ve Kurucular listesindeki yer birlikte gider.
- **Rozetler** (`ROZET_IDS`, `packages/shared/src/social.ts`): `kurucu` (Kurucu Yolcu rozeti + profil çerçevesi), `hata-avcisi`
  (Hata Avcısı görünüş unvanı). Profilde, profil kartında ve takım üye listelerinde görünür (`PublicProfile.rozetler`, `cerceve`;
  rozeti olmayanın profilinde alan hiç yok).
- **Seçimler** (`profile.update` `listede`, `cerceve`; yalnız rozeti olan): "Adım listede görünsün" (varsayılan **kapalı**;
  Ayarlar ya da Profil › Kurucular), çerçeve (Dolap › Çerçeveler; kod kullanılınca giyili gelir, çıkarılabilir).
- **Kurucular ekranı** (`kurucu.liste`): yalnız `listede = 1` olanların takma adı, kodu kullanma sırasıyla; listede olmayanlar yalnız
  sayı olarak ("N kurucu adını listede göstermemeyi seçti"). Yönetici ve silinmiş hesaplar listede de sayıda da yok.
- **Yönetici hesapları kurucu sayılmaz:** kurucu kodu yönetici hesabında işlemez (kod harcanmaz). Rozeti zaten olan hesap ikinci bir
  kurucu kodunu kullanamaz; kod harcanmaz, başkasına verilebilir (`promo_log` sonucu `rozet-var`).

**Kod üretme ve dağıtma (sunucu makinesinde, sahip):**

```
sudo systemctl stop odi    # yazma işlemi: önce servisi durdur (docs/18-sunucu-kurulum.md "Elle işlemler")
sudo -u odi env ODI_DB=/var/lib/odi/odi.sqlite node /opt/odi/guncel/sunucu/kod.mjs kurucu --adet 50
sudo systemctl start odi
# geliştirme kopyasında: npm run kod -- kurucu --adet 50
```

- Her satır bir kod: `KURUCU-XXXX-XXXX` (karışan harfler I, O, 0, 1, L yok; `CODE_PATTERN`'e uyar), her biri **tek kullanımlık**
  (`max_uses 1`). Kodlar **yalnız terminale** yazılır; dosyaya, depoya, sohbete ya da ekran görüntüsüne konmaz. Uygulama içi kod
  paneli rozet kodlarının metnini göstermez (`KURUCU-••••-••••`; yalnız kullanım sayısı).
- Kodları kurucuya **tek tek, kişiye özel** verin (ör. özel mesajla). Kurucu, oyunda Profil › Kod gir'e yazar.
- Kurucu sayısı parametredir: `--adet N` (1–500). Gerekirse sonradan yeniden üretilir; kullanılmayan kod `kapat KOD` ile kapatılır.
- `npm run kod -- kurucular`: kaç kurucu var, kaçı listede görünmeyi seçti (ad yazılmaz).

**Hata Avcısı unvanı:**

```
npm run kod -- unvan ARKADAŞ-KODU hata-avcisi           # ver (oyuncunun Profil'deki arkadaş kodu)
npm run kod -- unvan ARKADAŞ-KODU hata-avcisi --kaldir  # geri al
npm run kod -- avci --adet 5                            # ya da tek kullanımlık AVCI-XXXX-XXXX kodları
```

Doğrudan verme ve geri alma yönetim kaydına yazılır (`promo_log`: ip `cli`, sonuç `rozet:hata-avcisi`; 90 gün).

**"Öneren" teşekkürü** (bilgi yarışması sorusu ve Kulak Kartı, `packages/content` `oneren`): oyunda "Öneren: <takma ad>" görünür.
Kural: depoya **yalnız oyuncunun açıkça izin verdiği takma ad** yazılır (gerçek ad, e-posta, hesap kimliği asla); izin kaydını
**sahip** tutar, depoya konmaz. Ayrıntı: `docs/yonetim/gizlilik.md` "Öneren".

