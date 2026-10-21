/**
 * Tüy Dede'nin bütün sözleri: tek kaynak. Hikâye, turlar ve açılış duyuruları buradan okunur.
 * Her satırın kalıcı bir kimliği var; kayıtlı ses dosyaları bu kimlikle eşleşir (apps/web/public/voice/<id>.mp3).
 * Metin değişirse textHash değişir ve eski kayıt kullanılmaz (altyazıyla uyuşmayan ses çalınmaz; cihaz sesi devreye girer).
 * Bu dosya içe aktarma yapmaz: tools/voice/generate.mjs de Node ile doğrudan okur.
 */
export interface NarratorLine {
  /** dosya adı da budur: <id>.mp3 */
  id: string;
  text: string;
  /** seslendiren için: satırın nerede, ne olurken söylendiği */
  context: string;
  /** önerilen duygu / ton */
  emotion: string;
  /** seslendirme için yazım (yalnız gerekirse): model q/w/x, rakam ve kısaltma okuyamaz → okunduğu gibi yazılır */
  spoken?: string;
}

/** seslendirme yönergesi (oyuncuya / TTS hizmetine) */
export const VOICE_DIRECTION =
  'Tüy Dede: iç kulağın en yaşlı tüy hücresi. 65-75 yaşlarında, bilge, sıcak, şefkatli bir dede sesi; ' +
  'hafif boğuk ve derin, acelesiz (normalden biraz yavaş), gülümseyerek konuşur. Çocuklara (7-12 yaş) masal anlatır gibi; ' +
  'heyecanlı yerlerde canlanır ama asla bağırmaz. Noktalama işaretlerinde doğal duraklar. Türkçe, İstanbul ağzı, net diksiyon.';

export const NARRATOR_LINES: readonly NarratorLine[] = [
  // ---- hikâye girişi (ilk açılış, resimli 7 sahne)
  { id: 'hikaye-01', text: 'Merhaba! Ben Tüy Dede, iç kulağın en yaşlı tüy hücresiyim. Seni bekliyordum.', context: 'Hikâye 1/7: Tüy Dede kendini tanıtır', emotion: 'sıcak, karşılayıcı (warm, welcoming)' },
  { id: 'hikaye-02', text: 'Bu Odi: minik bir ses. Annesinin ninnisini taşıyor.', context: 'Hikâye 2/7: kahraman Odi tanıtılır', emotion: 'şefkatli (tender)' },
  { id: 'hikaye-03', text: 'Ninni kulaktan girer, kanalı geçer, kulak zarına ve kemikçiklere ulaşır; kokleadan işitme siniriyle beyne gider.', context: 'Hikâye 3/7: kulaktan beyne yolculuk haritası', emotion: 'anlatıcı, merak uyandıran (storytelling)' },
  { id: 'hikaye-04', text: 'Ama Büyük Sessizlik geliyor! Gürültü canavarları kulağın ışıklarını söndürüyor.', context: 'Hikâye 4/7: tehlike, karanlık sahne', emotion: 'gizemli, endişeli (ominous, hushed)' },
  { id: 'hikaye-05', text: 'Senin görevin: her bölümü geç, yıldızları topla, bölgeleri yeniden ışıt ve ninniyi beyne ulaştır.', context: 'Hikâye 5/7: oyunun hedefi', emotion: 'kararlı, cesaret veren (determined)' },
  { id: 'hikaye-06', text: 'Yalnız değilsin: arkadaşların ve takımın yardım eder. Her yeni yeri ben sana tek tek göstereceğim.', context: 'Hikâye 6/7: arkadaşlar ve takım', emotion: 'güven veren, göz kırpan (reassuring)' },
  { id: 'hikaye-07', text: 'Hadi, ilk bölüme! Ekrana dokun: Odi zıplar. Basılı tutarsan daha uzağa gider. Notaları topla!', context: 'Hikâye 7/7: 1. bölüm başlamadan, nasıl oynanır', emotion: 'heyecanlı (excited)' },

  // ---- 1. bölüm sonucu
  { id: 'sonuc-01', text: 'Bravo! İlk bölümü geçtin. Ninni bir adım daha yol aldı.', context: '1. bölüm sonuç ekranı, yıldızlar parlarken', emotion: 'gururlu, sevinçli (proud)' },
  { id: 'sonuc-02', text: 'Yıldızlar bölümü ne kadar iyi geçtiğini gösterir: notaların çoğunu topla, hızlı ol, hiç düşme. Üç yıldız en iyisi!', context: 'Sonuç: yıldızlar açıklanır', emotion: 'öğretici, sıcak (explaining)' },
  { id: 'sonuc-03', text: 'Topladığın notalar jetona dönüşür. Jetonla yetenek alır, kampını büyütürsün.', context: 'Sonuç: nota ve jeton açıklanır', emotion: 'öğretici (explaining)' },
  { id: 'sonuc-04', text: 'Şimdi yolculuğun haritasına bakalım. Harita düğmesine dokun.', context: 'Sonuç: Harita düğmesi gösterilir (oyuncu dokunur)', emotion: 'davet eden (inviting)' },

  // ---- harita turu
  { id: 'harita-01', text: 'İşte yolun: kulak kepçesinden beyne uzanır. Her bölüm seni biraz daha ileri götürür.', context: 'Harita ilk kez açılınca', emotion: 'hayranlık (wonder)' },
  { id: 'harita-02', text: 'Üstte seviyen, yıldızların ve jetonların var.', context: 'Harita: üst bilgi çubuğu vurgulanır', emotion: 'sakin, öğretici (calm)' },
  { id: 'harita-03', text: 'Aşağıdaki yerler kilitli. Bölüm geçtikçe tek tek açılır; her yenisini sana ben göstereceğim.', context: 'Harita: kilitli alt sekmeler', emotion: 'gizemli, söz veren (promising)' },
  { id: 'harita-04', text: 'Sıradaki bölüm burada. Dokun ve devam et!', context: 'Harita: sıradaki bölüm düğmesi (oyuncu dokunur)', emotion: 'cesaret veren, göz kırpan (encouraging)' },

  // ---- alt sekmeye dokun (her açılış turunda gerekirse)
  { id: 'sekme-bugun', text: 'Aşağıdaki Bugün düğmesine dokun.', context: 'Alt sekme çubuğunda Bugün vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-kamp', text: 'Aşağıdaki Kamp düğmesine dokun.', context: 'Alt sekme çubuğunda Kamp vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-profil', text: 'Aşağıdaki Profil düğmesine dokun.', context: 'Alt sekme çubuğunda Profil vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-takim', text: 'Aşağıdaki Takım düğmesine dokun.', context: 'Alt sekme çubuğunda Takım vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'sekme-harita', text: 'Aşağıdaki Harita düğmesine dokun.', context: 'Alt sekme çubuğunda Harita vurgulanır', emotion: 'yönlendiren (guiding)' },

  // ---- Bugün (2. bölümden sonra açılır)
  { id: 'bugun-01', text: 'Yeni bir yer açıldı: Bugün! Her gün uğra; takvim ödülü, üç görev ve günlük sandık seni bekler.', context: 'Açılış kutlaması: Bugün', emotion: 'coşkulu (celebratory)' },
  { id: 'bugun-02', text: 'Bugünün takvim ödülü hazır. Al’a dokun ve topla!', context: 'Bugün: takvim ödülü (oyuncu dokunur)', emotion: 'neşeli (cheerful)' },
  { id: 'bugun-03', text: 'İşte ödülün! Topla’ya dokun, jetonlar cebine girsin.', context: 'Bugün: ödül kutlaması açık (oyuncu dokunur)', emotion: 'sevinçli (delighted)' },
  { id: 'bugun-04', text: 'Bunlar günlük görevler. Oynadıkça dolar; bitince ödülünü buradan alırsın. Üçü de bitince sandık açılır.', context: 'Bugün: günlük görevler listesi', emotion: 'öğretici (explaining)' },

  // ---- Kamp (3. bölümden sonra) ve kamp öğreticisi
  { id: 'kamp-01', text: 'Yeni bir yer açıldı: Kulak Kampı! Burada binalar kurarsın; sen oyundayken bile çalışırlar.', context: 'Açılış kutlaması: Kamp', emotion: 'coşkulu (celebratory)' },
  { id: 'kamp-insa-01', text: 'Burası senin kampın. Binalar jeton üretir, kalkan şansı verir, takımına güç katar.', context: 'Kamp öğreticisi: kamp ilk kez açılınca', emotion: 'gururlu, sıcak (proud)' },
  { id: 'kamp-insa-02-depo', text: 'İlk işimiz: Kulak Deposu. Binaya dokun.', context: 'Kamp öğreticisi: Kulak Deposu arsası vurgulanır (oyuncu dokunur)', emotion: 'yönlendiren (guiding)' },
  { id: 'kamp-insa-02', text: 'İlk işimiz: parlayan bina. Binaya dokun.', context: 'Kamp öğreticisi: depo kuruluysa başka bir bina vurgulanır', emotion: 'yönlendiren (guiding)' },
  { id: 'kamp-insa-03', text: 'Bu panelde binanın şimdi ne yaptığı ve bir sonraki seviyede ne olacağı yazar.', context: 'Kamp öğreticisi: bina panelinde etki satırı', emotion: 'öğretici (explaining)' },
  { id: 'kamp-insa-04', text: 'Bedeli ve süresi burada. Şimdi düğmeye dokun ve inşaatı başlat!', context: 'Kamp öğreticisi: Kur düğmesi (oyuncu dokunur)', emotion: 'cesaret veren (encouraging)' },
  { id: 'kamp-insa-05', text: 'Harika, inşaat başladı! Süre dolunca hazır olur. Takımın olunca arkadaşların tek dokunuşla hızlandırır.', context: 'Kamp öğreticisi: inşaat başladı', emotion: 'sevinçli, göz kırpan (delighted)' },

  // ---- Arkadaşlar (4. bölümden sonra)
  { id: 'arkadas-01', text: 'Yeni: Arkadaşlar ve mesajlar! Arkadaşını kodla ekle, mesajlaş, her gün hediye gönder.', context: 'Açılış kutlaması: Arkadaşlar', emotion: 'coşkulu (celebratory)' },
  { id: 'arkadas-02', text: 'Arkadaşlar burada. Arkadaş kodunu paylaş; birlikte daha hızlı ilerlersiniz.', context: 'Profil: Arkadaşlar kutucuğu vurgulanır', emotion: 'sıcak (warm)' },

  // ---- Kulak Sözlüğü (4. bölümden sonra, arkadaşlardan hemen sonra)
  { id: 'sozluk-01', text: 'Yeni: Kulak Sözlüğü! Ulaştığın her bölgenin terimleri burada: önce sade anlatım, istersen odyoloji ayrıntısı.', context: 'Açılış kutlaması: Kulak Sözlüğü', emotion: 'bilge, meraklandıran (wise, curious)' },
  { id: 'sozluk-02', text: 'Sözlük burada, Profil’in içinde. Dokun ve bir bak!', context: 'Profil: Kulak Sözlüğü kutucuğu (oyuncu dokunur)', emotion: 'davet eden (inviting)' },
  { id: 'sozluk-03', text: 'Her terimin sade bir tanımı var. Daha fazla’ya dokunursan odyoloji öğrencileri için ayrıntı açılır.', context: 'Kulak Sözlüğü: ilk terim kartı', emotion: 'öğretici, sıcak (explaining)' },

  // ---- Takım (5. bölümden sonra)
  { id: 'takim-01', text: 'Yeni: Takım! Takımda birbirinize yardım edersiniz: inşaatlar hızlanır, kalkan gelir.', context: 'Açılış kutlaması: Takım', emotion: 'coşkulu (celebratory)' },
  { id: 'takim-02', text: 'Birlikte Bölge Savaşı’nda yer kaparsınız ve Gürültü Canavarı’na hep beraber vurursunuz.', context: 'Takım: takım avantajları', emotion: 'heyecanlı, cesur (rousing)' },
  { id: 'takim-03', text: 'Bir takıma kodla katılabilir ya da kendi takımını kurabilirsin. Karar senin!', context: 'Takım: kodla katıl / takım kur', emotion: 'göz kırpan (playful)' },

  // ---- Mağaza (6. bölümden sonra)
  { id: 'magaza-01', text: 'Yeni: Mağaza, Dolap ve Ödül kutusu! Odi’ye şapka ve renk seç, ödüllerini topla.', context: 'Açılış kutlaması: Mağaza ve Dolap', emotion: 'coşkulu (celebratory)' },
  { id: 'magaza-02', text: 'Dolap burada: Odi’yi istediğin gibi giydir. Kazandığın kozmetikler hep buraya gelir.', context: 'Profil: Dolap kutucuğu vurgulanır', emotion: 'neşeli (cheerful)' },

  // ---- Etkinlikler (7. bölümden sonra)
  { id: 'etkinlik-01', text: 'Yeni: Etkinlikler! Ralli, düello, bayrak yarışı ve quiz: takımca oynanır, ödülleri büyüktür.', context: 'Açılış kutlaması: Etkinlikler', emotion: 'coşkulu (celebratory)', spoken: 'Yeni: Etkinlikler! Ralli, düello, bayrak yarışı ve kuiz: takımca oynanır, ödülleri büyüktür.' },
  { id: 'etkinlik-02', text: 'Etkinlik çadırı haritanın sağında. Dokun ve bir bak!', context: 'Harita: etkinlik çadırı (oyuncu dokunur)', emotion: 'merak uyandıran (intriguing)' },

  // ---- Canlı yarış (8. bölümden sonra)
  { id: 'yaris-01', text: 'Yeni: Canlı yarış ve meydan okuma! Arkadaşınla aynı bölümü aynı anda koş; kim önde bitirecek?', context: 'Açılış kutlaması: Canlı yarış', emotion: 'heyecanlı, meydan okuyan (competitive)' },

  // ---- İletişim (docs/13-iletisim.md) — kayıtlı ses yok: tools/voice/generate.mjs ile yeniden üretilmeli (o zamana dek altyazı / cihaz sesi)
  { id: 'yazi-01', text: 'Sekiz bölümü geçtin! Artık sohbette kendi sözlerinle de yazabilirsin.', context: 'Açılış kutlaması: serbest yazı (8. bölümden sonra; öncesinde yalnız hazır sözler)', emotion: 'gururlu, sıcak (proud, warm)' },
  { id: 'yazi-02', text: 'Birkaç kural: nazik ol ve kişisel bilgini paylaşma. Kötü sözler yıldızlanır; üç kişinin şikâyet ettiği mesaj gizlenir.', context: 'Serbest yazı kuralları (bir kez gösterilir)', emotion: 'bilge, şefkatli (wise, caring)' },
  { id: 'akis-01', text: 'Yeni: Takım Akışı! Takım arkadaşın bölüm geçince, canavar yenince ya da altın koklea bulunca sohbette bir kart belirir.', context: 'Açılış kutlaması: Takım Akışı (6. bölümden sonra)', emotion: 'coşkulu (celebratory)' },
  { id: 'akis-02', text: 'Karta bir tepki bırak ya da Tebrik et’e dokun. Hazır sözlerle tek dokunuşta konuşursun; takılırsan takımından yardım iste!', context: 'Takım sohbeti: akış kartı ve hazır sözler vurgulanır', emotion: 'sıcak, cesaret veren (warm, encouraging)' },
  { id: 'soru-01', text: 'Yeni: Günün Sorusu! Her gün takım sohbetine bir kulak sorusu bırakırım. Akşam sekizde cevabını ve açıklamasını söylerim; birlikte tartışın!', context: 'Açılış kutlaması: Günün Sorusu (9. bölümden sonra)', emotion: 'bilge, meraklandıran (wise, curious)' },
  { id: 'soru-02', text: 'İşte bugünün sorusu. Bir şık seç; doğru bilene jeton var.', context: 'Takım sohbeti: Günün Sorusu kartı vurgulanır', emotion: 'göz kırpan (playful)' },
  { id: 'ikili-01', text: 'Yeni: İkili Görev! Bir arkadaşınla haftalık ortak hedef seçin; ikinizin notaları birlikte sayılır, sandığı birlikte açarsınız.', context: 'Açılış kutlaması: İkili Görev (10. bölümden sonra)', emotion: 'coşkulu (celebratory)' },
  { id: 'ikili-02', text: 'Birlikte burada, Profil’in içinde. Arkadaşını seç ve davet et.', context: 'Profil: Birlikte kutucuğu vurgulanır', emotion: 'davet eden (inviting)' },
  { id: 'usta-01', text: 'Artık bir ustasın! Yeni başlayan bir arkadaşına çırak teklif et; o ilerledikçe ikiniz de ödül alırsınız.', context: 'Açılış kutlaması: Usta–Çırak (11. bölümden sonra)', emotion: 'gururlu, sıcak (proud, warm)' },
];

const BY_ID = new Map(NARRATOR_LINES.map((l) => [l.id, l]));

/** satırın metni (bilinmeyen kimlik bir yazım hatasıdır: hemen fark edilsin) */
export function lineText(id: string): string {
  const l = BY_ID.get(id);
  if (!l) throw new Error(`Tüy Dede satırı yok: ${id}`);
  return l.text;
}

/** metnin kısa parmak izi (FNV-1a 32 bit): kayıt bu metinle mi yapıldı? Boşluk farkları sayılmaz. */
export function textHash(text: string): string {
  const s = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
