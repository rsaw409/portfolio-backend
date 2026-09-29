import {
  DatabaseError,
  Model,
  QueryTypes,
  UniqueConstraintError,
} from 'sequelize';
import DB from '../../../postgres.js';
import logger from '../../../@rsaw409/logger.js';
import { ErrorMessage } from '../../../@rsaw409/constant.js';
import {
  createGroupInput,
  getGroupsPayload,
  updateGroupPayload,
  GroupSummary,
  IdempotentResult,
} from '../../../types/split.js';

const sequelize = DB.getSequelize();
const schemaname = DB.split_backend;

interface GroupWithMembers {
  group: Model;
  members: Model[];
}

/**
 * The group already created under this key, with its current members.
 * Undefined when the key is new, or when the client sent no key at all.
 */
const findExistingGroup = async (
  idempotency_key?: string
): Promise<GroupWithMembers | undefined> => {
  if (!idempotency_key) return undefined;
  const group = await sequelize.models.Group.findOne({
    where: { idempotency_key },
  });
  if (!group) return undefined;
  const members = await sequelize.models.User.findAll({
    where: { group_id: group.get('id') },
    order: [['id', 'ASC']],
  });
  return { group, members };
};

/**
 * Creates the group and its members together, so a failure never leaves a
 * group without the members the client asked for.
 */
const createGroup = async (
  payload: createGroupInput
): Promise<IdempotentResult<GroupWithMembers>> => {
  const idempotencyKey = payload.idempotency_key;
  try {
    if (!sequelize) {
      throw new Error('DB not initialized');
    }

    const result = await sequelize.transaction(async (t) => {
      const group = await sequelize.models.Group.create(
        {
          name: payload.name,
          currency: payload.currency,
          currency_decimals: payload.currency_decimals,
          idempotency_key: idempotencyKey,
        },
        { transaction: t }
      );

      const members = await sequelize.models.User.bulkCreate(
        (payload.members ?? []).map(({ name, avatar }) => {
          return { name, avatar, group_id: group.get('id') };
        }),
        { transaction: t }
      );

      return { group, members };
    });
    return { result, replayed: false };
  } catch (error) {
    // The index rejected the key, so this group already exists and our write
    // rolled back whole. Return the group that is already there.
    if (error instanceof UniqueConstraintError) {
      const winner = await findExistingGroup(idempotencyKey);
      if (winner) return { result: winner, replayed: true };
    }
    logger.error(error);
    throw error instanceof Error ? error : new Error(ErrorMessage.Unknown);
  }
};

const getGroup = async ({ group_id }: { group_id: number }) => {
  if (sequelize !== null) {
    return sequelize.models.Group.findOne({
      where: { id: group_id },
      attributes: { exclude: ['idempotency_key'] },
      raw: true,
    });
  } else {
    throw new Error('DB not initialized');
  }
};

/**
 * The current id, name, currency and currency_decimals of each listed group that exists, in
 * request order. Unknown ids are left out rather than failing the rest.
 */
const getGroups = async ({
  group_ids,
}: getGroupsPayload): Promise<GroupSummary[]> => {
  if (!sequelize) throw new Error('DB not initialized');
  if (group_ids.length === 0) return [];

  const rows = (await sequelize.models.Group.findAll({
    where: { id: group_ids },
    attributes: ['id', 'name', 'currency', 'currency_decimals'],
    raw: true,
  })) as unknown as GroupSummary[];

  const byId = new Map(rows.map((row) => [row.id, row]));
  return group_ids
    .map((id) => byId.get(id))
    .filter((row): row is GroupSummary => row !== undefined);
};

// How long a currency change may wait for writes in flight; see updateGroup.
const LOCK_TIMEOUT = '2s';

/** Postgres's lock_not_available, raised when lock_timeout expires. */
const isLockTimeout = (error: unknown) =>
  error instanceof DatabaseError &&
  (error.parent as { code?: string }).code === '55P03';

interface UpdatedGroup {
  group: GroupSummary;
  // The values just before this update, so callers can tell what changed.
  previous: { name: string; currency: string; currency_decimals: number };
}

/**
 * Changes the fields given and returns the group as it now is along with its
 * previous values, or undefined when there is no such group. A field left out
 * keeps its value.
 *
 * The currency and its decimals can only change while the group has no
 * expenses or payments: amounts are stored without either, so existing ones
 * would be relabelled or rescaled.
 * For a currency change, transactions is locked in SHARE mode before the
 * check. That waits for writes already in flight to commit, and holds new ones
 * at their INSERT until this commits, so a first expense can never slip in
 * between the check and the update. The check is its own statement so that,
 * under READ COMMITTED, it sees what committed while we waited. Every group's
 * writes pause for those few milliseconds, which only a currency change pays;
 * renames and the write paths take no extra lock.
 *
 * Postgres queues locks, so while LOCK TABLE waits behind a slow write, new
 * writes in every group queue behind it. LOCK_TIMEOUT bounds that: past it the
 * change gives up with ErrorMessage.GroupBusy and the queue drains.
 */
const updateGroup = async ({
  group_id,
  name,
  currency,
  currency_decimals,
}: updateGroupPayload): Promise<UpdatedGroup | undefined> => {
  if (!sequelize) throw new Error('DB not initialized');

  return sequelize.transaction(async (t) => {
    const [current] = (await sequelize.query(
      `select name, currency, currency_decimals from ${schemaname}.groups
where id = $group_id
for update`,
      { type: QueryTypes.SELECT, bind: { group_id }, transaction: t }
    )) as Array<{ name: string; currency: string; currency_decimals: number }>;
    if (!current) return undefined;

    // A new currency or a new scale both reinterpret stored amounts.
    const scaleChanges =
      currency !== undefined &&
      (currency !== current.currency ||
        currency_decimals !== current.currency_decimals);
    if (scaleChanges) {
      // SET LOCAL lasts until this transaction ends, and only it.
      await sequelize.query(`set local lock_timeout = '${LOCK_TIMEOUT}'`, {
        transaction: t,
      });
      try {
        await sequelize.query(
          `lock table ${schemaname}.transactions in share mode`,
          { transaction: t }
        );
      } catch (error) {
        if (isLockTimeout(error)) throw new Error(ErrorMessage.GroupBusy);
        throw error;
      }
      const [{ used }] = (await sequelize.query(
        `select exists (
  select 1 from ${schemaname}.transactions tx
  join ${schemaname}.users u on u.id = tx.by
  where u.group_id = $group_id
) as used`,
        { type: QueryTypes.SELECT, bind: { group_id }, transaction: t }
      )) as Array<{ used: boolean }>;
      if (used) throw new Error(ErrorMessage.CurrencyLocked);
    }

    const [group] = (await sequelize.query(
      `update ${schemaname}.groups
set name = coalesce($name::text, name),
    currency = coalesce($currency::text, currency),
    currency_decimals = coalesce($currency_decimals::smallint, currency_decimals),
    updated_at = now()
where id = $group_id
returning id, name, currency, currency_decimals`,
      {
        type: QueryTypes.SELECT,
        // null, not undefined: an unset bind would be left in the SQL as-is.
        bind: {
          group_id,
          name: name ?? null,
          currency: currency ?? null,
          currency_decimals: currency_decimals ?? null,
        },
        transaction: t,
      }
    )) as GroupSummary[];
    return { group, previous: current };
  });
};

// sum() over BIGINT yields NUMERIC, which node-postgres returns as a string;
// casting back keeps balances a number of minor units.
const getOverviewDataInGroup = async ({ group_id }: { group_id: number }) => {
  const query = `select A.name, A.id as user_id, A.avatar,
(coalesce(B.total_pos,0) - coalesce(C.total_neg,0)) as balances, 
coalesce(number_of_transactions, 0) as number_of_transactions, 
coalesce(number_of_payments,0) as number_of_payments,
coalesce(number_of_benefits,0) as number_of_benefits

from ${schemaname}.users A
left join 
(select by as user_id, sum(amount)::bigint as total_pos, 
count(case when category is null then by else null end) as number_of_transactions, 
count(case when category = 'payment' then by else null end) as number_of_payments 
from ${schemaname}.transactions
group by user_id) B
on A.id = B.user_id
left join
(select user_id, sum(amount)::bigint as total_neg, count(*) as number_of_benefits from ${schemaname}.transaction_parts
group by user_id) C
on A.id = C.user_id
where A.group_id = :group_id`;
  if (sequelize !== null) {
    return sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: { group_id: group_id },
    });
  } else {
    throw new Error('DB not initialized');
  }
};

export {
  getGroup,
  getGroups,
  updateGroup,
  createGroup,
  getOverviewDataInGroup,
  GroupWithMembers,
  UpdatedGroup,
};
