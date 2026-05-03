-- Traheeb schema migration 001
-- Run once against the Neon database.

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Application profile linked to Auth.js auth_users table.
CREATE TABLE IF NOT EXISTS traheeb_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id    UUID UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,        -- E.164 e.g. +966XXXXXXXXX
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── OTP codes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traheeb_otp_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,              -- 6-digit string
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS traheeb_otp_phone_idx ON traheeb_otp_codes (phone);

-- ── WhatsApp sessions ─────────────────────────────────────────────────────────
-- Baileys credentials + signal-key-store persisted per user.
CREATE TABLE IF NOT EXISTS traheeb_whatsapp_sessions (
  user_id    TEXT PRIMARY KEY,           -- userId string (UUID or 'SYSTEM')
  creds      JSONB NOT NULL,
  keys       JSONB NOT NULL DEFAULT '{}',
  connected  BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Events ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traheeb_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES traheeb_users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  date                 TEXT NOT NULL,             -- stored as YYYY-MM-DD string
  time                 TEXT NOT NULL,             -- Arabic format e.g. "6:00 م"
  category             TEXT NOT NULL DEFAULT 'أخرى',
  capacity             INT  NOT NULL DEFAULT 100,
  venue                TEXT NOT NULL,
  location             TEXT,
  map_lat              DOUBLE PRECISION,
  map_lng              DOUBLE PRECISION,
  invitation_text      TEXT,
  reminder             TEXT NOT NULL DEFAULT '24hours',
  event_logo_url       TEXT,
  invitation_media_url TEXT,
  qr_background_url    TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS traheeb_events_user_id_idx ON traheeb_events (user_id);

-- ── Guests ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS traheeb_guests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES traheeb_events(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  companions        INT  NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'invited', -- invited | confirmed | declined | attended
  invitation_token  TEXT UNIQUE,                     -- UUID embedded in confirm/decline URL
  ticket_id         TEXT UNIQUE,                     -- e.g. TKT-XXXXXX
  invited_at        TIMESTAMPTZ,
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS traheeb_guests_event_id_idx ON traheeb_guests (event_id);
CREATE INDEX IF NOT EXISTS traheeb_guests_token_idx    ON traheeb_guests (invitation_token);

-- ── QR tokens ─────────────────────────────────────────────────────────────────
-- One per guest (label='main') + one per companion (label='companion-N').
CREATE TABLE IF NOT EXISTS traheeb_qr_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id   UUID NOT NULL REFERENCES traheeb_guests(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES traheeb_events(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,        -- 32-char hex
  label      TEXT NOT NULL DEFAULT 'main',
  qr_url     TEXT,                        -- CDN URL of styled QR PNG
  used       BOOLEAN NOT NULL DEFAULT false,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS traheeb_qr_token_idx    ON traheeb_qr_tokens (token);
CREATE INDEX IF NOT EXISTS traheeb_qr_guest_id_idx ON traheeb_qr_tokens (guest_id);
