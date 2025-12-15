import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { fileURLToPath } from 'node:url'

const typeAwareConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ['guest-js/**/*.ts'],
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      project: ['./tsconfig.json'],
      tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
    },
  },
}))

export default tseslint.config(
  {
    ignores: ['dist-js/**', 'node_modules/**', 'examples/**', 'target/**'],
  },
  ...typeAwareConfigs,
  {
    files: ['guest-js/**/*.ts'],
    extends: [prettier],
    rules: {
      // Keep type shapes consistent for shared API surface
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    },
  },
)
