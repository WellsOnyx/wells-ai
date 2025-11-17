import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import compression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    compression({
      algorithm: 'gzip',
      threshold: 10240,
    }),
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact', 'preact-router'],
        },
      },
    },
    // Target <500KB bundle size
    chunkSizeWarningLimit: 500,
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  server: {
    port: 3000,
  },
});
