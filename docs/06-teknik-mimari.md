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
