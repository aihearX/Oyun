// app.json ana yapılandırmadır. iOS'ta expo.name ASCII kalır (Xcode hedef adı ODISesinYolu; "İ" EAS'ta hedefi
// bozuyordu, ana ekran adı ios.infoPlist.CFBundleDisplayName'den gelir). Android'de uygulama etiketi expo.name'den
// üretildiği için Android derlemesinde Türkçe ad kullanılır.
const { withAndroidManifest } = require('expo/config-plugins');

// orientation "portrait" Android'de android.hardware.screen.portrait özelliğini örtük olarak ZORUNLU yapar; Play bu
// yüzden dönemeyen cihazları (bazı Chromebook, PC'de Play Oyunlar) dışlıyor ve uyarı veriyor. Özellik isteğe bağlı
// beyan edilir; oyun yine dikey açılır.
const dikeyEkranIstegeBagli = (config) =>
  withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    const ad = 'android.hardware.screen.portrait';
    manifest['uses-feature'] = (manifest['uses-feature'] || []).filter((f) => f.$?.['android:name'] !== ad);
    manifest['uses-feature'].push({ $: { 'android:name': ad, 'android:required': 'false' } });
    return c;
  });

module.exports = ({ config }) =>
  dikeyEkranIstegeBagli(
    process.env.EAS_BUILD_PLATFORM === 'android' ? { ...config, name: 'ODİ: Sesin Yolu' } : config,
  );
