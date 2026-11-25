import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'tools/harness/out/**', 'tools/harness/scratch/**', 'apps/mobile/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  // service worker kalıbı: ön bellek listesini `vite build` yazar (apps/web/vite.config.ts → odiServiceWorker)
  { files: ['apps/web/sw/sw.js'], languageOptions: { globals: { __ODI_SW_ONDEN__: 'readonly' } } },
  { rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], '@typescript-eslint/no-non-null-assertion': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] } },
);
