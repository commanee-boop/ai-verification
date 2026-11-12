import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [vue(), viteStaticCopy({ targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map(name => ({ src: `node_modules/cesium/Build/Cesium/${name}`, dest: 'cesium' })) })],
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
  build: { chunkSizeWarningLimit: 2000, rollupOptions: { output: { manualChunks(id) {
    // Shared CJS helpers must not pull the entire 3D engine into the entry page.
    if (id.includes('commonjsHelpers')) return 'module-helpers'
    if (id.includes('/node_modules/cesium/') || id.includes('/node_modules/@cesium/')) return 'cesium'
    if (id.includes('/node_modules/echarts/') || id.includes('/node_modules/zrender/')) return 'charts'
  } } } }
})
