# 06 · Teknik Mimari (büyük ekip disipliniyle)

## 1. İlkeler
- **Tek oyun çekirdeği, üç yüzey:** iOS, Android, web (davet linki). Oyun motoru kodu bir kez yazılır.
- **Veri odaklı içerik:** bölümler, parçalar, biyomlar, yetenekler, görevler, sezonlar kod değil veridir; canlı operasyon kod yayınlamadan içerik çıkarır.
- **Sunucu gerçeği:** ilerleme, ekonomi, satın alma ve lig sunucuda doğrulanır; istemci hile yapamaz.
- **Her şey test edilir:** otomatik oyuncu (bot) her bölümü oynar; her içerik yayını bot testinden geçer.
- **Modüller net sınırlarla:** 100 kişilik bir ekip çakışmadan çalışabilsin diye paket sınırları ve sahiplik.

## 2. Depo yapısı (monorepo)
```
oyun/
  apps/
    mobile/          Expo (iOS/Android): kabuk, IAP, push, paylaşım, haptik; oyun DOM bileşeninde
    web/             Davet linki ve tarayıcı oyunu (aynı çekirdek), paylaşım kart sayfaları
    admin/           Canlı operasyon paneli: içerik yayını, etkinlik, moderasyon, metrikler
  packages/
    game-core/       Phaser 3 + TS: motor, sahneler, fizik, kontrol, juice, bot oyuncu
    content/         Biyomlar, parçalar, bölüm kuralları, yetenekler, görevler, sezonlar (JSON + şema)
    level-gen/       Bölüm üretici (seed, ritim eğrisi, dinamik zorluk) — saf TS, sunucuda da çalışır
    ui/              React arayüz (menü, harita, mağaza, takım, sohbet) — web ve mobil ortak
    shared/          Tipler, sabitler, ekonomi hesapları, i18n
    sdk/             Sunucu istemcisi (auth, ilerleme, takım, sohbet, satın alma)
  services/
    supabase/        Şema, RLS, edge functions (ilerleme doğrulama, satın alma doğrulama, lig kapanışı, etkinlik)
    jobs/            Zamanlanmış işler: lig, haftalık keşif, boss, sezon geçişi
  tools/
    harness/         Playwright: bot oyuncu, ekran görüntüsü, performans ölçümü (Chromium + WebKit)
    level-editor/    Parça ve bölüm düzenleyici (web)
  docs/
```

## 3. Oyun çekirdeği
- Phaser 3 (WebGL), 60 fps hedef, nesne havuzları, doku atlasları, parça tabanlı dünya akışı.
- Sahne akışı: Boot → Harita (React) → Bölüm (Phaser) → Sonuç (React). Phaser yalnızca bölüm içinde; menüler React (hızlı geliştirme, erişilebilirlik).
- Kontrol katmanı: tek elle dokunma; mekanik başına giriş eşleştirme (koşu, yüzme, trambolin, makine, impuls, rüya).
- Juice kütüphanesi: squash-stretch, parçacık, sarsıntı, flaş, uçan puan, kombo sesi; tek yerden ayarlı.
- Ses: sentezlenmiş efektler + kısa müzik döngüleri (telifsiz, kendi üretimimiz); tonotopi notaları.
- Bot oyuncu: her mekanik için basit yapay zekâ; bölümün oynanabilirliğini ve süresini doğrular.

## 4. İçerik hattı
- `content/` şema ile doğrulanır (zod). Her parça: biyom, mekanik, zorluk, süre, giriş/çıkış yüksekliği, etiketler.
- `level-gen`: bölüm numarası + yolculuk + oyuncu profili → deterministik bölüm. Aynı bölüm herkese aynı.
- Yayın: admin panelinden "yolculuk yayınla" → bot testi → kademeli açılış (%5 → %100).
- Uzaktan yapılandırma: zorluk eğrisi, ekonomi katsayıları, etkinlik tarihleri; uygulama güncellemesi gerektirmez.

## 5. Sunucu
- Supabase (Postgres + Auth + Realtime + Storage) ilk yıl; büyüyünce ayrı servislere taşınabilir.
- Tablolar: players, progress (bölüm, yıldız, süre), inventory, skills, companions, cosmetics, teams, team_members, team_events, chat_messages, friends, invites, leagues, league_members, purchases, seasons, remote_config, content_releases, moderation_reports.
- Edge functions: `submitRun` (koşu sonucunu doğrula: süre, mesafe, jeton makul mü; hile skoru), `claimDaily`, `teamContribute`, `verifyPurchase` (App Store Server API / Play Developer API; RevenueCat webhooks), `closeLeague`, `rollSeason`.
- Realtime: takım sohbeti, takım hedef çubuğu, boss can barı.
- Hile önleme: koşu kaydı (giriş dizisi) sunucuda hızlı tekrar simülasyonuyla doğrulanır (level-gen deterministik olduğu için mümkün).

## 6. Mobil kabuk (Expo)
- Oyun DOM bileşeninde tam ekran; native köprü: haptik, paylaşım, push, IAP (RevenueCat), Apple/Google giriş, derin link (davet, meydan okuma).
- Geliştirme derlemesi gerekir (IAP ve push Expo Go'da yok); EAS ile TestFlight.

## 7. Web
- Aynı oyun çekirdeği; davet linki ilk 3 bölümü tarayıcıda açar; sonra uygulamaya yönlendirir ve ilerlemeyi hesapla taşır.
- Paylaşım kart sayfaları (OG görselleri) WhatsApp ve Instagram önizlemesi için.

### Erişilebilirlik (web ve telefon aynı arayüz)
- **Büyük yazı** (Ayarlar): `store.bigText` (kalıcı) → `App.tsx` kök öğeye `html.buyuk-yazi` koyar → `font-size:115%`. Arayüzdeki
  yazı boyutları `rem` olduğundan (24 px'e kadar olanlar; daha büyük başlık/süs/ikon boyutları px kalır) menü, sohbet, kamp
  panelleri birlikte 1,15 büyür. Phaser tuvali (bölüm göstergeleri, harita, kamp) değişmez. Yeni CSS'te metin boyutu `rem` yazılır.
- **Hareket azaltma:** `prefers-reduced-motion` desteklenir (animasyonlar kısalır).
- **Yakınlaştırma (web):** `index.html`'de `user-scalable=no` yok; tarayıcıda iki parmakla yakınlaştırılabilir. Çift dokunuşla
  yakınlaştırma `html { touch-action:manipulation }` ile kapalı (hızlı dokunuşlar sayfayı büyütmesin); bölüm ekranı
  (`.level-host`), harita ve kamp tuvali `touch-action:none` (oyun içinde tarayıcı hareketi yok; Phaser dokunuşları zaten yakalar).
  `ui/viewport.ts` yakınlaştırılmış görünümü (`visualViewport.scale > 1`) klavye sanmaz. Yazı girişleri ≥ 16 px: iOS odakta
  sayfayı kendiliğinden büyütmez.
- **Yakınlaştırma (telefon kabuğu):** Expo'nun DOM sayfası `user-scalable=no` ile gelir ve bırakılır: WebView'in yerel kaydırması
  kapalı (`scrollEnabled:false`, kaydırma #root kabında), yakınlaştırılan sayfa kaydırılamazdı. Telefonda yol: Büyük yazı +
  sistemin büyüteci (iOS Büyüteç/Zoom, Android Büyütme). Android WebView'de `textZoom` verilmez; sistem yazı boyutu varsayılan
  davranışla uygulanır (gerçek cihazda bakılmalı).
- Denetim: `node tools/harness/ui-mobile-check.mjs --target both --buyuk-yazi --tag buyuk` (320 ve 390 px; taşma, kırpılan yazı,
  sohbet girişi sekme çubuğunun üstünde, kök yazı 18,4 px).
- **Metin kontrastı (WCAG AA, MK-017):** normal yazı ≥ 4,5:1, büyük yazı (≥ 24 px ya da ≥ 18,66 px kalın) ≥ 3:1; Büyük yazı kipinde de.
  `ui-mobile-check` her ekranda ölçer (`measureContrast`): yazı rengi + ata zincirinin zemin renkleri saydamlık ve opacity
  gruplarıyla birleştirilir; zincirde gradyan/resim zemin varsa (gece gradyanı, cam paneller, tuval üstü göstergeler) zemin, yazılar
  gizlenmiş ekran görüntüsünden örneklenir (metin kutusundaki piksellerin %10'luk alt dilimi). Özet `out/ui-mobile/<tag>/kontrast.json`.
  Sayılmayanlar: devre dışı denetimler ve gerekçeli istisnalar (`KONTRAST_ISTISNA`: logo), görünmeyen/örtülen metin, Phaser tuvali
  (DOM değil). `KONTRAST_BEKLEYEN`: düzeltmesi dolgu rengini değiştirdiği için sahip kararı bekleyenler (Ö1–Ö7; koşuyu düşürmez).
- Metin tonu belirteçleri (`styles.css :root`): `--text-2` ikincil metin, `--text-3` soluk metin (yer tutucu), `--coral-text` mercan
  vurgulu yazı. Yeni soluk yazıda `opacity` ya da `rgba` yerine bu belirteçler kullanılır; marka/vurgu dolguları (`--violet`, `--coral`,
  `--gold`) değişmez.

## 8. Analitik ve deney
- PostHog: olaylar (bölüm başladı/bitti, ölüm nedeni, satın alma, davet), huniler, tutma, A/B deneyleri (zorluk, ödül, bildirim metni).
- Haftalık "oyuncu sağlığı" raporu: en çok takılınan bölümler, bırakma noktaları, ekonomi dengesi.

## 9. Kalite
- TS strict, ESLint, birim testleri (level-gen, ekonomi), Playwright bot koşuları (Chromium + WebKit), Jest (React UI), performans bütçesi (ilk bölüm 3 sn içinde, 60 fps orta segment telefonda).
- CI: her PR'da lint + test + bot; her içerik yayınında bot.

## 10. Güvenlik ve uyum
- KVKK/GDPR: açık rıza, veri silme, 13+ sohbet, ebeveyn harcama limiti.
- Sohbet moderasyonu: filtre + şikâyet + insan incelemesi.
- Apple/Google inceleme: IAP kuralları, gizlilik etiketleri, sağlık iddiası yok.
