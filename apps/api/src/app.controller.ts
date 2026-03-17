import { Controller, Get } from '@nestjs/common';

@Controller('v1')
export class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'api',
      version: 'v1',
      timestamp: new Date().toISOString(),
    };
  }
}
