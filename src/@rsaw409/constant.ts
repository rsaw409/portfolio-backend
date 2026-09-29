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
  CurrencyInvalid: 'must be a 3-letter ISO 4217 code, e.g. INR',
  AvatarTooLong: 'must be at most 64 characters',
  MemberRepeated: 'must not repeat a name',
  NotASubscriptionId: 'must be a OneSignal subscription id (a UUID)',
  NotAnIdList: 'must be a list of group ids',
  TooManyGroups: 'must list at most 500 groups',
  NothingToUpdate: 'send name or currency to update',
  GroupNotFound: 'No Group Found',
  CurrencyLocked:
    'currency can only be changed before the group has any expenses or payments',
  GroupBusy: 'the group is busy right now, try again',
  DecimalsInvalid: 'must be a whole number from 0 to 4',
  DecimalsWithoutCurrency: 'send currency_decimals together with currency',
  NotMinorUnits: 'must be a whole number in the smallest currency unit',
  DecimalsMismatch: "must match the currency's standard decimals",
  UsersNotInOneGroup:
    'every user in an expense or payment must exist and belong to the same group',
};

export { ErrorMessage };
