import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { requestContext } from './request-context';
import { resolveRequestId } from './request-id.util';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = resolveRequestId(req.headers['x-request-id']);

    req.requestId = requestId;
    req.observabilityStartedAt = process.hrtime.bigint();
    req.observabilityRecorded = false;

    res.setHeader('x-request-id', requestId);

    res.once('finish', () => {
      if (req.observabilityRecorded) {
        return;
      }

      if (res.statusCode < 400) {
        return;
      }

      const startedAt = req.observabilityStartedAt ?? process.hrtime.bigint();
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      this.metricsService.recordHttpRequest({
        method: req.method,
        route: req.path,
        statusCode: res.statusCode,
        durationMs,
      });

      console.error(
        JSON.stringify({
          type: 'http_error',
          requestId: req.requestId ?? null,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          errorName: 'HttpException',
          message: 'Request failed before controller execution',
        }),
      );

      req.observabilityRecorded = true;
    });

    requestContext.run({ requestId }, () => next());
  }
}