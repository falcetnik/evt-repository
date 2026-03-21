import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { resolveHttpErrorStatusCode } from '../src/observability/http-error-status.util';

describe('resolveHttpErrorStatusCode', () => {
  it('returns status from Nest HttpException subclasses', () => {
    expect(resolveHttpErrorStatusCode(new NotFoundException(), 200)).toBe(404);
    expect(resolveHttpErrorStatusCode(new BadRequestException(), 200)).toBe(400);
    expect(resolveHttpErrorStatusCode(new UnauthorizedException(), 200)).toBe(401);
  });

  it('falls back to existing error response status when >= 400', () => {
    expect(resolveHttpErrorStatusCode(new Error('boom'), 429)).toBe(429);
  });

  it('returns 500 for unexpected non-http errors without a valid response status', () => {
    expect(resolveHttpErrorStatusCode(new Error('boom'), 200)).toBe(500);
    expect(resolveHttpErrorStatusCode('boom', 0)).toBe(500);
  });
});
