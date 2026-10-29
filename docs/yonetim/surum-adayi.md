# Kapalı beta sürüm adayı: tam kabul koşusu (2026-10-29)

**Sonuç: temiz.** Bütün kabul takımları, PWA, yerel üretim bayraklı sunucuda uzak duman ve 50 oyunculu yük denetimi geçti. Son koşuda hiçbir takım tekrar istemedi.

Bulunan tek gerçek hata `expo-doctor`'du (YN-039). Expo SDK 58'in yeni yama sürümleri yüzünden düştü; ayrı bir commit ile düzeltildi.

## Hangi kod?
- **Test edilen ağaç:** `44fb7e2`. İçeriği:
  - main `b8b2767` (geri bildirim, YN-038);
  - `ff64bce` SDK 58 yama sürümleri (YN-039);
  - beta notları.
- Bu ağaç main'deki `8871159` (yalnız `docs/yonetim`) üzerine yeniden dizildi. **Kodu aynıdır:** `git diff 44fb7e2 f40ca92` yalnız `docs/yonetim/durum.md` ve `is-listesi.md` dosyalarını gösterir.
- **Sürüm alanı:** `app.json` hâlâ `0.1.0`. Beta için önerilen sürüm 0.9.0; karar sahipte (karar 20).
- **Makine:** 4 çekirdek, 16 GB. Komutlar `nice -n 5` ile koştu.
  - 1 dk yük ortalaması çoğunlukla 2–4'tü (en çok ≈ 5).
  - Aynı anda başka bir çalışanın (geribildirim) koşuları da vardı.
- **Koşu düzeni:** kabul, `--yalniz` ile üç parçaya bölündü:
  - `typecheck` … `vaka` (e2e takımları);
  - `bot,bot-bos`;
  - `dom-paketi,domcheck,ui-mobile`.
- **Süre sınırları:** `camp` 3600 sn, `UIM_SURE` 19000 sn (kabul.mjs'teki değerler).

## Takımlar (son koşu, 44fb7e2; hepsi ilk denemede)

| Takım | Sonuç | Süre | Not |
|---|---|---|---|
| typecheck | geçti | 21 sn | |
| lint | geçti | 16 sn | |
| vitest | geçti | 100 sn | 80 dosya, 559 test |
| ses (`generate.mjs --check`) | geçti | 0 sn | 208 satırın kaydı güncel |
| mobil-tsc | geçti | 17 sn | |
| jest | geçti | 2 sn | 4 takım, 13 test |
| expo-doctor | geçti | 7 sn | 20/20. İlk koşuda (ab4fb68) iki kez düştü → YN-039, `ff64bce` |
| dom-paketi | geçti | 18 sn | `expo export --platform ios` |
| domcheck | geçti | 122 sn | 1. bölüm ⭐3, dokunma, kaydırma |
| bot 1–40 (Chromium) | geçti | 1446 sn | 40/40 tamamlandı, 0 hata |
| bot-bos (boşta oyuncu) | geçti | 271 sn | 40/40 bölüm tamamlanmadı (beklenen) |
| reset (web + dom) | geçti | 154 sn | |
| onboarding (web + dom) | geçti | 3305 sn | Sınır 4800 sn; %69'u (ilk koşu 3676 sn, %77) |
| codes | geçti | 42 sn | |
| team-apply | geçti | 58 sn | |
| teamrace | geçti | 123 sn | |
| comm | geçti | 426 sn | |
| social | geçti | 105 sn | 17 adım; çökme raporu (16) ve geri bildirim (17) dahil |
| friends | geçti | 40 sn | |
| events | geçti | 525 sn | 11 denetim |
| race | geçti | 86 sn | |
| kopma (tam `kopma-e2e`) | geçti | 761 sn | 520 denetim, Chromium + WebKit; `--only` yok: odul, kamp, cuzdan (bolum, bolum-kopma, bolum-zaman dahil), sohbet, etkinlik, yaris, yaris-ici |
| camp | geçti | 1151 sn | Sınır 3600 sn |
| vaka | geçti | 223 sn | |
| ui-mobile (web + dom × Chromium + WebKit × 320/390, kontrastlı) | geçti | 6177 sn | 1044 ekran, 0 sorun; ayrıntı aşağıda; sınır 19000 sn, %33'ü |

**ui-mobile kontrast sonucu (WCAG AA):**
- 52 531 metin ölçüldü; 0 ihlal.
- 581 gerekçeli istisna var (devre dışı denetimler).
- 2719 ölçüm sahip kararı 19'u bekliyor (Ö1–Ö7 dolgu önerileri).
- 568 ölçüm yapılamadı.

**Ek koşular (44fb7e2):**

| Koşu | Sonuç | Süre |
|---|---|---|
| `node tools/harness/pwa-e2e.mjs` | 10/10 (Chromium + WebKit: manifest/simgeler, ilk kareler koyu, çevrimdışı açılış + 1. bölüm ⭐3, yasal sayfalar çevrimdışı, v1 → v2 güncelleme) | 105 sn |
| `uzak-duman --sunucu ws://127.0.0.1:<port> --ip-siniri 3`, yerel üretim bayraklı sunucuya karşı (ayrıntı aşağıda) | 37 denetim, 0 hata. D13: 5 × "geçersiz", 6. "çok"; D14: 4. hesap sahte `X-Forwarded-For` ile de `HIZ`. 3 hesap silindi, `/saglik` 0 → 0 | 25 sn |
| Aynı sunucuda uçlar (curl) | `POST /hata {}` → 400. `POST /geri-bildirim`: `{}` → 400, geçerli not → 204. `GET /geri-bildirim` → 405 | — |
| `node tools/sunucu/yuk.mjs --yerel-ornek --oyuncu 50 --sure 120` | Ayrıntı aşağıda. **`D10 ölçütleri: GEÇTİ`** | 126 sn |

**Yerel üretim bayraklı sunucunun ayarları:**
- `NODE_ENV=production`, `HOST=127.0.0.1`;
- `ODI_TEST_STORE` yok;
- `ODI_ADMIN_CODE_HASH`: rastgele, hiçbir yere yazılmamış bir kodun özeti;
- `ODI_NEW_PER_IP_HOUR=3`, `ODI_TRUST_PROXY` yok;
- geçici SQLite.

**Yük denetimi (yuk) sonuçları:**
- 50/50 sanal oyuncu, 3116 istek (24,8/sn).
- Yanıt süresi: p50 1,4 ms, p95 3,3 ms, p99 5,6 ms, en çok 18,3 ms.
- 0 hata, 0 kopma.
- Sunucu işlemcisi ortalama %3,0 (tek çekirdeğe göre).
- Bellek 92,5 → 103,7 MB; ısınmadan sonra +%4,7.

## Düşenler ve düzeltmeler
1. **expo-doctor: gerçek hata, iki kez düştü (ilk koşu, ab4fb68).**
   - **Neden:** 19/20 denetim geçti. "packages match versions required by installed Expo SDK" denetimi düştü: Expo 27 Ekim'de SDK 58 yama sürümleri yayımladı ve denetim kayıt defterine bakıyor. Kod gerilemesi değil.
   - **Düzeltme:** `ff64bce` (YN-039), `npx expo install --fix`. Değişen sürümler:
     - expo 58.0.20 → 58.0.21;
     - expo-linking → 58.0.15;
     - expo-router → 58.0.28;
     - expo-splash-screen → 58.0.12;
     - expo-system-ui → 58.0.7;
     - react-native 0.88.0 → 0.88.1;
     - jest-expo → 58.0.13.
   - **Doğrulama:** typecheck, mobil-tsc, jest, expo-doctor 20/20, dom-paketi ve domcheck hemen geçti. Ardından bütün takımlar yeni ağaçta yeniden koştu (yukarıdaki tablo).
   - Önceki aynı türden iş: 5b21cd7.
2. **ui-mobile: DOM yapılandırmaları düştü (koşu düzeni hatası, ürün hatası değil).**
   - **Ne oldu:** 4 DOM yapılandırması `akış — scrollIntoViewIfNeeded: Timeout 30000ms` ile düştü; web yapılandırmaları geçti.
   - **Neden:** Bu koşuya `dom-paketi` dahil değildi. DOM paketi (`apps/mobile/dist/www.bundle`) önceki parçada, `b8b2767`'ye geçmeden önce kurulmuştu. kabul paket varsa yeniden kurmuyor. Eski pakette "Geri bildirim gönder" kartı yoktu, ui-mobile'ın yeni adımı da onu arıyordu.
   - Tekrar denemesi yarıda durduruldu.
   - **Sonra:** `--yalniz dom-paketi,domcheck,ui-mobile` ile 1044 ekran, 0 sorun.
   - **Not (araç, P3):** kabul'ü `--yalniz` ile bölerken DOM takımları koşan her parçaya `dom-paketi` eklenmeli. Daha iyisi: kabul paketin yaşını HEAD ile karşılaştırsın.
3. **Ötekiler:** Hiçbir takım "tekrarda geçti" olmadı. Yük kanıtı gereken düşüş yok.

## Bilinen sorunlar (beta için)
- **MK-036 artıkları (P3):**
  - Bölüm sonu jetonunun üst çubukta donması ve bir anlık fazla ödül MK-038'de giderildi.
  - Bu koşuda `kopma-e2e` cüzdan senaryoları (bolum, bolum-kopma, bolum-zaman) geçti.
  - Kalan tek risk araç tarafında: kabul'ün süreç temizliği, `ODI_KABUL_RUN` ortam değişkeninin alt süreçlere geçmesine dayanıyor. Bu koşudaki kabul çağrılarından sonra ağaçta artık süreç kalmadı. Elle yarıda durdurulan tekrarın süreçleri, koşu kimliğiyle bulunup elle kapatıldı.
- **ARM'de denenmedi:**
  - `npm ci --ignore-scripts` ARM'de arm64 yerel ikililerini bulacak mı: `@esbuild/linux-arm64`, `@rolldown/binding-linux-arm64-gnu`, `lightningcss-linux-arm64-gnu`.
  - Sunucu x64 kapta denendi; Oracle ARM'de yük ölçümü (D10) yapılmadı.
  - Gerçek DuckDNS, Let's Encrypt ve Security List de denenmedi.
  - Ayrıntı: [`sunucu-dogrulama.md`](sunucu-dogrulama.md) "İlk gerçek kurulumda".
- **Telefon ve tarayıcıdan bekleyen denetimler:**
  - D4: web aynı kökenden, gerçek adreste.
  - D5: uzak duman, gerçek sunucuda. Bu koşuda yalnız yerel üretim bayraklı sunucuya karşı geçti.
  - D6: kopma, gerçek sunucuda.
  - D16: uygulamadan bağlantı (Expo Go ve APK).
  - D14'ün kesin sınaması üretimde geçici olarak sınır 3 ister.
- **İlk EAS/APK derlemesi hiç denenmedi (YN-024):**
  - Bu derlemeye react-native 0.88.1 girecek (YN-039).
  - DOM tek dosya ayarı EAS'ta denenmedi (YN-025).
  - Android sistem yazı boyutu ile Büyük yazı cihazda denenmedi (MK-006).
- **Sunucu güncellemesi sahipte:** sahip `odi-guncelle` ve `kur.sh` çalıştırmalı. Bunlar olmadan:
  - çökme raporu (`/hata`, YN-011) üretimde açılmaz;
  - geri bildirim (`/geri-bildirim`, YN-038) üretimde açılmaz;
  - Caddy satırları üretime girmez.
- **ODY-İLK kodu (YN-037):** sunucuda henüz tanımlı değil; ödül kararı sahipte (karar 21).
- **Bot kapsamı:** kabul'deki bot 1–40 yalnız Chromium'da koştu. WebKit'te son 40/40 sonucu MK-039/MK-040 doğrulamasından.
- **onboarding süresi:** 55–61 dk, sınırın %69–77'si. Yük artarsa sınıra yaklaşır; izlenmeli.
- **Kontrast:** 2719 ölçüm sahip kararı 19'u bekliyor (ihlal değil, öneri).
- **Bağımlılık denetimi (`npm audit --omit=dev`):**
  - 3 yüksek bulgu var. Hepsi Expo derleme aracının kendi iç `zod@3.25.76` kopyasından geliyor (`@expo/cli`, `expo`). 5 düşük bulgu `deepmerge` (`@expo/config`) kaynaklı.
  - Oyun sunucusu ve web `zod@4.6.7` kullanıyor (yamalı).
  - Bulgular derleme zamanı aracında, çalışan oyunda değil.
  - `npm audit fix --force` Expo'yu kırar; Expo'nun bir sonraki yamasında yeniden bakılmalı.
- **Yerel ağ kısıtı (YN-030):** IP başına saatte 20 yeni hesap sınırı, okul ağında ya da CGNAT arkasında toplu kayıtta engel olabilir.

## Sürüm numarası (sahip kararı 20)
- **Öneri:** `apps/mobile/app.json` `version` = **0.9.0** (kapalı beta; mağaza 1.0.0).
- `/saglik` aynı numarayı göstersin diye kök ve `apps/server` `package.json` da aynı sürüme çekilmeli.
- Bu iş sürümü değiştirmedi.

## Beta notları
[`marketing/magaza/beta-notlari.md`](../../marketing/magaza/beta-notlari.md) (test edenler için, Türkçe, 8 satır). İçeriği:
- kurulum: iPhone'da Safari ile "Ana Ekrana Ekle", Android'de APK ya da "Uygulamayı yükle";
- bakılacaklar: ilk 10 bölüm, Takım, Kamp;
- çökme raporu: kişisel veri yok;
- Ayarlar › Geri bildirim gönder;
- iletişim: `{ILETISIM_EPOSTA}` yer tutucusu.

Sunucu adresi metinde yok; adres oyunculara ayrıca gönderilir.
