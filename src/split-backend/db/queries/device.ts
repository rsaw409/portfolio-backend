import { QueryTypes } from 'sequelize';
import DB from '../../../postgres.js';
import { registerDevicePayload } from '../../../types/split.js';

const sequelize = DB.getSequelize();
const schemaname = DB.split_backend;

/**
 * Makes `group_ids` the complete set of groups this device follows: new pairs
 * are added and groups missing from the list are dropped, so leaving a group
 * needs no separate call and an empty list unregisters the device. Ids of
 * groups that do not exist are skipped rather than failing the rest; the ids
 * actually registered are returned, in request order.
 *
 * The app calls this on every launch, so it is one statement (one round trip,
 * atomic without a transaction), and a launch that changes nothing writes
 * nothing: updated_at is refreshed at most once a day, which keeps it good
 * enough to spot devices that stopped checking in without a write per launch.
 * The WITH parts run even though only `wanted` is selected from.
 */
const registerDevice = async ({
  subscription_id,
  group_ids,
}: registerDevicePayload): Promise<number[]> => {
  if (!sequelize) throw new Error('DB not initialized');

  const rows: Array<{ group_id: number }> = await sequelize.query(
    `with wanted as (
  select g.id as group_id, r.ord
  from unnest($group_ids::int[]) with ordinality as r(id, ord)
  join ${schemaname}.groups g on g.id = r.id
),
removed as (
  delete from ${schemaname}.device_groups d
  where d.subscription_id = $subscription_id
    and d.group_id not in (select group_id from wanted)
),
upserted as (
  insert into ${schemaname}.device_groups (subscription_id, group_id, updated_at)
  select $subscription_id::text, group_id, now() from wanted
  on conflict (subscription_id, group_id) do update
    set updated_at = excluded.updated_at
    where device_groups.updated_at < excluded.updated_at - interval '1 day'
)
select group_id from wanted order by ord`,
    {
      type: QueryTypes.SELECT,
      // Bound, not interpolated: pg sends the JS array as an int[] ('{}' when
      // empty), which replacements cannot express for an empty list.
      bind: { subscription_id, group_ids },
    }
  );
  return rows.map((row) => row.group_id);
};

interface NotificationTarget {
  group_name: string;
  // The group's ISO 4217 code and its stored scale, for formatting amounts.
  currency: string;
  currency_decimals: number;
  subscription_ids: string[];
}

/**
 * The group to notify, and every device following it: either the group of
 * `user_id` (the user who made a change) or `group_id` itself. Undefined when
 * there is no such user or group. The name comes from the database, never the
 * request, so a rename is reflected straight away.
 */
const getNotificationTarget = async (
  by: { user_id: number } | { group_id: number }
): Promise<NotificationTarget | undefined> => {
  if (!sequelize) throw new Error('DB not initialized');

  // Either way: the group, then its devices (none gives one row of NULL).
  const sql =
    'user_id' in by
      ? `select g.name as group_name, g.currency, g.currency_decimals, d.subscription_id
from ${schemaname}.users u
join ${schemaname}.groups g on g.id = u.group_id
left join ${schemaname}.device_groups d on d.group_id = g.id
where u.id = :id`
      : `select g.name as group_name, g.currency, g.currency_decimals, d.subscription_id
from ${schemaname}.groups g
left join ${schemaname}.device_groups d on d.group_id = g.id
where g.id = :id`;
  const id = 'user_id' in by ? by.user_id : by.group_id;

  const rows: Array<{
    group_name: string;
    currency: string;
    currency_decimals: number;
    subscription_id: string | null;
  }> = await sequelize.query(sql, {
    type: QueryTypes.SELECT,
    replacements: { id },
  });

  if (rows.length === 0) return undefined;
  return {
    group_name: rows[0].group_name,
    currency: rows[0].currency,
    currency_decimals: rows[0].currency_decimals,
    subscription_ids: rows
      .map((row) => row.subscription_id)
      .filter((id): id is string => id !== null),
  };
};

export { registerDevice, getNotificationTarget, NotificationTarget };
