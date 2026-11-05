import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BIOMES, HUMAN_JOURNEY } from '@odi/content';
import { calendarView, chestReady, dayKey, ensureDaily, levelProgress, questDone } from '@odi/meta';
import { odiLook, useOdiLook } from '../look';
import { WAR_REGIONS, type PublicProfile } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { audio } from '@odi/audio';
import type { MapHandle, MapSocial, StarMap, Vitality, ZoneId } from '@odi/game-core/lite';
import { chunkFailed, loadMap } from '../engine';
import { EngineLoading } from '../ui/Loading';
import { useStore } from '../store';
import { getNet, odulNe, useSocial } from '../net';
import { hazinePenceresi, sinirNotu } from '../odul-durum';
import { useNav } from '../nav';
import { platform } from '../platform';
import { HudNum, StatusDot, fmtNum } from '../ui/social';
import { prefersReducedMotion } from '../ui/bits';
import { celebrate, type RecapRow } from '../celebrate';
import { useHudCount } from '../celebrate/hud';
import { loadMapSeen, starsOf, useMapSeen } from '../map/mapSeen';
import { bolumeEk, mapGoal, returnCelebrations, stageLabel, treasureItems, type Goal } from '../map/goals';
import { MapCards, type MapCard } from '../map/MapCards';
import { Compass, MapFrame } from '../map/MapChrome';
import { Art, Glyph, Rich, artSvg, emblemArt } from '../ui/art';
import { useFeatures } from '../ftue/useFeatures';
import { useCoach } from '../ftue/Coach';
import { Icon } from '../ui/icons';
import '../map/map.css';
declare const __ODI_E2E__: boolean | undefined;

/**
 * "Hedefe ulaştın!" kutusu dönüş sahnesi bittikten sonra bu kadar kalır, sonra yalnız sıradaki hedef. O sürerken Tüy Dede turu
 * başlamaz (ftue/Director.tsx quiet, `data-ulasildi`): "Yeni yer açıldı" kartı kutunun üstüne binmez (OT-sessiz-oyuncu-20).
 * Yolculuğun bittiği dönüşte (goal.final) ve yolculuk bittikten sonra tam genişliğe açılan kutu altta, Bölüm düğmesinin üstündedir:
 * Ninni Merkezi başlığını örtmez (YN-241, OT-sessiz-oyuncu-33)
 */
const GOAL_REACHED_MS = 6000;
/** haritadaki hazine töreni: içerik bölüm sonunda (sonuç ekranında) verildi; tören yeniden vermez (OT-uzman-odyolog-29) */
const HAZINE_VERILDI = 'Bölüm sonunda cüzdanına eklenmişti';

/**
 * Hazine penceresinin içeriği ve notu, hesaba geçenle (YN-200, OT-rekabetci-44): günlük yerel ödül sınırı jetonu kestiyse kart hesaba
 * geçeni gösterir, not eklenmeyeni söyler; jeton sunucuya henüz gitmediyse (çevrimdışı) "eklenmişti" denmez.
 */
function hazineGorunum(n: number, verildi = HAZINE_VERILDI) {
  const meta = useStore.getState().meta;
  return hazinePenceresi(treasureItems(meta, n), hazineDurum(n), verildi);
}
function hazineDurum(n: number) {
  const rec = [...useStore.getState().meta.ledger].reverse().find((g) => g.reason === `hazine:${n}`);
  return rec ? odulNe(rec) : { k: 'tam' as const };
}
/** pencere açılırken hazine jetonlarından biri sunucuya gitmeyi ya da yanıtı bekliyor mu (bekliyorsa not canlı izlenir) */
const hazineBekliyor = (ns: readonly number[]) => ns.some((n) => hazineDurum(n).k === 'bekliyor');
/**
 * Pencere açıkken bağlantı gelip jeton hesaba geçerse not güncellenir (YN-260 (3), OT-eski-telefon-46: bağlantıdan sonra da
 * "bağlanınca cüzdanına eklenecek" diyordu). Outbox ve bağlantı durumu her değiştiğinde not yeniden hesaplanır; bekleyen jeton
 * hesaba geçince "Cüzdanına eklendi" (bölüm sonunda değil, şimdi eklendi), sınır kestiyse eklenmeyen. Bekleyen yoksa izleme yok.
 */
function canliNot<T>(bekliyor: boolean, hesap: () => T) {
  if (!bekliyor) return undefined;
  return (set: (v: T) => void) => {
    const f = () => set(hesap());
    const a = useSocial.subscribe(f); const b = useNet.subscribe(f);
    return () => { a(); b(); };
  };
}

/** `?harita=tam`: test tarayıcısında da tam animasyonlu harita (ekran görüntüleri için; varsayılan davranışı değiştirmez) */
const fullMotion = (): { light?: boolean } => { try { return new URLSearchParams(location.search).get('harita') === 'tam' ? { light: false } : {}; } catch { return {}; } };

/** `?harita-kart=N` (1–40): kart kapatılana kadar (harita açılışta yeniden kurulabilir) */
let demoCard = (() => { try { const n = Number(new URLSearchParams(location.search).get('harita-kart')); return Number.isInteger(n) && n >= 1 && n <= HUMAN_JOURNEY.levels.length ? n : 0; } catch { return 0; } })();

/**
 * Yaşayan Kulak Haritası: tam ekran Phaser haritası + React katmanı (cam HUD, Bugün çipi, sıradaki hedef rozeti,
 * pusula, büyük "Bölüm N ▶" düğmesi, bölüm/hazine/bölge kartları). Bölümden dönünce dönüş sahnesi oynar (hareket azaltmada anında,
 * dokununca sonuna atlar).
 */
export function MapScreen({ onPlay, onToday }: { onPlay: (n: number) => void; onToday: () => void }) {
  const progress = useStore((s) => s.progress); const meta = useStore((s) => s.meta); const coins = useStore((s) => s.coins); const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak); const lastDay = useStore((s) => s.lastDay);
  const unlocked = useStore((s) => s.highestUnlocked());
  const stars = useMemo(() => starsOf(progress), [progress]);
  const host = useRef<HTMLDivElement>(null); const hudRef = useRef<HTMLDivElement>(null); const playRef = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle | null>(null);
  // Odi rengi harita açıkken değişirse (takma ad sayfası haritanın üstünde açılır) kahraman yerinde yeniden boyanır
  const heroColor = useOdiLook().color;
  useEffect(() => { handle.current?.setHeroColor(heroColor); if (host.current) host.current.dataset.odiColor = heroColor.toString(16).padStart(6, '0'); }, [heroColor]);
  // geliştirme önizlemesi `?harita-kart=16`: haritanın ilk açılışında o bölümün kartı açık (ui-mobile-check bölüm kartı adımı; YN-162)
  const [card, setCard] = useState<MapCard | null>(() => (demoCard ? { kind: 'node', n: demoCard } : null));
  // yalnız test derlemesi: bölüm kartını aç (kamp-e2e çanta adımı); sıradaki düğümün ekrandaki yeri (YN-105 ölçümü)
  useEffect(() => { if (typeof __ODI_E2E__ === 'undefined' || !__ODI_E2E__) return; (window as unknown as { __harita?: unknown }).__harita = { card: (n: number) => setCard({ kind: 'node', n }), odak: () => handle.current?.currentRect() ?? null }; return () => { delete (window as unknown as { __harita?: unknown }).__harita; }; }, []);
  const [seq, setSeq] = useState(false); const [away, setAway] = useState<null | 'up' | 'down'>(null);
  const social = useMapSocial(); const socialRef = useRef(social); socialRef.current = social;
  const [stage, setStage] = useState(false);
  // dönüş sahnesi bitti (ya da oynanacak bir şey yok): Tüy Dede turu ancak o zaman başlar (ftue/Director.tsx quiet; YN-067)
  const [settled, setSettled] = useState(false);
  // haritanın bu açılıştan önce en son gösterdiği yıldızlar: önceki hedefe ulaşıldıysa "Sıradaki hedef" bunu bir kez söyler
  const [before, setBefore] = useState<StarMap | null>(null);
  // dönüş sahnesinin başladığı (haritada gösterilen) durum ve birikmiş kutlamalar: üç ve daha çok pencere açılacaksa sahne sürerken
  // biriktirilir, sahne bitince tek pencerede gösterilir (OT-sinav-adayi-17: 20-25 art arda → dört pencere peş peşe)
  const shownRef = useRef<StarMap>({}); const batch = useRef<RecapRow[] | null>(null); const batchCount = useRef({ t: 0, z: 0, eksik: 0, gun: 0, bekliyor: false, ns: [] as number[] });
  const goalRef = useRef<HTMLButtonElement>(null);
  /**
   * haritanın görünür alanı: üstte HUD, hedef kartı, Bugün/pusula ve Etkinlik düğmesinin altı; altta Bölüm düğmesinin üstü (CSS px).
   * Kamera sıradaki bölümü ve Odi'yi bu alanın ortasına getirir (OT-ogrenci-birinci-19: 30. düğüm Etkinlik ve hedef kartının altındaydı).
   */
  const measureInsets = () => {
    const vh = innerHeight; let top = hudRef.current?.getBoundingClientRect().bottom ?? 70;
    const tops = [goalRef.current, host.current?.parentElement?.querySelector('.map-side-l'), document.querySelector('.ev-fab')];
    // yolculuğun bitişinde hedef kutusu alttadır (YN-241): Ninni Merkezi kutunun üstündeki alanın ortasına gelir. Alttaki kutu (aşama
    // adımlarıyla 320 px'te Büyük yazıda ekranın ortasını geçebilir) üst pay sayılmaz
    const alt = !!goalRef.current?.matches('.final, .done.open, .buyuk-yazi .done');
    for (const el of tops) { if (alt && el === goalRef.current) continue; const r = el?.getBoundingClientRect(); if (r && r.height > 0 && r.top < vh / 2) top = Math.max(top, r.bottom); }
    let pb = playRef.current?.getBoundingClientRect().top ?? vh - 140;
    const g = goalRef.current?.getBoundingClientRect(); if (g && g.height > 0 && (alt || g.top >= vh / 2)) pb = Math.min(pb, g.top);
    return { top: top + 8, bottom: Math.max(90, vh - pb + 10) };
  };

  // ---- Phaser haritası (bir kez kurulur; kapanınca tamamen yok edilir)
  useEffect(() => {
    let dead = false; let h: MapHandle | null = null; let started = false;
    // Phaser haritası ayrı parça: kayıt okunurken birlikte yüklenir (çoğu zaman başlık ekranında önceden yüklenmiştir)
    void Promise.all([loadMapSeen(), loadMap()]).then(([, { startMap }]) => {
      if (dead || !host.current) return;
      const s = useStore.getState(); const now = starsOf(s.progress);
      const seenSt = useMapSeen.getState(); const seen = seenSt.init ? seenSt.stars : null;
      if (!seenSt.init) seenSt.commit(now);
      setBefore(seen); shownRef.current = seen ?? now;
      const look = odiLook(s);
      host.current.dataset.odiColor = look.color.toString(16).padStart(6, '0'); // test kancası: haritadaki Odi'nin rengi
      h = startMap(host.current, {
        stars: now, seen, treasuresOpen: s.meta.treasures, hero: { color: look.color, hat: look.hat }, social: socialRef.current,
        insets: measureInsets(), getInsets: measureInsets, reducedMotion: prefersReducedMotion(), ...fullMotion(),
        sfx: (x, o) => audio.play(x, o), haptic: (k) => platform().haptic(k),
        onNodeTap: (n) => setCard({ kind: 'node', n }), onTreasureTap: (n) => setCard({ kind: 'treasure', n }), onZoneTap: (z) => setCard({ kind: 'zone', z }),
        onTreasure: async (n) => {
          const h = hazineGorunum(n); const items = h.items;
          if (batch.current) { batch.current.push({ icon: '🎁', text: `Hazine · Bölüm ${n}`, items }); batchCount.current.t++; batchCount.current.eksik += h.eksik; batchCount.current.gun = Math.max(batchCount.current.gun, h.gun ?? 0); batchCount.current.bekliyor ||= h.bekliyor; batchCount.current.ns.push(n); return; }
          // pencere açıldığı anda görüldü (YN-201, OT-sinav-adayi-42): Tamam'a basılmadan ya da sahne bitmeden uygulama kapanırsa da
          // aynı hazine bir daha açılmaz (sahnenin sonundaki kayıt yenilemede hiç yazılmıyordu)
          useMapSeen.getState().markShown(n, starsOf(useStore.getState().progress)[n] ?? 1);
          // hazine bölüm bitince verildi ve sonuç ekranında sayıldı: burada yalnız gösterilir, sayaç yeniden saymaz. Not geçmiş zamanla
          // ve nerede verildiğini söyler (oturum arada kapandıysa da; "Cüzdanına eklendi" deyip cüzdan artmayınca sahte ödül sanıldı,
          // OT-uzman-odyolog-29)
          const live = canliNot(hazineBekliyor([n]), () => { const g = hazineGorunum(n, 'Cüzdanına eklendi'); return { note: g.note, items: g.items }; });
          await celebrate.chest({ title: `Hazine · Bölüm ${n}`, items, tier: items.some((i) => i.kind === 'kozmetik') ? 'altin' : n >= 20 ? 'gumus' : 'bronz', granted: true, note: h.note, live });
        },
        onZoneRise: async (z, _from, to) => {
          const ms = useMapSeen.getState(); if (to < 3 || ms.restored.includes(z)) return;
          ms.markRestored(z);
          if (z === 'finale') { celebrate.banner({ icon: '👑', title: 'Ninni beyne ulaştı!', body: 'Ninni Merkezi ışıl ışıl yandı.', tone: 'gold' }); return; }
          if (batch.current) { batch.current.push({ icon: '🌟', text: `${BIOMES[z].name} yeniden canlandı!` }); batchCount.current.z++; return; }
          await celebrate.biomeRestored({ biome: z, name: BIOMES[z].name });
        },
        onSequence: (p) => {
          setSeq(p === 'start'); setSettled(p === 'done');
          const cur = starsOf(useStore.getState().progress);
          if (p === 'start') { started = true; batch.current = returnCelebrations(shownRef.current, cur, useMapSeen.getState().restored) >= 3 ? [] : null; batchCount.current = { t: 0, z: 0, eksik: 0, gun: 0, bekliyor: false, ns: [] }; }
          if (p === 'done') { useMapSeen.getState().commit(cur); shownRef.current = cur; flushBatch(); }
        },
        onCurrentVisible: (v, d) => setAway(v ? null : d),
      });
      handle.current = h; setStage(true); if (!seen) setSettled(true);
    }, (e: unknown) => { if (!dead) { try { chunkFailed(e); } catch { /* yenileniyor */ } } });
    // sahne yarıda bırakılırsa (ör. hemen bölüme geçildi) bir dahaki açılışta tekrar oynamasın
    return () => { dead = true; if (started) useMapSeen.getState().commit(starsOf(useStore.getState().progress)); h?.destroy(); handle.current = null; };
  }, []);
  /**
   * sahne boyunca biriken kutlamalar: tek pencere ("Yolda kazandıkların: 2 hazine, 2 bölge canlandı"; her biri satır, sayı = satır).
   * Başlık "Yokluğunda" değil (OT-sinav-adayi-23): hazine ve canlanma oyuncunun kendi oynadığı bölümlerden gelir, uygulama kapalıyken
   * olan bir şey değildir.
   */
  const flushBatch = () => {
    const rows = batch.current; const { t, z, eksik, gun, bekliyor, ns } = batchCount.current; batch.current = null;
    if (!rows?.length) return;
    const sub = [t ? `${t} hazine` : '', z ? `${z} bölge canlandı` : ''].filter(Boolean).join(', ');
    // pencere kapanınca sıradaki bölüm yine görünür alanın ortasında (kart/düğmeler değişmiş olabilir)
    // hazine jetonu: sınır kestiyse bugün geçmeyen (karar 54: bekleyen ödülde, gun gün içinde), çevrimdışıysa "bağlanınca" (YN-200); satırlar hesaba geçeni gösterir
    const note = !t ? undefined : eksik > 0 ? sinirNotu(eksik, gun || undefined) : bekliyor ? 'Hazine jetonu bağlanınca cüzdanına eklenecek' : t > 1 ? 'Hazineler bölüm sonunda cüzdanına eklenmişti' : `Hazine ${HAZINE_VERILDI.toLocaleLowerCase('tr')}`;
    // pencere açıkken bekleyen jeton hesaba geçerse not güncellenir (YN-260 (3)); satırlar o anki hesaba geçeni gösterir
    const live = canliNot(hazineBekliyor(ns), () => {
      const hs = ns.map((n) => hazineGorunum(n)); const e = hs.reduce((a, h) => a + h.eksik, 0); const g = Math.max(0, ...hs.map((h) => h.gun ?? 0)); const d = ns.map(hazineDurum);
      return e > 0 ? sinirNotu(e, g || undefined) : d.some((x) => x.k === 'bekliyor' && !x.bagli) ? 'Hazine jetonu bağlanınca cüzdanına eklenecek'
        : d.some((x) => x.k === 'bekliyor') ? 'Hazine jetonu hesabına kaydediliyor' : t > 1 ? 'Hazine jetonları cüzdanına eklendi' : 'Hazine jetonu cüzdanına eklendi';
    });
    void celebrate.recap({ title: 'Yolda kazandıkların', sub, rows, note, live }).then(() => handle.current?.focusCurrent());
  };
  // ilerleme harita açıkken değişirse (ör. sunucu eşitlemesi) farkı oynat
  useEffect(() => { handle.current?.update(stars, meta.treasures); }, [stars, meta.treasures]);
  useEffect(() => { handle.current?.setSocial(social); }, [social]);

  // ---- HUD verileri
  const lp = levelProgress(xp);
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const coin = useHudCount('jeton', coins);
  const wallet = useNet((s) => s.wallet); const inbox = useNet((s) => s.inboxCount); const nav = useNav();
  const kristal = useHudCount('kristal', wallet?.kristal ?? 0);
  const today = dayKey(); const daily = ensureDaily(meta.daily, today);
  const cal = calendarView({ progress, coins, xp, streak, lastDay, failStreak: 0, skills: useStore.getState().skills, meta }, today);
  const calReady = lastDay === today && !cal.claimedToday; const doneQ = daily.quests.filter(questDone).length;
  const todayText = chestReady(daily) ? '🎁 Sandık hazır!' : calReady ? '📅 Ödül hazır' : `${doneQ}/3 görev`;
  const todayHot = chestReady(daily) || calReady;
  // tek hedef, ulaşılana kadar aynı (öncelik kuralı: map/goals.ts pickGoal)
  const goal = useMemo(() => mapGoal(stars, before), [stars, before]);
  // ulaşılan hedef okunacak kadar kalır; sonra gösterilen durum güncel sayılır (kutu yalnız sıradaki hedefi söyler)
  useEffect(() => {
    if (!settled || !goal.small) return;
    const h = setTimeout(() => setBefore(starsOf(useStore.getState().progress)), GOAL_REACHED_MS);
    return () => clearTimeout(h);
  }, [settled, goal.small]);
  // kesilen hedef metni dokununca tam açılır (tam genişlik, düğmelerin altında; OT-buyuk-yazi-18)
  const [openText, setOpenText] = useState<string | null>(null); const goalOpen = openText === goal.text;
  // sağ üstteki kısa karta sığmayan hedef kendiliğinden tam genişlikte, düğmelerin altında sarar: kesilmez (OT-sinav-adayi-24)
  const [wideText, setWideText] = useState<string | null>(null); const goalWide = wideText === goal.text;
  useLayoutEffect(() => {
    if (goalWide || goalOpen || goal.final) return;
    const t = goalRef.current?.querySelector('.mg-text'); if (t && t.scrollHeight > t.clientHeight + 1) setWideText(goal.text);
  }, [goal.text, goalWide, goalOpen]);
  // aşama adımları olan kutu tam genişlikte (adımlar sağ üstteki dar karta sığmaz; Etkinlik düğmesinin altında kalmaz)
  const goalFull = goalOpen || goalWide || !!goal.stage;
  const onGoal = (b: HTMLElement) => {
    const t = b.querySelector('.mg-text');
    if (!goalWide && !goal.stage && !goal.final && (goalOpen || (t && t.scrollHeight > t.clientHeight + 1))) { setOpenText(goalOpen ? null : goal.text); return; }
    // yıldız hedefi uzaktaki bölgeyi söyler: dokununca o bölümün kartı (Tekrar oyna), sürüklemeden (YN-260, OT-uzman-odyolog-47)
    if (goal.go) { setCard({ kind: 'node', n: goal.go }); return; }
    handle.current?.focusCurrent();
  };
  // büyük düğme: yolculuk bitince yıldız hedefinin bölümü (yoksa açık son bölüm)
  const playN = goal.go ?? unlocked;
  const done = (progress[HUMAN_JOURNEY.levels.length]?.stars ?? 0) > 0;
  const feat = useFeatures();
  // Tüy Dede'nin "Yeni yer açıldı" kartı (yeri gösterilmeyen rozet) ekranın üst ortasında: kutu o sürece gizli, kart yazısının
  // arkasında ikinci bir haber kalmaz (OT-sessiz-oyuncu-20); kart kapanınca kutu yerinde
  const unlockCard = useCoach((s) => { const st = s.tour?.steps[s.step]; return !!st?.art && !st.target; });

  return (
    <div className="map-screen" data-donus={settled ? 'bitti' : 'suruyor'} onPointerDown={() => { audio.unlock(); if (seq) handle.current?.skip(); }}>
      <div className="map-stage" ref={host} aria-label="Yolculuk haritası" role="img" />
      {!stage && <EngineLoading inStage />}
      <MapFrame />
      <div className="map-hud" ref={hudRef}>
        <div className="mh-lvl" title={`Seviye ${lp.level}`} style={{ ['--p' as string]: `${Math.round(lp.pct * 100)}%` }}><b>{lp.level}</b><span>Sv</span></div>
        <StatusDot />
        <span className="mh-pill" aria-label={`${totalStars} yıldız`}><Art name="star" size={18} />{totalStars}</span>
        <span className="grow" />
        <span className="mh-pill gold" data-hud="jeton" key={`j${coin.bump}`} aria-label={`${fmtNum(coin.value)} jeton`}><Art name="coin" size={18} /><HudNum v={coin.value} /></span>
        {wallet && feat.open('shop') && <button className="mh-pill tap" data-hud="kristal" onClick={() => nav.open({ name: 'shop' })} aria-label="Kristal ve mağaza"><Art name="crystal" size={18} /><HudNum v={kristal.value} /></button>}
        {wallet && feat.open('shop') && <button className="mh-pill tap env" onClick={() => nav.open({ name: 'inbox' })} aria-label={`Ödül kutusu: ${inbox} ödül`}><Art name="mail" size={20} />{inbox > 0 && <span className="dot">{inbox > 99 ? '99+' : inbox}</span>}</button>}
      </div>
      <div className="map-side-l">
        {feat.open('today') && <button className={`map-today${todayHot ? ' hot' : ''}`} onClick={onToday} aria-label="Bugün: görevler ve takvim">
          <span className="mt-ic"><Art name="sun" size={26} /></span><span className="mt-t"><b>Bugün</b><small><Rich text={todayText} /></small></span>
        </button>}
        <Compass tilt={away === 'up' ? -14 : away === 'down' ? 14 : 0} />
      </div>
      {feat.cleared >= 1 || feat.open('today') ? <button className={`map-goal${goal.final ? ' final' : goalFull ? ' open' : ''}${done ? ' done' : ''}`} key={goal.text} ref={goalRef} data-ulasildi={goal.small ? '1' : undefined} data-git={goal.go} style={unlockCard ? { visibility: 'hidden' } : undefined} onClick={(e) => onGoal(e.currentTarget)} aria-label={goalLabel(goal)}>
        <span className="mg-head"><small>{goal.small ?? 'Sıradaki hedef'}</small>{goal.stage && <Stages at={goal.stage.at} />}</span>
        <span className="mg-text"><Glyph e={goal.icon} size="1.15em" /> <Rich text={goal.text} /></span>
        {goal.go && <span className="mg-go" data-testid="hedef-git">Bölüm {goal.go}{bolumeEk(goal.go)} git <Icon name="play" size="0.85em" className="ic-inline" /></span>}
      </button> : null}
      {away && !seq && <button className={`map-back ${away}`} onClick={() => handle.current?.focusCurrent()} aria-label="Odi'ye dön">{away === 'up' ? '▲' : '▼'} Odi</button>}
      {/* dönüş sahnesi sürerken ekranın her yerine (hedef kutusu, HUD dahil) dokunuş sahneyi sonuna atlatır (YN-149) */}
      {seq && <div className="map-skip" aria-live="polite">Dokun: atla <Art name="booster" size="1.15em" className="art-inline" /></div>}
      <div className="map-play-wrap" ref={playRef}>
        <button className="map-play shine" onClick={() => onPlay(playN)}>{done && <Art name="crown" size="1.1em" className="art-inline" />}Bölüm {playN} <Icon name="play" size="0.9em" className="ic-inline" /></button>
      </div>
      <MapCards card={card} stars={stars} unlocked={unlocked} onClose={() => { demoCard = 0; setCard(null); }} onPlay={onPlay} />
    </div>
  );
}

const STAGES: Vitality[] = [1, 2, 3, 4];
/** kutunun okunan adı: aşama sırası ve gidilecek bölüm de söylenir */
function goalLabel(g: Goal): string {
  const st = g.stage ? ` Aşamalar: ${STAGES.map((v) => `${stageLabel(v, g.stage!.at)}${v === g.stage!.at ? ' (şimdi)' : ''}`).join(', ')}.` : '';
  return `${g.small ?? 'Sıradaki hedef'}: ${g.text}${st}${g.go ? ` Dokun: Bölüm ${g.go} kartı.` : ''}`;
}
/**
 * bölgenin dört aşaması kısaca (YN-260 (2), OT-ilk-kez-oyun-76: "çiçeklendi" ile "canlanır" farkı belirsizdi): ulaşılanlar geçmiş
 * zamanla ve dolu nokta, bulunulan aşama kalın ve elmas, sıradakiler gelecek zamanla ve boş halka (yazı + şekil; renk tek ayırt edici değil)
 */
function Stages({ at }: { at: Vitality }) {
  return (
    <span className="mg-steps" data-testid="hedef-asama" data-asama={at} aria-hidden>
      {STAGES.map((v) => <span key={v} className={v < at ? 'ok' : v === at ? 'cur' : 'next'}><i />{stageLabel(v, at)}</span>)}
    </span>
  );
}

/** Sosyal katman: arkadaşların en yüksek bölümleri ve takımın savaş bölgeleri (gerçek veri; sunucu yoksa null) */
function useMapSocial(): MapSocial | null {
  const status = useNet((s) => s.status); const war = useNet((s) => s.war); const team = useNet((s) => s.team); const enabled = useSocial((s) => s.enabled);
  const [friends, setFriends] = useState<PublicProfile[] | null>(null);
  useEffect(() => {
    if (status !== 'bağlı') return; const c = getNet(); if (!c) return; let dead = false;
    c.call('friends.list', {}).then((r) => { if (!dead) setFriends(r.friends); }, () => undefined);
    return () => { dead = true; };
  }, [status]);
  return useMemo(() => {
    if (!enabled || status !== 'bağlı') return null;
    const marks: MapSocial['war'] = [];
    if (war && team) {
      for (const r of war.regions) {
        const owned = r.owner?.teamId === team.id; const target = war.targets.includes(r.id);
        if (!owned && !target) continue;
        const def = WAR_REGIONS.find((x) => x.id === r.id);
        const zone: ZoneId = r.id === 'merkez' ? 'finale' : ((def?.biomes[0] ?? r.biomes[0] ?? 'dis-kulak') as ZoneId);
        marks.push({ regionId: r.id, name: r.name, zone, emblem: team.emblem, emblemSvg: artSvg(emblemArt(team.emblem), 48), owned, target });
      }
    }
    return { friends: (friends ?? []).map((f) => ({ id: f.id, name: f.name, color: f.color, highest: f.highest })), war: marks, teamColor: 0xff5c8a };
  }, [enabled, status, war, team, friends]);
}
