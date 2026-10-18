import type { ChunkSpec } from '@odi/shared';
import { G, block, chunk, coins, collect, crumble, decor, door, enemy, ground, hazard, hook, hookArc, jumpArc, launchArc, launcher, lift, moving, plat, power, secret, spike, spring, sw } from './helpers';

/**
 * Kemikçikler (13-16, 18-19): çekiç-örs-üzengi makinesi. Kanca (13'ten), yere çakılma (15'ten).
 * Kanca: yakınında basılı tut → sallan, bırak → fırla. Çakılma: havada aşağı kaydır → çatlak zemini kır, anahtarı tetikle.
 * Anahtar odaları kapalıdır: kapıya çarpan geri döner, arka duvardan yine döner; anahtarı kaçırmak can yakmaz.
 */
const B = ['kemikcikler'] as const;
const bones = (x: number, s = 1) => decor(x, G, 'ot', s);
/** dişli testere (dönen tehlike) */
const gear = (x: number, y: number, r = 34) => ({ type: 'gear' as const, x, y, props: { r, speed: 1 } });
const shield = (x: number, dx = 40) => enemy(x, G, 'kalkanli', dx);

export const KEMIKCIKLER_CHUNKS: ChunkSpec[] = [
  chunk('km-kanca', 'makine', 2, 1300, [ground(0, 300), hook(600, G - 290, 190), hazard(330, G - 470, 540, 70), ...hookArc(600, G - 290, 190, 6), ground(870, 430), spike(1060, 40), ...jumpArc(959, 4, 0.7), bones(1200), secret(600, G - 380)], { tags: ['kanca', 'bosluk'], biomes: [...B] }),
  chunk('km-kanca-zincir', 'makine', 3, 1700, [ground(0, 280), hook(560, G - 280, 180), hook(930, G - 300, 180), hazard(300, G - 480, 900, 70), ...hookArc(560, G - 280, 180, 5), ...hookArc(930, G - 300, 180, 5), ground(1240, 460), collect(750, G - 330), spike(1340, 40), secret(1470, G - 210), plat(1420, G - 140, 110), spike(1560, 40)], { tags: ['kanca', 'bosluk', 'risk'], biomes: [...B] }),
  chunk('km-kanca-yukari', 'makine', 3, 1300, [ground(0, 400), hook(560, G - 300, 190), block(760, G - 120, 540, 320), ...hookArc(560, G - 300, 190, 4, -0.7, 0.5), ...coins(780, G - 170, 6, 44), secret(1120, G - 300), plat(1060, G - 230, 120), spike(1180, 48, G - 120), ...coins(1160, G - 250, 3, 36, 20)], { tags: ['kanca'], biomes: [...B] }),
  // ufalanan köprü: taşlar arası aralıklı (her aralıkta kısa zıplama), taş 0,4 sn sonra düşer — durmak yok
  chunk('km-ufalanan', 'makine', 2, 1150, [ground(0, 250), crumble(290, G, 90), crumble(420, G, 90), crumble(550, G, 90), crumble(680, G, 90), ground(810, 340), ...jumpArc(225, 3, 0.1), ...jumpArc(355, 3, 0.1), ...jumpArc(485, 3, 0.1), ...jumpArc(615, 3, 0.1), ...jumpArc(745, 3, 0.1), spike(990, 40), bones(1100), secret(560, G - 230), plat(510, G - 160, 100)], { tags: ['ufalanan', 'bosluk'], biomes: [...B] }),
  chunk('km-anahtar-oda', 'makine', 3, 1400, [ground(0, 100), ground(200, 1200), block(260, G - 100, 200, 100), sw(620, G, 'km-o1'), door(900, G - 240, 240, 'km-o1'), ...coins(560, G - 150, 3, 36, 20), ...coins(970, G - 40, 3, 40), spike(1100, 40), gear(750, G - 200, 30), secret(1240, G - 230), plat(1190, G - 160, 100), bones(1320)], { tags: ['anahtar', 'cakil'], biomes: [...B], needs: ['cakil'] }),
  // gizli dehliz: dar çatlak zemin yürürken dayanır; üstüne çakılırsan alttaki dehlize düşersin, yay seni yola geri atar
  chunk('km-cakil-gizli', 'makine', 3, 1300, [ground(0, 420), spike(250, 40), crumble(420, G, 50), block(470, G, 450, 60), shield(720, 26), plat(400, G + 180, 600, 40), spring(960, G + 180, 1.1), ground(1000, 300), spike(1060, 40), spike(1240, 40), secret(700, G + 130), ...coins(560, G + 140, 5, 40), ...coins(560, G - 60, 5, 40), shield(1150, 40), ...coins(1110, G - 130, 3, 36, 20)], { tags: ['cakil', 'gizli'], biomes: [...B], needs: ['cakil'] }),
  chunk('km-asansor', 'makine', 2, 1200, [ground(0, 400), spike(170, 40), lift(400, G, 180, 200), block(580, G - 130, 300, 330), ...coins(420, G - 40, 3, 40), ...coins(600, G - 170, 6, 44), ground(880, 320), secret(720, G - 370), plat(660, G - 280, 110), spike(1000, 40), ...coins(980, G - 120, 3, 36, 20)], { tags: ['asansor', 'platform'], biomes: [...B] }),
  chunk('km-kalkanli', 'makine', 3, 1300, [ground(0, 1300), shield(380, 40), ...coins(340, G - 150, 3, 40, 20), spike(640, 48), ...coins(620, G - 130, 3, 36, 20), shield(950, 50), ...coins(910, G - 150, 3, 40, 20), bones(1200), secret(780, G - 260), plat(730, G - 180, 110)], { tags: ['dusman', 'cakil'], biomes: [...B], needs: ['cakil'] }),
  chunk('km-disli', 'makine', 3, 1300, [ground(0, 320), moving(330, G - 30, 120, 220, 0, 3400), gear(520, G - 170, 34), ground(780, 520), gear(1000, G - 30, 30), ...coins(350, G - 80, 5, 40), ...coins(960, G - 130, 3, 40, 30), secret(520, G - 300), power(1200, G - 60, 'shield')], { tags: ['hareketli', 'disli'], biomes: [...B] }),
  chunk('km-piston', 'makine', 2, 1250, [ground(0, 360), spike(160, 40), launcher(330, G, 330, -1100), block(600, G - 320, 200, 520), ground(800, 450), ...launchArc(330, 330, -1100, 6, { landY: G - 320 }), ...coins(620, G - 360, 4, 40), secret(700, G - 470), enemy(1040, G, 'devriye', 40), ...coins(1000, G - 130, 3, 36, 20)], { tags: ['firlatici'], biomes: [...B] }),
  chunk('km-atici', 'makine', 3, 1300, [ground(0, 1300), enemy(1150, G, 'atici', 0, { period: 2.2, range: 360 }), ...coins(500, G - 130, 4, 40, 30), block(600, G - 60, 160, 60), ...coins(620, G - 110, 3, 40), spike(900, 40), ...coins(880, G - 120, 3, 36, 20), secret(700, G - 260), plat(650, G - 180, 110)], { tags: ['dusman', 'atici'], biomes: [...B] }),
  // gösteri: Üç Kemik Makinesi — kanca zinciri, ufalanan köprü, anahtarlı kapı
  chunk('km-sp-makine', 'makine', 3, 2500, [
    ground(0, 280), hook(540, G - 300, 190), hazard(300, G - 490, 460, 70), block(780, G - 120, 220, 320), crumble(1040, G - 120, 80), crumble(1164, G - 120, 80), crumble(1288, G - 120, 80), block(1412, G - 120, 108, 320), ground(1520, 980),
    sw(1700, G, 'km-sp'), door(1980, G - 260, 260, 'km-sp'), gear(1840, G - 210, 30),
    ...hookArc(540, G - 300, 190, 5), ...coins(800, G - 170, 3, 40), ...jumpArc(970, 3, 0.15, G - 120), ...jumpArc(1094, 3, 0.15, G - 120), ...jumpArc(1218, 3, 0.15, G - 120), ...jumpArc(1342, 3, 0.15, G - 120), ...coins(1640, G - 150, 3, 36, 20), ...coins(2060, G - 40, 3, 40), spike(2250, 40), ...jumpArc(2149, 4, 0.6),
    collect(1230, G - 300), secret(540, G - 400),
  ], { tags: ['gosteri', 'kanca', 'anahtar'], biomes: [...B], setPiece: true, needs: ['cakil'] }),
  // gösteri: Üzengi Pistonu — pistonla fırla, iki kancayla dişlilerin üstünden geç, basma anahtarıyla kapıyı aç (13. bölümden)
  chunk('km-sp-uzengi', 'makine', 3, 2400, [
    ground(0, 300), spike(150, 40), launcher(280, G, 300, -1000), block(560, G - 300, 160, 500), ...launchArc(280, 300, -1000, 5, { landY: G - 300 }),
    hook(940, G - 380, 180), hook(1260, G - 380, 180), gear(1100, G - 120, 34), gear(1100, G - 40, 26), ...hookArc(940, G - 380, 180, 5), ...hookArc(1260, G - 380, 180, 5),
    ground(1400, 1000), crumble(1560, G - 140, 120), plat(1500, G - 140, 60), spike(1620, 40), spike(1910, 40), sw(1760, G, 'km-sp2', 'temas'), door(2000, G - 260, 260, 'km-sp2'), gear(1880, G - 210, 30),
    ...coins(1515, G - 180, 3, 40), ...coins(2080, G - 40, 4, 40), spike(2280, 40), collect(1100, G - 260), secret(1620, G - 330), plat(1580, G - 260, 90),
  ], { tags: ['gosteri', 'kanca', 'anahtar', 'firlatici'], biomes: [...B], setPiece: true, needs: ['kanca'] }),
];

