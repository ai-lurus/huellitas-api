-- Daily notification limits
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES lost_reports(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, report_id)  -- prevent duplicate alerts for same report
);
CREATE INDEX IF NOT EXISTS idx_notification_log_user_date ON notification_log(user_id, sent_at);
