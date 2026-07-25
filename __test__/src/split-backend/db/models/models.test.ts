import { vi, describe, test, expect } from 'vitest';

vi.mock('sequelize', () => {
  return {
    Sequelize: vi.fn(function (connStr) {
      expect(connStr).toEqual('tests-postgres');
      return {
        define: vi.fn(),
        authenticate: vi.fn(),
        sync: vi.fn(({ alter, force }) => {
          expect(alter).toEqual(true);
          expect(force).toEqual(undefined);
        }),
        query: vi.fn(),
      };
    }),
    DataTypes: { INTEGER: 'INTEGER', STRING: 'STRING', ARRAY: () => {} },
  };
});

const { Sequelize } = await import('sequelize');
const { default: createGroupModel } = await import(
  '../../../../../src/split-backend/db/models/group.js'
);
const { default: createUserModel } = await import(
  '../../../../../src/split-backend/db/models/user.js'
);
const { default: createTransactionModel } = await import(
  '../../../../../src/split-backend/db/models/transaction.js'
);
const { default: createTransactionPartModel } = await import(
  '../../../../../src/split-backend/db/models/transactionPart.js'
);

describe('TEST models init', () => {
  test('tests portfolio db models init', () => {
    const ss = new Sequelize('tests-postgres');
    const schemaName = 'tests-schemaname';
    createGroupModel(ss, schemaName);
    createUserModel(ss, schemaName);
    createTransactionModel(ss, schemaName);
    createTransactionPartModel(ss, schemaName);
    expect(ss.define).toHaveBeenCalledTimes(4);
  });
});
