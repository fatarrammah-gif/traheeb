-- Migration 002: Guest relations
-- Stores which guests are companions of a main guest.
-- Does NOT modify traheeb_guests.
-- Run once against the Neon database.

CREATE TABLE IF NOT EXISTS traheeb_guest_relations (
  guest_id      UUID PRIMARY KEY REFERENCES traheeb_guests(id) ON DELETE CASCADE,
  main_guest_id UUID NOT NULL REFERENCES traheeb_guests(id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES traheeb_events(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS traheeb_guest_relations_main_idx  ON traheeb_guest_relations (main_guest_id);
CREATE INDEX IF NOT EXISTS traheeb_guest_relations_event_idx ON traheeb_guest_relations (event_id);
