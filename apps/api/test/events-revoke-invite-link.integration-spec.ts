import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Events revoke invite link API integration', () => {
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

  async function createInviteLink(eventId: string, organizerId = 'organizer-1') {
    return request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', organizerId)
      .expect(201);
  }

  it('organizer revokes current usable link and receives 204; current invite becomes null; revoked token resolves 404', async () => {
    const eventId = await createEventForOrganizer('organizer-1');
    const createResponse = await createInviteLink(eventId);
    const token = createResponse.body.token as string;

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);

    const currentResponse = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(currentResponse.body).toEqual({
      eventId,
      inviteLink: null,
    });

    await request(app!.getHttpServer()).get(`/api/v1/invite-links/${token}`).expect(404);

    const dbState = await client?.query('SELECT "is_active" FROM "invite_links" WHERE "token" = $1', [token]);
    expect(dbState?.rows[0]?.is_active).toBe(false);
  });

  it('deleting when there is no usable link still returns 204', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);
  });

  it('deleting when only inactive link exists still returns 204', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      'INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at") VALUES ($1, $2, $3, false, NULL, NOW())',
      ['invite-inactive', eventId, 'inactive-token'],
    );

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);
  });

  it('deleting when only expired link exists still returns 204', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      `INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at") VALUES ($1, $2, $3, true, NOW() - INTERVAL '1 minute', NOW())`,
      ['invite-expired', eventId, 'expired-token'],
    );

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);
  });

  it('when multiple usable links exist, only current usable is revoked and next usable becomes current', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      `INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at")
       VALUES ($1, $2, $3, true, NOW() + INTERVAL '2 day', NOW() - INTERVAL '2 day'),
              ($4, $2, $5, true, NOW() + INTERVAL '2 day', NOW() - INTERVAL '1 day')`,
      ['invite-old-usable', eventId, 'usable-older', 'invite-new-usable', 'usable-newer'],
    );

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);

    const currentResponse = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(currentResponse.body.inviteLink).toMatchObject({
      token: 'usable-older',
      eventId,
      isActive: true,
      url: 'http://localhost:3000/api/v1/invite-links/usable-older',
    });

    const stateRows = await client?.query(
      'SELECT "token", "is_active" FROM "invite_links" WHERE "event_id" = $1 ORDER BY "created_at" ASC, "id" ASC',
      [eventId],
    );

    expect(stateRows?.rows).toEqual([
      { token: 'usable-older', is_active: true },
      { token: 'usable-newer', is_active: false },
    ]);
  });

  it('returns 401 for missing x-dev-user-id', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer()).delete(`/api/v1/events/${eventId}/invite-link`).expect(401);
  });

  it('returns 401 for unknown x-dev-user-id', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'missing-user')
      .expect(401);
  });

  it('returns 404 for event owned by someone else', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-2')
      .expect(404);
  });

  it('returns 404 for missing event', async () => {
    await request(app!.getHttpServer())
      .delete('/api/v1/events/missing-event/invite-link')
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);
  });

  it('after revoke, existing create/reuse endpoint returns usable link that is not revoked current one', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await client?.query(
      `INSERT INTO "invite_links" ("id", "event_id", "token", "is_active", "expires_at", "created_at")
       VALUES ($1, $2, $3, true, NOW() + INTERVAL '2 day', NOW() - INTERVAL '2 day'),
              ($4, $2, $5, true, NOW() + INTERVAL '2 day', NOW() - INTERVAL '1 day')`,
      ['invite-old', eventId, 'token-older', 'invite-new', 'token-newer'],
    );

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);

    const createOrReuseResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(createOrReuseResponse.body.token).toBe('token-older');
    expect(createOrReuseResponse.body.token).not.toBe('token-newer');
  });
});
