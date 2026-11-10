/// <reference types="vite/client" />

// Required and checked before dev or build starts (env.schema.ts, spec 0010)
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
