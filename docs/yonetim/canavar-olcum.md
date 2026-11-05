# Serumen Golemi (Bölüm 20) ölçümü: kayıp nereden geliyor?

Sahip kararı 52 (YN-249, OT-ilk-kez-oyun-70): **(c) kural aynı kaldı; yalnız ölçüm ve daha iyi kayıp ipucu.** Rahat deneme
(karar 42: canavar %20 yavaş, +1 can, en çok 1 yıldız) değişmedi, canavarda ikinci kolaylaştırma kademesi eklenmedi. Bu belge
ölçümü ve kayıp ipucunun neye dayandığını yazar.

## Soru

İlk kez oynayan oyuncu ajanı (beceri 0,1) Bölüm 20'yi 3 normal ve 2 Rahat denemede kaybetti; hepsi Faz 2'de, yumruk gölgesinde
bitti. Kayıplar el modelinin uyarıyı okuyamamasından mı (README: el modeli öğretici anı okumaz; canavarda ileri bakış sabit
0,6 sn, `play/human.ts` `BOSS_LOOK_MS`), yoksa gerçek zorluktan mı?

## Yöntem

`node tools/harness/zorluk.mjs --canavar --beceri 0.1,0.25,0.4,0.6 --k 16` (beceri 0,1 için ayrıca `--k 32`). İşçi
`tools/harness/zorluk-olc.ts` (`canavar` kipi) `runHuman`'ın canavar döngüsünü (öğretici anın ağır çekimi dahil) aynı el, aynı
tohum (`skillSeed`) ve oyundaki bölümle (`generateLevel('insan', 20)`, Rahat'ta `{ rahat: true }`) oynatır; yalnız ileri bakış seçilir:

- **model:** oyundaki ölçüm ve oyuncu ajanının kuralı, ileri bakış en çok 0,6 sn (`humanHand`).
- **okur:** ileri bakış = yumruk gölgesinin süresi (normal 0,85 sn, Rahat 1,06 sn): oyuncu gölgeyi belirdiği an görür ve okur.
  Tepki gecikmesi, sapma, kaçan ve geç girdi aynı. Planlayıcı gördüğü süre içinde geleceği bilir; bu yüzden "okur" gerçek ilk
  kez oynayanın üst sınırıdır, "model" alt sınırı.

Beceri 0,25 ve 0,4 el modelinde aynı eldir (`skillHand`: 0,4 ve altı acemi uç `NOVICE`); sonuçları bu yüzden birebir aynı.

## Sonuç

Beceri 0,1 (ilk kez oynayan kademe, 32 tohum):

| Deneme | Göz | Bitirme | Kalan güç (ort., 12'den) | Kayıp fazı 1 / 2 / 3 | Kaybettiren saldırı |
|---|---|---|---|---|---|
| normal | model (0,6 sn) | %6 | 8,2 | 14 / 16 / 0 | yumruk 26, top 3, düşme 1 |
| normal | okur (0,85 sn) | %72 | 1,8 | 2 / 4 / 3 | yumruk 4, damla 2, top 2, düşme 1 |
| Rahat | model (0,6 sn) | %16 | 5,8 | 3 / 20 / 4 | yumruk 20, top 5, damla 2 |
| Rahat | okur (1,06 sn) | %100 | 0 | – | – |

Öbür beceriler (16 tohum):

| Beceri | Deneme | model: bitirme | okur: bitirme | model: kayıp fazı 1 / 2 / 3 | model: kaybettiren |
|---|---|---|---|---|---|
| 0,25 ve 0,4 | normal | %56 | %100 | 2 / 4 / 1 | yumruk 7 |
| 0,25 ve 0,4 | Rahat | %81 | %100 | 0 / 2 / 1 | yumruk 3 |
| 0,6 | normal | %56 | %100 | 0 / 4 / 3 | yumruk 5, top 2 |
| 0,6 | Rahat | %94 | %100 | 0 / 1 / 0 | yumruk 1 |

Bütün can kayıplarının çoğu yumruktan (beceri 0,1, model, normal: 94 can kaybının 88'i yumruk, 5'i top, 1'i düşme; 68'i Faz 1'de yumruk).

**Yorum.**

1. **Kayıpların büyük kısmı el modelinden.** Aynı el, uyarının tamamını okuyabildiğinde normalde %6 → %72, Rahat'ta %16 → %100
   bitiriyor. Model 0,6 sn ileri baktığı için 0,85 sn'lik gölgenin ilk 0,25 sn'sini göremez; ilk kez oynayanın tepkisi (320-450 ms)
   de eklenince zıplamaya ancak son anda yetişir. Rahat denemede uyarı 1,06 sn'ye uzar ama model yine 0,6 sn gördüğü için bu uzamadan
   yararlanamaz (Rahat'ın modeldeki etkisi çoğunlukla fazladan candan; `play/rahat.test.ts` notuyla aynı). Oyuncu ajanı bu eli
   kullandığı için (`apps/web/src/e2e/oyuncu-eli.ts` → `humanHand`) OT-ilk-kez-oyun-70'teki 5 kayıp büyük ölçüde bu sınırdan.
2. **Gerçek zorluk orta.** Uyarıyı okuyan ilk kez oynayan el normal denemede yine %28 kaybediyor (çoğu yumruk ve Faz 3 damlası);
   Rahat denemede hiç kaybetmiyor. Gerçek ilk kez oynayan oyuncu gölgenin ne olduğunu da öğrenmek zorunda; asıl sorun "gölgeyi
   görünce ne yapmalıyım?" sorusu. Bu yüzden ikinci kademe yerine kayıp ipucu somutlaştı (aşağıda).
3. **Kayıp anı:** ilk kez oynayan elde kayıplar Faz 1 ve Faz 2'de, kaybettiren saldırı neredeyse hep yumruk (Rahat'ta 27 kaybın 20'si
   Faz 2'de). OT'deki "Faz 2 gölgesinde bitti" gözlemiyle aynı.

## Yumruktan nasıl kaçılır (motor deneyi)

`play/boss.ts` golem(): yumruk, kahramanın 0,95 sn sonra olacağı yere nişan alır, gölge 0,85 sn (Rahat 1,06 sn) büyür, sonra
0,12 sn'de iner ve yalnız yerdekine (ayağı yumruk boyundan alçakta olana) değer. Kahraman hep koşarken her uyarıda tek bir tepki
denendi (20 uyarı; normal / Rahat):

| Tepki (gölge belirdikten sonra) | Normal (gölge 0,85 sn): vuruş | Rahat (gölge 1,06 sn): vuruş |
|---|---|---|
| hiçbir şey | 8 / 12 (Faz 1), 6 / 12 (Faz 2) | — |
| ters yöne dön, 0,1-0,9 sn sonra | 4-12 / 20 | 1-16 / 17 |
| zıpla, 0,1-0,3 sn sonra | 0 / 20 | 3-5 / 17 |
| zıpla, 0,5-0,75 sn sonra | 0 / 20 | 0 / 17 |
| zıpla, 0,83 sn sonra | 2 / 20 | 0 / 17 |
| zıpla, 0,92 sn sonra (normalde gölge tam boyunda) | 18 / 20 | 0 / 17 |

Güvenilir yol zıplamak: gölge büyürken, tam boyuna gelmeden. Ters yöne dönmek ("gölgeden kaç") uyarıların çoğunda yine vuruluyor.
Faz 2'de parlayan duvardan yuvarlanan top yerde gelir (üstünden zıplanır), Faz 3'te iki yumruk ve tavandan damla (gölgesi yere düşer,
koşu yönüne göre nişanlanır; ters yöne dönen vurulmadı).

## Kayıp ipucu (uygulama)

Kayıp ekranı (`packages/meta/src/progress.ts` `lossView`, `GOLEM_TIP`) kaybettiren saldırıya ve o andaki faza göre tek, kısa cümle
söyler; bu cümle her denemede aynı ve tek başına (ikinci satır yok: 320×640'ta Rahat deneme teklifi ve takım yardımı kartı ilk
ekranda kalsın). Faz `LevelScene.fail`'den (`extra.faz`) gelir; sonuç satırı "3 kez hasar aldın, en son Faz 2'de yumruğa
yakalandın." der.

| Kayıp | Sonuç satırı ("en son …") | İpucu |
|---|---|---|
| Faz 1 yumruk | Faz 1'de yumruğa yakalandın | Gölge yumruğun ineceği yer: gölge büyürken zıpla. |
| Faz 2 yumruk | Faz 2'de yumruğa yakalandın | Faz 2'de de yumruk sürer: gölge büyürken zıpla. |
| Faz 3 yumruk | Faz 3'te yumruğa yakalandın | Faz 3'te iki yumruk iner: iki gölgeye de bak, büyürken zıpla. |
| Faz 2-3 top | Faz 2'de yuvarlanan topa çarptın | Duvar parlayınca top yuvarlanır: yaklaşınca üstünden zıpla. |
| Faz 3 damla | Faz 3'te tavandan düşen damla sana değdi | Damlanın gölgesine doğru koşuyorsan ters yöne kaydırıp dön. |

Faz bilgisi olmayan (eski) sonuçta ipucu sırası: golemin vuruş yolu ("Yere saplanan yumruk parlar: üstüne zıpla, havada aşağı
kaydırıp çakıl.", öğretici anla aynı söz), sonra uyarıların ne olduğu.
Golemde genel "uyarıyı görünce oradan uzaklaş" cümlesi yerine uyarıların ne olduğu yazar (yumrukta uzaklaşmak güvenilir değil).
Seslendirilmiş satırlara ve bölüm içindeki faz şeridine dokunulmadı. Not: Faz 1 şeridi "Gölgeden kaç." der; ölçüme göre kaçmanın
güvenilir yolu zıplamak. Şeridin sözü ayrı bir iş olarak değerlendirilebilir.

## Açık kalan

- Ölçüm el modeliyle; gerçek ilk kez oynayanın gölgeyi öğrenme süresi ölçülmüyor. Gerçek oyuncu verisi gelince (beta) Bölüm 20'nin
  kayıp ve Rahat oranı bu tabloyla karşılaştırılmalı.
- El modelinin canavardaki ileri bakışı (0,6 sn) bilinçli bir alt sınır; oyuncu ajanı testlerinde canavar kayıpları bu yüzden
  gerçek oyuncudan kötümser okunmalı.
