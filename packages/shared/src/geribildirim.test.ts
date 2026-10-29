import { describe, expect, it } from 'vitest';
import { buildFeedback, FEEDBACK_LIMITS, feedbackEndpoint, type FeedbackContext } from './geribildirim';
import { scrubFreeText } from './hata';

const ctx: FeedbackContext = { screen: 'level', app: '0.1.0', build: 'abc123', platform: 'android' };

describe('geri bildirim: serbest metin temizleyicisi', () => {
  it('e-posta, telefon, uzun rakam dizisi, anahtar ve arkadaş kodu benzeri dizgileri çıkarır', () => {
    const pid = 'p3fa91b2c7d4e5f60';
    const s = scrubFreeText(`Bana ali.veli+test@ornek.com.tr adresinden yaz, tel +90 (532) 123 45 67 ya da 0532-123-4567 ya da 05321234567; TC 12345678901; kart 4111.1111.1111.1111; kimlik ${pid}; arkadaş kodum K7M2QX`);
    for (const x of ['@', 'ali.veli', '532', '4567', '12345678901', '4111', pid, 'K7M2QX']) expect(s, x).not.toContain(x);
    expect(s).toContain('<e-posta>');
    expect(s).toContain('<numara>');
    expect(s).toContain('<anahtar>');
    expect(s).toContain('<kod>');
  });

  it('kısa sayıları, tarih ve sürüm numarasını, tırnak içi yazıyı korur (geri bildirimin kendisi)', () => {
    const s = scrubFreeText('3. bölümde 2 kez takıldım, "Başla" düğmesi 29.10.2026 günü 0.1.0 sürümünde 12500 puanda donuyor');
    expect(s).toBe('3. bölümde 2 kez takıldım, "Başla" düğmesi 29.10.2026 günü 0.1.0 sürümünde 12500 puanda donuyor');
  });

  it('denetim ve görünmez yön karakterlerini, satır sonlarını tek boşluğa indirir; uzunluğu sınırlar', () => {
    expect(scrubFreeText('  satır 1\n\nsatır‮2\u0007 \u001b[31mkırmızı  ')).toBe('satır 1 satır 2 [31mkırmızı');
    const uzun = scrubFreeText('ş'.repeat(800));
    expect(Array.from(uzun)).toHaveLength(FEEDBACK_LIMITS.textMax);
    expect(uzun.endsWith('…')).toBe(true);
    expect(scrubFreeText(42)).toBe('');
  });
});

describe('geri bildirim: kayıt', () => {
  it('yalnız izinli alanlar; metin temizlenir; geçersiz bağlam varsayılana iner; boş metin gönderilmez', () => {
    const r = buildFeedback('hata', 'Haritada takıldım, ayse@ornek.com', ctx)!;
    expect(Object.keys(r).sort()).toEqual(['app', 'build', 'platform', 'screen', 'text', 'topic', 'v']);
    expect(r).toEqual({ v: 1, topic: 'hata', text: 'Haritada takıldım, <e-posta>', screen: 'level', app: '0.1.0', build: 'abc123', platform: 'android' });
    const k = buildFeedback('oneri', 'güzel', { screen: 'harita ekranı', app: 'abc', build: 'x y', platform: 'web' })!;
    expect(k).toMatchObject({ screen: '', app: '0.0.0', build: '' });
    expect(buildFeedback('diger', '   \n ', ctx)).toBeNull();
    expect(buildFeedback('yanlis' as never, 'metin', ctx)).toBeNull();
  });

  it('uç adresi: ws/wss → http/https, yol /geri-bildirim', () => {
    expect(feedbackEndpoint('wss://ornek.duckdns.org')).toBe('https://ornek.duckdns.org/geri-bildirim');
    expect(feedbackEndpoint('ws://127.0.0.1:8787/?x=1')).toBe('http://127.0.0.1:8787/geri-bildirim');
    expect(feedbackEndpoint('')).toBe('');
  });
});
