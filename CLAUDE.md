# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo with two apps:
- `apps/web` — React Router v7 full-stack web app with Hono server (SSR enabled)
- `apps/mobile` — React Native / Expo mobile app

## Commands

### Web App (`apps/web`)

```bash
npm run dev        # Start dev server on port 4000
npm run build      # Production build (SSR)
npm run typecheck  # TypeScript type checking + type generation
npm test           # Run Vitest tests
```

Run a single test file:
```bash
npm test -- src/path/to/file.test.tsx
npm test -- --grep="pattern"
```

### Mobile App (`apps/mobile`)

```bash
npm start          # Start Expo dev server
npm test           # Run Jest tests (jest-expo preset)
```

Run a single test file:
```bash
npm test -- __create/testflight-logger.test.ts
```

## Web App Architecture

The web app is a **React Router v7 full-stack app** with Hono as the server runtime.

**Routing:** File-based via `src/app/routes.ts` (a custom dynamic route generator). Pages use `page.jsx` files; parameter routes use `[id]`, `[[optional]]`, `[...catchall]` syntax. API routes live under `/api`.

**Server:** Hono handles SSR, API routes, and authentication. Configured in `vite.config.ts` via `reactRouterHonoServer`. Server entry: `src/__create/index.ts`.

**Authentication:** Auth.js with Hono adapter. Supports credentials, Google, Facebook, Twitter, and Apple sign-in. The `useAuth()` hook in `src/utils/useAuth.js` is the primary auth interface; the app is wrapped in `SessionProvider`.

**State:** Zustand for client-side state, TanStack React Query for server state.

**Key utilities** (`src/utils/`):
- `useAuth.js` — auth hook
- `useUser.js` — current user data
- `useUpload.js` — file upload helper
- `useHandleStreamResponse.js` — streaming API responses
- `create.js` — DB helper

**Client integrations** (`src/client-integrations/`): Component wrappers for Chakra UI, shadcn-ui, Recharts, PDF.js, and Markdown.

**Custom Vite plugins** (in `vite.config.ts`):
- `layoutWrapperPlugin` — auto-wraps routes with layout components
- `loadFontsFromTailwindSource` — Tailwind font loading
- `addRenderIds`, `aliases`, `restart`, `console-to-parent` — dev/build helpers

**TypeScript path alias:** `@/*` maps to `src/*`.

**Environment variables:** Use `NEXT_PUBLIC_` prefix convention; loaded from `.env`.

## Mobile App Architecture

Pure Expo/React Native app with **Expo Router** for file-based routing.

**Entry points:**
- `index.tsx` — app initialization and global error handling
- `entrypoint.ts` — Expo Router root
- `App.tsx` — re-exports Expo Router App

**Routing:** Pages in `src/app/`. Layout: `src/app/_layout.jsx`. Auth gate: `src/app/auth.jsx`.

**State:** Zustand stores in `src/store/` — `appAuthStore`, `eventStore`. TanStack Query for server state.

**Key build files:**
- `metro.config.js` — Metro bundler with platform aliases and web polyfills (`/polyfills/web/`)
- `eas.json` — EAS cloud build/submit configuration
- `babel.config.js` — Babel config (NativeWind/Tailwind for RN)

**Environment variables:** Use `EXPO_PUBLIC_` prefix; loaded from `.env`.

**Testing:** Jest with `jest-expo` preset. Test files in `__create/` directory (e.g., `testflight-logger.test.ts`, `report-error-to-remote.test.js`).

## Key Design Decisions

- **SSR is enabled** on the web app — avoid browser-only APIs outside of client-side hooks/effects.
- **Hono** is the backend runtime, not Express or Next.js API routes.
- **Fetch is wrapped** (adds project headers, handles sandbox iframes) — use the wrapped fetch utility rather than calling `fetch` directly.
- **Cross-platform mobile:** Expo is configured to run React Native on web too, with Metro polyfills for web-incompatible modules.
- **Design mode:** Web app has design-mode helpers for UI testing/debugging (dev only).
