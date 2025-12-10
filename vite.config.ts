import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use '.' instead of process.cwd() to avoid Node type dependency issues during build
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 3000
    },
    define: {
      // Safely access process.env.API_KEY or fallback to empty object to prevent TS errors
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});