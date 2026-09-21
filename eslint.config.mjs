import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/data/**', '**/test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['backend/**/*.ts', 'shared/**/*.ts', 'scripts/**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', URL: 'readonly', __dirname: 'readonly', require: 'readonly', module: 'readonly', fetch: 'readonly', setTimeout: 'readonly' } }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
