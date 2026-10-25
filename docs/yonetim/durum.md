# Durum Panosu (Proje Yöneticisi)

> **Görev: sahibi teslim alana kadar sürekli geliştirme.** Turlar ara vermeden art arda koşar; tek durma koşulu sahibin "teslim aldım" demesi ya da durdurması. main'in kararlılığı hızdan önce gelir.

**Son tur:** 4. tur · 2026-10-25 · başlangıç 1487c8c → tur sonu 9ad19a6 (+ bu belge).
Ayrıntılı iş listesi: [`is-listesi.md`](is-listesi.md). Taslaklar: [`gizlilik-TASLAK.md`](gizlilik-TASLAK.md), [`magaza-TASLAK.md`](magaza-TASLAK.md). Ekonomi ölçümü: [`ekonomi-olcum.md`](ekonomi-olcum.md).

## Genel hazırlık

| Aşama | Durum | Eksik |
|---|---|---|
| **İç test** (aynı Wi-Fi, Expo Go SDK 58) | Hazır | — |
| **Kapalı beta** (TestFlight / APK, 20-50 kişi) | 4 eksik | Kalıcı diskli herkese açık sunucu (YN-006), derlemede sunucu adresi (YN-007), yeni yönetici kodu (YN-002), ilk EAS derlemesinin denenmesi (YN-024) |
| **Mağaza** (App Store + Google Play) | 8 eksik | Kapalı betanın 4'ü + gizlilik/KVKK metninin hukuk onayı ve URL'si (YN-009), ikon ve açılış görseli (YN-010), mağaza listesi ve yaş derecelendirmesi (YN-012), çökme raporu kararı (YN-011) |

## Test sonuçları (4. tur, PY çalıştırdı)

| Takım | Sonuç | Not |
|---|---|---|
| typecheck / lint / vitest | geçti (63 dosya / 422+ test) | tam vitest artık ~2 dk (ölçüm önbelleği, MK-013); soğuk 2.198 sn → sıcak 114 sn (game-core) |
| simule | takımsız hikâye 5 → 7–9/10; 1 oturum taşkın 13 → 2 (takımsız), 12 → 0 (takımlı) | |
| camp (sıra adımlarıyla), social, reset, domcheck, vaka | geçti (3a0e159) | camp kutlama yükte düşmesi giderildi (YN-027), 2/2 |
| ui-mobile gorev web + dom × 320/390 × Chromium/WebKit | 320 ekran, 0 sorun (bbb47ad) | |
| ui-mobile tam (iki hedef, normal + büyük yazı) | erisim indikten sonra (5. tur başı) | |

## Bu tur yapılanlar (main'de)
- **Çalışanlar (PY doğruladı, kabul):** 368f7d9 + bbb47ad takımsız hikâye "ya da" adımları (MK-012) · 3a0e159 inşaat sırası (MK-011)
- **PY:** 0223e3c ölçüm önbelleği (MK-013) · 0a47931 camp-e2e yük dayanıklılığı (YN-027) · MK-014 ölçüldü (değişiklik yok; MK-015'e bağlandı)
- **Sahip kararları:** 13 ve 14 onaylandı (iki anlatıcı satırı) → ses2 çalışanı

## Sürüyor
- **erisim** (YN-018 / MK-006 Büyük yazı): çalışanın son doğrulaması sürüyor, main'e inmedi. İnince PY: ui-mobile iki hedef, normal + büyük yazı.
- **ses2** (YN-028, iki onaylı satırın seslendirmesi ve `kamp-sira-01` ipucu). İnince PY: `generate.mjs --check`, kamp/onboarding e2e, dosyaları dinle.

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
| 12 | **Klinik: kademeler daha erken mi, vaka sayısı artsın mı?** (MK-010 sonrası) | Kademeler Sv 1/2/3 yapıldı; 32 vakayla günde 3 hasta 14 günde en çok 11 gün yeni hasta demek. Önerim: (b) yeni vakaları siz onaylayarak ekleyelim (odyoloji içeriği sizin uzmanlık alanınız); (a) yalnız boşlukları biraz daha kapatır. | a) Ö4b: kademeler Sv 1/1/2 (yeni içerik yok, ilk haftada daha çok hasta) · b) +16–24 yeni vaka (taslağı biz hazırlarız, tıbbi doğruluk sizin onayınızla) · c) Olduğu gibi |
| 13 | ~~`kg-h6-giris` yeni metin~~ | **KARAR (sahip): ONAYLANDI** — "Bir kampı birlikte çalışmak büyütür. Takımınla ya da kendi başına: yardım et, öğren, zor vakada danış." Seslendirme: çalışan ses2 (YN-028). | — |
| 14 | ~~`kamp-sira-01` satırı~~ | **KARAR (sahip): ONAYLANDI** (önerimin aksine; sahip satırı istedi) — "Yapı ustası tek elle iki iş tutmaz ama sırayı bilir: bir sonrakini şimdi seç, bedelini öde; bu bitince kendiliğinden başlar. Vazgeçersen jetonun geri gelir." "Sıraya al" ilk görününce bir kez. Seslendirme + bağlama: ses2 (YN-028). | — |
