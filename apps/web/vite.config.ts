import path from 'node:path';
import { reactRouter } from '@react-router/dev/vite';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';
import { addRenderIds } from './plugins/addRenderIds';
import { aliases } from './plugins/aliases';
import consoleToParent from './plugins/console-to-parent';
import { layoutWrapperPlugin } from './plugins/layouts';
import { loadFontsFromTailwindSource } from './plugins/loadFontsFromTailwindSource';
import { nextPublicProcessEnv } from './plugins/nextPublicProcessEnv';
import { restart } from './plugins/restart';
import { restartEnvFileChange } from './plugins/restartEnvFileChange';

export default defineConfig({
  // Keep them available via import.meta.env.NEXT_PUBLIC_*
  envPrefix: 'NEXT_PUBLIC_',
  optimizeDeps: {
    // Explicitly include fast-glob, since it gets dynamically imported and we
    // don't want that to cause a re-bundle.
    include: ['fast-glob', 'lucide-react'],
    exclude: [
      '@hono/auth-js/react',
      '@hono/auth-js',
      '@auth/core',
      '@hono/auth-js',
      'hono/context-storage',
      '@auth/core/errors',
      'fsevents',
      'lightningcss',
      // whatsapp-web.js server-only deps — keep out of browser bundle
      'whatsapp-web.js',
      'unzipper',
      '@aws-sdk/client-s3',
      'readable-stream',
      'puppeteer',
      'qrcode',
    ],
  },
  logLevel: 'info',
  plugins: [
    nextPublicProcessEnv(),
    restartEnvFileChange(),
    reactRouterHonoServer({
      serverEntryPoint: './__create/index.ts',
      runtime: 'node',
    }),
    babel({
      include: ['src/**/*.{js,jsx,ts,tsx}'], // or RegExp: /src\/.*\.[tj]sx?$/
      exclude: /node_modules/, // skip everything else
      babelConfig: {
        babelrc: false, // don’t merge other Babel files
        configFile: false,
        plugins: ['styled-jsx/babel'],
      },
    }),
    restart({
      restart: [
        'src/**/page.jsx',
        'src/**/page.tsx',
        'src/**/layout.jsx',
        'src/**/layout.tsx',
        'src/**/route.js',
        'src/**/route.ts',
      ],
    }),
    consoleToParent(),
    loadFontsFromTailwindSource(),
    addRenderIds(),
    reactRouter(),
    tsconfigPaths(),
    aliases(),
    layoutWrapperPlugin(),
  ],
  resolve: {
    alias: [
      // Redirect the platform's shared/design-mode to a local stub so the
      // build works when only apps/web is present (e.g. Railway deployment).
      {
        find: /.*\/shared\/design-mode$/,
        replacement: path.resolve(__dirname, './src/_shared/design-mode'),
      },
      { find: 'lodash', replacement: 'lodash-es' },
      { find: 'npm:stripe', replacement: 'stripe' },
      { find: 'stripe', replacement: path.resolve(__dirname, './src/__create/stripe') },
      { find: '@auth/create/react', replacement: '@hono/auth-js/react' },
      { find: '@auth/create', replacement: path.resolve(__dirname, './src/__create/@auth/create') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  ssr: {
    // sharp is a native Node.js module — Vite cannot bundle it,
    // so we mark it (and its dependents) as external for the server build.
    external: ['sharp', 'qrcode', 'canvas', 'arabic-reshaper', 'bidi-js'],
    noExternal: [],
  },
  build: {
    target: 'esnext',
  },
  clearScreen: false,
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 4000,
    fs: {
      allow: ['..', '../../shared'],
    },
    hmr: {
      overlay: false,
    },
    warmup: {
      clientFiles: ['./src/app/**/*', './src/app/root.tsx', './src/app/routes.ts'],
    },
  },
});
