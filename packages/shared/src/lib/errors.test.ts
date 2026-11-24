import { errorMessage } from './errors';

describe('errorMessage', () => {
  const fallback = 'Failed to save.';

  it('shows our own database reason', () => {
    expect(errorMessage({ code: 'P0001', message: 'Bill is already voided' }, fallback)).toBe(
      'Bill is already voided',
    );
  });

  it('explains a duplicate without the constraint name', () => {
    expect(
      errorMessage({ code: '23505', message: 'duplicate key value violates "x_idx"' }, fallback),
    ).toBe('Failed to save. An entry with the same details already exists.');
  });

  it('hides other technical database errors', () => {
    expect(errorMessage({ code: '42501', message: 'permission denied for table x' }, fallback)).toBe(
      fallback,
    );
    expect(errorMessage(null, fallback)).toBe(fallback);
  });

  it('keeps an Error message', () => {
    expect(errorMessage(new Error('No response from server'), fallback)).toBe(
      'No response from server',
    );
  });
});
