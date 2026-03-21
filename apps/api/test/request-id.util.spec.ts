import { resolveRequestId } from '../src/observability/request-id.util';

describe('resolveRequestId', () => {
  it('returns trimmed incoming request id when provided', () => {
    expect(resolveRequestId('  abc-123  ')).toBe('abc-123');
  });

  it('generates request id when missing', () => {
    const generated = resolveRequestId(undefined);
    expect(generated).toEqual(expect.any(String));
    expect(generated.length).toBeGreaterThan(0);
  });
});
