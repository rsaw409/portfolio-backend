import { vi, describe, test, expect } from 'vitest';

vi.mock('sequelize', () => {
  return {
    QueryTypes: {
      SELECT: 'SELECT',
    },
    UniqueConstraintError: class extends Error {},
  };
});

vi.mock('../../../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../../../../../src/postgres.js', () => {
  return {
    default: {
      getSequelize: vi.fn(() => {
        return {
          transaction: vi.fn((fn: Function) => {
            fn();
          }),
          models: {
            Group: {
              create: vi.fn((p) => {
                expect(p).toHaveProperty('name');
              }),
              findOne: vi.fn((p) => {
                expect(p).toHaveProperty('where');
              }),
            },
            User: {
              findAll: vi.fn((p) => {
                expect(p).toHaveProperty(
                  'where',
                  expect.objectContaining({ group_id: expect.any(Number) })
                );
              }),
              findOne: vi.fn((p) => {
                expect(p).toHaveProperty(
                  'where',
                  expect.objectContaining({
                    group_id: expect.any(Number),
                    name: expect.any(String),
                  })
                );
                return false;
              }),
              create: vi.fn((p) => {
                expect(p).toHaveProperty('name', expect.any(String));
                expect(p).toHaveProperty('group_id', expect.any(Number));
              }),
            },
            Transaction: {
              create: vi.fn((p) => {
                expect(p).toHaveProperty('by', expect.any(Number));
                expect(p).toHaveProperty('title', expect.any(String));
                expect(p).toHaveProperty('amount', expect.any(Number));
                return {
                  dataValues: {
                    id: 1,
                  },
                };
              }),
            },
            TransactionPart: {
              create: vi.fn((p) => {
                expect(p).toHaveProperty('user_id');
                expect(p).toHaveProperty('amount');
                expect(p).toHaveProperty('transaction_id');
              }),
              bulkCreate: vi.fn((p) => {
                expect(p).toEqual(expect.any(Array));
              }),
            },
          },
          query: vi.fn((sql, options) => {
            expect(typeof sql).toEqual('string');
          }),
        };
      }),
      split_backend: 'split_backend',
      portfolio_backend: 'portfolio_backend',
    },
  };
});

const { getGroup, createGroup, getOverviewDataInGroup } =
  await import('../../../../../src/split-backend/db/queries/group.js');
const { getAllUsersInGroup, createUser } =
  await import('../../../../../src/split-backend/db/queries/user.js');
const { saveTransaction, savePayment, getAllTransactionInGroup, savePayments } =
  await import('../../../../../src/split-backend/db/queries/transaction.js');

describe('TEST split-backend queries', () => {
  test('TEST GET Group ', async () => {
    await getGroup({ group_id: 12 });
  });

  test('TEST Create Group ', async () => {
    await createGroup({ name: 'test' });
  });

  test('TEST getOverviewDataInGroup', async () => {
    await getOverviewDataInGroup({ group_id: 2 });
  });

  test('TEST getAllUsersInGroup', async () => {
    await getAllUsersInGroup({ group_id: 1 });
  });

  test('TEST createUser', async () => {
    await createUser({ name: 'test', group_id: 1 });
  });

  test('TEST saveTransaction', async () => {
    await saveTransaction({
      by: 1,
      title: 'titile',
      totalAmount: 112,
      groupName: 'groupName',
      transactionParts: [],
    });
  });

  test('TEST savePayment', async () => {
    await savePayment({
      from: 1,
      to: 2,
      amount: 112,
      groupName: 'groupName',
    });
  });

  test('TEST savePayments', async () => {
    await savePayments([
      {
        from: 1,
        to: 2,
        amount: 112,
        groupName: 'groupName',
      },
    ]);
  });

  test('TEST getAllTransactionInGroup without filters', async () => {
    await getAllTransactionInGroup({
      group_id: 1,
      by: undefined,
      user_id: undefined,
      payments: undefined,
    });
  });

  test('TEST getAllTransactionInGroup by a user', async () => {
    await getAllTransactionInGroup({
      group_id: 1,
      by: 2,
      user_id: undefined,
      payments: undefined,
    });
  });

  test('TEST getAllTransactionInGroup by a user (only payments)', async () => {
    await getAllTransactionInGroup({
      group_id: 1,
      by: 2,
      user_id: undefined,
      payments: 'payment',
    });
  });

  test('TEST getAllTransactionInGroup where a user involved', async () => {
    await getAllTransactionInGroup({
      group_id: 1,
      by: undefined,
      user_id: 1,
      payments: undefined,
    });
  });
});
