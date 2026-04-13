import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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

  return {
    base: configuredBase,
    plugins: [react()]
  };
});
