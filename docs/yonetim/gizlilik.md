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
