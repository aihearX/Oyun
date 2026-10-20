import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { BUILDINGS, buildCost, type BuildingId } from '@odi/shared';
import { useStore } from '../store';
import { useCoach, type CoachStep, type Tour } from './Coach';
import { FEATURES, clearedCount, featureById, type FeatureId } from './features';
import { Art } from '../ui/art';

/**
 * Yönetmen: hangi anlatıcı turunun ne zaman başlayacağına karar verir (rota + ilerleme + kayıtlı turlar).
 * Ekran sakinken (takma ad penceresi, kutlama, alt sayfa yokken) tek seferde tek tur; her tur bir kez.
 */
const tab = (t: string) => `nav.tabbar .tab[data-tab="${t}"]`;
const tapTab = (t: string, name: string): CoachStep => ({ say: `Aşağıdaki ${name} düğmesine dokun.`, target: tab(t), wait: 'tap', hint: `${name}'e dokun` });
const unlockCard = (id: FeatureId, say: string): CoachStep => ({ say, art: featureById(id).art, kicker: 'Yeni yer açıldı!', mood: 'wow' });
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
        { say: 'Bravo! İlk bölümü geçtin. Ninni bir adım daha yol aldı.', target: '.star-row', mood: 'wow' },
        { say: 'Yıldızlar bölümü ne kadar iyi geçtiğini gösterir: notaların çoğunu topla, hızlı ol, hiç düşme. Üç yıldız en iyisi!', target: '.star-row' },
        { say: 'Topladığın notalar jetona dönüşür. Jetonla yetenek alır, kampını büyütürsün.', target: '.stats' },
        { say: 'Şimdi yolculuğun haritasına bakalım. Harita düğmesine dokun.', target: '.result-actions [data-act="harita"]', wait: 'tap', hint: 'Harita’ya dokun' },
      ); break;
    case 'map':
      steps.push(
        { say: 'İşte yolun: kulak kepçesinden beyne uzanır. Her bölüm seni biraz daha ileri götürür.' },
        { say: 'Üstte seviyen, yıldızların ve jetonların var.', target: '.map-hud' },
        { say: 'Aşağıdaki yerler kilitli. Bölüm geçtikçe tek tek açılır; her yenisini sana ben göstereceğim.', target: 'nav.tabbar' },
        { say: 'Sıradaki bölüm burada. Dokun ve devam et!', target: '.map-play', wait: 'tap', hint: 'Bölüme dokun', mood: 'wink' },
      ); break;
    case 'today':
      steps.push(
        unlockCard('today', 'Yeni bir yer açıldı: Bugün! Her gün uğra; takvim ödülü, üç görev ve günlük sandık seni bekler.'),
        ...(route === 'today' ? [] : [tapTab('today', 'Bugün')]),
        { say: 'Bugünün takvim ödülü hazır. Al’a dokun ve topla!', target: '.cal-today .btn:not(:disabled)', wait: 'tap', hint: 'Al’a dokun', optional: true },
        { say: 'İşte ödülün! Topla’ya dokun, jetonlar cebine girsin.', target: () => document.querySelector('.cel-cta .btn') ?? document.querySelector('.cel-stage .cel-cta'), wait: { until: gone('.cel-stage') }, hint: 'Topla’ya dokun', optional: true, mood: 'wow' },
        { say: 'Bunlar günlük görevler. Oynadıkça dolar; bitince ödülünü buradan alırsın. Üçü de bitince sandık açılır.', target: '.quests' },
      ); break;
    case 'camp':
      steps.push(
        unlockCard('camp', 'Yeni bir yer açıldı: Kulak Kampı! Burada binalar kurarsın; sen oyundayken bile çalışırlar.'),
        ...(route === 'camp' ? [] : [tapTab('camp', 'Kamp')]),
      ); break;
    case 'camp-build': {
      const b = campPick(); if (!b) return null;
      const d = BUILDINGS.find((x) => x.id === b)!;
      steps.push(
        { say: 'Burası senin kampın. Binalar jeton üretir, kalkan şansı verir, takımına güç katar.' },
        { say: `İlk işimiz: ${d.name}. Binaya dokun.`, target: () => buildingRect(b), wait: { el: '.bp' }, hint: 'Binaya dokun', enter: () => kamp()?.focus?.(b) },
        { say: 'Bu panelde binanın şimdi ne yaptığı ve bir sonraki seviyede ne olacağı yazar.', target: '.bp-eff' },
        { say: 'Bedeli ve süresi burada. Şimdi düğmeye dokun ve inşaatı başlat!', target: '.bp-up .btn', wait: { el: '.bp-build' }, hint: 'Düğmeye dokun' },
        { say: 'Harika, inşaat başladı! Süre dolunca hazır olur. Takımın olunca arkadaşların tek dokunuşla hızlandırır.', target: '.bp-build', mood: 'wink' },
      ); break;
    }
    case 'friends':
      steps.push(
        unlockCard('friends', 'Yeni: Arkadaşlar ve mesajlar! Arkadaşını kodla ekle, mesajlaş, her gün hediye gönder.'),
        ...(route === 'profile' ? [] : [tapTab('profile', 'Profil')]),
        { say: 'Arkadaşlar burada. Arkadaş kodunu paylaş; birlikte daha hızlı ilerlersiniz.', target: '.menu-tile[data-tile="friends"]' },
      ); break;
    case 'team':
      steps.push(
        unlockCard('team', 'Yeni: Takım! Takımda birbirinize yardım edersiniz: inşaatlar hızlanır, kalkan gelir.'),
        ...(route === 'team' ? [] : [tapTab('team', 'Takım')]),
        { say: 'Birlikte Bölge Savaşı’nda yer kaparsınız ve Gürültü Canavarı’na hep beraber vurursunuz.', target: '.team-hero .perks, .team-head' },
        { say: 'Bir takıma kodla katılabilir ya da kendi takımını kurabilirsin. Karar senin!', target: '.code-join, .team-head' },
      ); break;
    case 'shop':
      steps.push(
        unlockCard('shop', 'Yeni: Mağaza, Dolap ve Ödül kutusu! Odi’ye şapka ve renk seç, ödüllerini topla.'),
        ...(route === 'profile' ? [] : [tapTab('profile', 'Profil')]),
        { say: 'Dolap burada: Odi’yi istediğin gibi giydir. Kazandığın kozmetikler hep buraya gelir.', target: '.menu-tile[data-tile="wardrobe"]' },
      ); break;
    case 'events':
      steps.push(
        unlockCard('events', 'Yeni: Etkinlikler! Ralli, düello, bayrak yarışı ve quiz: takımca oynanır, ödülleri büyüktür.'),
        ...(route === 'map' ? [] : [tapTab('map', 'Harita')]),
        { say: 'Etkinlik çadırı haritanın sağında. Dokun ve bir bak!', target: '[data-testid="ev-fab"]', wait: 'tap', hint: 'Çadıra dokun' },
      ); break;
    case 'race':
      steps.push(unlockCard('race', 'Yeni: Canlı yarış ve meydan okuma! Arkadaşınla aynı bölümü aynı anda koş; kim önde bitirecek?'));
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
