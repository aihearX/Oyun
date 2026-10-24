# Durum Panosu (Proje Yöneticisi)

**Son tur:** 1. tur · 2026-10-24 · başlangıç `origin/main` 744ae7e.
Ayrıntılı iş listesi: [`is-listesi.md`](is-listesi.md). Taslaklar: [`gizlilik-TASLAK.md`](gizlilik-TASLAK.md), [`magaza-TASLAK.md`](magaza-TASLAK.md).

## Genel hazırlık

| Aşama | Durum | Eksik |
|---|---|---|
| **İç test** (aynı Wi-Fi, Expo Go) | **Engelli** — telefondaki Expo Go SDK 58'e güncellendi, proje SDK 57 | Expo SDK 58'e yükseltme (YN-022, çalışan sürüyor) |
| **Kapalı beta** (TestFlight / APK, 20-50 kişi) | 4 eksik | YN-022 + kalıcı diskli herkese açık sunucu (YN-006), derlemede sunucu adresi (YN-007), yeni yönetici kodu (YN-002) |
| **Mağaza** (App Store + Google Play) | 8 eksik | Kapalı betanın 4'ü + gizlilik/KVKK metni ve URL'si (YN-009), ikon ve açılış görseli (YN-010), mağaza listesi ve yaş derecelendirmesi (YN-012), çökme raporu kararı (YN-011) |

## Test sonuçları (bu tur, PY çalıştırdı)

| Takım | Sonuç | Not |
|---|---|---|
| `npm run typecheck` / `npm run lint` | geçti | 744ae7e ve tur sonu (9d1b423) |
| `vitest run` | 744ae7e: 54 dosya / 393 test; tur sonu 9d1b423: **56 dosya / 398 test geçti** | PY eklemeleri: `account.test.ts`, `backup.test.ts`, `codes.test.ts` +2 |
| `generate.mjs --check` | 207/207 satırın kaydı güncel | |
| `bot.mjs --levels 1-40` | 40/40 tamamlandı | Chromium, 3 paralel |
| `bot.mjs --idle 1` | 0/40 bitti (doğru) | dokunmadan hiçbir bölüm bitmiyor |
| `reset-e2e` web + dom | geçti | sunucu tarafı silme denetimi eklendi |
| `onboarding-e2e` web + dom, 390 + 320 | geçti, 0 sorun | ekranlar incelendi (hikâye → bölüm 1 → turlar → takım) |
| `codes` / `team-apply` / `teamrace` / `comm` -e2e, web + dom | geçti (15+20+15+32… denetim) | |
| `social`, `friends`, `events`, `race`, `camp`, `vaka` -e2e | geçti | `social` önce harness kayması yüzünden düşüyordu (YN-019) |
| `domcheck --level 1` | geçti | açılış, bölüm 1 ⭐3, dokunma, kaydırma |
| `ui-mobile-check` web + dom × Chromium + WebKit × 390 + 320 | ilk koşu 512 ekran, 12 sorun → 2 kök neden düzeltildi | yeniden: `takim,iletisim` 320 (116 ekran) ve `gorev` 0 sorun; tam ikinci koşu disk dolunca/zaman aşımında son bölümde kesildi, kesilene kadar tek sorun YN-020'ydi |
| `hud-fit` | ui-mobile-check içinde her ekranda geçti | |

## Bu tur yapılanlar (main'e gönderildi)
- e276074 Güvenlik: yönetici kodu kaba kuvvete kapalı, sahte `X-Forwarded-For` etkisiz, üretimde depodaki özet kullanılmaz (YN-001)
- 75599c1 Android APK profili, uyarlanabilir ikon arka planı, EAS için `.npmrc` (YN-003, YN-005)
- 8471012 + 2076b3b "Her şeyi sıfırla" sunucudaki hesabı da siler — KVKK/GDPR, App Store 5.1.1(v) (YN-004)
- 9d7501b Veritabanı yedeği `ODI_BACKUP_DIR` (YN-008)
- a925d92 320×640 takım sohbeti yazma kutusu (YN-020)
- 8901eb1 Harness kaymaları ve yalancı "geçti" (YN-019)
- 9d1b423 Metro önbelleği çalışma ağacına göre (YN-021)
- b1d37e0 README belge dizini; `docs/yonetim/` (bu pano, iş listesi, TASLAK gizlilik ve mağaza metinleri)

## Sürüyor
- **YN-022 Expo SDK 58'e yükseltme** — ayrı çalışan (`/home/user/oyun-sdk58`, yedek `wip-sdk58`). Bitince PY doğrular: dom e2e takımları + `domcheck` + `jest`.

## Sonraki tur (2. tur) planı
1. YN-022 SDK 58 indiğinde doğrula (dom e2e + domcheck + jest), sonra üstüne yeniden taban al.
2. Çalışanlara: MK-001 ekonomi ölçümü, MK-002 düşük donanım ölçümü + paket bölme (YN-016), YN-014 şema sürümü + YN-015 hesap açma sınırı (tek çalışan, sunucu).
3. Sahip kararları gelirse: YN-006/007 (sunucu adresi → `eas.json` env, SDK 58 indikten sonra).

Not: 1. turda bu oturumda çalışan başlatma aracı (Agent) yoktu; işleri PY kendisi yaptı ve doğruladı.

## Not (çalışanlar için)
- Disk çok dar (tur içinde 192 MB'a kadar düştü). Harness çıktıları (`tools/harness/out/<takım>`) koşu bitince silinmeli; `ui-mobile-check` tam koşusu ~450 MB ekran görüntüsü üretir.
- `social-e2e` önizleme sunucusunu kapatmıyor (artık `vite preview` süreci kalıyor) — koşudan sonra kendi PID'ini kapatın.

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
