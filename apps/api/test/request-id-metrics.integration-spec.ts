import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Request ID and metrics integration', () => {
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (client) {
      await client.end();
    }
  });

  it('echoes x-request-id when provided', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'evt-23-custom-request-id')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('evt-23-custom-request-id');
  });

  it('generates x-request-id when missing', async () => {
    const response = await request(app!.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.headers['x-request-id']).not.toHaveLength(0);
  });


  it('records and logs handled HttpException statuses for 404/400/401', async () => {
    await client?.query(
      'INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW())',
      ['organizer-observability', 'Organizer Observability'],
    );

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await request(app!.getHttpServer()).get(`/api/v1/invite-links/${randomUUID()}`).expect(404);

    await request(app!.getHttpServer())
      .get('/api/v1/events?scope=invalid')
      .set('x-dev-user-id', 'organizer-observability')
      .expect(400);

    await request(app!.getHttpServer()).get('/api/v1/events').expect(401);

    const metricsResponse = await request(app!.getHttpServer()).get('/api/v1/metrics').expect(200);

    expect(metricsResponse.text).toContain('http_requests_total{method="GET",route="/api/v1/invite-links/:token",status_code="404"} 1');
    expect(metricsResponse.text).toContain('http_requests_total{method="GET",route="/api/v1/events",status_code="400"} 1');
    expect(metricsResponse.text).toContain('http_requests_total{method="GET",route="/api/v1/events",status_code="401"} 1');

    const errorEntries = errorSpy.mock.calls.map(([rawPayload]) => JSON.parse(String(rawPayload)));

    expect(errorEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'http_error', statusCode: 404, path: expect.stringContaining('/api/v1/invite-links/') }),
        expect.objectContaining({ type: 'http_error', statusCode: 400, path: '/api/v1/events' }),
        expect.objectContaining({ type: 'http_error', statusCode: 401, path: '/api/v1/events' }),
      ]),
    );

    errorSpy.mockRestore();
  });

  it('returns Prometheus text from /api/v1/metrics and includes HTTP metric names after requests', async () => {
    await request(app!.getHttpServer()).get('/api/v1/health').expect(200);

    const response = await request(app!.getHttpServer()).get('/api/v1/metrics').expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('http_request_duration_ms');
  });
});
