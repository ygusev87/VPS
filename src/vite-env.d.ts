/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Preview builds: load models from base64 JS modules (see parts/assets.ts). */
  readonly VITE_MODELS_AS_JS?: string;
}
