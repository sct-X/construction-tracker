-- 001_init: every table in SPEC.md "Data model".
-- Dates are TEXT 'YYYY-MM-DD' (Australia/Sydney); instants are TEXT ISO 8601 UTC.
-- Booleans are INTEGER 0/1. JSON columns are TEXT. Field names map to
-- columns in packages/server/src/schema.ts (camelCase <-> snake_case).
-- Foreign keys are DEFERRABLE INITIALLY DEFERRED so a change set can insert
-- or delete rows in any order within its transaction.

CREATE TABLE side (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  telegram_user_id TEXT
);

CREATE TABLE job (
  id TEXT PRIMARY KEY,
  side_id TEXT NOT NULL REFERENCES side(id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('build', 'design')),
  path TEXT CHECK (path IN ('DA', 'CDC')),
  weekly_holding_cost REAL,
  last_confirmed TEXT,
  is_template INTEGER NOT NULL DEFAULT 0,
  planned_finish TEXT,
  start_date TEXT,
  starts_from_stage_id TEXT REFERENCES stage(id) DEFERRABLE INITIALLY DEFERRED,
  template_id TEXT REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  created_at TEXT NOT NULL
);

CREATE TABLE stage (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'done'))
);
CREATE INDEX stage_job ON stage(job_id);

CREATE TABLE step (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  stage_id TEXT NOT NULL REFERENCES stage(id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days >= 1),
  planned_start TEXT,
  planned_end TEXT,
  actual_start TEXT,
  actual_end TEXT,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'done')),
  is_hold_point INTEGER NOT NULL DEFAULT 0,
  is_placeholder INTEGER NOT NULL DEFAULT 0,
  trade_type TEXT
);
CREATE INDEX step_job ON step(job_id);

CREATE TABLE step_link (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  step_id TEXT NOT NULL REFERENCES step(id) DEFERRABLE INITIALLY DEFERRED,
  waits_for_step_id TEXT NOT NULL REFERENCES step(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX step_link_job ON step_link(job_id);

CREATE TABLE requirement (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  step_id TEXT NOT NULL REFERENCES step(id) DEFERRABLE INITIALLY DEFERRED,
  kind TEXT NOT NULL CHECK (kind IN ('trade', 'material')),
  name TEXT NOT NULL,
  lead_time_weeks REAL NOT NULL,
  trade_type TEXT
);

CREATE TABLE trade (
  id TEXT PRIMARY KEY,
  side_id TEXT NOT NULL REFERENCES side(id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  phone TEXT
);

CREATE TABLE shipment (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL,
  supplier TEXT,
  status TEXT NOT NULL CHECK (status IN ('design', 'in_production', 'shipped', 'delivered')),
  eta TEXT,
  notes TEXT
);

CREATE TABLE photo_category (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  stage_id TEXT REFERENCES stage(id) DEFERRABLE INITIALLY DEFERRED,
  name TEXT NOT NULL,
  required_for_hold_point INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL
);

CREATE TABLE inbound_message (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'email', 'web')),
  sender TEXT NOT NULL,
  raw_text TEXT,
  audio_path TEXT,
  transcript TEXT,
  photo_path TEXT,
  received_at TEXT NOT NULL
);

CREATE TABLE photo (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  stage_id TEXT REFERENCES stage(id) DEFERRABLE INITIALLY DEFERRED,
  category_id TEXT NOT NULL REFERENCES photo_category(id) DEFERRABLE INITIALLY DEFERRED,
  file_path TEXT NOT NULL,
  caption TEXT,
  taken_on TEXT NOT NULL,
  received_at TEXT NOT NULL,
  is_placeholder INTEGER NOT NULL DEFAULT 0,
  message_id TEXT REFERENCES inbound_message(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX photo_category_idx ON photo(category_id);

CREATE TABLE item (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  type TEXT NOT NULL CHECK (type IN ('trade', 'material', 'decision', 'consultant_report', 'council_request', 'inspection', 'defect', 'condition_of_consent', 'manual_reminder')),
  title TEXT NOT NULL,
  waiting_on TEXT,
  owner TEXT,
  trade_id TEXT REFERENCES trade(id) DEFERRABLE INITIALLY DEFERRED,
  needed_by TEXT,
  lead_time_weeks REAL,
  expected_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('to_do', 'ordered_or_booked', 'confirmed', 'done')),
  confirmed_date TEXT,
  notes TEXT,
  step_id TEXT REFERENCES step(id) DEFERRABLE INITIALLY DEFERRED,
  requirement_id TEXT REFERENCES requirement(id) DEFERRABLE INITIALLY DEFERRED,
  shipment_id TEXT REFERENCES shipment(id) DEFERRABLE INITIALLY DEFERRED,
  photo_id TEXT REFERENCES photo(id) DEFERRABLE INITIALLY DEFERRED,
  created_at TEXT NOT NULL,
  done_at TEXT
);
CREATE INDEX item_job ON item(job_id);

CREATE TABLE daily_note (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  message_id TEXT REFERENCES inbound_message(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE forecast_snapshot (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) DEFERRABLE INITIALLY DEFERRED,
  date TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  forecast_finish TEXT,
  step_starts TEXT NOT NULL DEFAULT '{}',
  step_ends TEXT NOT NULL DEFAULT '{}',
  UNIQUE (job_id, date)
);

CREATE TABLE change_set (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES inbound_message(id) DEFERRABLE INITIALLY DEFERRED,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'confirmed', 'cancelled', 'undone')),
  summary TEXT NOT NULL,
  op_name TEXT,
  op_args TEXT,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  cancelled_at TEXT,
  undone_at TEXT
);

CREATE TABLE change (
  id TEXT PRIMARY KEY,
  change_set_id TEXT NOT NULL REFERENCES change_set(id) DEFERRABLE INITIALLY DEFERRED,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('update', 'insert', 'delete')),
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  field TEXT,
  before_json TEXT,
  after_json TEXT,
  UNIQUE (change_set_id, seq)
);
CREATE INDEX change_row ON change(table_name, row_id);
