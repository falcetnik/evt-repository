import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListEventsQueryDto } from '../src/events/dto/list-events.query.dto';

const validateDto = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(ListEventsQueryDto, payload, { enableImplicitConversion: true });
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
};

describe('ListEventsQueryDto', () => {
  it('defaults scope to upcoming when omitted', () => {
    const { dto, errors } = validateDto({});

    expect(errors).toHaveLength(0);
    expect(dto.scope).toBe('upcoming');
  });

  it('accepts only upcoming, past, all', () => {
    for (const scope of ['upcoming', 'past', 'all']) {
      const { errors } = validateDto({ scope });
      expect(errors).toHaveLength(0);
    }

    const { errors } = validateDto({ scope: 'abc' });
    expect(errors.some((error) => error.property === 'scope')).toBe(true);
  });
});
