import { describe, expect, it } from 'vitest';
import { buildEventsListRequest, parseEventsListScope, type EventListScope } from './events';

describe('events API helper', () => {
  it('builds default upcoming scope URL without query and includes dev header', () => {
    const request = buildEventsListRequest({
      baseUrl: 'http://10.0.2.2:3000/api/',
      devUserId: 'organizer-1',
      scope: 'upcoming',
    });

    expect(request.url).toBe('http://10.0.2.2:3000/api/v1/events');
    expect(request.headers).toMatchObject({
      Accept: 'application/json',
      'x-dev-user-id': 'organizer-1',
    });
  });

  it('serializes past and all scope query params', () => {
    const baseUrl = 'http://localhost:3000/api';

    expect(
      buildEventsListRequest({
        baseUrl,
        devUserId: 'organizer-1',
        scope: 'past',
      }).url,
    ).toBe('http://localhost:3000/api/v1/events?scope=past');

    expect(
      buildEventsListRequest({
        baseUrl,
        devUserId: 'organizer-1',
        scope: 'all',
      }).url,
    ).toBe('http://localhost:3000/api/v1/events?scope=all');
  });

  it('normalizes unknown scope values to upcoming', () => {
    expect(parseEventsListScope(undefined)).toBe('upcoming');
    expect(parseEventsListScope('future')).toBe('upcoming');
  });

  it('accepts known scope values', () => {
    const scopes: EventListScope[] = ['upcoming', 'past', 'all'];

    for (const scope of scopes) {
      expect(parseEventsListScope(scope)).toBe(scope);
    }
  });
});
