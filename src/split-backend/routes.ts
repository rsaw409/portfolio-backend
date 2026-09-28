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
} from './controller.js';

const addRoutes = (app: Router) => {
  app.post('/createGroup', createGroup);

  app.post('/joinGroup', joinGroup);

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
