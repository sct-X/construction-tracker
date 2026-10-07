-- Reminders already sent (the scheduler's dedup). One row per reminder key,
-- e.g. "actby:<itemId>:<actBy>:soon" or "amber:<jobId>:<lastConfirmed>".
-- Not a Dataset table: the Store never loads it and change sets never touch it.
CREATE TABLE reminder_sent (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  job_id TEXT,
  item_id TEXT,
  due_on TEXT,
  text TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
