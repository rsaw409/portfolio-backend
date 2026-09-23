import { Request, Response } from 'express';
import logger from '../@rsaw409/logger.js';
import {
  createGroup as createGroupInDB,
  getGroup as getGroupInDB,
  getOverviewDataInGroup as getOverviewDataInGroupFromDb,
} from './db/queries/group.js';
import {
  saveTransaction as saveTransactionInDB,
  savePayment as savePaymentInDB,
  savePayments as savePaymentsInDB,
  getAllTransactionInGroup as getAllTransactionInGroupFromDB,
} from './db/queries/transaction.js';
import {
  createUser as createUserInDB,
  getAllUsersInGroup as getAllUsersInGroupFromDB,
} from './db/queries/user.js';
import crypto from '../@rsaw409/crypto.js';
import { send_push_notification } from './utils/send_notification.js';
import {
  parse,
  createGroupSchema,
  joinGroupSchema,
  createUserSchema,
  groupSchema,
  saveTransactionSchema,
  savePaymentSchema,
  savePaymentsSchema,
  getAllTransactionInGroupSchema,
} from './utils/validator.js';
import {
  createGroupPayload,
  createUserPayload,
  getAllTransactionInGroupPayload,
  joinGroupPayload,
  savePaymentPayload,
  saveTransactionPayload,
} from '../types/split.js';

import { ErrorMessage } from '../@rsaw409/constant.js';

const createGroup = async (
  req: Request<{}, {}, createGroupPayload>,
  res: Response
) => {
  try {
    const response: any = await createGroupInDB(
      parse(createGroupSchema, req.body)
    );
    const inviteId = crypto.encrypt(`${response.id}`);
    return res.status(200).send({ ...response.dataValues, inviteId });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const joinGroup = async (
  req: Request<{}, {}, joinGroupPayload>,
  res: Response
) => {
  try {
    const { invite_id } = parse(joinGroupSchema, req.body);

    const group_id: number = crypto.decrypt(invite_id) as unknown as number;

    const response: any = await getGroupInDB({ group_id: group_id });

    if (response == null) {
      throw new Error('No Group Found');
    }

    const inviteId = crypto.encrypt(`${response.id}`);

    return res.status(200).send({ ...response, inviteId });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const createUser = async (
  req: Request<{}, {}, createUserPayload>,
  res: Response
) => {
  try {
    const response = await createUserInDB(parse(createUserSchema, req.body));
    return res.status(200).send(response);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};
const saveTransaction = async (
  req: Request<{}, {}, saveTransactionPayload>,
  res: Response
) => {
  try {
    const payload = parse(saveTransactionSchema, req.body);
    const { result, replayed } = await saveTransactionInDB(payload);
    // A replay wrote nothing, so notifying again would announce an expense
    // that does not exist.
    if (!replayed) {
      send_push_notification({
        groupName: payload.groupName,
        headings: 'New Expense',
        title: payload.title,
      });
    }
    return res.status(200).send(result);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const savePayment = async (
  req: Request<{}, {}, savePaymentPayload>,
  res: Response
) => {
  try {
    const payload = parse(savePaymentSchema, req.body);
    const { result, replayed } = await savePaymentInDB(payload);
    if (!replayed) {
      send_push_notification({
        groupName: payload.groupName,
        headings: 'New Payment',
        title: `INR ${payload.amount}`,
      });
    }
    return res.status(200).send(result);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const savePayments = async (
  req: Request<{}, {}, Array<savePaymentPayload>>,
  res: Response
) => {
  try {
    const payments = parse(savePaymentsSchema, req.body);
    const { result, written } = await savePaymentsInDB(payments);

    // Only the payments this call actually wrote; the rest already notified
    // when they were first written.
    payments.forEach((e, index) => {
      if (written[index]) {
        send_push_notification({
          groupName: e.groupName,
          headings: 'New Payment',
          title: `INR ${e.amount}`,
        });
      }
    });
    return res.status(200).send(result);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getAllUsersInGroup = async (
  req: Request<{}, {}, { group_id: number }>,
  res: Response
) => {
  try {
    const response = await getAllUsersInGroupFromDB(
      parse(groupSchema, req.body)
    );
    return res.status(200).send(response);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getAllTransactionInGroup = async (
  req: Request<{}, {}, getAllTransactionInGroupPayload>,
  res: Response
) => {
  try {
    const response = await getAllTransactionInGroupFromDB(
      parse(getAllTransactionInGroupSchema, req.body)
    );
    return res.status(200).send(response);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getOverviewDataInGroup = async (
  req: Request<{}, {}, { group_id: number }>,
  res: Response
) => {
  try {
    const response = await getOverviewDataInGroupFromDb(
      parse(groupSchema, req.body)
    );
    return res.status(200).send(response);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

export {
  joinGroup,
  createGroup,
  createUser,
  saveTransaction,
  savePayment,
  getAllUsersInGroup,
  getAllTransactionInGroup,
  getOverviewDataInGroup,
  savePayments,
};
