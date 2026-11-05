import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import { BUILDINGS, buildCost, type BuildingId } from '@odi/shared';
import { useStore } from '../store';
import { useCoach, type CoachStep, type Tour } from './Coach';
import { lineText } from './script';

const line = (id: string) => ({ id, say: lineText(id) });
import { FEATURES, clearedCount, featureById, type FeatureId } from './features';
import { CAMP_TOURS, countUnlockTour, genelUnlockQueue, groupFull, groupOf, mapIntroQueue, unlockTally } from './map-intro';
import { Art } from '../ui/art';
import { useCelebrating } from '../celebrate';
import { openTeamTab } from '../screens/team/teamTabs';
import { useKg } from '../camp/gorev/state';
import { KampYeniKart, hideKampYeni, kampYeniBekleyen, kartta, showKampYeni } from './KampYeni';
import { kampBinaAc } from '../camp/istek';

/**
 * Yönetmen: hangi anlatıcı turunun ne zaman başlayacağına karar verir (rota + ilerleme + kayıtlı turlar).
 * Ekran sakinken (takma ad penceresi, kutlama, alt sayfa/pencere, haritanın dönüş sahnesi yokken ve oyuncu son ~1,2 sn ekrana
 * dokunmamışken) tek seferde tek tur; her tur bir kez.
 * Tur sürerken açılan kutlama turu duraklatır (Coach.tsx); bir anda tek etkileşimli katman (YN-067).
 */
const tab = (t: string) => `nav.tabbar .tab[data-tab="${t}"]`;
/** alt sekmeye dokun: satır kimliği sekme-<ad>; ipucu Türkçe ek uyumuyla (Kamp'a, Profil'e) */
const TAB_LINE: Record<string, [string, string]> = { today: ['sekme-bugun', 'Bugün’e dokun'], camp: ['sekme-kamp', 'Kamp’a dokun'], profile: ['sekme-profil', 'Profil’e dokun'], team: ['sekme-takim', 'Takım’a dokun'], map: ['sekme-harita', 'Harita’ya dokun'] };
/** sekme gerçekten açılınca ilerler (dokunuş yutulduysa, ör. arkada kutlama varken, adım yerinde kalır) */
const tapTab = (t: string): CoachStep => { const [id, hint] = TAB_LINE[t]!; return { id, say: lineText(id), target: tab(t), wait: { until: () => exists(`${tab(t)}[aria-current="page"]`) }, hint }; };
const unlockCard = (id: FeatureId, line: string): CoachStep => ({ id: line, say: lineText(line), art: featureById(id).art, kicker: 'Yeni yer açıldı!', mood: 'wow' });
const exists = (sel: string) => !!document.querySelector(sel);
/** oyuncunun arkadaş kodu (sunucuya bağlı değilse yok: Profil'de de yazmaz) */
const friendCodeNote = () => { const c = useNet.getState().me?.friendCode; return c ? <>Arkadaş kodun: <b className="mono">{c}</b></> : null; };
/** takvim/sandık kutlamasının Topla düğmesi (sandık açılınca belirir) */
const TOPLA = '.chest-stage .cel-cta .btn';
/** öğe önce belirip sonra kaybolunca true (henüz belirmediyse beklemeye devam) */
const gone = (sel: string) => { let seen = false; return () => { if (exists(sel)) seen = true; return seen && !exists(sel); }; };

/** açık (cevaplanabilir) Günün Sorusu kartı; cevaplanmış ya da açıklanmış soru sayılmaz */
const openQuestion = () => [...document.querySelectorAll('[data-testid="gunun-sorusu"]')].find((e) => !!e.querySelector('.dq-opt:not(:disabled)')) ?? null;

export function quiet(allowSheets = false): boolean {
  if (exists('.onboard') || exists('.cel-stage') || useCelebrating.getState().on || exists('.story') || exists('.biome-intro')) return false;
  // haritanın dönüş sahnesi (yıldızlar, hazine, bölge canlanması) bitmeden; kamp yüklenirken ve Tüy Dede'nin kamp satırı (yeni anıt) sürerken
  if (exists('.map-screen:not([data-donus="bitti"])') || exists('.camp-loading') || exists('[data-testid="kamp-dede"]:not([data-line=""])')) return false;
  // kampta yeni anıt kutlaması sırada ya da notu yeni kapandı (oyuncu kampa henüz dokunmadı): anıt notu ile tanıtım/"Kamp'ta yeni"
  // kartı tek kuyrukta, oyuncu bir şey yapmadan art arda açılmaz (OT-ilk-kez-oyun-71; CampBase `data-anit`)
  if (exists('.camp-base[data-anit]')) return false;
  // haritanın "Hedefe ulaştın!" kutusu görünürken (dönüşten sonra birkaç saniye, MapScreen GOAL_REACHED_MS): "Yeni yer açıldı" kartı
  // kutunun üstüne binmez, sesi kapalı oyuncu iki haberi de okur (OT-sessiz-oyuncu-20)
  if (exists('.map-goal[data-ulasildi]')) return false;
  // bildirim/teşekkür kartı görünürken rehber başlamaz (üst üste binmez; oyuncu kartı görür, OT-buyuk-yazi-20). Rehber sürerken
  // gelen kartlar sırada bekler (CommBanner)
  if (exists('[data-testid="iletisim-bildirimi"]')) return false;
  // zamanlı takım bildirimi (ralli saldırısı, etkinlik şeridi, canlı yarış daveti) görünürken de: tanıtım onu örtüp süresini
  // doldurmaz, oyuncu "Git ›"e dokunabilir (OT-takim-kaptani-32)
  if (exists('[data-testid="ev-bildirim"], [data-testid="yaris-davet-karti"]')) return false;
  // oyuncu bir bölümü başlatmak için dokundu, bölüm yükleniyor: tanıtım bölümden sonraya kalır (OT-uzman-odyolog-34)
  if (bolumBasliyor()) return false;
  if (!allowSheets && (exists('.sheet-wrap') || exists('.map-sheet-wrap') || exists('.bp-wrap') || exists('.overlay') || exists('[aria-modal="true"]'))) return false;
  return true;
}

/**
 * Oyuncu ekranla etkileşirken tur başlamaz (OT-buyuk-yazi-17: "Al"a dokunurken açılan tur ekranı karartıp dokunuşu yuttu).
 * Son dokunuştan (basma/bırakma, tekerlek, tuş) en az TOUCH_CALM_MS geçmeli ve parmak ekranda olmamalı; böylece basılı ya da
 * yeni bırakılmış bir dokunuş, tur katmanı açılırken yutulmaz.
 */
const TOUCH_CALM_MS = 1200;
/** bırakma olayı kaçarsa (parmak pencere dışına çıktı) basılı sayılmanın üst sınırı */
const HELD_MAX_MS = 4000;
const touch = { last: -Infinity, held: false };
/**
 * Takma ad penceresindeki dokunuşlar (ad yazma, renk, Başla/Sonra) ekrana uzanma sayılmaz: pencere ekranı kapatır, oyuncu orada
 * haritada bir yere uzanmıyor. Pencere kapanınca sonucun söz verdiği harita turu dönüşteki gibi beklemeden gelir (OT-ilk-kez-oyun-59:
 * "Başla"dan sonra tur 1,2 sn + sakin yoklamaları bekledi, oyuncunun "Bölüm 2" dokunuşuyla aynı anda açıldı).
 */
const AD_PENCERESI = '.onboard-wrap';
if (typeof document !== 'undefined') {
  const mark = (held?: boolean) => (e: Event) => {
    if (held !== undefined) touch.held = held;
    if (e.target instanceof Element && e.target.closest(AD_PENCERESI)) return;
    touch.last = performance.now();
  };
  const o = { capture: true, passive: true };
  document.addEventListener('pointerdown', mark(true), o);
  document.addEventListener('pointerup', mark(false), o);
  document.addEventListener('pointercancel', mark(false), o);
  document.addEventListener('wheel', mark(), o);
  document.addEventListener('keydown', mark(), o);
}
/**
 * Bölüm başlatan düğmeler: haritanın büyük "Bölüm N"si, bölüm kartının Oyna'sı, sonuçtaki Sonraki. Oyuncu bunlardan birine dokununca
 * bölüm yüklenene dek (yavaş telefonda saniyeler) yeni tanıtım başlamaz; bölüm açılınca sürmekte olan açılım tanıtımı ertelenir ve
 * bölümden sonra yeniden gelir (OT-uzman-odyolog-34: "Bölüm 10"a dokunan oyuncu Günün Sorusu tanıtımıyla Takım sohbetine gitti)
 */
export const BOLUM_SEL = '.map-play, .map-btn.shine, .result-actions [data-act="sonraki"]';
/** bölüme dokunuştan sonra tanıtımın beklediği en uzun süre (bölüm açılamadıysa tanıtımlar yine gelir) */
const NIYET_MS = 15000;
export const bolumNiyeti = { at: -Infinity };
export const bolumBasliyor = (now = performance.now()) => now - bolumNiyeti.at < NIYET_MS;
/** bölümün oynandığı rotalar: açılınca sürmekte olan açılım tanıtımı ertelenir */
const PLAY_ROUTES = ['level', 'intro', 'eventLevel'];
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest(BOLUM_SEL)) bolumNiyeti.at = performance.now(); }, { capture: true, passive: true });
}
/** turun bir adımı oyuncuyu başka bir alt sekmeye götürüyor mu ("Takım'a dokun") */
export const sekmeDegistirir = (t: Tour) => t.steps.some((s) => typeof s.target === 'string' && s.target.startsWith('nav.tabbar .tab['));
/**
 * Sekme değiştiren tanıtım açıkken oyuncunun ilk dokunuşu karartılmış zeminde bir bölüm düğmesinin ("Bölüm N") üstüne düştüyse
 * tanıtım görülmüş sayılmadan çekilir ve bölüm başlar; tanıtım bölümden sonra yeniden gelir. Yalnız turun ilk dokunuşu sayılır.
 */
export function watchBolum(): { stop(): void } {
  let first = true;
  const on = (e: MouseEvent) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!first || !t?.closest('.coach')) return;
    first = false;
    if (!t.closest('.coach-block')) return;
    let hit: HTMLElement | null = null;
    for (const x of document.elementsFromPoint?.(e.clientX, e.clientY) ?? []) {
      if (x.closest('.coach')) continue;
      const b = x.closest(BOLUM_SEL); if (b instanceof HTMLElement && !(b as HTMLButtonElement).disabled) hit = b;
      break;
    }
    if (!hit) return;
    e.stopPropagation(); e.preventDefault();
    bolumNiyeti.at = performance.now();
    useCoach.getState().defer();
    const el = hit; setTimeout(() => { if (el.isConnected && !useCoach.getState().tour) el.click(); }, 60);
  };
  document.addEventListener('click', on, true);
  return { stop: () => document.removeEventListener('click', on, true) };
}
function handsOff(): boolean {
  const since = performance.now() - touch.last;
  return since >= TOUCH_CALM_MS && (!touch.held || since >= HELD_MAX_MS);
}
/**
 * Kampa girişte (OT-ogrenci-birinci-17): oyuncu kampa girdiğinden beri ekrana dokunmadıysa (son dokunuş kampı açan sekme dokunuşu)
 * kamp tanıtımı beklemeden, ekran açılır açılmaz gelir; oyuncu okuyup bir yere uzanırken değil. Dokunduysa her zamanki sakinlik kuralı.
 */
const ENTRY_TOUCH_MS = 300;
const untouchedSince = (at: number) => !touch.held && touch.last <= at + ENTRY_TOUCH_MS;

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
/** Odyoloji Kliniği'nin kartı: liste görünümünde kart (Kanca.tsx'in "Kurunca: Hasta Vakaları açılır" satırını taşıyan), üs görünümünde bina */
const klinikKart = (): Element | DOMRect | null => document.querySelector('[data-testid="klinik-vaka-not"]')?.closest('.card') ?? buildingRect('revir');
/** Odyometri Odası'nın kartı (Ton Avı buradan açılır): liste görünümünde "Ton Avı: Odyometri Odası’nı kur" satırını taşıyan kart, üs görünümünde bina */
const odaKart = (): Element | DOMRect | null => document.querySelector('[data-testid="giris-ton-kilit"]')?.closest('.card') ?? buildingRect('laboratuvar');
/** "önce kur" yazısının gösterdiği kart */
const kurKart = (id: string) => (id === 'oyun-kur' ? odaKart() : klinikKart());
/** üs görünümünde bina penceresi açıldı (arsaya dokunuş): "önce kur" yazısı kapanır, pencerenin Kur'u açık kalır */
const binaPenceresi = () => exists('.bp-wrap');
/** öğe görünür bantta mı (üst çubuk ve sekme çubuğu payı dışında) */
function onScreen(v: Element | DOMRect | null): boolean {
  if (!v) return false; const r = v instanceof Element ? v.getBoundingClientRect() : v;
  return r.height > 0 && r.top >= 56 && r.bottom <= innerHeight - 80;
}
/** Hasta Vakaları'nın gerçek girişi: kamp üst göstergesindeki Klinik düğmesi (yoksa liste görünümündeki klinik kartının girişi) */
const klinikGiris = (): Element | null => document.querySelector('[data-testid="klinik-btn"]') ?? document.querySelector('[data-testid="klinik-vaka-giris"]');
/**
 * Üs görünümünde kamera yalnız binanın çerçevesi üst gösterge ile alt kartların arasında değilse kayar (OT-ilk-kez-oyun-33): bina
 * zaten görünüyorsa halka hemen oturur; kayan kamerayı bekleyen (yavaş telefonda saniyeler süren) boş ekran olmaz. Yanlardan da:
 * ekranın kenarında yarım kalan arsa ekran ortasına alınır (OT-ogrenci-birinci-48)
 */
const YAN_PAY = 8;
function focusIfHidden(id: BuildingId): void {
  const b = kamp()?.box?.(id);
  const top = document.querySelector('.camp-base .camp-top')?.getBoundingClientRect().bottom ?? 120;
  const bottom = document.querySelector('.camp-base .camp-bottom')?.getBoundingClientRect().top ?? innerHeight - 200;
  if (b && b.y >= top && b.y + b.h <= bottom && b.x >= YAN_PAY && b.x + b.w <= innerWidth - YAN_PAY) return;
  kamp()?.focus?.(id);
}

/** goster: oyuncu tanıtımı kendisi istedi (kamp kartındaki "Göster"); gösterilecek yer ekranda değilse sayfa ona kayar */
export function tourFor(id: string, route: string, goster = false): Tour | null {
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
        { id: 'bugun-03', say: lineText('bugun-03'), target: TOPLA, before: { target: '.chest-stage .cel-chest', hint: 'Sandığa dokun' }, wait: { until: gone(TOPLA) }, hint: 'Topla’ya dokun', optional: { el: '.chest-stage' }, mood: 'wow', cel: true },
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
        // "Arkadaş kodunu paylaş" derken kod balonda da yazar: balon sayfadaki kod satırını örtse de (üstte) ya da sayfa karoya
        // kaymışken (küçük ekran) oyuncu kodu görür (OT-sessiz-oyuncu-21)
        { id: 'arkadas-02', say: lineText('arkadas-02'), target: '.menu-tile[data-tile="friends"]', note: friendCodeNote },
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
        // başlığın saydığı üç yer sırayla: Ödül kutusu simgesi, Mağaza girişi, Dolap (OT-ilk-kez-oyun-63). İlk ikisinin kayıtlı sesi
        // yok (yazı); onaylı magaza-01/02 metni aynı
        { say: ODUL_KUTUSU_YERI, silent: true, target: '.topbar2 .tb-pill.env', optional: true },
        { say: MAGAZA_YERI, silent: true, target: '.menu-tile[data-tile="shop"]', optional: true },
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
        // Takım sekmeleri iki düzeyli (YN-083): Lig, Rekabet grubunun içinde; tur sekmeyi açar, sonra parlatır. Satır "Takım
        // sekmesindeki Lig" der, Takım ekranında ayrıca "Takım" alt sekmesi var: balonda yolun tamamı yazar (OT-takim-kaptani-30)
        { ...line('tlig-02'), note: () => 'Takım › Rekabet › Lig', enter: () => openTeamTab('lig'), target: () => document.querySelector('.subtabs .subtab[data-sekme="lig"]') ?? document.querySelector('.team-hero, .team-head'), optional: true, mood: 'wink' },
      ); break;
    case 'tyaris':
      steps.push(
        unlockCard('tyaris', 'tyaris-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        // son açık sekme (ör. Hediyeler) değil: Takım Yarışı sekmesi açılır ve parlar (OT-ilk-kez-oyun-14)
        { ...line('tyaris-02'), enter: () => openTeamTab('tyaris'), target: () => document.querySelector('.subtabs .subtab[data-sekme="tyaris"]') ?? document.querySelector('.team-hero, .team-head'), optional: true },
      ); break;
    case 'akis':
      steps.push(
        unlockCard('akis', 'akis-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        // Tebrik et'i olan en yeni kart parlar (sayfa ona kayar); yoksa en yeni kartın tepkileri ve yön notu yalnız tepkiden söz eder
        // (OT-ilk-kez-oyun-62: en eski "Hoş geldin" kartı parlıyordu). Onaylı satırın metni aynı
        { ...line('akis-02'), enter: () => openTeamTab('sohbet'), target: () => tebrikKarti() ?? sonKart()?.querySelector('.react-bar') ?? document.querySelector('.quick-line'), note: akisNotu, optional: true, mood: 'wink' },
      ); break;
    case 'soru':
      steps.push(
        unlockCard('soru', 'soru-01'),
        ...(route === 'team' ? [] : [tapTab('team')]),
        // soru kapalıysa (cevaplanmış/açıklanmış) "Bir şık seç" denmez: adım konuşmadan geçilir, kart sıradaki saati yazar
        { ...line('soru-02'), enter: () => openTeamTab('sohbet'), target: openQuestion, optional: true },
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
    // kamp oyunları yalnız en az biri açıkken (Odyometri Odası ya da Timpanometri Kulesi kurulu) tanıtılır (campQueue); seslendirilmiş
    // satır "…seni bekliyor" der (OT-ilk-kez-oyun-52)
    case 'kampoyun':
      steps.push(
        unlockCard('kampoyun', 'kg-oyun-01'),
        ...(route === 'camp' ? [] : [tapTab('camp')]),
        { ...line('kg-oyun-02'), target: '[data-testid="kg-btn"]', optional: true, mood: 'wink' },
      ); break;
    // Hasta Vakaları yalnız Odyoloji Kliniği kuruluyken tanıtılır (campQueue) ve çerçeve gerçek girişi gösterir (Görevler değil)
    case 'vaka':
      steps.push(
        unlockCard('vaka', 'kg-vaka-01'),
        ...(route === 'camp' ? [] : [tapTab('camp')]),
        { ...line('kg-vaka-02'), target: klinikGiris, optional: true },
      ); break;
    // klinik kurulmamışken tanıtım yerine yazı (seslendirilmez): çerçeve klinik kartında (OT-sessiz-oyuncu-9). Dokunuş çerçevenin
    // içinden karta geçer: parlayan "Kur"a (üs görünümünde binaya) ilk dokunuş hem işini yapar hem yazıyı kapatır. Kendiliğinden
    // başlayınca sayfa kaymaz, kart ekranda değilse oyuncu kaydırınca çerçeve belirir (OT-ogrenci-birinci-17); "Göster"le istenince
    // liste klinik kartına kayar (OT-ilk-kez-oyun-33)
    // Üs görünümünde arsaya dokunuş bina penceresini açar: yazı o an kapanır, çerçeve ve balon pencerenin Kur düğmesini örtmez
    // (OT-eski-telefon-29). Kamp oyunlarında aynısı Odyometri Odası için (`oyun-kur`, OT-ilk-kez-oyun-52). Üs görünümünde pencereyi
    // tur açar: çerçevenin içine dokunuş tuvale geçmez (sürükleme sayılıp kamerayı kaydırmaz), "Odaya dokun" düğmesi de aynı pencereyi
    // açar; kenarda yarım kalan arsa önce ortalanır (OT-ogrenci-birinci-48)
    case 'vaka-kur':
    case 'oyun-kur': {
      const liste = exists('.camp-list-screen'); const oyun = id === 'oyun-kur'; const bina: BuildingId = oyun ? 'laboratuvar' : 'revir';
      steps.push({ say: oyun ? OYUN_KUR : VAKA_KUR, silent: true, target: oyun ? odaKart : klinikKart, wait: 'tap', endIf: binaPenceresi, hint: liste ? 'Kur’a dokun' : oyun ? 'Odaya dokun' : 'Kliniğe dokun', noScroll: !goster, enter: () => focusIfHidden(bina), act: liste ? undefined : () => kampBinaAc(bina), mood: 'wink' });
      break;
    }
    default: return null;
  }
  return { id, steps };
}

const TAB_ROUTES = ['map', 'today', 'camp', 'team', 'profile'];
/** Mağaza turunda Ödül kutusu simgesi ve Mağaza girişi (kayıtlı ses yok; yazı) */
export const ODUL_KUTUSU_YERI = 'Ödül kutun burada: etkinlik ve sıralama ödüllerin, arkadaş hediyelerin buraya gelir.';
export const MAGAZA_YERI = 'Mağaza burada. Bölüm geçirten ya da sıralamada öne geçiren bir şey satılmaz.';
/** Takım Akışı kartları (sohbette eskiden yeniye) */
const akisKartlari = () => [...document.querySelectorAll('[data-testid="akis-karti"]')];
const sonKart = (): Element | null => akisKartlari().pop() ?? null;
/** Tebrik et'i olan en yeni kart: oyuncunun kendi kartında Tebrik et yok, yeni üye kartında düğme "Hoş geldin de" */
export const tebrikKarti = (): Element | null => akisKartlari().filter((c) => c.getAttribute('data-type') !== 'uye' && c.querySelector('[data-testid="tebrik-et"]')).pop() ?? null;
/** akis-02'nin seslendirilmeyen yön notu: parlayan kartta ne yapılabileceği */
const akisNotu = () => (tebrikKarti() ? 'Tepki bırak ya da Tebrik et’e dokun' : sonKart() ? 'Karta bir tepki bırak' : null);
/** klinik kurulmamışken Hasta Vakaları tanıtımının yerine (kayıtlı ses yok; yazı) */
export const VAKA_KUR = 'Önce Odyoloji Kliniği’ni kur; Hasta Vakaları oradan açılır.';
/** hiçbir kamp oyunu açık değilken kamp oyunları tanıtımının yerine (kayıtlı ses yok; yazı) */
export const OYUN_KUR = 'Önce Odyometri Odası’nı kur; Ton Avı oradan açılır.';

/** oyuncu en az bir vaka açtı ya da çözdü mü (kamp görevleri özetindeki Vaka Defteri başarısı ya da defterde oynanmış/çözülmüş vaka) */
export function vakaCozuldu(): boolean {
  const { kg, vaka } = useKg.getState();
  return (kg?.achievements.find((a) => a.id === 'b-defter')?.progress ?? 0) > 0 || !!vaka?.book.some((b) => b.solvedAt != null || b.plays > 0);
}
/**
 * oyuncu bir Kamp Görevleri ödülü aldı (hikâye bölümü ya da adımı, günlük görev, haftalık ya da başarı basamağı, takım hedefi):
 * Görevler'e kendi girmiş, "yeni" diye gösterilmez (OT-ogrenci-birinci-43)
 */
export function gorevAlindi(): boolean {
  const kg = useKg.getState().kg; if (!kg) return false;
  const ch = kg.story?.chapter;
  return (kg.story?.claimed ?? 0) > 0 || !!ch?.claimed || !!ch?.steps?.some((g) => g.claimed) || !!kg.daily?.tasks.some((g) => g.claimed)
    || !!kg.weekly?.tiers.some((t) => t.claimed) || !!kg.achievements?.some((a) => a.tiers?.some((t) => t.claimed)) || !!kg.takim?.claimed;
}
/** Hasta Vakaları oyuncuda: 'acik' (klinik kurulu), 'kur' (bölümü geldi, klinik yok), 'yapiliyor' (klinik inşaatta); null: bölümü gelmedi */
export type VakaDurum = 'acik' | 'kur' | 'yapiliyor' | null;
function vakaDurum(): VakaDurum {
  const kg = useKg.getState().kg; if (!kg) return null;
  if (kg.vaka.open) return 'acik';
  if (!kg.open.vaka) return null;
  return useNet.getState().camp?.buildings.some((b) => b.id === 'revir' && b.upgradingTo) ? 'yapiliyor' : 'kur';
}
/** Kamp oyunları oyuncuda: 'acik' (en az biri açık), 'kur' (bölümü geldi, iki bina da yok), 'yapiliyor' (biri inşaatta); null: bölümü gelmedi */
function oyunDurum(): VakaDurum {
  const kg = useKg.getState().kg; if (!kg) return null;
  if (kg.oyun.some((g) => g.open)) return 'acik';
  if (!kg.open.oyun) return null;
  return useNet.getState().camp?.buildings.some((b) => (b.id === 'laboratuvar' || b.id === 'kule') && b.upgradingTo) ? 'yapiliyor' : 'kur';
}
/** oyuncu bugün bir kamp oyunu oynadı: kamp oyunlarına kendi girmiş, "yeni" diye gösterilmez */
export const oyunOynandi = (): boolean => !!useKg.getState().kg?.oyun.some((g) => g.played > 0);
/**
 * Kampta sırada bekleyen tanıtımlar (sırayla). Hasta Vakaları bölüm eşiğiyle değil, vaka gerçekten açıkken (Odyoloji Kliniği kurulu)
 * tanıtılır; klinik yoksa yerine bir kez "önce kliniği kur" yazısı, klinik kurulunca da asıl tanıtım gelir. `cozdu`: oyuncu en az bir
 * vaka çözdü; Hasta Vakaları'na kendi girmiş, "yeni" diye gösterilmez (visitedTours ilkesi, OT-ilk-kez-oyun-51).
 * Kamp oyunları da aynı kuralla (OT-ilk-kez-oyun-52): `oyun` en az biri açıkken 'acik'; hiçbiri açık değilse yerine bir kez "önce
 * Odyometri Odası'nı kur" yazısı (`oyun-kur`), oda (ya da kule) kurulunca asıl tanıtım. `oynadi`: oyuncu bir kamp oyunu oynadı.
 * Oyuncunun kullandığı özellik "yeni" sayılmaz (OT-ogrenci-birinci-43): `aldi` görev ödülü alındı; klinik "önce kur" yazısı gelmeden
 * kurulduysa (oyuncu kliniği kendisi kurdu) Hasta Vakaları da. "Kamp'ta yeni" kartında bir kez gösterilen (`kartta`) yeniden gelmez.
 */
export function campQueue(cleared: number, done: readonly string[], vaka: VakaDurum, cozdu = false, oyun: VakaDurum = 'acik', oynadi = false, aldi = false): string[] {
  const out: string[] = [];
  const seen = (id: string) => done.includes(id) || done.includes(kartta(id));
  for (const f of FEATURES) {
    if (!f.tour || !CAMP_TOURS.has(f.id) || cleared < f.at || seen(f.id)) continue;
    if ((f.id === 'vaka' && cozdu) || (f.id === 'kampoyun' && oynadi) || (f.id === 'gorev' && aldi)) continue;
    if (f.id === 'kampoyun') { if (oyun === 'acik') out.push(f.id); else if (oyun === 'kur' && !seen('oyun-kur')) out.push('oyun-kur'); }
    else if (f.id !== 'vaka') out.push(f.id);
    else if (vaka === 'acik') { if (seen('vaka-kur')) out.push('vaka'); }
    else if (vaka === 'kur' && !seen('vaka-kur')) out.push('vaka-kur');
  }
  return out;
}
/**
 * Bu kamp girişinde duyurulmuş (tur ya da tek kart) kamp tanıtımları; kamptan çıkınca sıfırlanır (tek kartta görünenler ayrıca
 * kalıcı kaydedilir, bkz. KampYeni.tsx `kartta`). Biri bitince sıradaki kendiliğinden
 * başlamaz (zincir yok: oyuncunun sonraki dokunuşu başka bir tanıtıma dönüşmez); girişten sonra açılan (klinik kuruldu) yine gelir.
 */
const campVisit = new Set<string>();
/** kampta birden çok yeni şey: tek kart (KampYeni.tsx) */
const KAMP_YENI = 'yeni-kamp-karti';
let campCard: string[] = [];
// anlatıcı yükü sınırı, kamp turları ve sayaç: map-intro.ts (sonuç ekranı da aynı kuyruğa bakar)
export { MAX_UNLOCK_TOURS_PER_LEVEL } from './map-intro';

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
const VISIT_ROUTE: Partial<Record<FeatureId, string>> = { today: 'today', camp: 'camp', team: 'team', friends: 'friends', glossary: 'glossary' };
export function visitedTours(route: string, cleared: number, done: readonly string[], keep: readonly (string | null | undefined)[]): string[] {
  return (Object.keys(VISIT_ROUTE) as FeatureId[]).filter((id) => VISIT_ROUTE[id] === route && cleared >= featureById(id).at && !done.includes(id) && !keep.includes(id));
}

/**
 * bir sonraki tur: sıra önemli (önce sonuç → harita → açılımlar). `zincir`: sonucun söz verdiği ve önceki tur biter bitmez
 * (oyuncu araya dokunmadan) art arda gelecek açılım turları; önceki tur oyuncuyu başka sekmeye götürdüyse orada da başlar
 */
function nextTour(route: string, zincir: readonly string[] = []): string | null {
  const s = useStore.getState(); const f = s.ftue; if (f.bypass || f.admin) return null;
  const done = (id: string) => f.tours.includes(id);
  const cleared = clearedCount(s.progress);
  if (route === 'result') {
    if (cleared >= 1 && !done('result1') && exists('.result-actions') && !exists('.skip-hint')) return 'result1';
    return null;
  }
  if (!TAB_ROUTES.includes(route)) return null;
  if (cleared >= 1 && !done('map')) return route === 'map' && exists('.map-play') ? 'map' : null;
  // genel açılım turları: sonuç ekranının "Haritaya dön" kararıyla aynı kuyruk (map-intro.ts mapIntroQueue). Yalnız haritada başlar:
  // Bugün/Kamp/Takım/Profil'de oyuncunun uzandığı düğmenin üstüne açılmaz, oyuncu haritaya dönünce gelir (OT-ogrenci-birinci-31)
  const genel = genelUnlockQueue(cleared, f.tours)[0]; if (genel && (route === 'map' || zincir.includes(genel))) return genel;
  // kamp görevleri turları yalnız kamptayken başlar (oyuncu kampa döndüğünde; başka bir akışı bölmez); sunucunun kamp görevleri özeti
  // gelmeden karar verilmez (Hasta Vakaları klinik kurulu mu). Birden çok yeni şey varsa tek kart, art arda tur yok
  if (route === 'camp' && exists('.camp-base, .camp-list-screen') && useKg.getState().kg) {
    const q = campQueue(cleared, f.tours, vakaDurum(), vakaCozuldu(), oyunDurum(), oyunOynandi(), gorevAlindi()).filter((id) => !campVisit.has(id));
    if (q.length >= 2) { campCard = q; return KAMP_YENI; }
    // "önce kur" yazısı liste görünümünde binanın kartı ekrandayken gelir (sayfa onu göstermek için kaymaz)
    if (q[0] === 'vaka-kur' || q[0] === 'oyun-kur') { if (!exists('.camp-list-screen') || onScreen(kurKart(q[0]))) return q[0]; }
    else if (q[0] && !groupFull(q[0], cleared)) return q[0];
  }
  if (route === 'camp' && done('camp') && !done('camp-build') && exists('.camp-base') && campPick() && buildingVisible(campPick()!)) return 'camp-build';
  return null;
}

/** tur başlamadan önce ekranın art arda sakin kalacağı yoklama sayısı (500 ms aralıkla) */
const CALM_TICKS = 3;
/** kampa girişte oyuncu dokunmadıysa yeterli sakin yoklama */
const FRESH_TICKS = 2;

/**
 * Kamp tanıtımı açıkken oyuncunun ilk dokunuşu karartılmış zemine, altta kalan bir düğmenin (ör. "Görevler") üstüne düştüyse o düğme
 * hatırlanır; tanıtım bitince (ya da atlanınca) ekranda başka bir pencere yoksa düğmenin işi yapılır. Oyuncu tanıtımı görmeden
 * uzandığı düğmeye dokunduğunda dokunuş sessizce yutulmaz (OT-ogrenci-birinci-22). Yalnız turun ilk dokunuşu sayılır.
 */
export function rememberTap(): { take(): HTMLElement | null; stop(): void } {
  let first = true; let hit: HTMLElement | null = null;
  const on = (e: MouseEvent) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!first || !t?.closest('.coach')) return;
    first = false;
    if (!t.closest('.coach-block')) return;
    for (const x of document.elementsFromPoint?.(e.clientX, e.clientY) ?? []) {
      if (x.closest('.coach')) continue;
      const b = x.closest('button, a[href], [role="button"], [role="tab"]');
      if (b instanceof HTMLElement && !(b as HTMLButtonElement).disabled) hit = b;
      break;
    }
  };
  document.addEventListener('click', on, true);
  return { take: () => hit, stop: () => document.removeEventListener('click', on, true) };
}
/** hatırlanan düğmenin işi: yalnız düğme hâlâ ekrandaysa ve üstte pencere/tur yoksa */
function replayTap(el: HTMLElement | null): void {
  if (!el) return;
  setTimeout(() => {
    const r = el.getBoundingClientRect();
    if (!el.isConnected || r.width < 2 || r.height < 2 || useCoach.getState().tour || useCelebrating.getState().on) return;
    if (exists('.sheet-wrap, .map-sheet-wrap, .bp-wrap, .overlay, [aria-modal="true"]')) return;
    el.click();
  }, 120);
}

/** turu başlat; "Atla" o an sırada bekleyen turları da geçer (Hasta Vakaları klinik kurulmadan, kamp oyunları hiçbiri açılmadan geçilmiş sayılmaz) */
export function startTour(id: string, route: string, goster = false): void {
  const st = useStore.getState(); const t = tourFor(id, route, goster);
  if (!t) { st.ftueTourDone(id); return; }
  if (CAMP_TOURS.has(id)) campVisit.add(id);
  const cleared = clearedCount(st.progress);
  countUnlockTour(id, cleared);
  // kendiliğinden başlayan kamp tanıtımında oyuncunun ilk dokunuşu (bkz. rememberTap)
  const tap = CAMP_TOURS.has(id) && !goster ? rememberTap() : null;
  // oyuncuyu başka sekmeye götüren tanıtımda bölüm düğmesine düşen ilk dokunuş (bkz. watchBolum)
  const bolum = !CAMP_TOURS.has(id) && sekmeDegistirir(t) ? watchBolum() : null;
  useCoach.getState().start({ ...t, onDone: (skipped) => {
    tap?.stop(); bolum?.stop(); replayTap(tap?.take() ?? null);
    if (!skipped) return; const s = useStore.getState();
    for (const p of pendingTours(id, clearedCount(s.progress), s.ftue.tours)) if ((p !== 'vaka' || vakaDurum() === 'acik') && (p !== 'kampoyun' || oyunDurum() === 'acik')) s.ftueTourDone(p);
  }, onDefer: () => {
    tap?.stop(); bolum?.stop();
    // açılırken oyuncu başka yere dokundu: sayılmaz, bu girişte yine sırada (ekran sakinleşince)
    campVisit.delete(id);
    if (unlockTally.cleared === cleared && FEATURES.some((f) => f.id === id && f.tour)) unlockTally[groupOf(id)] = Math.max(0, unlockTally[groupOf(id)] - 1);
  } });
}

export function FtueDirector({ route }: { route: string }) {
  const active = useCoach((s) => s.tour);
  const bypass = useStore((s) => s.ftue.bypass);
  // kamptan çıkınca: bu girişin duyuruları ve tek kart sıfırlanır (bekleyen turlar bir sonraki girişte yine duyurulur; tek kartta
  // görünmüş olanlar yeniden "yeni" sayılmaz)
  useEffect(() => { if (route !== 'camp') { campVisit.clear(); hideKampYeni(); } }, [route]);
  // bölüm açıldı: sürmekte olan açılım tanıtımı (bölüme dokunuşla yarışıp açılmış olabilir) görülmüş sayılmadan çekilir, bölümden
  // sonra yeniden gelir (anlatıcı yükü sayacı geri alınır, OT-uzman-odyolog-34)
  useEffect(() => {
    if (!PLAY_ROUTES.includes(route)) return;
    bolumNiyeti.at = -Infinity;
    const t = useCoach.getState().tour;
    if (t && !CAMP_TOURS.has(t.id) && FEATURES.some((f) => f.id === t.id && f.tour)) useCoach.getState().defer();
  }, [route]);
  // ekrana giriş anı (kampa girişte dokunulmadıysa tanıtım beklemeden gelir)
  const enteredAt = useRef(0);
  // sonuç ekranından "Haritaya dön"le gelince sonucun söz verdiği turlar (ResultScreen data-tours, mapIntroQueue). Tur oyuncuyu
  // başka sekmeye götürünce (ör. "Takım'a dokun") söz sürer; oyuncu kendisi başka yere gidince biter
  const promised = useRef<string[]>([]); const prevRoute = useRef(route);
  useEffect(() => {
    enteredAt.current = performance.now();
    const st = useStore.getState();
    if (route === 'map' && prevRoute.current === 'result') promised.current = mapIntroQueue(clearedCount(st.progress), st.ftue);
    else if (!useCoach.getState().tour) promised.current = [];
    prevRoute.current = route;
  }, [route]);
  useEffect(() => {
    if (bypass || active) return;
    // ekran bir süre sakin kalmalı (art arda gelen kutlama/sahne adımlarının arasındaki kısa boşlukta tur başlamasın)
    let calm = 0;
    // ekrana giriş ya da bir önceki turun bitişi (söz verilen turlar art arda gelir)
    const since = performance.now();
    const h = setInterval(() => {
      // kampa girdiğinden beri dokunmayan oyuncu: kısa bekleme (açılıştaki kutlama/satır kendini gösterebilsin). Sonuçtan haritaya
      // dönen oyuncu da: söz verilen tanıtım dönüş sahnesi ve hedef kutusu biter bitmez gelir, oyuncu okuyup bir yere uzanırken
      // değil (OT-ogrenci-birinci-31); dokunduysa her zamanki sakinlik kuralı
      const tours = useStore.getState().ftue.tours;
      // girişten (girişi açan dokunuşun payıyla) ya da önceki turun bitişinden beri dokunulmadı
      const sessiz = !touch.held && touch.last <= Math.max(enteredAt.current + ENTRY_TOUCH_MS, since);
      const zincir = sessiz ? promised.current.filter((id) => !tours.includes(id)) : [];
      const fresh = (route === 'camp' && untouchedSince(enteredAt.current)) || zincir.length > 0;
      if (useCoach.getState().tour || !quiet() || (!fresh && !handsOff())) { calm = 0; return; }
      // kampın tek kartı açıkken başka tur başlamaz (oyuncu "Göster"le seçer)
      if (kampYeniBekleyen().length) { calm = 0; return; }
      if (++calm < (fresh ? FRESH_TICKS : CALM_TICKS)) return;
      const st = useStore.getState(); const id = nextTour(route, zincir);
      // oyuncu bir yere kendi girdiyse (turu henüz sırada beklerken) o yerin tanıtımı görülmüş sayılır; şimdi başlayacak tur hariç
      if (!st.ftue.bypass && !st.ftue.admin) {
        for (const v of visitedTours(route, clearedCount(st.progress), st.ftue.tours, [id])) st.ftueTourDone(v);
        // vaka çözmüş oyuncu Hasta Vakaları'na kendi girmiş (önceki oturumda da olsa)
        if (route === 'camp' && id !== 'vaka' && !st.ftue.tours.includes('vaka') && vakaCozuldu()) st.ftueTourDone('vaka');
        // kamp oyunu oynamış oyuncu da kamp oyunlarına kendi girmiş
        if (route === 'camp' && id !== 'kampoyun' && !st.ftue.tours.includes('kampoyun') && oyunOynandi()) st.ftueTourDone('kampoyun');
        // görev ödülü almış oyuncu Görevler'e kendi girmiş
        if (route === 'camp' && id !== 'gorev' && !st.ftue.tours.includes('gorev') && gorevAlindi()) st.ftueTourDone('gorev');
      }
      if (!id) return;
      if (id === KAMP_YENI) { for (const c of campCard) campVisit.add(c); showKampYeni(campCard); return; }
      startTour(id, route);
    }, 500);
    return () => clearInterval(h);
  }, [route, active, bypass]);
  // rota değişince eski rotaya ait bekleyen adımlar kendi hedeflerini bekler; tur iptal edilmez
  return route === 'camp' && !bypass ? <KampYeniKart onShow={(id) => startTour(id, 'camp', true)} calm={() => quiet()} /> : null;
}

/** kilitli sekme/karo dokunuşu: kısa dürüst not */
export function useLockToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const h = setTimeout(() => setMsg(null), 1800); return () => clearTimeout(h); }, [msg]);
  return { show: setMsg, node: msg ? <div className="lock-toast" role="status"><Art name="lock" size={18} /> {msg}</div> : null };
}
