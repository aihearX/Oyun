// Parça yüklenirken çizilen başlık (nav.ts SCREEN_TITLE, YN-072) ekranın kendi başlığıyla aynı olmalı: yoksa yükleme bitince ad değişir.
// Ekran modülleri burada içe aktarılmaz (ana pakete çekilmesinler diye ad nav.ts'te ayrıca yazılı); kaynakta başlık aranır.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_TITLE, SCREEN_TITLE, closeTopLayer, pushBackLayer } from './nav';

const FILE: Record<string, string> = {
  skills: 'screens/SkillsScreen.tsx', settings: 'screens/SettingsScreen.tsx', achievements: 'screens/AchievementsScreen.tsx', album: 'screens/AlbumScreen.tsx',
  glossary: 'screens/GlossaryScreen.tsx', wardrobe: 'screens/WardrobeScreen.tsx', info: 'screens/InfoScreen.tsx', friends: 'screens/FriendsScreen.tsx',
  messages: 'screens/FriendsScreen.tsx', shop: 'screens/ShopScreen.tsx', inbox: 'screens/InboxScreen.tsx', league: 'screens/InboxScreen.tsx',
  birlikte: 'comm/Together.tsx', siralama: 'rank/RankScreen.tsx', kurucular: 'kurucu/Kurucular.tsx', race: 'race/RaceLobby.tsx', pratik: 'events/Pratik.tsx',
};

describe('yükleme başlığı (SCREEN_TITLE)', () => {
  it.each(Object.entries(SCREEN_TITLE))('%s → "%s" ekranın başlığıyla aynı', (route, title) => {
    const file = FILE[route];
    expect(file, `${route} için ekran dosyası test listesinde yok`).toBeTruthy();
    const src = readFileSync(resolve(__dirname, file ?? ''), 'utf8');
    expect(src.includes(`title="${title}"`), `${file} içinde title="${title}" yok`).toBe(true);
  });
});

describe('etkinlik yükleme başlığı (EVENT_TITLE)', () => {
  const src = readFileSync(resolve(__dirname, 'events/common.tsx'), 'utf8');
  const hub = readFileSync(resolve(__dirname, 'events/EventsScreen.tsx'), 'utf8');
  it.each(Object.entries(EVENT_TITLE))('%s → "%s" ekranın başlığıyla aynı', (view, title) => {
    if (view === 'merkez') expect(hub.includes(`<h1>${title}</h1>`), `EventsScreen.tsx içinde <h1>${title}</h1> yok`).toBe(true);
    else expect(src.includes(`${view}: { name: '${title}'`), `events/common.tsx EVENT_META.${view}.name "${title}" değil`).toBe(true);
  });
});

describe('geri katmanları (YN-248, OT-rekabetci-49)', () => {
  it('geri tuşu yalnız en üstteki katmanı kapatır; katman yoksa geri ekrana kalır', () => {
    const closed: string[] = [];
    const offA = pushBackLayer(() => closed.push('sayfa'));
    const offB = pushBackLayer(() => closed.push('profil'));
    expect(closeTopLayer()).toBe(true);
    expect(closed).toEqual(['profil']);
    offB(); // kart kapandı: yığından çıkar
    expect(closeTopLayer()).toBe(true);
    expect(closed).toEqual(['profil', 'sayfa']);
    offA(); offA(); // ikinci çağrı bir şey yapmaz
    expect(closeTopLayer()).toBe(false);
  });
  it('alttaki katman önce kapanırsa sıra bozulmaz', () => {
    const closed: string[] = [];
    const offA = pushBackLayer(() => closed.push('alt'));
    const offB = pushBackLayer(() => closed.push('ust'));
    offA();
    expect(closeTopLayer()).toBe(true);
    expect(closed).toEqual(['ust']);
    offB();
    expect(closeTopLayer()).toBe(false);
  });
});
