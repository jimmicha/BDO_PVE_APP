import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt', includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
    manifest: { name: 'BDO Companion', short_name: 'Companion', description: 'Your Black Desert journey, remembered.', theme_color: '#131614', background_color: '#131614', display: 'standalone', start_url: '/', icons: [{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}] },
    workbox: { navigateFallbackDenylist: [/^\/auth\//, /^\/\.well-known\//], runtimeCaching: [], cleanupOutdatedCaches: true }
  })],
  build: { sourcemap: false },
  define: { __BUILD_MODE__: JSON.stringify(mode) },
}));
