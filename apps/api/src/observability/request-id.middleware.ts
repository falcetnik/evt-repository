import { Injectable, NestMiddleware } from '@nestjs/common';
import { requestContext } from './request-context';
import { resolveRequestId } from './request-id.util';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: { headers: Record<string, string | string[] | undefined>; requestId?: string }, res: { setHeader: (name: string, value: string) => void }, next: () => void) {
    const requestId = resolveRequestId(req.headers['x-request-id']);

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    requestContext.run({ requestId }, () => next());
  }
}
