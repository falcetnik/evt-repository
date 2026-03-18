import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('RSVP integration', () => {
  const prisma = new PrismaClient();
  let app: INestApplication;

  const organizerId = 'org_1';
  const nonOwnerId = 'org_2';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(async () => {
    await prisma.eventAttendee.deleteMany();
    await prisma.inviteLink.deleteMany();
    await prisma.event.deleteMany();
    await prisma.authIdentity.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.createMany({
      data: [{ id: organizerId }, { id: nonOwnerId }],
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createEventAndInvite(token: string, options?: { isActive?: boolean; expiresAt?: Date | null }) {
    const event = await prisma.event.create({
      data: {
        organizerUserId: organizerId,
        title: 'RSVP Event',
        startsAt: new Date('2030-06-01T18:00:00.000Z'),
        timezone: 'UTC',
      },
    });

    await prisma.inviteLink.create({
      data: {
        eventId: event.id,
        token,
        isActive: options?.isActive ?? true,
        expiresAt: options?.expiresAt,
      },
    });

    return event;
  }

  it('creates RSVP through public invite link and returns 201', async () => {
    const event = await createEventAndInvite('token-create');

    const response = await request(app.getHttpServer()).post('/api/v1/invite-links/token-create/rsvp').send({
      guestName: '  Nikita  ',
      guestEmail: '  NIKITA@Example.com ',
      status: 'going',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      eventId: event.id,
      guestName: 'Nikita',
      guestEmail: 'nikita@example.com',
      status: 'going',
    });

    const rows = await prisma.eventAttendee.findMany({ where: { eventId: event.id } });
    expect(rows).toHaveLength(1);
  });

  it('updates existing RSVP for same event + email without duplicates', async () => {
    const event = await createEventAndInvite('token-update');

    const first = await request(app.getHttpServer()).post('/api/v1/invite-links/token-update/rsvp').send({
      guestName: 'Nikita',
      guestEmail: 'nikita@example.com',
      status: 'going',
    });

    const second = await request(app.getHttpServer()).post('/api/v1/invite-links/token-update/rsvp').send({
      guestName: 'Nikita Updated',
      guestEmail: 'NIKITA@example.com',
      status: 'not_going',
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.attendeeId).toBe(first.body.attendeeId);
    expect(second.body.guestName).toBe('Nikita Updated');
    expect(second.body.status).toBe('not_going');

    const attendees = await prisma.eventAttendee.findMany({ where: { eventId: event.id } });
    expect(attendees).toHaveLength(1);
  });

  it('returns 404 for missing, inactive, and expired invite links', async () => {
    await createEventAndInvite('token-inactive', { isActive: false });
    await createEventAndInvite('token-expired', { expiresAt: new Date('2020-01-01T00:00:00.000Z') });

    for (const token of ['missing-token', 'token-inactive', 'token-expired']) {
      const response = await request(app.getHttpServer()).post(`/api/v1/invite-links/${token}/rsvp`).send({
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        status: 'maybe',
      });

      expect(response.status).toBe(404);
    }
  });

  it('returns organizer attendee list with summary and attendees for owner', async () => {
    const event = await createEventAndInvite('token-list');

    await request(app.getHttpServer()).post('/api/v1/invite-links/token-list/rsvp').send({
      guestName: 'A',
      guestEmail: 'a@example.com',
      status: 'going',
    });
    await request(app.getHttpServer()).post('/api/v1/invite-links/token-list/rsvp').send({
      guestName: 'B',
      guestEmail: 'b@example.com',
      status: 'maybe',
    });
    await request(app.getHttpServer()).post('/api/v1/invite-links/token-list/rsvp').send({
      guestName: 'C',
      guestEmail: 'c@example.com',
      status: 'not_going',
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/events/${event.id}/attendees`)
      .set('x-dev-user-id', organizerId);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      eventId: event.id,
      summary: {
        going: 1,
        maybe: 1,
        notGoing: 1,
        total: 3,
      },
    });
    expect(response.body.attendees).toHaveLength(3);
    expect(response.body.attendees[0].guestEmail).toBe('a@example.com');
  });

  it('returns 404 for non-owner organizer attendee list request', async () => {
    const event = await createEventAndInvite('token-owner');

    const response = await request(app.getHttpServer())
      .get(`/api/v1/events/${event.id}/attendees`)
      .set('x-dev-user-id', nonOwnerId);

    expect(response.status).toBe(404);
  });

  it('includes rsvpSummary in public invite resolution with updated counts', async () => {
    await createEventAndInvite('token-summary');

    const first = await request(app.getHttpServer()).get('/api/v1/invite-links/token-summary');
    expect(first.status).toBe(200);
    expect(first.body.rsvpSummary).toEqual({
      going: 0,
      maybe: 0,
      notGoing: 0,
      total: 0,
    });

    await request(app.getHttpServer()).post('/api/v1/invite-links/token-summary/rsvp').send({
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      status: 'going',
    });

    const second = await request(app.getHttpServer()).get('/api/v1/invite-links/token-summary');
    expect(second.status).toBe(200);
    expect(second.body.rsvpSummary).toEqual({
      going: 1,
      maybe: 0,
      notGoing: 0,
      total: 1,
    });
  });
});
