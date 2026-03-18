import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Invite links integration', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.PUBLIC_INVITE_BASE_URL = 'http://localhost:3000/api/v1/invite-links';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = new PrismaClient();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.eventAttendee.deleteMany();
    await prisma.inviteLink.deleteMany();
    await prisma.event.deleteMany();
    await prisma.authIdentity.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates then reuses active invite link, and resolves publicly', async () => {
    await prisma.user.create({ data: { id: 'owner-user', displayName: 'Owner' } });
    await prisma.user.create({ data: { id: 'other-user', displayName: 'Other' } });

    const event = await prisma.event.create({
      data: {
        id: 'event-1',
        organizerUserId: 'owner-user',
        title: 'Friday Board Games',
        description: 'Bring drinks if you want',
        locationAddress: 'Prospekt Mira 10',
        startsAt: new Date('2026-03-20T16:30:00.000Z'),
        timezone: 'Europe/Moscow',
        capacityLimit: 8,
      },
    });

    const first = await request(app.getHttpServer())
      .post(`/api/v1/events/${event.id}/invite-link`)
      .set('x-dev-user-id', 'owner-user')
      .expect(201);

    expect(first.body.eventId).toBe(event.id);
    expect(first.body.token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(first.body.url).toBe(`http://localhost:3000/api/v1/invite-links/${first.body.token}`);
    expect(first.body.isActive).toBe(true);
    expect(first.body.expiresAt).toBeNull();
    expect(first.body.createdAt).toEqual(expect.any(String));

    const second = await request(app.getHttpServer())
      .post(`/api/v1/events/${event.id}/invite-link`)
      .set('x-dev-user-id', 'owner-user')
      .expect(200);

    expect(second.body.token).toBe(first.body.token);

    const activeLinks = await prisma.inviteLink.findMany({
      where: { eventId: event.id, isActive: true },
    });

    expect(activeLinks).toHaveLength(1);

    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/invite-links/${first.body.token}`)
      .expect(200);

    expect(publicResponse.body).toEqual({
      token: first.body.token,
      url: `http://localhost:3000/api/v1/invite-links/${first.body.token}`,
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

    await request(app.getHttpServer())
      .post(`/api/v1/events/${event.id}/invite-link`)
      .set('x-dev-user-id', 'missing-user')
      .expect(401);

    await request(app.getHttpServer()).post(`/api/v1/events/${event.id}/invite-link`).expect(401);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${event.id}/invite-link`)
      .set('x-dev-user-id', 'other-user')
      .expect(404);

    await request(app.getHttpServer()).get('/api/v1/invite-links/unknown').expect(404);

    await prisma.inviteLink.update({
      where: { token: first.body.token },
      data: { isActive: false },
    });

    await request(app.getHttpServer()).get(`/api/v1/invite-links/${first.body.token}`).expect(404);

    await prisma.inviteLink.update({
      where: { token: first.body.token },
      data: { isActive: true, expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    });

    await request(app.getHttpServer()).get(`/api/v1/invite-links/${first.body.token}`).expect(404);
  });
});
