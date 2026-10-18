#!/usr/bin/env node
/**
 * Tek komutla geliştirme: oyun sunucusu (8787) + Expo (telefon için QR).
 * Kullanım (kökten): npm run oyna            → aynı Wi-Fi'daki iPhone, Expo Go ile QR'ı okutur
 *                    npm run oyna -- --tunnel → farklı ağ (Expo tüneli; sosyal sunucu yine yerel ağda olmalı)
 *                    npm run oyna -- --web    → telefon yerine tarayıcı (http://localhost:5173)
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const win = process.platform === 'win32';
const run = (cmd, a, cwd, env = {}) => spawn(cmd, a, { cwd, stdio: 'inherit', shell: win, env: { ...process.env, ...env } });

const ips = Object.values(networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => n.address);
console.log('\n🎧 ODİ başlıyor…');
console.log(`   Sosyal sunucu: ws://${ips[0] ?? 'localhost'}:8787  (telefon aynı Wi-Fi'da olmalı)`);
console.log('   Kapatmak için: Ctrl + C\n');

const server = run('npm', ['run', 'server'], root, { ODI_TEST_STORE: '1' });
const client = args.includes('--web')
  ? run('npm', ['run', 'dev'], root)
  : run('npx', ['expo', 'start', ...(args.includes('--tunnel') ? ['--tunnel'] : [])], resolve(root, 'apps/mobile'));

const stop = () => { for (const p of [server, client]) { try { p.kill(); } catch { /* yok */ } } process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.on('exit', (c) => { if (c) { console.error(`\nSunucu kapandı (kod ${c}).`); } });
client.on('exit', () => stop());
