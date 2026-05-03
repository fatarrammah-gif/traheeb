import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Vite resolves this glob at build time — no filesystem scanning needed at runtime.
// This works correctly in both development and production.
const routeModules = import.meta.glob('../src/app/api/**/route.{js,ts}', { eager: false });

/**
 * Convert a glob key like '../src/app/api/events/[id]/guests/route.js'
 * to a Hono path like '/events/:id/guests'
 */
function getHonoPath(globKey: string): string {
  const relative = globKey
    .replace(/^\.\.\/src\/app\/api/, '')
    .replace(/\/route\.[jt]s$/, '');

  if (!relative) return '/';

  return relative
    .replace(/\[\.\.\.([^\]]+)\]/g, ':$1{.+}')
    .replace(/\[([^\]]+)\]/g, ':$1');
}

async function registerRoutes() {
  // Clear existing routes
  api.routes = [];

  // Sort by path length descending so specific routes register before parameterised ones
  const sortedEntries = Object.entries(routeModules).sort(([a], [b]) => b.length - a.length);

  for (const [globKey, loadModule] of sortedEntries) {
    try {
      const route = (await loadModule()) as Record<string, Handler>;
      const honoPath = getHonoPath(globKey);

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
      for (const method of methods) {
        if (route[method]) {
          const handler: Handler = async (c) => {
            const params = c.req.param();
            return await route[method](c.req.raw, { params });
          };
          switch (method) {
            case 'GET':    api.get(honoPath, handler);    break;
            case 'POST':   api.post(honoPath, handler);   break;
            case 'PUT':    api.put(honoPath, handler);    break;
            case 'DELETE': api.delete(honoPath, handler); break;
            case 'PATCH':  api.patch(honoPath, handler);  break;
          }
        }
      }
    } catch (error) {
      console.error(`Error importing route ${globKey}:`, error);
    }
  }
}

await registerRoutes();

// Re-register on hot reload in development
if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.accept(() => {
    registerRoutes().catch((err) => {
      console.error('Error reloading routes:', err);
    });
  });
}

export { api, API_BASENAME };
