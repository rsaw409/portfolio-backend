import { vi, describe, test, expect, beforeEach } from 'vitest';
import { UniqueConstraintError } from 'sequelize';

vi.mock('../../../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

type Row = Record<string, any> & { get: (key: string) => any };

let groups: Row[] = [];
let users: Row[] = [];
let nextId = 1;

const toRow = (values: Record<string, any>): Row => {
  return { ...values, get: (key: string) => values[key] };
};

// Stands in for split_backend.groups, enforcing the same unique
// idempotency_key index the real table has (NULLs never collide).
const Group = {
  create: vi.fn(async (values: Record<string, any>) => {
    if (
      values.idempotency_key != null &&
      groups.some((g) => g.idempotency_key === values.idempotency_key)
    ) {
      throw new UniqueConstraintError({});
    }
    const row = toRow({ id: nextId++, ...values });
    groups.push(row);
    return row;
  }),
  findOne: vi.fn(async ({ where }: any) => {
    return (
      groups.find((g) => g.idempotency_key === where.idempotency_key) ?? null
    );
  }),
};

const User = {
  bulkCreate: vi.fn(async (values: Record<string, any>[]) => {
    const rows = values.map((v) => toRow({ id: nextId++, ...v }));
    users.push(...rows);
    return rows;
  }),
  findAll: vi.fn(async ({ where }: any) => {
    return users.filter((u) => u.group_id === where.group_id);
  }),
};

vi.mock('../../../../../src/postgres.js', () => {
  return {
    default: {
      getSequelize: vi.fn(() => {
        return {
          // A unique violation aborts the transaction in Postgres, so the
          // fake discards everything the failed attempt wrote.
          transaction: vi.fn(async (fn: Function) => {
            const snapshot = { groups: groups.slice(), users: users.slice() };
            try {
              return await fn('T');
            } catch (error) {
              groups = snapshot.groups;
              users = snapshot.users;
              throw error;
            }
          }),
          models: { Group, User },
        };
      }),
      split_backend: 'split_backend',
      portfolio_backend: 'portfolio_backend',
    },
  };
});

const { createGroup } =
  await import('../../../../../src/split-backend/db/queries/group.js');

const trip = {
  name: 'Manali Trip',
  currency: 'INR',
  currency_decimals: 2,
  members: [
    { name: 'Rohit', avatar: 'seed-r' },
    { name: 'Priya' },
    { name: 'Aman' },
  ],
};

const names = (rows: Row[]) => rows.map((r) => r.get('name'));

describe('TEST idempotent createGroup', () => {
  beforeEach(() => {
    groups = [];
    users = [];
    nextId = 1;
    vi.clearAllMocks();
  });

  test('creates the group and its members together', async () => {
    const { result, replayed } = await createGroup(trip);

    expect(replayed).toBe(false);
    expect(result.group.get('currency')).toBe('INR');
    expect(names(result.members)).toEqual(['Rohit', 'Priya', 'Aman']);
    expect(result.members.map((m) => m.get('avatar'))).toEqual([
      'seed-r',
      undefined,
      undefined,
    ]);
    expect(
      result.members.every((m) => m.get('group_id') === result.group.get('id'))
    ).toBe(true);
  });

  test('creates two groups when no key is sent', async () => {
    await createGroup(trip);
    await createGroup(trip);

    expect(groups).toHaveLength(2);
    expect(users).toHaveLength(6);
  });

  test('a repeated key returns the first group and writes nothing', async () => {
    const first = await createGroup({ ...trip, idempotency_key: 'g1' });
    const second = await createGroup({ ...trip, idempotency_key: 'g1' });

    expect(second.replayed).toBe(true);
    expect(second.result.group.get('id')).toBe(first.result.group.get('id'));
    expect(names(second.result.members)).toEqual(['Rohit', 'Priya', 'Aman']);
    expect(groups).toHaveLength(1);
    expect(users).toHaveLength(3);
  });

  test('a failed member write leaves no group behind', async () => {
    User.bulkCreate.mockRejectedValueOnce(new Error('boom'));

    await expect(
      createGroup({ ...trip, idempotency_key: 'g2' })
    ).rejects.toThrow('boom');
    expect(groups).toHaveLength(0);

    // So the retry with the same key writes rather than replaying nothing.
    const retry = await createGroup({ ...trip, idempotency_key: 'g2' });
    expect(retry.replayed).toBe(false);
    expect(users).toHaveLength(3);
  });
});
