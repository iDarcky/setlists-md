import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Read the canonical app version from package.json so the UI never drifts
// from the source of truth. We inject it as a build-time global rather than
// importing the whole package.json into the client bundle.
const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    // Lives here rather than in a vitest.config.js so the '@/' alias below is
    // inherited — a second config would drift the moment one is edited.
    //
    // Two projects, split by file extension so nobody has to configure
    // anything: `.test.js` is pure logic and runs in node, `.test.jsx` renders
    // components and gets jsdom. Booting jsdom for all 41 logic suites cost
    // ~12s of an otherwise 3s run, and a slow suite is a suite people stop
    // running.
    projects: [
      {
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          include: ['src/**/*.test.js'],
          restoreMocks: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.jsx'],
          setupFiles: ['./vitest.setup.js'],
          restoreMocks: true,
        },
      },
    ],
  },
  resolve: {
    // `@/` is the src root. Files are grouped by feature (src/features/*), so
    // relative imports would otherwise climb three or four levels to reach a
    // shared module — and every file move would rewrite them again. Anything
    // outside a file's own folder is imported through the alias; only
    // same-folder siblings stay relative.
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor code in its own chunks: the app ships small,
        // frequent releases, and without this every release invalidated one
        // giant bundle — returning PWA users re-downloaded React + Supabase
        // just to get a copy tweak. These chunks only change on dependency
        // bumps, so they stay cached across app updates.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'setlists.md',
        short_name: 'setlists.md',
        description: 'Chord charts for worship teams',
        theme_color: '#0a0807',
        background_color: '#0a0807',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        // pdf.js is ~400KB of lazy chunk that only a PDF import ever needs.
        // Precaching it would charge every install for a feature most users
        // never reach; it loads on demand and the HTTP cache keeps it after.
        //
        // svguitar (+ svg.js, ~162KB) is the same deal: chord fingering
        // diagrams are off by default and only reachable from the Performance
        // layout sheet. Trade-off worth knowing — a user who has NEVER shown
        // diagrams and is offline when they first enable them gets empty boxes
        // until they reconnect (ChordDiagram fails soft). Once shown anywhere,
        // the HTTP cache keeps it for offline use.
        // SCOPED TO assets/ ON PURPOSE. `**/pdf-*.js` also matched
        // `/pdf-print.js` — the public script that wires the print preview's
        // controls (cols, size, font, chords…). It was silently excluded from
        // the precache, so in the installed PWA those buttons did nothing while
        // the app-side Done/Print still worked. The lazy pdf.js library chunk
        // that this ignore is actually for is emitted as `assets/pdf-<hash>.js`.
        globIgnores: ['**/assets/pdf-*.js', '**/pdf.worker*', '**/svguitar*'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Web Push handlers (push + notificationclick) live in a plain script
        // pulled into the generated service worker — generateSW mode has no
        // other extension point. See public/push-sw.js.
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // Font files — long-lived, cache-first
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Images — long-lived, cache-first
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Scripts and styles — check for updates but fall back to cache offline
            urlPattern: ({ request }) =>
              request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      }
    })
  ]
})
