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
  registerDeviceSchema,
  getGroupsSchema,
  updateGroupSchema,
  MAX_KEY_LENGTH,
  MAX_GROUP_IDS,
  MAX_AVATAR_LENGTH,
} = await import('../../../../src/split-backend/utils/validator.js');
const { ErrorMessage } = await import('../../../../src/@rsaw409/constant.js');

const payment = (extra: Record<string, unknown> = {}) => {
  return { from: 1, to: 2, amount: 5000, ...extra };
};

const expense = (extra: Record<string, unknown> = {}) => {
  return {
    by: 1,
    title: 'Dinner',
    totalAmount: 10000,
    transactionParts: [{ user_id: 2, amount: 10000 }],
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

describe('TEST createGroup payload', () => {
  test('defaults currency and members', () => {
    expect(
      parse(createGroupSchema, { name: 'trip', currency_decimals: 2 })
    ).toEqual({
      name: 'trip',
      currency: 'INR',
      currency_decimals: 2,
      members: [],
    });
  });

  test('requires currency_decimals, a whole number from 0 to 4', () => {
    expect(() => parse(createGroupSchema, { name: 'trip' })).toThrow(
      'currency_decimals: is required'
    );
    for (const currency_decimals of [-1, 5, 1.5, '2', null]) {
      expect(() =>
        parse(createGroupSchema, { name: 'trip', currency_decimals })
      ).toThrow(`currency_decimals: ${ErrorMessage.DecimalsInvalid}`);
    }
  });

  test("currency_decimals must be the currency's standard value", () => {
    expect(
      parse(createGroupSchema, { name: 'trip', currency_decimals: 2 })
    ).toHaveProperty('currency_decimals', 2);
    for (const currency_decimals of [0, 3, 4]) {
      expect(() =>
        parse(createGroupSchema, { name: 'trip', currency_decimals })
      ).toThrow(
        `currency_decimals: ${ErrorMessage.DecimalsMismatch} (2 for INR)`
      );
    }
    expect(() =>
      parse(updateGroupSchema, {
        group_id: 7,
        currency: 'INR',
        currency_decimals: 0,
      })
    ).toThrow(
      `currency_decimals: ${ErrorMessage.DecimalsMismatch} (2 for INR)`
    );
  });

  test('trims the group name and member names', () => {
    expect(
      parse(createGroupSchema, {
        name: '  Manali Trip ',
        currency: ' inr ',
        currency_decimals: 2,
        members: [' Rohit', 'Priya '],
        idempotency_key: 'k',
      })
    ).toEqual({
      name: 'Manali Trip',
      currency: 'INR',
      currency_decimals: 2,
      members: [{ name: 'Rohit' }, { name: 'Priya' }],
      idempotency_key: 'k',
    });
  });

  test('rejects a missing, blank or non-text group name', () => {
    expect(() => parse(createGroupSchema, {})).toThrow('name: is required');
    expect(() => parse(createGroupSchema, { name: '   ' })).toThrow(
      'name: must not be blank'
    );
    expect(() => parse(createGroupSchema, { name: 7 })).toThrow(
      'name: must be text'
    );
  });

  test('accepts any real ISO 4217 code, with its own decimals', () => {
    for (const [currency, currency_decimals] of [
      ['USD', 2],
      ['jpy', 0],
      [' KWD ', 3],
      ['EUR', 2],
    ] as const) {
      expect(
        parse(createGroupSchema, { name: 'a', currency, currency_decimals })
      ).toMatchObject({
        currency: currency.trim().toUpperCase(),
        currency_decimals,
      });
    }
  });

  test('rejects a made-up, malformed or non-text currency', () => {
    for (const currency of ['XYZ', 'RUPEE', 'IN', '', 5]) {
      expect(() =>
        parse(createGroupSchema, { name: 'a', currency, currency_decimals: 2 })
      ).toThrow(`currency: ${ErrorMessage.CurrencyInvalid}`);
    }
  });

  test("checks decimals against the currency's own standard", () => {
    expect(() =>
      parse(createGroupSchema, {
        name: 'a',
        currency: 'JPY',
        currency_decimals: 2,
      })
    ).toThrow(
      `currency_decimals: ${ErrorMessage.DecimalsMismatch} (0 for JPY)`
    );
  });

  test('rejects blank and repeated member names', () => {
    expect(() =>
      parse(createGroupSchema, { name: 'a', members: ['Rohit', '  '] })
    ).toThrow('members.1.name: must not be blank');
    expect(() =>
      parse(createGroupSchema, { name: 'a', members: ['Rohit', 'rohit '] })
    ).toThrow('members: must not repeat a name');
    expect(() =>
      parse(createGroupSchema, { name: 'a', members: 'Rohit' })
    ).toThrow('members: must be a list of names');
  });

  test('accepts members as { name, avatar } objects mixed with names', () => {
    expect(
      parse(createGroupSchema, {
        name: 'a',
        currency_decimals: 2,
        members: [
          { name: ' Rohit ', avatar: ' seed-1 ' },
          'Priya',
          { name: 'Aman' },
        ],
      })
    ).toHaveProperty('members', [
      { name: 'Rohit', avatar: 'seed-1' },
      { name: 'Priya' },
      { name: 'Aman' },
    ]);
  });

  test('rejects a blank or oversized member avatar, and repeats across forms', () => {
    const base = { name: 'a', currency_decimals: 2 };
    expect(() =>
      parse(createGroupSchema, {
        ...base,
        members: [{ name: 'Rohit', avatar: '  ' }],
      })
    ).toThrow('members.0.avatar: must not be blank');
    expect(() =>
      parse(createGroupSchema, {
        ...base,
        members: [{ name: 'Rohit', avatar: 'x'.repeat(MAX_AVATAR_LENGTH + 1) }],
      })
    ).toThrow(`members.0.avatar: ${ErrorMessage.AvatarTooLong}`);
    expect(() =>
      parse(createGroupSchema, {
        ...base,
        members: ['Rohit', { name: 'rohit', avatar: 's' }],
      })
    ).toThrow('members: must not repeat a name');
  });

  test('allows a group with one member or none', () => {
    expect(
      parse(createGroupSchema, {
        name: 'a',
        currency_decimals: 2,
        members: ['Rohit'],
      })
    ).toHaveProperty('members', [{ name: 'Rohit' }]);
    expect(
      parse(createGroupSchema, { name: 'a', currency_decimals: 2, members: [] })
    ).toHaveProperty('members', []);
  });

  test('treats a blank idempotency_key as none', () => {
    expect(
      parse(createGroupSchema, {
        name: 'a',
        currency_decimals: 2,
        idempotency_key: ' ',
      })
    ).not.toHaveProperty('idempotency_key', expect.anything());
  });
});

describe('TEST registerDevice payload', () => {
  const subscription_id = 'a1a3588d-8d75-4d23-879f-82aa4a2c23c7';

  test('coerces ids and drops repeats', () => {
    expect(
      parse(registerDeviceSchema, {
        subscription_id: ` ${subscription_id} `,
        group_ids: [1, '2', 1],
      })
    ).toEqual({ subscription_id, group_ids: [1, 2] });
  });

  test('accepts an empty list, which unregisters the device', () => {
    expect(
      parse(registerDeviceSchema, { subscription_id, group_ids: [] })
    ).toEqual({ subscription_id, group_ids: [] });
  });

  test('rejects a missing, blank or non-UUID subscription_id', () => {
    expect(() => parse(registerDeviceSchema, { group_ids: [] })).toThrow(
      'subscription_id: is required'
    );
    expect(() =>
      parse(registerDeviceSchema, { subscription_id: '  ', group_ids: [] })
    ).toThrow(/^subscription_id: must not be blank$/);
    for (const bad of [
      'zz-verify-sub',
      `${subscription_id}0`,
      'x'.repeat(36),
    ]) {
      expect(() =>
        parse(registerDeviceSchema, { subscription_id: bad, group_ids: [] })
      ).toThrow(`subscription_id: ${ErrorMessage.NotASubscriptionId}`);
    }
  });

  test('lower-cases the subscription_id so a device has one row', () => {
    expect(
      parse(registerDeviceSchema, {
        subscription_id: subscription_id.toUpperCase(),
        group_ids: [1],
      })
    ).toEqual({ subscription_id, group_ids: [1] });
  });

  test('rejects group_ids that are not a list of ids', () => {
    expect(() => parse(registerDeviceSchema, { subscription_id })).toThrow(
      `group_ids: ${ErrorMessage.NotAnIdList}`
    );
    expect(() =>
      parse(registerDeviceSchema, { subscription_id, group_ids: ['abc'] })
    ).toThrow(/group_ids\.0/);
  });

  test('caps how many groups one device can list', () => {
    const group_ids = Array.from(
      { length: MAX_GROUP_IDS + 1 },
      (_, i) => i + 1
    );
    expect(() =>
      parse(registerDeviceSchema, { subscription_id, group_ids })
    ).toThrow(`group_ids: ${ErrorMessage.TooManyGroups}`);
  });
});

describe('TEST getGroups payload', () => {
  test('coerces ids and drops repeats', () => {
    expect(parse(getGroupsSchema, { group_ids: [3, '1', 3] })).toEqual({
      group_ids: [3, 1],
    });
  });

  test('accepts an empty list', () => {
    expect(parse(getGroupsSchema, { group_ids: [] })).toEqual({
      group_ids: [],
    });
  });

  test('rejects a missing or oversized list', () => {
    expect(() => parse(getGroupsSchema, {})).toThrow(
      `group_ids: ${ErrorMessage.NotAnIdList}`
    );
    expect(() =>
      parse(getGroupsSchema, {
        group_ids: Array.from({ length: MAX_GROUP_IDS + 1 }, (_, i) => i + 1),
      })
    ).toThrow(`group_ids: ${ErrorMessage.TooManyGroups}`);
  });
});

describe('TEST updateGroup payload', () => {
  test('keeps only the fields sent, trimmed and normalised', () => {
    expect(parse(updateGroupSchema, { group_id: '7', name: ' Goa ' })).toEqual({
      group_id: 7,
      name: 'Goa',
    });
    expect(
      parse(updateGroupSchema, {
        group_id: 7,
        currency: 'inr',
        currency_decimals: 2,
      })
    ).toEqual({ group_id: 7, currency: 'INR', currency_decimals: 2 });
  });

  test('currency and currency_decimals go together', () => {
    expect(() =>
      parse(updateGroupSchema, { group_id: 7, currency: 'INR' })
    ).toThrow('currency_decimals: is required');
    expect(() =>
      parse(updateGroupSchema, { group_id: 7, currency_decimals: 2 })
    ).toThrow(ErrorMessage.DecimalsWithoutCurrency);
    expect(() =>
      parse(updateGroupSchema, {
        group_id: 7,
        name: 'Goa',
        currency_decimals: 2,
      })
    ).toThrow(ErrorMessage.DecimalsWithoutCurrency);
    expect(() =>
      parse(updateGroupSchema, {
        group_id: 7,
        currency: 'INR',
        currency_decimals: 9,
      })
    ).toThrow(`currency_decimals: ${ErrorMessage.DecimalsInvalid}`);
  });

  test('applies the createGroup rules to each field', () => {
    expect(() =>
      parse(updateGroupSchema, { group_id: 7, name: '   ' })
    ).toThrow('name: must not be blank');
    expect(() =>
      parse(updateGroupSchema, {
        group_id: 7,
        currency: 'XYZ',
        currency_decimals: 2,
      })
    ).toThrow(`currency: ${ErrorMessage.CurrencyInvalid}`);
    expect(
      parse(updateGroupSchema, {
        group_id: 7,
        currency: 'usd',
        currency_decimals: 2,
      })
    ).toEqual({ group_id: 7, currency: 'USD', currency_decimals: 2 });
  });

  test('needs a group_id and something to change', () => {
    expect(() => parse(updateGroupSchema, { name: 'Goa' })).toThrow(/group_id/);
    expect(() => parse(updateGroupSchema, { group_id: 7 })).toThrow(
      ErrorMessage.NothingToUpdate
    );
  });
});

describe('TEST required fields', () => {
  test('names the missing field', () => {
    expect(() => parse(createGroupSchema, {})).toThrow(/name/);
    expect(() => parse(groupSchema, {})).toThrow(/group_id/);
    expect(() => parse(createUserSchema, { name: 'a' })).toThrow(/group_id/);
  });

  test('createUser takes an optional avatar, non-blank and bounded', () => {
    expect(
      parse(createUserSchema, { name: 'a', group_id: 3, avatar: ' seed ' })
    ).toEqual({ name: 'a', group_id: 3, avatar: 'seed' });
    expect(
      parse(createUserSchema, {
        name: 'a',
        group_id: 3,
        avatar: 'x'.repeat(MAX_AVATAR_LENGTH),
      })
    ).toHaveProperty('avatar', 'x'.repeat(MAX_AVATAR_LENGTH));
    expect(() =>
      parse(createUserSchema, { name: 'a', group_id: 3, avatar: ' ' })
    ).toThrow('avatar: must not be blank');
    expect(() =>
      parse(createUserSchema, {
        name: 'a',
        group_id: 3,
        avatar: 'x'.repeat(MAX_AVATAR_LENGTH + 1),
      })
    ).toThrow(`avatar: ${ErrorMessage.AvatarTooLong}`);
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
        expense({ transactionParts: [{ user_id: 2, amount: 4000 }] })
      )
    ).toThrow(/totalAmount/);
  });

  test('accepts a transaction whose parts sum correctly', () => {
    expect(parse(saveTransactionSchema, expense()).totalAmount).toEqual(10000);
  });

  test('sums parts exactly in minor units', () => {
    // 1000 rupees six ways: the split that drifted as float rupees.
    const parts = [16667, 16667, 16667, 16667, 16666, 16666].map(
      (amount, user_id) => ({ user_id, amount })
    );
    expect(
      parse(
        saveTransactionSchema,
        expense({ totalAmount: 100000, transactionParts: parts })
      ).transactionParts
    ).toHaveLength(6);
  });

  test('rejects a transaction with no parts', () => {
    expect(() =>
      parse(saveTransactionSchema, expense({ transactionParts: [] }))
    ).toThrow(/transactionParts/);
  });
});

describe('TEST amounts are whole minor units', () => {
  test('rejects a fractional payment amount', () => {
    expect(() => parse(savePaymentSchema, payment({ amount: 50.5 }))).toThrow(
      /amount: must be a whole number in the smallest currency unit/
    );
  });

  test('rejects a fractional total or part', () => {
    expect(() =>
      parse(
        saveTransactionSchema,
        expense({
          totalAmount: 100.5,
          transactionParts: [{ user_id: 2, amount: 100.5 }],
        })
      )
    ).toThrow(
      /totalAmount: must be a whole number in the smallest currency unit/
    );
    expect(() =>
      parse(
        saveTransactionSchema,
        expense({
          totalAmount: 100,
          transactionParts: [
            { user_id: 2, amount: 99.5 },
            { user_id: 3, amount: 0.5 },
          ],
        })
      )
    ).toThrow(/transactionParts\.0\.amount/);
  });

  test('rejects an amount beyond the safe integer range', () => {
    expect(() =>
      parse(savePaymentSchema, payment({ amount: Number.MAX_SAFE_INTEGER + 2 }))
    ).toThrow(/amount/);
  });

  test('rejects an amount sent as a string', () => {
    expect(() => parse(savePaymentSchema, payment({ amount: '5000' }))).toThrow(
      /amount/
    );
  });
});
