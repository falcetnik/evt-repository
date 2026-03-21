import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

jest.setTimeout(15000);

describe('Events list API integration', () => {
  let app: INestApplication | null = null;
  let client: Client | null = null;

  beforeAll(async () => {
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

    await client?.query(
      'INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW()), ($3, $4, NOW())',
      ['organizer-1', 'Organizer One', 'organizer-2', 'Organizer Two'],
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (client) {
      await client.end();
    }
  });

  async function seedListFixtures() {
    await client?.query(
      `INSERT INTO "events" (
          "id",
          "organizer_user_id",
          "title",
          "description",
          "starts_at",
          "timezone",
          "location_name",
          "capacity_limit",
          "updated_at"
      )
        VALUES
         ('evt-up-1', 'organizer-1', 'Upcoming One', 'desc one', '2099-01-01T10:00:00.000Z', 'UTC', 'Loc 1', 2, NOW()),
         ('evt-up-2', 'organizer-1', 'Upcoming Two', NULL, '2099-01-01T10:00:00.000Z', 'UTC', NULL, NULL, NOW()),
         ('evt-up-3', 'organizer-1', 'Upcoming Three', 'desc three', '2099-01-02T10:00:00.000Z', 'UTC', 'Loc 3', 5, NOW()),
         ('evt-past-1', 'organizer-1', 'Past One', NULL, '2000-01-01T08:00:00.000Z', 'UTC', 'Past 1', 4, NOW()),
         ('evt-past-2', 'organizer-1', 'Past Two', NULL, '2000-01-01T08:00:00.000Z', 'UTC', 'Past 2', 4, NOW()),
         ('evt-other-up', 'organizer-2', 'Other Organizer Upcoming', NULL, '2099-01-01T10:00:00.000Z', 'UTC', NULL, NULL, NOW())`,
    );

    await client?.query(
      `INSERT INTO "event_attendees" (
          "id",
          "event_id",
          "guest_name",
          "guest_email",
          "response_status",
          "waitlist_position",
          "updated_at"
        )
        VALUES
         ('att-1', 'evt-up-1', 'Alice', 'alice@example.com', 'GOING', NULL, NOW()),
         ('att-2', 'evt-up-1', 'Bob', 'bob@example.com', 'GOING', 1, NOW()),
         ('att-3', 'evt-up-1', 'Cora', 'cora@example.com', 'MAYBE', NULL, NOW()),
         ('att-4', 'evt-up-1', 'Dan', 'dan@example.com', 'NOT_GOING', NULL, NOW())`,
    );

    await client?.query(
      `INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at")
       VALUES
         ('inv-1', 'evt-up-1', 'token-1', true, '2099-02-01T00:00:00.000Z'),
         ('inv-2', 'evt-up-2', 'token-2', false, '2099-02-01T00:00:00.000Z'),
         ('inv-3', 'evt-up-3', 'token-3', true, '2001-01-01T00:00:00.000Z')`,
    );

    await client?.query(
      `INSERT INTO "event_reminders" (
          "id",
          "event_id",
          "offset_minutes",
          "send_at",
          "updated_at"
        )
       VALUES
         ('rem-1', 'evt-up-1', 60, '2098-12-31T23:00:00.000Z', NOW()),
         ('rem-2', 'evt-up-1', 30, '2099-01-01T09:30:00.000Z', NOW()),
         ('rem-3', 'evt-past-1', 60, '1999-12-31T07:00:00.000Z', NOW())`,
    );
  }

  it('returns only organizer upcoming events by default with deterministic ordering and card fields', async () => {
    await seedListFixtures();

    const response = await request(app!.getHttpServer())
      .get('/api/v1/events')
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body.scope).toBe('upcoming');
    expect(response.body.total).toBe(3);
    expect(response.body.events.map((event: { id: string }) => event.id)).toEqual(['evt-up-1', 'evt-up-2', 'evt-up-3']);

    const firstEvent = response.body.events[0];
    expect(firstEvent).toMatchObject({
      id: 'evt-up-1',
      title: 'Upcoming One',
      description: 'desc one',
      location: 'Loc 1',
      startsAt: '2099-01-01T10:00:00.000Z',
      timezone: 'UTC',
      capacityLimit: 2,
      hasActiveInviteLink: true,
      activeReminderCount: 2,
      summary: {
        going: 2,
        maybe: 1,
        notGoing: 1,
        total: 4,
        confirmedGoing: 1,
        waitlistedGoing: 1,
        capacityLimit: 2,
        remainingSpots: 1,
        isFull: false,
      },
    });
    expect(firstEvent.createdAt).toEqual(expect.any(String));
    expect(firstEvent.updatedAt).toEqual(expect.any(String));

    expect(response.body.events[1].hasActiveInviteLink).toBe(false);
    expect(response.body.events[2].hasActiveInviteLink).toBe(false);
    expect(response.body.events.every((event: { id: string }) => event.id !== 'evt-other-up')).toBe(true);
    expect(response.body.events.every((event: { id: string }) => !event.id.startsWith('evt-past-'))).toBe(true);
  });

  it('returns past scope with startsAt desc and id desc tie-break ordering', async () => {
    await seedListFixtures();

    const response = await request(app!.getHttpServer())
      .get('/api/v1/events?scope=past')
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body.scope).toBe('past');
    expect(response.body.total).toBe(2);
    expect(response.body.events.map((event: { id: string }) => event.id)).toEqual(['evt-past-2', 'evt-past-1']);
    expect(response.body.events[1].activeReminderCount).toBe(1);
  });

  it('returns all scope with organizer-owned events only', async () => {
    await seedListFixtures();

    const response = await request(app!.getHttpServer())
      .get('/api/v1/events?scope=all')
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body.scope).toBe('all');
    expect(response.body.total).toBe(5);
    expect(response.body.events.map((event: { id: string }) => event.id)).toEqual([
      'evt-past-1',
      'evt-past-2',
      'evt-up-1',
      'evt-up-2',
      'evt-up-3',
    ]);
    expect(response.body.events.every((event: { id: string }) => event.id !== 'evt-other-up')).toBe(true);
  });

  it('returns 401 for missing or unknown organizer header', async () => {
    await request(app!.getHttpServer()).get('/api/v1/events').expect(401);

    await request(app!.getHttpServer())
      .get('/api/v1/events')
      .set('x-dev-user-id', 'unknown-user')
      .expect(401);
  });

  it('returns 400 for invalid scope', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/events?scope=invalid')
      .set('x-dev-user-id', 'organizer-1')
      .expect(400);
  });
});