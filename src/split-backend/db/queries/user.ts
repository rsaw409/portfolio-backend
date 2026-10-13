import { Model, Op, col, fn, where } from 'sequelize';
import DB from '../../../postgres.js';
import { ErrorMessage } from '../../../@rsaw409/constant.js';
import { User, updateUserPayload } from '../../../types/split.js';

const sequelize = DB.getSequelize();

const getAllUsersInGroup = async ({ group_id }: { group_id: number }) => {
  if (!sequelize) throw new Error('DB not initialized');

  return sequelize.models.User.findAll({
    where: { group_id: group_id },
    attributes: ['id', 'group_id', 'name'],
  });
};

/**
 * Another user in the group who goes by this name, in any case: 'Rohit' and
 * 'rohit' in one group are the same person to whoever picks a payer from the
 * list. `except` leaves out the user being renamed, so they can change the
 * case of their own name.
 */
const findNamesake = ({
  group_id,
  name,
  except,
}: {
  group_id: number;
  name: string;
  except?: number;
}) =>
  sequelize.models.User.findOne({
    where: {
      group_id,
      ...(except !== undefined && { id: { [Op.ne]: except } }),
      [Op.and]: where(fn('lower', col('name')), fn('lower', name)),
    },
  });

const createUser = async (payload: User) => {
  if (!sequelize) throw new Error('DB not initialized');

  const isAlreadyExist = await findNamesake(payload);
  if (isAlreadyExist) {
    throw new Error(ErrorMessage.UserExists);
  }
  return sequelize.models.User.create({
    name: payload.name,
    avatar: payload.avatar,
    group_id: payload.group_id,
  });
};

interface UpdatedUser {
  user: Model;
  // The values just before this update, so callers can tell what changed.
  previous: { name: string; avatar: string | null };
}

/**
 * Changes the fields given and returns the user as they now are along with
 * their previous values, or undefined when there is no such user. A field left
 * out keeps its value.
 */
const updateUser = async ({
  user_id,
  name,
  avatar,
}: updateUserPayload): Promise<UpdatedUser | undefined> => {
  if (!sequelize) throw new Error('DB not initialized');

  const user = await sequelize.models.User.findByPk(user_id);
  if (!user) return undefined;
  const previous = {
    name: user.get('name') as string,
    avatar: user.get('avatar') as string | null,
  };

  if (name !== undefined) {
    const namesake = await findNamesake({
      group_id: user.get('group_id') as number,
      name,
      except: user_id,
    });
    if (namesake) throw new Error(ErrorMessage.UserExists);
  }
  // Writes only what differs, and nothing at all when the values are unchanged.
  await user.update({
    ...(name !== undefined && { name }),
    ...(avatar !== undefined && { avatar }),
  });
  return { user, previous };
};

export { getAllUsersInGroup, createUser, updateUser, UpdatedUser };
