import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Events current invite link API integration', () => {
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
    await client?.query('TRUNCATE TABLE "event_attendees", "invite_links", "event_reminders", "events", "auth_identities", "users" CASCADE');
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

  it('returns 200 with inviteLink null when owned event has no invite link', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body).toEqual({
      eventId,
      inviteLink: null,
    });
  });

  it('returns current usable invite link when one exists', async () => {
    const eventId = await createEventForOrganizer('organizer-1');
    const createResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(201);

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body).toEqual({
      eventId,
      inviteLink: {
        eventId,
        token: createResponse.body.token,
        url: `http://localhost:3000/api/v1/invite-links/${createResponse.body.token}`,
        isActive: true,
        expiresAt: null,
        createdAt: createResponse.body.createdAt,
      },
    });
  });

  it('returns inviteLink null for inactive link', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      'INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at") VALUES ($1, $2, $3, false, NULL, NOW())',
      ['invite-inactive', eventId, 'inactive-token'],
    );

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body).toEqual({
      eventId,
      inviteLink: null,
    });
  });

  it('returns inviteLink null for expired link', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      `INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at") VALUES ($1, $2, $3, true, NOW() - INTERVAL '1 minute', NOW())`,
      ['invite-expired', eventId, 'expired-token'],
    );

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body).toEqual({
      eventId,
      inviteLink: null,
    });
  });

  it('returns newest usable link when multiple usable links exist', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      `INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at")
       VALUES ($1, $2, $3, true, NOW() + INTERVAL '2 day', NOW() - INTERVAL '2 day'),
              ($4, $2, $5, true, NOW() + INTERVAL '2 day', NOW() - INTERVAL '1 day')`,
      ['invite-old-usable', eventId, 'usable-older', 'invite-new-usable', 'usable-newer'],
    );

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(response.body.eventId).toBe(eventId);
    expect(response.body.inviteLink).toMatchObject({
      eventId,
      token: 'usable-newer',
      url: 'http://localhost:3000/api/v1/invite-links/usable-newer',
      isActive: true,
      expiresAt: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it('returns 401 for missing x-dev-user-id', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer()).get(`/api/v1/events/${eventId}/invite-link`).expect(401);
  });

  it('returns 401 for unknown x-dev-user-id', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'missing-user')
      .expect(401);
  });

  it('returns 404 for event owned by someone else', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-2')
      .expect(404);
  });

  it('returns 404 for missing event', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/events/missing-event/invite-link')
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);
  });
});
