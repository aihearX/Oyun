// Monorepo Metro ayarı: kök node_modules paylaşılır, @odi/* paketleri kaynak (packages/*/src) olarak derlenir.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// DOM bileşeni (WebApp, 'use dom') tek paket olarak dışa aktarılır. Web arayüzü ekranları ve Phaser sahnelerini `import()` ile
// yükler (apps/web/src/engine.ts, App.tsx). Expo'nun paket bölmesi (splitChunks) DOM bileşenlerinde `expo export` ile bozuk:
// parçalar md5 adıyla yeniden adlandırılıyor, ana paketteki yollar eski adda kalıyor ("Asset not found: _expo/static/js/web/__common-…").
// Bölme kapalıyken `import()` aynı paketin içinde çözülür: modüller yine ilk kullanıldıkları anda çalıştırılır (Phaser başlıkta
// çalışmaz), yalnız ayrıştırma tek dosyada kalır. Bu ayar CLI'nin her dışa aktarımında (yerel, EAS build export:embed, EAS update)
// okunur; yalnız dışa aktarmayı etkiler (geliştirme sunucusu zaten bölmez). Ayrıntı: README "Paket bölme".
process.env.EXPO_NO_BUNDLE_SPLITTING ??= '1';

const config = getDefaultConfig(projectRoot);

// Kök ve paket klasörlerini izle (değişiklikler sıcak yüklenir).
config.watchFolders = [workspaceRoot];

// Önce uygulamanın, sonra kökün node_modules'ı. react / react-dom / react-native tek kopya olarak kökte
// (apps/web de aynı tam sürümü kullanır); hiyerarşik arama Expo varsayılanında (açık) kalır.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// @odi/* → packages/*/src (workspace sembolik bağlantısına gerek kalmadan, deterministik).
const pkgs = ['game-core', 'content', 'level-gen', 'shared', 'net', 'meta', 'audio'];
config.resolver.extraNodeModules = Object.fromEntries(pkgs.map((p) => [`@odi/${p}`, path.resolve(workspaceRoot, 'packages', p, 'src')]));
const baseResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const p of pkgs) {
    const name = `@odi/${p}`;
    if (moduleName === name) return { type: 'sourceFile', filePath: path.resolve(workspaceRoot, 'packages', p, 'src', 'index.ts') };
    if (moduleName.startsWith(name + '/')) {
      const rest = moduleName.slice(name.length + 1);
      return context.resolveRequest(context, path.resolve(workspaceRoot, 'packages', p, 'src', rest), platform);
    }
  }
  return (baseResolve ?? context.resolveRequest)(context, moduleName, platform);
};

// Dönüşüm önbelleği (os.tmpdir()/metro-cache) aynı makinedeki tüm kopyalarca paylaşılır; DOM bileşeni girişi mutlak yola
// göre üretildiği için başka bir çalışma ağacının sonucu dönebiliyordu. Önbellek anahtarına bu kopyanın yolu eklenir.
config.cacheVersion = `odi:${workspaceRoot}`;

module.exports = config;
