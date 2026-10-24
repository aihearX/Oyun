import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, PRIVACY_DRAFT, PRIVACY_SECTIONS } from './legal';

describe('Gizlilik ve hakkında', () => {
  it('sürüm mobil app.json ile aynı; hukuk onayına kadar taslak; Türkçe karakterler doğru', () => {
    const app = JSON.parse(readFileSync(resolve(__dirname, '../../mobile/app.json'), 'utf8'));
    expect(APP_VERSION).toBe(app.expo.version);
    expect(PRIVACY_DRAFT).toBe(true);
    const all = PRIVACY_SECTIONS.flatMap((s) => [s.title, ...s.items]).join(' ');
    expect(all).not.toMatch(/\b(icin|degil|sifirla|sohbeti mesajlari|ozet)\b/i);
    expect(all).toContain('Her şeyi sıfırla');
  });
});
