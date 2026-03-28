import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

function futureUtcIso(base: Date, daysAhead: number, hour: number, minute = 0) {
  const date = new Date(base);
  date.setUTCSeconds(0, 0);
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function minusMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

const BASE_NOW = new Date();
const ORIGINAL_STARTS_AT = futureUtcIso(BASE_NOW, 7, 18, 0);
const PATCHED_STARTS_AT = futureUtcIso(BASE_NOW, 7, 20, 0);
const PATCHED_REMINDER_SEND_AT_120 = minusMinutes(PATCHED_STARTS_AT, 120);
const PATCHED_REMINDER_SEND_AT_30 = minusMinutes(PATCHED_STARTS_AT, 30);

describe('Events update API integration', () => {
  let app: INestApplication | null = null;
  let client: Client | null = null;

  beforeAll(async () => {
    process.env.PUBLIC_INVITE_BASE_URL = 'http://localhost:3000/api/v1/invite-links';

    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await client.query('SET search_path TO event_app_test');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await client?.query(
      'TRUNCATE TABLE "event_reminders", "event_attendees", "invite_links", "events", "auth_identities", "users" CASCADE',
    );
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-1',
      'Organizer One',
    ]);
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-2',
      'Organizer Two',
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

  async function createEvent(owner = 'organizer-1', capacityLimit: number | null = 2, allowPlusOnes = false) {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', owner)
      .send({
        title: 'Original Title',
        description: 'Original Description',
        location: 'Original Location',
        startsAt: ORIGINAL_STARTS_AT,
        timezone: 'UTC',
        capacityLimit,
        allowPlusOnes,
      })
      .expect(201);

    return response.body.id as string;
  }

  async function createInviteToken(eventId: string) {
    const response = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(201);

    return response.body.token as string;
  }

  function rsvp(token: string, guestName: string, guestEmail: string, status: 'going' | 'maybe' | 'not_going') {
    return request(app!.getHttpServer()).post(`/api/v1/invite-links/${token}/rsvp`).send({ guestName, guestEmail, status });
  }

  it('organizer updates basic fields successfully', async () => {
    const eventId = await createEvent();

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({
        title: '  Updated Title  ',
        description: '  Updated Description  ',
        location: '  Updated Location  ',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: eventId,
      title: 'Updated Title',
      description: 'Updated Description',
      location: 'Updated Location',
      organizerUserId: 'organizer-1',
    });
  });

  it('updates allowPlusOnes field', async () => {
    const eventId = await createEvent();

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ allowPlusOnes: true })
      .expect(200);

    expect(response.body.allowPlusOnes).toBe(true);
  });

  it('returns 401 when organizer header is missing', async () => {
    const eventId = await createEvent();

    await request(app!.getHttpServer()).patch(`/api/v1/events/${eventId}`).send({ title: 'Updated Title' }).expect(401);
  });

  it('returns 401 when organizer is unknown', async () => {
    const eventId = await createEvent();

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'unknown-user')
      .send({ title: 'Updated Title' })
      .expect(401);
  });

  it('returns 404 when non-owner tries to update', async () => {
    const eventId = await createEvent();

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-2')
      .send({ title: 'Updated Title' })
      .expect(404);
  });

  it('partial update changes only provided fields', async () => {
    const eventId = await createEvent();

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ title: 'Only Title Update' })
      .expect(200);

    expect(response.body.title).toBe('Only Title Update');
    expect(response.body.description).toBe('Original Description');
    expect(response.body.location).toBe('Original Location');
    expect(response.body.startsAt).toBe(ORIGINAL_STARTS_AT);
    expect(response.body.timezone).toBe('UTC');
    expect(response.body.capacityLimit).toBe(2);
  });

  it('updating startsAt recalculates existing reminder sendAt values', async () => {
    const eventId = await createEvent();

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [30, 120] })
      .expect(200);

    const patchResponse = await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ startsAt: PATCHED_STARTS_AT })
      .expect(200);

    expect(patchResponse.body.startsAt).toBe(PATCHED_STARTS_AT);

    const remindersResponse = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(
      remindersResponse.body.reminders.map(
        (reminder: { offsetMinutes: number; sendAt: string }) => ({
          offsetMinutes: reminder.offsetMinutes,
          sendAt: reminder.sendAt,
        }),
      ),
    ).toEqual([
      { offsetMinutes: 120, sendAt: PATCHED_REMINDER_SEND_AT_120 },
      { offsetMinutes: 30, sendAt: PATCHED_REMINDER_SEND_AT_30 },
    ]);
  });

  it('returns 400 and keeps event/reminders unchanged when startsAt makes reminder invalid', async () => {
    const eventId = await createEvent();

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [30] })
      .expect(200);

    const startsAtBefore = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    const remindersBefore = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    const invalidStartsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ startsAt: invalidStartsAt })
      .expect(400);

    const startsAtAfter = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    const remindersAfter = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(startsAtAfter.body.startsAt).toBe(startsAtBefore.body.startsAt);
    expect(remindersAfter.body.reminders).toEqual(remindersBefore.body.reminders);
  });

  it('increasing capacity promotes earliest waitlisted going attendees', async () => {
    const eventId = await createEvent('organizer-1', 1);
    const token = await createInviteToken(eventId);

    await rsvp(token, 'Guest A', 'a@example.com', 'going').expect(201);
    await rsvp(token, 'Guest B', 'b@example.com', 'going').expect(201);
    await rsvp(token, 'Guest C', 'c@example.com', 'going').expect(201);

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ capacityLimit: 2 })
      .expect(200);

    const attendeesResponse = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/attendees`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    const byEmail = new Map<
      string,
      { guestEmail: string; attendanceState: string; waitlistPosition: number | null }
    >(
      attendeesResponse.body.attendees.map(
        (attendee: { guestEmail: string; attendanceState: string; waitlistPosition: number | null }) => [
          attendee.guestEmail,
          attendee,
        ],
      ),
    );

    expect(byEmail.get('a@example.com')?.attendanceState).toBe('confirmed');
    expect(byEmail.get('b@example.com')?.attendanceState).toBe('confirmed');
    expect(byEmail.get('c@example.com')?.attendanceState).toBe('waitlisted');
    expect(byEmail.get('c@example.com')?.waitlistPosition).toBe(1);
  });

  it('clearing capacity confirms all waitlisted going attendees', async () => {
    const eventId = await createEvent('organizer-1', 1);
    const token = await createInviteToken(eventId);

    await rsvp(token, 'Guest A', 'a@example.com', 'going').expect(201);
    await rsvp(token, 'Guest B', 'b@example.com', 'going').expect(201);
    await rsvp(token, 'Guest C', 'c@example.com', 'going').expect(201);

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ capacityLimit: null })
      .expect(200);

    expect(response.body.capacityLimit).toBeNull();

    const attendeesResponse = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/attendees`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(attendeesResponse.body.summary.confirmedGoing).toBe(3);
    expect(attendeesResponse.body.summary.waitlistedGoing).toBe(0);
    expect(attendeesResponse.body.attendees.every((attendee: { waitlistPosition: number | null }) => attendee.waitlistPosition === null)).toBe(
      true,
    );
  });

  it('reducing capacity below confirmed going count returns 400 and keeps attendee placement', async () => {
    const eventId = await createEvent('organizer-1', 3);
    const token = await createInviteToken(eventId);

    await rsvp(token, 'Guest A', 'a@example.com', 'going').expect(201);
    await rsvp(token, 'Guest B', 'b@example.com', 'going').expect(201);
    await rsvp(token, 'Guest C', 'c@example.com', 'going').expect(201);

    const attendeesBefore = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/attendees`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ capacityLimit: 2 })
      .expect(400);

    const attendeesAfter = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/attendees`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(attendeesAfter.body.attendees).toEqual(attendeesBefore.body.attendees);
  });

  it('rejects disabling plus ones when attendees already use them', async () => {
    const eventId = await createEvent('organizer-1', 5, true);
    const token = await createInviteToken(eventId);

    await request(app!.getHttpServer())
      .post(`/api/v1/invite-links/${token}/rsvp`)
      .send({
        guestName: 'Guest A',
        guestEmail: 'a@example.com',
        status: 'going',
        plusOnesCount: 2,
      })
      .expect(201);

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ allowPlusOnes: false })
      .expect(400);
  });
});
