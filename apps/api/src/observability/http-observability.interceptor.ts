import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      baseUrl?: string;
      route?: { path?: string };
      requestId?: string;
      currentUser?: { id: string };
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();

    const method = request.method;
    const path = request.path;
    const route = this.resolveRoute(request);

    return next.handle().pipe(
      tap(() => {
        this.logRequest({
          requestId: request.requestId ?? null,
          method,
          path,
          statusCode: response.statusCode,
          durationMs: this.durationMsSince(startedAt),
          userId: request.currentUser?.id ?? null,
        });
      }),
      catchError((error: unknown) => {
        const statusCode = response.statusCode >= 400 ? response.statusCode : 500;

        console.error(
          JSON.stringify({
            type: 'http_error',
            requestId: request.requestId ?? null,
            method,
            path,
            statusCode,
            errorName: error instanceof Error ? error.name : 'Error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        );

        return throwError(() => error);
      }),
      finalize(() => {
        this.metricsService.recordHttpRequest({
          method,
          route,
          statusCode: response.statusCode,
          durationMs: this.durationMsSince(startedAt),
        });
      }),
    );
  }

  private resolveRoute(request: { path: string; baseUrl?: string; route?: { path?: string } }) {
    const routePath = request.route?.path;
    if (!routePath) {
      return request.path;
    }

    return `${request.baseUrl ?? ''}${routePath}`;
  }

  private durationMsSince(startedAt: bigint) {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  }

  private logRequest(params: {
    requestId: string | null;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId: string | null;
  }) {
    console.log(
      JSON.stringify({
        type: 'http_request',
        requestId: params.requestId,
        method: params.method,
        path: params.path,
        statusCode: params.statusCode,
        durationMs: Number(params.durationMs.toFixed(2)),
        appEnv: process.env.APP_ENV ?? 'development',
        userId: params.userId,
      }),
    );
  }
}
