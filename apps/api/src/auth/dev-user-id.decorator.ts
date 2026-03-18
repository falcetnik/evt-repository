import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type RequestWithDevUser = Request & {
  devUserId?: string;
};

export const DevUserId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithDevUser>();
  return request.devUserId;
});
