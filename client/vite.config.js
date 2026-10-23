import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { SERVER_PORT } from '@calculo-royale/shared/constants';

const server = `http://localhost:${SERVER_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Sin saltar a otro puerto: el túnel y el QR apuntan al 5173
    strictPort: true,
    // Túnel de Cloudflare (npm run tunnel)
    allowedHosts: ['.trycloudflare.com'],
    // Todo pasa por el puerto de Vite: un solo túnel o puerto basta para cliente y servidor
    proxy: {
      '/socket.io': { target: server, ws: true },
      '/net-info': server,
      '/health': server,
    },
  },
});
