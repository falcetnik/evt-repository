import { Client } from 'pg';

describe('Prisma core schema integration', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await client.query(`SET search_path TO event_app_test`);
  });

  beforeEach(async () => {
    await client.query('TRUNCATE TABLE "event_attendees", "invite_links", "events", "auth_identities", "users" CASCADE');
  });

  afterAll(async () => {
    await client.end();
  });

  it('persists user, event, invite link, and attendee relations', async () => {
    const userRes = await client.query(
      'INSERT INTO "users" ("id", "display_name", "updated_at") VALUES ($1, $2, NOW()) RETURNING "id"',
      ['user_1', 'Casey Host'],
    );

    await client.query(
      'INSERT INTO "auth_identities" ("id", "user_id", "provider", "provider_subject", "provider_email", "updated_at") VALUES ($1, $2, $3::"AuthProvider", $4, $5, NOW())',
      ['auth_1', userRes.rows[0].id, 'EMAIL', 'casey@example.com', 'casey@example.com'],
    );

    const eventRes = await client.query(
      'INSERT INTO "events" ("id", "organizer_user_id", "title", "starts_at", "timezone", "updated_at") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING "id"',
      ['event_1', userRes.rows[0].id, 'Board games night', '2030-06-01T18:00:00.000Z', 'UTC'],
    );

    const inviteRes = await client.query(
      'INSERT INTO "invite_links" ("id", "event_id", "token") VALUES ($1, $2, $3) RETURNING "id"',
      ['invite_1', eventRes.rows[0].id, 'event-token-123'],
    );

    const attendeeRes = await client.query(
      'INSERT INTO "event_attendees" ("id", "event_id", "user_id", "response_status", "updated_at") VALUES ($1, $2, $3, $4::"AttendeeResponseStatus", NOW()) RETURNING "id"',
      ['attendee_1', eventRes.rows[0].id, userRes.rows[0].id, 'GOING'],
    );

    const loadedRes = await client.query(
      'SELECT e."organizer_user_id", (SELECT COUNT(*) FROM "invite_links" i WHERE i."event_id" = e."id")::int AS invite_count, (SELECT COUNT(*) FROM "event_attendees" a WHERE a."event_id" = e."id")::int AS attendee_count FROM "events" e WHERE e."id" = $1',
      [eventRes.rows[0].id],
    );

    expect(inviteRes.rows[0].id).toBe('invite_1');
    expect(attendeeRes.rows[0].id).toBe('attendee_1');
    expect(loadedRes.rows[0].organizer_user_id).toBe(userRes.rows[0].id);
    expect(loadedRes.rows[0].invite_count).toBe(1);
    expect(loadedRes.rows[0].attendee_count).toBe(1);
  });

  it('rejects duplicate invite tokens', async () => {
    await client.query('INSERT INTO "users" ("id", "updated_at") VALUES ($1, NOW())', ['user_1']);
    await client.query(
      'INSERT INTO "events" ("id", "organizer_user_id", "title", "starts_at", "timezone", "updated_at") VALUES ($1, $2, $3, $4, $5, NOW())',
      ['event_1', 'user_1', 'Duplicate token test', '2030-06-01T18:00:00.000Z', 'UTC'],
    );

    await client.query('INSERT INTO "invite_links" ("id", "event_id", "token") VALUES ($1, $2, $3)', [
      'invite_1',
      'event_1',
      'duplicate-token',
    ]);

    await expect(
      client.query('INSERT INTO "invite_links" ("id", "event_id", "token") VALUES ($1, $2, $3)', [
        'invite_2',
        'event_1',
        'duplicate-token',
      ]),
    ).rejects.toBeDefined();
  });
});
