import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Spec 0010: no code falls back to localhost any more, so tests get the address here
    env: { VITE_API_BASE_URL: 'http://localhost:3000' },
    css: false,
  },
});
