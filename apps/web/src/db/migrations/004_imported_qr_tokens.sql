-- Migration 004: Imported QR tokens
-- Tokens generated outside Traheeb (e.g. a third-party ticketing run) that an
-- organizer uploads via Excel and wants scannable through the normal camera
-- scanner. Mirrors scan_count/max_scans/scan_log from traheeb_qr_tokens so
-- the one-use-only scan logic can be reused unchanged.
-- Not tied to a guest — there is no guest_id column.
-- Run once against the Neon database.

CREATE TABLE IF NOT EXISTS traheeb_imported_qr_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES traheeb_events(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  used_at    TIMESTAMPTZ,
  scan_count INT NOT NULL DEFAULT 0,
  max_scans  INT NOT NULL DEFAULT 1,
  scan_log   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, token)
);
CREATE INDEX IF NOT EXISTS traheeb_imported_qr_event_token_idx
  ON traheeb_imported_qr_tokens (event_id, token);
