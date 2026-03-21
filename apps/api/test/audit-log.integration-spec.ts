import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

type AuditRow = {
  action: string;
  actor_user_id: string;
  entity_type: string;
  entity_id: string;
  request_id: string;
  metadata_json: Record<string, unknown>;
};

describe('Audit log integration', () => {
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (client) {
      await client.end();
    }
  });

  async function createEvent() {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', 'req-create-event')
      .send({
        title: 'Audit Task Event',
        description: 'some description',
        location: 'HQ',
        startsAt: '2028-01-01T10:00:00.000Z',
        timezone: 'UTC',
        capacityLimit: 10,
      })
      .expect(201);

    return response.body.id as string;
  }

  it('writes audit rows for organizer actions and excludes sensitive invite values', async () => {
    const eventId = await createEvent();

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', 'req-update-event')
      .send({
        title: 'Updated title',
        capacityLimit: 15,
      })
      .expect(200);

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', 'req-replace-reminders')
      .send({ offsetsMinutes: [120, 30] })
      .expect(200);

    const inviteResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', 'req-invite-upsert')
      .expect(201);

    await request(app!.getHttpServer())
      .delete(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', 'req-invite-revoke')
      .expect(204);

    const result = await client!.query<AuditRow>(
      'SELECT action, actor_user_id, entity_type, entity_id, request_id, metadata_json FROM "audit_logs" ORDER BY "created_at" ASC',
    );

    expect(result.rows.map((row) => row.action)).toEqual([
      'event.created',
      'event.updated',
      'event.reminders.replaced',
      'event.invite_link.upserted',
      'event.invite_link.revoked',
    ]);

    for (const row of result.rows) {
      expect(row.actor_user_id).toBe('organizer-1');
      expect(row.entity_type).toBe('event');
      expect(row.entity_id).toBe(eventId);
      expect(row.request_id).toEqual(expect.any(String));

      const json = JSON.stringify(row.metadata_json);
      expect(json).not.toContain('token');
      expect(json).not.toContain('url');
      expect(json).not.toContain(inviteResponse.body.token);
      expect(json).not.toContain(inviteResponse.body.url);
    }
  });
});
