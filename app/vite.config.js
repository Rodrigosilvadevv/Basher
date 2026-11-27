import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run build:demo` gera uma versão 100% offline (dados simulados) com caminhos relativos.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'demo' ? './' : '/',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: { host: true, port: 5173 },
}));
