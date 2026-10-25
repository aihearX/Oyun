// Paket bölme (YN-026): bir bileşenin işaretlemesine uyan bir özellik CSS kuralı (styles.css dışındaki *.css) varsa o CSS,
// bileşen çizildiğinde yüklü olmalı; yoksa bileşen, CSS'i başka bir parça yükleyene kadar stilsiz (ya da yarım stilli) çizilir.
// Telefon (DOM) paketi tek dosya olduğu için etkilenmez; web (davet bağlantısı) etkilenir.
//
// "Kural bileşene uyar": seçicide adı geçen bütün sınıflar (:not(...) içi hariç) bileşenin className dizgelerinde geçiyor.
//   (.race-invite .ri-body → useRaceInvites ikisini de kullanır → race.css gerekir; .kg-timp.mini → yalnız `mini` kullanan uymaz.)
// Bir modül çalıştığında kesin yüklü CSS = G(M):
//   G(kök)  = statik kapanışının CSS'i (main.tsx: giriş CSS'i, sayfayla gelir; içe aktaranı olmayan dev sayfaları da kök)
//   G(M)    = M'nin statik kapanışının CSS'i (Vite parçayı açmadan önce bağımlı parçaların CSS'ini yükler)
//             ∪ M'yi içe aktaran her modülün (statik ya da import()) G'sinin kesişimi — "her zaman yüklü bir ata".
// `import type` sayılmaz (derlemede silinir). Bileşen CSS'i kendisi yüklemiyorsa bile onu açan her yol yüklüyorsa geçer;
// başka bir parçanın CSS'ine şans eseri yaslanıyorsa kalır. styles.css her zaman yüklüdür, ayrıca denetlenmez.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname);
const ENTRY = 'main.tsx';
const GLOBAL_CSS = 'styles.css';

/**
 * Bilinçli istisnalar: `file` bileşeni `css` yüklenmeden de doğru çizilir (yollar src/'ye göre). Her biri gerekçeli.
 * (Boş kalması hedeftir; yeni istisna eklemeden önce bileşenin CSS'i kendisi yüklemesi ya da sınıfın ortak dosyaya taşınması düşünülmeli.)
 */
const EXCEPTIONS: { file: string; css: string; reason: string }[] = [];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const rel = (p: string) => relative(SRC, p).split('\\').join('/');

/** paranteze duyarlı virgül bölme (:is(.a, .b) bölünmez) */
function splitTop(sel: string): string[] {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(sel.slice(from, i)); from = i + 1; }
  }
  out.push(sel.slice(from));
  return out.map((x) => x.trim()).filter(Boolean);
}

/** CSS dosyasındaki her seçici için adı geçen sınıflar (yorumlar, dizgeler, @-kural başlıkları ve :not(...) içi hariç) */
function cssSelectors(css: string): { sel: string; classes: string[] }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  const out: { sel: string; classes: string[] }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const prelude = text.slice(start, i).trim();
      if (prelude && !prelude.startsWith('@')) {
        for (const sel of splitTop(prelude)) {
          const classes = [...new Set([...sel.replace(/:not\([^)]*\)/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!))];
          if (classes.length) out.push({ sel, classes });
        }
      }
    }
    if (ch === '{' || ch === '}' || ch === ';') start = i + 1;
  }
  return out;
}

interface Mod { imports: string[]; dynamic: string[]; css: string[]; classes: Map<string, number> }

const CLASSY = /(^|[a-z])(cls|class|classname)$/i;

/** .ts/.tsx: tür olmayan statik içe aktarımlar ve className'e giden dizge sabitlerindeki sınıflar (satır numarasıyla) */
function parseModule(file: string, source = readFileSync(file, 'utf8')): Mod {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports: string[] = [], dynamic: string[] = [], css: string[] = [];
  const classes = new Map<string, number>();
  const addSpec = (spec: string, into = imports) => {
    if (!spec.startsWith('.')) return;
    const base = resolve(dirname(file), spec);
    if (spec.endsWith('.css')) { css.push(base); return; }
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const p = base + ext;
      try { if (statSync(p).isFile()) { into.push(p); return; } } catch { /* yok */ }
    }
  };
  const add = (text: string, at: ts.Node) => {
    const line = sf.getLineAndCharacterOfPosition(at.getStart(sf)).line + 1;
    for (const t of text.split(/\s+/)) if (/^-?[_a-zA-Z][\w-]*$/.test(t) && !classes.has(t)) classes.set(t, line);
  };
  /** `${e}` yerine gelebilecek dizgeler boşlukla mı başlar/biter (ya da boş mu)? Çözülemiyorsa yapışık sayılır (ör. `bp-${tone}`). */
  const edges = (e: ts.Expression): { start: boolean; end: boolean } => {
    if (ts.isParenthesizedExpression(e)) return edges(e.expression);
    if (ts.isStringLiteralLike(e)) return { start: e.text === '' || /^\s/.test(e.text), end: e.text === '' || /\s$/.test(e.text) };
    if (ts.isConditionalExpression(e)) { const a = edges(e.whenTrue), b = edges(e.whenFalse); return { start: a.start && b.start, end: a.end && b.end }; }
    if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      const b = edges(e.right);
      if (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return b;
      const a = edges(e.left); return { start: a.start && b.start, end: a.end && b.end };
    }
    if (ts.isTemplateExpression(e)) {
      const tail = e.templateSpans[e.templateSpans.length - 1]!.literal.text;
      return { start: /^\s/.test(e.head.text), end: /\s$/.test(tail) };
    }
    return { start: false, end: false };
  };
  const harvest = (node: ts.Node) => {
    const visit = (n: ts.Node) => {
      if (ts.isStringLiteralLike(n)) add(n.text, n);
      else if (ts.isTemplateExpression(n)) {
        // sabit parçalar; `${...}` ile bitişik sözcük (ör. `bp-${tone}`) tam sınıf değildir, düşer
        let text = n.head.text;
        for (const sp of n.templateSpans) {
          const g = edges(sp.expression);
          text += `${g.start ? ' ' : '\u0000'}${g.end ? ' ' : '\u0000'}${sp.literal.text}`;
        }
        add(text.split(/\s+/).filter((t) => !t.includes('\u0000')).join(' '), n);
        n.templateSpans.forEach((sp) => visit(sp.expression));
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  };
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause;
      const typeOnly = c && (c.isTypeOnly || (!c.name && c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly)));
      if (!typeOnly) addSpec(n.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      const typeOnly = n.isTypeOnly || (n.exportClause && ts.isNamedExports(n.exportClause) && n.exportClause.elements.every((e) => e.isTypeOnly));
      if (!typeOnly) addSpec(n.moduleSpecifier.text);
    } else if (ts.isJsxAttribute(n) && CLASSY.test(n.name.getText(sf)) && n.initializer) {
      harvest(n.initializer);
    } else if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isPropertyAssignment(n)) && n.name && CLASSY.test(n.name.getText(sf))) {
      harvest(n);
    } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && CLASSY.test(n.left.name.text)) {
      harvest(n.right);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const a = n.arguments[0];
      if (a && ts.isStringLiteralLike(a)) addSpec(a.text, dynamic);
    } else if (ts.isCallExpression(n) && CLASSY.test(n.expression.getText(sf).split('.').pop() ?? '')) {
      n.arguments.forEach(harvest);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { imports, dynamic, css, classes };
}

function scan() {
  const files = walk(SRC);
  const cssFiles = files.filter((f) => f.endsWith('.css'));
  const rules = new Map<string, { sel: string; classes: string[] }[]>(); // özellik CSS → seçicileri
  for (const f of cssFiles) if (rel(f) !== GLOBAL_CSS) rules.set(f, cssSelectors(readFileSync(f, 'utf8')));
  const mods = new Map<string, Mod>();
  for (const f of files) if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) mods.set(f, parseModule(f));
  const memo = new Map<string, Set<string>>();
  const closureCss = (f: string): Set<string> => {
    const hit = memo.get(f);
    if (hit) return hit;
    const out = new Set<string>(), seen = new Set<string>(), stack = [f];
    while (stack.length) {
      const m = mods.get(stack.pop()!);
      if (!m) continue;
      m.css.forEach((c) => out.add(c));
      for (const i of m.imports) if (!seen.has(i)) { seen.add(i); stack.push(i); }
    }
    memo.set(f, out);
    return out;
  };
  const entry = join(SRC, ENTRY);
  const always = closureCss(entry);
  // G(M): en büyük sabit nokta (döngüler için tümünden başlayıp daraltılır); içe aktaranı olmayan modül (giriş, dev girişi) kendi kapanışı
  const importers = new Map<string, string[]>();
  for (const [f, m] of mods) for (const i of [...m.imports, ...m.dynamic]) importers.set(i, [...(importers.get(i) ?? []), f]);
  const allCss = new Set(cssFiles);
  const G = new Map<string, Set<string>>();
  for (const f of mods.keys()) G.set(f, f === entry || !importers.has(f) ? closureCss(f) : allCss);
  for (let changed = true; changed;) {
    changed = false;
    for (const f of mods.keys()) {
      if (f === entry || !importers.has(f)) continue;
      const ps = importers.get(f)!.map((p) => G.get(p)!);
      const next = new Set(closureCss(f));
      for (const c of ps[0]!) if (ps.every((s) => s.has(c))) next.add(c);
      if (next.size !== G.get(f)!.size) { G.set(f, next); changed = true; }
    }
  }
  const problems: { file: string; css: string; sel: string; line: number; count: number }[] = [];
  for (const [f, m] of mods) {
    const loaded = G.get(f)!;
    for (const [css, sels] of rules) {
      if (loaded.has(css)) continue;
      const hit = sels.filter((r) => r.classes.every((c) => m.classes.has(c)));
      if (!hit.length) continue;
      const line = Math.min(...hit[0]!.classes.map((c) => m.classes.get(c)!));
      problems.push({ file: rel(f), css: rel(css), sel: hit[0]!.sel, line, count: hit.length });
    }
  }
  return { problems, always: [...always].map(rel).sort(), rules: rules.size, mods: mods.size };
}

describe('Paket bölme: bileşene uyan özellik CSS\'i bileşen çizilirken yüklü (YN-026)', () => {
  const { problems, always, rules, mods } = scan();

  it('tarama gerçekten çalışıyor (modüller, özellik CSS\'leri ve giriş CSS\'i bulundu)', () => {
    expect(mods).toBeGreaterThan(100);
    expect(rules).toBeGreaterThan(10);
    expect(always).toContain(GLOBAL_CSS);
  });

  it('cssSelectors: yorum, :not(...) ve @-kural başlıkları sayılmaz; :is(...) içindeki virgül bölmez', () => {
    expect(cssSelectors('/* .yok {} */ .a .b:not(.c), .d:is(.e, .f) > i { x:1 } @media (min-width: 37.5em) { .g { y:2 } } .h::after { content:".z"; }'))
      .toEqual([{ sel: '.a .b:not(.c)', classes: ['a', 'b'] }, { sel: '.d:is(.e, .f) > i', classes: ['d', 'e', 'f'] }, { sel: '.g', classes: ['g'] }, { sel: '.h::after', classes: ['h'] }]);
  });

  it('className taraması: şablon parçaları, koşullu sınıflar, yapışık sınıflar; import type sayılmaz', () => {
    const m = parseModule(join(SRC, 'x.tsx'), [
      "import type { A } from './nav';",
      "import { type B } from './store';",
      "import { useStore } from './store';",
      "const panelCls = 'kg-a';",
      "export const X = ({ t, tone }: { t: boolean; tone: string }) => <i className={`tuy-dede${t ? ' talking' : ''} bp-${tone} on`} title=\"başlık yazısı\" />;",
      "const Y = () => import('./engine');",
    ].join('\n'));
    expect([...m.classes.keys()].sort()).toEqual(['kg-a', 'on', 'talking', 'tuy-dede']);
    expect(m.imports.map(rel)).toEqual(['store.ts']);
    expect(m.dynamic.map(rel)).toEqual(['engine.ts']);
  });

  it('bileşene uyan kuralı olan her özellik CSS\'i bileşen çizilirken yüklü (istisnalar gerekçeli)', () => {
    const left = problems.filter((p) => !EXCEPTIONS.some((e) => e.file === p.file && e.css === p.css));
    expect(left.map((p) => `${p.file}:${p.line} → ${p.css} yüklü değil (${p.count} kural uyar, ör. "${p.sel}"); bileşen ya da onu açan her yol yüklemeli`)).toEqual([]);
  });

  it('istisna listesi güncel (gereksiz istisna kalmadı, her birinin gerekçesi var)', () => {
    for (const e of EXCEPTIONS) {
      expect(e.reason.length, `${e.file} → ${e.css}`).toBeGreaterThan(10);
      expect(problems.some((p) => p.file === e.file && p.css === e.css), `artık gereksiz istisna: ${e.file} → ${e.css}`).toBe(true);
    }
  });
});
