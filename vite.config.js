import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredBase = env.VITE_APP_BASE_PATH || '/nexion/';

  return {
    base: configuredBase,
    plugins: [react()]
  };
});
