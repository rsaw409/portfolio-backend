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

/** An amount in paise. Whole numbers only: the columns are BIGINT. */
const paise = z.number().int('must be a whole number of paise');

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

/**
 * Only INR for now: amounts are paise and notifications print 'INR', so any
 * other currency would be mislabelled. Case-insensitive, so 'inr' is fine.
 */
const currency = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z.literal('INR', { error: ErrorMessage.CurrencyUnsupported })
);

/**
 * Both new fields are optional so clients that send only a name keep working:
 * such a group is INR with no members, exactly as before.
 */
const createGroupSchema = z.object({
  name: nonBlankText,
  currency: currency.default('INR'),
  members: z
    .array(nonBlankText, { error: ErrorMessage.NotAList })
    .default([])
    // Case-insensitive: 'Rohit' and 'rohit' in one group are the same person
    // as far as whoever picks a payer from the list can tell.
    .refine(
      (names) =>
        new Set(names.map((n) => n.toLowerCase())).size === names.length,
      { message: ErrorMessage.MemberRepeated }
    ),
  idempotency_key: idempotencyKey,
});

const joinGroupSchema = z.object({
  invite_id: z.string().min(1),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  group_id: requiredId,
});

const groupSchema = z.object({
  group_id: requiredId,
});

const transactionPartSchema = z.object({
  user_id: requiredId,
  amount: paise,
});

const saveTransactionSchema = z
  .object({
    by: requiredId,
    title: z.string().min(1),
    totalAmount: paise,
    idempotency_key: idempotencyKey,
    transactionParts: z.array(transactionPartSchema).min(1),
  })
  .refine(
    // Integer paise sum exactly, so no rounding is needed.
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
  amount: paise,
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

const MAX_GROUPS_PER_DEVICE = 500;

// OneSignal subscription ids are UUIDs, and OneSignal rejects a whole
// notification if any id in it is not one.
const SUBSCRIPTION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isSubscriptionId = (value: string) => SUBSCRIPTION_ID.test(value);

/**
 * The complete list of groups a device follows. Repeats are dropped rather
 * than rejected: they ask for the same thing twice.
 */
const registerDeviceSchema = z.object({
  subscription_id: nonBlankText
    .regex(SUBSCRIPTION_ID, ErrorMessage.NotASubscriptionId)
    // One spelling per device, so it maps to one primary-key row.
    .transform((id) => id.toLowerCase()),
  group_ids: z
    .array(requiredId, { error: ErrorMessage.NotAnIdList })
    .max(MAX_GROUPS_PER_DEVICE, ErrorMessage.TooManyGroups)
    .transform((ids) => [...new Set(ids)]),
});

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
  isSubscriptionId,
  MAX_KEY_LENGTH,
  MAX_GROUPS_PER_DEVICE,
};
