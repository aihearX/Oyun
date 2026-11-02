import { useEffect, useMemo, useRef, useState } from 'react';
import { BIOMES, HUMAN_JOURNEY } from '@odi/content';
import { calendarView, chestReady, dayKey, ensureDaily, levelProgress, questDone } from '@odi/meta';
import { odiLook, useOdiLook } from '../look';
import { WAR_REGIONS, type PublicProfile } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { audio } from '@odi/audio';
import type { MapHandle, MapSocial, StarMap, ZoneId } from '@odi/game-core/lite';
import { chunkFailed, loadMap } from '../engine';
import { EngineLoading } from '../ui/Loading';
import { useStore } from '../store';
import { getNet, useSocial } from '../net';
import { useNav } from '../nav';
import { platform } from '../platform';
import { HudNum, StatusDot, fmtNum } from '../ui/social';
import { prefersReducedMotion } from '../ui/bits';
import { celebrate, type RecapRow } from '../celebrate';
import { useHudCount } from '../celebrate/hud';
import { loadMapSeen, starsOf, useMapSeen } from '../map/mapSeen';
import { mapGoal, returnCelebrations, treasureItems } from '../map/goals';
import { MapCards, type MapCard } from '../map/MapCards';
import { Compass, MapFrame } from '../map/MapChrome';
import { Art, Glyph, Rich, artSvg, emblemArt } from '../ui/art';
import { useFeatures } from '../ftue/useFeatures';
import { Icon } from '../ui/icons';
import '../map/map.css';
declare const __ODI_E2E__: boolean | undefined;

/** `?harita=tam`: test tarayıcısında da tam animasyonlu harita (ekran görüntüleri için; varsayılan davranışı değiştirmez) */
const fullMotion = (): { light?: boolean } => { try { return new URLSearchParams(location.search).get('harita') === 'tam' ? { light: false } : {}; } catch { return {}; } };

/**
 * Yaşayan Kulak Haritası: tam ekran Phaser haritası + React katmanı (cam HUD, Bugün çipi, sıradaki hedef rozeti,
 * pusula, büyük "Bölüm N ▶" düğmesi, bölüm/hazine/bölge kartları). Bölümden dönünce dönüş sahnesi oynar.
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
  const [card, setCard] = useState<MapCard | null>(null);
  // yalnız test derlemesi: bölüm kartını aç (kamp-e2e çanta adımı)
  useEffect(() => { if (typeof __ODI_E2E__ === 'undefined' || !__ODI_E2E__) return; (window as unknown as { __harita?: unknown }).__harita = { card: (n: number) => setCard({ kind: 'node', n }) }; return () => { delete (window as unknown as { __harita?: unknown }).__harita; }; }, []);
  const [seq, setSeq] = useState(false); const [away, setAway] = useState<null | 'up' | 'down'>(null);
  const social = useMapSocial(); const socialRef = useRef(social); socialRef.current = social;
  const [stage, setStage] = useState(false);
  // dönüş sahnesi bitti (ya da oynanacak bir şey yok): Tüy Dede turu ancak o zaman başlar (ftue/Director.tsx quiet; YN-067)
  const [settled, setSettled] = useState(false);
  // haritanın bu açılıştan önce en son gösterdiği yıldızlar: önceki hedefe ulaşıldıysa "Sıradaki hedef" bunu bir kez söyler
  const [before, setBefore] = useState<StarMap | null>(null);
  // dönüş sahnesinin başladığı (haritada gösterilen) durum ve birikmiş kutlamalar: üç ve daha çok pencere açılacaksa sahne sürerken
  // biriktirilir, sahne bitince tek pencerede gösterilir (OT-sinav-adayi-17: 20-25 art arda → dört pencere peş peşe)
  const shownRef = useRef<StarMap>({}); const batch = useRef<RecapRow[] | null>(null); const batchCount = useRef({ t: 0, z: 0 });

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
      const hb = hudRef.current?.getBoundingClientRect().bottom ?? 70; const pb = playRef.current?.getBoundingClientRect().top ?? innerHeight - 140;
      h = startMap(host.current, {
        stars: now, seen, treasuresOpen: s.meta.treasures, hero: { color: look.color, hat: look.hat }, social: socialRef.current,
        insets: { top: hb + 8, bottom: Math.max(90, innerHeight - pb + 10) }, reducedMotion: prefersReducedMotion(), ...fullMotion(),
        sfx: (x, o) => audio.play(x, o), haptic: (k) => platform().haptic(k),
        onNodeTap: (n) => setCard({ kind: 'node', n }), onTreasureTap: (n) => setCard({ kind: 'treasure', n }), onZoneTap: (z) => setCard({ kind: 'zone', z }),
        onTreasure: async (n) => {
          const items = treasureItems(useStore.getState().meta, n);
          if (batch.current) { batch.current.push({ icon: '🎁', text: `Hazine · Bölüm ${n}`, items }); batchCount.current.t++; return; }
          // hazine bölüm bitince verildi ve sonuç ekranında sayıldı: burada yalnız gösterilir, sayaç yeniden saymaz
          await celebrate.chest({ title: `Hazine · Bölüm ${n}`, items, tier: items.some((i) => i.kind === 'kozmetik') ? 'altin' : n >= 20 ? 'gumus' : 'bronz', granted: true });
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
          if (p === 'start') { started = true; batch.current = returnCelebrations(shownRef.current, cur, useMapSeen.getState().restored) >= 3 ? [] : null; batchCount.current = { t: 0, z: 0 }; }
          if (p === 'done') { useMapSeen.getState().commit(cur); shownRef.current = cur; flushBatch(); }
        },
        onCurrentVisible: (v, d) => setAway(v ? null : d),
      });
      handle.current = h; setStage(true); if (!seen) setSettled(true);
    }, (e: unknown) => { if (!dead) { try { chunkFailed(e); } catch { /* yenileniyor */ } } });
    // sahne yarıda bırakılırsa (ör. hemen bölüme geçildi) bir dahaki açılışta tekrar oynamasın
    return () => { dead = true; if (started) useMapSeen.getState().commit(starsOf(useStore.getState().progress)); h?.destroy(); handle.current = null; };
  }, []);
  /** sahne boyunca biriken kutlamalar: tek pencere ("Yokluğunda: 2 hazine, 2 bölge canlandı"; her biri satır) */
  const flushBatch = () => {
    const rows = batch.current; const { t, z } = batchCount.current; batch.current = null;
    if (!rows?.length) return;
    const sub = [t ? `${t} hazine` : '', z ? `${z} bölge canlandı` : ''].filter(Boolean).join(', ');
    void celebrate.recap({ title: 'Yokluğunda', sub, rows, note: t ? (t > 1 ? 'Hazineler cüzdanına eklendi' : 'Hazine cüzdanına eklendi') : undefined });
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
  // kesilen hedef metni dokununca tam açılır (tam genişlik, düğmelerin altında; OT-buyuk-yazi-18)
  const [goalOpen, setGoalOpen] = useState(false);
  useEffect(() => setGoalOpen(false), [goal.text]);
  const onGoal = (b: HTMLElement) => {
    const t = b.querySelector('span');
    if (goalOpen || (t && t.scrollHeight > t.clientHeight + 1)) { setGoalOpen(!goalOpen); return; }
    handle.current?.focusCurrent();
  };
  const done = (progress[HUMAN_JOURNEY.levels.length]?.stars ?? 0) > 0;
  const feat = useFeatures();

  return (
    <div className="map-screen" data-donus={settled ? 'bitti' : 'suruyor'} onPointerDown={() => audio.unlock()}>
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
      {feat.cleared >= 1 || feat.open('today') ? <button className={`map-goal${goalOpen ? ' open' : ''}`} key={goal.text} onClick={(e) => onGoal(e.currentTarget)} aria-label={`${goal.small ?? 'Sıradaki hedef'}: ${goal.text}`}>
        <small>{goal.small ?? 'Sıradaki hedef'}</small><span><Glyph e={goal.icon} size="1.15em" /> <Rich text={goal.text} /></span>
      </button> : null}
      {away && !seq && <button className={`map-back ${away}`} onClick={() => handle.current?.focusCurrent()} aria-label="Odi'ye dön">{away === 'up' ? '▲' : '▼'} Odi</button>}
      {seq && <div className="map-skip" aria-live="polite">Dokun: hızlandır <Art name="booster" size="1.15em" className="art-inline" /></div>}
      <div className="map-play-wrap" ref={playRef}>
        <button className="map-play shine" onClick={() => onPlay(unlocked)}>{done && <Art name="crown" size="1.1em" className="art-inline" />}Bölüm {unlocked} <Icon name="play" size="0.9em" className="ic-inline" /></button>
      </div>
      <MapCards card={card} stars={stars} unlocked={unlocked} onClose={() => setCard(null)} onPlay={onPlay} />
    </div>
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
