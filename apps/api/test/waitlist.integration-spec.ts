import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Waitlist placement integration', () => {
  let app: INestApplication;
  let client: Client;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('SET search_path TO event_app_test');
  });

  beforeEach(async () => {
    await client.query('TRUNCATE TABLE "event_attendees", "invite_links", "events", "auth_identities", "users" CASCADE');

    await client.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'user_1',
      'Host User',
    ]);

    await client.query(
      'INSERT INTO "events" ("id", "organizer_user_id", "title", "starts_at", "timezone", "capacity_limit", "updated_at") VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      ['event_1', 'user_1', 'Capacity event', '2030-06-01T18:00:00.000Z', 'UTC', 2],
    );

    await client.query('INSERT INTO "invite_links" ("id", "event_id", "token", "is_active") VALUES ($1, $2, $3, true)', [
      'invite_1',
      'event_1',
      'token-1',
    ]);
  });

  afterAll(async () => {
    await client.end();
    await app.close();
  });

  it('fills capacity, waitlists overflow, compacts waitlist, and auto-promotes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/invite-links/token-1/rsvp')
      .send({ guestName: 'Guest A', guestEmail: 'a@example.com', status: 'going' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.attendanceState).toBe('confirmed');
        expect(body.waitlistPosition).toBeNull();
      });

    await request(app.getHttpServer())
      .post('/api/v1/invite-links/token-1/rsvp')
      .send({ guestName: 'Guest B', guestEmail: 'b@example.com', status: 'going' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.attendanceState).toBe('confirmed');
        expect(body.waitlistPosition).toBeNull();
      });

    await request(app.getHttpServer())
      .post('/api/v1/invite-links/token-1/rsvp')
      .send({ guestName: 'Guest C', guestEmail: 'c@example.com', status: 'going' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.attendanceState).toBe('waitlisted');
        expect(body.waitlistPosition).toBe(1);
      });

    await request(app.getHttpServer())
      .post('/api/v1/invite-links/token-1/rsvp')
      .send({ guestName: 'Guest D', guestEmail: 'd@example.com', status: 'going' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.attendanceState).toBe('waitlisted');
        expect(body.waitlistPosition).toBe(2);
      });

    await request(app.getHttpServer())
      .post('/api/v1/invite-links/token-1/rsvp')
      .send({ guestName: 'Guest C', guestEmail: 'c@example.com', status: 'maybe' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.attendanceState).toBe('not_attending');
        expect(body.waitlistPosition).toBeNull();
      });

    await request(app.getHttpServer())
      .post('/api/v1/invite-links/token-1/rsvp')
      .send({ guestName: 'Guest A', guestEmail: 'a@example.com', status: 'not_going' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.attendanceState).toBe('not_attending');
      });

    const inviteRes = await request(app.getHttpServer()).get('/api/v1/invite-links/token-1').expect(200);

    expect(inviteRes.body.rsvpSummary).toEqual({
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

    const organizerRes = await request(app.getHttpServer())
      .get('/api/v1/events/event_1/attendees')
      .set('x-dev-user-id', 'user_1')
      .expect(200);

    expect(organizerRes.body.summary).toEqual(inviteRes.body.rsvpSummary);
    expect(organizerRes.body.attendees.map((a: { guestEmail: string }) => a.guestEmail)).toEqual([
      'b@example.com',
      'd@example.com',
      'c@example.com',
      'a@example.com',
    ]);

    const attendeeD = organizerRes.body.attendees.find((a: { guestEmail: string }) => a.guestEmail === 'd@example.com');
    expect(attendeeD).toMatchObject({
      status: 'going',
      attendanceState: 'confirmed',
      waitlistPosition: null,
    });
  });
});
