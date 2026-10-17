-- Migration 003: Per-scan timestamps on QR tokens
-- Overlay-mode tokens cover multiple admissions (main guest + companions) on
-- one token. `used_at` only recorded the final scan's time; scan_log stores
-- a timestamp for every individual scan so each row (main/companion) can
-- show its own attendance time.
-- Run once against the Neon database.

ALTER TABLE traheeb_qr_tokens
  ADD COLUMN IF NOT EXISTS scan_log JSONB NOT NULL DEFAULT '[]'::jsonb;
