import { Router } from 'express';
import {
  joinGroup,
  createGroup,
  createUser,
  saveTransaction,
  savePayment,
  getAllUsersInGroup,
  getAllTransactionInGroup,
  getOverviewDataInGroup,
  savePayments,
  registerDevice,
  getGroups,
  updateGroup,
} from './controller.js';

const addRoutes = (app: Router) => {
  app.post('/createGroup', createGroup);

  app.post('/joinGroup', joinGroup);

  // Current details of the groups a device knows, e.g. after a rename.
  app.post('/getGroups', getGroups);

  app.post('/updateGroup', updateGroup);

  app.post('/createUser', createUser);

  // Which groups a device's notifications come from.
  app.post('/registerDevice', registerDevice);

  app.post('/saveTransaction', saveTransaction);

  app.post('/savePayment', savePayment);

  app.post('/savePayments', savePayments);

  app.post('/getAllUsersInGroup', getAllUsersInGroup);

  app.post('/getOverviewDataInGroup', getOverviewDataInGroup);

  // AllExpenses, ExpensesInvolevedAUser, ExpensesByAUser
  app.post('/getAllExpensesInGroup', getAllTransactionInGroup);
};

export { addRoutes };
