-- Migration 002: Named companions
-- Links individual companion names to their main guest record.
-- Run once against the Neon database.

CREATE TABLE IF NOT EXISTS traheeb_companion_names (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_guest_id  UUID NOT NULL REFERENCES traheeb_guests(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES traheeb_events(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  label          TEXT NOT NULL,   -- matches traheeb_qr_tokens.label e.g. 'companion-1'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(main_guest_id, label)    -- one name per companion slot per guest
);

CREATE INDEX IF NOT EXISTS traheeb_companion_names_guest_idx ON traheeb_companion_names (main_guest_id);
CREATE INDEX IF NOT EXISTS traheeb_companion_names_event_idx ON traheeb_companion_names (event_id);
