import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import packageJson from './package.json';

export default defineConfig(({ mode }) => {
    const version = `v${packageJson.version}`;

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
      plugins: [
        react(),
        {
          name: 'html-transform',
          transformIndexHtml(html) {
            return html
              .replace(
                /(<meta name="app-version" content=")[^"]*(")/,
                `$1${version}$2`
              )
              .replace(
                /(data-app-version=")[^"]*(")/,
                `$1${version}$2`
              );
          },
        },
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      define: {
        __APP_VERSION__: JSON.stringify(version),
      }
    };
});
