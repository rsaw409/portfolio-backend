import { vi, describe, test, expect, beforeEach } from 'vitest';
import { Op, UniqueConstraintError } from 'sequelize';

const opIn = Op.in as unknown as string;

vi.mock('../../../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

type Row = Record<string, any> & { dataValues: Record<string, any> };

let rows: Row[] = [];
let nextId = 1;

// Stands in for split_backend.transactions, enforcing the same unique
// idempotency_key index the real table has (NULLs never collide).
const Transaction = {
  create: vi.fn(async (values: Record<string, any>) => {
    if (
      values.idempotency_key != null &&
      rows.some((r) => r.idempotency_key === values.idempotency_key)
    ) {
      throw new UniqueConstraintError({});
    }
    const stored = { id: nextId++, ...values };
    const row: Row = { ...stored, dataValues: stored };
    rows.push(row);
    return row;
  }),
  findOne: vi.fn(async ({ where }: any) => {
    return (
      rows.find((r) => r.idempotency_key === where.idempotency_key) ?? null
    );
  }),
  findAll: vi.fn(async ({ where }: any) => {
    const wanted: string[] = Array.isArray(where.idempotency_key?.[opIn])
      ? where.idempotency_key[opIn]
      : [where.idempotency_key];
    // Returned unordered, as Postgres would without an ORDER BY.
    return rows
      .filter((r) => wanted.includes(r.idempotency_key))
      .slice()
      .reverse();
  }),
};

const TransactionPart = {
  create: vi.fn(async () => ({})),
  bulkCreate: vi.fn(async () => []),
};

vi.mock('../../../../../src/postgres.js', () => {
  return {
    default: {
      getSequelize: vi.fn(() => {
        return {
          // A unique violation aborts the transaction in Postgres, so the
          // fake discards everything the failed attempt wrote.
          transaction: vi.fn(async (fn: Function) => {
            const snapshot = rows.slice();
            try {
              return await fn('T');
            } catch (error) {
              rows = snapshot;
              throw error;
            }
          }),
          models: { Transaction, TransactionPart },
        };
      }),
      split_backend: 'split_backend',
      portfolio_backend: 'portfolio_backend',
    },
  };
});

const { saveTransaction, savePayment, savePayments } =
  await import('../../../../../src/split-backend/db/queries/transaction.js');
const { ErrorMessage } =
  await import('../../../../../src/@rsaw409/constant.js');

const expense = {
  by: 1,
  title: 'dinner',
  totalAmount: 100,
  groupName: 'trip',
  transactionParts: [{ user_id: 2, amount: 100 }],
};

const payment = { from: 1, to: 2, amount: 50, groupName: 'trip' };

const keyed = <T>(payload: T, idempotency_key: string) => {
  return { ...payload, idempotency_key };
};

const batchOf = (...keys: string[]) =>
  keys.map((idempotency_key, i) => {
    return { ...payment, to: i + 2, idempotency_key };
  });

describe('TEST idempotent split writes', () => {
  beforeEach(() => {
    rows = [];
    nextId = 1;
    vi.clearAllMocks();
  });

  test('saveTransaction writes twice when no key is sent', async () => {
    const first = await saveTransaction(expense);
    const second = await saveTransaction(expense);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(false);
    expect(rows).toHaveLength(2);
    // NULL keys must never collide on the unique index.
    expect(Transaction.findOne).not.toHaveBeenCalled();
  });

  test('saveTransaction replays the original row on retry', async () => {
    const first = await saveTransaction(keyed(expense, 'key-1'));
    const retry = await saveTransaction(keyed(expense, 'key-1'));

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.result).toBe(first.result);
    expect(rows).toHaveLength(1);
    // The retry attempts the insert and is turned back by the index, so the
    // parts of the expense are never written a second time.
    expect(Transaction.create).toHaveBeenCalledTimes(2);
    expect(TransactionPart.bulkCreate).toHaveBeenCalledTimes(1);
  });

  test('saveTransaction tags the row with the key', async () => {
    await saveTransaction(keyed(expense, 'key-tag'));
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: 'key-tag' }),
      { transaction: 'T' }
    );
  });

  test('savePayment replays the original row on retry', async () => {
    const first = await savePayment(keyed(payment, 'key-2'));
    const retry = await savePayment(keyed(payment, 'key-2'));

    expect(retry.replayed).toBe(true);
    expect(retry.result).toBe(first.result);
    expect(rows).toHaveLength(1);
    expect(TransactionPart.create).toHaveBeenCalledTimes(1);
  });

  test('savePayments tags each payment with its own key', async () => {
    const first = await savePayments(batchOf('a', 'b', 'c'));

    expect(first.written).toEqual([true, true, true]);
    expect(first.result).toHaveLength(3);
    expect(rows.map((r) => r.idempotency_key)).toEqual(['a', 'b', 'c']);
  });

  test('savePayments replays the whole batch, in request order, on retry', async () => {
    const first = await savePayments(batchOf('a', 'b', 'c'));
    const retry = await savePayments(batchOf('a', 'b', 'c'));

    expect(retry.written).toEqual([false, false, false]);
    expect(retry.result.map((r: any) => r.id)).toEqual(
      first.result.map((r: any) => r.id)
    );
    expect(rows).toHaveLength(3);
  });

  test('savePayments writes only the payments that are new', async () => {
    // The first batch was committed but its response was lost; the user then
    // added a payment, so the retry carries the old keys plus a new one.
    const first = await savePayments(batchOf('a', 'b'));
    const retry = await savePayments(batchOf('a', 'b', 'c'));

    expect(retry.written).toEqual([false, false, true]);
    expect(rows).toHaveLength(3);
    // a and b keep their original rows, c is the only new write.
    expect(retry.result.slice(0, 2).map((r: any) => r.id)).toEqual(
      first.result.map((r: any) => r.id)
    );
    expect((retry.result[2] as any).idempotency_key).toEqual('c');
  });

  test('savePayments keeps the request order when only some are new', async () => {
    await savePayments(batchOf('b'));
    const mixed = await savePayments(batchOf('a', 'b', 'c'));

    expect(mixed.written).toEqual([true, false, true]);
    expect(mixed.result.map((r: any) => r.idempotency_key)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  test('savePayments writes unguarded when the batch has no keys', async () => {
    const first = await savePayments([payment, payment]);
    await savePayments([payment, payment]);

    expect(first.written).toEqual([true, true]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.idempotency_key === undefined)).toBe(true);
  });

  test('savePayments recovers when the index rejects a spent key', async () => {
    // 'a' was written by an earlier batch whose response the client never saw.
    rows.push({
      id: 99,
      idempotency_key: 'a',
      dataValues: { id: 99, idempotency_key: 'a' },
    } as Row);

    const result = await savePayments(batchOf('a', 'b'));

    expect(result.written).toEqual([false, true]);
    expect((result.result[0] as any).id).toEqual(99);
    expect(rows).toHaveLength(2);
  });

  test('savePayments keeps earlier payments when a later key is spent', async () => {
    // The spent key is second, so 'c' is committed on its own before 'd' is
    // recognised as already written.
    rows.push({
      id: 99,
      idempotency_key: 'd',
      dataValues: { id: 99, idempotency_key: 'd' },
    } as Row);

    const result = await savePayments(batchOf('c', 'd'));

    expect(result.written).toEqual([true, false]);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.idempotency_key === 'c')).toHaveLength(1);
  });

  test('savePayments is not atomic: a mid-batch failure keeps what came before', async () => {
    Transaction.create
      .mockImplementationOnce(async (values) => {
        const stored = { id: nextId++, ...values };
        const row: Row = { ...stored, dataValues: stored };
        rows.push(row);
        return row;
      })
      .mockImplementationOnce(async () => {
        throw new Error('constraint violated');
      });

    await expect(savePayments(batchOf('a', 'b', 'c'))).rejects.toThrow(
      'constraint violated'
    );
    // 'a' is already committed; retrying the batch replays it and writes the
    // rest, which is what makes the lost atomicity recoverable.
    expect(rows.map((r) => r.idempotency_key)).toEqual(['a']);

    const retry = await savePayments(batchOf('a', 'b', 'c'));
    expect(retry.written).toEqual([false, true, true]);
    expect(rows).toHaveLength(3);
  });

  test('a unique violation unrelated to a key is not swallowed', async () => {
    Transaction.create.mockImplementationOnce(async () => {
      throw new UniqueConstraintError({});
    });

    await expect(saveTransaction(expense)).rejects.toThrow(
      UniqueConstraintError
    );
  });

  test('errors from the write itself propagate', async () => {
    Transaction.create.mockImplementationOnce(async () => {
      throw new Error('insert failed');
    });

    await expect(saveTransaction(keyed(expense, 'key-boom'))).rejects.toThrow(
      'insert failed'
    );
    expect(rows).toHaveLength(0);
  });
});
