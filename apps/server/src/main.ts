import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { configFromEnv, startServer } from './server';

const here = path.dirname(fileURLToPath(import.meta.url));
const opts = configFromEnv();
opts.dbFile = process.env.ODI_DB || path.resolve(here, '../data/odi.sqlite');
opts.log = process.env.ODI_LOG !== '0';

const srv = await startServer(opts);
if (process.env.NODE_ENV === 'production' && !process.env.ODI_ADMIN_CODE_HASH) console.warn('Uyarı: ODI_ADMIN_CODE_HASH verilmedi; üretimde yönetici kodu kapalı (yeni özet: npm run kod -- ozet).');
const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i!.address);
console.log(`ODİ sunucusu hazır → http://localhost:${srv.port}  (sağlık: /saglik)`);
for (const ip of lan) console.log(`  Aynı Wi-Fi'daki telefondan: ws://${ip}:${srv.port}`);
console.log(`  Veritabanı: ${opts.dbFile}${opts.raidAlways ? ' · baskın sürekli açık (ODI_RAID_ALWAYS=1)' : ''}${opts.testStore ? ' · TEST mağazası açık' : ''}`);

let closing = false;
const stop = async () => {
  if (closing) return; closing = true;
  console.log('Sunucu kapatılıyor…');
  await srv.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
