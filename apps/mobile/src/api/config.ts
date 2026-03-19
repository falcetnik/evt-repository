export type MobileConfig = {
  apiBaseUrl: string;
  devUserId: string;
  isDevelopment: boolean;
};

export type MobileConfigResult =
  | { ok: true; value: MobileConfig }
  | { ok: false; error: string };

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, '');

export const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = trimTrailingSlash(value.trim());
  const parsed = new URL(trimmed);

  if (!parsed.protocol.startsWith('http')) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an http/https URL');
  }

  return parsed.toString().replace(/\/+$/g, '');
};

export const loadMobileConfig = (): MobileConfigResult => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const devUserId = process.env.EXPO_PUBLIC_DEV_USER_ID;

  if (!apiBaseUrl) {
    return { ok: false, error: 'Missing EXPO_PUBLIC_API_BASE_URL in apps/mobile/.env' };
  }

  if (!devUserId) {
    return { ok: false, error: 'Missing EXPO_PUBLIC_DEV_USER_ID in apps/mobile/.env' };
  }

  try {
    return {
      ok: true,
      value: {
        apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
        devUserId,
        isDevelopment: typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production',
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid EXPO_PUBLIC_API_BASE_URL value',
    };
  }
};
