import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

type AuditRow = {
  action: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  metadata_json: Record<string, unknown>;
};

describe('Events delete API integration', () => {
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
      'TRUNCATE TABLE "event_reminders", "event_attendees", "invite_links", "events", "auth_identities", "users", "audit_logs" CASCADE',
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

  async function createEventForOrganizer(organizerId: string) {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', organizerId)
      .send({
        title: 'Delete Candidate',
        description: 'Delete me',
        location: 'HQ',
        startsAt: '2028-02-20T16:30:00.000Z',
        timezone: 'UTC',
        capacityLimit: 5,
      })
      .expect(201);

    return response.body.id as string;
  }

  it('deletes an owned event and returns 204', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);
  });

  it('deleted event is gone from organizer read APIs and list', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    const beforeDelete = await request(app!.getHttpServer())
      .get('/api/v1/events?scope=all')
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);
    expect(beforeDelete.body.events.some((event: { id: string }) => event.id === eventId)).toBe(true);

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);

    await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);

    await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/attendees`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);

    await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);

    await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);

    const afterDelete = await request(app!.getHttpServer())
      .get('/api/v1/events?scope=all')
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(afterDelete.body.events.some((event: { id: string }) => event.id === eventId)).toBe(false);
  });

  it('invalidates public invite token after delete', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    const inviteResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(201);

    const token = inviteResponse.body.token as string;

    await request(app!.getHttpServer())
      .get(`/api/v1/invite-links/${token}`)
      .expect(200);

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);

    await request(app!.getHttpServer())
      .get(`/api/v1/invite-links/${token}`)
      .expect(404);
  });

  it('returns 401 for missing organizer header', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .expect(401);
  });

  it('returns 401 for unknown organizer', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'missing-organizer')
      .expect(401);
  });

  it('returns 404 for non-owner organizer', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-2')
      .expect(404);
  });

  it('returns 404 for missing event', async () => {
    await request(app!.getHttpServer())
      .delete('/api/v1/events/missing-event')
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);
  });

  it('returns 404 for second delete call', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(404);
  });

  it('writes one event.deleted audit row with safe metadata summary', async () => {
    const eventId = await createEventForOrganizer('organizer-1');

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [120, 30] })
      .expect(200);

    const inviteResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(201);

    const token = inviteResponse.body.token as string;

    await request(app!.getHttpServer())
      .post(`/api/v1/invite-links/${token}/rsvp`)
      .send({
        guestName: 'Guest Name',
        guestEmail: 'guest@example.com',
        status: 'going',
      })
      .expect(201);

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(204);

    const auditRows = await client!.query<AuditRow>(
      `SELECT action, actor_user_id, entity_type, entity_id, metadata_json
       FROM "audit_logs"
       WHERE "action" = 'event.deleted'
       ORDER BY "created_at" ASC`,
    );

    expect(auditRows.rows).toHaveLength(1);
    const row = auditRows.rows[0]!;

    expect(row.actor_user_id).toBe('organizer-1');
    expect(row.entity_type).toBe('event');
    expect(row.entity_id).toBe(eventId);
    expect(row.metadata_json).toEqual({
      attendeeCount: 1,
      inviteLinkCount: 1,
      reminderCount: 2,
      capacityLimit: 5,
      startsAt: '2028-02-20T16:30:00.000Z',
      timezone: 'UTC',
    });

    const metadataText = JSON.stringify(row.metadata_json);
    expect(metadataText).not.toContain(token);
    expect(metadataText).not.toContain('guest@example.com');
    expect(metadataText).not.toContain('Guest Name');
    expect(metadataText).not.toContain('url');
  });
});
