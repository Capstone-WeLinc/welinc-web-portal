import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { checkEnv } from './env.schema.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Spec 0010: stop dev and build with a list of missing or malformed VITE_* names.
  // Vitest skips it, since unit tests don't use the address.
  if (!process.env.VITEST) checkEnv(loadEnv(mode, process.cwd(), 'VITE_'), mode);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 8000,
      host: true, // Bind to 0.0.0.0 — required for Docker
    },
  };
});
