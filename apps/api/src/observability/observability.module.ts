import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { HttpObservabilityInterceptor } from './http-observability.interceptor';
import { RequestIdMiddleware } from './request-id.middleware';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpObservabilityInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
