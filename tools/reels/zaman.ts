// Reels sahne zamanlaması (Phaser'sız, hızlı): bölümü planlayıcı botla oynatır, ilginç olayları simülasyon saniyesiyle yazar.
// Tarayıcıdaki `?bot=1&level=N[&salt=K]` aynı üreticiyi ve aynı deterministik simülasyonu kullanır; buradaki saniye
// stüdyodaki `fromT` ile aynıdır. Patoloji etiketi oyunda, kahraman öğeye 250 px yaklaşınca çıkar (LevelScene.pathologyWatch).
// Kullanım: node tools/reels/zaman.mjs --levels 1-40 [--salt 0]   (zaman.mjs bunu esbuild ile paketleyip çalıştırır)
import { DEFAULT_SKILLS, PATOLOJILER, type PatolojiId } from '@odi/content';
import { generateLevel } from '@odi/level-gen';
import { setup } from '../../packages/game-core/src/play/testkit';
import { Planner } from '../../packages/game-core/src/play/planner';
import { step } from '../../packages/game-core/src/play/sim';

const KEEP = new Set(['jump', 'walljump', 'glide', 'tramp-strong', 'hook', 'unhook', 'poundland', 'dash', 'flip', 'swim', 'splash', 'hurt', 'kill', 'break', 'bossHit', 'bossPhase', 'bossScream', 'bossStun', 'bossDown', 'tutor', 'cochlea', 'launch', 'switch', 'collect', 'remedy', 'slide', 'fork', 'bubble']);

export function timeline(n: number, salt = 0, maxT = 300) {
  const spec = generateLevel('insan', n, { recentStars: 2, failStreak: 0, skills: DEFAULT_SKILLS }, salt);
  const { w, s } = setup(spec); s.events = [];
  const p = new Planner(w, false);
  const pats = w.ents.map((e, id) => ({ id, e })).filter((q) => typeof q.e.p.patoloji === 'string').sort((a, b) => a.e.l - b.e.l);
  const seen = new Set<string>(); const out: string[] = []; const patOut: { t: number; id: string; ad: string }[] = [];
  let last = '';
  while (!s.finished && !s.failed && s.t < maxT) {
    step(w, s, p.next(s));
    for (const e of s.events!) {
      if (!KEEP.has(e.k)) continue;
      const tag = `${s.t.toFixed(1)}:${e.k}${e.s ? '/' + e.s : ''}`;
      if (tag !== last) out.push(tag); last = tag;
    }
    s.events!.length = 0;
    for (const q of pats) {
      const pat = String(q.e.p.patoloji);
      if (seen.has(pat) || q.e.l - s.hero.x > 250) continue;
      seen.add(pat); patOut.push({ t: +s.t.toFixed(2), id: pat, ad: PATOLOJILER[pat as PatolojiId]?.ad ?? pat });
    }
  }
  return { n, salt, name: spec.name, biome: spec.biome, mechanic: spec.mechanic, modifiers: spec.modifiers, finished: s.finished, t: +s.t.toFixed(1), pathologies: patOut, events: out };
}
