import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Waitlist placement integration', () => {
  let app: INestApplication | null = null;
  let client: Client | null = null;

  beforeAll(async () => {
    process.env.PUBLIC_INVITE_BASE_URL = 'http://localhost:3000/api/v1/invite-links';

    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await client?.query('TRUNCATE TABLE "event_attendees", "invite_links", "events", "auth_identities", "users" CASCADE');
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-1',
      'Organizer One',
    ]);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (client) {
      await client.end();
    }
  });

  async function createEventWithInvite() {
    const eventResponse = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', 'organizer-1')
      .send({
        title: 'Capacity Event',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'UTC',
        capacityLimit: 2,
      })
      .expect(201);

    const eventId = eventResponse.body.id as string;

    const inviteResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(201);

    return {
      eventId,
      token: inviteResponse.body.token as string,
    };
  }

  async function rsvp(token: string, guestName: string, guestEmail: string, status: 'going' | 'maybe' | 'not_going') {
    return request(app!.getHttpServer())
      .post(`/api/v1/invite-links/${token}/rsvp`)
      .send({ guestName, guestEmail, status });
  }

  it('fills capacity, assigns waitlist, compacts waitlist, and auto-promotes on freed seat', async () => {
    const { eventId, token } = await createEventWithInvite();

    const a = await rsvp(token, 'Guest A', 'a@example.com', 'going');
    const b = await rsvp(token, 'Guest B', 'b@example.com', 'going');
    const c = await rsvp(token, 'Guest C', 'c@example.com', 'going');
    const d = await rsvp(token, 'Guest D', 'd@example.com', 'going');

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(c.status).toBe(201);
    expect(d.status).toBe(201);

    expect(c.body.attendanceState).toBe('waitlisted');
    expect(c.body.waitlistPosition).toBe(1);
    expect(d.body.attendanceState).toBe('waitlisted');
    expect(d.body.waitlistPosition).toBe(2);

    const cMaybe = await rsvp(token, 'Guest C Updated', 'c@example.com', 'maybe');
    expect(cMaybe.status).toBe(200);
    expect(cMaybe.body.attendanceState).toBe('not_attending');
    expect(cMaybe.body.waitlistPosition).toBeNull();

    const dAfterCompact = await rsvp(token, 'Guest D Updated', 'd@example.com', 'going');
    expect(dAfterCompact.status).toBe(200);
    expect(dAfterCompact.body.attendanceState).toBe('waitlisted');
    expect(dAfterCompact.body.waitlistPosition).toBe(1);

    const aNotGoing = await rsvp(token, 'Guest A', 'a@example.com', 'not_going');
    expect(aNotGoing.status).toBe(200);
    expect(aNotGoing.body.attendanceState).toBe('not_attending');
    expect(aNotGoing.body.waitlistPosition).toBeNull();

    const attendeeRows = await client?.query(
      `SELECT guest_email, response_status, waitlist_position
       FROM event_attendees
       WHERE event_id = $1
       ORDER BY guest_email ASC`,
      [eventId],
    );

    expect(attendeeRows?.rows).toEqual([
      { guest_email: 'a@example.com', response_status: 'NOT_GOING', waitlist_position: null },
      { guest_email: 'b@example.com', response_status: 'GOING', waitlist_position: null },
      { guest_email: 'c@example.com', response_status: 'MAYBE', waitlist_position: null },
      { guest_email: 'd@example.com', response_status: 'GOING', waitlist_position: null },
    ]);

    const resolveResponse = await request(app!.getHttpServer()).get(`/api/v1/invite-links/${token}`).expect(200);
    expect(resolveResponse.body.rsvpSummary).toEqual({
      going: 2,
      maybe: 1,
      notGoing: 1,
      total: 4,
      confirmedGoing: 2,
      waitlistedGoing: 0,
      capacityLimit: 2,
      remainingSpots: 0,
      isFull: true,
    });

    const organizerAttendees = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/attendees`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(organizerAttendees.body.summary).toEqual({
      going: 2,
      maybe: 1,
      notGoing: 1,
      total: 4,
      confirmedGoing: 2,
      waitlistedGoing: 0,
      capacityLimit: 2,
      remainingSpots: 0,
      isFull: true,
    });

    expect(organizerAttendees.body.attendees.map((attendee: { guestEmail: string }) => attendee.guestEmail)).toEqual([
      'b@example.com',
      'd@example.com',
      'c@example.com',
      'a@example.com',
    ]);

    expect(organizerAttendees.body.attendees.map((attendee: { attendanceState: string }) => attendee.attendanceState)).toEqual([
      'confirmed',
      'confirmed',
      'not_attending',
      'not_attending',
    ]);
  });
});
