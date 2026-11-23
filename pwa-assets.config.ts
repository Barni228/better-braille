// Generates the app icons in public/ from favicon.svg. Run `npm run icons` after changing it.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
