/** Yol arkadaşları: pasif yetenekli küçük ses parçacıkları. Faz 1: 6 tane. */
export interface Companion { id: string; name: string; emoji: string; desc: string; effect: 'coin+10' | 'time+5' | 'secretHint' | 'damage-1' | 'bubble+' | 'score+5'; unlock: string }
export const COMPANIONS: Companion[] = [
  { id: 'fisilti', name: 'Fısıltı', emoji: '🌬️', desc: 'Jetonlar %10 fazla sayılır.', effect: 'coin+10', unlock: 'Bölüm 3' },
  { id: 'cinlama', name: 'Çınlama', emoji: '🔔', desc: 'Süre hedefine +5 saniye.', effect: 'time+5', unlock: 'Bölüm 8' },
  { id: 'bas', name: 'Bas', emoji: '🥁', desc: 'İlk hasar yok sayılır.', effect: 'damage-1', unlock: 'Bölüm 14' },
  { id: 'tiz', name: 'Tiz', emoji: '✨', desc: 'Altın kokleanın yerini fısıldar.', effect: 'secretHint', unlock: 'Bölüm 19' },
  { id: 'kabarcik', name: 'Kabarcık', emoji: '🫧', desc: 'Su altında nefes daha yavaş biter.', effect: 'bubble+', unlock: 'Bölüm 25' },
  { id: 'yanki', name: 'Yankı', emoji: '📣', desc: 'Skor %5 artar. Yalnızca arkadaş davetiyle.', effect: 'score+5', unlock: 'Davet' },
];
