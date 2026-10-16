import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'legacy-development-index',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url === '/legacy' || request.url === '/legacy/') {
            response.writeHead(302, { Location: '/legacy/index.html' });
            response.end();
            return;
          }
          next();
        });
      },
    },
  ],
  build: { outDir: 'build' },
  test: { include: ['src/**/*.test.ts'], maxWorkers: 2 },
});
