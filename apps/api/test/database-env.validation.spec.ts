import { validateEnv } from '../src/config/env.validation';

describe('validateEnv database settings', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    API_HOST: '0.0.0.0',
    API_PORT: '3000',
    APP_DISPLAY_NAME: 'Event App',
    PUBLIC_INVITE_BASE_URL: 'http://localhost:3000/api/v1/invite-links',
  };

  it('accepts a valid DATABASE_URL', () => {
    const env = validateEnv({
      ...baseEnv,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/event_app?schema=public',
    });

    expect(env.DATABASE_URL).toContain('postgresql://');
  });

  it('rejects an invalid DATABASE_URL', () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        DATABASE_URL: 'not-a-database-url',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
