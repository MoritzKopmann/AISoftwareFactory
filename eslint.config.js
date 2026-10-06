import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/dist/', '**/coverage/', '.aisf/', '.claude/'] },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['packages/ui/**', 'packages/app/assets/kit/**'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
);
