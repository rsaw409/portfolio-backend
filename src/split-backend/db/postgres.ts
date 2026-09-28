import { Sequelize } from 'sequelize';
import logger from '../../@rsaw409/logger.js';

import createGroupModel from './models/group.js';
import createUserModel from './models/user.js';
import createTransactionModel from './models/transaction.js';
import createTransactionPartModel from './models/transactionPart.js';
import createDeviceGroupModel from './models/deviceGroup.js';

const initializeDB = async (sequelize: Sequelize, schemaname: string) => {
  try {
    createGroupModel(sequelize, schemaname);
    createUserModel(sequelize, schemaname);
    createTransactionModel(sequelize, schemaname);
    createTransactionPartModel(sequelize, schemaname);
    createDeviceGroupModel(sequelize, schemaname);
  } catch (error) {
    logger.error('Unable to connect to the database:');
    logger.error(error);
  }
};
export default initializeDB;
