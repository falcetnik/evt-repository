-- AlterTable
ALTER TABLE "event_attendees" ADD COLUMN "waitlist_position" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "event_attendees_event_id_waitlist_position_unique_non_null"
ON "event_attendees" ("event_id", "waitlist_position")
WHERE "waitlist_position" IS NOT NULL;
