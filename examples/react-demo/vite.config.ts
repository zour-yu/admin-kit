import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [react()],
  base: "./",
})
