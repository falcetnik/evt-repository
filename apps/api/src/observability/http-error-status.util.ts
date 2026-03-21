import { HttpException } from '@nestjs/common';

export function resolveHttpErrorStatusCode(error: unknown, responseStatusCode: number): number {
  if (error instanceof HttpException) {
    return error.getStatus();
  }

  if (responseStatusCode >= 400) {
    return responseStatusCode;
  }

  return 500;
}
