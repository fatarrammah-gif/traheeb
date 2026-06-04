# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Traheeb Does

Traheeb (تراحيب) is an Arabic-language event management platform. Organizers create events, import guest lists, and send WhatsApp invitations. Guests confirm or decline via WhatsApp buttons or a confirmation link. Confirmed guests receive QR-code admission tickets. At the venue, organizers scan QR codes using the mobile app's built-in scanner.

**Guest lifecycle:** `invited` → `confirmed` → `attended` (or `declined`)

## Repository Structure

Monorepo with two apps:
- `apps/web` — React Router v7 full-stack app (Hono SSR). Hosts all API routes, confirmation/decline pages, and a local dev dashboard.
- `apps/mobile` — React Native / Expo app. Organizer-facing: create events, manage guest lists, connect WhatsApp, scan QR codes at entry.

## Commands

### Web App (`apps/web`)

```bash
npm run dev        # Start dev server on port 4000
npm run build      # Production build (SSR)
npm run start      # Run production build
npm run typecheck  # TypeScript type checking + type generation
npm test           # Run Vitest tests
npm test -- src/path/to/file.test.tsx
npm test -- --grep="pattern"
```

### Mobile App (`apps/mobile`)

```bash
npm start          # Start Expo dev server
npm test           # Run Jest tests (jest-expo preset)
npm test -- __create/testflight-logger.test.ts
```

## Database Schema (Neon PostgreSQL)

Single migration: `apps/web/src/db/migrations/001_schema.sql`

| Table | Purpose |
|---|---|
| `traheeb_users` | Organizer accounts (id, name, phone E.164) |
| `traheeb_otp_codes` | 6-digit OTPs with 5-min expiry, phone-indexed |
| `traheeb_whatsapp_sessions` | whatsapp-web.js session state per user (creds, keys, connected) |
| `traheeb_events` | Event records with date/time/venue/capacity/media URLs |
| `traheeb_guests` | Guests per event with status, invitation_token (UUID), ticket_id |
| `traheeb_qr_tokens` | One token per guest + one per companion; `used` flag for atomic scan |

The `sql` tagged-template helper (`src/app/api/utils/sql.js`) auto-selects `@neondatabase/serverless` for Neon URLs or `pg` pool for local Postgres. Use `sql.begin(tx => ...)` for transactions.

## Authentication

**Custom OTP flow** (not Auth.js sessions):

1. `POST /api/auth/otp/send` — generates 6-digit OTP, sends via Twilio SMS, stores in `traheeb_otp_codes`
2. `POST /api/auth/otp/verify` — validates OTP, upserts `traheeb_users`, returns a signed JWT (`@auth/core/jwt`, salt `authjs.session-token`, 30-day expiry)
3. JWT `sub` = `traheeb_users.id`

All protected API routes call `authenticate(request)` from `src/app/api/utils/auth.js`, which decodes the `Authorization: Bearer <jwt>` header and returns `{ authId, user }`.

**Mobile:** JWT stored in `expo-secure-store` by `appAuthStore`. `src/__create/fetch.ts` auto-injects the `Authorization` header on all `fetchToWeb()` calls.

## WhatsApp Integration (Dual Architecture)

There are **two separate WhatsApp channels** — don't confuse them:

### 1. Organizer's personal WhatsApp (whatsapp-web.js + Puppeteer)
Used to send invitations (Arabic text with confirm/decline URLs) and QR images directly from the organizer's own number.

- `src/services/whatsapp/SessionManager.js` — in-memory session map, `getOrStartSession()`, `initAllSessions()` (called at boot)
- Sessions persist via `LocalAuth` (`.wwebjs_auth/<userId>/`). On Railway: mount a Volume at `/app/apps/web/.wwebjs_auth`
- `src/services/whatsapp/messageHandler.js` — handles incoming messages; "نعم" → confirm + send QR; "لا" → decline
- `src/services/whatsapp/sender.js` — `sendText()`, `sendImages()`
- Mobile connects the organizer's WhatsApp at `(tabs)/whatsapp-connect.jsx` via `POST /api/whatsapp/connect`

### 2. Meta WhatsApp Cloud API (business number)
Used to send the `attendance_conf` template with Quick Reply buttons (تأكيد / اعتذار).

- `src/services/whatsapp/metaSender.js` — `sendInvitationTemplate()`, `sendTextMessage()`, `sendImageMessage()`
- Webhook at `POST /api/webhooks/whatsapp` handles button-tap replies from guests
- Template name: `attendance_conf` (en_US language, named body parameters)

**Invitations sent via Meta API** (not the organizer's personal session). **QR images sent via organizer's personal session** after confirmation.

## QR Code Pipeline

Two paths for generating/sending QR cards:

1. **Via confirmation link** (`GET /api/confirm/[token]`) — guest taps confirm URL → generates `traheeb_qr_tokens` → calls `generateStyledQR()` → sends PNG via organizer's whatsapp-web.js session
2. **Via Meta webhook** (button tap) → updates guest status → sends text confirmation only (QR via separate flow if organizer session is active)
3. **`qrService.js`** — full pipeline: token → `generateQRCard()` → upload PNG to ImgBB → save URL → `sendImageMessage()` via Meta API

`src/services/qr/generator.js` — builds an 800×1000 PNG card using `sharp` + SVG text overlay. Logo's darkest color is extracted for QR foreground. `sharp` and `qrcode` are marked as SSR externals in Vite config.

## API Routes Map

```
/api/auth/otp/send          POST  Send OTP via Twilio
/api/auth/otp/verify        POST  Verify OTP, return JWT
/api/auth/token             GET   Exchange Auth.js session cookie for JWT (legacy)
/api/events                 GET/POST  List/create events
/api/events/[id]            GET/PUT/DELETE  Single event
/api/events/[id]/guests     GET/POST  List/bulk-add guests, POST sends Meta invitations
/api/events/[id]/guests/[guestId]  PATCH/DELETE
/api/confirm/[token]        GET   Public — confirm attendance, generate QRs, redirect
/api/decline/[token]        GET   Public — decline attendance, redirect
/api/invitation/[token]     GET   Public — return guest+event data for confirm/decline pages
/api/qr/scan                POST  Auth — atomic QR scan (SELECT FOR UPDATE), marks used
/api/whatsapp/connect       POST  Start whatsapp-web.js session, return QR data URL
/api/whatsapp/disconnect    POST  Logout session
/api/whatsapp/status        GET   Poll connection status
/api/webhooks/whatsapp      GET/POST  Meta webhook (verify + button-tap handler)
```

## Web App Architecture

**Routing:** File-based via `src/app/routes.ts` (custom generator). Pages use `page.jsx`; API routes use `route.js` exporting `GET`/`POST`/etc. Parameter segments: `[id]`, `[[optional]]`, `[...catchall]`.

**Server:** Hono + `react-router-hono-server`. Server entry: `src/__create/index.ts` (calls `initAllSessions()` at startup).

**Pages (non-API):**
- `/` — local dev dashboard (shows OTPs, users, events, WhatsApp status)
- `/confirm/[token]` — guest confirmation result page
- `/decline/[token]` — guest decline result page

**State:** Zustand (client), TanStack React Query (server state).

**TypeScript path alias:** `@/*` → `src/*`

**Environment variables** (web):
```
DATABASE_URL          Neon or Postgres connection string
AUTH_SECRET           JWT signing secret
BASE_URL              Production URL (default: https://traheeb-production.up.railway.app)
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER   OTP SMS
META_PHONE_NUMBER_ID / META_ACCESS_TOKEN / META_WEBHOOK_VERIFY_TOKEN   Meta Cloud API
IMGBB_API_KEY         Image hosting for QR cards
```

## Mobile App Architecture

**Routing:** Expo Router. Tabs defined in `src/app/(tabs)/`:
- `index.jsx` — home / dashboard
- `events/index.jsx` — events list
- `events/[id].jsx` — event detail
- `events/invite.jsx` — import guest CSV + send invitations
- `events/scanner.jsx` — QR scanner (uses `expo-camera`, calls `POST /api/qr/scan`)
- `events/barcode.jsx` — barcode helper
- `create.jsx` — create new event (uploads images to ImgBB directly, sends URLs to API)
- `whatsapp-connect.jsx` — connect organizer's WhatsApp session
- `more.jsx` — settings/profile

**Auth:** `src/store/appAuthStore.js` (Zustand + AsyncStorage + SecureStore). `src/utils/auth/` contains hooks and modal.

**Fetch:** Always use `fetchToWeb` from `src/__create/fetch.ts` — auto-injects `Authorization: Bearer` and points to `EXPO_PUBLIC_WEB_URL`.

**Image uploads:** Mobile uploads directly to ImgBB (`useUpload.js`) and passes the resulting URL to the API — no server-side upload proxy.

**Environment variables** (mobile):
```
EXPO_PUBLIC_WEB_URL               Backend URL
EXPO_PUBLIC_PROJECT_GROUP_ID      Used as SecureStore key prefix
```

## Key Design Decisions

- **SSR enabled** — avoid browser-only APIs outside `useEffect`/client components.
- **`sharp` + `qrcode` are SSR externals** in Vite — never import them in client-side code.
- **whatsapp-web.js sessions are in-memory** (a `Map`) — a Railway redeploy loses all sessions. `initAllSessions()` re-hydrates from DB on boot using `LocalAuth` cached credentials.
- **Puppeteer on Railway** — uses specific Chrome flags in `SessionManager.js`; do not remove `--disable-dev-shm-usage` or add `--no-zygote`.
- **Phone normalization** — Saudi numbers (`05xxxxxxxx`, `5xxxxxxxx`) are normalized to E.164 (`+966...`) throughout. DB lookups use `RIGHT(..., 9)` suffix matching to handle format mismatches.
- **Transactions for QR scan** — `POST /api/qr/scan` uses `SELECT FOR UPDATE` to prevent double-admission races.
- **Arabic UI** — all user-facing strings are Arabic. WhatsApp message templates are in `src/services/whatsapp/templates.js`.
