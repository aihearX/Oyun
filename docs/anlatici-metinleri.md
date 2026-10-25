# Tüy Dede — anlatıcı metinleri

> Bu dosya `node tools/voice/generate.mjs --export` ile üretilir; kaynak: `apps/web/src/ftue/script.ts`. Elle düzenlemeyin.
> Aynı liste CSV olarak: `docs/anlatici-metinleri.csv` (id, metin, okunuş, bağlam, duygu, dosya adı).

## Seslendirme yönergesi

Tüy Dede: iç kulağın en yaşlı tüy hücresi; bilge, sıcak, şefkatli bir erkek anlatıcı. Akıcı ve doğal hızda (yavaş değil), gülümseyerek konuşur; sesi yaşlandırılmaz (titreme, boğukluk yok). Çocuklara (7-12 yaş) masal anlatır gibi; heyecanlı yerlerde canlanır ama asla bağırmaz. Noktalama işaretlerinde doğal duraklar. Türkçe, İstanbul ağzı, net diksiyon.

Dosyalar `apps/web/public/voice/<id>.mp3` adıyla konur (mono, ~56kbps MP3, −16 LUFS). Uygulama bir satırı yalnızca
kayıt metni ekrandaki altyazıyla aynıysa çalar (manifest'teki parmak izi); kaydı olmayan satırda cihazın sesi (TTS) devreye girer.

## Ses lisansı ve emeği geçenler

- Ses: **Chatterbox Multilingual** (Resemble AI, **MIT** lisansı; `chatterbox-tts` 0.1.7, `language_id='tr'`).
  Model: https://huggingface.co/ResembleAI/chatterbox
- Erkek anlatıcı tınısı: `tools/voice/ref-tr-erkek.flac` — sentetik bir temel ses (**Kokoro-82M**, hexgrad, **Apache-2.0**)
  Chatterbox ile Türkçeye taşındı; gerçek bir kişinin sesi değildir (reels ekibiyle aynı onaylı ses).
- Seçim: satır başına en çok 3 deneme (sabit tohumlar 1-3); **Whisper large-v3-turbo** (OpenAI, MIT) dökümüyle en iyisi seçilir:
  önce anlaşılırlık (WER), sonra uzun duraksama, sonra hız.
- Filigran: Chatterbox her çıktıya duyulmayan **Perth** filigranı ekler (Resemble AI; sentetik sesin izlenebilirliği için).
- Uygulamada anma: Ayarlar › "Anlatıcı sesi: Chatterbox Multilingual (Resemble AI, MIT) · temel tını Kokoro-82M (Apache-2.0)".
- Üretilen ses dosyaları bu projenin parçasıdır; MIT ve Apache-2.0 ticari kullanıma izin verir (bildirimler yukarıda).

## Üretim

```
python3.11 -m venv ~/odi-cb
~/odi-cb/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
~/odi-cb/bin/pip install chatterbox-tts==0.1.7 transformers librosa
ODI_CB_PY=~/odi-cb/bin/python ODI_CB_CACHE=~/odi-cb/cache node tools/voice/generate.mjs   # yarıda kalırsa aynı komut sürdürür
```

Ayarlar: exaggeration 0.8, cfg_weight 0.3, temperature 0.8. "Dede" efekti yok (perde, titreme, yankı
yok); yalnız sessizlik kırpma, uzun duraksamaları ≤ 400 ms'ye kısaltma, 5.2 hece/sn altındaysa en çok
×1.2 hızlandırma, 60 Hz altı temizlik, −16 LUFS, mono 56k MP3. Yedek motor: `--engine coqui` (Coqui TTS, Fatih Akademi, MIT).

## Satırlar (208)

| id | metin | bağlam | duygu |
|---|---|---|---|
| `hikaye-01` | Merhaba! Ben Tüy Dede, iç kulağın en yaşlı tüy hücresiyim. Seni bekliyordum. | Hikâye 1/7: Tüy Dede kendini tanıtır | sıcak, karşılayıcı (warm, welcoming) |
| `hikaye-02` | Bu Odi: minik bir ses. Annesinin ninnisini taşıyor. | Hikâye 2/7: kahraman Odi tanıtılır | şefkatli (tender) |
| `hikaye-03` | Ninni kulaktan girer, kanalı geçer, kulak zarına ve kemikçiklere ulaşır; kokleadan işitme siniriyle beyne gider. | Hikâye 3/7: kulaktan beyne yolculuk haritası | anlatıcı, merak uyandıran (storytelling) |
| `hikaye-04` | Ama Büyük Sessizlik geliyor! Gürültü canavarları kulağın ışıklarını söndürüyor. | Hikâye 4/7: tehlike, karanlık sahne | gizemli, endişeli (ominous, hushed) |
| `hikaye-05` | Senin görevin: her bölümü geç, yıldızları topla, bölgeleri yeniden ışıt ve ninniyi beyne ulaştır. | Hikâye 5/7: oyunun hedefi | kararlı, cesaret veren (determined) |
| `hikaye-06` | Yalnız değilsin: arkadaşların ve takımın yardım eder. Her yeni yeri ben sana tek tek göstereceğim. | Hikâye 6/7: arkadaşlar ve takım | güven veren, göz kırpan (reassuring) |
| `hikaye-07` | Hadi, ilk bölüme! Ekrana dokun: Odi zıplar. Basılı tutarsan daha uzağa gider. Notaları topla! | Hikâye 7/7: 1. bölüm başlamadan, nasıl oynanır | heyecanlı (excited) |
| `sonuc-01` | Bravo! İlk bölümü geçtin. Ninni bir adım daha yol aldı. | 1. bölüm sonuç ekranı, yıldızlar parlarken | gururlu, sevinçli (proud) |
| `sonuc-02` | Yıldızlar bölümü ne kadar iyi geçtiğini gösterir: notaların çoğunu topla, hızlı ol, hiç düşme. Üç yıldız en iyisi! | Sonuç: yıldızlar açıklanır | öğretici, sıcak (explaining) |
| `sonuc-03` | Topladığın notalar jetona dönüşür. Jetonla yetenek alır, kampını büyütürsün. | Sonuç: nota ve jeton açıklanır | öğretici (explaining) |
| `sonuc-04` | Şimdi yolculuğun haritasına bakalım. Harita düğmesine dokun. | Sonuç: Harita düğmesi gösterilir (oyuncu dokunur) | davet eden (inviting) |
| `harita-01` | İşte yolun: kulak kepçesinden beyne uzanır. Her bölüm seni biraz daha ileri götürür. | Harita ilk kez açılınca | hayranlık (wonder) |
| `harita-02` | Üstte seviyen, yıldızların ve jetonların var. | Harita: üst bilgi çubuğu vurgulanır | sakin, öğretici (calm) |
| `harita-03` | Aşağıdaki yerler kilitli. Bölüm geçtikçe tek tek açılır; her yenisini sana ben göstereceğim. | Harita: kilitli alt sekmeler | gizemli, söz veren (promising) |
| `harita-04` | Sıradaki bölüm burada. Dokun ve devam et! | Harita: sıradaki bölüm düğmesi (oyuncu dokunur) | cesaret veren, göz kırpan (encouraging) |
| `sekme-bugun` | Aşağıdaki Bugün düğmesine dokun. | Alt sekme çubuğunda Bugün vurgulanır | yönlendiren (guiding) |
| `sekme-kamp` | Aşağıdaki Kamp düğmesine dokun. | Alt sekme çubuğunda Kamp vurgulanır | yönlendiren (guiding) |
| `sekme-profil` | Aşağıdaki Profil düğmesine dokun. | Alt sekme çubuğunda Profil vurgulanır | yönlendiren (guiding) |
| `sekme-takim` | Aşağıdaki Takım düğmesine dokun. | Alt sekme çubuğunda Takım vurgulanır | yönlendiren (guiding) |
| `sekme-harita` | Aşağıdaki Harita düğmesine dokun. | Alt sekme çubuğunda Harita vurgulanır | yönlendiren (guiding) |
| `bugun-01` | Yeni bir yer açıldı: Bugün! Her gün uğra; takvim ödülü, üç görev ve günlük sandık seni bekler. | Açılış kutlaması: Bugün | coşkulu (celebratory) |
| `bugun-02` | Bugünün takvim ödülü hazır. Al’a dokun ve topla! | Bugün: takvim ödülü (oyuncu dokunur) | neşeli (cheerful) |
| `bugun-03` | İşte ödülün! Topla’ya dokun, jetonlar cebine girsin. | Bugün: ödül kutlaması açık (oyuncu dokunur) | sevinçli (delighted) |
| `bugun-04` | Bunlar günlük görevler. Oynadıkça dolar; bitince ödülünü buradan alırsın. Üçü de bitince sandık açılır. | Bugün: günlük görevler listesi | öğretici (explaining) |
| `kamp-01` | Yeni bir yer açıldı: Kulak Kampı! Burada binalar kurarsın; sen oyundayken bile çalışırlar. | Açılış kutlaması: Kamp | coşkulu (celebratory) |
| `kamp-insa-01` | Burası senin kampın. Binalar jeton üretir, kalkan şansı verir, takımına güç katar. | Kamp öğreticisi: kamp ilk kez açılınca | gururlu, sıcak (proud) |
| `kamp-insa-02-depo` | İlk işimiz: Kulak Deposu. Binaya dokun. | Kamp öğreticisi: Kulak Deposu arsası vurgulanır (oyuncu dokunur) | yönlendiren (guiding) |
| `kamp-insa-02` | İlk işimiz: parlayan bina. Binaya dokun. | Kamp öğreticisi: depo kuruluysa başka bir bina vurgulanır | yönlendiren (guiding) |
| `kamp-insa-03` | Bu panelde binanın şimdi ne yaptığı ve bir sonraki seviyede ne olacağı yazar. | Kamp öğreticisi: bina panelinde etki satırı | öğretici (explaining) |
| `kamp-insa-04` | Bedeli ve süresi burada. Şimdi düğmeye dokun ve inşaatı başlat! | Kamp öğreticisi: Kur düğmesi (oyuncu dokunur) | cesaret veren (encouraging) |
| `kamp-insa-05` | Harika, inşaat başladı! Süre dolunca hazır olur. Takımın olunca arkadaşların tek dokunuşla hızlandırır. | Kamp öğreticisi: inşaat başladı | sevinçli, göz kırpan (delighted) |
| `arkadas-01` | Yeni: Arkadaşlar ve mesajlar! Arkadaşını kodla ekle, mesajlaş, her gün hediye gönder. | Açılış kutlaması: Arkadaşlar | coşkulu (celebratory) |
| `arkadas-02` | Arkadaşlar burada. Arkadaş kodunu paylaş; birlikte daha hızlı ilerlersiniz. | Profil: Arkadaşlar kutucuğu vurgulanır | sıcak (warm) |
| `sozluk-01` | Yeni: Kulak Sözlüğü! Ulaştığın her bölgenin terimleri burada: önce sade anlatım, istersen odyoloji ayrıntısı. | Açılış kutlaması: Kulak Sözlüğü | bilge, meraklandıran (wise, curious) |
| `sozluk-02` | Sözlük burada, Profil’in içinde. Dokun ve bir bak! | Profil: Kulak Sözlüğü kutucuğu (oyuncu dokunur) | davet eden (inviting) |
| `sozluk-03` | Her terimin sade bir tanımı var. Daha fazla’ya dokunursan odyoloji öğrencileri için ayrıntı açılır. | Kulak Sözlüğü: ilk terim kartı | öğretici, sıcak (explaining) |
| `takim-01` | Yeni: Takım! Takımda birbirinize yardım edersiniz: inşaatlar hızlanır, kalkan gelir. | Açılış kutlaması: Takım | coşkulu (celebratory) |
| `takim-02` | Birlikte Bölge Savaşı’nda yer kaparsınız ve Gürültü Canavarı’na hep beraber vurursunuz. | Takım: takım avantajları | heyecanlı, cesur (rousing) |
| `takim-03` | Bir takıma kodla katılabilir ya da kendi takımını kurabilirsin. Karar senin! | Takım: kodla katıl / takım kur | göz kırpan (playful) |
| `magaza-01` | Yeni: Mağaza, Dolap ve Ödül kutusu! Odi’ye şapka ve renk seç, ödüllerini topla. | Açılış kutlaması: Mağaza ve Dolap | coşkulu (celebratory) |
| `magaza-02` | Dolap burada: Odi’yi istediğin gibi giydir. Kazandığın kozmetikler hep buraya gelir. | Profil: Dolap kutucuğu vurgulanır | neşeli (cheerful) |
| `etkinlik-01` | Yeni: Etkinlikler! Ralli, düello, bayrak yarışı ve quiz: takımca oynanır, ödülleri büyüktür.<br><small>okunuş: Yeni: Etkinlikler! Ralli, düello, bayrak yarışı ve kuiz: takımca oynanır, ödülleri büyüktür.</small> | Açılış kutlaması: Etkinlikler | coşkulu (celebratory) |
| `etkinlik-02` | Etkinlik çadırı haritanın sağında. Dokun ve bir bak! | Harita: etkinlik çadırı (oyuncu dokunur) | merak uyandıran (intriguing) |
| `yaris-01` | Yeni: Canlı yarış ve meydan okuma! Arkadaşınla aynı bölümü aynı anda koş; kim önde bitirecek? | Açılış kutlaması: Canlı yarış | heyecanlı, meydan okuyan (competitive) |
| `yazi-01` | Sekiz bölümü geçtin! Artık sohbette kendi sözlerinle de yazabilirsin. | Açılış kutlaması: serbest yazı (8. bölümden sonra; öncesinde yalnız hazır sözler) | gururlu, sıcak (proud, warm) |
| `yazi-02` | Birkaç kural: nazik ol ve kişisel bilgini paylaşma. Kötü sözler yıldızlanır; üç kişinin şikâyet ettiği mesaj gizlenir. | Serbest yazı kuralları (bir kez gösterilir) | bilge, şefkatli (wise, caring) |
| `akis-01` | Yeni: Takım Akışı! Takım arkadaşın bölüm geçince, canavar yenince ya da altın koklea bulunca sohbette bir kart belirir. | Açılış kutlaması: Takım Akışı (6. bölümden sonra) | coşkulu (celebratory) |
| `akis-02` | Karta bir tepki bırak ya da Tebrik et’e dokun. Hazır sözlerle tek dokunuşta konuşursun; takılırsan takımından yardım iste! | Takım sohbeti: akış kartı ve hazır sözler vurgulanır | sıcak, cesaret veren (warm, encouraging) |
| `sira-01` | Yeni: Sıralama! En güçlü oyuncular ve takımlar burada sıralanır; her pazartesi yeni bir hafta başlar. | Açılış kutlaması: Sıralama (5. bölümden sonra) | heyecanlı, meydan okuyan (competitive) |
| `sira-02` | Profildeki Sıralama’ya dokun. Puanlar yalnızca gerçekten oynadığın bölümlerden gelir; nasıl hesaplandığını soru işaretinde anlatırım. | Profil: Sıralama kutucuğu vurgulanır | sıcak, açıklayıcı (warm, explaining) |
| `sira-03` | Senin satırın hep en altta durur. Oklar dünden beri kaç sıra yükseldiğini gösterir; haftanın ilk sıralarına kristal var! | Sıralama: kendi satırı vurgulanır | göz kırpan, cesaret veren (playful, encouraging) |
| `tlig-01` | Yeni: Takım Ligi! Takımın iki haftalık sezonlarda benzer takımlarla bir grupta yarışır. İlk üç bir üst kademeye çıkar. | Açılış kutlaması: Takım Ligi (6. bölümden sonra) | heyecanlı (excited) |
| `tlig-02` | Lig puanı savaştan, baskından, bilgi sorularından, düellodan ve takım yarışından gelir. Takım sekmesindeki Lig’e bak. | Takım: Lig sekmesi vurgulanır | açıklayıcı, sıcak (explaining, warm) |
| `tyaris-01` | Yeni: Canlı Takım Yarışı! İki takım aynı bölümü aynı anda koşar; bitiş sıran ve yıldızların takımına puan olur. | Açılış kutlaması: Canlı Takım Yarışı (9. bölümden sonra) | coşkulu, meydan okuyan (celebratory, competitive) |
| `tyaris-02` | Lider lobi açar, sen katılıp Hazırım dersin. Rakip takımlar gerçek oyunculardır; kimse yoksa bunu açıkça söylerim. | Takım: Takım Yarışı sekmesi vurgulanır | bilge, dürüst (wise, honest) |
| `soru-01` | Yeni: Günün Sorusu! Her gün takım sohbetine bir kulak sorusu bırakırım. Akşam sekizde cevabını ve açıklamasını söylerim; birlikte tartışın! | Açılış kutlaması: Günün Sorusu (9. bölümden sonra) | bilge, meraklandıran (wise, curious) |
| `soru-02` | İşte bugünün sorusu. Bir şık seç; doğru bilene jeton var. | Takım sohbeti: Günün Sorusu kartı vurgulanır | göz kırpan (playful) |
| `ikili-01` | Yeni: İkili Görev! Bir arkadaşınla haftalık ortak hedef seçin; ikinizin notaları birlikte sayılır, sandığı birlikte açarsınız. | Açılış kutlaması: İkili Görev (10. bölümden sonra) | coşkulu (celebratory) |
| `ikili-02` | Birlikte burada, Profil’in içinde. Arkadaşını seç ve davet et. | Profil: Birlikte kutucuğu vurgulanır | davet eden (inviting) |
| `usta-01` | Artık bir ustasın! Yeni başlayan bir arkadaşına çırak teklif et; o ilerledikçe ikiniz de ödül alırsınız. | Açılış kutlaması: Usta–Çırak (11. bölümden sonra) | gururlu, sıcak (proud, warm) |
| `kamp-sv-merkez-1` | Merkez büyüdükçe kampın da büyür. Odyolojide tek bir test yetmez; testler birbirini doğrular. | Kamp: Odyoloji Merkezi yükseldi (Sv 1, 4, 7, 10, 13) | gururlu, bilge (proud, wise) |
| `kamp-sv-merkez-2` | Bir odyolog işitmeyi de dengeyi de değerlendirir. Merkezin artık diğer binalara daha yüksek kat açıyor. | Kamp: Odyoloji Merkezi yükseldi (Sv 2, 5, 8, 11, 14) | sıcak, öğretici (warm, explaining) |
| `kamp-sv-merkez-3` | Erken tanı, erken destek demektir. Merkezin büyüdü; şimdi diğer binaları da yükseltebilirsin. | Kamp: Odyoloji Merkezi yükseldi (Sv 3, 6, 9, 12, 15) | cesaret veren (encouraging) |
| `kamp-sv-laboratuvar-1` | Odyometride her frekansta duyabildiğin en hafif sesi ararız. Ölçtükçe daha çok öğrenir, daha çok jeton kazanırsın. | Kamp: Odyometri Odası yükseldi (Sv 1, 4, 7, 10, 13) | neşeli, öğretici (cheerful, explaining) |
| `kamp-sv-laboratuvar-2` | Kulaklıkla verilen ses hava yolunu, kulağın arkasındaki titreşim kemik yolunu ölçer. | Kamp: Odyometri Odası yükseldi (Sv 2, 5, 8, 11, 14) | öğretici (explaining) |
| `kamp-sv-laboratuvar-3` | Ses geçirmez kabin, dışarının gürültüsü testi bozmasın diye vardır. Odan bir kat daha iyi ölçüyor! | Kamp: Odyometri Odası yükseldi (Sv 3, 6, 9, 12, 15) | gururlu (proud) |
| `kamp-sv-atolye-1` | İşitme cihazı sesi her frekansta ayrı ayrı güçlendirir. İyi ayarlanmış cihaz, zor anda kalkan gibi destek olur. | Kamp: İşitme Cihazı Atölyesi yükseldi (Sv 1, 4, 7, 10, 13) | sıcak, öğretici (warm, explaining) |
| `kamp-sv-atolye-2` | Cihaz ayarı odyograma göre yapılır; kazanç, her frekansta kaybın derecesine göre seçilir. | Kamp: İşitme Cihazı Atölyesi yükseldi (Sv 2, 5, 8, 11, 14) | öğretici (explaining) |
| `kamp-sv-atolye-3` | Kulak kalıbı cihazın sesini kanala taşır ve o tiz ıslığı, yani geri beslemeyi azaltır. | Kamp: İşitme Cihazı Atölyesi yükseldi (Sv 3, 6, 9, 12, 15) | göz kırpan (playful) |
| `kamp-sv-depo-1` | Kulak kiri kendiliğinden birikir ve kendiliğinden dışarı taşınır. Deponda da jeton böyle kendiliğinden birikir. | Kamp: Kulak Deposu yükseldi (Sv 1, 4, 7, 10, 13) | göz kırpan (playful) |
| `kamp-sv-depo-2` | Kulak kiri kanalı korur ve nemli tutar. Kulağını pamuklu çubukla kurcalama; deponu ise sık sık topla! | Kamp: Kulak Deposu yükseldi (Sv 2, 5, 8, 11, 14) | şefkatli, şakacı (caring, playful) |
| `kamp-sv-depo-3` | Kanal derisi içten dışa doğru yavaşça kayar ve kiri dışarı taşır. Deponun kapasitesi arttı. | Kamp: Kulak Deposu yükseldi (Sv 3, 6, 9, 12, 15) | öğretici (explaining) |
| `kamp-sv-kule-1` | Timpanometri, kanaldaki basıncı değiştirip kulak zarının ne kadar rahat hareket ettiğini ölçer. | Kamp: Timpanometri Kulesi yükseldi (Sv 1, 4, 7, 10, 13) | öğretici, merak uyandıran (curious) |
| `kamp-sv-kule-2` | Düz bir timpanogram çoğu zaman orta kulakta sıvıyı düşündürür. Kulen artık takımının sesini daha uzağa taşıyor. | Kamp: Timpanometri Kulesi yükseldi (Sv 2, 5, 8, 11, 14) | kararlı (determined) |
| `kamp-sv-kule-3` | Çok yüksek seste minicik stapedius kası kasılır. Bu akustik refleks de aynı cihazla ölçülür. | Kamp: Timpanometri Kulesi yükseldi (Sv 3, 6, 9, 12, 15) | hayranlık (wonder) |
| `kamp-sv-revir-1` | Klinikte ilk iş, ışıklı bir aletle kanala ve kulak zarına bakmaktır. Erken fark edilen sorun kolay atlatılır. | Kamp: Odyoloji Kliniği yükseldi (Sv 1, 4, 7, 10, 13) | şefkatli (caring) |
| `kamp-sv-revir-2` | Yenidoğan işitme taraması, işitme kaybını erken bulup erken desteklemeyi sağlar. | Kamp: Odyoloji Kliniği yükseldi (Sv 2, 5, 8, 11, 14) | sıcak, öğretici (warm, explaining) |
| `kamp-sv-revir-3` | Klinik büyüdü! İlk darbeyi yok sayma şansın arttı; tıpkı erken tanının koruması gibi. | Kamp: Odyoloji Kliniği yükseldi (Sv 3, 6, 9, 12, 15) | gururlu (proud) |
| `kamp-sv-tedavi-1` | Tedavi Odası koruma ve tedavi malzemesi hazırlar. Bir tarif seç; raf dolunca topla. | Kamp: Tedavi Odası yükseldi (Sv 1, 4, 7, 10, 13) | neşeli, yönlendiren (cheerful, guiding) |
| `kamp-sv-tedavi-2` | Yeni bir tarif açılmış olabilir! Malzemeyi bölüme yanında götür; uygun engeli bir kez etkisiz kılar. | Kamp: Tedavi Odası yükseldi (Sv 2, 5, 8, 11, 14) | heyecanlı (excited) |
| `kamp-sv-tedavi-3` | Unutma: gerçek hayatta tedaviyi hekim ve odyolog birlikte seçer. Burada ise oynayarak öğreniriz. | Kamp: Tedavi Odası yükseldi (Sv 3, 6, 9, 12, 15) | bilge, şefkatli (wise, caring) |
| `tedavi-al-01` | Malzemelerin çantanda! Haritada bir bölüm kartı aç, Çanta’ya dokun ve götürmek istediklerini seç. Kullanmadığın kaybolmaz. | Kamp: Tedavi Odası rafı ilk kez toplandı | sıcak, yönlendiren (warm, guiding) |
| `anit-dis-kulak` | Dış Kulak anıtı kampına geldi! Kulak kepçesi sesi toplar ve kanala yönlendirir. | Kamp: bölge anıtı yükseldi (Dış Kulak) | coşkulu (celebratory) |
| `anit-kanal` | Kanal anıtı yükseldi! Kulak kanalı bazı sesleri, şişe ağzına üflemek gibi güçlendirir. | Kamp: bölge anıtı yükseldi (Kanal) | coşkulu (celebratory) |
| `anit-zar` | Kulak Zarı anıtı geldi! Zar, gelen sesle titreşir ve titreşimi kemikçiklere verir. | Kamp: bölge anıtı yükseldi (Zar) | coşkulu (celebratory) |
| `anit-kemikcikler` | Kemikçikler anıtı kuruldu: çekiç, örs ve üzengi! Vücudumuzun en küçük kemikleri. | Kamp: bölge anıtı yükseldi (Kemikçikler) | hayranlık (wonder) |
| `anit-koklea-1` | Koklea anıtı parlıyor! Sarmal koklea, titreşimi sinir sinyaline hazırlar. | Kamp: bölge anıtı yükseldi (Koklea 1) | hayranlık (wonder) |
| `anit-koklea-2` | Tüy hücresi anıtı geldi! Benim akrabalarım: sesle eğilir ve elektrik sinyalini başlatırlar. | Kamp: bölge anıtı yükseldi (Koklea 2) | gururlu, duygulu (proud, touched) |
| `anit-koklea-3` | Tonotopi anıtı kuruldu! Kokleanın tabanı ince seslere, tepesi kalın seslere yanıt verir. | Kamp: bölge anıtı yükseldi (Koklea 3) | öğretici, coşkulu (explaining, celebratory) |
| `anit-sinir` | İşitme siniri anıtı yandı! Sinyaller binlerce lifle beyin sapına koşar. | Kamp: bölge anıtı yükseldi (Sinir) | heyecanlı (excited) |
| `anit-beyin-sapi` | Beyin Sapı anıtı kuruldu! İki kulaktan gelen sesler burada buluşur; sesin yönünü böyle buluruz. | Kamp: bölge anıtı yükseldi (Beyin Sapı) | bilge (wise) |
| `anit-korteks` | Korteks anıtı tamam! İşitsel korteks sesi anlamlı bir kelimeye, bir ninniye dönüştürür. | Kamp: bölge anıtı yükseldi (Korteks) | duygulu, gururlu (touched, proud) |
| `kg-tur-01` | Yeni: Kamp Görevleri! Kampın hikâyesini birlikte yazacağız; her gün de üç küçük görev var. | Açılış kutlaması: Kamp Görevleri (4. bölümden sonra) | coşkulu, sıcak (celebratory, warm) |
| `kg-tur-02` | Görevler burada. Ödülü hazır görevlerin sayısı düğmenin üstünde yazar. | Kamp: Görevler düğmesi vurgulanır (oyuncu dokunur) | yönlendiren (guiding) |
| `kg-oyun-01` | Yeni: Kamp oyunları! Odyometri Odası’nda Ton Avı, kulede Timpanogram Eşleştir seni bekliyor. | Açılış kutlaması: kamp oyunları (6. bölümden sonra) | neşeli (cheerful) |
| `kg-oyun-02` | Ton Avı bir işitme testi değil, kulağını eğlendiren bir oyundur. Günde beş tur ödüllü, gerisi eğlencesine. | Kamp: Görevler düğmesi; oyunların dürüst kuralı | göz kırpan, dürüst (playful, honest) |
| `kg-vaka-01` | Yeni: Hasta Vakaları! Odyoloji Kliniği’ne her gün yeni hastalar gelir; testleri sen seçersin. | Açılış kutlaması: Hasta Vakaları (7. bölümden sonra) | coşkulu, merak uyandıran (celebratory, curious) |
| `kg-vaka-02` | Kliniğe buradan girersin. Acele yok, hastalar seni bekler. Unutma: bu vakalar kurgusal, gerçek bir tıbbi öneri değil. | Kamp: Klinik düğmesi vurgulanır | bilge, şefkatli (wise, caring) |
| `kg-vaka-ilk` | İlk vakanı çözdün! Her vaka Vaka Defteri’ne yazılır. Daha az testle doğru karar, daha çok yıldız demek. | Klinik: ilk vaka çözüldü | gururlu (proud) |
| `kg-h1-giris` | Kampın hikâyesi başlıyor! Önce Kulak Deposu’nu kur, biriken ödülünü topla ve merkezini büyüt. | Kampın Hikâyesi 1. bölüm açıldı: Kampa Hoş Geldin | sıcak, heyecanlı (warm, excited) |
| `kg-h1-son` | Harika bir başlangıç! Kampın artık nefes alıyor. Sıradaki durak: klinik. | Kampın Hikâyesi 1. bölüm tamamlandı | gururlu (proud) |
| `kg-h2-giris` | Bir odyoloji kampının kalbi kliniğidir. Kliniği, Odyometri Odası’nı ve Timpanometri Kulesi’ni kur. | Kampın Hikâyesi 2. bölüm: Klinik Açılıyor | kararlı (determined) |
| `kg-h2-son` | Klinik açıldı! Kapına bir vaka panosu astım; yakında ilk hastalar gelecek. | Kampın Hikâyesi 2. bölüm tamamlandı | neşeli (cheerful) |
| `kg-h3-giris` | Ölçmeyi öğrenelim: odyometri odasında Ton Avı, kulede Timpanogram Eşleştir oyna. | Kampın Hikâyesi 3. bölüm: Ölçmeyi Öğren | merak uyandıran (curious) |
| `kg-h3-son` | Kulakların keskin, gözün eğride! Ölçmek, anlamanın ilk adımıdır. | Kampın Hikâyesi 3. bölüm tamamlandı | hayran (admiring) |
| `kg-h4-giris` | İlk hastaların bekleme salonunda. Önce dinle, sonra doğru testi seç. | Kampın Hikâyesi 4. bölüm: İlk Hastalar | şefkatli, öğretici (caring, explaining) |
| `kg-h4-son` | İlk vakaların defterde! Bir odyolog gibi düşünmeye başladın. | Kampın Hikâyesi 4. bölüm tamamlandı | gururlu (proud) |
| `kg-h5-giris` | Korumak, tedavi etmekten kolaydır. Tedavi Odası’nı kur ve malzeme hazırla. | Kampın Hikâyesi 5. bölüm: Koruma Sanatı | bilge (wise) |
| `kg-h5-son` | Çantan hazır! Bölümlerde malzemeyle engelleri aşabilirsin. | Kampın Hikâyesi 5. bölüm tamamlandı | neşeli (cheerful) |
| `kg-h6-giris` | Bir kampı birlikte çalışmak büyütür. Takımınla ya da kendi başına: yardım et, öğren, zor vakada danış. | Kampın Hikâyesi 6. bölüm: Takım Ruhu | sıcak (warm) |
| `kg-h6-son` | Takım ruhu tamam! Birlikte düşünen klinik daha doğru karar verir. | Kampın Hikâyesi 6. bölüm tamamlandı | gururlu, sıcak (proud, warm) |
| `kg-h7-giris` | Kampını güzelleştirme zamanı: bir dekor yerleştir ve bir arkadaşının kampını ziyaret et. | Kampın Hikâyesi 7. bölüm: Kampını Güzelleştir | neşeli (cheerful) |
| `kg-h7-son` | Ne güzel bir kamp oldu! Gelen herkes gülümseyecek. | Kampın Hikâyesi 7. bölüm tamamlandı | sevinçli (delighted) |
| `kg-h8-giris` | Kliniğini büyüt: zor vakalar uzman ister. Az testle doğru tanıya ulaşmayı dene. | Kampın Hikâyesi 8. bölüm: Uzman Klinik | kararlı (determined) |
| `kg-h8-son` | Artık uzman bir klinisyensin! Yıldızların defterini süslüyor. | Kampın Hikâyesi 8. bölüm tamamlandı | gururlu (proud) |
| `kg-h9-giris` | Kulağın derinliklerine iniyoruz: kokleaya ulaş, kuleni büyüt, farklı patolojileri tanı. | Kampın Hikâyesi 9. bölüm: Kulağın Derinlikleri | gizemli, heyecanlı (mysterious, excited) |
| `kg-h9-son` | Kokleanın sırlarını öğrendin! Az kaldı, büyük kamp seni bekliyor. | Kampın Hikâyesi 9. bölüm tamamlandı | hayran (wonder) |
| `kg-h10-giris` | Son bölüm: Büyük Kamp! Merkezini ve kliniğini en ileri seviyelere taşı. | Kampın Hikâyesi 10. bölüm: Büyük Kamp | coşkulu (rousing) |
| `kg-h10-son` | Başardın! Bu kamp artık bütün kulak yolculuğunun kalbi. Seninle gurur duyuyorum. | Kampın Hikâyesi 10. bölüm tamamlandı (son) | duygulu, gururlu (touched, proud) |
| `kamp-seviye-01` | Kampındaki her emek Kamp Seviyeni yükseltir. Her seviyede yeni bir ödül var: arazi, bina, süs, kostüm. | Kamp: Kamp Seviyesi göstergesi ilk kez görünür | gururlu, sıcak (proud, warm) |
| `kamp-seviye-up` | Kamp Seviyen yükseldi! Ödülüne bak; belki yeni bir süs, belki yepyeni bir arazi seni bekliyor. | Kamp: Kamp Seviyesi atladı (ödül afişiyle) | coşkulu (celebratory) |
| `kamp-bolge-koru` | Sessiz Koru açıldı! Ağaçlar sesi yutar; en hafif sesi ancak sessizlikte duyarız. Akustik Kabin’i burada kur. | Kamp: Sessiz Koru bölgesi açıldı | hayranlık, sakin (wonder, calm) |
| `kamp-bolge-koy` | Koklea Koyu açıldı! Lagünü iki buçuk tur döner, tıpkı koklea gibi. Yenidoğan Tarama Birimi burada. | Kamp: Koklea Koyu bölgesi açıldı | heyecanlı (excited) |
| `kamp-bolge-tepe` | Denge Tepesi açıldı! Üç patikası, iç kulaktaki üç yarım daire kanalı gibi birbirine diktir. | Kamp: Denge Tepesi bölgesi açıldı | merak uyandıran (curious) |
| `kamp-bolge-yerleske` | Araştırma Yerleşkesi açıldı! İyi bir odyolog okur, sorar ve kanıta bakar. Kütüphaneni burada kur. | Kamp: Araştırma Yerleşkesi bölgesi açıldı | bilge, gururlu (wise, proud) |
| `kamp-bolge-orman` | Kulak Kılı Ormanı açıldı! Kanalın girişindeki kıllar tozu tutar. Burada süslerin için upuzun bir alan var. | Kamp: Kulak Kılı Ormanı bölgesi açıldı | neşeli (cheerful) |
| `kamp-sus-01` | Süslemeler kampını senin yapar. Bir süs seç, sürükleyip yerine koy; istediğin an taşıyabilir ya da kaldırabilirsin. | Kamp: süsleme kipi ilk kez açıldı | sıcak, yönlendiren (warm, guiding) |
| `kamp-ziyaret-01` | Arkadaşının kampındasın! Gez, beğen ve bir alkış bırak. Alkış ikinize de Kamp Seviyesi kazandırır. | Kamp: bir arkadaşın kampı ilk kez geziliyor | neşeli, sıcak (cheerful, warm) |
| `kamp-sira-01` | Yapı ustası tek elle iki iş tutmaz ama sırayı bilir: bir sonrakini şimdi seç, bedelini öde; bu bitince kendiliğinden başlar. Vazgeçersen jetonun geri gelir. | Kamp: bir inşaat sürerken “Sıraya al” düğmesi ilk kez görünür (bina paneli ya da liste) | bilge, göz kırpan (wise, playful) |
| `kamp-sv-kabin-1` | Akustik kabin, dışarıdaki gürültü testi bozmasın diye yapılır. Sessizlikte daha çok öğrenirsin. | Kamp: Akustik Kabin yükseldi (Sv 1, 4, 7…) | sakin, öğretici (calm, explaining) |
| `kamp-sv-kabin-2` | Gürültü bir sesi örtebilir; buna maskeleme denir. Kabinin duvarları kalınlaştı, ölçüm daha doğru! | Kamp: Akustik Kabin yükseldi (Sv 2, 5, 8…) | öğretici (explaining) |
| `kamp-sv-kabin-3` | Kabinin içindeki köpük, sesi yansıtmadan yutar. Kampın da her emekte biraz daha büyüyor. | Kamp: Akustik Kabin yükseldi (Sv 3, 6, 9…) | gururlu (proud) |
| `kamp-sv-tarama-1` | Yenidoğan taramasında bebek uyurken kulağına birkaç dakika bakılır; hiç acıtmaz. | Kamp: Yenidoğan Tarama Birimi yükseldi (Sv 1, 4, 7…) | şefkatli (tender) |
| `kamp-sv-tarama-2` | Erken tanı, erken destek demektir. Tedavi Odan da artık daha hızlı hazırlıyor. | Kamp: Yenidoğan Tarama Birimi yükseldi (Sv 2, 5, 8…) | sıcak, öğretici (warm, explaining) |
| `kamp-sv-tarama-3` | Taramayı geçemeyen bebek hemen işitme kaybı var demek değildir; ayrıntılı testlere yönlendirilir. | Kamp: Yenidoğan Tarama Birimi yükseldi (Sv 3, 6, 9…) | bilge, güven veren (wise, reassuring) |
| `kamp-sv-park-1` | İşitsel rehabilitasyonda önce sesi fark etmeyi, sonra ayırt etmeyi, en sonunda anlamayı öğreniriz. | Kamp: İşitsel Rehabilitasyon Parkı yükseldi (Sv 1, 4, 7…) | öğretici, sıcak (explaining, warm) |
| `kamp-sv-park-2` | Parkın büyüdü! Kampa yeni süs yerleri açıldı ve tüy hücresi yardımcıların çoğaldı. | Kamp: İşitsel Rehabilitasyon Parkı yükseldi (Sv 2, 5, 8…) | neşeli (cheerful) |
| `kamp-sv-park-3` | Düzenli dinleme alıştırması, gürültüde konuşmayı anlamayı kolaylaştırabilir. | Kamp: İşitsel Rehabilitasyon Parkı yükseldi (Sv 3, 6, 9…) | cesaret veren (encouraging) |
| `kamp-sv-denge-1` | İç kulak yalnız duymaz, dengemizi de korur. Göz hareketlerine bakarak denge sistemini ölçeriz. | Kamp: Vestibüler Laboratuvar yükseldi (Sv 1, 4, 7…) | merak uyandıran (curious) |
| `kamp-sv-denge-2` | Üç yarım daire kanalı başın dönüşünü algılar. Deponun dolma süresi uzadı; kampın dengede! | Kamp: Vestibüler Laboratuvar yükseldi (Sv 2, 5, 8…) | öğretici (explaining) |
| `kamp-sv-denge-3` | Baş çevirince gelen kısa baş dönmesinde, iç kulaktaki kristaller yerinden oynamış olabilir. | Kamp: Vestibüler Laboratuvar yükseldi (Sv 3, 6, 9…) | bilge (wise) |
| `kamp-sv-kutuphane-1` | Kütüphanende okudukça kampın büyür. Okuma köşesindeki birikimi arada bir topla. | Kamp: Odyoloji Kütüphanesi yükseldi (Sv 1, 4, 7…) | sıcak, yönlendiren (warm, guiding) |
| `kamp-sv-kutuphane-2` | İyi bir karar; araştırmaya, deneyime ve kişinin isteğine birlikte bakarak verilir. | Kamp: Odyoloji Kütüphanesi yükseldi (Sv 2, 5, 8…) | bilge (wise) |
| `kamp-sv-kutuphane-3` | Her soru yeni bir kapı açar. Rafların doldu, okuma köşen daha çabuk birikiyor! | Kamp: Odyoloji Kütüphanesi yükseldi (Sv 3, 6, 9…) | neşeli, gururlu (cheerful, proud) |
| `ipucu-tazele-kayma` | Hatırla: aşağı kaydır, perdenin altından kay! | 5. bölüm: kayma tazeleme anı (ilk perdeden önce, bir kez) | sıcak, hatırlatan (warm, reminding) |
| `ipucu-perde-kay` | Kıl perdesi alçak. Aşağı kaydır, altından kay! | 3-8. bölüm: ilk kıl perdesinin önünde (oyuncu başına bir kez) | sakin, yol gösteren (calm, guiding) |
| `ipucu-ogret-zipla` | Ekrana dokun, zıpla! Basılı tutarsan daha yükseğe çıkarsın. | 1. bölüm: Zıpla öğretici anı | neşeli, cesaret veren (cheerful, encouraging) |
| `ipucu-ogret-don` | Geri dönmek için parmağını koşunun tersine kaydır. | 2. bölüm: Geri Dön öğretici anı | sakin, yol gösteren (calm, guiding) |
| `ipucu-ogret-kayma` | Aşağı kaydır: alçak engelin altından kayarsın! | 3. bölüm: Kayma öğretici anı | neşeli, yol gösteren (cheerful, guiding) |
| `ipucu-ogret-duvar` | Duvara değdiğin an dokun: karşı duvara zıplarsın! | 6. bölüm: Duvar Zıplaması öğretici anı | heyecanlı (excited) |
| `ipucu-ogret-suzul` | Havada basılı tut: ses kanatlarınla süzülürsün. | 9. bölüm: Süzülme öğretici anı | yumuşak, hayran (soft, admiring) |
| `ipucu-ogret-trambolin` | Zara değdiğin an dokun: güçlü bir sıçrayış! | 9. bölüm: Zar Sıçrayışı öğretici anı | heyecanlı (excited) |
| `ipucu-ogret-kanca` | Kancanın yanında basılı tut ve sallan; bırakınca fırlarsın! | 13. bölüm: Kanca öğretici anı | heyecanlı, yol gösteren (excited, guiding) |
| `ipucu-ogret-cakil` | Havada aşağı kaydır: çatlak zemini kır, anahtara bas! | 15. bölüm: Yere Çakılma öğretici anı | kararlı (determined) |
| `ipucu-ogret-yuz` | Sıvıda basılı tut, yüksel; bırakınca dalarsın. | 21. bölüm: Yüzme öğretici anı | sakin (calm) |
| `ipucu-ogret-darbe` | Koşu yönüne kaydır: ses darbesiyle gürültü duvarını kır! | 31. bölüm: Ses Darbesi öğretici anı | güçlü, coşkulu (strong, rousing) |
| `ipucu-ogret-cevir` | Mor bölgede dokun: yerçekimi ters döner! | 35. bölüm: Yerçekimi Çevirme öğretici anı | gizemli, heyecanlı (mysterious, excited) |
| `not-kepce-yon` | Kulak kepçesinin kıvrımları, sesin yukarıdan mı aşağıdan mı geldiğini anlamamıza yardım eder. | Tüy Dede'nin Notu · dis-kulak | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-hz` | Hertz, sesin saniyedeki titreşim sayısıdır; çok titreşen ses ince duyulur. | Tüy Dede'nin Notu · dis-kulak | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-db` | Desibel ölçeği logaritmiktir: küçük bir sayı artışı büyük bir enerji artışı demektir. | Tüy Dede'nin Notu · dis-kulak | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-kanal-rezonans` | Kulak kanalı, şişe ağzına üflemek gibi bazı sesleri kendiliğinden güçlendirir. | Tüy Dede'nin Notu · kanal | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-serumen-temiz` | Kulak kendi kendini temizler; pamuklu çubuk kiri çoğu zaman daha derine iter. | Tüy Dede'nin Notu · kanal | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-gurultu-sure` | Ses ne kadar yüksekse, güvenle dinleyebileceğimiz süre o kadar kısalır. | Tüy Dede'nin Notu · kanal | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-empedans` | Orta kulak, havadaki sesi iç kulak sıvısına aktarırken onu güçlendiren bir yükseltici gibi çalışır. | Tüy Dede'nin Notu · zar | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-timpanometri` | Timpanometri, kulak zarının ne kadar rahat hareket ettiğini ölçen kısa ve ağrısız bir testtir. | Tüy Dede'nin Notu · zar | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-ome` | Çocuklarda orta kulakta sıvı birikmesi sık görülür ve işitmeyi geçici olarak azaltabilir. | Tüy Dede'nin Notu · zar | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-akustik-refleks` | Çok yüksek seste orta kulaktaki minik bir kas kasılır ve kulağı biraz korur. | Tüy Dede'nin Notu · kemikcikler | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-otoskleroz` | Bazı kişilerde üzengi kemiği sertleşip hareketini kaybedebilir; buna otoskleroz denir. | Tüy Dede'nin Notu · kemikcikler | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-kemik-yolu` | Sesi kafatası kemikleri yoluyla da duyarız; kendi sesimizi kayıtta farklı bulmamızın bir nedeni budur. | Tüy Dede'nin Notu · kemikcikler | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-dalga` | Kokleadaki dalga tabandan tepeye doğru ilerler; her ses kendi noktasında en büyük olur. | Tüy Dede'nin Notu · koklea-1 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-pil` | Kokleanın içinde, küçük bir pil gibi bir elektrik gerilimi vardır. | Tüy Dede'nin Notu · koklea-1 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-denge` | İç kulak yalnızca işitmez, dengemizi de sağlar. | Tüy Dede'nin Notu · koklea-1 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-oae-not` | Sağlıklı bir kulak kendi çok hafif sesini üretir; bebeklerin işitmesi bununla taranabilir. | Tüy Dede'nin Notu · koklea-2 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-prestin` | Dış tüy hücreleri sesle birlikte dans eder ve hafif sesleri güçlendirir. | Tüy Dede'nin Notu · koklea-2 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-rekrutman` | İç kulak kaynaklı işitme kaybında sesler bir noktadan sonra hızla fazla yüksek gelebilir. | Tüy Dede'nin Notu · koklea-2 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-presbiakuzi` | Yaşla birlikte genellikle önce ince seslerin duyulması azalır. | Tüy Dede'nin Notu · koklea-3 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-gurultu-centik` | Uzun süre yüksek sese maruz kalmak tüy hücrelerine kalıcı zarar verebilir. | Tüy Dede'nin Notu · koklea-3 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-implant` | Koklear implant, sesi elektrik sinyaline çevirip işitme sinirini doğrudan uyarır. | Tüy Dede'nin Notu · koklea-3 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-ototoksik` | Bazı ilaçlar iç kulağa zarar verebilir; bu yüzden hekim kontrolünde kullanılırlar. | Tüy Dede'nin Notu · koklea-3 | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-abr-not` | Uyuyan bir bebeğin bile işitmesi, beyin sapından gelen minik elektrik dalgalarıyla değerlendirilebilir. | Tüy Dede'nin Notu · sinir | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-kayip-turleri` | İşitme kaybı, sorunun kulağın hangi bölümünde olduğuna göre adlandırılır. | Tüy Dede'nin Notu · sinir | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-hl-spl` | Odyogramdaki 0 dB “hiç ses yok” demek değildir; genç ve sağlıklı kulakların ortalama duyma eşiğidir.<br><small>okunuş: Odyogramdaki sıfır desibel, hiç ses yok demek değildir; genç ve sağlıklı kulakların ortalama duyma eşiğidir.</small> | Tüy Dede'nin Notu · sinir | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-tarama` | Yenidoğan işitme taraması, işitme kaybını erken fark edip erken desteklemeyi sağlar. | Tüy Dede'nin Notu · sinir | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-yon` | İki kulağımız sayesinde sesin nereden geldiğini buluruz. | Tüy Dede'nin Notu · beyin-sapi | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-maskeleme` | Bir ses başka bir sesi bastırabilir; buna maskeleme denir. | Tüy Dede'nin Notu · beyin-sapi | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-rinne-weber` | Diyapazon testleri, basit bir çatalla işitme kaybının türü hakkında ipucu verir. | Tüy Dede'nin Notu · beyin-sapi | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-konusma-muzu` | Konuşma seslerinin odyogramda kapladığı alan muza benzediği için “konuşma muzu” denir. | Tüy Dede'nin Notu · korteks | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-kokteyl` | Beyin, kalabalık bir odada tek bir konuşmaya odaklanabilir. | Tüy Dede'nin Notu · korteks | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-cihaz` | İşitme cihazları sesi her frekans için ayrı ayrı ayarlayarak yükseltir. | Tüy Dede'nin Notu · korteks | bilge, sıcak, merak uyandıran (wise, warm) |
| `not-tinnitus` | Kulak çınlaması, dışarıda bir ses yokken ses duyma hissidir ve oldukça yaygındır. | Tüy Dede'nin Notu · korteks | bilge, sıcak, merak uyandıran (wise, warm) |
| `pat-serumen-tikaci` | Kulak kiri normalde kendiliğinden dışarı çıkar; birikip tıkaç olursa sesin yolunu kapatır. Üstünden atla! | Bölümde ilk karşılaşma: Kulak kiri tıkacı (Serumen tıkacı (buşon)) · 6. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-otitis-eksterna` | İltihaplanan kanal derisi şişer ve geçit daralır. Altından kayarak geç! | Bölümde ilk karşılaşma: Dış kulak iltihabı (Otitis eksterna) · 7. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-eksostoz` | Soğuk suyla sık karşılaşan kanalda küçük kemik çıkıntıları büyüyebilir. Sivri çıkıntının üstünden zıpla! | Bölümde ilk karşılaşma: Kanal kemik çıkıntısı (Eksostoz ("sörfçü kulağı")) · 6. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-perforasyon` | Zarda delik olursa orası titreşmez: deliğin üstünden zıplayıp karşıya geç! | Bölümde ilk karşılaşma: Kulak zarı deliği (Timpanik membran perforasyonu) · 9. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-timpanoskleroz` | Zarda beyaz, tebeşir gibi plaklar oluşursa zar sertleşir ve daha az titreşir. | Bölümde ilk karşılaşma: Zar sertleşmesi (Timpanoskleroz) · 10. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-retraksiyon` | Orta kulak basıncı düşük kalırsa zar içeri doğru çekilip bir cep oluşturabilir. | Bölümde ilk karşılaşma: Zar çekilmesi (Retraksiyon cebi) · 11. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-otitis-media` | Orta kulakta sıvı birikirse kemikçikler rahat titreşemez; çocuklarda sık görülür ve çoğu kendiliğinden geçer. | Bölümde ilk karşılaşma: Orta kulakta sıvı (Seröz otitis media) · 14. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-ostaki` | Östaki borusu yutkununca açılır ve basıncı eşitler. Geçit kapalıysa "yutkunma" anahtarına dokun! | Bölümde ilk karşılaşma: Östaki borusu tıkanıklığı (Östaki tüpü disfonksiyonu) · 13. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-otoskleroz` | Üzengi kemiği oval pencerede takılırsa titreşim iç kulağa geçmez. Yere çakılıp serbest bırak! | Bölümde ilk karşılaşma: Üzengi kemiği takılması (Otoskleroz) · 15. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-zincir-kopuk` | Kemikçiklerden biri ayrılırsa titreşim zincirden geçmez. Gidip gelen köprüyle boşluğu aş! | Bölümde ilk karşılaşma: Kemikçik zinciri kopukluğu (Kemikçik zinciri diskontinüitesi) · 19. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-gurultu-hasari` | Çok yüksek ses tüy hücrelerini yorar. Gürültü bulutuna değmeden geç! | Bölümde ilk karşılaşma: Gürültü hasarı (Gürültüye bağlı işitme kaybı) · 21. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-presbiakuzi` | Yıllar geçtikçe kokleanın tabanındaki (tiz sesler) tüy hücreleri seyrelir. Seyrek basamaklarda oyalanma! | Bölümde ilk karşılaşma: Yaşa bağlı işitme kaybı (Presbiakuzi) · 21. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-ototoksisite` | Bazı ilaçlar iç kulağa zarar verebilir; bu yüzden hekimler izler. Düşen zehirli damlalardan kaç! | Bölümde ilk karşılaşma: İlaca bağlı iç kulak hasarı (Ototoksisite) · 23. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-meniere` | İç kulakta sıvı fazlalaşınca denge ve işitme dalgalanır; bu zemin yalpalıyor, zamanla bin! | Bölümde ilk karşılaşma: Meniere hastalığı (Endolenfatik hidrops) · 23. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-noroma` | İşitme sinirinde yavaş büyüyen, iyi huylu bir doku yolu daraltabilir. Ses darbesiyle geçidi aç! | Bölümde ilk karşılaşma: İşitme siniri tümörü (Vestibüler schwannom (akustik nörinom)) · 31. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-noropati` | Ses kulağa ulaşır ama sinirde zamanlaması bozulur. Basamaklar ritimden kayıyor: gözünle izle! | Bölümde ilk karşılaşma: İşitsel nöropati (İşitsel nöropati spektrum bozukluğu) · 35. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-tinnitus` | Çınlama, dışarıda olmayan bir sesi duymaktır. Bu bulut aralıklarla çınlıyor: sustuğu anda geç! | Bölümde ilk karşılaşma: Kulak çınlaması (Tinnitus) · 37. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
| `pat-merkezi` | Kulak iyi duysa da beyin sesi düzenlemekte zorlanabilir. Yankı yolu karışık: her basamağı ses darbesiyle uyandır! | Bölümde ilk karşılaşma: İşitsel işlemleme bozukluğu (Merkezi işitsel işlemleme bozukluğu) · 37. bölüm | bilge, sakin, yol gösteren (wise, calm, guiding) |
