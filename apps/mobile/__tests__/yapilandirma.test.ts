import appJson from '../app.json';
import easJson from '../eas.json';

/**
 * Yerel derleme yapılandırması (YN-024): app.json ↔ mağaza beyanları. İlk EAS derlemesinden önce yakalanması gerekenler:
 * iOS gizlilik bildirimi (PrivacyInfo.xcprivacy) App Store "App Privacy" cevaplarıyla birebir aynı olmalı
 * (marketing/magaza/app-store.md); Android'de gereksiz izinler engelli; sürüm ve kimlikler sabit.
 */
// mobil tsconfig'de Node türleri yok (yalnız jest): fs'yi dar bir türle al; jest kökü apps/mobile
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync(p: string, enc: 'utf8'): string };
const app = appJson.expo as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const eas = easJson as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const appStore = fs.readFileSync(`${process.cwd()}/../../marketing/magaza/app-store.md`, 'utf8');

/** app-store.md'deki Türkçe Apple türü adı → PrivacyInfo anahtarı (yeni tür eklenirse buraya da yazılır) */
const TUR: Record<string, string> = {
  'Tanımlayıcılar › Kullanıcı Kimliği': 'UserID',
  'Satın Almalar › Satın Alma Geçmişi': 'PurchaseHistory',
  'Kullanıcı İçeriği › E-postalar veya Metin Mesajları': 'EmailsOrTextMessages',
  'Kullanıcı İçeriği › Oyun İçeriği': 'GameplayContent',
  'Kullanıcı İçeriği › Diğer Kullanıcı İçeriği': 'OtherUserContent',
  'Diğer Veriler › Diğer Veri Türleri': 'OtherDataTypes',
};
const AMAC: Record<string, string> = { 'Uygulama İşlevi': 'AppFunctionality', 'Analiz': 'Analytics' };

type Toplanan = { NSPrivacyCollectedDataType: string; NSPrivacyCollectedDataTypeLinked: boolean; NSPrivacyCollectedDataTypeTracking: boolean; NSPrivacyCollectedDataTypePurposes: string[] };

/** "Uygulama gizliliği" tablosunda "Toplanır: Evet" olan satırlar → { tür: amaçlar } */
function beyan(): Map<string, string[]> {
  const bolum = appStore.split('## Uygulama gizliliği')[1]!.split('\n## ')[0]!;
  const m = new Map<string, string[]>();
  for (const satir of bolum.split('\n')) {
    const h = satir.split('|').map((s: string) => s.trim());
    if (h.length < 6 || h[2] !== 'Evet') continue;
    const tur = TUR[h[1]!];
    if (!tur) throw new Error(`app-store.md: bilinmeyen Apple türü "${h[1]}" (TUR eşlemesine ekle)`);
    const amaclar = h[3]!.replace(/\([^)]*\)/g, '').split(',').map((s: string) => s.trim()).filter(Boolean).map((a: string) => {
      const k = AMAC[a]; if (!k) throw new Error(`app-store.md: bilinmeyen amaç "${a}"`); return k;
    });
    m.set(tur, amaclar.sort());
  }
  return m;
}

describe('Yerel derleme yapılandırması', () => {
  it('iOS gizlilik bildirimi App Store gizlilik cevaplarıyla birebir aynı', () => {
    const pm = app.ios.privacyManifests;
    expect(pm.NSPrivacyTracking).toBe(false);
    expect(pm.NSPrivacyTrackingDomains).toEqual([]);
    expect(appStore).toContain('**İzleme (tracking): Hayır**');
    const b = beyan();
    expect(b.size).toBeGreaterThan(0);
    const bildirim = new Map<string, string[]>((pm.NSPrivacyCollectedDataTypes as Toplanan[]).map((t) => {
      // tabloya göre hepsi kullanıcıya bağlı ve izleme için kullanılmaz
      expect(t.NSPrivacyCollectedDataTypeLinked).toBe(true);
      expect(t.NSPrivacyCollectedDataTypeTracking).toBe(false);
      return [t.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', ''), t.NSPrivacyCollectedDataTypePurposes.map((p) => p.replace('NSPrivacyCollectedDataTypePurpose', '')).sort()];
    }));
    expect(Object.fromEntries(bildirim)).toEqual(Object.fromEntries(b));
  });

  it('gerekçe isteyen API türleri gerekçe koduyla bildirilir', () => {
    const api = new Map<string, string[]>((app.ios.privacyManifests.NSPrivacyAccessedAPITypes as { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] }[]).map((a) => [a.NSPrivacyAccessedAPIType, a.NSPrivacyAccessedAPITypeReasons]));
    // AsyncStorage / React Native / expo-constants / RevenueCat → UserDefaults; RN + expo-file-system → dosya zamanı ve disk alanı
    for (const t of ['UserDefaults', 'FileTimestamp', 'SystemBootTime', 'DiskSpace']) {
      const r = api.get(`NSPrivacyAccessedAPICategory${t}`);
      expect(r?.length).toBeGreaterThan(0);
      for (const k of r!) expect(k).toMatch(/^[0-9A-F]{4}\.\d$/);
    }
    expect(api.get('NSPrivacyAccessedAPICategoryUserDefaults')).toContain('CA92.1');
  });

  it('Android: gereksiz izinler engelli, istenmeyen izin eklenmemiş', () => {
    const engelli: string[] = app.android.blockedPermissions;
    for (const p of ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW', 'RECORD_AUDIO']) expect(engelli).toContain(`android.permission.${p}`);
    expect(engelli).toContain('com.google.android.gms.permission.AD_ID'); // reklam kimliği yok (Play "Veri güvenliği")
    expect(app.android.permissions ?? []).toEqual([]);
    expect(JSON.stringify(app)).not.toMatch(/usesCleartextTraffic/);
  });

  it('kimlikler, sürüm politikası ve EAS sürüm numarası', () => {
    expect(app.ios.bundleIdentifier).toBe('com.aiheartech.odi');
    expect(app.android.package).toBe('com.aiheartech.odi');
    expect(app.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(app.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.production.autoIncrement).toBe(true);
    // sunucu adresi ve anahtarlar depoda değil: EAS ortam değişkeninden gelir
    for (const p of Object.values(eas.build) as { env?: Record<string, string> }[]) expect(Object.keys(p.env ?? {}).filter((k) => k.startsWith('EXPO_PUBLIC_'))).toEqual([]);
  });
});
