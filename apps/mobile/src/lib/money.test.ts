import { formatPaiseAsRupees, parseRupeesToPaise } from './money';

describe('formatPaiseAsRupees', () => {
  it('formats whole rupees', () => {
    expect(formatPaiseAsRupees(5500)).toBe('₹55.00');
  });

  it('formats paise correctly', () => {
    expect(formatPaiseAsRupees(5550)).toBe('₹55.50');
  });

  it('formats zero', () => {
    expect(formatPaiseAsRupees(0)).toBe('₹0.00');
  });
});

describe('parseRupeesToPaise', () => {
  it('parses a whole rupee amount', () => {
    expect(parseRupeesToPaise('55')).toBe(5500);
  });

  it('parses a two-decimal rupee amount', () => {
    expect(parseRupeesToPaise('55.50')).toBe(5550);
  });

  it('parses a one-decimal rupee amount', () => {
    expect(parseRupeesToPaise('55.5')).toBe(5550);
  });

  it('rejects more than two decimal places', () => {
    expect(parseRupeesToPaise('55.555')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parseRupeesToPaise('abc')).toBeNull();
  });

  it('rejects a negative amount', () => {
    expect(parseRupeesToPaise('-5')).toBeNull();
  });

  it('round-trips through paise and back', () => {
    const paise = parseRupeesToPaise('99.99');
    expect(paise).toBe(9999);
    expect(formatPaiseAsRupees(paise!)).toBe('₹99.99');
  });
});
