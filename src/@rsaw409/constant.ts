const ErrorMessage = {
  Unknown: 'An unknown error occurred',
  IdempotencyKeyTooLong: 'idempotency_key must be at most 255 characters',
  IdempotencyKeyRepeated: 'idempotency_key repeated within the same batch',
  IdempotencyKeyMissingInBatch:
    'Either every payment in the batch carries an idempotency_key, or none does',
  // Worded to follow the field path the split validator prefixes them with,
  // e.g. 'name: must not be blank'.
  Required: 'is required',
  NotText: 'must be text',
  Blank: 'must not be blank',
  NotAList: 'must be a list of names',
  CurrencyUnsupported: 'only INR is supported for now',
  MemberRepeated: 'must not repeat a name',
};

export { ErrorMessage };
