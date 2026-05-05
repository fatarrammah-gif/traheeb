import { Hono } from 'hono';
import type { Handler } from 'hono/types';

const API_BASENAME = '/api';
const api = new Hono();

// Vite resolves this glob at build time — all route paths are known statically.
// Modules are NOT loaded here; they load lazily on first request (eager: false).
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

function registerRoutes() {
  // Sort by path length descending so specific routes match before parameterised ones
  const sortedEntries = Object.entries(routeModules).sort(([a], [b]) => b.length - a.length);

  for (const [globKey, loadModule] of sortedEntries) {
    const honoPath = getHonoPath(globKey);

    // Each handler loads the route module lazily on first request.
    // This keeps startup memory low — heavy modules (Baileys, Sharp, etc.)
    // only load when their route is first called, not at server boot.
    const lazyHandler: Handler = async (c) => {
      try {
        const route = (await loadModule()) as Record<string, Handler>;
        const method = c.req.method.toUpperCase();
        if (!route[method]) {
          return c.json({ error: 'Method not allowed' }, 405);
        }
        const params = c.req.param();
        return await route[method](c.req.raw, { params });
      } catch (error) {
        console.error(`Error in route ${globKey} [${c.req.method}]:`, error);
        return c.json({ error: 'Internal server error' }, 500);
      }
    };

    api.get(honoPath, lazyHandler);
    api.post(honoPath, lazyHandler);
    api.put(honoPath, lazyHandler);
    api.delete(honoPath, lazyHandler);
    api.patch(honoPath, lazyHandler);
  }
}

registerRoutes();

export { api, API_BASENAME };
