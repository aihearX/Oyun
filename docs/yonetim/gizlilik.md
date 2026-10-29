# Gizlilik politikası ve KVKK aydınlatma metni (iç belge)

> **Hukuk incelemesi önerilir.** Metin kodun bugün yaptığına göre yazıldı ve her iddia aşağıdaki tabloda koda bağlandı. Yine de
> mağazaya göndermeden önce bir avukatın (KVKK; AB'ye de açılacaksa GDPR) okuması önerilir. Avukata gösterilecek yerler:
> herkese açık sayfalar `<adres>/gizlilik`, `<adres>/en/privacy`, `<adres>/hesap-sil` ve bu belgenin "Açık hukuk konuları" bölümü.
> Bu not yalnız iç belgededir; herkese açık sayfada "taslak" yazmaz.

## Metin nerede

- **Tek kaynak:** [`apps/web/src/yasal/metin.ts`](../../apps/web/src/yasal/metin.ts) (TR gizlilik, EN privacy, hesap silme, hakkında).
- **Oyun içinde:** Profil › Ayarlar › Gizlilik ve hesap › Gizlilik / Hesap silme / Hakkında ve iletişim
  ([`LegalSheet.tsx`](../../apps/web/src/screens/LegalSheet.tsx)). Uygulamanın içinde çizilir; telefonda (Expo DOM) ve bağlantısızken açılır.
- **Herkese açık sayfalar:** `vite build` metin.ts'ten durağan HTML üretir (`gizlilik.html`, `en/privacy.html`, `hesap-sil.html`;
  [`vite.config.ts`](../../apps/web/vite.config.ts) `odiYasalSayfalar`). Sunucu `/gizlilik` → `gizlilik.html` (Caddyfile
  `try_files {path} {path}.html /index.html`; eski Caddyfile'da index.html'deki yönlendirme aynı dosyayı açar). Service worker
  önden önbelleğe alır, bağlantısızken açılır (`pwa-e2e` adım e).
- **Mağaza adresleri:** gizlilik `https://<adres>/gizlilik` (EN liste: `https://<adres>/en/privacy`), hesap silme
  `https://<adres>/hesap-sil`. Gerçek alan adı depoya yazılmaz.

## Yer tutucular

[`apps/web/src/yasal/ayar.json`](../../apps/web/src/yasal/ayar.json): `{YAYINCI}` (varsayılan "aiHear"), `{YAYINCI_UNVAN}`
(boşsa YAYINCI), `{YAYINCI_ADRES}`, `{ILETISIM_EPOSTA}`, `{SUNUCU_BOLGESI}`, `{YURURLUK}`. Boş alan sayfada açıkça
"‹… eklenecek›" yazar ve e-postasız `mailto:` bağlantısı düz yazı olur. Sahip değerleri verince ajan doldurur;
`node tools/magaza/denetle.mjs` boş alan kalırsa mağaza gönderimini durdurur.

## Saklama süreleri (karar)

| Kayıt | Süre | Kod |
|---|---|---|
| Satın alma kaydı | İşlem yılının sonundan 10 yıl (VUK m.253, TTK m.82); hesap silinince oyuncu kimliği yerine `silinmis` | `account.ts` `prunePurchases`, `account-veri.ts` `PURCHASE_RETAIN_YEARS` |
| Şikâyet kayıtları (`player_reports`, `chat_reports`) | 90 gün (hesap silinse de silinmese de) | `account.ts` `pruneReports` |
| Ödül kodu denemeleri (IP ile) | 90 gün | `codes.ts` `prunePromoLog` |
| Takım ve genel sohbet | 30 gün; hesap silinince yazdıkları hemen | `chat.ts` `CHAT_RETAIN_MS`, `account-veri.ts` |
| Özel mesaj | Konuşma başına son 500; taraflardan biri silinince konuşma | `dm.ts` `prune`, `FRIEND_LIMITS.dmKeep` |
| Bölüm gönderim kayıtları (`progress_runs`) | 30 gün | `progress.ts` `RUN_RETAIN_MS` |
| Hesap açma sınırı için IP (bellek) | En çok ~2 saat (saatlik bakım) | `players.ts` `pruneNewAccountIps` |
| Sunucu günlüğü (journald) | 30 gün | `tools/sunucu/ortak.sh` `MaxRetentionSec=30day` |
| Çökme raporları (`crash_reports`; hesaba bağlı değil) | 30 gün | `hata.ts` `CRASH_RETAIN_MS`, `pruneCrashes` (saatlik bakım) |
| Çökme raporu hız sınırı için IP (bellek, tuzlu özet) | En çok 1 gün (günlük pencere; gün değişince zamanlayıcı siler) | `hata.ts` `crashRateOk`, `crashRatePrune` (`server.ts` sweep) |
| Beta geri bildirimi (`feedback`; hesaba bağlı değil) | 90 gün | `geribildirim.ts` `FEEDBACK_RETAIN_MS`, `pruneFeedback` (saatlik bakım) |
| Geri bildirim hız sınırı için IP (bellek, tuzlu özet) | En çok 1 gün (günlük pencere; gün değişince zamanlayıcı siler) | `geribildirim.ts` `feedbackRateOk`, `feedbackRatePrune` (`server.ts` sweep) |
| Yedek | 6 saatte bir, 28 kopya (7 gün) | `ortak.sh` `ODI_BACKUP_HOURS=6`, `ODI_BACKUP_KEEP=28` |
| Diğer hesap verisi | Hesap silinene kadar | `account-veri.ts` `VERI_SINIFI` |

`apps/web/src/legal.test.ts` metindeki sayıları bu sabitlerle karşılaştırır; kod değişirse test düşer.

## Kod karşılığı (her iddia)

| İddia | Dayanak |
|---|---|
| Ad, e-posta, telefon, konum, rehber, fotoğraf, mikrofon, kamera, reklam kimliği istenmez | `apps/mobile/package.json` (izin isteyen modül yok: konum, kamera, kişiler, bildirim yok), `grep getUserMedia\|geolocation` → yok |
| Reklam, analitik, izleme aracı yok | Bağımlılıklarda reklam/analitik SDK yok; RevenueCat yalnız satın alma (`apps/mobile/src/purchases.ts`), `collectDeviceIdentifiers` çağrılmaz |
| Kayıt formu yok; rastgele kimlik + anahtar; sunucuda özet | `players.ts` (hello → yeni oyuncu), `token_hash` |
| Takma ad isteğe bağlı (OdiNNNN) | `ui/Onboarding.tsx` "Sonra", `isDefaultName` |
| Çerez yok; web localStorage + önbellek | `platform.ts` `webStorage`, `sw/sw.js` |
| IP diske yalnız kod denemesinde | `server.ts` `clientIp` (bellekte `Conn.ip`), `codes.ts` `promo_log`; Caddyfile'da erişim günlüğü (`log`) yok |
| Sunucu günlüğünde oyuncu kimliği | `server.ts` `log('ayrıldı', pid)`, hata kayıtları |
| Toplu sayaçlar kişisel değil | `server.ts` `/olcum` → `metricsReport` |
| Çökme raporu: yalnız hata adı ve temizlenmiş ileti, ≤ 20 yığın satırı (dosya:satır:sütun), sürüm/derleme, platform + işletim sistemi ana sürümü, ekran adı, dakikaya yuvarlı zaman | `packages/shared/src/hata.ts` (`scrubText`, `fingerprintStack`, `buildCrashReport`); sunucu şeması katı (`apps/server/src/hata.ts` `crashReportSchema.strict()`: fazla alan → 400) ve iletiyi yeniden temizler |
| Çökme raporu oyuncu kimliği, takma ad, anahtar, sohbet metni, cihaz kimliği taşımaz; hesapla eşleştirilemez | Şemada bu alanlar yok; `crash_reports`'ta oyuncu sütunu yok (`account-veri.ts`); istek çerezsiz, `referrerPolicy: no-referrer` (`apps/web/src/hata.ts`) |
| Aynı hata oturumda bir kez, oturumda en çok 5; bağlantısızken son 5 bekler | `CrashReporter` (`CRASH_LIMITS.perSession`, `queueMax`); test `packages/shared/src/hata.test.ts` |
| IP yalnız bellekte, kötüye kullanımı sınırlamak için (dakikada 10, günde 100) | `hata.ts` `crashRateOk` (süreç başına rastgele tuzla özet); test `apps/server/test/hata.test.ts` |
| Çökme raporu başka şirkete gitmez | Dış çökme/analiz SDK'sı yok; uç kendi sunucumuz (`POST /hata`, Caddyfile `handle /hata`) |
| Geri bildirim: yalnız konu (Hata/Zorluk/Öneri/Diğer), metin ≤ 500 karakter, geldiği ekranın adı, sürüm + derleme, platform | `packages/shared/src/geribildirim.ts` (`buildFeedback`); sunucu şeması katı (`apps/server/src/geribildirim.ts` `feedbackSchema.strict()`: fazla alan → 400) |
| Geri bildirim metninden e-posta, telefon, uzun rakam dizisi (ve anahtar/arkadaş kodu benzeri) cihazda ve sunucuda çıkarılır | `packages/shared/src/hata.ts` `scrubFreeText` (istemci `buildFeedback`, sunucu `receiveFeedback` yeniden); test `packages/shared/src/geribildirim.test.ts`, `apps/server/test/geribildirim.test.ts` |
| Geri bildirim oyuncu kimliği, takma ad, anahtar, cihaz kimliği taşımaz; hesapla eşleştirilemez; ad/telefon/e-posta istenmez | Şemada bu alanlar yok; `feedback`'te oyuncu sütunu yok (`account-veri.ts`); istek çerezsiz, `referrerPolicy: no-referrer` (`apps/web/src/geribildirim.ts`); kartta "Adını, telefonunu ya da e-postanı yazma." (`screens/GeriBildirimKart.tsx`) |
| Geri bildirimde IP yalnız bellekte, kötüye kullanımı sınırlamak için (saatte 5, günde 20) | `geribildirim.ts` `feedbackRateOk` (süreç başına rastgele tuzla özet); günlükte yalnız konu/platform/sürüm/ekran (metin ve IP yok) |
| Geri bildirim başka şirkete gitmez | Uç kendi sunucumuz (`POST /geri-bildirim`, Caddyfile `handle /geri-bildirim`); okuma yalnız sunucu makinesinde `npm run kod -- geribildirim` |
| Serbest yazı 8 bölüm geçilene kadar kapalı | `COMM_RULES.freeTextLevel`, `comm/settings.ts` `requireFreeText` (sohbet ve özel mesaj) |
| Küfür süzgeci (sohbet, DM, ad, takım adı/açıklama, başvuru notu) | `chat.ts`/`dm.ts` `maskProfanity`, `players.ts`, `teams.ts`, `teamapply.ts` `hasProfanity` |
| 3 şikâyette ileti gizlenir, 1 günde 3 kişi → susturma | `chat.ts` `REPORTS_TO_HIDE`, `friends.ts` `addReport` (`FRIEND_LIMITS.reportsToMute`) |
| Şikâyetleri inceler, uzun süre susturabiliriz | `npm run kod -- sikayetler`, `npm run kod -- sustur KOD --gun N` (`yonetim.ts`) |
| Harcama sınırı 1000 TL, yükseltme 24 saat | `shop.ts` `DEFAULT_SPEND_LIMIT_TRY`, `LIMIT_RAISE_DELAY_MS` |
| Hesap silme: sil / anonim / tut ayrıntısı | `account-veri.ts` `VERI_SINIFI` (128 tablo, test `account.test.ts`) |
| Uygulama dışı silme: arkadaş kodu, 14 gün bağlanmamış, 30 gün içinde yanıt | `yonetim.ts` `hesapSilIstegi`, `HESAP_SIL_BEKLEME_GUN` |
| Uygulamayı kaldırmak hesabı silmez | Anahtar yalnız cihazda; sunucuda hareketsiz hesap temizliği yok |
| Bağlantı TLS | Caddy (https/wss); mağaza derlemesinde `EXPO_PUBLIC_ODI_SERVER=wss://…` (`apps/mobile/eas.json`, `docs/10-sunucu.md`) |
| RevenueCat'e giden veri | `purchases.ts` (`appUserID` = oyuncu kimliği), `shop.ts` `verifyReceipt` |

## Bu turda bulunan kod–metin uyuşmazlıkları ve çözümü

1. **Şikâyetler süresizdi** (yalnız hesap silinince 90 gün). Karar 90 gün → `pruneReports` eklendi (her şikâyet 90 günde silinir).
2. **Satın alma kaydının süresi yoktu** ("hukuk danışmanı belirler"). Karar 10 yıl → `prunePurchases` (işlem yılının sonundan 10 yıl).
3. **Hesap açma sınırının IP'leri** bellekte süresiz kalabiliyordu (yalnız 50 000 kayıtta temizlik). Saatlik bakımda temizlenir.
4. **"Her şeyi sıfırla" hesabı sildiğini açıkça söylemiyordu** (Apple 5.1.1(v) bulunabilirlik). Kart ve düğme "Hesabı sil" oldu; onay
   sayfası bağlantı yoksa arkadaş kodunu not almayı söyler.
5. **Uygulama dışı silme yolu yoktu** (Google Play şartı). `/hesap-sil` sayfası + işletmen aracı `npm run kod -- hesap-sil`.
6. **Şikâyetlere işletmen yanıtı yoktu** (Apple 1.2 "zamanında yanıt", "kötüye kullananı engelleme"). `sikayetler` ve `sustur` eklendi;
   oyuncuya uzun susturma "N gün" diye yazılır.
7. **Taslaktaki "Bağlantı kayıtları [süre]"** → journald 30 gün (`ortak.sh`).
8. Oyun içi metin "TASLAK" diyordu; artık son metni gösterir (hukuk notu yalnız bu iç belgede).
9. **Çökme raporu (YN-011):** sahip kararı 7 ile kendi sunucumuza, kişisel veri içermeyen, hız sınırlı çökme raporu eklendi. Metin §3'e
   "Çökme raporları" paragrafı ve saklama satırı (30 gün), §7'ye "hesaba bağlı değil, 30 günde silinir" eklendi. Mağaza beyanları
   buna göre: App Store "Teşhis › Çökme Verileri" (toplanır, kullanıcıya bağlı değil, izleme yok, Uygulama İşlevi; `ios.privacyManifests`
   `CrashData` linked false), Google Play "Uygulama bilgileri ve performansı › Kilitlenme günlükleri ve Teşhis" (toplanır, aktarımda şifreli,
   paylaşılmaz). Hukuki sebep m.5/2-f; rapor hesapla eşleştirilemediği için büyük olasılıkla kişisel veri sayılmaz, yine de metinde
   açıkça yazılı.
10. **Beta geri bildirimi:** sahip gizlilik işini bize bıraktı; oyun içinden kısa not (Ayarlar › Geri bildirim gönder) eklendi. Yeni veri
   türü: **oyuncunun kendi yazdığı serbest metin** (konu + ≤ 500 karakter) ve yanında ekran adı, sürüm, platform; oyuncu kimliği yok,
   90 gün. Serbest metne oyuncu yine de adını yazabilir: kart açıkça "Adını, telefonunu ya da e-postanı yazma." der, e-posta/telefon/
   uzun rakam dizisi otomatik çıkarılır; ad otomatik ayıklanamaz (kalan risk, metinde "yazmayın" diye belirtildi). Metin §3'e
   "Geri bildirim" paragrafı ve saklama satırı (90 gün), §7'ye ve hesap silme sayfasına "hesaba bağlı değil, 90 günde silinir", "İşlemediklerimiz"e
   "nota da yazmamanızı isteriz" eklendi. Mağaza: App Store "Kullanıcı İçeriği › Diğer Kullanıcı İçeriği", Uygulama İşlevi — not kendi
   başına kullanıcıya bağlı değil, ama Apple bağlılığı tür başına tek cevapla sorar ve aynı tür (takma ad) zaten bağlı, bu yüzden tür
   "bağlı" kalır (`ios.privacyManifests` `OtherUserContent` linked true, tek girdi; jest testi sabitler). Google Play "Uygulama etkinliği ›
   Kullanıcının oluşturduğu diğer içerik" (toplanır, isteğe bağlı, Uygulama işlevi, aktarımda şifreli, paylaşılmaz). Hukuki sebep m.5/2-f.

## Açık hukuk konuları (avukata)

- **Yurt dışına aktarım (KVKK m.9, 2024 değişikliği):** Oracle veri merkezi Türkiye dışındaysa ve RevenueCat (ABD) için dayanak büyük
  olasılıkla standart sözleşmedir; imzalandıktan sonra 5 iş günü içinde Kurul'a bildirilmesi gerekir. Metin dayanak iddia etmez,
  "bilgi için bize yazın" der. Avukat dayanağı belirleyince metin güncellenir.
- **VERBİS kaydı:** yıllık çalışan sayısı ve bilanço eşiklerinin altındaysa ve ana faaliyet özel nitelikli veri işlemek değilse muaf
  olabilir; avukat teyit etmeli.
- **Yaş:** oyun 13+ diyor, ama uygulamada yaş sorusu yok; görsel üslup çocuklara hitap ediyor. Google "çocuklara istemeden hitap"
  sorusu için bkz. `marketing/magaza/google-play.md`. Yaş kapısı eklenip eklenmeyeceği sahip/avukat kararı (is-listesi YN-034).
- **GDPR:** mağazada AB ülkeleri de seçilirse GDPR m.27 temsilci şartı ve m.13 bilgilendirmesi gündeme gelir. İlk yayında yalnız
  Türkiye seçmek bu soruyu erteler (sahip kararı).
- **Mesafeli satış:** dijital içerikte cayma hakkı istisnası (Mesafeli Sözleşmeler Yönetmeliği m.15/1-ğ) ve Apple/Google'ın satıcı
  rolü; mağaza açıklamasında ayrıca bir metin gerekip gerekmediği.
- **Veri sorumlusu unvanı ve adresi:** şirket türü (Ltd/A.Ş.) netleşince `ayar.json`a yazılır (YN-012).
