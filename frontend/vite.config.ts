import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.CM_API_URL || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      ['/stream', '/record', '/messages', '/incidents', '/heartbeat', '/healthz'].map(path => [path, { target, changeOrigin: true }]),
    ),
  },
});
