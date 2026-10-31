import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { platformStorage, setHaptics as setPlatformHaptics } from './platform';
import { FRESH_FTUE, normalizeFtue, type FtueState } from './ftue/features';
import type { LevelSpec, PlayerSkills, RunResult } from '@odi/shared';
import { levelFromXp } from '@odi/shared';
import { DEFAULT_SKILLS, SKILL_TREE, HUMAN_JOURNEY, BIOMES, TIER_NAMES, achievementById, cardById, cosmeticById, type Reward, type RewardItem } from '@odi/content';
import {
  advanceStreak, applyGrant, claimCalendar, claimQuest, dayKey, defaultMeta, ensureDaily, equipCosmetic, highestUnlocked, migrateMeta,
  openDailyChest, processRun, recordShare, settle, type MetaEvent, type MetaState, type PlayerCore, type RunSummary, type StreakEvent,
} from '@odi/meta';

export interface LevelProgress { stars: number; best: number; plays: number; lastResult?: RunResult }
/** Üstte kısa kutlama bildirimi (kalıcı değil) */
export interface Toast { id: number; icon: string; title: string; text?: string; tone?: 'gold' | 'silver' | 'bronze' | 'accent' | 'green' | 'coral' }

interface State extends PlayerCore {
  journey: string; progress: Record<number, LevelProgress>; sounds: boolean; recentStars: number[];
  /** ses düzeyleri (0-1): müzik, efekt ve anlatıcı (Tüy Dede) ayrı; kalıcı */
  musicVol: number; sfxVol: number; voiceVol: number;
  setVolumes(v: { musicVol?: number; sfxVol?: number; voiceVol?: number }): void;
  toasts: Toast[];
  /** gün sayacı: ardışık günlerde açılışta artar; kaçırılan gün seri koruyucuyla korunur; suçlama yok */
  touchDay(): StreakEvent;
  highestUnlocked(): number;
  /** bölüm sonucu: ilerleme + sayaçlar + görevler + açılımlar; tüm ödüller grant'tan geçer */
  completeRun(spec: LevelSpec, r: RunResult): RunSummary;
  /** TEK ödül kapısı: tüm yerel ödüller buradan geçer (ileride sunucu cüzdanıyla eşitlenecek) */
  grant(reward: Reward, reason: string): RewardItem[];
  claimQuest(id: string): RewardItem[] | null;
  openChest(): RewardItem[] | null;
  claimCalendar(): RewardItem[] | null;
  recordShare(): void;
  equip(id: string): void;
  /** Odi'nin rengi (tek kaynak): takma ad sayfasında seçilen ya da Dolap'ta açıkça giyilen renk; null = Dolap varsayılanı */
  odiColor: number | null;
  /** takma ad sayfasında seçilen renk (Dolap'ta "Kendi rengin" olarak kalır) */
  chosenColor: number | null;
  setOdiColor(color: number, chosen?: boolean): void;
  markBiomeSeen(biome: string): void;
  dismissToast(id: number): void;
  buySkill(id: string): boolean;
  /** takım/ödül kutusundan gelen kalkanlar: bir sonraki bölüme kalkanla başlatır */
  teamShields: number;
  consumeTeamShield(): boolean;
  /** sunucudan gelen kozmetik/kart/kalkanları yerel meta'ya işler (jetonsuz) */
  applyServerMeta(p: { cosmetics: string[]; cards: string[]; teamShields: number }): void;
  setSounds(v: boolean): void;
  reset(): void;
  playerLevel(): number;
  /** ilk deneyim (FTUE): hikâye, anlatıcı turları; anlatıcı sesi ayarı */
  ftue: FtueState; narratorVoice: boolean;
  /** Bilgi düzeyi (Ayarlar): 'odyoloji' öğrenci düzeyini öne çıkarır (Tüy Dede notlarında teknik ayrıntı açık, quizde öğrenci soruları) */
  knowledge: 'genel' | 'odyoloji';
  /** Bilgi düzeyi sorusu (takma ad kartında, karar 31) bir kez soruldu ya da oyuncu Ayarlar'dan seçti: bir daha sorulmaz */
  knowledgeAsked: boolean;
  /** gösterilen Tüy Dede notları ve son gösterim (sıklık sınırı) */
  notesSeen: string[]; noteAt: number;
  ftueStoryDone(): void;
  ftueTourDone(id: string): void;
  ftueBypass(): void;
  setNarratorVoice(v: boolean): void;
  setKnowledge(v: 'genel' | 'odyoloji'): void;
  knowledgeAskedDone(): void;
  /** Büyük yazı (Ayarlar, erişilebilirlik): kök yazı ölçeği 1,15 (html.buyuk-yazi); kalıcı */
  bigText: boolean;
  setBigText(v: boolean): void;
  /** Titreşim (Ayarlar): kapalıysa platform().haptic hiç titretmez (zıplama, hasar, kontrol noktası, ödül); kalıcı, varsayılan açık */
  haptics: boolean;
  setHaptics(v: boolean): void;
  /** Hareketi azalt (Ayarlar): sistem tercihine ek, oyun içinden açılır (prefersReducedMotion ikisini de okur; html.az-hareket); kalıcı */
  reduceMotion: boolean;
  setReduceMotion(v: boolean): void;
  noteShown(id: string): void;
}

const core = (s: State): PlayerCore => ({ progress: s.progress, coins: s.coins, xp: s.xp, streak: s.streak, lastDay: s.lastDay, failStreak: s.failStreak, skills: s.skills, meta: s.meta });
const pick = (c: PlayerCore) => ({ progress: c.progress, coins: c.coins, xp: c.xp, streak: c.streak, lastDay: c.lastDay, failStreak: c.failStreak, skills: c.skills, meta: c.meta });

let toastSeq = 1;
export function toastsFor(events: MetaEvent[]): Toast[] {
  const out: Toast[] = [];
  for (const e of events) {
    if (e.kind === 'achievement') { const a = achievementById(e.id); if (a) out.push({ id: toastSeq++, icon: a.emoji, title: `${a.name} · ${TIER_NAMES[e.tier]}`, text: 'Başarım açıldı!', tone: e.tier === 3 ? 'gold' : e.tier === 2 ? 'silver' : 'bronze' }); }
    else if (e.kind === 'cosmetic') { const c = cosmeticById(e.id); if (c && c.unlock.by !== 'default') out.push({ id: toastSeq++, icon: '🎩', title: `Dolaba yeni: ${c.name}`, tone: 'accent' }); }
    else if (e.kind === 'card') { const c = cardById(e.id); if (c) out.push({ id: toastSeq++, icon: '🃏', title: `Yeni Kulak Kartı: ${c.title}`, tone: 'green' }); }
    else if (e.kind === 'albumBadge') out.push({ id: toastSeq++, icon: '🏅', title: `${BIOMES[e.biome].name} albümü tamam!`, text: 'Biyom rozeti kazandın', tone: 'gold' });
  }
  // aynı anda çok açılım: ilk 3'ü göster, kalanı tek satır
  if (out.length > 3) { const rest = out.length - 2; return [...out.slice(0, 2), { id: toastSeq++, icon: '✨', title: `+${rest} yeni açılım daha`, text: 'Profilde hepsi seni bekliyor', tone: 'accent' }]; }
  return out;
}
function streakToast(e: StreakEvent): Toast | null {
  if (e.kind === 'saved') return { id: toastSeq++, icon: '🛡️', title: 'Seri koruyucu devrede!', text: `${e.used} günlük ara kapandı; serin ${e.streak}. günde.`, tone: 'accent' };
  if (e.kind === 'reset' && e.previous > 1) return { id: toastSeq++, icon: '🌱', title: 'Yeni bir seri başlıyor', text: 'Kulakların hoş geldin! Bugün 1. gün.', tone: 'green' };
  if (e.kind === 'continued' && e.streak > 1) return { id: toastSeq++, icon: '🔥', title: `${e.streak}. gün!`, text: 'Takvimde bugünün ödülü hazır.', tone: 'accent' };
  return null;
}

const INITIAL = { teamShields: 0, journey: HUMAN_JOURNEY.id, progress: {} as Record<number, LevelProgress>, coins: 0, xp: 0, skills: { ...DEFAULT_SKILLS } as PlayerSkills, sounds: true, musicVol: 0.6, sfxVol: 0.9, voiceVol: 0.9, failStreak: 0, recentStars: [] as number[], streak: 0, lastDay: '', meta: defaultMeta(), ftue: { ...FRESH_FTUE } as FtueState, narratorVoice: true, knowledge: 'genel' as 'genel' | 'odyoloji', knowledgeAsked: false, notesSeen: [] as string[], noteAt: 0, bigText: false, haptics: true, reduceMotion: false, odiColor: null as number | null, chosenColor: null as number | null };

export const useStore = create<State>()(persist((set, get) => {
  /** ödül/sayaç değişiminden sonra: başarım, kart, kozmetik açılımlarını yerleştir ve kutla */
  const settleAndToast = (c: PlayerCore, extra: Toast[] = []) => { const s = settle(c); set({ ...pick(s.core), toasts: [...get().toasts, ...extra, ...toastsFor(s.events)] }); };
  const ensureToday = () => { const today = dayKey(); if (get().lastDay !== today) get().touchDay(); return today; };
  return {
    ...INITIAL, toasts: [],
    touchDay() {
      const today = dayKey(); const s = get();
      const { core: c, event } = advanceStreak(core(s), today);
      if (event.kind === 'same') return event;
      const daily = ensureDaily(c.meta.daily, today);
      const t = streakToast(event);
      settleAndToast({ ...c, meta: { ...c.meta, daily } }, t ? [t] : []);
      return event;
    },
    // yönetici modu (Kod Gir, sunucu doğruladı): tüm bölümler oynanabilir; yıldız/ilerleme gerçek kalır
    highestUnlocked() { return get().ftue.admin ? HUMAN_JOURNEY.levels.length : highestUnlocked(get().progress, HUMAN_JOURNEY.levels.length); },
    completeRun(spec, r) {
      const today = ensureToday(); const s = get();
      const { core: c, summary } = processRun(core(s), spec, r, today);
      set({ ...pick(c), recentStars: [...s.recentStars, r.stars].slice(-5), toasts: [...s.toasts, ...toastsFor(summary.events.filter((e) => e.kind === 'achievement' || e.kind === 'albumBadge'))] });
      return summary;
    },
    grant(reward, reason) {
      const g = applyGrant(core(get()), reward, reason); settleAndToast(g.core); return g.applied;
    },
    claimQuest(id) {
      const today = ensureToday(); const r = claimQuest(core(get()), id, today); if (!r) return null; settleAndToast(r.core); return r.applied;
    },
    openChest() {
      const today = ensureToday(); const r = openDailyChest(core(get()), today); if (!r) return null; settleAndToast(r.core); return r.applied;
    },
    claimCalendar() {
      const today = ensureToday(); const r = claimCalendar(core(get()), today); if (!r) return null; settleAndToast(r.core); return r.applied;
    },
    recordShare() { const today = ensureToday(); const r = recordShare(core(get()), today); settleAndToast(r.core); },
    // Dolap'ta bir rengi açıkça giymek Odi'nin rengini de değiştirir (tek kaynak: odiColor); şapka rengi değiştirmez
    equip(id) { const def = cosmeticById(id); const meta = equipCosmetic(get().meta, id); set({ meta, ...(def?.kind === 'renk' && meta.cosmetics.color === id && def.color != null ? { odiColor: def.color } : {}) }); },
    setOdiColor(color, chosen) { if (!Number.isInteger(color) || color < 0 || color > 0xffffff) return; set({ odiColor: color, ...(chosen ? { chosenColor: color } : {}) }); },
    markBiomeSeen(biome) { const m = get().meta; if (!m.seenBiomes.includes(biome)) set({ meta: { ...m, seenBiomes: [...m.seenBiomes, biome] } }); },
    dismissToast(id) { set({ toasts: get().toasts.filter((t) => t.id !== id) }); },
    buySkill(id) {
      const node = SKILL_TREE.find((n) => n.id === id); if (!node) return false;
      const s = get(); if (s.coins < node.cost) return false;
      if (node.requires && !ownsSkill(s.skills, node.requires)) return false;
      if (ownsSkill(s.skills, id)) return false;
      const skills = { ...s.skills } as Record<string, number | boolean>;
      skills[node.key] = node.level ?? true;
      settleAndToast({ ...core(s), coins: s.coins - node.cost, skills: skills as unknown as PlayerSkills }); return true;
    },
    consumeTeamShield() { const n = get().teamShields; if (n <= 0) return false; set({ teamShields: n - 1 }); return true; },
    applyServerMeta({ cosmetics, cards, teamShields }) {
      const s = get(); const m = s.meta;
      const newCos = cosmetics.filter((id) => !m.cosmetics.owned.includes(id)); const newCards = cards.filter((id) => !m.cards.includes(id));
      const extra: Toast[] = [];
      for (const id of newCos) { const c = cosmeticById(id); if (c) extra.push({ id: toastSeq++, icon: '🎩', title: `Dolaba yeni: ${c.name}`, tone: 'accent' }); }
      for (const id of newCards) { const c = cardById(id); if (c) extra.push({ id: toastSeq++, icon: '🃏', title: `Yeni Kulak Kartı: ${c.title}`, tone: 'green' }); }
      if (teamShields > s.teamShields) extra.push({ id: toastSeq++, icon: '🛡️', title: `+${teamShields - s.teamShields} kalkan`, text: 'Bir sonraki bölüme kalkanla başlarsın.', tone: 'accent' });
      set({ teamShields });
      if (!newCos.length && !newCards.length) { if (extra.length) set({ toasts: [...get().toasts, ...extra] }); return; }
      settleAndToast({ ...core(get()), meta: { ...m, cards: [...m.cards, ...newCards], cosmetics: { ...m.cosmetics, owned: [...m.cosmetics.owned, ...newCos] } } }, extra);
    },
    setSounds(v) { set({ sounds: v }); },
    setVolumes(v) { set({ ...(v.musicVol != null ? { musicVol: Math.max(0, Math.min(1, v.musicVol)) } : {}), ...(v.sfxVol != null ? { sfxVol: Math.max(0, Math.min(1, v.sfxVol)) } : {}), ...(v.voiceVol != null ? { voiceVol: Math.max(0, Math.min(1, v.voiceVol)) } : {}) }); },
    reset() { set({ progress: {}, coins: 0, xp: 0, skills: { ...DEFAULT_SKILLS }, failStreak: 0, recentStars: [], meta: defaultMeta(), odiColor: null, chosenColor: null, ftue: get().ftue.bypass ? get().ftue : { ...FRESH_FTUE } }); },
    ftueStoryDone() { set({ ftue: { ...get().ftue, story: true } }); },
    ftueTourDone(id) { const f = get().ftue; if (!f.tours.includes(id)) set({ ftue: { ...f, tours: [...f.tours, id] } }); },
    ftueBypass() { set({ ftue: { ...get().ftue, story: true, bypass: true } }); },
    setNarratorVoice(v) { set({ narratorVoice: v }); },
    setKnowledge(v) { set({ knowledge: v, knowledgeAsked: true }); },
    knowledgeAskedDone() { if (!get().knowledgeAsked) set({ knowledgeAsked: true }); },
    setBigText(v) { set({ bigText: v }); },
    setHaptics(v) { set({ haptics: v }); },
    setReduceMotion(v) { set({ reduceMotion: v }); },
    noteShown(id) { const seen = get().notesSeen; set({ notesSeen: seen.includes(id) ? seen : [...seen, id], noteAt: Date.now() }); },
    playerLevel() { return levelFromXp(get().xp); },
  };
}, {
  name: 'odi-v1',
  version: 3,
  storage: createJSONStorage(() => platformStorage),
  // kayıt, platform köprüsü kurulduktan sonra yüklenir (main.tsx / mobil WebApp: useStore.persist.rehydrate())
  skipHydration: true,
  partialize: (s) => ({ teamShields: s.teamShields, journey: s.journey, progress: s.progress, coins: s.coins, xp: s.xp, skills: s.skills, sounds: s.sounds, musicVol: s.musicVol, sfxVol: s.sfxVol, voiceVol: s.voiceVol, failStreak: s.failStreak, recentStars: s.recentStars, streak: s.streak, lastDay: s.lastDay, meta: s.meta, ftue: s.ftue, narratorVoice: s.narratorVoice, knowledge: s.knowledge, knowledgeAsked: s.knowledgeAsked, notesSeen: s.notesSeen, noteAt: s.noteAt, bigText: s.bigText, haptics: s.haptics, reduceMotion: s.reduceMotion, odiColor: s.odiColor, chosenColor: s.chosenColor }),
  /** v0/v1 (meta yok) → v2: meta ilerlemeden dürüstçe doldurulur; eski alanlar korunur */
  migrate: (persisted, version) => {
    const p = (persisted ?? {}) as Record<string, unknown> & { progress?: Record<number, LevelProgress>; meta?: unknown };
    return { ...p, meta: version < 2 ? migrateMeta(undefined, p.progress ?? {}) : migrateMeta(p.meta, p.progress ?? {}) } as unknown as State;
  },
  /** her yüklemede meta'yı doğrula (eksik/bozuk alanlar varsayılana) */
  merge: (persisted, current) => {
    if (!persisted || typeof persisted !== 'object') return current;
    const p = persisted as Partial<State>;
    // ftue: v3 öncesi kayıtta yok → ilerlemesi olan oyuncu hikâyeyi ve açılmış yerlerin turlarını görmüş sayılır
    return { ...current, ...p, voiceVol: migrateVoiceVol(p), meta: p.meta ? migrateMeta(p.meta, p.progress ?? {}) : migrateMeta(undefined, p.progress ?? {}), ftue: normalizeFtue(p.ftue, p.progress ?? {}), narratorVoice: p.narratorVoice ?? true, knowledge: p.knowledge === 'odyoloji' ? 'odyoloji' : 'genel', knowledgeAsked: p.knowledgeAsked === true || p.knowledge === 'odyoloji', notesSeen: Array.isArray(p.notesSeen) ? p.notesSeen.filter((x) => typeof x === 'string') : [], noteAt: typeof p.noteAt === 'number' ? p.noteAt : 0, bigText: p.bigText === true, haptics: p.haptics !== false, reduceMotion: p.reduceMotion === true, odiColor: validColor(p.odiColor), chosenColor: validColor(p.chosenColor) } as State;
  },
}));

/** ayarların yan etkileri: titreşim anahtarı platform köprüsüne, hareketi azalt kök sınıfa (CSS animasyonları; bkz. styles.css) */
const applyPrefs = (s: Pick<State, 'haptics' | 'reduceMotion'>) => {
  setPlatformHaptics(s.haptics);
  try { document.documentElement.classList.toggle('az-hareket', s.reduceMotion); } catch { /* DOM yok (test) */ }
};
applyPrefs(useStore.getState());
useStore.subscribe((s, prev) => { if (s.haptics !== prev.haptics || s.reduceMotion !== prev.reduceMotion) applyPrefs(s); });

/** anlatıcı düzeyi: eski kayıtta yok → o güne kadar duyduğu düzey (anlatıcı efekt düzeyini izliyordu, 0,2'nin altına inmezdi) */
export function migrateVoiceVol(p: { voiceVol?: unknown; sfxVol?: unknown }): number {
  if (typeof p.voiceVol === 'number' && Number.isFinite(p.voiceVol)) return Math.max(0, Math.min(1, p.voiceVol));
  const sfx = typeof p.sfxVol === 'number' && Number.isFinite(p.sfxVol) ? p.sfxVol : INITIAL.sfxVol;
  return Math.max(0.2, Math.min(1, sfx));
}

const validColor = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff ? v : null);

export function ownsSkill(skills: PlayerSkills, id: string): boolean {
  const node = SKILL_TREE.find((n) => n.id === id); if (!node) return false;
  const v = skills[node.key]; return typeof v === 'boolean' ? v : v >= (node.level ?? 1);
}
export type { MetaState };
