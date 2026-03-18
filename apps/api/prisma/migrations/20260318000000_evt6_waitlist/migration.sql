-- Add waitlist position to attendees
ALTER TABLE "event_attendees"
ADD COLUMN "waitlist_position" INTEGER;

-- Keep attendee idempotency by event + guest email
CREATE UNIQUE INDEX "event_attendees_event_id_guest_email_key"
ON "event_attendees"("event_id", "guest_email")
WHERE "guest_email" IS NOT NULL;

-- Ensure waitlist positions are unique within each event for active waitlist rows
CREATE UNIQUE INDEX "event_attendees_event_id_waitlist_position_key"
ON "event_attendees"("event_id", "waitlist_position")
WHERE "waitlist_position" IS NOT NULL;
