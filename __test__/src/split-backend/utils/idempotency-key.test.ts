import { describe, test, expect } from 'vitest';

const {
  validateIdempotencyKey,
  validateIdempotentPayload,
  validateIdempotentBatch,
  MAX_KEY_LENGTH,
} = await import('../../../../src/split-backend/utils/idempotency-key.js');
const { ErrorMessage } = await import('../../../../src/@rsaw409/constant.js');

const payment = (idempotency_key?: string) => {
  return { from: 1, to: 2, amount: 50, idempotency_key };
};

describe('TEST validateIdempotencyKey', () => {
  test('trims the key', () => {
    expect(validateIdempotencyKey('  abc  ')).toEqual('abc');
  });

  test('treats a missing or blank key as no key', () => {
    expect(validateIdempotencyKey(undefined)).toBeUndefined();
    expect(validateIdempotencyKey('')).toBeUndefined();
    expect(validateIdempotencyKey('   ')).toBeUndefined();
  });

  test('rejects a key longer than the column allows', () => {
    expect(() =>
      validateIdempotencyKey('x'.repeat(MAX_KEY_LENGTH + 1))
    ).toThrow(ErrorMessage.IdempotencyKeyTooLong);
    expect(validateIdempotencyKey('x'.repeat(MAX_KEY_LENGTH))).toHaveLength(
      MAX_KEY_LENGTH
    );
  });
});

describe('TEST validateIdempotentPayload', () => {
  test('normalises the key without touching the rest', () => {
    expect(validateIdempotentPayload(payment(' abc '))).toEqual({
      from: 1,
      to: 2,
      amount: 50,
      idempotency_key: 'abc',
    });
  });

  test('leaves an unkeyed payload unkeyed', () => {
    expect(
      validateIdempotentPayload(payment('')).idempotency_key
    ).toBeUndefined();
  });
});

describe('TEST validateIdempotentBatch', () => {
  test('normalises every key in the batch', () => {
    const batch = validateIdempotentBatch([payment(' a '), payment('b ')]);
    expect(batch.map((e) => e.idempotency_key)).toEqual(['a', 'b']);
  });

  test('accepts a batch with no keys at all', () => {
    const batch = validateIdempotentBatch([payment(), payment('  ')]);
    expect(batch.every((e) => e.idempotency_key === undefined)).toBe(true);
  });

  test('rejects a half-keyed batch', () => {
    expect(() => validateIdempotentBatch([payment('a'), payment()])).toThrow(
      ErrorMessage.IdempotencyKeyMissingInBatch
    );
    // A blank key counts as missing, not as a distinct key.
    expect(() => validateIdempotentBatch([payment('a'), payment(' ')])).toThrow(
      ErrorMessage.IdempotencyKeyMissingInBatch
    );
  });

  test('rejects a key repeated inside one batch', () => {
    expect(() => validateIdempotentBatch([payment('a'), payment('a')])).toThrow(
      ErrorMessage.IdempotencyKeyRepeated
    );
    // Repeats are caught after trimming.
    expect(() =>
      validateIdempotentBatch([payment('a'), payment(' a ')])
    ).toThrow(ErrorMessage.IdempotencyKeyRepeated);
  });

  test('rejects an oversized key anywhere in the batch', () => {
    expect(() =>
      validateIdempotentBatch([payment('a'), payment('x'.repeat(256))])
    ).toThrow(ErrorMessage.IdempotencyKeyTooLong);
  });
});
