import type { ChunkSpec } from '@odi/shared';
import { G, barrier, pool, block, bubble, chunk, coinCol, coins, crumble, door, echo, enemy, grav, ground, hazard, hook, plat, secret, spike, sw, text, trampoline, tutor, wall } from './helpers';

/**
 * Öğretici parçalar: her yetenek için oynanarak öğrenilen an. `tutor` tetikleyicisinde ilk kez gelindiğinde
 * zaman yavaşlar, büyük el işareti hareketi gösterir; oyuncu hareketi yapınca normal hıza döner (sahte baskı yok).
 * Aynı parça tekrar oynanırsa üretici `tutor`u kaldırır, yalnızca metin kalır.
 */
/** kayılacak asılı engel: ayakta koşana değer, kayana değmez (alt kenar zemin −24) */
export const curtain = (x: number, w: number, kind = 'tuy') => hazard(x, G - 170, w, 146, kind);

export const OGRETICI_CHUNKS: ChunkSpec[] = [
  chunk('ogret-zipla', 'kosu', 1, 1500, [
    ground(0, 420), text(220, G - 190, 'Dokun: zıpla'), tutor(300, 110, 'zipla'), ...coins(400, G - 110, 3, 40, 30),
    ground(530, 520), spike(760, 40), ...coins(740, G - 120, 3, 36, 20), text(700, G - 200, 'Basılı tut: daha yükseğe'),
    plat(930, G - 110, 120), ...coins(940, G - 160, 3, 40),
    ground(1190, 310), ...coins(1060, G - 150, 3, 40, 30), secret(990, G - 260),
  ], { tags: ['ogretici', 'bosluk'] }),
  chunk('ogret-kayma', 'kosu', 1, 1200, [
    ground(0, 1200), text(180, G - 220, 'Aşağı kaydır: altından kay'), tutor(240, 110, 'kayma'), curtain(380, 110), ...coins(380, G - 20, 3, 40),
    curtain(760, 140), ...coins(770, G - 20, 4, 36), enemy(1040, G - 4, 'devriye', 40), secret(560, G - 200), ...coins(560, G - 120, 3, 36, 20),
  ], { tags: ['ogretici', 'kayma'] }),
  // duvar: B (sol, havada asılı) altından geçilir, A'ya (sağ) değ, sırayla zıpla, A'nın üstünden çık
  chunk('ogret-duvar', 'kosu', 1, 1100, [
    ground(0, 60), ground(170, 930), ...coins(70, G - 110, 3, 36, 20), text(150, G - 230, 'Duvara değince dokun: karşıya zıpla'), tutor(250, 120, 'duvar'),
    wall(260, G - 560, 480), wall(440, G - 330, 330), plat(480, G - 330, 160, 24), ...coinCol(350, G - 140, 4, 50),
    secret(330, G - 470), ...coins(500, G - 380, 3, 40), ...coins(760, G - 60, 4, 40),
  ], { tags: ['ogretici', 'duvar'] }),
  chunk('ogret-suzul', 'trambolin', 1, 1300, [
    ground(0, 360), text(170, G - 200, 'Havada basılı tut: süzül'), tutor(280, 160, 'suzul'), ...coins(400, G - 160, 6, 44, 40),
    ground(760, 160), ...coins(940, G - 170, 5, 44, 30), ground(1170, 130), secret(1000, G - 300),
  ], { tags: ['ogretici', 'suzul', 'bosluk'], needs: ['suzul'] }),
  chunk('ogret-trambolin', 'trambolin', 1, 1150, [
    ground(0, 300), text(140, G - 200, 'Zara değdiğin an dokun'), tutor(240, 160, 'trambolin'),
    trampoline(400, G + 60, 200), block(500, G - 220, 360, 420), ...coinCol(400, G - 60, 5, 50), ...coins(560, G - 280, 5, 44),
    ground(860, 290), secret(400, G - 360),
  ], { tags: ['ogretici', 'zar'] }),
  chunk('ogret-kanca', 'makine', 1, 1400, [
    ground(0, 320), text(150, G - 210, 'Kancanın yanında basılı tut, bırakınca fırla'), tutor(220, 280, 'kanca'),
    hook(610, G - 290, 190), ...coins(470, G - 170, 3, 50, 30), ...coins(720, G - 200, 3, 50, 30),
    hazard(330, G - 470, 560, 70, 'gurultu'), ground(930, 470), secret(610, G - 380),
  ], { tags: ['ogretici', 'kanca'] }),
  // çakılma: oda — anahtara çakıl, kapı açılır (kaçırırsan kapıda dönüp tekrar gelirsin)
  chunk('ogret-cakil', 'makine', 1, 1300, [
    ground(0, 60), ground(170, 1130), block(230, G - 100, 170, 100), text(220, G - 300, 'Havada aşağı kaydır: anahtara çakıl'), tutor(430, 150, 'cakil'),
    sw(580, G, 'ogret-k1'), door(820, G - 220, 220, 'ogret-k1'), ...coins(530, G - 150, 3, 36, 20), ...coins(900, G - 60, 4, 40),
    crumble(1060, G - 110, 110), secret(1115, G - 170),
  ], { tags: ['ogretici', 'cakil', 'anahtar'] }),
  chunk('ogret-yuz', 'yuzme', 1, 1500, [
    block(0, G, 300, 460), text(150, G - 190, 'Sıvıda basılı tut: yüksel · Bırak: dal'), tutor(300, 260, 'yuz'),
    ...pool(300, 860, 250),
    spike(560, 60, G + 250), spike(840, 60, G + 250), hazard(660, G - 10, 90, 120, 'gurultu'), bubble(760, G + 160), ...coins(420, G + 170, 3, 40), ...coins(950, G + 60, 4, 40),
    block(1160, G, 340, 460), secret(700, G + 220),
  ], { tags: ['ogretici', 'su'], needs: ['yuz'] }),
  chunk('ogret-darbe', 'impuls', 1, 1300, [
    ground(0, 1300), text(150, G - 220, 'İleri kaydır: ses darbesi'), tutor(260, 140, 'darbe'), barrier(450, G - 160),
    ...coins(520, G - 60, 3, 36), barrier(780, G - 160), text(900, G - 300, 'Darbe yankı yollarını gösterir'),
    echo(930, G - 110, 110), echo(1070, G - 210, 110), ...coins(950, G - 160, 3, 36), secret(1125, G - 280), enemy(1220, G, 'devriye', 30),
  ], { tags: ['ogretici', 'darbe'] }),
  chunk('ogret-cevir', 'ruya', 1, 1300, [
    ground(0, 1300), plat(300, G - 300, 820, 40), text(150, G - 230, 'Mor bölgede dokun: yerçekimini çevir'), tutor(260, 120, 'cevir'),
    grav(300, G - 260, 820, 260), spike(480, 120), spike(800, 140), ...coins(470, G - 240, 4, 40), ...coins(790, G - 240, 4, 40), secret(1000, G - 240),
  ], { tags: ['ogretici', 'cevir'] }),
];
