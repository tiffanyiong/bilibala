import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/healthz': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          },
          // Backend REST endpoints
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          },
          // Backend websocket proxy for Gemini Live
          '/live': {
            target: 'ws://localhost:3001',
            ws: true,
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
