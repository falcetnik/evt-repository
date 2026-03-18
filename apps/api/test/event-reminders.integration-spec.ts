import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Event reminders API integration', () => {
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
    await client?.query('TRUNCATE TABLE "event_reminders", "event_attendees", "invite_links", "events", "auth_identities", "users" CASCADE');
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

  async function createEvent(owner: string, startsAt = '2026-03-25T18:00:00.000Z') {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', owner)
      .send({
        title: 'Reminder Test Event',
        startsAt,
        timezone: 'Europe/Moscow',
      })
      .expect(201);

    return response.body.id as string;
  }

  it('organizer can replace and read reminders for own event, ordered by sendAt asc', async () => {
    const eventId = await createEvent('organizer-1');

    const putResponse = await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [30, 1440, 120] })
      .expect(200);

    expect(putResponse.body.eventId).toBe(eventId);
    expect(putResponse.body.total).toBe(3);
    expect(putResponse.body.reminders.map((row: { offsetMinutes: number }) => row.offsetMinutes)).toEqual([1440, 120, 30]);

    const getResponse = await request(app!.getHttpServer())
      .get(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(getResponse.body).toMatchObject({
      eventId,
      startsAt: '2026-03-25T18:00:00.000Z',
      timezone: 'Europe/Moscow',
      total: 3,
    });
    expect(getResponse.body.reminders.map((row: { offsetMinutes: number }) => row.offsetMinutes)).toEqual([1440, 120, 30]);
  });

  it('empty offset array clears reminders', async () => {
    const eventId = await createEvent('organizer-1');

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [120] })
      .expect(200);

    const clearResponse = await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [] })
      .expect(200);

    expect(clearResponse.body.total).toBe(0);
    expect(clearResponse.body.reminders).toEqual([]);
  });

  it('returns 404 for non-owner', async () => {
    const eventId = await createEvent('organizer-1');

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-2')
      .send({ offsetsMinutes: [120] })
      .expect(404);
  });

  it('returns 401 when organizer header is missing or unknown', async () => {
    const eventId = await createEvent('organizer-1');

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .send({ offsetsMinutes: [120] })
      .expect(401);

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'unknown')
      .send({ offsetsMinutes: [120] })
      .expect(401);
  });

  it('rejects duplicate offsets with 400', async () => {
    const eventId = await createEvent('organizer-1');

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [120, 120] })
      .expect(400);
  });

  it('rejects reminders that resolve in the past with 400', async () => {
    const eventId = await createEvent('organizer-1', '2026-03-20T18:05:00.000Z');

    await request(app!.getHttpServer())
      .put(`/api/v1/events/${eventId}/reminders`)
      .set('x-dev-user-id', 'organizer-1')
      .send({ offsetsMinutes: [5] })
      .expect(400);
  });
});
