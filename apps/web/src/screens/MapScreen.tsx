import { useEffect, useMemo, useRef, useState } from 'react';
import { BIOMES, HUMAN_JOURNEY } from '@odi/content';
import { calendarView, chestReady, dayKey, ensureDaily, levelProgress, questDone, resolveLook } from '@odi/meta';
import { WAR_REGIONS, type PublicProfile } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { audio } from '@odi/audio';
import { startMap, type MapHandle, type MapSocial, type ZoneId } from '@odi/game-core';
import { useStore } from '../store';
import { getNet, useSocial } from '../net';
import { useNav } from '../nav';
import { platform } from '../platform';
import { StatusDot } from '../ui/social';
import { prefersReducedMotion } from '../ui/bits';
import { celebrate } from '../celebrate';
import { useHudCount } from '../celebrate/hud';
import { loadMapSeen, starsOf, useMapSeen } from '../map/mapSeen';
import { mapGoals, treasureItems } from '../map/goals';
import { MapCards, type MapCard } from '../map/MapCards';
import { Compass, MapFrame } from '../map/MapChrome';
import { Art, Glyph, Rich } from '../ui/art';
import { useFeatures } from '../ftue/useFeatures';
import { Icon } from '../ui/icons';
import '../map/map.css';

/** `?harita=tam`: test tarayıcısında da tam animasyonlu harita (ekran görüntüleri için; varsayılan davranışı değiştirmez) */
const fullMotion = (): { light?: boolean } => { try { return new URLSearchParams(location.search).get('harita') === 'tam' ? { light: false } : {}; } catch { return {}; } };
const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}B` : n.toLocaleString('tr-TR'));

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
  const [card, setCard] = useState<MapCard | null>(null);
  const [seq, setSeq] = useState(false); const [away, setAway] = useState<null | 'up' | 'down'>(null);
  const social = useMapSocial(); const socialRef = useRef(social); socialRef.current = social;

  // ---- Phaser haritası (bir kez kurulur; kapanınca tamamen yok edilir)
  useEffect(() => {
    let dead = false; let h: MapHandle | null = null; let started = false;
    void loadMapSeen().then(() => {
      if (dead || !host.current) return;
      const s = useStore.getState(); const now = starsOf(s.progress);
      const seenSt = useMapSeen.getState(); const seen = seenSt.init ? seenSt.stars : null;
      if (!seenSt.init) seenSt.commit(now);
      const look = resolveLook(s.meta);
      const hb = hudRef.current?.getBoundingClientRect().bottom ?? 70; const pb = playRef.current?.getBoundingClientRect().top ?? innerHeight - 140;
      h = startMap(host.current, {
        stars: now, seen, treasuresOpen: s.meta.treasures, hero: { color: look.color, hat: look.hat }, social: socialRef.current,
        insets: { top: hb + 8, bottom: Math.max(90, innerHeight - pb + 10) }, reducedMotion: prefersReducedMotion(), ...fullMotion(),
        sfx: (x, o) => audio.play(x, o), haptic: (k) => platform().haptic(k),
        onNodeTap: (n) => setCard({ kind: 'node', n }), onTreasureTap: (n) => setCard({ kind: 'treasure', n }), onZoneTap: (z) => setCard({ kind: 'zone', z }),
        onTreasure: async (n) => {
          const items = treasureItems(useStore.getState().meta, n);
          await celebrate.chest({ title: `Hazine · Bölüm ${n}`, items, tier: items.some((i) => i.kind === 'kozmetik') ? 'altin' : n >= 20 ? 'gumus' : 'bronz' });
        },
        onZoneRise: async (z, _from, to) => {
          const ms = useMapSeen.getState(); if (to < 3 || ms.restored.includes(z)) return;
          ms.markRestored(z);
          if (z === 'finale') { celebrate.banner({ icon: '👑', title: 'Ninni beyne ulaştı!', body: 'Ninni Merkezi ışıl ışıl yandı.', tone: 'gold' }); return; }
          await celebrate.biomeRestored({ biome: z, name: BIOMES[z].name });
        },
        onSequence: (p) => { setSeq(p === 'start'); if (p === 'start') started = true; if (p === 'done') useMapSeen.getState().commit(starsOf(useStore.getState().progress)); },
        onCurrentVisible: (v, d) => setAway(v ? null : d),
      });
      handle.current = h;
    });
    // sahne yarıda bırakılırsa (ör. hemen bölüme geçildi) bir dahaki açılışta tekrar oynamasın
    return () => { dead = true; if (started) useMapSeen.getState().commit(starsOf(useStore.getState().progress)); h?.destroy(); handle.current = null; };
  }, []);
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
  const goals = useMemo(() => mapGoals(stars, progress, unlocked, meta.treasures), [stars, progress, unlocked, meta.treasures]);
  const [gi, setGi] = useState(0);
  useEffect(() => { const t = setInterval(() => setGi((i) => i + 1), 4800); return () => clearInterval(t); }, []);
  const goal = goals[gi % goals.length]!;
  const done = (progress[HUMAN_JOURNEY.levels.length]?.stars ?? 0) > 0;
  const feat = useFeatures();

  return (
    <div className="map-screen" onPointerDown={() => audio.unlock()}>
      <div className="map-stage" ref={host} aria-label="Yolculuk haritası" role="img" />
      <MapFrame />
      <div className="map-hud" ref={hudRef}>
        <div className="mh-lvl" title={`Seviye ${lp.level}`} style={{ ['--p' as string]: `${Math.round(lp.pct * 100)}%` }}><b>{lp.level}</b><span>Sv</span></div>
        <StatusDot />
        <span className="mh-pill" aria-label={`${totalStars} yıldız`}><Art name="star" size={18} />{totalStars}</span>
        <span className="grow" />
        <span className="mh-pill gold" data-hud="jeton" key={`j${coin.bump}`} aria-label={`${coin.value} jeton`}><Art name="coin" size={18} />{fmt(coin.value)}</span>
        {wallet && feat.open('shop') && <button className="mh-pill tap" data-hud="kristal" onClick={() => nav.open({ name: 'shop' })} aria-label="Kristal ve mağaza"><Art name="crystal" size={18} />{fmt(kristal.value)}</button>}
        {wallet && feat.open('shop') && <button className="mh-pill tap env" onClick={() => nav.open({ name: 'inbox' })} aria-label={`Ödül kutusu: ${inbox} ödül`}><Art name="mail" size={20} />{inbox > 0 && <span className="dot">{inbox > 99 ? '99+' : inbox}</span>}</button>}
      </div>
      <div className="map-side-l">
        {feat.open('today') && <button className={`map-today${todayHot ? ' hot' : ''}`} onClick={onToday} aria-label="Bugün: görevler ve takvim">
          <span className="mt-ic"><Art name="sun" size={26} /></span><span className="mt-t"><b>Bugün</b><small><Rich text={todayText} /></small></span>
        </button>}
        <Compass tilt={away === 'up' ? -14 : away === 'down' ? 14 : 0} />
      </div>
      {feat.cleared >= 1 || feat.open('today') ? <button className="map-goal" key={gi % goals.length} onClick={() => handle.current?.focusCurrent()} aria-label={`Sıradaki hedef: ${goal.text}`}>
        <small>Sıradaki hedef</small><span><Glyph e={goal.icon} size="1.15em" /> <Rich text={goal.text} /></span>
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
        marks.push({ regionId: r.id, name: r.name, zone, emblem: team.emblem, owned, target });
      }
    }
    return { friends: (friends ?? []).map((f) => ({ id: f.id, name: f.name, color: f.color, highest: f.highest })), war: marks, teamColor: 0xff5c8a };
  }, [enabled, status, war, team, friends]);
}
