# Durum Panosu (Proje Yöneticisi)

> **Görev: sahibi teslim alana kadar sürekli geliştirme.** Turlar ara vermeden art arda koşar; tek durma koşulu sahibin "teslim aldım" demesi ya da durdurması. main'in kararlılığı hızdan önce gelir.

**Son tur:** 2. tur · 2026-10-25 · başlangıç b630a2d → tur sonu 375562e.
Ayrıntılı iş listesi: [`is-listesi.md`](is-listesi.md). Taslaklar: [`gizlilik-TASLAK.md`](gizlilik-TASLAK.md), [`magaza-TASLAK.md`](magaza-TASLAK.md).

## Genel hazırlık

| Aşama | Durum | Eksik |
|---|---|---|
| **İç test** (aynı Wi-Fi, Expo Go SDK 58) | Hazır | — |
| **Kapalı beta** (TestFlight / APK, 20-50 kişi) | 4 eksik | Kalıcı diskli herkese açık sunucu (YN-006), derlemede sunucu adresi (YN-007), yeni yönetici kodu (YN-002), ilk EAS derlemesinin denenmesi (YN-024) |
| **Mağaza** (App Store + Google Play) | 8 eksik | Kapalı betanın 4'ü + gizlilik/KVKK metninin hukuk onayı ve URL'si (YN-009; uygulama içi TASLAK hazır), ikon ve açılış görseli (YN-010), mağaza listesi ve yaş derecelendirmesi (YN-012), çökme raporu kararı (YN-011) |

## Test sonuçları (2. tur, PY çalıştırdı; tur sonu kodu)

| Takım | Sonuç | Not |
|---|---|---|
| typecheck / lint / mobil tsc | geçti | |
| `vitest run` | 60 dosya / 410 test geçti | |
| mobil `jest`, `expo-doctor` | 2/2, 20/20 | SDK 58 |
| `bot.mjs` 1-40 + boşta | 40/40; boşta 0/40 (doğru) | zorluk değişikliğiyle; WebKit 18–23 + 38–40 9/9 |
| `domcheck` | geçti | |
| `reset`, `social`, `codes`, `camp`, `vaka` -e2e | geçti | web + dom |
| `team-apply`, `teamrace`, `comm` -e2e (dom) | geçti | SDK 58 doğrulaması |
| `onboarding-e2e` | web Chromium 390/320 (1–10. bölüm) + WebKit 390/320 + dom Chromium/WebKit: 0 sorun | bölüm başına en çok 2 açılım turu |
| `ui-mobile-check` web Chromium + WebKit | 488 ekran, 0 sorun | WebKit'te bulunan stilsiz kart düzeltildikten sonra (YN-026) |
| `ui-mobile-check` dom | 451 ekran, 0 sorun | son bileşim zaman aşımına kadar; çalışan raporu 224/0 |

## Bu tur yapılanlar (main'de)
- **Çalışanlar (PY doğruladı, kabul):** 61e30f4 Expo SDK 58 (YN-022) · 2483961 bölge finalleri ve süreli bölüm yıldızları (MK-003, MK-004) · 6e3debf paket bölme ve hızlı ilk açılış (YN-016, MK-002)
- **PY:** fd68fbc şema sürümü ve göçler (YN-014) · 88f2313 IP başına yeni hesap sınırı (YN-015) · 05ecdd3 Ayarlar › Gizlilik ve hakkında, TASLAK (YN-017) · 3f5b653 kod deneme kaydı 90 gün · d15a497 + 2347e6f FTUE testi 10. bölüme, bölüm başına en çok 2 tur (MK-005, MK-007) · 375562e paket bölme sonrası stilsiz sonuç kartı (YN-026'nın ilk parçası)

## Sürüyor
- Yok (üç çalışan bitti). Sonraki emirler raporda.

## Sonraki tur (3. tur) planı
1. Yeni çalışanların sonuçlarını doğrula (MK-008 yüzme yıldızları, MK-001 ekonomi ölçümü, kabul takımı / YN-026 CSS).
2. PY: YN-026 statik CSS testi (çalışana verilmezse), YN-025 risk izleme, kalan P2'ler.
3. Sahip kararları gelirse: YN-006/007 (sunucu adresi → `eas.json` env).

## Not (çalışanlar için)
- **Kabul takımı tek komut:** `npm run kabul` (bütün takımlar sırayla, düşeni bir kez yeniden koşar, çıktıları siler; özet `tools/harness/out/kabul/ozet.json`). Alt küme: `npm run kabul -- --yalniz vitest,social` · liste: `--liste`.
- Disk dar (~4–5 GB). Harness çıktıları (`tools/harness/out/<takım>`) koşu bitince silinmeli.
- `node_modules`: `cp -al /home/user/oyun/node_modules` (+ `apps/mobile/node_modules`, `apps/web/node_modules`); ana kopya SDK 58.
- `social-e2e` önizleme sürecini kapatmıyor (YN-023) — koşudan sonra kendi PID'ini kapatın.
- Uzak depoda kalan yedek dalları (silinemedi, vekil 403; zararsız): wip-kamp-buyume, wip-kamp-gorev, wip-oynanis, wip-perf, wip-pm, wip-sdk58, wip-siralama, wip-yedek, wip-zorluk.

## Sahibin kararı gerekenler

| # | Karar | Öneri | Seçenekler |
|---|---|---|---|
| 1 | **Sunucu barındırma** (YN-006) | Render "Starter" (aylık ~7 $) + 1 GB kalıcı disk (~0,25 $/ay); `render.yaml` hazır, yalnız plan ve disk eklenecek, `ODI_BACKUP_DIR` diske. | a) Render ücretli + disk (en az iş) · b) VPS (Hetzner / DigitalOcean, ~5 €/ay, Docker; bakım bizde) · c) Ücretsiz plan: her dağıtımda veri silinir — beta için uygun değil |
| 2 | **Alan adı** (YN-007) | `api.<alan-adı>` → sunucu (`wss://`); gizlilik sayfası aynı alan adında | Geçici olarak Render'ın `*.onrender.com` adresi de çalışır |
| 3 | **Yönetici kodunu yenile** (YN-002) | Depo herkese açık; en az 16 karakterlik yeni kodu yalnız siz bilin, özetini sunucuya ortam değişkeni olarak verin (`npm run kod -- ozet`) | Depoyu gizli yapmak riski azaltır ama eski özet git geçmişinde kalır |
| 4 | **Apple / Google geliştirici hesapları** | Apple Developer (yıllık 99 $), Google Play Console (bir kez 25 $), aiHear şirketi adına | Bireysel hesap da olur; mağazada satıcı olarak kişi adı görünür |
| 5 | **Gizlilik / KVKK metni** (YN-009) | TASLAK'ı avukata verin; sunucu ülkesine göre yurt dışı aktarım dayanağını netleştirin | — |
| 6 | **İkon ve açılış görseli** (YN-010) | Odi karakterli çizilmiş tek ikon (1024 px) — tasarımcı/çizer | Mevcut ikon geometrik yer tutucu |
| 7 | **Çökme raporu** (YN-011) | Dış servis yerine kendi sunucumuza kişisel veri içermeyen, hız sınırlı hata kaydı | a) Kendi sunucu · b) Sentry (dış servis; gizlilik metnine eklenir) · c) Şimdilik yok |
| 8 | **"Jeton" diyen 7 anlatıcı satırı** (YN-013) | Beta öncesi dokunmayın; gerekirse "altın" ya da "nota" ile yeniden seslendirme | — |
| 9 | **Bölge giriş bölümleri de kademe kademe zorlaşsın mı?** (zorluk çalışanı bulgusu) | Bugünkü gibi kalsın: giriş bölümleri bilinçli "nefes" bölümüdür, bölge finali doruk; yalnız Apeks girişinin ortalaması Koklea Orta'nınkinin altında kalmasın diye o tek girişe küçük bir artış yeterli. Ölçüm docs/12 §6'da. | a) Olduğu gibi · b) Yalnız Apeks girişi biraz zorlaşsın (önerim) · c) Bütün girişler kademeli artsın (erken bölümler sertleşir, yeni oyuncu kaybı riski) |
| 10 | **Kristale güç vermeyen bir harcama yeri** (ekonomi Ö5) | Takımlı oyuncu 14 günde 563-881 kristal biriktiriyor, tek harcama yeri hızlandırma. Önerim: yalnız görünüş/kişiselleştirme harcaması (kamp süsü, Odi kostümü renk varyantı, takım amblemi çerçevesi); güç ya da sıralama etkisi yok, pay-to-win yok. | a) Süs ve kostüm (önerim) · b) Takım için ortak süs/anıt bağışı · c) Şimdilik yok (kristal birikir) |
| 11 | **İçerik derinliği: 40 bölüm ~69 dakika** (ekonomi ölçümü) | 40. bölüme 6 oturumla 2., 1 oturumla 9. günde varılıyor; sonrası tekrar ve depo. Önerim (b) + (a) sırayla: önce günlük meydan okuma, sonra yeni bölge. | a) Yeni bölge/yolculuk (+10 bölüm, yeni biyom ve boss; ~1–2 hafta çalışan işi + odyoloji içeriği sizin onayınızla) · b) Günlük/haftalık meydan okuma modu: üretilmiş bölüm, herkese aynı tohum, takım sıralaması (~3–5 gün; dürüst, sahte sayaç yok) · c) Sonsuz mod (artan zorluklu üretilmiş parkur, kişisel rekor; ~3–4 gün) · d) Bölüm düzenleyici (oyuncu bölümü; moderasyon ister, ~2 hafta + risk) |
