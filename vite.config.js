import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const configuredBase = env.VITE_APP_BASE_PATH || '/nexion/';

  return {
    base: configuredBase,
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }

            if (
              id.includes('react/') ||
              id.includes('react-dom/') ||
              id.includes('scheduler/') ||
              id.includes('react-router-dom/')
            ) {
              return 'framework';
            }

            if (id.includes('recharts/') || id.includes('d3-')) {
              return 'charts';
            }

            if (id.includes('firebase/')) {
              return 'firebase';
            }

            if (id.includes('socket.io-client/')) {
              return 'realtime';
            }

            if (
              id.includes('framer-motion/') ||
              id.includes('lucide-react/') ||
              id.includes('@fortawesome/')
            ) {
              return 'ui-libs';
            }

            if (id.includes('axios/')) {
              return 'network';
            }
          }
        }
      }
    }
  };
});
