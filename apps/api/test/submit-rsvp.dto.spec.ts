import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SubmitRsvpDto } from '../src/invite-links/dto/submit-rsvp.dto';

const validateDto = (payload: Record<string, unknown>) => {
  const dto = plainToInstance(SubmitRsvpDto, payload, { enableImplicitConversion: true });
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
};

describe('SubmitRsvpDto', () => {
  it('trims guestName and normalizes guestEmail to lowercase', () => {
    const { dto, errors } = validateDto({
      guestName: '  Nikita  ',
      guestEmail: '  NiKiTa@Example.COM ',
      status: 'going',
    });

    expect(errors).toHaveLength(0);
    expect(dto.guestName).toBe('Nikita');
    expect(dto.guestEmail).toBe('nikita@example.com');
  });

  it('accepts only allowed status values', () => {
    const validStatuses = ['going', 'maybe', 'not_going'];

    for (const status of validStatuses) {
      const { errors } = validateDto({
        guestName: 'Nikita',
        guestEmail: 'nikita@example.com',
        status,
      });

      expect(errors).toHaveLength(0);
    }

    const { errors } = validateDto({
      guestName: 'Nikita',
      guestEmail: 'nikita@example.com',
      status: 'waitlist',
    });

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('rejects invalid email', () => {
    const { errors } = validateDto({
      guestName: 'Nikita',
      guestEmail: 'not-an-email',
      status: 'going',
    });

    expect(errors.some((error) => error.property === 'guestEmail')).toBe(true);
  });

  it('rejects blank required values', () => {
    const { errors } = validateDto({
      guestName: '   ',
      guestEmail: '   ',
      status: '',
    });

    expect(errors.some((error) => error.property === 'guestName')).toBe(true);
    expect(errors.some((error) => error.property === 'guestEmail')).toBe(true);
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });
});
