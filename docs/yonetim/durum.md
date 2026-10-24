# Durum Panosu (Proje Yöneticisi)

**Son tur:** 1. tur · 2026-10-24 · baz: `origin/main` 744ae7e → bu turun commitleri aşağıda.
Ayrıntılı iş listesi: [`is-listesi.md`](is-listesi.md). Taslaklar: [`gizlilik-TASLAK.md`](gizlilik-TASLAK.md), [`magaza-TASLAK.md`](magaza-TASLAK.md).

## Genel hazırlık

| Aşama | Durum | Eksik |
|---|---|---|
| **İç test** (aynı Wi-Fi, Expo Go) | Hazır | — |
| **Kapalı beta** (TestFlight / APK, 20-50 kişi) | 3 eksik | Kalıcı diskli herkese açık sunucu (YN-006), derlemede sunucu adresi (YN-007), yeni yönetici kodu (YN-002) |
| **Mağaza** (App Store + Google Play) | 7 eksik | Kapalı betanın 3'ü + gizlilik/KVKK metni ve URL'si (YN-009), ikon ve açılış görseli (YN-010), mağaza listesi ve yaş derecelendirmesi (YN-012), çökme raporu kararı (YN-011) |

## Test sonuçları (bu tur, PY çalıştırdı)

| Takım | Sonuç | Not |
|---|---|---|
| `npm run typecheck` | geçti | main 744ae7e |
| `npm run lint` | geçti | |
| `vitest run` | 54 dosya / 393 test geçti (720 sn) | main 744ae7e; PY değişiklikleriyle sunucu testleri 23 dosya geçti |
| `generate.mjs --check` | 207/207 satır güncel | |
| `bot.mjs --levels 1-40` | 40/40 tamamlandı | Chromium, 3 paralel |
| `bot.mjs --idle 1` | 0/40 bitti (doğru: dokunmadan hiçbir bölüm bitmiyor) | |
| `reset-e2e` web + dom | geçti | sunucu tarafı silme denetimi eklendi (YN-004) |
| `onboarding-e2e` web + dom, 390 + 320 | geçti (0 sorun) | |
| `codes-e2e`, `team-apply-e2e`, `teamrace-e2e` web + dom | geçti | |
| `ui-mobile-check` web + dom, Chromium + WebKit, 390 + 320 | 512 ekran, 12 sorun → düzeltildi, yeniden koşu: bkz. aşağı | YN-019, YN-020 |
| _diğerleri_ | _tur sonunda doldurulacak_ | |

## Bu tur yapılanlar
- e276074 Güvenlik: yönetici kodu kaba kuvvete kapalı, sahte X-Forwarded-For etkisiz, üretimde depodaki özet kullanılmaz (YN-001)
- 75599c1 Android APK profili, uyarlanabilir ikon arka planı, EAS için `.npmrc` (YN-003, YN-005)
- Hesabı silme (YN-004), veritabanı yedeği (YN-008), README belge dizini, harness düzeltmeleri, 320 px takım sohbeti (YN-019, YN-020)

## Sürüyor
- _(tur sonunda)_

## Sahibin kararı gerekenler

| # | Karar | Öneri | Seçenekler |
|---|---|---|---|
| 1 | **Sunucu barındırma** (YN-006) | Render "Starter" (aylık ~7 $) + 1 GB kalıcı disk (~0,25 $/ay); `render.yaml` hazır, yalnız plan ve disk eklenecek. `ODI_BACKUP_DIR` diske. | a) Render ücretli + disk (en az iş) · b) Hetzner/DigitalOcean VPS (~5 €/ay, Docker, bakım bizde) · c) Ücretsiz plan (her dağıtımda veri silinir — beta için uygun değil) |
| 2 | **Alan adı** (YN-007) | `api.<alanadi>` → sunucu (`wss://`), gizlilik sayfası aynı alan adında | Render'ın verdiği `*.onrender.com` adresi geçici olarak da çalışır |
| 3 | **Yönetici kodunu yenile** (YN-002) | Depo herkese açık; yeni, en az 16 karakterlik kodu yalnız siz bilin, özetini sunucuya verin (`npm run kod -- ozet`) | Depoyu gizli yapmak da riski azaltır ama eski özet yine de geçmişte kalır |
| 4 | **Apple / Google geliştirici hesapları** | Apple Developer (yıllık 99 $), Google Play Console (tek sefer 25 $); kimlik: aiHear şirketi | Bireysel hesap da olur, ama mağazada satıcı adı kişi adı görünür |
| 5 | **Gizlilik / KVKK metni** (YN-009) | TASLAK'ı avukata verin; yurt dışı aktarım dayanağını (sunucu ülkesi) netleştirin | — |
| 6 | **İkon ve açılış görseli** (YN-010) | Çizer ya da tasarımcıdan Odi karakterli tek ikon (1024 px); mevcut olan yer tutucu | — |
| 7 | **Çökme raporu** (YN-011) | Dış servis yerine kendi sunucumuza kişisel veri içermeyen, hız sınırlı hata kaydı | a) Kendi sunucu (dış servis yok) · b) Sentry (ücretsiz katman, dış servis, gizlilik metnine eklenir) · c) Şimdilik yok |
| 8 | **"Jeton" diyen 7 anlatıcı satırı** (YN-013) | Beta öncesi dokunmayın; şikâyet gelirse "altın" / "nota" gibi bir sözle yeniden seslendirilir | — |
