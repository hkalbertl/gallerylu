import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Make the bundle name
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  },
  esbuild: {
    // Drop console.log on production
    pure: mode === 'production' ? ['console.log'] : [],
  },
  server: {
    open: '/',
    proxy: mode === 'development' ? {
      '/proxy/3434': {
        target: 'https://3434.filelu.live/',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/[0-9]+/, ''),
      },
    } : undefined,
  }
}));
