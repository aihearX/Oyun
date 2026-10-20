import type { ChunkSpec } from '@odi/shared';
import { G, barrier, beat, beatSlide, block, chunk, moving, sw, door, launcher, coinCol, coins, collect, crumble, decor, echo, enemy, grav, ground, hazard, hook, hookArc, jumpArc, launchArc, plat, power, secret, spike, spring, trampArc, trampoline, wall } from './helpers';

/**
 * İşitme Korteksi (37-39, boss 40): sesin anlama dönüştüğü rüya. Tüm yetenekler bir arada; ritim, yankı ve çevirme.
 */
const B = ['korteks'] as const;
const ruya = (x: number, s = 1) => decor(x, G, 'ot', s);
const pulse = (x: number, y: number, w: number, h: number, on: number, off: number, phase = 0) => hazard(x, y, w, h, 'gurultu', { on, off, phase });

export const KORTEKS_CHUNKS: ChunkSpec[] = [
  chunk('kx-ruya-ritim', 'ruya', 4, 1500, [ground(0, 280), beat(300, G, 130, '1110'), beatSlide(500, G - 80, 120, 200, '0011'), beat(860, G - 40, 130, '0111'), ground(1040, 460), plat(1040, G - 300, 300, 40), grav(1040, G - 260, 300, 260), spike(1140, 100), ...coins(310, G - 60, 3, 40), ...coins(520, G - 140, 3, 40), ...coins(870, G - 100, 3, 40), ...coins(1150, G - 230, 3, 40), secret(700, G - 320), collect(1400, G - 80), ruya(1450)], { tags: ['ritim', 'cevir'], biomes: [...B], needs: ['cevir'] }),
  chunk('kx-anlam', 'ruya', 5, 1700, [ground(0, 300), hook(560, G - 300, 190), hazard(320, G - 490, 520, 70), ground(860, 240), echo(1120, G - 20, 130), echo(1300, G - 60, 130), ground(1460, 240), barrier(1560, G - 170, 170), ...coins(460, G - 170, 3, 50, 20), ...coins(1130, G - 80, 3, 40), ...coins(1310, G - 120, 3, 40), secret(940, G - 260), plat(890, G - 180, 110)], { tags: ['kanca', 'yanki'], biomes: [...B], needs: ['darbe'] }),
  chunk('kx-bahce', 'ruya', 4, 1500, [ground(0, 420), spike(240, 40), crumble(420, G, 50), block(470, G, 450, 60), enemy(720, G, 'kalkanli', 26), plat(400, G + 180, 600, 40), spring(960, G + 180, 1.1), ground(1000, 500), secret(700, G + 130), ...coins(560, G + 140, 5, 40), plat(200, G - 150, 140), ...coins(210, G - 200, 3, 40), ...coins(1100, G - 160, 5, 44, 40), spike(1180, 64), ruya(80)], { tags: ['gizli', 'cakil'], biomes: [...B], needs: ['cakil'] }),
  chunk('kx-son-kosu', 'ruya', 5, 1700, [ground(0, 1700), barrier(300, G - 170, 170), spike(560, 48), enemy(800, G, 'kalkanli', 50), pulse(1050, G - 140, 120, 150, 1.0, 1.2, 0.4), spike(1240, 40), enemy(1460, G, 'ziplayan', 0, { hop: 120 }), ...coins(360, G - 60, 3, 40), ...coins(540, G - 130, 3, 36, 20), ...coins(760, G - 150, 3, 40, 20), ...coins(1060, G - 60, 3, 40), ...coins(1360, G - 180, 3, 40, 20), secret(955, G - 330), plat(900, G - 180, 110), power(1600, G - 70, 'life')], { tags: ['karma', 'hiz'], biomes: [...B], needs: ['darbe', 'cakil'] }),
  chunk('kx-zar-kanca', 'ruya', 4, 1600, [ground(0, 280), trampoline(380, G + 60, 200), block(480, G - 260, 220, 460), hook(900, G - 420, 190), ground(1200, 400), hazard(760, G - 640, 360, 60), ...coinCol(380, G - 80, 4, 55), ...coins(500, G - 320, 4, 44), ...coins(860, G - 270, 3, 50, 20), secret(900, G - 520), collect(1350, G - 80)], { tags: ['zar', 'kanca'], biomes: [...B] }),
  chunk('kx-kuyu-cevir', 'ruya', 5, 1500, [ground(0, 60), ground(170, 1330), wall(300, G - 560, 480), wall(480, G - 330, 330), plat(520, G - 330, 160), ...coinCol(390, G - 140, 4, 50), plat(840, G - 300, 460, 40), grav(840, G - 260, 460, 260), spike(920, 100), hazard(1030, G - 264, 80, 26, 'diken'), spike(1140, 80), spike(1040, 40, G - 300), spike(1400, 40), ...coins(930, G - 230, 3, 40), ...coins(1150, G - 230, 2, 40), secret(390, G - 480)], { tags: ['duvar', 'cevir'], biomes: [...B], needs: ['duvar', 'cevir'] }),
  chunk('kx-yanki-merdiven', 'ruya', 4, 1500, [ground(0, 1500), barrier(260, G - 170, 170), echo(420, G - 110, 120), echo(580, G - 210, 120), echo(740, G - 310, 120), plat(900, G - 310, 220), ...coins(430, G - 160, 3, 36), ...coins(590, G - 260, 3, 36), ...coins(750, G - 360, 3, 36), ...coins(910, G - 360, 5, 44), collect(1180, G - 300), spike(820, 48), spike(1250, 64), ...coins(1230, G - 130, 3, 36, 20), secret(1010, G - 430), ruya(100)], { tags: ['yanki', 'gizli', 'risk'], biomes: [...B], needs: ['darbe'] }),
  chunk('kx-darbe-anahtar', 'ruya', 5, 1500, [ground(0, 100), ground(200, 1300), block(260, G - 100, 200, 100), sw(640, G, 'kx-a1', 'darbe'), beat(700, G - 150, 120, '1110'), door(940, G - 240, 240, 'kx-a1'), pulse(560, G - 300, 90, 120, 1.0, 1.0), ...coins(560, G - 40, 3, 36), ...coins(710, G - 200, 3, 36), ...coins(1020, G - 40, 3, 40), spike(1180, 40), ...jumpArc(1079, 4, 0.6), secret(760, G - 260), ruya(1350)], { tags: ['anahtar', 'darbe', 'ritim'], biomes: [...B], needs: ['darbe'] }),
  chunk('kx-kanca-yanki', 'ruya', 5, 1700, [ground(0, 300), hook(560, G - 300, 190), echo(860, G - 40, 130), echo(1040, G - 80, 130), hook(1300, G - 300, 190), hazard(320, G - 490, 1180, 70), ground(1520, 180), ...coins(460, G - 170, 3, 50, 20), ...coins(870, G - 100, 3, 40), ...coins(1050, G - 140, 3, 40), ...coins(1200, G - 170, 3, 50, 20), secret(950, G - 260), collect(1300, G - 400)], { tags: ['kanca', 'yanki'], biomes: [...B], needs: ['darbe'] }),
  chunk('kx-firlatici-cevir', 'ruya', 4, 1500, [ground(0, 360), launcher(330, G, 380, -1050), plat(620, G - 420, 300, 40), grav(620, G - 380, 300, 380), ground(620, 880), spike(700, 100), ...launchArc(330, 380, -1050, 5), ...coins(700, G - 340, 3, 40), secret(860, G - 340), ...coins(1000, G - 40, 3, 40), spike(1160, 40), enemy(1360, G, 'devriye', 30), ruya(1450)], { tags: ['firlatici', 'cevir'], biomes: [...B], needs: ['cevir'] }),
  // gösteri: Ninni Hatırlanıyor — ritimle açılan yol, yankı köprüsü, çevirme ve kancayla son uçuş
  chunk('kx-sp-ninni', 'ruya', 5, 2700, [
    ground(0, 260), beat(290, G, 130, '1110'), beat(480, G - 60, 130, '0111'), beat(670, G, 130, '1011'), ground(840, 300),
    barrier(980, G - 170, 170), echo(1160, G - 20, 130), echo(1340, G - 70, 130), ground(1500, 520), plat(1500, G - 300, 520, 40), grav(1500, G - 260, 520, 260), spike(1600, 100), spike(1840, 100),
    hook(2250, G - 300, 190), hazard(2040, G - 490, 460, 70), ground(2530, 170),
    ...coins(300, G - 60, 3, 40), ...coins(490, G - 120, 3, 40), ...coins(680, G - 60, 3, 40), ...coins(1170, G - 80, 3, 40), ...coins(1350, G - 130, 3, 40), ...coins(1610, G - 230, 3, 40), ...coins(1850, G - 230, 3, 40), ...coins(2160, G - 170, 3, 50, 20),
    collect(940, G - 200), secret(2250, G - 400),
  ], { tags: ['gosteri', 'ritim', 'cevir'], biomes: [...B], setPiece: true, needs: ['darbe', 'cevir'] }),
  // gösteri: Anlam Kulesi — zar zincirinden kancaya, yankı merdiveninden yerçekimi koridoruna: tüm yetenekler son kez birlikte
  chunk('kx-sp-anlam-kulesi', 'ruya', 5, 2500, [
    ground(0, 150), trampoline(230, G + 60, 140), block(310, G - 200, 200, 400), trampoline(590, G + 60, 140, 1.2), block(670, G - 380, 160, 580), ...trampArc(198, 4), ...trampArc(558, 4, { power: 1.2 }),
    hook(1020, G - 560, 190), hazard(880, G - 820, 300, 60), ground(1240, 260), ...hookArc(1020, G - 560, 190, 5),
    barrier(1330, G - 170, 170), echo(1520, G - 100, 120), echo(1680, G - 200, 120), plat(1840, G - 200, 120), ...coins(1530, G - 140, 3, 36), ...coins(1690, G - 240, 3, 36),
    ground(1960, 540), plat(1980, G - 300, 420, 40), grav(1980, G - 260, 420, 260), spike(2060, 110), hazard(2240, G - 264, 100, 26, 'diken'), ...coins(2070, G - 236, 3, 40), ...coins(2250, G - 40, 3, 40),
    collect(760, G - 460), secret(1850, G - 330),
  ], { tags: ['gosteri', 'zar', 'kanca', 'yanki', 'cevir'], biomes: [...B], setPiece: true, needs: ['darbe', 'cevir'] }),
  // ---- sınav odaları (bölge finali ve son koşu): ritim, kanca, düşman ve çevirme bir arada, daha sıkı zamanlama
  chunk('kx-sinav-ritim', 'ruya', 5, 2100, [
    // vuruşla beliren basamaklar çukurun üstünde iki yükseklikte; çevirme koridoru; dişlili çukurda gidip gelen köprü ve zıplayan bekçi
    ground(0, 260), beat(300, G - 40, 110, '1110'), beat(500, G - 110, 110, '1011'), beat(700, G - 40, 110, '0111'), ground(860, 560),
    plat(980, G - 300, 380, 40), grav(980, G - 260, 380, 260), spike(1060, 90), hazard(1220, G - 264, 90, 26, 'diken'),
    moving(1440, G - 30, 120, 220, 0, 3000), hazard(1640, G - 190, 60, 60, 'gurultu', { dx: 0, dy: 90, period: 1800, phase: 0.8 }), ground(1900, 200), enemy(2020, G, 'ziplayan', 0, { hop: 120 }),
    ...coins(305, G - 80, 3, 36), ...coins(505, G - 150, 3, 36), ...coins(705, G - 80, 3, 36), ...coins(1070, G - 236, 3, 40), ...coins(1460, G - 80, 5, 44),
    plat(880, G - 420, 80), secret(920, G - 470), ruya(40),
  ], { tags: ['ritim', 'cevir', 'hareketli', 'sinav'], biomes: [...B], needs: ['cevir'] }),
  chunk('kx-sinav-karma', 'ruya', 5, 2100, [
    // iki kancalık zincir (tavanda gürültü), sonra dişlili çukurda gidip gelen köprü, gürültü duvarı ve mermi atan bekçi
    ground(0, 280), hook(540, G - 280, 180), hook(900, G - 300, 180), hazard(300, G - 480, 820, 70), ...hookArc(540, G - 280, 180, 5), ground(1180, 160),
    moving(1360, G - 30, 120, 210, 0, 3100), { type: 'gear', x: 1520, y: G - 170, props: { r: 32, speed: 1 } }, ground(1720, 380), barrier(1820, G - 170, 170), enemy(2040, G, 'atici', 0, { period: 2.0, range: 300, dir: -1 }),
    ...coins(1380, G - 80, 4, 44), ...coins(1880, G - 60, 2, 40),
    plat(1200, G - 330, 80), secret(1240, G - 380), ruya(60),
  ], { tags: ['kanca', 'hareketli', 'darbe', 'sinav'], biomes: [...B], needs: ['darbe', 'kanca'] }),
];
