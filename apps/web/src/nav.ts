import { createContext, useContext } from 'react';
import type { EventView } from './events/EventsScreen';
import type { EventFlash } from './events/EventLevel';

/** Alt ekranlara geçiş (App sağlar). Sosyal ekranlar birbirine buradan bağlanır. */
export type SocialRoute =
  | { name: 'friends' } | { name: 'shop' } | { name: 'inbox' } | { name: 'league' }
  | { name: 'chat'; room: string; title: string }
  | { name: 'race'; inviteRoomId?: string }
  /** özel mesajlar: gelen kutusu ve birebir sohbet (id = karşı oyuncu) */
  | { name: 'messages' } | { name: 'dm'; id: string }
  /** Birlikte: İkili Görev, Usta–Çırak, sohbet ayarları (comm/Together.tsx) */
  | { name: 'birlikte' }
  /** Sıralama: oyuncu ve takım tabloları (rank/RankScreen.tsx) */
  | { name: 'siralama' }
  /** Profil › Kurucular: kapalı betanın Kurucu Yolcuları (kurucu/Kurucular.tsx, YN-041) */
  | { name: 'kurucular' }
  /** tek kişilik, ödülsüz bilgi pratiği (canlı yarışmanın soru havuzu; takımsız ve çevrimdışı da; events/Pratik.tsx, YN-078) */
  | { name: 'pratik' }
  /** arkadaşın ya da takım arkadaşının kampı (salt okunur, hazır tepki; camp/Ziyaret.tsx) */
  | { name: 'kamp'; id: string }
  /**
   * etkinlik merkezi ya da tek bir etkinlik (flash: etkinlik koşusunun kısa sonucu; rallyId: davet/sohbet kartının kendi rallisi, YN-116;
   * fromHub: tek etkinliğe Etkinlikler merkezinden gelindi, Geri merkeze döner — bkz. eventBackTo)
   */
  | { name: 'events'; view?: EventView; flash?: EventFlash; rallyId?: string; fromHub?: boolean };

/**
 * Etkinlik ekranında Geri (YN-107, OT-ogrenci-birinci-21, OT-buyuk-yazi-59): tek etkinliğe merkezden gelindiyse merkeze; doğrudan
 * açıldıysa (Takım › Etkinlikler, Bugün, duyuru, davet kartı) geldiği yere. Eskiden hep merkeze dönüyordu: Takım › Etkinlikler'den
 * açılan Bayrak Yarışı'ndan çıkmak için iki kez Geri gerekiyordu. Etkinlik koşusundan dönüşte de aynı kalır (fromHub rotada taşınır).
 */
export const eventBackTo = (view: EventView, fromHub: boolean): 'merkez' | 'geldigi-yer' => (view !== 'merkez' && fromHub ? 'merkez' : 'geldigi-yer');

type TabName = 'map' | 'today' | 'camp' | 'team' | 'profile';
const TAB_NAMES: readonly string[] = ['map', 'today', 'camp', 'team', 'profile'];
/**
 * Ekran sınırı kartında ("İnternet yok", "Bir şeyler ters gitti"; ui/HataSiniri.tsx) Geri nereye (YN-205, OT-eski-telefon-35):
 * 'gecmis': alt ekran, ekranın kendi Geri'si (geri yığını: geldiği ekran, yığın boşsa geldiği sekme); sekme adı: o sekmeye
 * (Profil/Bugün kök alt ekranı, etkinlik koşusu, yarış sonucu: geldiği sekme; sekme ekranı, bölüm, tanıtım, sonuç: Harita);
 * null: Geri yok (başlık, hikâye, bekleme; Harita'nın kendisi: sekme çubuğu zaten yerinde). Telefonun geri tuşu ve Escape aynı işi
 * yapar (ScreenHead). Bağlantı gelince kart kendiliğinden ekranı açar (YN-047), Geri yalnız beklemek istemeyene çıkış.
 */
export function errorBackTo(r: { name: string; back?: string }, subs: readonly string[]): 'gecmis' | TabName | null {
  if (r.name === 'title' || r.name === 'wait' || r.name === 'story' || r.name === 'map') return null;
  if (TAB_NAMES.includes(r.name)) return 'map';
  const back = r.back && TAB_NAMES.includes(r.back) ? r.back as TabName : null;
  if (!back) return 'map';
  if (subs.includes(r.name) || r.name === 'raceResult' || r.name === 'eventLevel') return back;
  return 'gecmis';
}

/**
 * Alt ekranların adı (ScreenHead başlığıyla aynı): parça yüklenirken başlık ve Geri hemen çizilir, ekran "donmuş" görünmez
 * (YN-072; App.tsx ScreenLoading). Adı değişken ekranlar (sohbet: oda adı; dm, kamp ziyareti) burada yok. Eşleşme nav.test.ts'te.
 */
export const SCREEN_TITLE: Record<string, string> = {
  skills: 'Yetenekler', settings: 'Ayarlar', achievements: 'Başarımlar', album: 'Kulak Kartları', glossary: 'Kulak Sözlüğü',
  wardrobe: 'Dolap', info: 'Ödüller nasıl çalışır?', friends: 'Arkadaşlar', messages: 'Mesajlar', shop: 'Mağaza', inbox: 'Ödül kutusu',
  league: 'Haftalık lig', birlikte: 'Birlikte', siralama: 'Sıralama', kurucular: 'Kurucular', race: 'Canlı yarış', pratik: 'Bilgi pratiği',
};

/** Etkinlikler ekranının yükleme başlığı (görünüme göre): merkez "Etkinlikler", tek etkinlikte adı (events/common.tsx EVENT_META,
 *  eşleşme nav.test.ts'te). Parça yüklenirken başlık ve Geri ilk karede (OT-ogrenci-birinci-15). */
export const EVENT_TITLE: Record<EventView, string> = {
  merkez: 'Etkinlikler', ralli: 'Ralli', duello: 'Takım Düellosu', bayrak: 'Bayrak Yarışı', avi: 'Ses Avı', quiz: 'Kulak Bilgi Yarışması',
  gorev: 'Günlük Takım Görevleri', meydan: 'Günün Meydan Okuması', turnuva: 'Haftalık Turnuva',
};

export interface Nav {
  open: (r: SocialRoute) => void;
  /** bölüm oyna (haritadaki akışla aynı) */
  play: (level: number) => void;
  tab: (t: 'map' | 'today' | 'camp' | 'team' | 'profile') => void;
}
export const NavContext = createContext<Nav>({ open: () => undefined, play: () => undefined, tab: () => undefined });
export const useNav = () => useContext(NavContext);
