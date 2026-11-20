// app.json ana yapılandırmadır. iOS'ta expo.name ASCII kalır (Xcode hedef adı ODISesinYolu; "İ" EAS'ta hedefi
// bozuyordu, ana ekran adı ios.infoPlist.CFBundleDisplayName'den gelir). Android'de uygulama etiketi expo.name'den
// üretildiği için Android derlemesinde Türkçe ad kullanılır.
module.exports = ({ config }) =>
  process.env.EAS_BUILD_PLATFORM === 'android' ? { ...config, name: 'ODİ: Sesin Yolu' } : config;
