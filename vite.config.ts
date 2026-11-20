import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { checkEnv } from './env.schema.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Spec 0010: stop dev and build with a list of missing or malformed VITE_* names.
  // Vitest skips it, since unit tests don't use the address.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (!process.env.VITEST) checkEnv(env, mode);

  // VRMS spec 0025, AC-17: maps are built but never linked from the bundle, uploaded only when the
  // deploy job gives a token, and deleted after the upload (the deploy job deletes them again).
  // The release name is the same commit SHA the app tags its events with (VITE_SENTRY_RELEASE).
  const upload = process.env.SENTRY_AUTH_TOKEN
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
        release: {
          name: env.VITE_SENTRY_RELEASE || undefined,
          setCommits: { auto: true, ignoreMissing: true },
          deploy: env.VITE_SENTRY_ENVIRONMENT ? { env: env.VITE_SENTRY_ENVIRONMENT } : false,
        },
        sourcemaps: {
          assets: 'dist/**',
          filesToDeleteAfterUpload: ['dist/**/*.map'],
        },
      })
    : [];

  return {
    plugins: [react(), tailwindcss(), upload],
    build: {
      sourcemap: 'hidden',
    },
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
