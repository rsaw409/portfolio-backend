import { describe, test, expect } from 'vitest';

const { formatAmount } =
  await import('../../../../src/split-backend/utils/format_amount.js');

describe('formatAmount', () => {
  test("uses the currency's symbol and the stored decimals", () => {
    expect(formatAmount(5000, 'INR', 2)).toBe('₹50.00');
    expect(formatAmount(1234550, 'INR', 2)).toBe('₹12,345.50');
    expect(formatAmount(5000, 'USD', 2)).toBe('$50.00');
    expect(formatAmount(5000, 'JPY', 0)).toBe('¥5,000');
    // Intl separates a code from the number with a no-break space.
    expect(formatAmount(1500, 'KWD', 3)).toBe('KWD 1.500');
  });

  test("the group's decimals win over what Intl would pick", () => {
    expect(formatAmount(5000, 'JPY', 2)).toBe('¥50.00');
    expect(formatAmount(5000, 'INR', 0)).toBe('₹5,000');
  });

  test('keeps the sign of a negative amount', () => {
    expect(formatAmount(-5000, 'INR', 2)).toBe('-₹50.00');
  });

  test('falls back to the code for one Intl cannot format', () => {
    expect(formatAmount(5000, 'RUPEE', 2)).toBe('RUPEE 50.00');
    expect(formatAmount(5000, 'RUPEE', 0)).toBe('RUPEE 5000');
  });
});
