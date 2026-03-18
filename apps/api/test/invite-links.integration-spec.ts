import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Invite links API integration', () => {
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

  async function createEventForOrganizer(organizerId: string) {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', organizerId)
      .send({
        title: 'Friday Board Games',
        description: 'Bring drinks if you want',
        location: 'Prospekt Mira 10',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: 8,
      })
      .expect(201);

    return response.body.id as string;
  }

  it('organizer creates invite link then reuses active link', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    const firstResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(201);

    expect(firstResponse.body).toMatchObject({
      eventId,
      isActive: true,
      expiresAt: null,
      url: `http://localhost:3000/api/v1/invite-links/${firstResponse.body.token}`,
    });

    expect(firstResponse.body.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(firstResponse.body.token.length).toBeGreaterThanOrEqual(32);

    const secondResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(secondResponse.body.token).toBe(firstResponse.body.token);
    expect(secondResponse.body.url).toBe(firstResponse.body.url);

    const countResult = await client?.query(
      'SELECT COUNT(*)::int AS count FROM "invite_links" WHERE "event_id" = $1 AND "is_active" = true AND ("expires_at" IS NULL OR "expires_at" > NOW())',
      [eventId],
    );

    expect(countResult?.rows[0]?.count).toBe(1);
  });

  it('returns 401 when x-dev-user-id is missing on organizer endpoint', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer()).post(`/api/v1/events/${eventId}/invite-link`).expect(401);
  });

  it('returns 401 for unknown x-dev-user-id on organizer endpoint', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'missing-user')
      .expect(401);
  });

  it('returns 404 when different organizer requests invite link', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-2')
      .expect(404);
  });

  it('resolves public invite link for active token', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    const createInviteResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(201);

    const token = createInviteResponse.body.token as string;

    const resolveResponse = await request(app!.getHttpServer()).get(`/api/v1/invite-links/${token}`).expect(200);

    expect(resolveResponse.body).toEqual({
      token,
      url: `http://localhost:3000/api/v1/invite-links/${token}`,
      expiresAt: null,
      event: {
        title: 'Friday Board Games',
        description: 'Bring drinks if you want',
        location: 'Prospekt Mira 10',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: 8,
        allowPlusOnes: false,
      },
    });
  });

  it('returns 404 for unknown public invite token', async () => {
    await request(app!.getHttpServer()).get('/api/v1/invite-links/unknown-token').expect(404);
  });

  it('returns 404 for inactive public invite token', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      'INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at") VALUES ($1, $2, $3, false, NULL, NOW())',
      ['invite-inactive', eventId, 'inactive-token'],
    );

    await request(app!.getHttpServer()).get('/api/v1/invite-links/inactive-token').expect(404);
  });

  it('returns 404 for expired public invite token', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      `INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at") VALUES ($1, $2, $3, true, NOW() - INTERVAL '1 minute', NOW())`,
      ['invite-expired', eventId, 'expired-token'],
    );

    await request(app!.getHttpServer()).get('/api/v1/invite-links/expired-token').expect(404);
  });
});
