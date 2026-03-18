import { validateEnv } from '../src/config/env.validation';

describe('validateEnv', () => {
  it('accepts valid env input', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      APP_ENV: 'development',
      API_HOST: '0.0.0.0',
      API_PORT: '3000',
      APP_DISPLAY_NAME: 'Event App',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/event_app?schema=public',
      PUBLIC_INVITE_BASE_URL: 'http://localhost:3000/api/v1/invite-links/',
    });

    expect(env.API_PORT).toBe(3000);
    expect(env.APP_DISPLAY_NAME).toBe('Event App');
    expect(env.PUBLIC_INVITE_BASE_URL).toBe('http://localhost:3000/api/v1/invite-links');
  });

  it('rejects invalid env input', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        API_HOST: '0.0.0.0',
        API_PORT: 'not-a-number',
        APP_DISPLAY_NAME: 'Event App',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/event_app?schema=public',
        PUBLIC_INVITE_BASE_URL: 'http://localhost:3000/api/v1/invite-links',
      }),
    ).toThrow(/API_PORT/);
  });

  it('rejects non-absolute PUBLIC_INVITE_BASE_URL', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        API_HOST: '0.0.0.0',
        API_PORT: '3000',
        APP_DISPLAY_NAME: 'Event App',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/event_app?schema=public',
        PUBLIC_INVITE_BASE_URL: '/api/v1/invite-links',
      }),
    ).toThrow(/PUBLIC_INVITE_BASE_URL/);
  });
});
