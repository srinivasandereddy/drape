/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// VITE_BASE is '/' locally and '/<repo-name>/' on GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the person taps Update (see UpdateBanner).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-maskable-512.png'],
      // Our own service worker (src/sw/sw.ts), so it can also show the morning reminder.
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      injectManifest: {
        // Cache the app shell and fonts so Drape opens without a connection.
        // Google sign-in and Drive requests go to other domains and are never cached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Drape',
        short_name: 'Drape',
        description: 'Your wardrobe, colors and daily outfits.',
        theme_color: '#17191C',
        // The Android splash screen: the icon on its own dark background.
        background_color: '#17191C',
        display: 'standalone',
        orientation: 'portrait',
        // Android: Drape appears in the share sheet, so a shop's product link can be sent straight to it.
        share_target: {
          action: './',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
