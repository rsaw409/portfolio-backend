import { ErrorMessage } from '../../@rsaw409/constant.js';

// Matches the varchar(255) column the key is stored in, so an oversized key
// fails with a clear message instead of a raw Postgres error.
const MAX_KEY_LENGTH = 255;

/**
 * Validates and normalises one `idempotency_key`. A blank key becomes
 * undefined so it is stored as NULL rather than reaching the unique index as
 * an empty string, where it would collide with every other blank key.
 */
const validateIdempotencyKey = (key?: string): string | undefined => {
  const trimmed = key?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_KEY_LENGTH) {
    throw new Error(ErrorMessage.IdempotencyKeyTooLong);
  }
  return trimmed;
};

/** Returns the payload with its key validated and normalised. */
const validateIdempotentPayload = <T extends { idempotency_key?: string }>(
  payload: T
): T => {
  return {
    ...payload,
    idempotency_key: validateIdempotencyKey(payload.idempotency_key),
  };
};

/**
 * Same, for a batch, plus the two rules that only make sense across a whole
 * batch: it must be keyed throughout or not at all, and a key may not repeat.
 *
 * Half-keying is rejected rather than downgraded, because replaying the keyed
 * payments while rewriting the rest would duplicate money. A repeated key
 * would collide with its own batch on the unique index.
 */
const validateIdempotentBatch = <T extends { idempotency_key?: string }>(
  payloads: Array<T>
): Array<T> => {
  const validated = payloads.map(validateIdempotentPayload);

  const keys = validated
    .map((payload) => payload.idempotency_key)
    .filter((key): key is string => !!key);
  if (keys.length === 0) return validated;

  if (keys.length !== validated.length) {
    throw new Error(ErrorMessage.IdempotencyKeyMissingInBatch);
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error(ErrorMessage.IdempotencyKeyRepeated);
  }
  return validated;
};

export {
  validateIdempotencyKey,
  validateIdempotentPayload,
  validateIdempotentBatch,
  MAX_KEY_LENGTH,
};
