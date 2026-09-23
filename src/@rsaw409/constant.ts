const ErrorMessage = {
  Unknown: 'An unknown error occurred',
  IdempotencyKeyTooLong: 'idempotency_key must be at most 255 characters',
  IdempotencyKeyRepeated: 'idempotency_key repeated within the same batch',
  IdempotencyKeyMissingInBatch:
    'Either every payment in the batch carries an idempotency_key, or none does',
};

export { ErrorMessage };
