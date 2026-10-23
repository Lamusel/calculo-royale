import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { SERVER_PORT } from '@calculo-royale/shared/constants';

// CR_SERVER_URL permite apuntar el proxy a otro servidor (otra copia de prueba o uno remoto)
const server = process.env.CR_SERVER_URL || `http://localhost:${SERVER_PORT}`;

export default defineConfig({
  plugins: [react()],
  // El cargador de skins externas y la galería /skins se importan recién cuando hacen falta: se
  // preempaquetan desde el inicio para que Vite no recargue la página al descubrirlos
  optimizeDeps: {
    include: [
      'three/examples/jsm/loaders/GLTFLoader.js',
      'three/examples/jsm/loaders/DRACOLoader.js',
      'three/examples/jsm/utils/SkeletonUtils.js',
      'three/examples/jsm/controls/OrbitControls.js',
    ],
  },
  // Bundle dividido: las librerías grandes en chunks propios (se cachean aparte del código del juego)
  build: {
    // three.js solo ya pesa ~680 kB (176 kB comprimido) y no se puede partir más
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber'],
          react: ['react', 'react-dom'],
          katex: ['katex'],
        },
      },
    },
  },
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
