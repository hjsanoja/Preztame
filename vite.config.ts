import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // The app asks before reloading into a new version (see usePwa).
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icon.svg', 'favicon-48.png', 'apple-touch-icon.png'],
        manifest: {
          id: './',
          name: 'DeudaFlow · Préstamos',
          short_name: 'DeudaFlow',
          description: 'Registro de préstamos y abonos sincronizado con Google Sheets.',
          lang: 'es',
          dir: 'ltr',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f8fafd',
          theme_color: '#f8fafd',
          categories: ['finance', 'productivity'],
          icons: [
            {src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
            {src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            {src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
          shortcuts: [
            {name: 'Nuevo préstamo', short_name: 'Nuevo', url: './?accion=nuevo', icons: [{src: 'pwa-192.png', sizes: '192x192'}]},
            {name: 'Registrar abono', short_name: 'Abono', url: './?accion=abono', icons: [{src: 'pwa-192.png', sizes: '192x192'}]},
            {name: 'Préstamos pendientes', short_name: 'Préstamos', url: './?accion=prestamos', icons: [{src: 'pwa-192.png', sizes: '192x192'}]},
          ],
        },
        workbox: {
          // App shell works offline; data comes from our own local cache + outbox.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({url}) => url.origin === 'https://fonts.googleapis.com',
              handler: 'StaleWhileRevalidate',
              options: {cacheName: 'google-fonts-css'},
            },
            {
              urlPattern: ({url}) => url.origin === 'https://fonts.gstatic.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-files',
                expiration: {maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365},
                cacheableResponse: {statuses: [0, 200]},
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Long-lived vendor chunks: app updates don't invalidate them in the browser cache.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return 'charts';
            if (/[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
