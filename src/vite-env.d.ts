/// <reference types="vite/client" />

/** The build's label: commit and build time (see vite.config.ts). */
declare const __BUILD__: string;

interface ImportMetaEnv {
  /** Preview builds: load models from base64 JS modules (see parts/assets.ts). */
  readonly VITE_MODELS_AS_JS?: string;
}
