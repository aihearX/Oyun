# Durum Panosu (Proje Yöneticisi)

> **Görev: sahibi teslim alana kadar sürekli geliştirme.** Turlar ara vermeden art arda koşar; tek durma koşulu sahibin "teslim aldım" demesi ya da durdurması. main'in kararlılığı hızdan önce gelir.

**Son tur:** 6. tur · 2026-10-26 · başlangıç b39a8a1 → tur sonu 3e69e07 (+ bu belge).
Ayrıntılı iş listesi: [`is-listesi.md`](is-listesi.md). Taslaklar: [`gizlilik-TASLAK.md`](gizlilik-TASLAK.md), [`magaza-TASLAK.md`](magaza-TASLAK.md). Ekonomi ölçümü: [`ekonomi-olcum.md`](ekonomi-olcum.md). Ses düzeyi: [`ses-duzeyi.md`](ses-duzeyi.md).

## Genel hazırlık

| Aşama | Durum | Eksik |
|---|---|---|
| **İç test** (aynı Wi-Fi, Expo Go SDK 58) | Hazır | — |
| **Kapalı beta** (web + APK, 20-50 kişi) | 4 eksik (3'ü yolda) | Oracle sunucusu: karar verildi, betik hazırlanıyor, kurulum sahipte, sonra D1–D16 (YN-006) · derlemede sunucu adresi (YN-007, sürüyor) · yeni yönetici kodu (YN-002, kurulumda) · ilk EAS derlemesi (YN-024; ücretsiz Expo hesabı sahipte) |
| **Mağaza** (App Store + Google Play) | 8 eksik | Kapalı betanın 4'ü + gizlilik/KVKK metninin hukuk onayı ve URL'si (YN-009), ikon ve açılış görseli (YN-010), mağaza listesi ve yaş derecelendirmesi (YN-012), çökme raporu kararı (YN-011) |

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
- **Sahip kararı:** sunucu Oracle Cloud Always Free + DuckDNS + Caddy (karar 1–2). Doğrulama planı: [`sunucu-dogrulama.md`](sunucu-dogrulama.md), D1–D16.
- **Çalışanlar (PY doğruladı, kabul):**
  - 4901df5 sunucu kurulum betikleri (YN-006 hazırlığı, YN-007 yer tutucu).
  - e6dbe34 + 62844a8 sahipli duck + "Anlatıcı ses düzeyi" + müzik parça kazancı (MK-023).
  - a913ee4 level-gen tembel yükleme (YN-025): ilk JS 710 → 611 KB.
  - b6278fd uzak denetim araçları (MK-024): yerel üretim sunucusunda PY koştu, 0 hata, hesaplar silindi.
- **PY:** c0a2d2f doğrulama planı ve MK-024 · iş listesi: YN-029 hesap silmede artık satırlar (P1, KVKK/mağaza), YN-030 IP başına hesap sınırı (P3).

## Sürüyor
- **kontrast** (MK-017)
- **kopma** (MK-019)
- **vitrin** (MK-022)
- **Sırada:** saglam (MK-020, kontrast inince) → hesapsil (YN-029, kopma inince) → derin (MK-021).
- **Sahipte:** Oracle kurulumu (Adım 1–5), Expo hesabı, kararlar 15–18 (dinleme).

## Not (çalışanlar için)
- **Kabul takımı tek komut:** `npm run kabul` (bütün takımlar sırayla, düşeni bir kez yeniden koşar, çıktıları siler; özet `tools/harness/out/kabul/ozet.json`). Alt küme: `npm run kabul -- --yalniz vitest,social` · liste: `--liste`.
- Disk dar (5. turda bir ara 557 MB'a indi). Harness çıktıları (`tools/harness/out/<takım>`) koşu bitince silinmeli.
- `node_modules`: `cp -al /home/user/oyun/node_modules` (+ `apps/mobile/node_modules`, `apps/web/node_modules`); ana kopya SDK 58.
- `social-e2e` önizleme sürecini kapatmıyor (YN-023) — koşudan sonra kendi PID'ini kapatın.
- Uzak depoda kalan yedek dalları (silinemedi, vekil 403; zararsız): wip-kamp-buyume, wip-kamp-gorev, wip-oynanis, wip-perf, wip-pm, wip-sdk58, wip-siralama, wip-yedek, wip-zorluk.

## Sahibin kararı gerekenler

| # | Karar | Öneri | Seçenekler |
|---|---|---|---|
| 1 | ~~Sunucu barındırma~~ (YN-006) | **KARAR (sahip): Oracle Cloud Always Free** (Ubuntu 24.04 ARM 2 OCPU / 12 GB, DuckDNS, Caddy HTTPS, web aynı sunucuda; Pay As You Go + 1 $ bütçe alarmı önerildi). Hazırlık: sunucu çalışanı; doğrulama planı [`sunucu-dogrulama.md`](sunucu-dogrulama.md). | — |
| 2 | ~~Alan adı~~ (YN-007) | **KARAR: DuckDNS alt alan adı** (beta için); mağaza öncesi kendi alan adı önerilir (~10 $/yıl). | — |
| 3 | **Yönetici kodunu yenile** (YN-002) | Kurulumda çözülür: `kur.sh` kodu gizli girişle sorar, yalnız özeti yazar. Kodu kimseye yazmayın. | — |
| 4 | **Apple / Google geliştirici hesapları** | Apple Developer (yıllık 99 $), Google Play Console (bir kez 25 $), aiHear şirketi adına | Bireysel hesap da olur; mağazada satıcı olarak kişi adı görünür |
| 5 | **Gizlilik / KVKK metni** (YN-009) | TASLAK'ı avukata verin; sunucu ülkesine göre yurt dışı aktarım dayanağını netleştirin | — |
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
