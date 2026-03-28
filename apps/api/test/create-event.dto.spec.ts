import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateEventDto } from '../src/events/dto/create-event.dto';

const validateDto = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(CreateEventDto, payload, { enableImplicitConversion: true });
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
};

describe('CreateEventDto', () => {
  it('accepts a valid payload', () => {
    const { dto, errors } = validateDto({
      title: '  Friday Board Games  ',
      description: 'Bring drinks if you want',
      location: 'Prospekt Mira 10',
      startsAt: '2026-03-20T16:30:00.000Z',
      timezone: 'Europe/Moscow',
      capacityLimit: 8,
      allowPlusOnes: true,
    });

    expect(errors).toHaveLength(0);
    expect(dto.allowPlusOnes).toBe(true);
  });

  it('accepts omitted allowPlusOnes field', () => {
    const { dto, errors } = validateDto({
      title: 'Friday Board Games',
      startsAt: '2026-03-20T16:30:00.000Z',
      timezone: 'UTC',
    });

    expect(errors).toHaveLength(0);
    expect(dto.allowPlusOnes).toBeUndefined();
  });

  it('normalizes blank optional strings to null', () => {
    const { dto, errors } = validateDto({
      title: 'Friday Board Games',
      description: '   ',
      location: ' ',
      startsAt: '2026-03-20T16:30:00.000Z',
      timezone: 'UTC',
    });

    expect(errors).toHaveLength(0);
    expect(dto.description).toBeNull();
    expect(dto.location).toBeNull();
  });

  it('rejects invalid timezone', () => {
    const { errors } = validateDto({
      title: 'Friday Board Games',
      startsAt: '2026-03-20T16:30:00.000Z',
      timezone: 'Mars/Olympus',
    });

    expect(errors.some((error) => error.property === 'timezone')).toBe(true);
  });

  it('rejects invalid capacityLimit', () => {
    const { errors } = validateDto({
      title: 'Friday Board Games',
      startsAt: '2026-03-20T16:30:00.000Z',
      timezone: 'UTC',
      capacityLimit: 0,
    });

    expect(errors.some((error) => error.property === 'capacityLimit')).toBe(true);
  });

  it('rejects unknown fields', () => {
    const { errors } = validateDto({
      title: 'Friday Board Games',
      startsAt: '2026-03-20T16:30:00.000Z',
      timezone: 'UTC',
      unexpected: 'field',
    });

    expect(errors.some((error) => error.property === 'unexpected')).toBe(true);
  });

});
