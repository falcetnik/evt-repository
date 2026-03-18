import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PublicRsvpDto } from '../src/rsvp/dto/public-rsvp.dto';

describe('PublicRsvpDto', () => {
  it('trims guestName and normalizes guestEmail to lowercase', () => {
    const dto = plainToInstance(PublicRsvpDto, {
      guestName: '  Nikita  ',
      guestEmail: '  NIkiTa@Example.COM  ',
      status: 'going',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.guestName).toBe('Nikita');
    expect(dto.guestEmail).toBe('nikita@example.com');
  });

  it('accepts all supported status values', () => {
    const statuses = ['going', 'maybe', 'not_going'];

    for (const status of statuses) {
      const dto = plainToInstance(PublicRsvpDto, {
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
        status,
      });

      expect(validateSync(dto)).toHaveLength(0);
    }
  });

  it('rejects invalid guestEmail', () => {
    const dto = plainToInstance(PublicRsvpDto, {
      guestName: 'Guest',
      guestEmail: 'not-an-email',
      status: 'going',
    });

    const errors = validateSync(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('guestEmail');
  });

  it('rejects blank required values', () => {
    const dto = plainToInstance(PublicRsvpDto, {
      guestName: '   ',
      guestEmail: '   ',
      status: '',
    });

    const errors = validateSync(dto);
    const properties = errors.map((error) => error.property).sort();

    expect(properties).toEqual(['guestEmail', 'guestName', 'status']);
  });
});
