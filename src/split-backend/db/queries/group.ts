import { Model, QueryTypes, UniqueConstraintError } from 'sequelize';
import DB from '../../../postgres.js';
import logger from '../../../@rsaw409/logger.js';
import { ErrorMessage } from '../../../@rsaw409/constant.js';
import { createGroupPayload, IdempotentResult } from '../../../types/split.js';

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
  payload: createGroupPayload
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
          idempotency_key: idempotencyKey,
        },
        { transaction: t }
      );

      const members = await sequelize.models.User.bulkCreate(
        (payload.members ?? []).map((name) => {
          return { name, group_id: group.get('id') };
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

// sum() over BIGINT yields NUMERIC, which node-postgres returns as a string;
// casting back keeps balances a number of paise.
const getOverviewDataInGroup = async ({ group_id }: { group_id: number }) => {
  const query = `select A.name, A.id as user_id, 
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

export { getGroup, createGroup, getOverviewDataInGroup, GroupWithMembers };
