import { describe, test, expect } from 'vitest';

const {
  parse,
  createGroupSchema,
  createUserSchema,
  groupSchema,
  saveTransactionSchema,
  savePaymentSchema,
  savePaymentsSchema,
  getAllTransactionInGroupSchema,
  MAX_KEY_LENGTH,
} = await import('../../../../src/split-backend/utils/validator.js');
const { ErrorMessage } = await import('../../../../src/@rsaw409/constant.js');

const payment = (extra: Record<string, unknown> = {}) => {
  return { from: 1, to: 2, amount: 50, ...extra };
};

const expense = (extra: Record<string, unknown> = {}) => {
  return {
    by: 1,
    title: 'Dinner',
    totalAmount: 100,
    transactionParts: [{ user_id: 2, amount: 100 }],
    ...extra,
  };
};

describe('TEST payments filter', () => {
  test('omitted and null both mean no filter', () => {
    expect(
      parse(getAllTransactionInGroupSchema, { group_id: 1 }).payments
    ).toBeUndefined();
    expect(
      parse(getAllTransactionInGroupSchema, { group_id: 1, payments: null })
        .payments
    ).toBeUndefined();
    expect(
      parse(getAllTransactionInGroupSchema, { group_id: 1, payments: 'null' })
        .payments
    ).toBeUndefined();
  });

  test('accepts real booleans', () => {
    expect(
      parse(getAllTransactionInGroupSchema, { group_id: 1, payments: true })
        .payments
    ).toBe(true);
    expect(
      parse(getAllTransactionInGroupSchema, { group_id: 1, payments: false })
        .payments
    ).toBe(false);
  });

  test('still accepts the string forms older clients send', () => {
    expect(
      parse(getAllTransactionInGroupSchema, { group_id: 1, payments: 'true' })
        .payments
    ).toBe(true);
    // Previously truthy, so 'false' wrongly selected payments.
    expect(
      parse(getAllTransactionInGroupSchema, { group_id: 1, payments: 'false' })
        .payments
    ).toBe(false);
  });

  test('rejects a value that is neither boolean nor a known string', () => {
    expect(() =>
      parse(getAllTransactionInGroupSchema, { group_id: 1, payments: 'maybe' })
    ).toThrow(/payments/);
  });

  test('normalises by and user_id, dropping null and "null"', () => {
    const parsed = parse(getAllTransactionInGroupSchema, {
      group_id: '7',
      by: '2',
      user_id: 'null',
    });
    expect(parsed).toEqual({ group_id: 7, by: 2 });
  });
});

describe('TEST idempotency_key validation', () => {
  test('trims the key', () => {
    expect(
      parse(savePaymentSchema, payment({ idempotency_key: '  abc  ' }))
        .idempotency_key
    ).toEqual('abc');
  });

  test('treats blank and null as no key', () => {
    expect(
      parse(savePaymentSchema, payment({ idempotency_key: '   ' }))
        .idempotency_key
    ).toBeUndefined();
    expect(
      parse(savePaymentSchema, payment({ idempotency_key: null }))
        .idempotency_key
    ).toBeUndefined();
    expect(parse(savePaymentSchema, payment()).idempotency_key).toBeUndefined();
  });

  test('rejects a key longer than the column allows', () => {
    expect(() =>
      parse(
        savePaymentSchema,
        payment({ idempotency_key: 'x'.repeat(MAX_KEY_LENGTH + 1) })
      )
    ).toThrow(ErrorMessage.IdempotencyKeyTooLong);
  });
});

describe('TEST savePayments batch rules', () => {
  test('accepts a fully keyed batch', () => {
    const parsed = parse(savePaymentsSchema, [
      payment({ idempotency_key: 'a' }),
      payment({ idempotency_key: 'b' }),
    ]);
    expect(parsed.map((e) => e.idempotency_key)).toEqual(['a', 'b']);
  });

  test('accepts a batch with no keys at all', () => {
    const parsed = parse(savePaymentsSchema, [payment(), payment()]);
    expect(parsed.every((e) => e.idempotency_key === undefined)).toBe(true);
  });

  test('rejects a half-keyed batch', () => {
    expect(() =>
      parse(savePaymentsSchema, [payment({ idempotency_key: 'a' }), payment()])
    ).toThrow(ErrorMessage.IdempotencyKeyMissingInBatch);
  });

  test('rejects a key repeated inside one batch, after trimming', () => {
    expect(() =>
      parse(savePaymentsSchema, [
        payment({ idempotency_key: 'a' }),
        payment({ idempotency_key: ' a ' }),
      ])
    ).toThrow(ErrorMessage.IdempotencyKeyRepeated);
  });

  test('rejects an empty batch', () => {
    expect(() => parse(savePaymentsSchema, [])).toThrow();
  });
});

describe('TEST required fields', () => {
  test('names the missing field', () => {
    expect(() => parse(createGroupSchema, {})).toThrow(/name/);
    expect(() => parse(groupSchema, {})).toThrow(/group_id/);
    expect(() => parse(createUserSchema, { name: 'a' })).toThrow(/group_id/);
  });

  test('coerces numeric strings to numbers', () => {
    expect(parse(createUserSchema, { name: 'a', group_id: '3' })).toEqual({
      name: 'a',
      group_id: 3,
    });
  });

  test('rejects a transaction whose parts do not sum to the total', () => {
    expect(() =>
      parse(
        saveTransactionSchema,
        expense({ transactionParts: [{ user_id: 2, amount: 40 }] })
      )
    ).toThrow(/totalAmount/);
  });

  test('accepts a transaction whose parts sum correctly', () => {
    expect(parse(saveTransactionSchema, expense()).totalAmount).toEqual(100);
  });

  test('rejects a transaction with no parts', () => {
    expect(() =>
      parse(saveTransactionSchema, expense({ transactionParts: [] }))
    ).toThrow(/transactionParts/);
  });
});
