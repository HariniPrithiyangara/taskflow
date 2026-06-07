import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars for the current mode (development / production)
  const env = loadEnv(mode, process.cwd(), '');

  // In development, proxy /api requests to the Django backend so we
  // avoid CORS issues and never need to hardcode the backend URL in JS.
  // In production the built frontend points directly to VITE_API_URL.
  const apiTarget = env.VITE_API_URL
    ? new URL(env.VITE_API_URL).origin   // e.g. http://127.0.0.1:8000
    : 'http://127.0.0.1:8000';

  return {
    plugins: [react(), tailwindcss()],

    server: {
      proxy: {
        // Proxy all /api/* requests to the Django backend in dev
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
