# 18 · Sunucu kurulumu: Oracle Always Free + DuckDNS + Caddy

ODİ'nin sosyal sunucusu ve web sürümü tek bir Oracle Cloud "Always Free" sanal sunucusunda çalışır (Ubuntu 24.04, ARM,
2 OCPU / 12 GB). Adres DuckDNS'ten ücretsiz bir alt alan adıdır; HTTPS sertifikasını Caddy, Let's Encrypt'ten kendisi alır
ve yeniler. Kurulumu tek bir betik yapar: `tools/sunucu/kur.sh`.

Onaylı plan (hesap, sunucu, DuckDNS, port adımları): [ODİ Sunucu Planı](https://claude.ai/artifact/5iDRnp4HPDQtEAjkLVbhfr).
Kurulumdan sonraki denetimler: [`docs/yonetim/sunucu-dogrulama.md`](yonetim/sunucu-dogrulama.md). Sunucunun kendisi
(ortam değişkenleri, yedek, kodlar): [`docs/10-sunucu.md`](10-sunucu.md).

```
İnternet ──443/80──▶ Caddy (HTTPS, Let's Encrypt)
                       ├─ WebSocket yükseltmesi (her yol) ─▶ 127.0.0.1:8787  oyun sunucusu (odi.service, kullanıcı: odi)
                       ├─ /saglik, /olcum ───────────────▶ 127.0.0.1:8787
                       └─ diğer her şey ─────────────────▶ /opt/odi/guncel/web  (web sürümü, durağan dosyalar)
```

Oyun sunucusu yalnız `127.0.0.1:8787`'yi dinler (`HOST=127.0.0.1`); dışarıya yalnız 22 (SSH), 80 ve 443 açıktır.

## 1. Kurulum (sahip yapar)

Ön koşullar (plan, Adım 1–4): Oracle hesabı ve sunucu (Public IP not edildi), DuckDNS adı ve token'ı, Oracle Security
List'te 80 ve 443 TCP girişleri açık, yeni yönetici kodu belirlenmiş.

Sunucuya bağlanın ve kurun:

```bash
ssh -i ~/.ssh/odi_oracle ubuntu@SUNUCU_IP
git clone https://github.com/aihearX/Oyun.git && sudo bash Oyun/tools/sunucu/kur.sh
```

Betik başta üç şey sorar, sonra kendi başına ilerler (yaklaşık 10–15 dakika):

| Soru | Not |
|---|---|
| DuckDNS adı | Yalnız ad: `ornek-ad` (sonundaki `.duckdns.org` yazılsa da olur) |
| DuckDNS token'ı | duckdns.org sayfasının üstündeki `token`. Ekranda görünmez |
| Yönetici kodu | Ekranda görünmez, iki kez sorulur. **16–32 karakter; yalnız harf, rakam ve tire.** Boşluklar yok sayılır, büyük/küçük harf fark etmez, Türkçe harfler (Ç Ğ İ Ö Ş Ü) olur. Oyundaki "Kod gir" yalnız bu biçimi kabul ettiği için betik başka biçimi reddeder |

Sonunda ekrana şu satır gelir:

```
Hazır: wss://ornek-ad.duckdns.org
Web sürümü: https://ornek-ad.duckdns.org
```

"Hazır" gelmezse betik nedenini Türkçe yazar (aşağıda "Sorun giderme"). Sorunu düzeltip **aynı komutu yeniden
çalıştırmak güvenlidir**: yapılmış adımlar atlanır, kayıtlı cevaplar (DuckDNS adı, token, yönetici kodu) yeniden sorulmaz.
Kayıtlı DuckDNS adını/token'ı değiştirmek için: `sudo bash Oyun/tools/sunucu/kur.sh --yeniden-sor`.

Kurulumun tamamı `/var/log/odi-kur.log` dosyasına da yazılır (0600, yalnız root). Kod ve token hiçbir zaman ekrana
yazılmadığı için günlükte de yoktur.

## 2. Betik ne yapar

| # | Adım | Ayrıntı |
|---|---|---|
| 1 | DuckDNS | `/etc/odi/kurulum.conf` (ad, dal), token `/etc/odi/duckdns.token` (0600 root). Adres hemen bu sunucunun IP'sine güncellenir; ad/token yanlışsa betik burada durur |
| 2 | Sistem | `apt update` + `upgrade`; git, curl, gnupg, openssl, `unattended-upgrades` (güvenlik güncellemeleri otomatik), `iptables-persistent` |
| 3 | Node.js | NodeSource deposundan Node 22 LTS (ARM64); en az 22.13 olduğu denetlenir (`node:sqlite` için) |
| 4 | Kullanıcı | `odi` sistem kullanıcısı (giriş kabuğu yok); `/opt/odi`, `/var/lib/odi` |
| 5 | Derleme | `/opt/odi/kaynak` ← git (main). `npm ci` yalnız sunucu ve web için, paket betikleri kapalı (`--ignore-scripts`); `build:server` + `build:web`. Çıktı yeni bir sürüm klasörüne kopyalanır, geçici bir örnekle **açılış denetimi** yapılır, sonra `/opt/odi/guncel` bu sürüme bağlanır |
| 6 | Ayarlar | `/etc/odi/odi.env`: üretim ayarları + yönetici kodunun **tuzlu özeti** (`kod.mjs ozet`, kod standart girdiden) |
| 7 | Servis | `odi.service` (systemd): `User=odi`, `Restart=always`, sertleştirme (`NoNewPrivileges`, `ProtectSystem=strict` + yalnız `/var/lib/odi` yazılabilir, `PrivateTmp`, …). journald: en çok 1 GB / 30 gün |
| 8 | Güvenlik duvarı | Oracle görüntüsünün `/etc/iptables/rules.v4` kuralları 22 dışını REJECT eder: 80 ve 443 için ACCEPT, REJECT'in önüne eklenir ve `netfilter-persistent save` ile kalıcı olur. SSH kuralına dokunulmaz. (ufw açıksa ufw'ye de eklenir) |
| 9 | Caddy | Resmi apt deposundan; `/etc/caddy/Caddyfile` (aşağıda). Sertifika yalnız Let's Encrypt'ten |
| 10 | Zamanlayıcı, komutlar | `odi-duckdns.timer` (5 dakikada bir; güncelleyici yetkisiz root olarak, salt okunur dosya sistemiyle çalışır ve yalnız token dosyasını okur); `/usr/local/bin`'e dört yardımcı komut |
| — | Son denetim | `https://<ad>.duckdns.org/saglik` 200 dönene kadar bekler (en çok 4 dk), sonra "Hazır" |

Son denetim adresi `127.0.0.1`'e yönlendirerek yapılır (`curl --resolve`): makinenin kendi genel IP'sine içeriden ulaşmak
her ağda çalışmaz. Sertifika gerçek Let's Encrypt sertifikası olarak doğrulanır; sertifikanın alınmış olması Let's
Encrypt'in sunucuya dışarıdan 80/443'ten ulaştığını gösterir. Dışarıdan son kontrol: telefonda `https://<ad>.duckdns.org`.

### Caddy yönlendirmesi ve önbellek
- **WebSocket**: `Connection: Upgrade` + `Upgrade: websocket` başlıklı her istek oyun sunucusuna gider. Oyun kök adrese
  bağlanır (`wss://<ad>.duckdns.org`), web sayfası da kök adreste olduğundan ayrım yolla değil başlıkla yapılır.
- `/saglik`, `/olcum` → oyun sunucusu.
- `/assets/*` (Vite'ın parmak izli dosyaları): `Cache-Control: public, max-age=31536000, immutable`.
- Diğer her şey (`index.html`, `voice/*.mp3`, `manifest.webmanifest`, …): `Cache-Control: no-cache` (her açılışta
  doğrulanır, değişmediyse 304). Bilinmeyen yollar `index.html`'e düşer (tek sayfa uygulama).
- Güncellemeden sonra açık kalan eski oturumlar eski parçaları isteyebilir: yeni sürüm, önceki sürümün `/assets`
  dosyalarını da içerir.
- HTTP/3 kapalıdır (yalnız TCP 443 açık olduğu için).

### Web sürümü sunucuyu nasıl bulur
`apps/web/src/platform.ts`: sayfa varsayılan portta (80/443) açıldıysa WebSocket **aynı adrese** bağlanır
(`https://ad.duckdns.org` → `wss://ad.duckdns.org`). Bu yüzden web derlemesine adres gömülmez; alan adı değişse de yeniden
derleme gerekmez. Öncelik sırası: `?sunucu=` → derleme anı `VITE_ODI_SERVER` → aynı köken (varsayılan port) → geliştirme
(`ws://<makine>:8787`, ör. vite `:5173`).

## 3. Dosya yerleri

| Yer | Ne | İzin |
|---|---|---|
| `/opt/odi/kaynak` | git klonu, derleme burada | `odi` |
| `/opt/odi/surumler/<tarih>-<commit>/` | derlenmiş sürümler (`sunucu/server.mjs`, `sunucu/kod.mjs`, `web/`, `SURUM`); son 3'ü tutulur | root, salt okunur |
| `/opt/odi/guncel` | çalışan sürüme bağlantı | root |
| `/var/lib/odi/odi.sqlite` | veritabanı (`-wal`, `-shm` ile) | `odi`, 0750 klasör |
| `/var/lib/odi/yedek/` | otomatik yedekler: açılışta ve 6 saatte bir, son 28 | `odi` |
| `/etc/odi/odi.env` | servis ayarları + yönetici kodu özeti | **0600 root:root** |
| `/etc/odi/kurulum.conf` | DuckDNS adı, dal, kaynak adresi (gizli değil) | 0644 |
| `/etc/odi/duckdns.token` | DuckDNS token'ı | 0600 root:root |
| `/etc/caddy/Caddyfile` | Caddy ayarı (kur.sh yazar) | 0644 |
| `/etc/systemd/system/odi.service`, `odi-duckdns.{service,timer}` | servisler | 0644 |
| `/usr/local/bin/odi-*`, `/usr/local/lib/odi/` | yardımcı komutlar, ortak betik, DuckDNS güncelleyici | 0755 |
| `/var/log/odi-kur.log` | kurulum günlüğü | 0600 root |

**`odi.env` neden 0600 root:root:** systemd `EnvironmentFile`'ı servis başlamadan önce root olarak okur ve değerleri
servise ortam değişkeni olarak verir; `odi` kullanıcısının dosyayı okuyabilmesi gerekmez. En kısıtlı seçenek budur
(`0640 root:odi`'ye göre, sunucu sürecinde bir açık olsa bile dosya okunamaz). Ortam değişkenleri yine sürecin kendisinde
vardır; özet zaten tuzludur ve kodun kendisi hiçbir yerde tutulmaz.

`odi.env`'e elle eklenen satırlar (ör. `REVENUECAT_API_KEY=…`) kur.sh yeniden çalışınca korunur. Elle değiştirdikten
sonra: `sudo systemctl restart odi`.

## 4. Günlük işletim

### Durum: `sudo odi-durum`
Servisler (odi, caddy, DuckDNS zamanlayıcısı), açılış zamanı ve yeniden başlama sayısı, sağlık yanıtı, çalışan sürüm,
üretim ayarları (test bayrakları varsa uyarır), açık kalma süresi, yük, bellek, disk, veritabanı boyutu, **son yedek ve
yaşı** (6 saatten eskiyse uyarır), DNS, son DuckDNS güncellemesi, **sertifikanın bitişi ve kalan gün**, dinlenen portlar ve
son 50 günlük satırı. `--kisa`: günlük satırları olmadan.

### Güncelleme: `sudo odi-guncelle`
1. `/opt/odi/kaynak`'ta GitHub'daki son `main`'i çeker (`--dal DAL` ile başka dal; deneme için).
2. `package-lock.json` değiştiyse bağımlılıkları yeniden kurar.
3. Derler (sunucu + web).
4. Sunucu birim testlerini çalıştırır (`apps/server/test`, 2 OCPU'da birkaç dakika). Küçük makinede zamanlamaya bağlı
   testler yavaşlayabileceği için süre sınırları geniştir (30 sn), iki işçi kullanılır ve düşen test bir kez daha denenir;
   gerçek bir hata iki denemede de düşer. `--hizli`: testleri atlar (acil durum).
5. Yeni sürümü geçici bir örnekte, **son yedeğin bir kopyasıyla** açar (şema göçleri gerçek veride denenir; üretim
   veritabanına ve 8787'ye dokunulmaz).
6. Hepsi geçerse çalışan veritabanının anlık bir yedeğini alır (`VACUUM INTO`, aynı yedek klasörü), `/opt/odi/guncel`'i yeni
   sürüme bağlar ve servisi yeniden başlatır (oyuncular kısa bir "yeniden
   bağlanılıyor" görür). Yeni sürüm 60 sn içinde sağlıklı açılmazsa **önceki sürüme kendiliğinden döner**.

**2–5'ten biri düşerse servis yeniden başlatılmaz**; komut "Yeniden başlatılmadı: çalışan sürüm (…) değişmeden devam
ediyor" yazar ve 1 ile çıkar. Aynı commit zaten çalışıyorsa hiçbir şey yapmaz (`--yeniden` ile zorlanır).
Kurulum betiğinin kendisi değiştiyse (Caddy/systemd ayarı) bunu söyler; uygulamak için `sudo bash /opt/odi/kaynak/tools/sunucu/kur.sh`.

### Yedekten geri yükleme: `sudo odi-yedek-geri`
Yedekleri listeler (en yeni üstte), numara sorar, yedeğin bütünlüğünü denetler (`PRAGMA integrity_check`, oyuncu sayısı),
onay ister; sonra servisi durdurur, mevcut veritabanını `/var/lib/odi/geri-alma-oncesi-<tarih>/` altına kenara alır,
yedeği yerine koyar ve servisi başlatır. Servis yedekle açılmazsa eski veritabanını geri koyar.

- `sudo odi-yedek-geri 2` → listedeki 2. yedek; `--evet` onay sormaz.
- **Prova (servise dokunmadan):** `sudo odi-yedek-geri 1 --klasore /root/prova` → yedeği o klasöre kopyalar ve denetler.

### Yönetici kodunu değiştirmek: `sudo odi-kod-degistir`
Yeni kodu gizli girişle iki kez sorar, kodun biçimini denetler, yalnız tuzlu özetini `odi.env`'e yazar ve servisi yeniden
başlatır. Eski kod hemen geçersiz olur. `--kapat`: yönetici kodunu kapatır (özet silinir).

### Elle işlemler
- Servis: `sudo systemctl restart|stop|start odi` · günlük: `sudo journalctl -u odi -f`
- Caddy: `sudo systemctl reload caddy` · günlük: `sudo journalctl -u caddy -n 100`
- DuckDNS'i hemen güncelle: `sudo systemctl start odi-duckdns` · sonuç: `sudo journalctl -u odi-duckdns -n 5`
- Kodlar (Kod Gir): `sudo -u odi env ODI_DB=/var/lib/odi/odi.sqlite node /opt/odi/guncel/sunucu/kod.mjs liste`
  (yazma işlemleri için önce `sudo systemctl stop odi`; bkz. docs/10-sunucu.md "Kodlar")

## 5. Uygulamayı sunucuya bağlamak

| Yol | Nasıl |
|---|---|
| Web | `https://<ad>.duckdns.org` (aynı kökenden bağlanır, ayar gerekmez) |
| Expo Go | `npm run oyna -- --tunnel --sunucu wss://<ad>.duckdns.org` (yerel sunucu açılmaz; `EXPO_PUBLIC_ODI_SERVER` verilir; adres değişince Expo önbelleği kendiliğinden temizlenir). Tarayıcıda: `npm run oyna -- --web --sunucu wss://…` |
| EAS (APK / mağaza) | `apps/mobile/eas.json` → `preview` ve `production` profillerinde `env.EXPO_PUBLIC_ODI_SERVER`. Şimdilik bilerek geçersiz yer tutucu: `wss://SUNUCU-ADRESI-YAZILACAK.invalid`. Sunucu "Hazır" deyince gerçek adresle değiştirilir |

### iPhone'da ana ekrana ekleme

iPhone oyuncuları betaya web sürümüyle girer. Oyunculara gönderilecek metin (`<ad>` yerine sunucu adını yazın):

> **ODİ'yi iPhone'una kur (1 dakika):**
> 1. iPhone'da **Safari** ile `https://<ad>.duckdns.org` adresini aç (Chrome ya da başka bir tarayıcıyla olmaz).
> 2. Alttaki **Paylaş** düğmesine (yukarı ok çıkan kare) dokun, listeyi kaydırıp **Ana Ekrana Ekle**'yi seç.
> 3. Sağ üstte **Ekle**'ye dokun. Artık ODİ ana ekranında: oradan aç. İnternet yokken de açılır ve oynanır
>    (arkadaşlar, takım ve sohbet için bağlantı gerekir).

Android'de Chrome adres çubuğunda ya da menüde **Uygulamayı yükle** önerir; aynı adres yeterlidir.

Nasıl çalışır (MK-037): `apps/web/public/manifest.webmanifest` (simgeler, koyu açılış zemini `#140c35`), `index.html`
(`apple-touch-icon`, saydam durum çubuğu, ana ekran adı "ODİ") ve derlemede yazılan `sw.js` service worker'ı
(kalıbı `apps/web/sw/sw.js`, kaydı `apps/web/src/sw-kayit.ts`). Service worker oyunun kabuğunu (index.html, `/assets/*`,
simgeler) ilk açılışta önbelleğe alır, anlatıcı kayıtlarını (`voice/*.mp3`) çalındıkça ekler; WebSocket, `/saglik` ve
`/olcum`'a dokunmaz. `odi-guncelle`den sonra: açılışta önce sunucudaki `index.html` istenir (5 sn'de gelmezse önbellekteki),
yani oyuncu uygulamayı yeniden açtığında yeni sürümü görür; açık oyun ortasında sayfa yenilenmez, yeni service worker
bir sonraki açılışta etkinleşip eski önbelleği siler. `sw.js` Caddy'de `no-cache` ile sunulur (yukarıdaki "her şey" kuralı).
Simgeleri yenilemek: `node tools/ikon-uret.mjs` (kaynak `tools/ikon/kavramlar.mjs`, seçilen kavram A · Odi, YN-010) →
`apps/web/public/icons/*.png`, `favicon.svg`, mobil ikon/açılış görselleri ve mağaza görselleri. Test: `node tools/harness/pwa-e2e.mjs` (Chromium + WebKit).

## 6. Sorun giderme

kur.sh "Hazır" diyemezse olası nedenleri sırayla yazar:

| İleti | Ne yapılmalı |
|---|---|
| DuckDNS güncellenemedi (KO) | duckdns.org'da adın sizin hesabınızda olduğunu, token'ı doğru kopyaladığınızı kontrol edin; `--yeniden-sor` ile yeniden çalıştırın |
| DNS bu sunucuyu göstermiyor (`ad → X`, bu sunucu → `Y`) | Birkaç dakika bekleyin ya da duckdns.org'da "current ip"yi düzeltin |
| Let's Encrypt sunucuya dışarıdan ulaşamadı | **En sık neden:** Oracle konsolunda Security List'e 80 ve 443 TCP (0.0.0.0/0) giriş kuralı eklenmemiş (plan Adım 3) |
| Let's Encrypt deneme sınırı | Bir saat bekleyip yeniden çalıştırın |
| Oyun sunucusu çalışmıyor / Caddy çalışmıyor | `sudo journalctl -u odi -n 50` / `sudo journalctl -u caddy -n 50` |

Caddy sertifikayı arka planda denemeyi sürdürür: Security List sonradan açılırsa birkaç dakika içinde kendiliğinden
düzelir; `sudo odi-durum` sertifikayı gösterir.

## 7. Oracle'ın boşta sunucu kuralı (önemli)

Oracle, 7 gün boyunca işlemci, ağ ve bellek kullanımı düşük kalan **Always Free** sunucuları "boşta" sayıp durdurabilir.
Beta başında oyuncu az olacağı için bu gerçek bir risktir. Önerilen çözüm:

1. Oracle konsolu › **Billing & Cost Management › Upgrade and Manage Payments** › hesabı **Pay As You Go**'ya yükseltin.
   Always Free kaynaklar ücretsiz kalır; boşta durdurma Pay As You Go hesaplarına uygulanmaz.
2. **Billing › Budgets › Create Budget**: aylık **1 $** bütçe, %1 (ya da ilk kuruş) aşımda e-posta uyarısı. Ücretli bir
   kaynak yanlışlıkla açılırsa hemen haber verir.
3. Sahte yük üreten betik kullanmıyoruz.

## 8. Geliştirici notları

- **Deneme modu:** `bash tools/sunucu/kur.sh --deneme` sisteme dokunmadan adımları ve yazılacak dosyaların tamamını
  (`odi.env`, systemd birimleri, Caddyfile, …) gösterir; root gerekmez.
- **Etkileşimsiz (yalnız test):** `ODI_KUR_DUCK`, `ODI_KUR_TOKEN`, `ODI_KUR_KOD` verilirse sorulmaz. Değerler okunur okunmaz
  ortamdan silinir (alt süreçlere geçmez). `ODI_KUR_KAYNAK` (git adresi), `ODI_KUR_DAL`, `ODI_KUR_ATLA` (`sistem`,
  `duckdns`, `guvenlik-duvari`, `https`; yalnız test ortamı için).
- **Gizlilik denetimi:** `bash tools/sunucu/test/gizlilik.sh [DOSYA…]` → kur.sh'nin deneme modunu sahte kod/token ile
  çalıştırır ve çıktıda bu değerlerin geçmediğini, betiklerde gizli değişkenin dış komut argümanına girmediğini, `set -x`
  olmadığını denetler; verilen dosyalarda (kurulum günlüğü, `journalctl` çıktısı) da arar. Gerçek kurulumda:
  `ODI_GIZLI_KOD=… ODI_GIZLI_TOKEN=… bash gizlilik.sh /var/log/odi-kur.log <(journalctl -u odi -u caddy -u odi-duckdns)`
  (değerleri `read -s` ile alın).
- Gizlilik kuralları: kod ve token yalnız `read -s` ile alınır, kabuk değişkeninde dışa aktarılmadan tutulur, programlara
  yalnız standart girdiden verilir (`printf … | node kod.mjs ozet`, `printf … | curl -K -`); betiklerde `set -x` yoktur.
- Betikler: `tools/sunucu/` (`kur.sh`, `ortak.sh`, `odi-*`, `duckdns-guncelle`). Denetim: `shellcheck -x tools/sunucu/kur.sh tools/sunucu/ortak.sh tools/sunucu/odi-* tools/sunucu/duckdns-guncelle`.

- **Nasıl denendi (2026-10):** systemd'li bir `ubuntu:24.04` kabında (x86_64; Oracle görüntüsündeki iptables kuralları
  ve `ubuntu` kullanıcısıyla) kur.sh baştan sona, yeniden çalıştırma, `odi-guncelle` (normal ve bilerek düşen test
  dalı), `odi-kod-degistir`, `odi-yedek-geri` (prova ve gerçek), yeniden açılış ve Caddy üzerinden aynı kökenden web +
  WebSocket (Playwright). **Denenmedi:** ARM (aarch64) makine, gerçek DuckDNS hesabı ve Let's Encrypt sertifikası (kapta
  `ODI_KUR_ATLA=duckdns,https`); bunlar ilk gerçek kurulumda doğrulanır (docs/yonetim/sunucu-dogrulama.md).

## 9. Bilinen sınırlar

- Yedekler aynı diskte: disk kaybına karşı korumaz. İkinci aşama: Oracle nesne depolamasına günlük kopya (sahip kararı).
- `unattended-upgrades` güvenlik güncellemelerini kurar ama sunucuyu kendiliğinden yeniden başlatmaz; çekirdek
  güncellemesinden sonra `sudo reboot` (servisler kendiliğinden kalkar).
- DuckDNS yalnız IPv4 kaydını günceller.
- Sunucu açılışta yedek alır; son yedek 15 dakikadan yeniyse bu atlanır (çökme döngüsünde eski yedekler korunur).
- NodeSource ve Caddy depoları otomatik güncellemeye dahil değil: `sudo apt upgrade` ile güncellenir.
