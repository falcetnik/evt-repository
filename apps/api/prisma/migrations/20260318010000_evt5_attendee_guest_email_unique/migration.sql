-- EVT-5: ensure unique attendee identity per event + normalized guest email
CREATE UNIQUE INDEX "event_attendees_event_id_guest_email_key"
ON "event_attendees"("event_id", "guest_email");
