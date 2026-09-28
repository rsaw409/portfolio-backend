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
    DataTypes: {
      INTEGER: 'INTEGER',
      TEXT: 'TEXT',
      // Callable, like the real one, for sized columns such as STRING(3).
      STRING: Object.assign(() => 'STRING', { toString: () => 'STRING' }),
      ARRAY: () => {},
    },
  };
});

const { Sequelize } = await import('sequelize');
const { default: createGroupModel } =
  await import('../../../../../src/split-backend/db/models/group.js');
const { default: createUserModel } =
  await import('../../../../../src/split-backend/db/models/user.js');
const { default: createTransactionModel } =
  await import('../../../../../src/split-backend/db/models/transaction.js');
const { default: createTransactionPartModel } =
  await import('../../../../../src/split-backend/db/models/transactionPart.js');
const { default: createDeviceGroupModel } =
  await import('../../../../../src/split-backend/db/models/deviceGroup.js');

describe('TEST models init', () => {
  test('tests portfolio db models init', () => {
    const ss = new Sequelize('tests-postgres');
    const schemaName = 'tests-schemaname';
    createGroupModel(ss, schemaName);
    createUserModel(ss, schemaName);
    createTransactionModel(ss, schemaName);
    createTransactionPartModel(ss, schemaName);
    createDeviceGroupModel(ss, schemaName);
    expect(ss.define).toHaveBeenCalledTimes(5);
  });

  test('device_groups is keyed on (subscription_id, group_id)', () => {
    const ss = new Sequelize('tests-postgres');
    createDeviceGroupModel(ss, 'tests-schemaname');
    const [name, attributes, options] = (ss.define as any).mock.calls[0];
    expect(name).toBe('DeviceGroup');
    expect(attributes.subscription_id.primaryKey).toBe(true);
    expect(attributes.group_id.primaryKey).toBe(true);
    expect(attributes.group_id.references).toEqual({
      model: 'groups',
      key: 'id',
    });
    expect(options).toMatchObject({
      tableName: 'device_groups',
      createdAt: false,
      indexes: [{ name: 'device_groups_group_id', fields: ['group_id'] }],
    });
  });
});
