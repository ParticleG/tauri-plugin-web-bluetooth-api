module.exports = {
  root: true,
  ignorePatterns: ['dist-js', 'node_modules', 'examples', 'target'],
  overrides: [
    {
      files: ['guest-js/**/*.ts'],
      env: {
        browser: true,
        es2021: true,
      },
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
        'prettier',
      ],
      rules: {
        // Keep lint focused on correctness while relying on Prettier for formatting
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      },
    },
  ],
}
