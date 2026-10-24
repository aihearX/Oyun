#!/usr/bin/env node
/**
 * Tek komutla geliştirme: oyun sunucusu (8787) + Expo (telefon için QR).
 * Kullanım (kökten): npm run oyna            → aynı Wi-Fi'daki iPhone, Expo Go (SDK 58) ile QR'ı okutur
 *                    npm run oyna -- --tunnel → farklı ağ (Expo tüneli; sosyal sunucu yine yerel ağda olmalı)
 *                    npm run oyna -- --web    → telefon yerine tarayıcı (http://localhost:5173)
 *                    npm run oyna -- --temiz  → Expo önbelleğini temizleyerek başlat (eski sürüm görünüyorsa)
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
// oyun sunucusu yerleşik SQLite (node:sqlite) kullanır: Node 22.13 ve üstü gerekir
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 13)) {
  console.error(`\n⚠️  Node ${process.versions.node} eski. ODİ sunucusu için Node 22.13 veya üstü gerekiyor.`);
  console.error('   https://nodejs.org adresinden "LTS" sürümünü kurup terminali kapatıp yeniden açın.\n');
  process.exit(1);
}
// Expo SDK 58: Node 22.13+, 24.3+ ya da 26+; tek sayılı sürümler (23, 25) desteklenmez
if (!args.includes('--web') && (maj % 2 === 1 || (maj === 24 && min < 3))) {
  console.warn(`\n⚠️  Node ${process.versions.node}: Expo SDK 58 bu sürümü desteklemiyor (22.13+, 24.3+ ya da 26+ gerekir). "LTS" sürümünü kurun.\n`);
}
const win = process.platform === 'win32';
const run = (cmd, a, cwd, env = {}) => spawn(cmd, a, { cwd, stdio: 'inherit', shell: win, env: { ...process.env, ...env } });

const ips = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
console.log('\n🎧 ODİ başlıyor…');
console.log(`   Sosyal sunucu: ws://${ips[0] ?? 'localhost'}:8787  (telefon aynı Wi-Fi'da olmalı)`);
if (!args.includes('--web')) console.log('   Telefonda Expo Go SDK 58 olmalı (Expo Go yalnız kendi SDK sürümündeki projeyi açar).');
console.log('   Kapatmak için: Ctrl + C\n');

const server = run('npm', ['run', 'server'], root, { ODI_TEST_STORE: '1' });
const client = args.includes('--web')
  ? run('npm', ['run', 'dev'], root)
  : run('npx', ['expo', 'start', ...(args.includes('--tunnel') ? ['--tunnel'] : []), ...(args.includes('--temiz') ? ['-c'] : [])], resolve(root, 'apps/mobile'));

const stop = () => { for (const p of [server, client]) { try { p.kill(); } catch { /* yok */ } } process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('exit', (c) => { if (c) { console.error(`\nSunucu kapandı (kod ${c}).`); } });
client.on('exit', () => stop());
