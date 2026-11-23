import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project site from /<repo-name>/, so the deploy workflow sets
// BASE_PATH. Locally the app runs at /.
const base = process.env.BASE_PATH || '/'

// With `--host`, other computers on the network can open the dev/preview server by the Mac's
// name, e.g. http://my-mac.local:5173. Vite rejects unknown host names unless listed here.
const allowedHosts = ['.local']

export default defineConfig({
  base,
  server: { allowedHosts },
  preview: { allowedHosts },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Better Braille',
        short_name: 'Braille',
        description: 'Type braille with S D F J K L and check it against print text.',
        display: 'standalone',
        theme_color: '#4f46e5',
        background_color: '#f3f4f7',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache everything, including liblouis and its tables, so the app works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,ctb,cti,dis,uti,utb}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
