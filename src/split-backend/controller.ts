import { Request, Response } from 'express';
import logger from '../@rsaw409/logger.js';
import {
  createGroup as createGroupInDB,
  getGroup as getGroupInDB,
  getGroups as getGroupsInDB,
  updateGroup as updateGroupInDB,
  getOverviewDataInGroup as getOverviewDataInGroupFromDb,
  UpdatedGroup,
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
import { registerDevice as registerDeviceInDB } from './db/queries/device.js';
import crypto from '../@rsaw409/crypto.js';
import { send_push_notification } from './utils/send_notification.js';
import { formatAmount } from './utils/format_amount.js';
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
  registerDeviceSchema,
  getGroupsSchema,
  updateGroupSchema,
} from './utils/validator.js';
import {
  createGroupPayload,
  createUserPayload,
  getAllTransactionInGroupPayload,
  getGroupsPayload,
  GroupSummary,
  updateGroupPayload,
  joinGroupPayload,
  registerDevicePayload,
  savePaymentPayload,
  saveTransactionPayload,
} from '../types/split.js';

import { ErrorMessage } from '../@rsaw409/constant.js';

const createGroup = async (
  req: Request<{}, {}, createGroupPayload>,
  res: Response
) => {
  try {
    // A replay returns the same body as the original call.
    const { result } = await createGroupInDB(
      parse(createGroupSchema, req.body)
    );
    const { group, members } = result;
    return res.status(200).send({
      id: group.get('id'),
      name: group.get('name'),
      inviteId: crypto.encryptDeterministic(`${group.get('id')}`),
      currency: group.get('currency'),
      currency_decimals: group.get('currency_decimals'),
      icon: group.get('icon') ?? null,
      icon_color: group.get('icon_color') ?? null,
      members: members.map((member) => {
        return {
          user_id: member.get('id'),
          name: member.get('name'),
          avatar: member.get('avatar') ?? null,
        };
      }),
    });
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

    const inviteId = crypto.encryptDeterministic(`${response.id}`);

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

/** A group as getGroups and updateGroup return it. */
const groupResponse = ({
  id,
  name,
  currency,
  currency_decimals,
  icon,
  icon_color,
}: GroupSummary) => {
  return {
    id,
    name,
    inviteId: crypto.encryptDeterministic(`${id}`),
    currency,
    currency_decimals,
    icon,
    icon_color,
  };
};

/**
 * How members' apps pick up changes to their groups, such as a rename: the
 * current details of each listed group, leaving out ids that do not exist.
 */
const getGroups = async (
  req: Request<{}, {}, getGroupsPayload>,
  res: Response
) => {
  try {
    const groups = await getGroupsInDB(parse(getGroupsSchema, req.body));
    return res.status(200).send(groups.map(groupResponse));
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

/**
 * The push text for a group update, or undefined when neither the name nor
 * the currency changed. An icon change alone is not pushed: apps pick it up
 * through getGroups at their next launch.
 */
const groupUpdateNotification = ({ group, previous }: UpdatedGroup) => {
  const renamed = group.name !== previous.name;
  const currencyChanged =
    group.currency !== previous.currency ||
    group.currency_decimals !== previous.currency_decimals;
  if (!renamed && !currencyChanged) return undefined;

  const changes = [
    ...(renamed ? [`"${previous.name}" is now "${group.name}"`] : []),
    ...(currencyChanged ? [`Currency is now ${group.currency}`] : []),
  ];
  return {
    headings: renamed && !currencyChanged ? 'Group Renamed' : 'Group Updated',
    title: changes.join('. '),
  };
};

/**
 * Renames a group or changes its currency or icon, and tells the group's
 * devices when the name or currency actually changed. Their apps pick the new
 * details up through getGroups.
 */
const updateGroup = async (
  req: Request<{}, {}, updateGroupPayload>,
  res: Response
) => {
  try {
    const updated = await updateGroupInDB(parse(updateGroupSchema, req.body));
    if (!updated) {
      throw new Error(ErrorMessage.GroupNotFound);
    }
    const { group } = updated;

    const notification = groupUpdateNotification(updated);
    if (notification) {
      send_push_notification({
        group_id: group.id,
        // The whole heading: '... in <new name>' would read oddly for a rename.
        headings: () => notification.headings,
        title: notification.title,
      });
    }

    return res.status(200).send(groupResponse(group));
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
        user_id: payload.by,
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
        user_id: payload.from,
        headings: 'New Payment',
        title: ({ currency, currency_decimals }) =>
          formatAmount(payload.amount, currency, currency_decimals),
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
          user_id: e.from,
          headings: 'New Payment',
          title: ({ currency, currency_decimals }) =>
            formatAmount(e.amount, currency, currency_decimals),
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

const registerDevice = async (
  req: Request<{}, {}, registerDevicePayload>,
  res: Response
) => {
  try {
    const { subscription_id, group_ids } = parse(
      registerDeviceSchema,
      req.body
    );
    const registered = await registerDeviceInDB({ subscription_id, group_ids });
    return res.status(200).send({ subscription_id, group_ids: registered });
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
  registerDevice,
  getGroups,
  updateGroup,
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
