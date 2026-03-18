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
    });

    expect(env.API_PORT).toBe(3000);
    expect(env.APP_DISPLAY_NAME).toBe('Event App');
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
      }),
    ).toThrow(/API_PORT/);
  });
});
