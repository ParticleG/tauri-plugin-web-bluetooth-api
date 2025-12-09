import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['guest-js/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: [/^@tauri-apps\/api/],
  outDir: 'dist-js',
})
