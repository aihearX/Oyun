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
  'Teşhis › Çökme Verileri': 'CrashData',
};
const AMAC: Record<string, string> = { 'Uygulama İşlevi': 'AppFunctionality', 'Analiz': 'Analytics' };
const EH: Record<string, boolean> = { Evet: true, Hayır: false };

type Toplanan = { NSPrivacyCollectedDataType: string; NSPrivacyCollectedDataTypeLinked: boolean; NSPrivacyCollectedDataTypeTracking: boolean; NSPrivacyCollectedDataTypePurposes: string[] };
type Satir = { amaclar: string[]; bagli: boolean; izleme: boolean };

/** "Uygulama gizliliği" tablosunda "Toplanır: Evet" olan satırlar → { tür: amaçlar, kullanıcıya bağlı, izleme } */
function beyan(): Map<string, Satir> {
  const bolum = appStore.split('## Uygulama gizliliği')[1]!.split('\n## ')[0]!;
  const m = new Map<string, Satir>();
  for (const satir of bolum.split('\n')) {
    // | tür | toplanır | kullanıcıya bağlı | izleme | amaç | ne |
    const h = satir.split('|').map((s: string) => s.trim());
    if (h.length < 8 || h[2] !== 'Evet') continue;
    const tur = TUR[h[1]!];
    if (!tur) throw new Error(`app-store.md: bilinmeyen Apple türü "${h[1]}" (TUR eşlemesine ekle)`);
    const bagli = EH[h[3]!]; const izleme = EH[h[4]!];
    if (bagli === undefined || izleme === undefined) throw new Error(`app-store.md: "${h[1]}" bağlılık/izleme Evet ya da Hayır olmalı`);
    const amaclar = h[5]!.replace(/\([^)]*\)/g, '').split(',').map((s: string) => s.trim()).filter(Boolean).map((a: string) => {
      const k = AMAC[a]; if (!k) throw new Error(`app-store.md: bilinmeyen amaç "${a}"`); return k;
    });
    m.set(tur, { amaclar: amaclar.sort(), bagli, izleme });
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
    // hiçbir tür izleme için kullanılmaz; çökme verisi (YN-011) kullanıcıya bağlı değil, diğerleri bağlı
    for (const [t, v] of b) expect({ [t]: v.izleme }).toEqual({ [t]: false });
    expect(b.get('CrashData')).toEqual({ amaclar: ['AppFunctionality'], bagli: false, izleme: false });
    expect(b.get('UserID')?.bagli).toBe(true);
    const bildirim = new Map<string, Satir>((pm.NSPrivacyCollectedDataTypes as Toplanan[]).map((t) => [
      t.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', ''),
      { amaclar: t.NSPrivacyCollectedDataTypePurposes.map((p) => p.replace('NSPrivacyCollectedDataTypePurpose', '')).sort(), bagli: t.NSPrivacyCollectedDataTypeLinked, izleme: t.NSPrivacyCollectedDataTypeTracking },
    ]));
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
