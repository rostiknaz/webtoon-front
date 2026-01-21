/// <reference types="vite/client" />

// Swiper CSS bundle declaration
// Using bundle CSS avoids Vite 7 module resolution issues with individual effect CSS imports
declare module "swiper/css/bundle" {
  const content: string;
  export default content;
}
