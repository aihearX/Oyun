# Durum Panosu (Proje Yöneticisi)

> **Görev: sahibi teslim alana kadar sürekli geliştirme.** Turlar ara vermeden art arda koşar; tek durma koşulu sahibin "teslim aldım" demesi ya da durdurması. main'in kararlılığı hızdan önce gelir.

**Son tur:** 15. tur (hafif) · 2026-10-30 · main bca5a1a.
Ayrıntılı iş listesi: [`is-listesi.md`](is-listesi.md). Gizlilik (iç belge): [`gizlilik.md`](gizlilik.md). Mağaza kiti: [`marketing/magaza/`](../../marketing/magaza/) ([`YAYIN-LISTESI.md`](../../marketing/magaza/YAYIN-LISTESI.md)); ekran görüntüleri [`magaza-ekran.md`](magaza-ekran.md). Ekonomi ölçümü: [`ekonomi-olcum.md`](ekonomi-olcum.md). Ses düzeyi: [`ses-duzeyi.md`](ses-duzeyi.md).

## Genel hazırlık

| Aşama | Durum | Eksik |
|---|---|---|
| **İç test** (aynı Wi-Fi, Expo Go SDK 58) | Hazır | — |
| **Kapalı beta** (web + APK, 20-50 kişi) | **Sunucu canlı**; 2 eksik | Sahip: yeni Caddy ayarı için `odi-guncelle` + `kur.sh` · ilk APK (YN-024; Expo hesabı sahipte) · tarayıcı ve telefondan D4/D5/D6/D16 |
| **Mağaza** (App Store + Google Play) | Metinler ve beyanlar hazır; hesaplar sahipte | Kapalı betanın eksikleri + geliştirici hesapları, D-U-N-S, banka/vergi ve yükleme anahtarları (sahip; [`YAYIN-LISTESI.md`](../../marketing/magaza/YAYIN-LISTESI.md)), `ayar.json` yer tutucuları (e-posta, unvan, adres, Oracle bölgesi; YN-009), uygulama içi satın alma kurulumu ve sandbox testi (YN-032), çökme raporu kararı (YN-011), yaş ekranı kararı (YN-034). Gizlilik/KVKK son metni, /gizlilik, /en/privacy, /hesap-sil, mağaza metinleri, IARC / Veri güvenliği / App Privacy cevapları ve ürün kataloğu hazır (YN-009, YN-012, YN-017, YN-033) |

## Test sonuçları (5. tur, PY çalıştırdı; makine yükü 14–40, 4 çekirdek)

| Takım | Sonuç | Not |
|---|---|---|
| typecheck / lint / mobil-tsc / dom-paketi / domcheck | geçti (cdce437) | |
| vitest | geçti; `feel.test` yükte 5 sn'yi aştı → açık süre (f9124c1) | `codes.test` de yükte aşıyor (notaci) → MK-020 |
| `generate.mjs --check` | 208 satır güncel (26851fb) | |
| ui-mobile **normal**, web 320/390 × Chromium/WebKit | 4 × 128 ekran, 0 sorun (9a1fb11) | WebKit'te 12 alt sayfanın ilk karesi boş: ekran girişi animasyonu yükte geç başlıyor (ölçüldü, ≤ 1 sn'de görünür) → harness animasyonu beklemeli (MK-020) |
| ui-mobile **normal**, DOM (telefon kabuğu) | WebKit 320 ve 390 tam geçti; Chromium 320/390 kamp adımında 30 sn tıklama/görüntü zaman aşımı (yük 30–40) | aynı adım başka koşuda geçti → yük kaynaklı; yük düşünce yeniden (MK-020) |
| ui-mobile **büyük yazı**, web | 512 ekran (Chromium + WebKit × 320/390), 0 sorun | 320'de sonuç ekranının yapışkan düğmeleri ekranın ~%45'i (kaydırılabilir, kusur değil) |
| ui-mobile **büyük yazı**, DOM | 460 ekran (Chromium + WebKit × 320/390), 0 sorun | DOM Chromium'un kamp adımları burada geçti → normal kipteki düşüş yük kaynaklı |

## Bu tur yapılanlar (main'de)
- **Sürüm adayı (aday: 41b28fe, ff64bce, f40ca92, e155e50):**
  - Tam `npm run kabul` ilk denemede geçti: vitest 559, bot 40/40, ui-mobile 1044 ekran 0 sorun, kopma 520.
  - pwa-e2e 10/10; yerelde `uzak-duman` 37 denetim 0 hata; 50 oyunculu yükte p95 3,3 ms.
  - expo-doctor kayması giderildi (YN-039; expo 58.0.21, RN 0.88.1).
  - Bilinen sorunlar: [`surum-adayi.md`](surum-adayi.md).
- **PY:** `kabul --yalniz typecheck,lint,vitest` 559/559 ilk denemede (bca5a1a).
- **YN-040** (bca5a1a): Instagram "Karar sende" oylamaları. Sonuçları oyuna koymak bir söz.

## Öneri, sahip onayı bekliyor: "Kurucu Yolcular" (yayın öncesi birlikte yaratım)
- ~50 kurucuyla kapalı beta.
- Haftalık döngü: Pazartesi sürüm, Çarşamba oylama, Cuma "Sizin sayenizde", Pazar Takım Gecesi.
- Kalıcı "Kurucu Yolcu" rozeti ve çerçevesi.
- İsteğe bağlı oyun içi "Kurucular" teşekkür ekranı.
- "Hata Avcısı" görünüş unvanı.
- Topluluğun önerdiği bilgi yarışması sorusu ve kartlarda "Öneren: takma ad".
- Herkese açık yol haritası sayfası.
- WhatsApp grubu + Instagram yayın kanalı.
- Emirler hazır, sahip onaylayınca verilecek: "kurucu", "yolharitasi".

## Sürüyor
- **magaza** (bu iş): gizlilik son metni, yasal sayfalar, Ayarlar bağlantıları, mağaza kiti, eas.json gönderim profili (YN-009, YN-012, YN-017, YN-032, YN-033).
- Çalışan yok (koordinatöre göre). Sıradaki emirler: cuzdan (MK-035, P1), saglam2 (MK-034).
- **Sahipte:** Oracle kurulumu, Expo hesabı, vitrin seçimi (kareler yeniden çekilmeli), kararlar 4–12 ve 15–19.

## Not (çalışanlar için)
- **Kabul takımı tek komut:** `npm run kabul` (bütün takımlar sırayla, düşeni bir kez yeniden koşar, çıktıları siler; özet `tools/harness/out/kabul/ozet.json`). Alt küme: `npm run kabul -- --yalniz vitest,social` · liste: `--liste`.
- Disk dar (5. turda bir ara 557 MB'a indi). Harness çıktıları (`tools/harness/out/<takım>`) koşu bitince silinmeli.
- `node_modules`: `cp -al /home/user/oyun/node_modules` (+ `apps/mobile/node_modules`, `apps/web/node_modules`); ana kopya SDK 58.
- `kabul`'u `--yalniz` ile bölerken DOM takımlarını (domcheck, ui-mobile dom, *-e2e `--target both`) koşan parçaya `dom-paketi` de eklenmeli (aday notu).
- `social-e2e` önizleme sürecini kapatmıyor (YN-023) — koşudan sonra kendi PID'ini kapatın.
- **Gönderme kuralı:** göndermeden önce `git fetch origin main && git rebase FETCH_HEAD`. **Asla** `git reset --soft origin/main` yapmayın: eski `origin/main` ile yapılan commit, aradaki başkalarının işlerini geri alır (1f6ab15 olayı; 61a63d6 ile düzeltildi).
- Uzak depoda kalan yedek dalları (silinemedi, vekil 403; zararsız): wip-kamp-buyume, wip-kamp-gorev, wip-oynanis, wip-perf, wip-pm, wip-sdk58, wip-siralama, wip-yedek, wip-zorluk.

## Sahibin kararı gerekenler

| # | Karar | Öneri | Seçenekler |
|---|---|---|---|
| 1 | ~~Sunucu barındırma~~ (YN-006) | **KARAR (sahip): Oracle Cloud Always Free** (Ubuntu 24.04 ARM 2 OCPU / 12 GB, DuckDNS, Caddy HTTPS, web aynı sunucuda; Pay As You Go + 1 $ bütçe alarmı önerildi). Hazırlık: sunucu çalışanı; doğrulama planı [`sunucu-dogrulama.md`](sunucu-dogrulama.md). | — |
| 2 | ~~Alan adı~~ (YN-007) | **KARAR: DuckDNS alt alan adı** (beta için); mağaza öncesi kendi alan adı önerilir (~10 $/yıl). | — |
| 3 | **Yönetici kodunu yenile** (YN-002) | Kurulumda çözülür: `kur.sh` kodu gizli girişle sorar, yalnız özeti yazar. Kodu kimseye yazmayın. | — |
| 4 | **Apple / Google geliştirici hesapları** | Şirket (Ltd/A.Ş.) ise **aiHear şirket hesabı**: yayıncı adı şirket; Google'ın kişisel hesaplara koyduğu "12 test kullanıcısı × 14 gün" şartı yok. D-U-N-S gerekir. **Sahibin şirket türü onayı bekleniyor.** Metinlerde yayıncı adı tek yer tutucu: `{YAYINCI}` = aiHear (`apps/web/src/yasal/ayar.json`) | Bireysel hesap da olur; mağazada satıcı olarak kişi adı görünür |
| 4a | ~~Uygulama içi satın alma ilk sürümde mi?~~ (YN-032) | **KARAR (sahip): EVET, ilk sürümde** (RevenueCat → StoreKit / Play Billing) | — |
| 4b | ~~Mağaza hazırlığını kim yapar?~~ | **KARAR (sahip): ajan ekibi hazırlar** (ikon, gizlilik metni, mağaza metinleri, formlar) **ve hesaplar açılınca yüklemeleri de ajan yapar.** Sahip: hesaplar, kimlik, banka/vergi, yükleme anahtarları (App Store Connect API .p8 + Key ID + Issuer ID, Play hizmet hesabı JSON, Expo erişim anahtarı) | — |
| 5 | **Gizlilik / KVKK metni** (YN-009) | Son metin hazır ve yayında (`/gizlilik`, `/en/privacy`, `/hesap-sil`). Sizden: iletişim e-postası, şirket unvanı ve adresi, Oracle bölgesi; mağazadan önce avukat okuması önerilir (KVKK m.9 yurt dışı aktarım dayanağı, VERBİS; [`gizlilik.md`](gizlilik.md) "Açık hukuk konuları") | — |
| 20 | **Yaş ekranı** (YN-034) | Şimdilik yok; Google "çocukların ilgisini çekebilir" incelemesinde isterse nötr yaş sorusu eklenir | a) Şimdilik yok (önerim) · b) İlk açılışta nötr yaş sorusu |
| 6 | **İkon ve açılış görseli** (YN-010) | Odi karakterli çizilmiş tek ikon (1024 px) — tasarımcı/çizer | Mevcut ikon geometrik yer tutucu |
| 7 | **Çökme raporu** (YN-011) | Dış servis yerine kendi sunucumuza kişisel veri içermeyen, hız sınırlı hata kaydı | a) Kendi sunucu · b) Sentry (dış servis; gizlilik metnine eklenir) · c) Şimdilik yok |
| 8 | **"Jeton" diyen 7 anlatıcı satırı** (YN-013) | Beta öncesi dokunmayın; gerekirse "altın" ya da "nota" ile yeniden seslendirme | — |
| 9 | **Bölge giriş bölümleri de kademe kademe zorlaşsın mı?** (zorluk çalışanı bulgusu) | Bugünkü gibi kalsın: giriş bölümleri bilinçli "nefes" bölümüdür, bölge finali doruk; yalnız Apeks girişinin ortalaması Koklea Orta'nınkinin altında kalmasın diye o tek girişe küçük bir artış yeterli. Ölçüm docs/12 §6'da. | a) Olduğu gibi · b) Yalnız Apeks girişi biraz zorlaşsın (önerim) · c) Bütün girişler kademeli artsın (erken bölümler sertleşir, yeni oyuncu kaybı riski) |
| 10 | **Kristale güç vermeyen bir harcama yeri** (ekonomi Ö5) | Takımlı oyuncu 14 günde 563-881 kristal biriktiriyor, tek harcama yeri hızlandırma. Önerim: yalnız görünüş/kişiselleştirme harcaması (kamp süsü, Odi kostümü renk varyantı, takım amblemi çerçevesi); güç ya da sıralama etkisi yok, pay-to-win yok. | a) Süs ve kostüm (önerim) · b) Takım için ortak süs/anıt bağışı · c) Şimdilik yok (kristal birikir) |
| 11 | **İçerik derinliği: 40 bölüm ~69 dakika** (ekonomi ölçümü) | 40. bölüme 6 oturumla 2., 1 oturumla 9. günde varılıyor; sonrası tekrar ve depo. Önerim (b) + (a) sırayla: önce günlük meydan okuma, sonra yeni bölge. | a) Yeni bölge/yolculuk (+10 bölüm, yeni biyom ve boss; ~1–2 hafta çalışan işi + odyoloji içeriği sizin onayınızla) · b) Günlük/haftalık meydan okuma modu: üretilmiş bölüm, herkese aynı tohum, takım sıralaması (~3–5 gün; dürüst, sahte sayaç yok) · c) Sonsuz mod (artan zorluklu üretilmiş parkur, kişisel rekor; ~3–4 gün) · d) Bölüm düzenleyici (oyuncu bölümü; moderasyon ister, ~2 hafta + risk) |
| 12 | **Klinik: kademeler daha erken mi, vaka sayısı artsın mı?** (MK-010 sonrası) | Kademeler Sv 1/2/3 yapıldı; 32 vakayla günde 3 hasta 14 günde en çok 11 gün yeni hasta demek. Önerim: (b) yeni vakaları siz onaylayarak ekleyelim (odyoloji içeriği sizin uzmanlık alanınız); (a) yalnız boşlukları biraz daha kapatır. | a) Ö4b: kademeler Sv 1/1/2 (yeni içerik yok, ilk haftada daha çok hasta) · b) +16–24 yeni vaka (taslağı biz hazırlarız, tıbbi doğruluk sizin onayınızla) · c) Olduğu gibi |
| 13 | ~~`kg-h6-giris` yeni metin~~ | **KARAR (sahip): ONAYLANDI** — "Bir kampı birlikte çalışmak büyütür. Takımınla ya da kendi başına: yardım et, öğren, zor vakada danış." Seslendirme: çalışan ses2 (YN-028). | — |
| 14 | ~~`kamp-sira-01` satırı~~ | **KARAR (sahip): ONAYLANDI** (önerimin aksine; sahip satırı istedi) — "Yapı ustası tek elle iki iş tutmaz ama sırayı bilir: bir sonrakini şimdi seç, bedelini öde; bu bitince kendiliğinden başlar. Vazgeçersen jetonun geri gelir." "Sıraya al" ilk görününce bir kez. Seslendirme + bağlama: ses2 (YN-028). | — |
| 15 | **`kamp-sira-01` ve `kg-h6-giris` seslendirmesini dinleyin** (YN-028) | Ekranda onaylı metin aynen var. Seste "jetonun" okunuşu sınırda: Whisper "cetonun" duyuyor. Kulağa doğru geliyorsa kalsın. | a) Kalsın · b) Yeniden seslendir · c) Seste "jetonun" yerine "ödediğin geri gelir" (yazı değişmez) |
| 16 | **15 kısa satırın ses düzeyi** (ses-duzeyi.md) | 15 satır (çoğu 3 sn'den kısa) 2–8 LU sessiz. Önerim: yalnız kazanç (ses aynı, sadece yükseltme); dosya içeriği ve tını değişmez. | a) Yalnız kazanç (önerim) · b) Oyunda satır başı kazanç tablosu (dosya değişmez) · c) Olduğu gibi |
| 17 | **Anlatım sırasında müzik ne kadar kısılsın?** | Bugün 0.3 (−10 dB). Ölçüm dengeli diyor; değiştirmeyin. Dinleyip "müzik çok kayboluyor" derseniz 0.45. | a) 0.3 kalsın (önerim) · b) 0.45–0.5 |
| 18 | **Müzik parçaları arası düzey** (MK-023, 62844a8) | Menü ve Sinir müziği +2,8 dB, Kanal −1,5 dB yapıldı (parçalar arası fark 5,8 → 2,6 LU). Ölçüm iyi; kulakla dinleyip onaylayın, beğenmezseniz bu commit tek başına geri alınır. | a) Kalsın (önerim) · b) Geri al |
| 19 | **Dolgu renklerinde kontrast düzeltmesi** (MK-017, Ö1–Ö7: bildirim rozeti, mor ve mercan düğmeler, seviye rozeti, Süsle, kademe çipi, etkinlik şeridi) | Hepsini kabul edin: renk tonu aynı kalıyor, yalnız açık uçlar bir ton koyulaşıyor (önce/sonra karşılaştırmasında fark ince). Küçük beyaz yazılar 2–3:1'den ≥ 4,5:1'e çıkıyor. İşitme odaklı oyunun oyuncuları arasında görme güçlüğü olanlar da olacak. En belirgin değişiklik Ö5: Süsle düğmesinde kahve yazı beyaz olur. | a) Hepsi (önerim) · b) Ö5 hariç hepsi · c) Yalnız Ö1 (rozetler) · d) Hiçbiri; gerekçeli istisna olarak kalır |
| 20 | **Kapalı beta sürüm numarası** | 0.9.0 (aday çalışanının önerisi): mağaza öncesi, 1.0.0'a yer bırakır. | a) 0.9.0 (önerim) · b) 1.0.0 · c) 0.1.0 kalsın |
| 21 | **ODY-İLK ödülü** (YN-037) | Bir kez kullanılabilen kozmetik (Odi rengi ya da süs) + 300 jeton; güç vermez. Yayından önce sunucuda tanımlanacak. | a) Öneri · b) Yalnız jeton · c) Yalnız kozmetik |
| 22 | **Kurucu Yolcular** (birlikte yaratım önerisi, yukarıda) | Onaylayın. Kurucu sayısı 50: takım ve yarış dolu olur, geri bildirim okunabilir kalır. | a) Onay · b) Değişiklikle · c) Hayır |
| 23 | **Kurucu sayısı** | 50 (en çok 60) | — |
| 24 | **Buluşma yeri** | WhatsApp grubu (hızlı) + Instagram yayın kanalı (duyuru). Grup kuralları ve moderatör sahipte. 13 yaş ve kişisel veri için gizlilik metnine not. | a) WhatsApp · b) Discord · c) Yalnız Instagram |
| 25 | **Topluluk adı** | "Kurucu Yolcular" (oyunun "Yolcu" diliyle uyumlu) | Sahip seçer |
