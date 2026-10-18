import type { BiomeId } from '@odi/shared';

/**
 * Kulak Kartları albümü: her biyom için 5 bilgi kartı. Bilgiler genel kabul görmüş odyoloji/anatomi bilgileridir;
 * sayılar yaklaşık ve yuvarlaktır ("yaklaşık" diye yazılır). Yeni kart eklerken doğruluğu kontrol et.
 *
 * Açılma yolları (oyunda yazılı):
 *  ilk     — biyomda ilk bölümü bitir
 *  yildiz  — biyomda bir bölümde 3 yıldız al
 *  ozel    — biyomda gizli altın koklea bul (gizli bölümü olan biyomlar) ya da hasarsız bitir (diğerleri)
 *  sandik  — günlük sandıktan gelir (içeriği sandıkta önceden yazılı)
 *  usta    — biyomdaki tüm bölümleri bitir
 */
export type CardSlot = 'ilk' | 'yildiz' | 'ozel' | 'sandik' | 'usta';
export interface CardDef { id: string; biome: BiomeId; slot: CardSlot; title: string; fact: string; emoji: string }

const SLOTS: CardSlot[] = ['ilk', 'yildiz', 'ozel', 'sandik', 'usta'];
type Raw = [emoji: string, title: string, fact: string];
const RAW: Record<BiomeId, Raw[]> = {
  'dis-kulak': [
    ['👂', 'Kıvrımlı Pusula', 'Kulak kepçesi kıkırdaktan yapılır. Kıvrımları, sesin yukarıdan mı aşağıdan mı geldiğini anlamamıza yardım eder.'],
    ['📢', 'Doğal Megafon', 'Kulak kepçesi ve kulak kanalı birlikte yaklaşık 2-4 kHz arasındaki sesleri belirgin biçimde güçlendirir; konuşmanın önemli bir kısmı bu aralıktadır.'],
    ['↔️', 'Milisaniye Yarışı', 'Yandan gelen bir ses bir kulağa diğerinden en fazla yaklaşık 0,6-0,7 milisaniye önce ulaşır. Beyin bu küçük farkı yön bulmakta kullanır.'],
    ['🧓', 'Büyüyen Kulak', 'Kulak kepçesi yetişkinlikte de çok yavaş büyümeye devam eder; yaşlandıkça kulaklar biraz uzar.'],
    ['🙃', 'Unutulmuş Kaslar', 'Kulak kepçesinin çevresinde, hayvanlardaki kulak oynatma kaslarının kalıntıları vardır. Bazı insanlar kulaklarını hâlâ kıpırdatabilir.'],
  ],
  'kanal': [
    ['📏', '2,5 Santimlik Tünel', 'Yetişkinde dış kulak yolu yaklaşık 2,5 cm uzunluğundadır ve hafif S biçiminde kıvrılır.'],
    ['🛡️', 'Kulak Kiri Kahramandır', 'Kulak kiri (serumen) kanalı nemli tutar, toza ve mikroplara karşı korur. Kirli değil, işe yarar!'],
    ['🚫', 'Çubuk Yok!', 'Pamuklu çubuk kiri çoğu zaman daha derine iter. Kulağın dışını silmek genellikle yeterlidir; tıkanma varsa hekime görün.'],
    ['🚶', 'Yürüyen Bant', 'Kanal derisi içten dışa doğru çok yavaş kayar ve kiri kendiliğinden dışarı taşır: kulak kendi kendini temizler.'],
    ['🦴', 'Yarı Kıkırdak Yarı Kemik', 'Kanalın dış üçte biri kıkırdak, iç kısmı kemiktir. Kir bezleri yalnızca dıştaki kıkırdak bölümde bulunur.'],
  ],
  'zar': [
    ['🥁', 'İncecik Davul', 'Kulak zarı yaklaşık 0,1 mm kalınlığında ve 8-10 mm çapındadır; bir kâğıt yaprağından bile incedir.'],
    ['⚛️', 'Atomdan Küçük Titreşim', 'Duyabildiğimiz en hafif seslerde kulak zarı, bir atomun çapından bile küçük bir mesafe kadar titreşir.'],
    ['🩹', 'Kendini Onaran Zar', 'Küçük kulak zarı yırtıkları çoğu zaman birkaç hafta içinde kendiliğinden iyileşir.'],
    ['✈️', 'Uçak Kulağı', 'Östaki borusu orta kulağı boğaza bağlar. Yutkunmak ya da esnemek basıncı eşitler; uçakta kulak tıkanması bu yüzden açılır.'],
    ['🎈', 'Havalı Oda', 'Zarın arkasındaki orta kulak normalde hava doludur. Orta kulak iltihabında burada sıvı birikebilir ve sesler boğuklaşır.'],
  ],
  'kemikcikler': [
    ['🔨', 'Üçlü Makine', 'Çekiç, örs ve üzengi vücudun en küçük üç kemiğidir ve sesi zardan iç kulağa taşıyan bir kaldıraç zinciri kurar.'],
    ['🔬', 'En Küçük Kemik', 'Üzengi yaklaşık 3 mm boyuyla vücuttaki en küçük kemiktir.'],
    ['📈', 'Basınç Yükseltici', 'Zarın geniş, oval pencerenin küçük olması ve kemikçik kaldıracı sayesinde orta kulak, sesin basıncını sıvıya aktarırken yaklaşık 20 kat artırır.'],
    ['💪', 'Minik Koruyucu Kas', 'Üzengiye bağlı stapedius, vücudun en küçük iskelet kasıdır. Çok yüksek seslerde kasılarak kemikçiklerin hareketini biraz azaltır (akustik refleks).'],
    ['👶', 'Doğuştan Büyük', 'Kulak kemikçikleri doğduğumuzda neredeyse yetişkin boyutundadır.'],
  ],
  'koklea-1': [
    ['🐌', 'Salyangoz Kabuğu', 'Koklea, salyangoz kabuğuna benzer ve yaklaşık iki buçuk tur kıvrılır. Adı da Latincede "salyangoz" demektir.'],
    ['🌊', 'Sıvı Dalgası', 'Kokleanın içi sıvı doludur. Üzengi oval pencereyi ittiğinde bu sıvıda bir dalga yayılır.'],
    ['🎻', 'İnce Seslerin Kapısı', 'Baziler zar tabanda dar ve serttir; bu yüzden en ince (yüksek frekanslı) sesler kokleanın tabanında algılanır.'],
    ['🔊', 'Önce İnce Sesler', 'Gürültü ve yaş, ilk olarak tabandaki yüksek frekans hücrelerini etkiler; işitme kaybı bu yüzden çoğunlukla ince seslerden başlar.'],
    ['🫛', 'Bezelye Boyunda', 'Koklea bir bezelye tanesi kadardır; ama içindeki kanal açılsa yaklaşık 3,5 cm uzunluğunda olurdu.'],
  ],
  'koklea-2': [
    ['🧮', 'Binlerce Tüy Hücresi', 'Bir kulakta yaklaşık 3.500 iç tüy hücresi ve 12.000 dış tüy hücresi bulunur.'],
    ['🕺', 'Dans Eden Hücreler', 'Dış tüy hücreleri sesle birlikte boyca uzayıp kısalır ve titreşimi güçlendirir: kokleanın kendi yükselticisi.'],
    ['📡', 'Kulağın Yankısı', 'Sağlıklı bir kulak kendi çok hafif seslerini üretir (otoakustik emisyon). Yenidoğan işitme taraması çoğu zaman bunu ölçer.'],
    ['🎚️', '20 ile 20.000', 'Genç ve sağlıklı insan kulağı yaklaşık 20 Hz ile 20.000 Hz arasındaki sesleri duyar.'],
    ['🗣️', 'Konuşmanın Evi', 'Konuşma seslerinin çoğu yaklaşık 250-4.000 Hz arasındadır. "s", "ş", "f" gibi sessiz harfler ince seslerdir.'],
  ],
  'koklea-3': [
    ['🎺', 'Bas Diyarı', 'Kokleanın tepesinde (apeks) baziler zar daha geniş ve esnektir; kalın (düşük frekanslı) sesler burada en çok titreşim yaratır.'],
    ['🎹', 'Tonotopi', 'Her frekansın koklea\'da kendi adresi vardır; tıpkı piyano tuşları gibi. Buna tonotopi denir.'],
    ['🌱', 'Geri Gelmeyen Hücreler', 'İnsanda hasar gören tüy hücreleri yeniden çoğalmaz. Bu yüzden yüksek sesten korunmak çok değerlidir.'],
    ['🌾', 'Stereosilya', 'Tüy hücrelerinin üstünde stereosilya denen minik tüy demetleri vardır. Titreşimle eğildiklerinde sinir sinyali başlar.'],
    ['⚡', 'Koklear İmplant', 'Koklear implant, sesi elektrik sinyaline çevirerek işitme sinirini doğrudan uyarır; ağır işitme kaybında işitmeyi sağlayabilir.'],
  ],
  'sinir': [
    ['🧵', '30.000 Lif', 'İşitme siniri yaklaşık 30.000 sinir lifinden oluşur.'],
    ['🗺️', 'Adres Korunur', 'Her sinir lifi koklea\'daki yerine göre belli bir frekansa "ayarlıdır"; frekans haritası beyne kadar korunur.'],
    ['📶', 'Şiddetin Kodu', 'Sesin şiddeti, liflerin ne kadar sık sinyal gönderdiği ve kaç lifin birlikte çalıştığıyla kodlanır.'],
    ['🏎️', 'Hızlı Kulak', 'Bir sese tepki süremiz genellikle görsel bir uyarana olan tepki süremizden daha kısadır.'],
    ['🔗', 'Sekizinci Sinir', 'İşitme siniri, denge siniriyle birlikte sekizinci kafa sinirini (vestibülokoklear sinir) oluşturur.'],
  ],
  'beyin-sapi': [
    ['⏱️', 'Mikrosaniye Hakemi', 'Beyin sapı, sesin iki kulağa varış zamanı arasındaki çok küçük farkları karşılaştırarak sesin yönünü bulur.'],
    ['🌗', 'Kafanın Gölgesi', 'Kalın seslerde yön için zaman farkı, ince seslerde ise kafanın yarattığı "ses gölgesi" yüzünden oluşan şiddet farkı daha çok kullanılır.'],
    ['😲', 'İrkilme Refleksi', 'Ani ve yüksek bir seste, beyin sapındaki kısa yollar sayesinde saniyenin çok küçük bir kısmında irkiliriz.'],
    ['😴', 'Uyurken Test', 'ABR testi, sese karşı işitme siniri ve beyin sapının elektriksel yanıtını ölçer; bebeklerde uyurken bile yapılabilir.'],
    ['👥', 'İki Kulak Bir Takım', 'İki kulakla duymak, gürültülü ortamda konuşmayı anlamayı kolaylaştırır.'],
  ],
  'korteks': [
    ['🧠', 'Şakaktaki Merkez', 'İşitme korteksi, beynin şakak lobunda, kulaklarımıza yakın bir yerde bulunur.'],
    ['🗺️', 'Beyindeki Piyano', 'İşitme korteksinin de frekans haritası vardır: farklı frekanslar farklı bölgeleri uyarır.'],
    ['🍹', 'Kokteyl Parti Etkisi', 'Beyin, kalabalık bir odada tek bir konuşmaya odaklanabilir. Buna "kokteyl parti etkisi" denir.'],
    ['🎼', 'Müzikli Beyin', 'Müzik eğitimi, beynin sesleri ayırt etme becerisini geliştirebilir.'],
    ['🌙', 'Uyurken Dinleyen Beyin', 'Uyurken de kulaklar çalışır; beyin, adımız gibi tanıdık sesleri diğerlerinden ayırt edebilir.'],
  ],
};

export const CARDS: CardDef[] = (Object.keys(RAW) as BiomeId[]).flatMap((biome) => RAW[biome].map(([emoji, title, fact], i) => ({ id: `${biome}:${SLOTS[i]!}`, biome, slot: SLOTS[i]!, title, fact, emoji })));
export const cardById = (id: string) => CARDS.find((c) => c.id === id);

export function cardSlotText(slot: CardSlot, biomeHasSecret: boolean): string {
  switch (slot) {
    case 'ilk': return 'Biyomda ilk bölümü bitir';
    case 'yildiz': return 'Biyomda bir bölümde 3 yıldız al';
    case 'ozel': return biomeHasSecret ? 'Biyomda gizli altın kokleayı bul' : 'Biyomda bir bölümü hasarsız bitir';
    case 'sandik': return 'Günlük sandıktan çıkar';
    case 'usta': return 'Biyomdaki tüm bölümleri bitir';
  }
}
