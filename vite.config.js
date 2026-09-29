import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { weatherServicePlugin } from './service/vite-plugin.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [weatherServicePlugin()],
  build: { rollupOptions: { input: { main: resolve(root, 'index.html'), deploy: resolve(root, 'deploy.html'), live: resolve(root, 'live.html'), agent: resolve(root, 'agent.html') } } },
});
