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

  async function createEvent(capacityLimit: number) {
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
        capacityLimit,
      })
      .expect(201);

    return response.body.id as string;
  }

  async function createInviteLink(eventId: string, requestId: string) {
    const inviteResponse = await request(app!.getHttpServer())
      .post(`/api/v1/events/${eventId}/invite-link`)
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', requestId)
      .expect(201);

    return inviteResponse.body.token as string;
  }

  async function rsvp(token: string, guestName: string, guestEmail: string, status: 'going' | 'maybe' | 'not_going', requestId: string) {
    return request(app!.getHttpServer())
      .post(`/api/v1/invite-links/${token}/rsvp`)
      .set('x-request-id', requestId)
      .send({ guestName, guestEmail, status });
  }

  function assertMetadataIsSafe(metadata: Record<string, unknown>) {
    const json = JSON.stringify(metadata);
    expect(json).not.toContain('token');
    expect(json).not.toContain('url');
    expect(json).not.toContain('guestName');
    expect(json).not.toContain('guestEmail');
    expect(json).not.toContain('example.com');
    expect(json).not.toContain('Guest');
  }

  it('writes audit rows for organizer actions and excludes sensitive invite values', async () => {
    const eventId = await createEvent(10);

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

    await request(app!.getHttpServer())
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
      assertMetadataIsSafe(row.metadata_json);
    }
  });

  it('writes RSVP and attendance rebalance audit rows with privacy-safe metadata', async () => {
    const firstEventId = await createEvent(1);
    const firstToken = await createInviteLink(firstEventId, 'req-invite-upsert-first');

    const created = await rsvp(firstToken, 'Guest A', 'a@example.com', 'going', 'req-rsvp-create');
    expect(created.status).toBe(201);

    expect((await rsvp(firstToken, 'Guest B', 'b@example.com', 'going', 'req-rsvp-create-second')).status).toBe(201);
    expect((await rsvp(firstToken, 'Guest A Updated', 'a@example.com', 'maybe', 'req-rsvp-update')).status).toBe(200);

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${firstEventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', 'req-capacity-increase')
      .send({ capacityLimit: 2 })
      .expect(200);

    const secondEventId = await createEvent(1);
    const secondToken = await createInviteLink(secondEventId, 'req-invite-upsert-second');
    expect((await rsvp(secondToken, 'Guest C', 'c@example.com', 'going', 'req-rsvp-second-event-first')).status).toBe(201);
    expect((await rsvp(secondToken, 'Guest D', 'd@example.com', 'going', 'req-rsvp-second-event-second')).status).toBe(201);

    await request(app!.getHttpServer())
      .patch(`/api/v1/events/${secondEventId}`)
      .set('x-dev-user-id', 'organizer-1')
      .set('x-request-id', 'req-capacity-unlimited')
      .send({ capacityLimit: null })
      .expect(200);

    const result = await client!.query<AuditRow>(
      'SELECT action, actor_user_id, entity_type, entity_id, request_id, metadata_json FROM "audit_logs" ORDER BY "created_at" ASC',
    );

    const createdRsvp = result.rows.find((row) => row.action === 'event.rsvp.created' && row.request_id === 'req-rsvp-create');
    expect(createdRsvp).toBeDefined();
    expect(createdRsvp?.actor_user_id).toBeNull();
    expect(createdRsvp?.entity_type).toBe('event');
    expect(createdRsvp?.entity_id).toBe(firstEventId);
    expect(createdRsvp?.metadata_json).toEqual(
      expect.objectContaining({
        attendeeId: created.body.attendeeId,
        status: 'going',
        attendanceState: 'confirmed',
        waitlistPosition: null,
      }),
    );
    assertMetadataIsSafe(createdRsvp!.metadata_json);

    const updatedRsvpRow = result.rows.find((row) => row.action === 'event.rsvp.updated' && row.request_id === 'req-rsvp-update');
    expect(updatedRsvpRow).toBeDefined();
    expect(updatedRsvpRow?.actor_user_id).toBeNull();
    expect(updatedRsvpRow?.entity_id).toBe(firstEventId);
    expect(updatedRsvpRow?.metadata_json).toEqual(
      expect.objectContaining({
        attendeeId: created.body.attendeeId,
        status: 'maybe',
        attendanceState: 'maybe',
        waitlistPosition: null,
      }),
    );
    assertMetadataIsSafe(updatedRsvpRow!.metadata_json);

    const rebalanceRows = result.rows.filter((row) => row.action === 'event.attendance.rebalanced');
    expect(rebalanceRows).toHaveLength(2);

    const increaseRebalance = rebalanceRows.find((row) => row.request_id === 'req-capacity-increase');
    expect(increaseRebalance).toBeDefined();
    expect(increaseRebalance?.actor_user_id).toBe('organizer-1');
    expect(increaseRebalance?.entity_id).toBe(firstEventId);
    expect(increaseRebalance?.metadata_json).toEqual({
      capacityBefore: 1,
      capacityAfter: 2,
      confirmedGoingBefore: 0,
      confirmedGoingAfter: 1,
      waitlistedGoingBefore: 1,
      waitlistedGoingAfter: 0,
      promotedCount: 1,
    });
    assertMetadataIsSafe(increaseRebalance!.metadata_json);

    const unlimitedRebalance = rebalanceRows.find((row) => row.request_id === 'req-capacity-unlimited');
    expect(unlimitedRebalance).toBeDefined();
    expect(unlimitedRebalance?.actor_user_id).toBe('organizer-1');
    expect(unlimitedRebalance?.entity_id).toBe(secondEventId);
    expect(unlimitedRebalance?.metadata_json).toEqual({
      capacityBefore: 1,
      capacityAfter: null,
      confirmedGoingBefore: 1,
      confirmedGoingAfter: 2,
      waitlistedGoingBefore: 1,
      waitlistedGoingAfter: 0,
      promotedCount: 1,
    });
    assertMetadataIsSafe(unlimitedRebalance!.metadata_json);
  });
});
