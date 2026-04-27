import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' 
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server:
    mode === "development"
      ? {
          proxy: {
            "/api": process.env.VITE_API_PROXY_TARGET || "http://localhost:3000",
          },
        }
      : undefined,
}))
