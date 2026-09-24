import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const normalizeBasePath = (value) => {
  const raw = String(value || './').trim();
  if (raw === './' || raw === '.') return './';
  if (!raw || raw === '/') return '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredBase = normalizeBasePath(env.VITE_APP_BASE_PATH || './');
  const reactRouterIndex = fileURLToPath(new URL('./node_modules/react-router/dist/development/index.js', import.meta.url));

  return {
    base: configuredBase,
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^react-router-dom$/, replacement: reactRouterIndex },
        { find: /^react-router$/, replacement: reactRouterIndex }
      ]
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) return undefined;
            if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(normalizedId)) {
              return 'react-vendor';
            }
            if (/\/node_modules\/(recharts|recharts-scale|d3-[^/]+)\//.test(normalizedId)) {
              return 'charts-vendor';
            }
            if (/\/node_modules\/(axios|socket.io-client)\//.test(normalizedId)) {
              return 'network-vendor';
            }
            if (normalizedId.includes('/node_modules/lucide-react/')) {
              return 'icons-vendor';
            }
            // Let Rollup keep optional libraries with their consuming pages.
            // A catch-all vendor chunk forces every screen to download them.
            return undefined;
          }
        }
      }
    }
  };
});
