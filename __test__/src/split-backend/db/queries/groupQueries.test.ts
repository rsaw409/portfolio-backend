import { vi, describe, test, expect, beforeEach } from 'vitest';
import { DatabaseError } from 'sequelize';

const stored = [
  { id: 1, name: 'Manali Trip', currency: 'INR', currency_decimals: 2 },
  { id: 2, name: 'Goa', currency: 'INR', currency_decimals: 2 },
  { id: 3, name: 'Flat', currency: 'INR', currency_decimals: 2 },
];

const Group = {
  // Returned in table order, as Postgres would without an ORDER BY.
  findAll: vi.fn(async ({ where }: any) =>
    stored.filter((g) => where.id.includes(g.id))
  ),
};

// What LOCK TABLE does; a test can make it fail.
let lockTable = async (): Promise<unknown[]> => [];

// Group ids whose group already has an expense or payment.
let used = new Set<number>();

// Stands in for updateGroup's three statements, told apart by their SQL.
const query = vi.fn(async (sql: string, { bind }: any = {}) => {
  if (sql.startsWith('set local')) return [];
  if (sql.startsWith('lock table')) return lockTable();
  const row = stored.find((g) => g.id === bind.group_id);
  if (sql.includes('for update')) {
    return row
      ? [
          {
            name: row.name,
            currency: row.currency,
            currency_decimals: row.currency_decimals,
          },
        ]
      : [];
  }
  if (sql.includes('exists')) return [{ used: used.has(bind.group_id) }];
  return [
    {
      id: row!.id,
      name: bind.name ?? row!.name,
      currency: bind.currency ?? row!.currency,
      currency_decimals: bind.currency_decimals ?? row!.currency_decimals,
    },
  ];
});

vi.mock('../../../../../src/postgres.js', () => {
  return {
    default: {
      getSequelize: vi.fn(() => ({
        models: { Group },
        query,
        transaction: async (fn: Function) => fn('T'),
      })),
      split_backend: 'split_backend',
      portfolio_backend: 'portfolio_backend',
    },
  };
});

vi.mock('../../../../../src/@rsaw409/logger.js', () => {
  return { default: { error: vi.fn(), info: vi.fn() } };
});

const { ErrorMessage } =
  await import('../../../../../src/@rsaw409/constant.js');
const { getGroups, updateGroup } =
  await import('../../../../../src/split-backend/db/queries/group.js');

describe('TEST getGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns known groups in request order, leaving out unknown ids', async () => {
    expect(await getGroups({ group_ids: [3, 99, 1] })).toEqual([
      { id: 3, name: 'Flat', currency: 'INR', currency_decimals: 2 },
      { id: 1, name: 'Manali Trip', currency: 'INR', currency_decimals: 2 },
    ]);
  });

  test('selects only what the response needs', async () => {
    await getGroups({ group_ids: [1] });
    expect(Group.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ['id', 'name', 'currency', 'currency_decimals'],
      })
    );
  });

  test('an empty list skips the query', async () => {
    expect(await getGroups({ group_ids: [] })).toEqual([]);
    expect(Group.findAll).not.toHaveBeenCalled();
  });
});

describe('TEST updateGroup', () => {
  beforeEach(() => {
    used = new Set();
    lockTable = async () => [];
    vi.clearAllMocks();
  });

  const sqlOf = () => query.mock.calls.map(([sql]) => sql);

  test('returns the group as it now is and its previous values', async () => {
    expect(await updateGroup({ group_id: 2, name: 'Goa 2026' })).toEqual({
      group: { id: 2, name: 'Goa 2026', currency: 'INR', currency_decimals: 2 },
      previous: { name: 'Goa', currency: 'INR', currency_decimals: 2 },
    });
  });

  test('locks the group first, all in one transaction', async () => {
    await updateGroup({ group_id: 2, name: 'Goa 2026' });
    expect(sqlOf()[0]).toContain('for update');
    for (const [, options] of query.mock.calls) {
      expect(options.transaction).toBe('T');
    }
  });

  test('binds a field left out as null, so it keeps its value', async () => {
    await updateGroup({ group_id: 2, name: 'Goa 2026' });
    const [sql, options] = query.mock.calls.at(-1)!;
    expect(options.bind).toEqual({
      group_id: 2,
      name: 'Goa 2026',
      currency: null,
      currency_decimals: null,
    });
    expect(sql).toContain('coalesce($currency::text, currency)');
    expect(sql).not.toContain('Goa 2026');
  });

  test('changes the currency of a group with no transactions', async () => {
    expect(
      await updateGroup({ group_id: 2, currency: 'USD', currency_decimals: 2 })
    ).toMatchObject({
      group: { currency: 'USD', currency_decimals: 2 },
    });
  });

  test('a currency change locks transactions before checking them', async () => {
    await updateGroup({ group_id: 2, currency: 'USD', currency_decimals: 2 });
    const sql = sqlOf();
    const lock = sql.findIndex((s) =>
      s.includes('lock table split_backend.transactions in share mode')
    );
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(sql.findIndex((s) => s.includes('exists')));
    expect(query.mock.calls[lock][1]).toEqual({ transaction: 'T' });
  });

  test('bounds the wait for the lock with a transaction-local timeout', async () => {
    await updateGroup({ group_id: 2, currency: 'USD', currency_decimals: 2 });
    const sql = sqlOf();
    const timeout = sql.indexOf("set local lock_timeout = '2s'");
    expect(timeout).toBeGreaterThan(-1);
    expect(timeout).toBeLessThan(
      sql.findIndex((s) => s.startsWith('lock table'))
    );
    expect(query.mock.calls[timeout][1]).toEqual({ transaction: 'T' });
  });

  test('a lock timeout becomes a try-again message', async () => {
    lockTable = async () => {
      throw new DatabaseError(
        Object.assign(new Error('canceling statement due to lock timeout'), {
          code: '55P03',
        }) as any
      );
    };
    await expect(
      updateGroup({ group_id: 2, currency: 'USD', currency_decimals: 2 })
    ).rejects.toThrow(ErrorMessage.GroupBusy);
    expect(sqlOf().some((s) => s.includes('exists'))).toBe(false);
  });

  test('other database errors from the lock pass through', async () => {
    const other = new DatabaseError(
      Object.assign(new Error('deadlock detected'), { code: '40P01' }) as any
    );
    lockTable = async () => {
      throw other;
    };
    await expect(
      updateGroup({ group_id: 2, currency: 'USD', currency_decimals: 2 })
    ).rejects.toBe(other);
  });

  test('refuses a currency change once the group has transactions', async () => {
    used.add(2);
    await expect(
      updateGroup({ group_id: 2, currency: 'USD', currency_decimals: 2 })
    ).rejects.toThrow(ErrorMessage.CurrencyLocked);
    // Refused before the update statement ran.
    expect(sqlOf().some((sql) => sql.includes('returning'))).toBe(false);
  });

  test('a new scale for the same currency is locked like a new currency', async () => {
    used.add(2);
    await expect(
      updateGroup({ group_id: 2, currency: 'INR', currency_decimals: 0 })
    ).rejects.toThrow(ErrorMessage.CurrencyLocked);

    used = new Set();
    expect(
      await updateGroup({ group_id: 2, currency: 'INR', currency_decimals: 0 })
    ).toMatchObject({
      group: { currency: 'INR', currency_decimals: 0 },
      previous: { currency: 'INR', currency_decimals: 2 },
    });
  });

  test('a rename, or the same currency again, skips the lock and the check', async () => {
    used.add(2);
    await updateGroup({ group_id: 2, name: 'Goa 2026' });
    await updateGroup({ group_id: 2, currency: 'INR', currency_decimals: 2 });
    expect(sqlOf().some((sql) => sql.includes('exists'))).toBe(false);
    // Nor do they lock anything but the group's own row.
    expect(sqlOf().some((sql) => /^(lock table|set local)/.test(sql))).toBe(
      false
    );
  });

  test('returns undefined for an unknown group', async () => {
    expect(
      await updateGroup({ group_id: 99, currency: 'INR', currency_decimals: 2 })
    ).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
