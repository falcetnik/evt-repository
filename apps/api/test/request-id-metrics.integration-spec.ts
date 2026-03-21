import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
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

  it('returns Prometheus text from /api/v1/metrics and includes HTTP metric names after requests', async () => {
    await request(app!.getHttpServer()).get('/api/v1/health').expect(200);

    const response = await request(app!.getHttpServer()).get('/api/v1/metrics').expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('http_request_duration_ms');
  });
});
