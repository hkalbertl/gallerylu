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
    /*
    proxy: mode === "development" ? {
      "/api": {
        target: "https://filelu.com/api",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    } : undefined,
    */
  }
}));
