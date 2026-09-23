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

const createGroupSchema = z.object({
  name: z.string().min(1),
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
  amount: z.number(),
});

const saveTransactionSchema = z
  .object({
    by: requiredId,
    title: z.string().min(1),
    totalAmount: z.number(),
    groupName: z.string().optional(),
    idempotency_key: idempotencyKey,
    transactionParts: z.array(transactionPartSchema).min(1),
  })
  .refine(
    (body) =>
      body.transactionParts.reduce((sum, e) => sum + e.amount, 0) ===
      body.totalAmount,
    { message: 'distribution is not matching with totalAmount.' }
  );

const savePaymentSchema = z.object({
  from: requiredId,
  to: requiredId,
  amount: z.number(),
  groupName: z.string().optional(),
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
  MAX_KEY_LENGTH,
};
