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
  const ok = camp.buildings.filter((b) => { const d = BUILDINGS.find((x) => x.id === b.id)!; const to = b.level + 1; return to <= d.maxLevel && (b.id === 'merkez' || to <= merkez) && buildCost(b.id, to).jeton <= wallet.jeton; });
  if (!ok.length) return null;
  return (ok.find((b) => b.id === 'depo' && b.level === 0) ?? ok.sort((a, b) => buildCost(a.id, a.level + 1).jeton - buildCost(b.id, b.level + 1).jeton)[0]!).id;
}
const kamp = () => (window as unknown as { __kamp?: { pos(id: string): { x: number; y: number } | null; focus?(id: string): void } }).__kamp;
let settle = { k: '', t: 0 };
/** binanın ekrandaki kutusu; kamera kayarken null (halka yerine oturunca belirir, kayan hedefe dokunulmaz) */
function buildingRect(id: BuildingId): DOMRect | null {
  const p = kamp()?.pos(id); if (!p) return null;
  const k = `${id}:${Math.round(p.x)},${Math.round(p.y)}`; const now = performance.now();
  if (k !== settle.k) { settle = { k, t: now }; return null; }
  if (now - settle.t < 220) return null;
  return new DOMRect(p.x - 46, p.y - 58, 92, 92);
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
        { id: 'bugun-03', say: lineText('bugun-03'), target: () => document.querySelector('.cel-cta .btn') ?? document.querySelector('.cel-stage .cel-cta'), wait: { until: gone('.cel-stage') }, hint: 'Topla’ya dokun', optional: true, mood: 'wow' },
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
    default: return null;
  }
  return { id, steps };
}

const TAB_ROUTES = ['map', 'today', 'camp', 'team', 'profile'];

/** bir sonraki tur: sıra önemli (önce sonuç → harita → açılımlar) */
function nextTour(route: string): string | null {
  const s = useStore.getState(); const f = s.ftue; if (f.bypass) return null;
  const done = (id: string) => f.tours.includes(id);
  const cleared = clearedCount(s.progress);
  if (route === 'result') {
    if (cleared >= 1 && !done('result1') && exists('.result-actions') && !exists('.skip-hint')) return 'result1';
    return null;
  }
  if (!TAB_ROUTES.includes(route)) return null;
  if (cleared >= 1 && !done('map')) return route === 'map' && exists('.map-play') ? 'map' : null;
  for (const ft of FEATURES) if (ft.tour && cleared >= ft.at && !done(ft.id)) return ft.id;
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
      const id = nextTour(route); if (!id) return;
      const t = tourFor(id, route); if (t) useCoach.getState().start(t); else useStore.getState().ftueTourDone(id);
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
