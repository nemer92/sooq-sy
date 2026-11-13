import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.CAPACITOR_BUILD === 'true' ? './' : '/sooq-sy/',
  plugins: [react(), tailwindcss()],
})