import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateEventDto } from '../src/events/dto/update-event.dto';

const validateDto = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(UpdateEventDto, payload, { enableImplicitConversion: true });
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
};

describe('UpdateEventDto', () => {
  it('accepts a valid partial title update', () => {
    const { dto, errors } = validateDto({
      title: '  Updated Event Title  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Updated Event Title');
  });

  it('accepts optional allowPlusOnes', () => {
    const { dto, errors } = validateDto({ allowPlusOnes: true });

    expect(errors).toHaveLength(0);
    expect(dto.allowPlusOnes).toBe(true);
  });

  it('normalizes blank description to null', () => {
    const { dto, errors } = validateDto({ description: '   ' });

    expect(errors).toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it('normalizes blank location to null', () => {
    const { dto, errors } = validateDto({ location: '   ' });

    expect(errors).toHaveLength(0);
    expect(dto.location).toBeNull();
  });

  it('accepts capacityLimit as null', () => {
    const { dto, errors } = validateDto({ capacityLimit: null });

    expect(errors).toHaveLength(0);
    expect(dto.capacityLimit).toBeNull();
  });

  it.each([{ capacityLimit: 0 }, { capacityLimit: -1 }, { capacityLimit: 1.5 }, { capacityLimit: '2.2' }])(
    'rejects invalid capacityLimit %#',
    (payload) => {
      const { errors } = validateDto(payload as Record<string, unknown>);

      expect(errors.some((error) => error.property === 'capacityLimit')).toBe(true);
    },
  );

  it('rejects invalid timezone', () => {
    const { errors } = validateDto({ timezone: 'Mars/Olympus' });

    expect(errors.some((error) => error.property === 'timezone')).toBe(true);
  });

  it('rejects invalid startsAt', () => {
    const { errors } = validateDto({ startsAt: 'not-an-iso-date' });

    expect(errors.some((error) => error.property === 'startsAt')).toBe(true);
  });

  it('rejects unknown fields', () => {
    const { errors } = validateDto({ unexpected: 'value' });

    expect(errors.some((error) => error.property === 'unexpected')).toBe(true);
  });

});
