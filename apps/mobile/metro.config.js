// Monorepo Metro ayarı: kök node_modules paylaşılır, @odi/* paketleri kaynak (packages/*/src) olarak derlenir.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Kök ve paket klasörlerini izle (değişiklikler sıcak yüklenir).
config.watchFolders = [workspaceRoot];

// Tek bir react / react-native kopyası: önce uygulamanın, sonra kökün node_modules'ı.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// @odi/* → packages/*/src (workspace sembolik bağlantısına gerek kalmadan, deterministik).
const pkgs = ['game-core', 'content', 'level-gen', 'shared', 'net', 'meta'];
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

module.exports = config;
