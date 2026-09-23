import { vi, expect, describe, test } from 'vitest';

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
        return null;
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
    await expect(getGroup({ group_id: 12 })).rejects.toThrow(
      'DB not initialized'
    );
  });

  test('TEST Create Group ', async () => {
    await expect(createGroup({ name: 'test' })).rejects.toThrow(
      'DB not initialized'
    );
  });

  test('TEST getOverviewDataInGroup', async () => {
    await expect(getOverviewDataInGroup({ group_id: 2 })).rejects.toThrow(
      'DB not initialized'
    );
  });

  test('TEST getAllUsersInGroup', async () => {
    await expect(getAllUsersInGroup({ group_id: 1 })).rejects.toThrow(
      'DB not initialized'
    );
  });

  test('TEST createUser', async () => {
    await expect(createUser({ name: 'test', group_id: 1 })).rejects.toThrow(
      'DB not initialized'
    );
  });

  test('TEST saveTransaction', async () => {
    await expect(
      saveTransaction({
        by: 1,
        title: 'ttile',
        totalAmount: 112,
        groupName: 'groupName',
        transactionParts: [],
      })
    ).rejects.toThrow('DB not initialized');
  });

  test('TEST savePayment', async () => {
    await expect(
      savePayment({
        from: 1,
        to: 2,
        amount: 112,
        groupName: 'groupName',
      })
    ).rejects.toThrow('DB not initialized');
  });

  test('TEST savePayments', async () => {
    await expect(
      savePayments([
        {
          from: 1,
          to: 2,
          amount: 112,
          groupName: 'groupName',
        },
      ])
    ).rejects.toThrow('DB not initialized');
  });

  test('TEST getAllTransactionInGroup', async () => {
    await expect(
      getAllTransactionInGroup({
        group_id: 1,
        by: 2,
        user_id: 3,
        payments: true,
      })
    ).rejects.toThrow('DB not initialized');
  });
});
