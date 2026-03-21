import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of completed HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  private readonly httpRequestDurationMs = new Histogram({
    name: 'http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
    registers: [this.registry],
  });

  recordHttpRequest(params: { method: string; route: string; statusCode: number; durationMs: number }) {
    const labels = {
      method: params.method,
      route: params.route,
    };

    this.httpRequestsTotal.inc({ ...labels, status_code: String(params.statusCode) }, 1);
    this.httpRequestDurationMs.observe(labels, params.durationMs);
  }

  getContentType() {
    return this.registry.contentType;
  }

  async getMetricsText() {
    return this.registry.metrics();
  }
}
