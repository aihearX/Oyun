import type { BiomeId, MechanicId } from '@odi/shared';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  /** anlatı: harita kartında tek cümle */
  blurb: string;
  /** zemin, arka plan (uzak/orta/yakın), vurgu renkleri (hex) */
  palette: { ground: number; groundDark: number; bgFar: number; bgMid: number; bgNear: number; accent: number; sky: number };
  /** arka plan motifi: oyun çekirdeği buna göre paralaks çizer */
  motif: 'auricle' | 'tunnel' | 'drum' | 'bones' | 'spiral' | 'nerve' | 'stem' | 'cortex';
  defaultMechanics: MechanicId[];
  /** tonotopi: 0 taban (ince ses) → 1 apeks (kalın ses); yalnızca koklea */
  tonotopy?: [number, number];
  fact: string;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  'dis-kulak': { id: 'dis-kulak', name: 'Dış Kulak', blurb: 'Kulak kepçesinin (aurikula) kıvrımlarında ilk adımlar.', palette: { ground: 0xf2b8a2, groundDark: 0xd9937a, bgFar: 0xfff1ea, bgMid: 0xfddccd, bgNear: 0xf9c9b4, accent: 0xff7a59, sky: 0xfff7f3 }, motif: 'auricle', defaultMechanics: ['kosu'], fact: 'Kulak kepçesi sesi toplar; kanalla birlikte yaklaşık 2-4 kHz civarını doğal olarak güçlendirir.' },
  'kanal': { id: 'kanal', name: 'Kulak Kanalı', blurb: 'Dış kulak yolu: dar, sıcak, serumenli (kulak kirli) bir tünel.', palette: { ground: 0xc98a6b, groundDark: 0xa66b4f, bgFar: 0x3e2a24, bgMid: 0x5a3b31, bgNear: 0x7a5140, accent: 0xffb347, sky: 0x2b1c18 }, motif: 'tunnel', defaultMechanics: ['kosu', 'trambolin'], fact: 'Kanal yaklaşık 2,5 cm; rezonansı yaklaşık 2,5-3 kHz civarını yükseltir.' },
  'zar': { id: 'zar', name: 'Kulak Zarı', blurb: 'Titreyen zar (timpanik membran), dev bir trambolin.', palette: { ground: 0xe99aa6, groundDark: 0xc9707f, bgFar: 0xfbe9ec, bgMid: 0xf6cdd4, bgNear: 0xf0b3bd, accent: 0xff4f7a, sky: 0xfff3f5 }, motif: 'drum', defaultMechanics: ['trambolin'], fact: 'Kulak zarı yaklaşık 0,1 mm kalınlığındadır ve sesin frekansıyla titreşir.' },
  'kemikcikler': { id: 'kemikcikler', name: 'Kemikçikler', blurb: 'Çekiç (malleus), örs (inkus), üzengi (stapes): vücudun en küçük makinesi.', palette: { ground: 0xd7d2c4, groundDark: 0xb3ac9a, bgFar: 0xe9f1f8, bgMid: 0xd3e1ee, bgNear: 0xbfd0e2, accent: 0x5b8def, sky: 0xf2f7fb }, motif: 'bones', defaultMechanics: ['makine'], fact: 'Üzengi (stapes), yaklaşık 3 mm ile vücuttaki en küçük kemiktir.' },
  'koklea-1': { id: 'koklea-1', name: 'Koklea · Taban', blurb: 'İnce (yüksek frekanslı) seslerin kıvrımı; perilenfin içinde yüz.', palette: { ground: 0x7c5cff, groundDark: 0x5a3fd6, bgFar: 0xeee9ff, bgMid: 0xd9d0ff, bgNear: 0xbfb0ff, accent: 0x2ee6d6, sky: 0xf4f1ff }, motif: 'spiral', defaultMechanics: ['yuzme'], tonotopy: [0, 0.33], fact: 'Kokleanın tabanı (baz) ince, yüksek frekanslı sesleri algılar.' },
  'koklea-2': { id: 'koklea-2', name: 'Koklea · Orta Kıvrım', blurb: 'Corti organı ve tüy hücreleri: konuşma seslerinin evi.', palette: { ground: 0xa05ad8, groundDark: 0x7c3fb0, bgFar: 0xf5e9ff, bgMid: 0xe6cdfc, bgNear: 0xd3aef7, accent: 0xffc25c, sky: 0xf9f1ff }, motif: 'spiral', defaultMechanics: ['yuzme', 'kosu'], tonotopy: [0.33, 0.66], fact: 'Konuşma seslerinin önemli kısmı yaklaşık 500-4000 Hz arasındadır; bu frekanslar kokleanın orta bölümlerinde işlenir.' },
  'koklea-3': { id: 'koklea-3', name: 'Koklea · Apeks', blurb: 'Kalın (alçak frekanslı) seslerin tepesi; bas ve uğultu.', palette: { ground: 0xe08a3c, groundDark: 0xb86a24, bgFar: 0xfff1e3, bgMid: 0xffdcbb, bgNear: 0xffc48f, accent: 0x7c5cff, sky: 0xfff6ec }, motif: 'spiral', defaultMechanics: ['yuzme'], tonotopy: [0.66, 1], fact: 'Apeks kalın (düşük frekanslı) sesleri algılar; 125 Hz apekse yakın işlenir.' },
  'sinir': { id: 'sinir', name: 'İşitme Siniri', blurb: 'VIII. kafa siniri: sen artık bir elektrik impulsusun. Hızlan.', palette: { ground: 0x1f2a5c, groundDark: 0x14193a, bgFar: 0x0b1030, bgMid: 0x14214f, bgNear: 0x1e3270, accent: 0x4cf0ff, sky: 0x070b22 }, motif: 'nerve', defaultMechanics: ['impuls'], fact: 'İşitme siniri yaklaşık 30.000 liften oluşur.' },
  'beyin-sapi': { id: 'beyin-sapi', name: 'Beyin Sapı', blurb: 'Sağ ve sol ses superior oliver komplekste buluşur; yön doğar.', palette: { ground: 0x3a2f6b, groundDark: 0x271f4a, bgFar: 0x1a1533, bgMid: 0x2a2250, bgNear: 0x3c3170, accent: 0xff6b8b, sky: 0x120f26 }, motif: 'stem', defaultMechanics: ['impuls', 'ruya'], fact: 'Beyin sapı, iki kulaktan gelen sesin zaman farkıyla yön hesaplar.' },
  'korteks': { id: 'korteks', name: 'İşitme Korteksi', blurb: 'Heschl girusunda sesin anlama dönüştüğü rüya dünyası.', palette: { ground: 0xff8fb1, groundDark: 0xd86a8e, bgFar: 0xfff0f6, bgMid: 0xffd6e5, bgNear: 0xffb8cf, accent: 0x7c5cff, sky: 0xfff6fa }, motif: 'cortex', defaultMechanics: ['ruya'], fact: 'Birincil işitme korteksi şakak (temporal) lobundaki Heschl girusundadır.' },
};

export const BIOME_ORDER: BiomeId[] = ['dis-kulak', 'kanal', 'zar', 'kemikcikler', 'koklea-1', 'koklea-2', 'koklea-3', 'sinir', 'beyin-sapi', 'korteks'];
