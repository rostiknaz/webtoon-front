import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import path from "path";
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    cloudflare(),
    tailwindcss()
    // ...
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/',
})
