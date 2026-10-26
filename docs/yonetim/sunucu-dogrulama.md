# Sunucu doğrulaması (Oracle Always Free): 4. aşama planı

Sahip kararı (YN-006): Oracle Cloud Always Free (Ubuntu 24.04 ARM, 2 OCPU / 12 GB), DuckDNS alt alan adı, Caddy ile HTTPS, web derlemesi aynı sunucuda.

Plan: [ODİ Sunucu Planı](https://claude.ai/artifact/5iDRnp4HPDQtEAjkLVbhfr). Hazırlık çalışanı: `sunucu`; kurulumu sahip yapar.

**Kural.** Aşağıdaki denetimlerin hepsi geçmeden kapalı beta başlamaz. Sonuçlar bu belgeye tarih ve sürümle yazılır.

**Gizlilik.** Hiçbir denetim sonucu, günlük ya da rapor yönetici kodunu, DuckDNS token'ını ya da SSH anahtarını içermez.

## Ön koşullar

| Ne | Kim | Durum |
|---|---|---|
| `tools/sunucu/kur.sh`, yardımcı komutlar, `oyna --sunucu`, `eas.json` ortam yeri, aynı kökenden web | sunucu çalışanı | tamam (4901df5; x86_64 Ubuntu 24.04 kabında baştan sona denendi) |
| MK-019 `kopma-e2e` (oturum ortasında yeniden başlatma) | kopma çalışanı | sırada (uzak çalıştırma kancası: aşağıda "Uzak araçlar" › MK-019) |
| MK-024 uzak denetim araçları: `uzak-duman.mjs` ve `yuk.mjs` (aşağıda) | çalışan (uzak) | tamam (yerel üretim bayraklı sunucuda denendi; aşağıda "Yerel deneme") |
| Kurulum (Adım 1–5), "Hazır" satırı | sahip | bekliyor |

## Neden ayrı uzak araçlar gerekiyor
Bugünkü harness'lar kendi test sunucusunu açıyor ve üretimde olmaması gereken bayraklarla çalışıyor: `ODI_TEST_STORE=1`, `ODI_RAID_ALWAYS=1`, `ODI_FREE_TEXT_AT=0`. Bazıları SQLite dosyasını doğrudan değiştiriyor (ui-mobile, camp). Üretim sunucusuna bu harness'larla gidilmez:
- gerçek veritabanına test hesabı ve test verisi yazarlar;
- IP başına yeni hesap sınırına (`ODI_NEW_PER_IP_HOUR`) takılırlar;
- veritabanı adımları uzakta çalışmaz.

Bunun yerine iki uzak araç var (MK-024). İkisi de test bayrağı istemez, veritabanına doğrudan dokunmaz ve yalnız Node 22 ile
çalışır (yeni paket yok; protokol istemcisi `tools/sunucu/istemci.mjs`, Node'un yerleşik WebSocket'i).

### `tools/harness/uzak-duman.mjs` (D5, D13, D14)
PY'nin bilgisayarında, depo kökünden (Playwright tarayıcıları kurulu). En çok 3 test hesabı açar; adları `test_` ile başlar
(oyuncu adında tire kullanılamaz: `test_<koşu>_A|B|C`). A Chromium'da, B WebKit'te arayüzden; C tarayıcısız, protokolle:
- **takım kur ve katıl:** A arayüzden kurar, B arayüzden davet koduyla katılır, C protokolle katılır; takımda üç hesap;
- **takım sohbetinde hazır söz:** B "Selam!" → A ekranda görür; A "Teşekkürler!" → B görür; C ikisini olay olarak alır.
  Yeni hesabın serbest yazamadığı da denetlenir (üretim kuralı);
- **arkadaşlık isteği ve kabul:** C → A ve C → B; A ve B bildirimden arayüzle kabul eder; C `friend.accepted` alır;
- **kamp görünümü:** iki tarayıcıda Kamp sekmesi yüklenir; C `camp.state`;
- **yarış daveti:** C oda kurar, A'yı ve B'yi davet eder; davet kartı iki tarayıcıda görünür;
- **D13:** C ile 6 yanlış yönetici kodu (rastgele, biçimi geçerli; gerçek kod araçta yok). Sunucu geneli sınama bütçesinden
  (60 / 10 dk) en çok 5 harcanır; 6. deneme sınamaya hiç ulaşmaz;
- **D14:** her hesap açılışı WebSocket el sıkışmasında sahte `X-Forwarded-For` ile yapılır (her seferinde başka adres).
  Sunucunun saatlik yeni hesap sınırı 3 ise (`--ip-siniri 3`) dördüncü hesap denemesi de sahte başlıkla yapılır ve `HIZ`
  almalıdır. Sınır 20 iken 3 hesapla kesin sonuç çıkmaz; araç bunu uyarı olarak yazar (aşağıda D14).

Bitişte, düşse de (finally, SIGINT/SIGTERM/SIGHUP, yakalanmamış hata) her test hesabı `account.delete` ile silinir ve
`/saglik` `players` sayısının başlangıçtaki değere döndüğü denetlenir. `/saglik` silinmiş hesapları saymaz (MK-024 ile;
oyuncu satırı anonim kalır, bkz. YN-004). `--web` verilmezse web derlemesi yerelde önizlenir ve `?sunucu=` ile hedefe bağlanır.

### `tools/sunucu/yuk.mjs` (D10, D11)
Sanal oyuncular protokolü doğrudan konuşur (tarayıcı yok): bağlan, `hello`, takım (kur / katıl), sonra döngüde takım
sohbetinde hazır söz, kamp işlemleri (`camp.state`, `camp.collect`, `camp.upgrade`), `team.detail` ve ping (`wallet.get`).
p50/p95/p99 yanıt süresi (işlem başına da), hata, oyun kuralı gereği beklenen ret, kopma ve yeniden bağlanma; geçici
örnekte (ya da `--pid`) sunucu sürecinin işlemcisi ve belleği. D10 ölçütlerini kendisi değerlendirir; geçmezse çıkış kodu 1.
- `--yerel-ornek`: sunucunun **kendisinde** geçici ikinci örnek açar: boş bir port (8787 değil), geçici klasörde yeni
  `ODI_DB` (ya da `--db-kopya <dosya>` ile bir yedeğin kopyası), `NODE_ENV=production`, `ODI_TEST_STORE=0`,
  `ODI_TRUST_PROXY=0`. Yalnız bu örnekte IP başına yeni hesap sınırı ortam değişkeniyle yükseltilir
  (`ODI_NEW_PER_IP_HOUR` = 2 × oyuncu + 20). Bitince örnek kapanır, klasör silinir. Üretim örneğine ve veritabanına dokunulmaz.
- `--sunucu wss://<adres>`: çalışan sunucuya karşı (Caddy üzerinden kısa koşu). En çok 5 sanal oyuncu; hesaplar sonunda
  `account.delete` ile silinir.
- `--bosta 600`: yük yerine tek istemci 10 dk boşta kalır (yalnız sunucunun 25 sn'lik WebSocket ping'leri); kopma olursa
  gerçek istemci gibi aynı anahtarla yeniden bağlanır ve bunu raporlar; sonda bir istek atar ve hesabı siler.

### MK-019 (`kopma-e2e`) uzak çalıştırma kancası
MK-024 kapanırken `tools/harness/kopma-e2e.mjs` main'de değildi. Yapılacak (TODO, MK-019 inince): senaryolar
`--sunucu wss://<adres>` ile çalışan sunucuya karşı koşabilmeli; o kipte kendi sunucusunu açmaz, test bayrağı istemez,
hesaplarını `tools/sunucu/istemci.mjs` ile açıp sonunda `account.delete` ile siler (uzak-duman'daki `hesapAc` / `temizle`
deseni) ve yeniden başlatmayı PY elle yapar (`sudo systemctl restart odi`, D6).

### Yerel deneme (2026-10-26, MK-024)
Üretim bayraklı yerel sunucu: `NODE_ENV=production`, `HOST=127.0.0.1`, test bayrağı yok (`ODI_TEST_STORE=0`), yönetici
özeti rastgele bir kodun test özeti (kod hiçbir yere yazılmadı), `ODI_NEW_PER_IP_HOUR=3`, kalıcı SQLite dosyası.
Önce 4 "gerçek" oyuncu (takım, sohbet, arkadaşlık) yazıldı, sonra sunucu sınırlarla yeniden açıldı (bellekteki sayaçlar sıfır).

| Koşu | Sonuç |
|---|---|
| `uzak-duman --ip-siniri 3`, `ODI_TRUST_PROXY=0`, Chromium + WebKit, yerel derleme | 0 hata (38 denetim). D13: 5 × "geçersiz", 6. "çok". D14: 4. hesap sahte başlıkla `HIZ`. Üç hesap silindi, `/saglik` 4 → 4 |
| `uzak-duman --web http://127.0.0.1:<önizleme>/ --ip-siniri 3 --vekil-taklit`, `ODI_TRUST_PROXY=1` | 0 hata; D14 `HIZ` (sınır vekilin eklediği sağdaki adrese uygulandı); `/saglik` 4 → 4 |
| Ters sınama: `ODI_TRUST_PROXY=1`, önde vekil yok, `--vekil-taklit` yok | Beklendiği gibi `D14 KALDI` (sahte başlık sınırı aştı); açılan 4. hesap da silindi, `/saglik` 4 → 4. Denetim yanlış ayarı yakalıyor |
| `uzak-duman` koşarken SIGINT (tarayıcı adımında) | Akış durdu, üç hesap silindi, `/saglik` 4 → 4, çıkış 130 |
| `yuk --yerel-ornek --oyuncu 50 --sure 120` | 50/50 oyuncu, 3 088 istek (24,5/sn), p50 1,3 ms, p95 5,6 ms, p99 14,3 ms, en çok 64,5 ms; 0 hata, 0 kopma; sunucu işlemcisi ort %2,5 (tek çekirdek); bellek 92 → 106,5 MB (ısınma sonrası +%8,8). `D10 ölçütleri: GEÇTİ`; geçici klasör silindi |
| `yuk --sunucu ws://… --oyuncu 5 --sure 30` (üretim bayraklı sunucu) | p95 7,2 ms, 0 hata; 5 hesap silindi; `--oyuncu 6` kullanım hatasıyla reddedildi; SIGINT'te de 5/5 silindi |
| `yuk --sunucu ws://… --bosta 600` | 600 sn boşta: 0 kopma, sonraki istek 2,0 ms. `D11 GEÇTİ` |
| `yuk --bosta 40`, 10. sn'de sunucu yeniden başlatıldı | 1 kopma, 3 sn sonra aynı anahtarla yeniden bağlandı. `D11 GEÇTİ` |

**Veritabanında kalan iz** (koşu öncesi/sonrası tablo satır sayıları, salt okunur): test hesaplarının adı, oturum anahtarı,
takımı, sohbet mesajları, arkadaşlıkları ve istekleri kalmaz (`teams`, `chat`, `friends`, `friend_requests`, `dm` değişmez).
`account.delete`'in tasarımı gereği (YN-004) kalanlar: hesap başına anonim oyuncu satırı ("Silinmiş Oyuncu") +
`deleted_players` işareti; `promo_log` (D13 denemeleri, IP ile, 90 gün; güvenlik kaydı). `/olcum` günlük sayaçları (ör. `msg.hazir`) de artar.

YN-029 (hesapsil) sonrası yerel deneme (2026-10-26, üretim bayraklı yerel sunucu, `uzak-duman` 0 hata): sınıflandırmadaki
(`apps/server/src/account-veri.ts`) 96 oyuncu "sil" kuralında test hesaplarının satırı 0; 32 takım "sil" sütununda sahipsiz takım satırı 0 (`ev_duel`,
`ev_relay`, `ev_hunt`, `ev_tquest` dahil); koşu öncesi → sonrası tablo farkı yalnız `players` +3 (anonim), `deleted_players` +3,
`promo_log` +6, `comm_metrics` +2, `ev_tourney_group` +1 (kimliksiz grup satırı). Test hesaplarının adı hiçbir sütunda geçmiyor;
sunucu yeniden açılınca silinen hesaplara kamp binası eklenmiyor.

## İlk gerçek kurulumda ilk bakılacaklar
Kapta denenmeyenler: ARM, gerçek DuckDNS, Let's Encrypt, Oracle Security List, telefonda Expo Go `--sunucu`.

- `npm ci --ignore-scripts` ARM'de yerel ikilileri bulur mu? Kilit dosyasında `@esbuild/linux-arm64`, `@rolldown/binding-linux-arm64-gnu` ve `lightningcss-linux-arm64-gnu` girdileri var; kurulum günlüğünde `npm ci` ve derleme adımı denetlenir.
- Sertifika ilk denemede alınamazsa Security List'te 80/443 açık mı bakılır (docs/18 §7).

## Denetimler

| # | Denetim | Nasıl | Geçme ölçütü |
|---|---|---|---|
| D1 | Sağlık | `curl -s https://<adres>/saglik` | 200, `ok:true`, `version` = main'deki sürüm |
| D2 | Sertifika | `curl -vI https://<adres>` ve `openssl s_client -connect <adres>:443 -servername <adres>` | Let's Encrypt, geçerli, kalan süre ≥ 30 gün; `http://` → `https://` yönlendirme |
| D3 | Üretim bayrakları | `odi-durum` + davranış: test mağazası satın alımı reddedilir, baskın her zaman açık değil, yeni hesap serbest yazamaz | `ODI_TEST_STORE` / `ODI_RAID_ALWAYS` / `ODI_FREE_TEXT_AT=0` yok; `NODE_ENV=production`; varsayılan özet kapalı |
| D4 | Web aynı kökenden | Tarayıcıda `https://<adres>`: başlık, bölüm 1, ses dosyası (`/voice/*.mp3`, `audio/mpeg`), Phaser parçası | Açılır, oynanır; Takım sekmesi "bağlı"; konsolda hata yok |
| D5 | Uzak duman | PY bilgisayarında: `node tools/harness/uzak-duman.mjs --sunucu wss://<adres> --web https://<adres>` (yukarıda) | Son satır `✓ 0 hata`; temizlikte üç hesap "silindi (account.delete)" ve `/saglik players başlangıçtaki değere döndü`. Sınır 20 iken D14 uyarısı beklenir |
| D6 | Kopma | Oyun sürerken `sudo systemctl restart odi` (MK-019 senaryoları: inşaat, sonuç ödülü, sohbet, yarış) | ≤ 15 sn'de kendiliğinden bağlanır; ödül tek; veri kaybı yok |
| D7 | Yeniden açılış | `sudo reboot` | Servis, Caddy ve DuckDNS güncelleyici kendiliğinden kalkar; D1 geçer |
| D8 | Güncelleme | `sudo odi-guncelle`: (a) normal; (b) bilerek düşen test içeren bir dal | (a) yeni sürüm, kısa kopma; (b) yeniden başlatmaz, eski sürüm çalışmaya devam eder |
| D9 | Yedek | `odi-durum` son yedek; `odi-yedek-geri` ile **ayrı klasöre** geri yükleme; `PRAGMA integrity_check` | Yedek 6 saatte bir; en çok 28 kopya; geri yüklenen dosya `ok`, oyuncu sayısı tutarlı |
| D10 | Yük | Sunucuda: `sudo -u odi node /opt/odi/kaynak/tools/sunucu/yuk.mjs --yerel-ornek --oyuncu 50 --sure 600` (gerçek veri büyüklüğüyle: `--db-kopya "$(sudo ls -1 /var/lib/odi/yedek/odi-yedek-*.sqlite \| tail -n 1)"`). Caddy üzerinden kısa koşu, PY bilgisayarında: `node tools/sunucu/yuk.mjs --sunucu wss://<adres> --oyuncu 5 --sure 60` | Rapor sonu `D10 ölçütleri: GEÇTİ`: işlemci ort < %50 (tek çekirdeğe göre), p95 < 200 ms, 0 kopma, 0 hata, bellek sabit (son çeyrek ≤ ısınma sonrası +%20). Kısa koşuda p95 < 200 ms, 0 hata, hesaplar silindi |
| D11 | Uzun bağlantı | PY bilgisayarında (Caddy üzerinden): `node tools/sunucu/yuk.mjs --sunucu wss://<adres> --bosta 600` | `D11 GEÇTİ`: kopmadı ya da her kopmada kendiliğinden yeniden bağlandı; boşluk sonrası istek yanıtlandı |
| D12 | Portlar | Sunucuda `sudo ss -tlnp` + `sudo iptables -S INPUT` (Oracle görüntüsü ufw değil iptables kullanır); Oracle Security List; mümkünse dışarıdan `nc -zv <adres> 8787` | Dışarıya yalnız 22, 80, 443; 8787 yalnız 127.0.0.1 |
| D13 | Yönetici kodu sınırı | D5 komutunun "D13" bölümü (C hesabıyla 6 yanlış kod). 10 dk içinde ikinci koşu IP sınırına (20) yaklaşır | 1–5 "geçersiz", 6. "çok fazla deneme". Bütçeden en çok 5/60 harcanır: sahibin kodu kilitlenmez |
| D14 | Vekil IP | D5 komutu her hesabı sahte `X-Forwarded-For` ile açar; sınır 20 iken kesin sonuç vermez (uyarı). Kesin sınama yalnız kapalı beta öncesi, sınırı geçici 3 yaparak: `sudo sed -i 's/^ODI_NEW_PER_IP_HOUR=.*/ODI_NEW_PER_IP_HOUR=3/' /etc/odi/odi.env && sudo systemctl restart odi`, PY bilgisayarında `node tools/harness/uzak-duman.mjs --sunucu wss://<adres> --tarayici yok --ip-siniri 3`, sonra geri al: `sudo sed -i 's/^ODI_NEW_PER_IP_HOUR=.*/ODI_NEW_PER_IP_HOUR=20/' /etc/odi/odi.env && sudo systemctl restart odi && sudo odi-durum --kisa` | `4. hesap sahte başlıkla da reddedildi: HIZ`: sınır gerçek IP'ye uygulanır (`ODI_TRUST_PROXY=1`, Caddy en sağa ekler). Sahte başlıkla hesap açılırsa araç `D14 KALDI` yazar ve o hesabı da siler |
| D15 | Günlükler | `journalctl -u odi --since -1h` | Yönetici kodu, token, IP dışı kişisel veri yok; günlük döndürme açık |
| D16 | Uygulamadan bağlantı | Expo Go `npm run oyna -- --tunnel --sunucu wss://<adres>`; varsa APK (YN-024) | Takım sekmesi "bağlı", iki cihaz aynı takımda sohbet eder |

## Kapanış
- Hepsi geçince durum panosunda YN-006, YN-002 ve YN-007 kapanır. Kapalı beta engeli olarak yalnız YN-024 (APK) kalır.
- Düşen denetim iş listesine YN maddesi olarak girer. Düzeltme, sunucuya `odi-guncelle` ile gider; denetim yeniden koşulur.
