// Tek kişilik bilgi pratiği (YN-078, sahip kararı 35): canlı yarışmayla aynı havuz ve seçim kuralı; hiçbir ödül ya da ilerleme yazmaz.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { QUIZ_QUESTIONS, QUIZ_ROUND, pickQuizQuestions } from '@odi/content';
import { PRATIK_SORU, pratikBaslat, pratikBitti, pratikCevapla, pratikDogru, pratikSecim, pratikSonraki, pratikSoru, type PratikTur } from './events/pratik';

const src = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
/** bir kaynak dosyanın içe aktardığı modüller (`import type` hariç: derlemede silinir) */
function imports(p: string): string[] {
  const f = ts.createSourceFile(p, src(p), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return f.statements.filter((s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && !s.importClause?.isTypeOnly).map((s) => (s.moduleSpecifier as ts.StringLiteral).text);
}
/** tekrarlanabilir rastgele sayı (mulberry32) */
const seeded = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('bilgi pratiği: canlı yarışmayla aynı soru havuzu', () => {
  it('tur uzunluğu canlı yarışmanınki (10)', () => { expect(PRATIK_SORU).toBe(QUIZ_ROUND); expect(QUIZ_ROUND).toBe(10); });

  it('sunucu (canlı yarışma) soruları aynı ortak işlevle ve aynı havuzdan seçer', () => {
    const server = readFileSync(resolve(__dirname, '../../server/src/events/quiz.ts'), 'utf8');
    expect(server).toMatch(/import \{[^}]*\bpickQuizQuestions\b[^}]*\} from '@odi\/content'/);
    expect(server).toMatch(/pickQuizQuestions\(level, \(n\) => randomInt\(0, n\), QUIZ_COUNT\)/);
    expect(server).toMatch(/QUIZ_COUNT = QUIZ_ROUND/);
    // sunucunun kendi soru listesi yok: soru metni yalnız @odi/content'te
    expect(server).not.toMatch(/\[\s*'(anatomi|ses|saglik|doga|teknoloji)'/);
  });

  it.each(['genel', 'odyoloji'] as const)('%s: aynı rastgele dizide pratik ve canlı yarışma aynı soruları seçer', (level) => {
    for (let seed = 1; seed <= 40; seed++) {
      const r1 = seeded(seed), r2 = seeded(seed);
      const t = pratikBaslat(level, r1);
      expect(t.qs).toEqual(pickQuizQuestions(level, (n) => Math.min(n - 1, Math.floor(r2() * n))));
      expect(new Set(t.qs).size).toBe(QUIZ_ROUND);
      for (let k = 0; k < t.qs.length; k++) expect(pratikSoru({ ...t, i: k })).toBe(QUIZ_QUESTIONS[t.qs[k]!]); // havuzun kendisi (kopya değil)
      const lv = t.qs.map((i) => QUIZ_QUESTIONS[i]!.level);
      if (level === 'genel') expect(lv.every((l) => l === 'merakli')).toBe(true);
      else { expect(lv.filter((l) => l === 'odyoloji')).toHaveLength(6); expect(lv.filter((l) => l === 'merakli')).toHaveLength(4); }
    }
  });

  it('her sorunun havuzda açıklaması var (cevaptan sonra gösterilir)', () => {
    for (const q of QUIZ_QUESTIONS) expect(q.explain.trim().length).toBeGreaterThan(10);
  });
});

describe('bilgi pratiği: tur akışı', () => {
  it('cevap bir kez verilir, cevapsız ilerlenmez; doğru sayısı seçimlerden', () => {
    let t: PratikTur = pratikBaslat('genel', seeded(7));
    expect(pratikSonraki(t)).toBe(t); // cevapsız geçilmez
    let want = 0;
    for (let k = 0; k < QUIZ_ROUND; k++) {
      const q = pratikSoru(t)!;
      const pick = k % 2 ? q.answer : (q.answer + 1) % 4; if (pick === q.answer) want++;
      const before = t; t = pratikCevapla(t, pick);
      expect(before.picks[k]).toBeNull(); // önceki durum değişmez (saf)
      expect(pratikSecim(t)).toBe(pick);
      expect(pratikCevapla(t, (pick + 1) % 4)).toBe(t); // cevap değiştirilemez
      t = pratikSonraki(t);
    }
    expect(pratikBitti(t)).toBe(true);
    expect(pratikSoru(t)).toBeNull();
    expect(pratikDogru(t)).toBe(want);
  });
});

describe('bilgi pratiği: hiçbir ödül ya da ilerleme yazmaz', () => {
  it('mantık yalnız içerik paketine dayanır (kayıt, sunucu, kutlama yok)', () => {
    expect(imports('events/pratik.ts')).toEqual(['@odi/content']);
  });

  it('ekran oyuncu kaydına, ağa, kutlamaya ya da etkinlik deposuna bağlı değil', () => {
    const allowed = new Set(['react', '../ui/bits', '../ui/art', '../ui/icons', '../ui/viewport', './pratik', './events.css']);
    const got = imports('events/Pratik.tsx');
    expect(got.filter((m) => !allowed.has(m))).toEqual([]);
    const s = src('events/Pratik.tsx');
    for (const bad of ['useStore', 'useNet', 'evNet', 'celebrate', 'claim', 'completeRun', 'submit', 'recordShare', '.call(', 'localStorage', 'questProgress', 'giveRewards']) expect(s, bad).not.toContain(bad);
  });

  it('App yalnız bilgi düzeyini okur, kayda bir şey vermez', () => {
    const line = src('App.tsx').split('\n').find((l) => l.includes("case 'pratik'"));
    expect(line).toBeDefined();
    expect(line).toContain('<PratikScreen level={store.knowledge} onBack={back(route)} />');
  });

  it('ekran dürüstçe yazar: ödül yok, takım puanına sayılmaz, ödüller canlı yarışmada; sıralama yok', () => {
    const s = src('events/Pratik.tsx');
    expect(s).toContain('Pratik: ödül yok, takım puanına ve lige sayılmaz. Ödüller canlı Kulak Bilgi Yarışması');
    const code = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // yorumlar hariç: ekranda görünen ve çizilen
    expect(code).not.toMatch(/[Ss]ıralama|rank-list|[Jj]eton|[Kk]ristal|\bXP\b/);
  });

  it('kolay bulunur: Bugün, takım etkinlikleri (takımlı ve takımsız) ve bilgi yarışması ekranında giriş', () => {
    expect(src('screens/TodayScreen.tsx')).toContain("nav.open({ name: 'pratik' })");
    const hub = src('events/Hub.tsx');
    expect(hub.split("nav.open({ name: 'pratik' })").length - 1).toBe(2); // takımlı: yarışma kartı; takımsız: takım çağrısı kartı
    expect(src('events/Quiz.tsx')).toContain('<PratikLink />');
  });
});
