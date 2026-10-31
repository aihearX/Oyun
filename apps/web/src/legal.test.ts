import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMM_RULES, CRASH_LIMITS, FEEDBACK_LIMITS, FRIEND_LIMITS, SPEND_LIMIT_SUGGESTED_TRY } from '@odi/shared';
import { APP_VERSION } from './legal';
import { GIZLILIK_EN, GIZLILIK_TR, HAKKINDA, HESAP_SIL, YASAL_SAYFALAR } from './yasal/metin';
import { sayfaHtml } from './yasal/sayfa';
import { AYAR, belgeDoldur, degerler, doldur, duzMetin, gecerliAdres, satirParcala, type Belge, type YasalAyar } from './yasal/yasal';
import { CHAT_RETAIN_MS } from '../../server/src/chat';
import { RUN_RETAIN_MS } from '../../server/src/progress';
import { PROMO_LOG_RETAIN_MS } from '../../server/src/codes';
import { PURCHASE_RETAIN_YEARS, REPORT_RETAIN_MS } from '../../server/src/account-veri';
import { LIMIT_RAISE_DELAY_MS } from '../../server/src/shop';
import { HESAP_SIL_BEKLEME_GUN } from '../../server/src/yonetim';
import { CRASH_RETAIN_MS } from '../../server/src/hata';
import { FEEDBACK_RETAIN_MS } from '../../server/src/geribildirim';

const DAY = 86_400_000;
const root = resolve(__dirname, '../../..');
const tum: Belge[] = [GIZLILIK_TR, GIZLILIK_EN, HESAP_SIL, HAKKINDA];
const doluAyar: YasalAyar = { YAYINCI: 'aiHear', YAYINCI_UNVAN: 'Örnek Ltd. Şti.', YAYINCI_ADRES: 'Örnek Mah. 1, İstanbul', ILETISIM_EPOSTA: 'destek@ornek.invalid', SUNUCU_BOLGESI: 'Frankfurt, Almanya', YURURLUK: '2026-10-27' };

describe('Gizlilik, hesap silme ve hakkında metinleri', () => {
  it('sürüm mobil app.json ile aynı', () => {
    const app = JSON.parse(readFileSync(resolve(root, 'apps/mobile/app.json'), 'utf8'));
    expect(APP_VERSION).toBe(app.expo.version);
  });

  it('bütün yer tutucular tanınıyor; boş ayar sayfada "eklenecek" yazar, dolu ayar yerine geçer', () => {
    for (const b of tum) for (const dil of ['tr', 'en'] as const) expect(() => belgeDoldur({ ...b, dil }, AYAR, '0.1.0')).not.toThrow();
    expect(() => doldur('{YOK_BOYLE}', degerler('tr'))).toThrow(/bilinmeyen/);
    const bos = duzMetin(belgeDoldur(GIZLILIK_TR, { ...doluAyar, ILETISIM_EPOSTA: '', YAYINCI_UNVAN: '' }));
    expect(bos).toContain('‹iletişim e-postası eklenecek›');
    // boş e-postanın bağlantısı düz yazı olur (ham [..](mailto:..) sayfaya çıkmaz)
    expect(bos).not.toMatch(/\]\(mailto:/);
    expect(bos).toContain('Veri sorumlusu: aiHear');
    const dolu = belgeDoldur(HESAP_SIL, doluAyar);
    expect(duzMetin(dolu)).toContain('destek@ornek.invalid');
    expect(duzMetin(dolu)).not.toMatch(/\{[A-Z_]+\}/);
    // e-posta yoksa mailto bağlantısı düz yazıya döner (kırık bağlantı yok)
    expect(satirParcala('[x](mailto:?subject=a)')).toEqual([{ t: 'yazi', x: 'x' }]);
    expect(gecerliAdres('mailto:destek@ornek.invalid?subject=Hesap%20silme')).toBe(true);
    expect(gecerliAdres('http://dis.example')).toBe(false);
  });

  it('sayılar sunucu sabitleriyle aynı (kod değişirse metin de değişmeli)', () => {
    expect(CHAT_RETAIN_MS).toBe(30 * DAY);
    expect(RUN_RETAIN_MS).toBe(30 * DAY);
    expect(REPORT_RETAIN_MS).toBe(90 * DAY);
    expect(PROMO_LOG_RETAIN_MS).toBe(90 * DAY);
    expect(PURCHASE_RETAIN_YEARS).toBe(10);
    expect(FRIEND_LIMITS.dmKeep).toBe(500);
    expect(FRIEND_LIMITS.reportsToMute).toBe(3);
    expect(COMM_RULES.freeTextLevel).toBe(8);
    expect(SPEND_LIMIT_SUGGESTED_TRY).toBe(100);
    expect(LIMIT_RAISE_DELAY_MS).toBe(DAY);
    expect(HESAP_SIL_BEKLEME_GUN).toBe(14);
    expect(CRASH_RETAIN_MS).toBe(30 * DAY);
    expect(CRASH_LIMITS.perSession).toBe(5);
    expect(FEEDBACK_RETAIN_MS).toBe(90 * DAY);
    expect([FEEDBACK_LIMITS.perIpHour, FEEDBACK_LIMITS.perIpDay, FEEDBACK_LIMITS.textMax]).toEqual([5, 20, 500]);
    const ortak = readFileSync(resolve(root, 'tools/sunucu/ortak.sh'), 'utf8');
    expect(ortak).toMatch(/^ODI_BACKUP_HOURS=6$/m);
    expect(ortak).toMatch(/^ODI_BACKUP_KEEP=28$/m);
    expect(ortak).toMatch(/^MaxRetentionSec=30day$/m);
    expect(ortak).toContain('try_files {path} {path}.html /index.html');
    const tr = duzMetin(GIZLILIK_TR); const en = duzMetin(GIZLILIK_EN); const hs = duzMetin(HESAP_SIL);
    for (const s of ['30 gün', '90 gün', 'son 500 mesaj', '8 bölüm', '10 yıl', '28 kopya (7 gün)', 'önerilen 100 TL', 'ayrıca onay ister', '24 saat']) expect(tr).toContain(s);
    for (const s of ['30 days', '90 days', 'Last 500 messages', '8 levels', '10 years', '28 copies (7 days)', '100 TRY suggested', 'separate confirmation', '24 hours']) expect(en).toContain(s);
    // çökme raporu (YN-011): ne gider, ne gitmez, kaç gün
    expect(tr).toContain('Çökme raporları: Oyun bir hatayla');
    for (const k of ['oyuncu kimliğinizi, takma adınızı, anahtarınızı, sohbet metinlerini ya da bir cihaz kimliğini içermez', 'en çok 5 rapor', '30 gün sonra otomatik silinir']) expect(tr).toContain(k);
    expect(en).toContain('Crash reports: if the game hits an error');
    for (const k of ['does not contain your player ID, nickname, key, chat text or any device identifier', 'at most 5 reports', 'deleted automatically after 30 days']) expect(en).toContain(k);
    // beta geri bildirimi: ne gider, ne gitmez, sınır, kaç gün; Caddy yalnız /geri-bildirim'i açar
    expect(tr).toContain('Geri bildirim: Profil › Ayarlar › Geri bildirim gönder');
    for (const k of ['en çok 500 karakter', 'e-posta adresleri, telefon numaraları ve uzun sayılar', 'oyuncu kimliğinizi, takma adınızı, anahtarınızı ya da bir cihaz kimliğini içermez', 'adınızı, telefonunuzu ya da e-postanızı yazmayın', 'saatte 5, günde 20 not', '90 gün sonra otomatik silinir']) expect(tr).toContain(k);
    expect(en).toContain('Feedback: if you want, you can send us a short note');
    for (const k of ['at most 500 characters', 'e-mail addresses, phone numbers and long numbers removed', 'does not contain your player ID, nickname, key or any device identifier', 'do not write your name, phone number or e-mail address', '5 notes an hour, 20 a day', 'deleted automatically after 90 days']) expect(en).toContain(k);
    expect(hs).toContain('Geri bildirim notları da hesaba bağlı değildir; 90 günde');
    // Kurucu Yolcu (YN-041): kişisel bilgi istenmez, liste yalnız oyuncunun seçimiyle (varsayılan kapalı), "Öneren" yalnız açık izinle, silinince gider
    for (const k of ['hiçbir kişisel bilgi istenmez', 'yalnızca siz "Adım listede görünsün" seçeneğini açarsanız', 'baştan kapalıdır', 'yalnızca siz açıkça izin verirseniz', 'rozetleriniz ve listedeki yeriniz de silinir']) expect(tr).toContain(k);
    for (const k of ['do not ask for any personal information', 'only if you turn on', 'off by default', 'only with your explicit permission', 'also deletes your badges']) expect(en).toContain(k);
    expect(hs).toContain('Kurucular listesindeki yeriniz');
    expect(ortak).toMatch(/handle \/geri-bildirim \{\s*request_body \{\s*max_size 4KB/);
    expect(hs).toContain('Çökme raporları hesaba bağlı değildir');
    expect(hs).toContain(`son ${HESAP_SIL_BEKLEME_GUN} gün`);
    expect(hs).toContain(`${HESAP_SIL_BEKLEME_GUN} days`);
  });

  it('oyun içi yol ile metin aynı: Profil › Ayarlar › Hesabı sil, Her şeyi sil', () => {
    const ayarlar = readFileSync(resolve(root, 'apps/web/src/screens/SettingsScreen.tsx'), 'utf8');
    expect(ayarlar).toContain('<h2>Hesabı sil</h2>');
    // Profil › Ayarlar › Geri bildirim gönder (gizlilik metni §3) ve kartın uyarısı
    expect(ayarlar).toContain('<GeriBildirimKart />');
    const gb = readFileSync(resolve(root, 'apps/web/src/screens/GeriBildirimKart.tsx'), 'utf8');
    expect(gb).toContain('<h2>Geri bildirim gönder</h2>');
    expect(gb).toContain('Adını, telefonunu ya da e-postanı yazma.');
    expect(ayarlar).toContain("'Her şeyi sil'");
    expect(duzMetin(HESAP_SIL)).toContain('Hesabı sil');
    expect(duzMetin(HESAP_SIL)).toContain('Her şeyi sil');
    expect(duzMetin(GIZLILIK_TR)).toContain('Profil › Ayarlar › Hesabı sil');
  });

  it('Türkçe karakterler doğru (ASCII yazım yok)', () => {
    const all = [GIZLILIK_TR, HESAP_SIL, HAKKINDA].map(duzMetin).join(' ');
    expect(all).not.toMatch(/\b(icin|degil|sifirla|silinir mi|ozet|gizlilik politikasi|kisisel|sikayet)\b/i);
  });

  it('herkese açık sayfalar: dış kaynak, betik, izleyici yok; dil ve başlık var; bağlantılar geçerli', () => {
    expect(YASAL_SAYFALAR.map((b) => [b.yol, b.dosya])).toEqual([['/gizlilik', 'gizlilik.html'], ['/en/privacy', 'en/privacy.html'], ['/hesap-sil', 'hesap-sil.html']]);
    for (const b of YASAL_SAYFALAR) {
      const html = sayfaHtml(b, doluAyar);
      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html).toContain(`<html lang="${b.dil}">`);
      expect(html).not.toMatch(/<script|<iframe|<img|@import|url\(|https?:\/\//i);
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) expect(gecerliAdres(href!.replace(/&amp;/g, '&')), href).toBe(true);
      // iç bağlantılar var olan sayfalara gider
      for (const [, href] of html.matchAll(/href="(\/[^"#]*)/g)) expect(['/', '/favicon.svg', ...YASAL_SAYFALAR.map((x) => x.yol)]).toContain(href);
    }
  });
});
