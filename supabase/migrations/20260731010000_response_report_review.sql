-- Reviewer audit history for advisor-response reports (R-3 / B-23).
--
-- The report row itself is the immutable evidence; this table is the append-only record of what
-- reviewers did to it. Separating them is the point: a status update must never overwrite the
-- history of previous status updates, and original evidence must never be editable at all.

CREATE TABLE IF NOT EXISTS feedback.advisor_report_events (
    event_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id     uuid NOT NULL REFERENCES feedback.advisor_response_reports(report_id),
    actor_email   text NOT NULL,          -- authenticated reviewer, resolved server-side
    actor_user_id uuid,
    action        text NOT NULL CHECK (action IN (
                      'assigned','severity_changed','status_changed',
                      'note_added','duplicate_linked','escalated','access_denied')),
    previous_value text,
    new_value      text,
    note           text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advisor_report_events_report_idx
    ON feedback.advisor_report_events (report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS advisor_report_events_actor_idx
    ON feedback.advisor_report_events (actor_email, created_at DESC);

ALTER TABLE feedback.advisor_report_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.advisor_report_events FORCE ROW LEVEL SECURITY;

-- Service-role only. Reviewers reach it through the API, which resolves their identity from the
-- verified JWT — never directly.
DROP POLICY IF EXISTS service_advisor_report_events ON feedback.advisor_report_events;
CREATE POLICY service_advisor_report_events
    ON feedback.advisor_report_events FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT ALL ON feedback.advisor_report_events TO service_role;

COMMENT ON TABLE feedback.advisor_report_events IS
    'Append-only reviewer audit history for advisor-response reports (B-23). The report row holds '
    'immutable evidence; this holds what reviewers did. No UPDATE or DELETE path exists in the '
    'application contract.';
