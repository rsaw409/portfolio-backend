import { vi, describe, test, expect, beforeEach } from 'vitest';

let sqlRows: Array<Record<string, any>> = [];

const query = vi.fn(async (_sql: string, _options: any) => sqlRows);

vi.mock('../../../../../src/postgres.js', () => {
  return {
    default: {
      getSequelize: vi.fn(() => {
        return { query };
      }),
      split_backend: 'split_backend',
      portfolio_backend: 'portfolio_backend',
    },
  };
});

const { registerDevice, getNotificationTarget } =
  await import('../../../../../src/split-backend/db/queries/device.js');

// The statement's behaviour (replace semantics, skipping unknown groups, no
// write on an unchanged launch) needs a real Postgres; these check the call.
describe('TEST registerDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('is a single bound statement', async () => {
    sqlRows = [];
    await registerDevice({ subscription_id: 'dev-a', group_ids: [3, 1] });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, options] = query.mock.calls[0];
    expect(options.bind).toEqual({
      subscription_id: 'dev-a',
      group_ids: [3, 1],
    });
    expect(sql).toContain('split_backend.device_groups');
    expect(sql).toContain('on conflict (subscription_id, group_id)');
    // Values are bound, never interpolated into the SQL.
    expect(sql).not.toContain('dev-a');
  });

  test('returns the registered group ids in the order the rows came back', async () => {
    sqlRows = [{ group_id: 3 }, { group_id: 1 }];
    expect(
      await registerDevice({ subscription_id: 'dev-a', group_ids: [3, 99, 1] })
    ).toEqual([3, 1]);
  });

  test('passes an empty list through, which unregisters the device', async () => {
    sqlRows = [];
    expect(
      await registerDevice({ subscription_id: 'dev-a', group_ids: [] })
    ).toEqual([]);
    expect(query.mock.calls[0][1].bind.group_ids).toEqual([]);
  });
});

describe('TEST getNotificationTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the user's group name and its devices", async () => {
    sqlRows = [
      { group_name: 'Manali Trip', subscription_id: 'sub-1' },
      { group_name: 'Manali Trip', subscription_id: 'sub-2' },
    ];
    expect(await getNotificationTarget({ user_id: 5 })).toEqual({
      group_name: 'Manali Trip',
      subscription_ids: ['sub-1', 'sub-2'],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('split_backend.device_groups'),
      expect.objectContaining({ replacements: { user_id: 5 } })
    );
  });

  test('a group with no devices has no subscription ids', async () => {
    sqlRows = [{ group_name: 'Quiet Group', subscription_id: null }];
    expect(await getNotificationTarget({ user_id: 5 })).toEqual({
      group_name: 'Quiet Group',
      subscription_ids: [],
    });
  });

  test('an unknown user has no target', async () => {
    sqlRows = [];
    expect(await getNotificationTarget({ user_id: 404 })).toBeUndefined();
  });
});
