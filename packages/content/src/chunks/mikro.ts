import type { AbilityId, ChunkSpec, Entity } from '@odi/shared';
import { G, bank, barrier, block, bubble, chunk, coin, coinCol, coins, collect, enemy, flightArc, grav, ground, hazard, jumpArc, plat, pool, spike, spring, trampArc, trampoline, wall } from './helpers';
import { curtain } from './ogretici';

/**
 * Mikro odalar (360–900 px): üretici, iki girdi arasındaki sessiz yol ~3,5 sn'yi aşacaksa araya bunlardan birini koyar
 * (`level-gen/pacing.ts`). Her biri TEK anlamlı hareket ister ve hareketi iyi yapana dürüst bir ödül verir:
 * tam basılı zıplama yayı, ezme sıçrayışı, zar "Mükemmel" sıçrayışı, süzülme izi… Bazıları isteğe bağlı riskli üst yol taşır
 * (`risk` etiketi: daha çok nota, daha dar iniş). Normal seçimde kullanılmazlar (`mikro` etiketi); gizli koklea taşımazlar.
 */
const M = (id: string, length: number, ents: Entity[], tags: string[], o: { needs?: AbilityId[]; difficulty?: ChunkSpec['difficulty'] } = {}) =>
  chunk(id, 'kosu', o.difficulty ?? 2, length, ents, { tags: ['mikro', ...tags], needs: o.needs });

export const MIKRO_CHUNKS: ChunkSpec[] = [
  // giriş: bölüm çukursuz başlıyorsa üretici en başa koyar — dokunmayan oyuncu burada düşer (boşta hiçbir bölüm bitmez)
  chunk('mk-giris-cukur', 'kosu', 1, 470, [ground(0, 160), ground(280, 190), ...jumpArc(112, 5, 1)], { tags: ['mikro', 'giris', 'bosluk'] }),
  // ---- zıpla: tam basılı yay ödülü
  M('mk-nota-yayi', 420, [ground(0, 420), spike(200, 40), ...jumpArc(99, 5, 1)], ['zipla', 'yay-odul']),
  M('mk-cukur-yayi', 460, [ground(0, 170), ground(290, 170), ...jumpArc(122, 5, 1)], ['zipla', 'bosluk', 'yay-odul']),
  M('mk-basamak-yayi', 480, [ground(0, 480), block(190, G - 56, 110, 56), ...jumpArc(128, 5, 1), coin(330, G - 20)], ['zipla', 'platform']),
  M('mk-bocek-yayi', 460, [ground(0, 460), enemy(250, G, 'devriye', 24), ...jumpArc(130, 4, 1)], ['zipla', 'dusman']),
  M('mk-genis-diken', 560, [ground(0, 560), spike(220, 104), ...jumpArc(151, 6, 1), coin(420, G - 20), coin(460, G - 20)], ['zipla', 'diken', 'yay-odul'], { difficulty: 3 }),
  // ---- risk / ödül: güvenli alt yol (iki kısa zıplama) ya da notalı dar üst yol
  M('mk-risk-cift', 620, [ground(0, 620), spike(170, 40), spike(430, 72), plat(250, G - 128, 120), ...coins(262, G - 170, 3, 40), collect(400, G - 210), ...jumpArc(117, 3, 0.15)], ['zipla', 'risk', 'diken'], { difficulty: 3 }),
  // risk: havadaki dar rafa tam basılı zıpla → yay seni notalı üst rafa atar; alt yolda iki kısa zıplama
  M('mk-risk-yay', 780, [ground(0, 780), spike(150, 40), plat(250, G - 118, 100), spring(300, G - 118, 1.1), ...flightArc(296, G - 118, 990, 3, { to: 0.4 }), plat(400, G - 380, 160), ...coins(410, G - 420, 4, 40), spike(520, 48), ...jumpArc(423, 3, 0.6), spike(690, 56), ...jumpArc(597, 3, 0.8)], ['zipla', 'risk', 'yay'], { difficulty: 3 }),
  // risk: çukurun ortasında dar bir taş, üstünde büyük nota — tam yükseklikte zıplayıp taşa kon, oradan karşıya
  M('mk-risk-dar', 640, [ground(0, 200), ground(440, 200), plat(300, G - 120, 44), collect(322, G - 175), ...jumpArc(152, 4, 0.7), spike(560, 40)], ['zipla', 'risk', 'bosluk'], { difficulty: 3 }),
  // risk: alçak tavan rafı dikenlerin üstünde; rafta nota dizisi, raftan inince son diken
  M('mk-risk-tavan', 700, [ground(0, 700), spike(150, 40), spike(330, 56), plat(200, G - 140, 240), ...coins(215, G - 180, 6, 40), spike(560, 48), ...jumpArc(457, 3, 0.7)], ['zipla', 'risk', 'diken'], { difficulty: 3 }),
  // risk (zar): tek zar; tepesindeki büyük nota yalnız Mükemmel sıçrayışa
  M('mk-risk-zar', 600, [ground(0, 150), trampoline(230, G + 60, 140), block(310, G - 200, 290, 400), ...trampArc(198, 4), collect(410, G - 485), spike(470, 36, G - 200)], ['zar', 'risk'], { needs: ['trambolin'], difficulty: 3 }),
  // ---- kayma
  M('mk-perde', 440, [ground(0, 440), curtain(170, 110), ...coins(180, G - 20, 3, 40)], ['kayma'], { needs: ['kayma'] }),
  M('mk-sinek-alcak', 460, [ground(0, 460), enemy(250, G - 30, 'ucan', 18, { amp: 5 }), ...coins(200, G - 18, 4, 36)], ['kayma', 'dusman'], { needs: ['kayma'] }),
  // ---- duvar: kısa kuyu (girişte boşta oyuncu için çukur)
  M('mk-kuyu-kisa', 660, [ground(0, 60), ground(170, 490), wall(260, G - 490, 410), wall(440, G - 260, 260), plat(480, G - 260, 150), ...coinCol(355, G - 130, 4, 50), ...coins(500, G - 310, 3, 40)], ['duvar'], { needs: ['duvar'] }),
  // ---- süzülme: yalnız süzülerek geçilen çukur, notalar süzülme izinde
  M('mk-suzul-yayi', 700, [ground(0, 160), ground(440, 260), spike(610, 32), coin(230, G - 176), coin(280, G - 186), coin(330, G - 172), coin(380, G - 150), coin(430, G - 128)], ['suzul', 'bosluk'], { needs: ['suzul'] }),
  // ---- zar: tek, çift ve "Mükemmel" merdiveni; vuruşta sıçrayan zar
  M('mk-zar-tek', 560, [ground(0, 150), trampoline(230, G + 60, 140), block(310, G - 200, 250, 400), ...trampArc(198, 5), ...trampArc(198, 2, { perfect: true, from: 0.46, to: 0.54 })], ['zar'], { needs: ['trambolin'] }),
  M('mk-zar-cift', 840, [ground(0, 140), trampoline(220, G + 60, 140), block(300, G - 180, 130, 380), trampoline(510, G + 60, 140, 1.2), block(590, G - 400, 250, 600), ...trampArc(190, 4), ...trampArc(560, 4, { power: 1.2, to: 0.36 }), ...coins(640, G - 440, 4, 44)], ['zar', 'zincir'], { needs: ['trambolin'], difficulty: 3 }),
  M('mk-zar-vurus', 600, [ground(0, 150), trampoline(230, G + 60, 140, 1, { beat: true }), block(310, G - 200, 290, 400), ...trampArc(198, 4), ...trampArc(198, 2, { power: 1.1, from: 0.46, to: 0.54 })], ['zar', 'ritim'], { needs: ['trambolin'] }),
  // ---- çakılma: kalkanlı (üstünden zıpla ya da çakılıp yen)
  M('mk-kalkanli', 460, [ground(0, 460), enemy(250, G, 'kalkanli', 20), ...jumpArc(130, 4, 1)], ['dusman', 'cakil'], { needs: ['cakil'] }),
  // ---- yüzme: kısa havuz (dipte diken, yüzeyde gürültü)
  M('mk-havuz-kisa', 640, [bank(0, 160, 200), ...pool(160, 320, 200), spike(260, 60, G + 200), hazard(360, G - 14, 60, 96), bubble(300, G + 110), ...coins(205, G + 80, 3, 40), bank(480, 160, 200)], ['su'], { needs: ['yuz'] }),
  // ---- ses darbesi
  M('mk-bariyer', 420, [ground(0, 420), barrier(200, G - 170, 170), ...coins(250, G - 60, 3, 40)], ['darbe'], { needs: ['darbe'] }),
  // ---- yerçekimi çevirme
  M('mk-cevir-kisa', 640, [ground(0, 640), plat(130, G - 300, 400, 40), grav(130, G - 260, 400, 260), spike(230, 120), ...coins(240, G - 236, 3, 40)], ['cevir'], { needs: ['cevir'] }),
];
