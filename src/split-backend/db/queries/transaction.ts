import logger from '../../../@rsaw409/logger.js';
import { ErrorMessage } from '../../../@rsaw409/constant.js';
import DB from '../../../postgres.js';
import { Model, QueryTypes, UniqueConstraintError } from 'sequelize';
import {
  getAllTransactionInGroupPayload,
  IdempotentBatchResult,
  IdempotentResult,
  savePaymentPayload,
  saveTransactionPayload,
} from '../../../types/split.js';

const sequelize = DB.getSequelize();
const schemaname = DB.split_backend;

/**
 * The transaction already written under this key, if there is one. Undefined
 * when the key is new, or when the client sent no key at all.
 */
const findExistingTransaction = async (
  idempotency_key?: string
): Promise<Model | undefined> => {
  if (!idempotency_key) return undefined;
  const row = await sequelize.models.Transaction.findOne({
    where: { idempotency_key },
  });
  return row ?? undefined;
};

const saveTransaction = async (
  payload: saveTransactionPayload
): Promise<IdempotentResult<Model>> => {
  const idempotencyKey = payload.idempotency_key;
  try {
    if (!sequelize) {
      throw new Error('DB not initialized');
    }

    const result = await sequelize.transaction(async (t) => {
      const transaction = await sequelize.models.Transaction.create(
        {
          by: payload.by,
          title: payload.title,
          amount: payload.totalAmount,
          idempotency_key: idempotencyKey,
        },
        { transaction: t }
      );

      const transaction_parts = payload.transactionParts.map((e: any) => {
        return {
          ...e,
          transaction_id: transaction.dataValues.id,
        };
      });

      await sequelize.models.TransactionPart.bulkCreate(transaction_parts, {
        transaction: t,
      });

      return transaction;
    });
    return { result, replayed: false };
  } catch (error) {
    // The index rejected the key, so this expense is already recorded and our
    // write rolled back whole. Return the row that is already there.
    if (error instanceof UniqueConstraintError) {
      const winner = await findExistingTransaction(idempotencyKey);
      if (winner) return { result: winner, replayed: true };
    }
    logger.error(error);
    throw error instanceof Error ? error : new Error(ErrorMessage.Unknown);
  }
};

/**
 * Writes one payment, or returns the payment already written under its key.
 * Its own transaction, so a conflict rolls back only this payment.
 */
const writePayment = async (
  payment: savePaymentPayload
): Promise<IdempotentResult<Model>> => {
  const idempotencyKey = payment.idempotency_key;
  try {
    const result = await sequelize.transaction(async (t) => {
      const transaction = await sequelize.models.Transaction.create(
        {
          by: payment.from,
          title: 'payment',
          amount: payment.amount,
          category: 'payment',
          idempotency_key: idempotencyKey,
        },
        { transaction: t }
      );

      await sequelize.models.TransactionPart.create(
        {
          user_id: payment.to,
          amount: payment.amount,
          transaction_id: transaction.dataValues.id,
        },
        { transaction: t }
      );
      return transaction;
    });
    return { result, replayed: false };
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const winner = await findExistingTransaction(idempotencyKey);
      if (winner) return { result: winner, replayed: true };
    }
    throw error;
  }
};

const savePayment = async (
  payload: savePaymentPayload
): Promise<IdempotentResult<Model>> => {
  try {
    if (!sequelize) {
      throw new Error('DB not initialized');
    }
    return await writePayment(payload);
  } catch (error) {
    logger.error(error);
    throw error instanceof Error ? error : new Error(ErrorMessage.Unknown);
  }
};

/**
 * Each payment is saved on its own and is idempotent on its own key, so a
 * batch repeating an earlier one writes only what is new.
 *
 * The batch is therefore not atomic: if a payment fails for a reason other
 * than its key, the ones before it stay committed. The keys are what make that
 * safe — retrying the same batch replays those and writes the rest — so the
 * client must keep its keys until the call succeeds.
 */
const savePayments = async (
  payments: Array<savePaymentPayload>
): Promise<IdempotentBatchResult<Model[]>> => {
  try {
    if (!sequelize) {
      throw new Error('DB not initialized');
    }

    const result: Model[] = [];
    const written: boolean[] = [];

    for (const payment of payments) {
      const saved = await writePayment(payment);
      result.push(saved.result);
      written.push(!saved.replayed);
    }

    return { result, written };
  } catch (error) {
    logger.error(error);
    throw error instanceof Error ? error : new Error(ErrorMessage.Unknown);
  }
};

const getAllTransactionInGroup = async ({
  group_id,
  by,
  user_id,
  payments,
}: getAllTransactionInGroupPayload) => {
  if (!sequelize) {
    throw new Error('DB not initialized');
  }

  const query =
    (user_id ? `select * from( ` : ` `) +
    `select group_id, group_name, user_id, user_name, transaction_id, transaction_title, transaction_amount, transaction_date, transaction_category,
  jsonb_agg(jsonb_build_object('user_name' , distribution_name, 'user_id' , distribution_user_id, 'amount', distrubution_amount)) as distributions
  from (
  select 
  E.id as group_id, E.name as group_name,
  D.id as user_id, D.name as user_name,
  B.id as transaction_id, B.title as transaction_title, B.amount as transaction_amount, B.created_at as transaction_date, B.category as transaction_category,
  A.amount as distrubution_amount,
  A.user_id as distribution_user_id,
  C.name as distribution_name from
    
  ${schemaname}.transaction_parts A 
  join ${schemaname}.transactions B 
  on A.transaction_id = B.id
  
  join ${schemaname}.users C
  on A.user_id = C.id
  
  join ${schemaname}.users D
  on B.by = D.id
  
  join ${schemaname}.groups E
  on C.group_id = E.id
  
  where E.id = :group_id` +
    (by ? ` and B.by = :by ` : ` `) +
    // undefined means no filter at all, so an absent field no longer falls
    // through to the expenses-only branch.
    (payments === undefined
      ? ``
      : payments
        ? `and B.category = 'payment'`
        : `and B.category is null`) +
    `) F
  group by 1,2,3,4,5,6,7,8,9` +
    (user_id
      ? `) G where 
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(distributions) elem
      WHERE elem->>'user_id' = :user_id
  )`
      : ` `) +
    ` order by transaction_date desc `;

  return sequelize.query(query, {
    type: QueryTypes.SELECT,
    replacements: { group_id: group_id, by: by, user_id: `${user_id}` },
  });
};

export { saveTransaction, savePayment, getAllTransactionInGroup, savePayments };
