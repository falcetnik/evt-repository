import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Events API integration', () => {
  let app: INestApplication | null = null;
  let client: Client | null = null;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await client.query(`SET search_path TO event_app_test`);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await client?.query('TRUNCATE TABLE "event_attendees", "invite_links", "events", "auth_identities", "users" CASCADE');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (client) {
      await client.end();
    }
  });

  it('creates an event with valid x-dev-user-id', async () => {
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-1',
      'Organizer One',
    ]);

    const response = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', 'organizer-1')
      .send({
        title: '  Friday Board Games  ',
        description: 'Bring drinks if you want',
        location: 'Prospekt Mira 10',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'Europe/Moscow',
        capacityLimit: 8,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      title: 'Friday Board Games',
      description: 'Bring drinks if you want',
      location: 'Prospekt Mira 10',
      startsAt: '2026-03-20T16:30:00.000Z',
      timezone: 'Europe/Moscow',
      capacityLimit: 8,
      organizerUserId: 'organizer-1',
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(response.body.updatedAt).toEqual(expect.any(String));
  });

  it('returns 401 when x-dev-user-id is missing', async () => {
    await request(app!.getHttpServer())
      .post('/api/v1/events')
      .send({
        title: 'Friday Board Games',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'UTC',
      })
      .expect(401);
  });

  it('returns 401 for unknown x-dev-user-id', async () => {
    await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', 'missing-user')
      .send({
        title: 'Friday Board Games',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'UTC',
      })
      .expect(401);
  });

  it('returns 400 on invalid payload', async () => {
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-1',
      'Organizer One',
    ]);

    await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', 'organizer-1')
      .send({
        title: 'Friday Board Games',
        startsAt: 'invalid-date',
        timezone: 'UTC',
      })
      .expect(400);
  });

  it('organizer can fetch own event by id', async () => {
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-1',
      'Organizer One',
    ]);

    const createResponse = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', 'organizer-1')
      .send({
        title: 'Friday Board Games',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'UTC',
      })
      .expect(201);

    const getResponse = await request(app!.getHttpServer())
      .get(`/api/v1/events/${createResponse.body.id}`)
      .set('x-dev-user-id', 'organizer-1')
      .expect(200);

    expect(getResponse.body.id).toBe(createResponse.body.id);
    expect(getResponse.body.organizerUserId).toBe('organizer-1');
  });

  it('returns 404 when another user fetches event', async () => {
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-1',
      'Organizer One',
    ]);
    await client?.query('INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())', [
      'organizer-2',
      'Organizer Two',
    ]);

    const createResponse = await request(app!.getHttpServer())
      .post('/api/v1/events')
      .set('x-dev-user-id', 'organizer-1')
      .send({
        title: 'Friday Board Games',
        startsAt: '2026-03-20T16:30:00.000Z',
        timezone: 'UTC',
      })
      .expect(201);

    await request(app!.getHttpServer())
      .get(`/api/v1/events/${createResponse.body.id}`)
      .set('x-dev-user-id', 'organizer-2')
      .expect(404);
  });
});
