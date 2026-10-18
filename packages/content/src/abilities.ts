import type { AbilityId, ChunkSpec, Entity } from '@odi/shared';

/**
 * Yetenekler (docs/11 §2). Tek el, otomatik koşu; her biyom yeni bir hareket açar.
 * `level`: yeteneğin ilk kullanılabildiği bölüm (o bölümde öğretici an gösterilir).
 */
export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** öğretici an: ekrandaki kısa yönerge */
  how: string;
  /** büyük el işaretinin hareketi */
  gesture: 'dokun' | 'basili' | 'asagi' | 'ileri';
  level: number;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  zipla: { id: 'zipla', name: 'Zıpla', how: 'Dokun: zıpla · Basılı tut: daha yükseğe', gesture: 'dokun', level: 1 },
  kayma: { id: 'kayma', name: 'Kayma', how: 'Aşağı kaydır: engelin altından kay', gesture: 'asagi', level: 3 },
  duvar: { id: 'duvar', name: 'Duvar Zıplaması', how: 'Duvara değince dokun: karşıya zıpla', gesture: 'dokun', level: 6 },
  suzul: { id: 'suzul', name: 'Süzülme', how: 'Havada basılı tut: ses kanatlarıyla süzül', gesture: 'basili', level: 9 },
  trambolin: { id: 'trambolin', name: 'Zar Sıçrayışı', how: 'Zara değdiğin an dokun: güçlü sıçra', gesture: 'dokun', level: 9 },
  kanca: { id: 'kanca', name: 'Kanca', how: 'Kancanın yanında basılı tut: sallan · Bırak: fırla', gesture: 'basili', level: 13 },
  cakil: { id: 'cakil', name: 'Yere Çakılma', how: 'Havada aşağı kaydır: çatlak zemini kır, anahtara bas', gesture: 'asagi', level: 15 },
  yuz: { id: 'yuz', name: 'Yüzme', how: 'Sıvıda basılı tut: yüksel · Bırak: dal', gesture: 'basili', level: 21 },
  darbe: { id: 'darbe', name: 'Ses Darbesi', how: 'İleri kaydır: atıl · Gürültü duvarını kır', gesture: 'ileri', level: 31 },
  cevir: { id: 'cevir', name: 'Yerçekimi Çevirme', how: 'Mor bölgede dokun: yerçekimini çevir', gesture: 'dokun', level: 35 },
};

export const ABILITY_ORDER: AbilityId[] = ['zipla', 'kayma', 'duvar', 'suzul', 'trambolin', 'kanca', 'cakil', 'yuz', 'darbe', 'cevir'];

/** bölüm numarasına göre açık yetenekler (yolculuk sırayla oynandığından bölüm numarası ilerlemeyi belirler) */
export function abilitiesAt(level: number): AbilityId[] { return ABILITY_ORDER.filter((a) => ABILITIES[a].level <= level); }
/** tam bu bölümde açılan yetenekler */
export function newAbilitiesAt(level: number): AbilityId[] { return ABILITY_ORDER.filter((a) => ABILITIES[a].level === level); }

/** öğretici anın "ilk kez" anahtarı (kabuk FIRSTS ile kaydeder) */
export const tutorialKey = (a: AbilityId) => `ogret-${a}`;

/** varlıktan çıkarılan yetenek gereksinimi */
export function entityNeeds(e: Entity): AbilityId[] {
  switch (e.type) {
    case 'wall': return ['duvar'];
    case 'hook': return ['kanca'];
    case 'trampoline': return ['trambolin'];
    case 'water': case 'bubble': case 'current': return ['yuz'];
    case 'barrier': case 'echo': return ['darbe'];
    case 'gravzone': return ['cevir'];
    case 'switch': return e.props?.by === 'darbe' ? ['darbe'] : ['cakil'];
    case 'tutor': return [String(e.props?.ability ?? 'zipla') as AbilityId];
    case 'enemy': return e.props?.kind === 'kalkanli' ? ['cakil'] : [];
    default: return [];
  }
}

/** parçanın gerektirdiği yetenekler: açık `needs` + varlıklardan çıkarılanlar */
export function chunkNeeds(c: Pick<ChunkSpec, 'needs' | 'entities'>): AbilityId[] {
  const s = new Set<AbilityId>(c.needs ?? []);
  for (const e of c.entities) for (const a of entityNeeds(e)) s.add(a);
  return ABILITY_ORDER.filter((a) => s.has(a));
}
