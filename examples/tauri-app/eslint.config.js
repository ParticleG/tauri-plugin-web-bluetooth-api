import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import { fileURLToPath } from 'node:url'

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url))

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'src-tauri/target/**'],
  },
  {
    files: ['src/**/*.{js,ts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, prettier],
    languageOptions: {
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        project: ['./jsconfig.json'],
        tsconfigRootDir,
      },
    },
  },
  {
    files: ['src/**/*.svelte'],
    plugins: { svelte, '@typescript-eslint': tseslint.plugin },
    extends: [svelte.configs['flat/recommended'], svelte.configs['flat/prettier']],
    languageOptions: {
      parser: svelte.parser,
      parserOptions: {
        parser: tseslint.parser,
        project: ['./jsconfig.json'],
        tsconfigRootDir,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      // Keep component APIs consistent
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    },
  },
)
