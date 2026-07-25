import { vi, describe, test, beforeEach, expect, Mock } from 'vitest';

vi.mock('sequelize', () => {
  return {
    Sequelize: vi.fn(function (connStr) {
      expect(connStr).toEqual('tests-postgres');
      return {
        authenticate: vi.fn(),
        sync: vi.fn(({ alter, force }) => {
          expect(alter).toEqual(true);
          expect(force).toEqual(undefined);
        }),
        query: vi.fn(),
      };
    }),
  };
});

vi.mock('../../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../../../../src/split-backend/db/models/group.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../../../../src/split-backend/db/models/user.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../../../../src/split-backend/db/models/transaction.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../../../../src/split-backend/db/models/transactionPart.js', () => {
  return {
    default: vi.fn(),
  };
});

const { default: initializeSplitDB } = await import(
  '../../../../src/split-backend/db/postgres.js'
);
const { Sequelize } = await import('sequelize');
const { default: createGroupModel } = await import(
  '../../../../src/split-backend/db/models/group.js'
);
const { default: createUserModel } = await import(
  '../../../../src/split-backend/db/models/user.js'
);
const { default: createTransactionModel } = await import(
  '../../../../src/split-backend/db/models/transaction.js'
);
const { default: createTransactionPartModel } = await import(
  '../../../../src/split-backend/db/models/transactionPart.js'
);

describe('TEST SplitDB initialization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('Should init initializeSplitDB', async () => {
    const ss = new Sequelize('tests-postgres');
    const schemaName = 'test-schema';
    await initializeSplitDB(ss, schemaName);
    expect(createGroupModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createUserModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createTransactionModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createTransactionPartModel).toHaveBeenCalledWith(ss, schemaName);
  });

  test('Should log error in initializeSplitDB', async () => {
    (createTransactionModel as Mock).mockImplementation(() => {
      throw new Error('Error in creating model');
    });
    const ss = new Sequelize('tests-postgres');
    const schemaName = 'test-schema';
    await initializeSplitDB(ss, schemaName);
  });
});
