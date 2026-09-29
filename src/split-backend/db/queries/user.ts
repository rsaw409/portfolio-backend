import DB from '../../../postgres.js';
import { User } from '../../../types/split.js';

const sequelize = DB.getSequelize();

const getAllUsersInGroup = async ({ group_id }: { group_id: number }) => {
  if (!sequelize) throw new Error('DB not initialized');

  return sequelize.models.User.findAll({
    where: { group_id: group_id },
    attributes: ['id', 'group_id', 'name'],
  });
};

const createUser = async (payload: User) => {
  if (!sequelize) throw new Error('DB not initialized');

  const isAlreadyExist = await sequelize.models.User.findOne({
    where: { name: payload.name, group_id: payload.group_id },
  });
  if (isAlreadyExist) {
    throw new Error('User Already Exists');
  }
  return sequelize.models.User.create({
    name: payload.name,
    avatar: payload.avatar,
    group_id: payload.group_id,
  });
};

export { getAllUsersInGroup, createUser };
