import { describe, expect, it } from 'vitest';
import type { LevelSpec, ObjectiveSpec, RunResult } from '@odi/shared';
import { ACHIEVEMENTS, BIOMES, HUMAN_JOURNEY, TIER_REWARD, achievementById, achievementName } from '@odi/content';
import { earnLines, lossTips, lossView, nextGoal, star3View, unlockAnnouncements } from './index';

/** YN-093: sonuç ekranı tur 4 (3. yıldızın tam koşulu, bölüme göre kayıp ipucu, başarım dökümü, biyom başarımı adı) */
const run = (over: Partial<RunResult> = {}): RunResult => ({ levelId: 'x', completed: true, stars: 2, score: 700, coins: 62, timeSec: 50, deaths: 0, damageTaken: 1, objectiveMet: false, secretFound: false, ...over });
const spec = (n: number, objective: ObjectiveSpec, over: Partial<LevelSpec> = {}) => {
  const l = HUMAN_JOURNEY.levels[n - 1]!;
  return { number: n, name: l.name, biome: l.biome, mechanic: l.mechanic, objective, parTimeSec: 60, coinsTotal: 100, modifiers: [], ...over };
};
const EMOJI = /\p{Extended_Pictographic}/u;

describe('3. yıldız kartı: koşul her zaman tam (OT-rekabetci-17)', () => {
  // 26 Derin Kıvrım: yüzme + altın koklea; 62 notada da 54 notada da aynı koşul metni
  const secret = spec(26, { id: 'secret', label: '3 altın kokleayı bul' });
  it('altın koklea (yüzme bölümü): nota şartı tutunca yazıdan düşmez, tutan parça işaretli', () => {
    expect(secret.mechanic).toBe('yuzme');
    const at62 = star3View(secret, run({ coins: 62, extra: { cochleas: 2, cochleasTotal: 3 } })).rows[1]!;
    expect(at62).toEqual({ text: '3 altın kokleayı bul ve 60 nota', done: false, note: '60 nota tamam · 2/3 altın koklea', parts: [{ text: '60 nota tamam', done: true }, { text: '2/3 altın koklea', done: false }] });
    const at54 = star3View(secret, run({ coins: 54, extra: { cochleas: 2, cochleasTotal: 3 } })).rows[1]!;
    expect(at54.text).toBe(at62.text);
    expect(at54.note).toBe('6 nota kaldı · 2/3 altın koklea');
    // hedef tuttu, nota eksik: tutan parça önde
    expect(star3View(secret, run({ coins: 54, objectiveMet: true, extra: { cochleas: 3, cochleasTotal: 3 } })).rows[1]).toMatchObject({ done: false, note: '3/3 altın koklea · 6 nota kaldı', parts: [{ done: true }, { done: false }] });
    // ikisi de tamam: satır tamam, not yok
    expect(star3View(secret, run({ coins: 62, stars: 3, objectiveMet: true, extra: { cochleas: 3, cochleasTotal: 3 } })).rows[1]).toEqual({ text: '3 altın kokleayı bul ve 60 nota', done: true, note: '' });
    expect(nextGoal(secret, run({ coins: 62 })).text).toBe(nextGoal(secret, run({ coins: 54 })).text);
    expect(nextGoal(secret, run({ coins: 62 })).text).toBe('3. yıldız: 90 nota ya da 3 altın kokleayı bul ve 60 nota');
  });
  it('melodi, hasarsız, eskort: aynı tam metin ve iki parçanın ilerlemesi', () => {
    const melody = spec(19, { id: 'melody', target: 7, label: 'Notaları sırayla topla (7)' });
    expect(star3View(melody, run({ coins: 70, extra: { melody: 4, melodyTotal: 7 } })).rows[1]).toMatchObject({ text: 'Notaları sırayla topla (7) ve 60 nota', note: '60 nota tamam · 4/7 sırayla' });
    const nd = spec(15, { id: 'no-damage', label: 'Hiç hasar alma' });
    expect(star3View(nd, run({ coins: 70, damageTaken: 2 })).rows[1]).toMatchObject({ text: 'Hiç hasar alma ve 60 nota', note: '60 nota tamam · 2 hasar aldın' });
    const esc = spec(17, { id: 'escort', label: 'Fısıltıyı kapıya taşı' });
    expect(star3View(esc, run({ coins: 70 })).rows[1]).toMatchObject({ text: 'Fısıltıyı kapıya taşı ve 60 nota', note: '60 nota tamam · Fısıltı yolda kaldı' });
    // süreli hedefte nota şartı yok (star3Objective 0): metin yalnız süre
    const timed = spec(18, { id: 'timed', target: 64, target2: 75, label: '64 saniyede bitir' });
    expect(star3View(timed, run({ coins: 70, timeSec: 66 })).rows[1]!.text).toBe('64 saniyede bitir');
  });
});

describe('kayıpta ipucu bölüme göre ve dönüşümlü (OT-ilk-kez-oyun-19)', () => {
  // 19 Makine Melodisi: sis + "Notaları sırayla topla"; 4 kayıpta aynı cümle gelmez
  const l19 = spec(19, { id: 'melody', target: 7, label: 'Notaları sırayla topla (7)' }, { modifiers: ['sis'] });
  const fall = run({ completed: false, stars: 0, damageTaken: 3, extra: { reason: 'fall' } });
  it('19. bölüm: ilk ipucu son hasarın nedeni, sonra sis, melodi, mekanik; art arda 4 kayıpta 4 farklı cümle (OT-ilk-kez-oyun-50)', () => {
    const tips = [1, 2, 3, 4].map((a) => lossView(fall, l19, a).tip);
    expect(tips[0]).toBe('Boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.');
    expect(tips[1]).toMatch(/^Siste yalnız Odi'nin çevresi aydınlık/);
    expect(tips[2]).toMatch(/soldan sağa, hiç atlamadan topla/);
    expect(tips[3]).toMatch(/^Kancanın yanında basılı tut/);
    expect(new Set(tips).size).toBe(4);
    // döngü: beşinci ipucu da bölüme ait, sonra başa döner
    const all = lossTips('fall', l19); expect(lossView(fall, l19, all.length + 1).tip).toBe(tips[0]);
    for (const t of all) expect(EMOJI.test(t)).toBe(false);
  });
  it('gece, gecikme ve canavar bölümleri kendi ipuçlarını verir; yeni mekaniğin ilk bölümü önce mekaniği anlatır', () => {
    // neden bilinmiyorsa değiştiricinin ipucu önde
    const unknown = run({ completed: false, stars: 0, damageTaken: 3, extra: { reason: '' } });
    expect(lossView(unknown, spec(26, { id: 'secret', label: 'x' }, { modifiers: ['gece'] })).tip).toMatch(/^Gecede yalnız Odi'nin çevresi görünür/);
    expect(lossTips('fall', spec(26, { id: 'secret', label: 'x' }, { modifiers: ['gece'] }))[1]).toMatch(/^Gecede yalnız Odi'nin çevresi görünür/);
    expect(lossTips('fall', spec(36, { id: 'reach', label: 'x' }, { modifiers: ['yanki'] }))).toContain('Gecikmede dokunuşun bir an geç işler: zıplamaya biraz erken bas.');
    const boss = spec(20, { id: 'boss', label: 'x' }, { coinsTotal: 0 });
    const hit = run({ completed: false, stars: 0, damageTaken: 3, extra: { reason: 'yumruk' } });
    expect([1, 2].map((a) => lossView(hit, boss, a).tip)).toEqual(['Zayıf noktası açılınca havadan aşağı kaydırıp üstüne in · Saldırıdan önceki uyarıyı görünce kaç', expect.stringMatching(/uyarı görünür/)]);
    expect(lossView(fall, spec(13, { id: 'reach', label: 'x' })).tip).toMatch(/^Kancanın yanında basılı tut/);
    // yarış bitti: ipucu yok
    expect(lossView(run({ completed: false, stars: 0, extra: { reason: 'yaris-bitti' } }), l19, 2).tip).toBe('');
  });
});

describe('kayıp ipucu: neden önce, yetenek önerisi yok, canavara nasıl vurulur (OT-ilk-kez-oyun-46, -50)', () => {
  const lost = (reason: string) => run({ completed: false, stars: 0, damageTaken: 3, extra: { reason } });
  it('39. bölümde gürültü duvarına çarpınca (sis/gece olsa da) önce duvarın ipucu; hiçbir bölümde jetonlu yetenek önerilmez', () => {
    for (const mods of [[], ['sis'], ['gece'], ['sis', 'hiz']] as const) {
      const sp = spec(39, { id: 'timed', target: 70, label: 'x' }, { modifiers: [...mods] });
      expect(lossView(lost('gurultu'), sp, 1).tip).toBe('Gürültü duvarına koşu yönüne kaydırarak fırla: kırılır. Fırlamadan değersen hasar alırsın.');
    }
    for (const l of HUMAN_JOURNEY.levels) for (const reason of ['fall', 'diken', 'gurultu', 'dusman', '']) for (const modifiers of [['sis'], ['gece'], ['yanki', 'hiz']] as const) {
      for (const t of lossTips(reason, spec(l.number, { id: l.objective, label: 'x' }, { modifiers: [...modifiers] }))) expect(t, `${l.number} ${reason}`).not.toMatch(/Yankı Görüşü|yetene/i);
    }
  });
  it('40. bölüm: ilk ipucu kalbe nasıl vurulacağını kartlardaki fiillerle söyler', () => {
    const sp = spec(40, { id: 'boss', label: 'x' }, { coinsTotal: 0 });
    const tips = [1, 2].map((a) => lossView(lost('dalga'), sp, a).tip);
    expect(tips[0]).toBe('Bağırınca çıkan 3 notayı topla: kalbi açılınca ileri fırla ya da havadan aşağı kaydırıp üstüne in.');
    expect(tips[1]).toMatch(/uyarı görünür/);
    for (const t of lossTips('dalga', sp)) expect(t).not.toMatch(/atıl|çakıl\b/i);
  });
});

describe('kayıpta ipucu mekaniğe uyar: Ses Darbesi ve Yerçekimi (OT-ilk-kez-oyun-37)', () => {
  const lost = (reason: string) => run({ completed: false, stars: 0, damageTaken: 3, extra: { reason } });
  const JUMP = /zıpla/i;
  it('impuls + gurultu: ipucu gürültü duvarını ve nasıl kırılacağını anlatır; yeni mekaniğin ilk bölümünde de mekanik listesinden önce', () => {
    for (const n of [31, 32, 33, 34]) {
      const sp = spec(n, { id: 'reach', label: 'x' }); expect(sp.mechanic).toBe('impuls');
      const v = lossView(lost('gurultu'), sp, 1);
      expect(v.detail).toBe('3 kez hasar aldın, en son bir engele çarptın.');
      expect(v.tip).toBe('Gürültü duvarına koşu yönüne kaydırarak fırla: kırılır. Fırlamadan değersen hasar alırsın.');
      const all = lossTips('gurultu', sp);
      expect(all[0]).toBe(v.tip);
      for (const t of all) { expect(JUMP.test(t)).toBe(false); expect(EMOJI.test(t)).toBe(false); }
    }
  });
  it('impuls bölümünde boşluğa düşünce koşunun "zıpla" ipucu gelmez; fırlama ve yankı yolu anlatılır', () => {
    for (const n of [31, 32, 33, 34, 39]) {
      const all = lossTips('fall', spec(n, { id: 'reach', label: 'x' }));
      expect(all).not.toContain('Boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.');
      expect(all[0]).toMatch(/^Yankı yoluna gelmeden koşu yönüne kaydır/);
      for (const t of all) expect(JUMP.test(t)).toBe(false);
    }
  });
  it('ruya: yerçekimi bölgesi okuyla anılır, dokunuşun orada zıplatmadığı söylenir; gurultu kendi cümlesiyle', () => {
    for (const n of [35, 36, 37, 38]) {
      const sp = spec(n, { id: 'reach', label: 'x' }); expect(sp.mechanic).toBe('ruya');
      const fall = lossTips('fall', sp);
      expect(fall).not.toContain('Boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.');
      expect(fall[0]).toBe('Oklu mor bölgede dokunuş zıplatmaz, yerçekimini çevirir: zemin bitmeden tavana, tavan bitmeden zemine çevir.');
      expect(fall).toContain('Oklu mor bölgede dokun: yerçekimini çevir');
      expect(lossTips('gurultu', sp)[0]).toMatch(/^Gürültü duvarına koşu yönüne kaydırarak fırla/);
    }
  });
  it('koşu bölümünde gurultu genel engel cümlesini alır; ötekiler değişmez', () => {
    const kosu = spec(4, { id: 'reach', label: 'x' }); expect(kosu.mechanic).toBe('kosu');
    expect(lossTips('gurultu', kosu)).toEqual(['Engele değme: üstünden zıpla, sarkan perdenin altından aşağı kaydırıp kay, yanıp sönen engelde söndüğü anı bekle.']);
    expect(lossTips('fall', kosu)).toEqual(['Boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.']);
  });
});

describe('"Bu bölümden" dökümü ve biyom başarımı (OT-ekonomi-denetci-17, OT-ogrenci-birinci-16)', () => {
  const g = (reason: string, jeton: number) => ({ reason, items: [{ kind: 'jeton' as const, amount: jeton }, { kind: 'xp' as const, amount: 5 }] });
  it('birden çok başarım: toplam satırının altında adları, kademeleri ve tek tek ödülleri; toplam cüzdanla tutar', () => {
    const grants = [g('bolum:19', 62), g('basarim:yildiz-avcisi:2', 40), g('basarim:biyom-kemikcikler:1', 15), g('basarim:ilk-ses:1', 15), g('basarim:tuy-gibi:3', 100)];
    const lines = earnLines({ grants }, 20);
    const total = lines.reduce((a, l) => a + l.jeton, 0);
    expect(total).toBe(62 + 40 + 15 + 15 + 100 + 20);
    const ach = lines.find((l) => l.items)!;
    expect(ach.label).toBe('4 başarım'); expect(ach.jeton).toBe(170);
    expect(ach.items!.reduce((a, x) => a + x.jeton, 0)).toBe(ach.jeton);
    expect(ach.items![0]).toEqual({ label: 'Yıldız Avcısı · Gümüş', jeton: 40, note: 'Toplam 50 yıldız topla' });
    expect(lines.map((l) => l.label)).toEqual(['Toplanan notalar', '4 başarım', 'Kamp/takım bonusu']);
  });
  it('biyom başarımı: bronz "Gezgini", altın "Ustası"; satır koşulu yazar; kimlik ve ödüller aynı', () => {
    const n = HUMAN_JOURNEY.levels.filter((l) => l.biome === 'kemikcikler').length;
    const [one] = earnLines({ grants: [g('basarim:biyom-kemikcikler:1', TIER_REWARD[1][0]!.amount)] });
    expect(one).toEqual({ label: 'Başarım: Kemikçikler Gezgini · Bronz', jeton: 15, note: `Kemikçikler biyomunda toplam ${n} yıldız topla` });
    const a = achievementById('biyom-kemikcikler')!;
    expect([1, 2, 3].map((t) => achievementName(a, t as 1 | 2 | 3))).toEqual(['Kemikçikler Gezgini', 'Kemikçikler Kâşifi', 'Kemikçikler Ustası']);
    expect(a.tiers).toEqual([n, n * 2, n * 3]);
    for (const b of Object.keys(BIOMES)) expect(achievementById(`biyom-${b}`)).toBeTruthy();
    // diğer başarımların adı kademeyle değişmez
    expect(achievementName(achievementById('yildiz-avcisi')!, 1)).toBe('Yıldız Avcısı');
    expect(ACHIEVEMENTS.filter((x) => x.tierNames).every((x) => x.tierNames!.length === x.tiers.length)).toBe(true);
  });
});

describe('yenilik duyurusu: "mekanik" kelimesi ve emoji yok (OT-ilk-kez-oyun-22)', () => {
  it('20. bölümden önce "Yeni: Canavar bölümleri"; diğer hareketler "Yeni: <ad>"', () => {
    expect(unlockAnnouncements(19).find((a) => a.kind === 'mekanik')?.title).toBe('Yeni: Canavar bölümleri');
    expect(unlockAnnouncements(12).find((a) => a.kind === 'mekanik')?.title).toBe('Yeni: Kanca ve Çakılma');
    for (let n = 1; n < HUMAN_JOURNEY.levels.length; n++) for (const a of unlockAnnouncements(n)) { expect(a.title).not.toMatch(/mekanik/i); expect(EMOJI.test(a.title)).toBe(false); }
  });
});
