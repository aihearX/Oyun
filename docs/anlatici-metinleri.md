# Tüy Dede — anlatıcı metinleri

> Bu dosya `node tools/voice/generate.mjs --export` ile üretilir; kaynak: `apps/web/src/ftue/script.ts`. Elle düzenlemeyin.
> Aynı liste CSV olarak: `docs/anlatici-metinleri.csv` (id, metin, okunuş, bağlam, duygu, dosya adı).

## Seslendirme yönergesi

Tüy Dede: iç kulağın en yaşlı tüy hücresi. 65-75 yaşlarında, bilge, sıcak, şefkatli bir dede sesi; hafif boğuk ve derin, acelesiz (normalden biraz yavaş), gülümseyerek konuşur. Çocuklara (7-12 yaş) masal anlatır gibi; heyecanlı yerlerde canlanır ama asla bağırmaz. Noktalama işaretlerinde doğal duraklar. Türkçe, İstanbul ağzı, net diksiyon.

Dosyalar `apps/web/public/voice/<id>.mp3` adıyla konur (mono, ~48 kbps MP3, −16 LUFS). Uygulama bir satırı yalnızca
kayıt metni ekrandaki altyazıyla aynıysa çalar (manifest'teki parmak izi); kaydı olmayan satırda cihazın sesi (TTS) devreye girer.

## Ses lisansı

- Üretim: **Coqui TTS** (MPL-2.0 kitaplık; yalnız geliştirici makinesinde çalışır, uygulamaya girmez).
- Model: `tts_models/tr/common-voice/glow-tts` + `vocoder_models/tr/common-voice/hifigan` — yazar **Fatih Akademi**, lisans **MIT**;
  eğitim verisi Mozilla **Common Voice** Türkçe (CC0). Model dosyaları:
  https://github.com/coqui-ai/TTS/releases/tag/v0.6.1_models
- Uygulamada anma: Ayarlar › "Anlatıcı sesi: Coqui TTS, Fatih Akademi Türkçe modeli (MIT)".
- Üretilen ses dosyaları bu projenin parçasıdır; model MIT olduğundan ticari kullanım serbesttir (MIT bildirimi yukarıdadır).

## Üretim

```
python3.12 -m venv ~/odi-tts && ~/odi-tts/bin/pip install "coqui-tts[codec]" --extra-index-url https://download.pytorch.org/whl/cpu
# modeller (bir kez): yukarıdaki iki zip'i indirip bir klasöre açın
ODI_TTS_PY=~/odi-tts/bin/python ODI_TTS_MODELS=~/odi-tts/models node tools/voice/generate.mjs
```

Üslup (ffmpeg): perde -2 yarım ton (biçimleyiciler korunur), tempo ×0.92, sıcak alçak orta, yumuşak tiz,
hafif vibrato/tremolo (yaşlı ses titremesi), hafif oda yankısı, −16 LUFS, sessizlik kırpma. Adaylar: sicak, dede, derin (seçilen: **dede**).

## Satırlar (77)

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
