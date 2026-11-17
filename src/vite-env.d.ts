/// <reference types="vite/client" />

// Required and checked before dev or build starts (env.schema.ts, spec 0010)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // Optional, error monitoring (VRMS spec 0025); blank means off
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_SENTRY_TUNNEL?: string;
  readonly VITE_SENTRY_TEST_ROUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
