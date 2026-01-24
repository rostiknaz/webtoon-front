/// <reference types="vite/client" />

// Environment variables
interface ImportMetaEnv {
  readonly VITE_BETTER_AUTH_URL: string;
  readonly VITE_R2_CDN_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Swiper CSS bundle declaration
// Using bundle CSS avoids Vite 7 module resolution issues with individual effect CSS imports
declare module "swiper/css/bundle" {
  const content: string;
  export default content;
}
