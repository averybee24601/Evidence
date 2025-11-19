import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import storagePlugin from './server/storagePlugin';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const googleApiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.API_KEY;

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), storagePlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(googleApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(googleApiKey),
        'process.env.GOOGLE_API_KEY': JSON.stringify(googleApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
