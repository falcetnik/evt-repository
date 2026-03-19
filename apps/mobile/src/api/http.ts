export type ApiRequestOptions = {
  path: string;
  query?: Record<string, string | undefined>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export type ApiClientErrorKind = 'network' | 'http' | 'decode';

export class ApiClientError extends Error {
  constructor(
    public readonly kind: ApiClientErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

const buildUrl = (baseUrl: string, path: string, query?: Record<string, string | undefined>) => {
  const url = new URL(path.replace(/^\/+/, ''), `${baseUrl}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
};

export const requestJson = async <TResponse>(baseUrl: string, options: ApiRequestOptions): Promise<TResponse> => {
  const method = options.method ?? 'GET';
  const url = buildUrl(baseUrl, options.path, options.query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    throw new ApiClientError(
      'network',
      error instanceof Error ? error.message : 'Network request failed unexpectedly',
    );
  }

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    throw new ApiClientError('http', `Request failed with ${response.status} ${statusText}`, response.status);
  }

  try {
    return (await response.json()) as TResponse;
  } catch {
    throw new ApiClientError('decode', 'Response was not valid JSON');
  }
};
