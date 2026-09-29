import { z } from 'zod';
import { ErrorMessage } from '../../@rsaw409/constant.js';

const MAX_KEY_LENGTH = 255;

/**
 * A client-supplied idempotency key. Blank and null collapse to undefined so
 * they are stored as NULL rather than reaching the unique index as an empty
 * string, where every blank key would collide with every other.
 */
const idempotencyKey = z.preprocess((value) => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed === '' || trimmed === null ? undefined : trimmed;
}, z.string().max(MAX_KEY_LENGTH, ErrorMessage.IdempotencyKeyTooLong).optional());

/** An id that may arrive as a number, a numeric string, null or 'null'. */
const optionalId = z.preprocess((value) => {
  if (value === null || value === undefined || value === 'null') {
    return undefined;
  }
  return value;
}, z.coerce.number().int().optional());

const requiredId = z.coerce.number().int();

/**
 * An amount in the group currency's smallest unit (paise for INR, yen for
 * JPY). Whole numbers only: the columns are BIGINT.
 */
const minorUnits = z.number().int(ErrorMessage.NotMinorUnits);

/**
 * A tri-state filter: true for payments only, false for expenses only, and
 * absent for no filter at all. Accepts the string forms older clients send.
 */
const optionalBoolean = z.preprocess((value) => {
  if (value === null || value === undefined || value === 'null') {
    return undefined;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean().optional());

/** Trimmed text that must not be blank, with messages fit for a client. */
const nonBlankText = z
  .string({
    error: (issue) =>
      issue.input === undefined ? ErrorMessage.Required : ErrorMessage.NotText,
  })
  .trim()
  // abort: a blank value gets this message alone, not every later check's.
  .min(1, { error: ErrorMessage.Blank, abort: true });

const MAX_AVATAR_LENGTH = 64;

/** The seed the app renders a user's avatar from. */
const avatar = nonBlankText.max(MAX_AVATAR_LENGTH, ErrorMessage.AvatarTooLong);

/**
 * A member to create with a group: a plain name, as older apps send, or
 * { name, avatar }. Both come out as the object form.
 */
const member = z.preprocess(
  (value) => (typeof value === 'string' ? { name: value } : value),
  z.object({ name: nonBlankText, avatar: avatar.optional() })
);

// The ISO 4217 codes the runtime's Intl knows: the same data that gives each
// currency its symbol and standard decimals, so all three always agree.
const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

/**
 * Any real ISO 4217 code, case-insensitive ('inr' is INR). A made-up code
 * such as 'XYZ' is rejected, not just a malformed one. App versions released
 * before per-group currencies read every amount as paise, so the app is to be
 * updated before groups in other currencies are created.
 */
const currency = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z
    .string({ error: ErrorMessage.CurrencyInvalid })
    .refine((code) => CURRENCIES.has(code), ErrorMessage.CurrencyInvalid)
);

/**
 * Decimals of the currency's minor unit, sent by the app: the scale of every
 * amount in the group (2 for INR, 0 for JPY, 3 for KWD). ISO 4217 goes to 4.
 */
const currencyDecimals = z
  .number({
    error: (issue) =>
      issue.input === undefined
        ? ErrorMessage.Required
        : ErrorMessage.DecimalsInvalid,
  })
  .int(ErrorMessage.DecimalsInvalid)
  .min(0, ErrorMessage.DecimalsInvalid)
  .max(4, ErrorMessage.DecimalsInvalid);

/**
 * The decimals ISO 4217 (as the runtime's Intl data has it) gives `currency`:
 * 2 for INR, 0 for JPY, 3 for KWD.
 */
const standardDecimals = (currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;

/**
 * The app sends currency_decimals, but it must be the currency's standard
 * value: it becomes the permanent scale of the group's amounts once the group
 * has any, so a wrong value from a buggy client must not get that far.
 */
const checkDecimalsMatch = (
  body: { currency?: string; currency_decimals?: number },
  ctx: z.RefinementCtx
) => {
  // zod runs this even when a field already failed; an unknown currency has
  // its own error and no standard to compare with (Intl would throw).
  if (
    body.currency === undefined ||
    body.currency_decimals === undefined ||
    !CURRENCIES.has(body.currency)
  ) {
    return;
  }
  const expected = standardDecimals(body.currency);
  if (body.currency_decimals !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: ['currency_decimals'],
      message: `${ErrorMessage.DecimalsMismatch} (${expected} for ${body.currency})`,
    });
  }
};

const createGroupSchema = z
  .object({
    name: nonBlankText,
    currency: currency.default('INR'),
    currency_decimals: currencyDecimals,
    members: z
      .array(member, { error: ErrorMessage.NotAList })
      .default([])
      // Case-insensitive: 'Rohit' and 'rohit' in one group are the same person
      // as far as whoever picks a payer from the list can tell.
      .refine(
        (members) =>
          new Set(members.map((m) => m.name.toLowerCase())).size ===
          members.length,
        { message: ErrorMessage.MemberRepeated }
      ),
    idempotency_key: idempotencyKey,
  })
  .superRefine(checkDecimalsMatch);

const joinGroupSchema = z.object({
  invite_id: z.string().min(1),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  group_id: requiredId,
  // Optional so app versions from before avatars can still add users.
  avatar: avatar.optional(),
});

const groupSchema = z.object({
  group_id: requiredId,
});

const transactionPartSchema = z.object({
  user_id: requiredId,
  amount: minorUnits,
});

const saveTransactionSchema = z
  .object({
    by: requiredId,
    title: z.string().min(1),
    totalAmount: minorUnits,
    idempotency_key: idempotencyKey,
    transactionParts: z.array(transactionPartSchema).min(1),
  })
  .refine(
    // Whole minor units sum exactly, so no rounding is needed.
    (body) =>
      body.transactionParts.reduce((sum, e) => sum + e.amount, 0) ===
      body.totalAmount,
    { message: 'distribution is not matching with totalAmount.' }
  );

// The app still sends groupName on writes. It is no longer read — the
// notification text takes the name from the database — and zod strips it.
const savePaymentSchema = z.object({
  from: requiredId,
  to: requiredId,
  amount: minorUnits,
  idempotency_key: idempotencyKey,
});

/**
 * A batch is keyed throughout or not at all: half-keying would replay some
 * payments while rewriting the rest, and a repeated key would collide with its
 * own batch on the unique index.
 */
const savePaymentsSchema = z
  .array(savePaymentSchema)
  .min(1, 'req.body should have array of (from,to,amount)')
  .superRefine((payments, ctx) => {
    const keys = payments
      .map((payment) => payment.idempotency_key)
      .filter((key): key is string => !!key);
    if (keys.length === 0) return;

    if (keys.length !== payments.length) {
      ctx.addIssue({
        code: 'custom',
        message: ErrorMessage.IdempotencyKeyMissingInBatch,
      });
    } else if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        message: ErrorMessage.IdempotencyKeyRepeated,
      });
    }
  });

const MAX_GROUP_IDS = 500;

/**
 * A list of group ids, as sent by a device for the groups it knows. Repeats
 * are dropped rather than rejected: they ask for the same thing twice.
 */
const groupIdList = z
  .array(requiredId, { error: ErrorMessage.NotAnIdList })
  .max(MAX_GROUP_IDS, ErrorMessage.TooManyGroups)
  .transform((ids) => [...new Set(ids)]);

// OneSignal subscription ids are UUIDs, and OneSignal rejects a whole
// notification if any id in it is not one.
const SUBSCRIPTION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isSubscriptionId = (value: string) => SUBSCRIPTION_ID.test(value);

/** The complete list of groups a device follows. */
const registerDeviceSchema = z.object({
  subscription_id: nonBlankText
    .regex(SUBSCRIPTION_ID, ErrorMessage.NotASubscriptionId)
    // One spelling per device, so it maps to one primary-key row.
    .transform((id) => id.toLowerCase()),
  group_ids: groupIdList,
});

const getGroupsSchema = z.object({
  group_ids: groupIdList,
});

/**
 * Only the fields sent are changed, under the same rules as createGroup; a
 * request that would change nothing is rejected rather than silently ignored.
 */
const updateGroupSchema = z
  .object({
    group_id: requiredId,
    name: nonBlankText.optional(),
    currency: currency.optional(),
    // The scale goes with the currency: required when it is sent, and not
    // accepted alone.
    currency_decimals: currencyDecimals.optional(),
  })
  .refine((body) => body.name !== undefined || body.currency !== undefined, {
    message: ErrorMessage.NothingToUpdate,
  })
  .refine(
    (body) =>
      body.currency === undefined || body.currency_decimals !== undefined,
    { message: ErrorMessage.Required, path: ['currency_decimals'] }
  )
  .refine(
    (body) =>
      body.currency_decimals === undefined || body.currency !== undefined,
    { message: ErrorMessage.DecimalsWithoutCurrency }
  )
  .superRefine(checkDecimalsMatch);

const getAllTransactionInGroupSchema = z.object({
  group_id: requiredId,
  by: optionalId,
  user_id: optionalId,
  payments: optionalBoolean,
});

/**
 * Parses a request body, turning a schema failure into the short
 * `field: reason` message the controllers already return as a 400.
 */
const parse = <T extends z.ZodType>(schema: T, body: unknown): z.infer<T> => {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;

  const message = parsed.error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join('.')}: ${issue.message}`
        : issue.message
    )
    .join('; ');
  throw new Error(message);
};

export {
  parse,
  createGroupSchema,
  joinGroupSchema,
  createUserSchema,
  groupSchema,
  saveTransactionSchema,
  savePaymentSchema,
  savePaymentsSchema,
  getAllTransactionInGroupSchema,
  registerDeviceSchema,
  getGroupsSchema,
  updateGroupSchema,
  isSubscriptionId,
  MAX_KEY_LENGTH,
  MAX_AVATAR_LENGTH,
  MAX_GROUP_IDS,
};
