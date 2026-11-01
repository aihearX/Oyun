// Parça yüklenirken çizilen başlık (nav.ts SCREEN_TITLE, YN-072) ekranın kendi başlığıyla aynı olmalı: yoksa yükleme bitince ad değişir.
// Ekran modülleri burada içe aktarılmaz (ana pakete çekilmesinler diye ad nav.ts'te ayrıca yazılı); kaynakta başlık aranır.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCREEN_TITLE } from './nav';

const FILE: Record<string, string> = {
  skills: 'screens/SkillsScreen.tsx', settings: 'screens/SettingsScreen.tsx', achievements: 'screens/AchievementsScreen.tsx', album: 'screens/AlbumScreen.tsx',
  glossary: 'screens/GlossaryScreen.tsx', wardrobe: 'screens/WardrobeScreen.tsx', info: 'screens/InfoScreen.tsx', friends: 'screens/FriendsScreen.tsx',
  messages: 'screens/FriendsScreen.tsx', shop: 'screens/ShopScreen.tsx', inbox: 'screens/InboxScreen.tsx', league: 'screens/InboxScreen.tsx',
  birlikte: 'comm/Together.tsx', siralama: 'rank/RankScreen.tsx', kurucular: 'kurucu/Kurucular.tsx', race: 'race/RaceLobby.tsx',
};

describe('yükleme başlığı (SCREEN_TITLE)', () => {
  it.each(Object.entries(SCREEN_TITLE))('%s → "%s" ekranın başlığıyla aynı', (route, title) => {
    const file = FILE[route];
    expect(file, `${route} için ekran dosyası test listesinde yok`).toBeTruthy();
    const src = readFileSync(resolve(__dirname, file ?? ''), 'utf8');
    expect(src.includes(`title="${title}"`), `${file} içinde title="${title}" yok`).toBe(true);
  });
});
