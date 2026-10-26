# Sunucu doğrulaması (Oracle Always Free): 4. aşama planı

Sahip kararı (YN-006): Oracle Cloud Always Free (Ubuntu 24.04 ARM, 2 OCPU / 12 GB), DuckDNS alt alan adı, Caddy ile HTTPS, web derlemesi aynı sunucuda.

Plan: [ODİ Sunucu Planı](https://claude.ai/artifact/5iDRnp4HPDQtEAjkLVbhfr). Hazırlık çalışanı: `sunucu`; kurulumu sahip yapar.

**Kural.** Aşağıdaki denetimlerin hepsi geçmeden kapalı beta başlamaz. Sonuçlar bu belgeye tarih ve sürümle yazılır.

**Gizlilik.** Hiçbir denetim sonucu, günlük ya da rapor yönetici kodunu, DuckDNS token'ını ya da SSH anahtarını içermez.

## Ön koşullar

| Ne | Kim | Durum |
|---|---|---|
| `tools/sunucu/kur.sh`, yardımcı komutlar, `oyna --sunucu`, `eas.json` ortam yeri, aynı kökenden web | sunucu çalışanı | tamam (4901df5; x86_64 Ubuntu 24.04 kabında baştan sona denendi) |
| MK-019 `kopma-e2e` (oturum ortasında yeniden başlatma) | kopma çalışanı | sırada |
| MK-024 uzak denetim araçları: `uzak-duman.mjs` ve `yuk.mjs` (aşağıda) | çalışan (uzak) | sırada |
| Kurulum (Adım 1–5), "Hazır" satırı | sahip | bekliyor |

## Neden ayrı uzak araçlar gerekiyor
Bugünkü harness'lar kendi test sunucusunu açıyor ve üretimde olmaması gereken bayraklarla çalışıyor: `ODI_TEST_STORE=1`, `ODI_RAID_ALWAYS=1`, `ODI_FREE_TEXT_AT=0`. Bazıları SQLite dosyasını doğrudan değiştiriyor (ui-mobile, camp). Üretim sunucusuna bu harness'larla gidilmez:
- gerçek veritabanına test hesabı ve test verisi yazarlar;
- IP başına yeni hesap sınırına (`ODI_NEW_PER_IP_HOUR`) takılırlar;
- veritabanı adımları uzakta çalışmaz.

Bunun yerine:
- **`tools/harness/uzak-duman.mjs --sunucu wss://<adres>`.** En çok 3 test hesabı açar; adları `test-` ile başlayan kurgusal adlardır. Şu akışları sınar:
  - takım kur ve katıl;
  - sohbette hazır söz;
  - arkadaşlık isteği;
  - kamp görünümü;
  - yarış daveti.
  Sonunda her hesabı `account.delete` ile siler. Hiçbir adım veritabanına doğrudan dokunmaz. Web ve DOM hedefi, Chromium ve WebKit.
- **`tools/sunucu/yuk.mjs`.** Sanal oyuncu sayısı ve süre parametre. Bağlanır, kimlik doğrular, takım sohbeti ve kamp işlemleri yapar, düzenli ping atar. p50/p95 yanıt süresini ve hata sayısını yazar. Sunucunun **kendisinde**, geçici ikinci bir örneğe karşı koşar (`ODI_DB` geçici dosya, ayrı port); üretim verisine dokunmaz, IP sınırına takılmaz. Aynı araçla Caddy üzerinden 5 sanal oyunculuk kısa bir koşu da yapılır.

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
| D5 | Uzak duman | `uzak-duman.mjs` (yukarıda) | 0 hata; test hesapları silindi (`/saglik` `players` sayısı başlangıçtaki değere döner) |
| D6 | Kopma | Oyun sürerken `sudo systemctl restart odi` (MK-019 senaryoları: inşaat, sonuç ödülü, sohbet, yarış) | ≤ 15 sn'de kendiliğinden bağlanır; ödül tek; veri kaybı yok |
| D7 | Yeniden açılış | `sudo reboot` | Servis, Caddy ve DuckDNS güncelleyici kendiliğinden kalkar; D1 geçer |
| D8 | Güncelleme | `sudo odi-guncelle`: (a) normal; (b) bilerek düşen test içeren bir dal | (a) yeni sürüm, kısa kopma; (b) yeniden başlatmaz, eski sürüm çalışmaya devam eder |
| D9 | Yedek | `odi-durum` son yedek; `odi-yedek-geri` ile **ayrı klasöre** geri yükleme; `PRAGMA integrity_check` | Yedek 6 saatte bir; en çok 28 kopya; geri yüklenen dosya `ok`, oyuncu sayısı tutarlı |
| D10 | Yük | `yuk.mjs` sunucunun kendisinde: 50 sanal oyuncu, 10 dk | İşlemci < %50, p95 < 200 ms, 0 kopma, bellek sabit |
| D11 | Uzun bağlantı | 1 istemci 10 dk boşta (Caddy ile WebSocket) | Kopmaz ya da kendiliğinden yeniden bağlanır |
| D12 | Portlar | Sunucuda `sudo ss -tlnp` + `sudo iptables -S INPUT` (Oracle görüntüsü ufw değil iptables kullanır); Oracle Security List; mümkünse dışarıdan `nc -zv <adres> 8787` | Dışarıya yalnız 22, 80, 443; 8787 yalnız 127.0.0.1 |
| D13 | Yönetici kodu sınırı | Test hesabıyla 6 yanlış deneme | 6. deneme beklemeye düşer. Sunucu geneli bütçe (60) tüketilmez: sahibin kodunu kilitlemesin |
| D14 | Vekil IP | `X-Forwarded-For: 1.2.3.4` sahte başlığıyla hesap açma ve yanlış kod denemesi | Sınır gerçek IP'ye uygulanır; sahte başlık aşamaz (`ODI_TRUST_PROXY=1`, Caddy en sağa ekler) |
| D15 | Günlükler | `journalctl -u odi --since -1h` | Yönetici kodu, token, IP dışı kişisel veri yok; günlük döndürme açık |
| D16 | Uygulamadan bağlantı | Expo Go `npm run oyna -- --tunnel --sunucu wss://<adres>`; varsa APK (YN-024) | Takım sekmesi "bağlı", iki cihaz aynı takımda sohbet eder |

## Kapanış
- Hepsi geçince durum panosunda YN-006, YN-002 ve YN-007 kapanır. Kapalı beta engeli olarak yalnız YN-024 (APK) kalır.
- Düşen denetim iş listesine YN maddesi olarak girer. Düzeltme, sunucuya `odi-guncelle` ile gider; denetim yeniden koşulur.
