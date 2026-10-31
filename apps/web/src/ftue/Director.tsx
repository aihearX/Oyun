import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { BUILDINGS, buildCost, type BuildingId } from '@odi/shared';
import { useStore } from '../store';
import { useCoach, type CoachStep, type Tour } from './Coach';
import { lineText } from './script';

const line = (id: string) => ({ id, say: lineText(id) });
import { FEATURES, clearedCount, featureById, type FeatureId } from './features';
import { Art } from '../ui/art';

/**
 * Yönetmen: hangi anlatıcı turunun ne zaman başlayacağına karar verir (rota + ilerleme + kayıtlı turlar).
 * Ekran sakinken (takma ad penceresi, kutlama, alt sayfa yokken) tek seferde tek tur; her tur bir kez.
 */
const tab = (t: string) => `nav.tabbar .tab[data-tab="${t}"]`;
/** alt sekmeye dokun: satır kimliği sekme-<ad>; ipucu Türkçe ek uyumuyla (Kamp'a, Profil'e) */
const TAB_LINE: Record<string, [string, string]> = { today: ['sekme-bugun', 'Bugün’e dokun'], camp: ['sekme-kamp', 'Kamp’a dokun'], profile: ['sekme-profil', 'Profil’e dokun'], team: ['sekme-takim', 'Takım’a dokun'], map: ['sekme-harita', 'Harita’ya dokun'] };
const tapTab = (t: string): CoachStep => { const [id, hint] = TAB_LINE[t]!; return { id, say: lineText(id), target: tab(t), wait: 'tap', hint }; };
const unlockCard = (id: FeatureId, line: string): CoachStep => ({ id: line, say: lineText(line), art: featureById(id).art, kicker: 'Yeni yer açıldı!', mood: 'wow' });
const exists = (sel: string) => !!document.querySelector(sel);
/** takvim/sandık kutlamasının Topla düğmesi (sandık açılınca belirir) */
const TOPLA = '.chest-stage .cel-cta .btn';
/** öğe önce belirip sonra kaybolunca true (henüz belirmediyse beklemeye devam) */
const gone = (sel: string) => { let seen = false; return () => { if (exists(sel)) seen = true; return seen && !exists(sel); }; };

function quiet(allowSheets = false): boolean {
  if (exists('.onboard') || exists('.cel-stage') || exists('.story') || exists('.biome-intro')) return false;
  if (!allowSheets && (exists('.sheet-wrap') || exists('.bp-wrap') || exists('.overlay'))) return false;
  return true;
}

/** kamp öğreticisi için kurulacak bina: önce Kulak Deposu (kurulmadıysa), değilse jetonun yettiği en ucuz yükseltme */
function campPick(): BuildingId | null {
  const { camp, wallet } = useNet.getState(); if (!camp || !wallet) return null;
  if (camp.buildings.some((b) => b.upgradingTo)) return null;
  const merkez = camp.buildings.find((b) => b.id === 'merkez')?.level ?? 1;
  const ok = camp.buildings.filter((b) => { const d = BUILDINGS.find((x) => x.id === b.id)!; const to = b.level + 1; return to <= d.maxLevel && (!d.campLevel || (camp.xp?.level ?? 1) >= d.campLevel) && (b.id === 'merkez' || to <= merkez) && buildCost(b.id, to).jeton <= wallet.jeton; });
  if (!ok.length) return null;
  return (ok.find((b) => b.id === 'depo' && b.level === 0) ?? ok.sort((a, b) => buildCost(a.id, a.level + 1).jeton - buildCost(b.id, b.level + 1).jeton)[0]!).id;
}
type Box = { x: number; y: number; w: number; h: number };
const kamp = () => (window as unknown as { __kamp?: { pos(id: string): { x: number; y: number } | null; box?(id: string): Box | null; focus?(id: string): void } }).__kamp;
let settle = { k: '', t: 0 };
/** binanın dokunma çerçevesi (sahnenin tapBox'ı: içine dokunuş binaya gider); kamera kayarken null (halka yerine oturunca belirir, kayan hedefe dokunulmaz) */
function buildingRect(id: BuildingId): DOMRect | null {
  const k0 = kamp(); const p = k0?.pos(id); if (!p) return null;
  const k = `${id}:${Math.round(p.x)},${Math.round(p.y)}`; const now = performance.now();
  if (k !== settle.k) { settle = { k, t: now }; return null; }
  if (now - settle.t < 220) return null;
  const b = k0?.box?.(id) ?? { x: p.x - 46, y: p.y - 58, w: 92, h: 92 };
  return new DOMRect(b.x, b.y, b.w, b.h);
}
const buildingVisible = (id: BuildingId) => !!kamp()?.pos(id);

export function tourFor(id: string, route: string): Tour | null {
  const steps: CoachStep[] = [];
  switch (id) {
    case 'result1':
      steps.push(
        { id: 'sonuc-01', say: lineText('sonuc-01'), target: '.star-row', mood: 'wow' },
        { id: 'sonuc-02', say: lineText('sonuc-02'), target: '.star-row' },
        { id: 'sonuc-03', say: lineText('sonuc-03'), target: '.stats' },
        { id: 'sonuc-04', say: lineText('sonuc-04'), target: '.result-actions [data-act="harita"]', wait: 'tap', hint: 'Harita’ya dokun' },
      ); break;
    case 'map':
      steps.push(
        { id: 'harita-01', say: lineText('harita-01') },
        { id: 'harita-02', say: lineText('harita-02'), target: '.map-hud' },
        { id: 'harita-03', say: lineText('harita-03'), target: 'nav.tabbar' },
        { id: 'harita-04', say: lineText('harita-04'), target: '.map-play', wait: 'tap', hint: 'Bölüme dokun', mood: 'wink' },
      ); break;
    case 'today':
      steps.push(
        unlockCard('today', 'bugun-01'),
        ...(route === 'today' ? [] : [tapTab('today')]),
        { id: 'bugun-02', say: lineText('bugun-02'), target: '.cal-today .btn:not(:disabled)', wait: 'tap', hint: 'Al’a dokun', optional: true },
        // sandık kapalıyken yalnız sandık gösterilir ("Sandığa dokun"); Tüy Dede "Topla’ya dokun"u Topla düğmesi belirince söyler,
        // toplanınca (düğme kaybolunca) hemen ilerler
        { id: 'bugun-03', say: lineText('bugun-03'), target: TOPLA, before: { target: '.chest-stage .cel-chest', hint: 'Sandığa dokun' }, wait: { until: gone(TOPLA) }, hint: 'Topla’ya dokun', optional: { el: '.chest-stage' }, mood: 'wow' },
        { id: 'bugun-04', say: lineText('bugun-04'), target: '.quests' },
      ); break;
    case 'camp':
      steps.push(
        unlockCard('camp', 'kamp-01'),
        ...(route === 'camp' ? [] : [tapTab('camp')]),
      ); break;
    case 'camp-build': {
      const b = campPick(); if (!b) return null;
      steps.push(
        { id: 'kamp-insa-01', say: lineText('kamp-insa-01') },
        { ...line(b === 'depo' ? 'kamp-insa-02-depo' : 'kamp-insa-02'), target: () => buildingRect(b), wait: { el: '.bp' }, hint: 'Binaya dokun', enter: () => kamp()?.focus?.(b) },
        { id: 'kamp-insa-03', say: lineText('kamp-insa-03'), target: '.bp-eff' },
        { id: 'kamp-insa-04', say: lineText('kamp-insa-04'), target: '.bp-up .btn', wait: { el: '.bp-build' }, hint: 'Düğmeye dokun' },
        { id: 'kamp-insa-05', say: lineText('kamp-insa-05'), target: '.bp-build', mood: 'wink' },
      ); break;
    }
    case 'friends':
      steps.push(
        unlockCard('friends', 'arkadas-01'),
        ...(route === 'profile' ? [] : [tapTab('profile')]),
        { id: 'arkadas-02', say: lineText('arkadas-02'), target: '.menu-tile[data-tile="friends"]' },
      ); break;
    case 'glossary':
      steps.push(
        unlockCard('glossary', 'sozluk-01'),
        ...(route === 'profile' ? [] : [tapTab('profile')]),
        { ...line('sozluk-02'), target: '.menu-tile[data-tile="glossary"]', wait: { el: '[data-testid="sozluk"]' }, hint: 'Sözlüğe dokun' },
        { ...line('sozluk-03'), target: '.gl-term' },
      ); break;
    case 'team':
      steps.push(
        unlockCard('team', 'takim-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        { id: 'takim-02', say: lineText('takim-02'), target: '.team-hero .perks, .team-head' },
        { id: 'takim-03', say: lineText('takim-03'), target: '.code-join, .team-head' },
      ); break;
    case 'shop':
      steps.push(
        unlockCard('shop', 'magaza-01'),
        ...(route === 'profile' ? [] : [tapTab('profile')]),
        { id: 'magaza-02', say: lineText('magaza-02'), target: '.menu-tile[data-tile="wardrobe"]' },
      ); break;
    case 'events':
      steps.push(
        unlockCard('events', 'etkinlik-01'),
        ...(route === 'map' ? [] : [tapTab('map')]),
        { id: 'etkinlik-02', say: lineText('etkinlik-02'), target: '[data-testid="ev-fab"]', wait: 'tap', hint: 'Çadıra dokun' },
      ); break;
    case 'race':
      steps.push(unlockCard('race', 'yaris-01'));
      break;
    // ---- iletişim (docs/13-iletisim.md)
    case 'yazi':
      steps.push(unlockCard('yazi', 'yazi-01'), { ...line('yazi-02'), art: 'shield', mood: 'wink' });
      break;
    case 'siralama':
      steps.push(
        unlockCard('siralama', 'sira-01'),
        ...(route === 'profile' ? [] : [tapTab('profile')]),
        { ...line('sira-02'), target: '.menu-tile[data-tile="ranking"]', wait: { el: '[data-testid="siralama"]' }, hint: 'Sıralama’ya dokun' },
        { ...line('sira-03'), target: () => document.querySelector('[data-testid="benim-siram"]') ?? document.querySelector('.rank-row.me'), optional: true, mood: 'wink' },
      ); break;
    case 'tlig':
      steps.push(
        unlockCard('tlig', 'tlig-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        { ...line('tlig-02'), target: () => [...document.querySelectorAll('.subtabs .subtab')].find((e) => /\bLig\b/.test(e.textContent ?? '')) ?? document.querySelector('.team-hero, .team-head'), optional: true, mood: 'wink' },
      ); break;
    case 'tyaris':
      steps.push(
        unlockCard('tyaris', 'tyaris-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        { ...line('tyaris-02'), target: () => [...document.querySelectorAll('.subtabs .subtab')].find((e) => /Takım Yarışı/.test(e.textContent ?? '')) ?? document.querySelector('.team-hero, .team-head'), optional: true },
      ); break;
    case 'akis':
      steps.push(
        unlockCard('akis', 'akis-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        { ...line('akis-02'), target: () => document.querySelector('[data-testid="akis-karti"]') ?? document.querySelector('.quick-line'), optional: true, mood: 'wink' },
      ); break;
    case 'soru':
      steps.push(
        unlockCard('soru', 'soru-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        { ...line('soru-02'), target: '[data-testid="gunun-sorusu"]', optional: true },
      ); break;
    case 'ikili':
      steps.push(
        unlockCard('ikili', 'ikili-01'),
        ...(route === 'profile' ? [] : [tapTab('profile')]),
        { ...line('ikili-02'), target: '.menu-tile[data-tile="together"]' },
      ); break;
    case 'usta':
      steps.push(unlockCard('usta', 'usta-01'));
      break;
    // ---- kamp görevleri (docs/17-kamp-gorevleri.md): kısa turlar, kampın üst göstergesindeki düğmeleri gösterir
    case 'gorev':
      steps.push(
        unlockCard('gorev', 'kg-tur-01'),
        ...(route === 'camp' ? [] : [tapTab('camp')]),
        { ...line('kg-tur-02'), target: '[data-testid="kg-btn"]', wait: { el: '[data-testid="kg-panel"]' }, hint: 'Görevler’e dokun', optional: true, mood: 'wink' },
      ); break;
    case 'kampoyun':
      steps.push(
        unlockCard('kampoyun', 'kg-oyun-01'),
        ...(route === 'camp' ? [] : [tapTab('camp')]),
        { ...line('kg-oyun-02'), target: '[data-testid="kg-btn"]', optional: true, mood: 'wink' },
      ); break;
    case 'vaka':
      steps.push(
        unlockCard('vaka', 'kg-vaka-01'),
        ...(route === 'camp' ? [] : [tapTab('camp')]),
        { ...line('kg-vaka-02'), target: () => document.querySelector('[data-testid="klinik-btn"]') ?? document.querySelector('[data-testid="kg-btn"]'), optional: true },
      ); break;
    default: return null;
  }
  return { id, steps };
}

const TAB_ROUTES = ['map', 'today', 'camp', 'team', 'profile'];
const CAMP_TOURS = new Set<string>(['gorev', 'kampoyun', 'vaka']);

/**
 * Anlatıcı yükü: bir bölüm geçişinden sonra en çok bu kadar açılım turu art arda gelir; fazlası bir sonraki bölüme kalır
 * (6. bölümde 3, kampa dönüşte 3 tur birikiyordu — docs/yonetim/is-listesi.md MK-007). Hikâye, sonuç, harita ve kamp
 * öğreticisi bu sayıya girmez. Sayaç bellektedir: uygulama yeniden açılınca sıfırlanır (bekleyen turlar kaybolmaz).
 */
export const MAX_UNLOCK_TOURS_PER_LEVEL = 2;
/** kamp turları (yalnız kampta başlar) ve diğerleri ayrı sayılır: biri ötekini aç bırakmasın */
const unlockTours = { cleared: -1, genel: 0, kamp: 0 };
const groupOf = (id: string) => (CAMP_TOURS.has(id) ? 'kamp' : 'genel');
function countUnlockTour(id: string, cleared: number): void {
  if (!FEATURES.some((f) => f.id === id && f.tour)) return;
  if (unlockTours.cleared !== cleared) { unlockTours.cleared = cleared; unlockTours.genel = 0; unlockTours.kamp = 0; }
  unlockTours[groupOf(id)]++;
}
const groupFull = (id: string, cleared: number) => unlockTours.cleared === cleared && unlockTours[groupOf(id)] >= MAX_UNLOCK_TOURS_PER_LEVEL;

/**
 * "Atla": o an sırada bekleyen bütün turlar (art arda gelecek Tüy Dede balonları) birlikte geçilir; oyuncu her birini tek tek
 * atlamaz. Kamp turları ve diğerleri ayrı dizidir. Yerler açık kalır; sonraki bölümlerde açılan yerler yine duyurulur.
 */
export function pendingTours(skipped: string, cleared: number, done: readonly string[]): string[] {
  const g = groupOf(skipped); const out: string[] = [];
  if (g === 'genel') { if (cleared >= 1) out.push('result1', 'map'); if (cleared >= featureById('camp').at) out.push('camp-build'); }
  for (const f of FEATURES) if (f.tour && cleared >= f.at && groupOf(f.id) === g) out.push(f.id);
  return out.filter((id) => id !== skipped && !done.includes(id));
}
/** oyuncunun kendi girdiği yer: tanıtımı sonradan gösterilmez (Takım'a girmiş oyuncuya bir bölüm sonra "Yeni: Takım!" gelmez) */
const VISIT_ROUTE: Partial<Record<FeatureId, string>> = { today: 'today', camp: 'camp', team: 'team' };
export function visitedTours(route: string, cleared: number, done: readonly string[], keep: readonly (string | null | undefined)[]): string[] {
  return (Object.keys(VISIT_ROUTE) as FeatureId[]).filter((id) => VISIT_ROUTE[id] === route && cleared >= featureById(id).at && !done.includes(id) && !keep.includes(id));
}

/** bir sonraki tur: sıra önemli (önce sonuç → harita → açılımlar) */
function nextTour(route: string): string | null {
  const s = useStore.getState(); const f = s.ftue; if (f.bypass || f.admin) return null;
  const done = (id: string) => f.tours.includes(id);
  const cleared = clearedCount(s.progress);
  if (route === 'result') {
    if (cleared >= 1 && !done('result1') && exists('.result-actions') && !exists('.skip-hint')) return 'result1';
    return null;
  }
  if (!TAB_ROUTES.includes(route)) return null;
  if (cleared >= 1 && !done('map')) return route === 'map' && exists('.map-play') ? 'map' : null;
  // kamp görevleri turları yalnız kamptayken başlar (oyuncu kampa döndüğünde; başka bir akışı bölmez)
  for (const ft of FEATURES) if (ft.tour && !groupFull(ft.id, cleared) && cleared >= ft.at && !done(ft.id) && (!CAMP_TOURS.has(ft.id) || (route === 'camp' && exists('.camp-base, .camp-list-screen')))) return ft.id;
  if (route === 'camp' && done('camp') && !done('camp-build') && exists('.camp-base') && campPick() && buildingVisible(campPick()!)) return 'camp-build';
  return null;
}

export function FtueDirector({ route }: { route: string }) {
  const active = useCoach((s) => s.tour);
  const bypass = useStore((s) => s.ftue.bypass);
  useEffect(() => {
    if (bypass || active) return;
    const h = setInterval(() => {
      if (useCoach.getState().tour || !quiet()) return;
      const st = useStore.getState(); const id = nextTour(route);
      // oyuncu bir yere kendi girdiyse (turu henüz sırada beklerken) o yerin tanıtımı görülmüş sayılır; şimdi başlayacak tur hariç
      if (!st.ftue.bypass && !st.ftue.admin) for (const v of visitedTours(route, clearedCount(st.progress), st.ftue.tours, [id])) st.ftueTourDone(v);
      if (!id) return;
      const t = tourFor(id, route);
      if (t) {
        countUnlockTour(id, clearedCount(st.progress));
        useCoach.getState().start({ ...t, onDone: (skipped) => { if (!skipped) return; const s = useStore.getState(); for (const p of pendingTours(id, clearedCount(s.progress), s.ftue.tours)) s.ftueTourDone(p); } });
      } else st.ftueTourDone(id);
    }, 500);
    return () => clearInterval(h);
  }, [route, active, bypass]);
  // rota değişince eski rotaya ait bekleyen adımlar kendi hedeflerini bekler; tur iptal edilmez
  return null;
}

/** kilitli sekme/karo dokunuşu: kısa dürüst not */
export function useLockToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const h = setTimeout(() => setMsg(null), 1800); return () => clearTimeout(h); }, [msg]);
  return { show: setMsg, node: msg ? <div className="lock-toast" role="status"><Art name="lock" size={18} /> {msg}</div> : null };
}
