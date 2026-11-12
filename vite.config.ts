import { fileURLToPath, URL } from 'node:url'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: '/hirsch-rabauken-statistik/',
  plugins: [
    vue(),
    vueDevTools(),
    {
      name: 'github-pages-spa-fallback',
      writeBundle(outputOptions) {
        const outputDirectory = outputOptions.dir ?? 'dist'
        copyFileSync(
          resolve(outputDirectory, 'index.html'),
          resolve(outputDirectory, '404.html'),
        )
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
