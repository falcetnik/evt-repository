export type AppEnv = {
  NODE_ENV: string;
  APP_ENV: string;
  API_HOST: string;
  API_PORT: number;
  APP_DISPLAY_NAME: string;
  DATABASE_URL: string;
};

const requiredKeys: Array<keyof Omit<AppEnv, 'API_PORT'>> = [
  'NODE_ENV',
  'APP_ENV',
  'API_HOST',
  'APP_DISPLAY_NAME',
  'DATABASE_URL',
];

export function validateEnv(config: Record<string, unknown>): AppEnv {
  for (const key of requiredKeys) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${key} must be a non-empty string`);
    }
  }

  const rawPort = config.API_PORT;
  const port = typeof rawPort === 'number' ? rawPort : Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('API_PORT must be a positive integer');
  }

  const databaseUrl = String(config.DATABASE_URL);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }

  if (!['postgresql:', 'postgres:'].includes(parsedUrl.protocol)) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol');
  }

  return {
    NODE_ENV: String(config.NODE_ENV),
    APP_ENV: String(config.APP_ENV),
    API_HOST: String(config.API_HOST),
    API_PORT: port,
    APP_DISPLAY_NAME: String(config.APP_DISPLAY_NAME),
    DATABASE_URL: databaseUrl,
  };
}
