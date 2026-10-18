import { generateLevel } from '@odi/level-gen';
for (const n of [3, 10, 14, 22, 32, 34, 36, 38]) {
  const out: string[] = [];
  for (let s = 0; s < 12; s++) { const sp = generateLevel('insan', n, undefined, s); out.push(`${s}:${sp.modifiers.join('+') || '-'}`); }
  console.log(n, generateLevel('insan', n).mechanic, out.join(' '));
}
