CREATE TABLE "event_reminders" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "offset_minutes" INTEGER NOT NULL,
    "send_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_reminders_event_id_offset_minutes_key" ON "event_reminders"("event_id", "offset_minutes");
CREATE INDEX "event_reminders_send_at_idx" ON "event_reminders"("send_at");

ALTER TABLE "event_reminders"
    ADD CONSTRAINT "event_reminders_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
