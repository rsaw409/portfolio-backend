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
} from './controller.js';

const addRoutes = (app: Router) => {
  app.post('/createGroup', createGroup);

  app.post('/joinGroup', joinGroup);

  app.post('/createUser', createUser);

  app.post('/saveTransaction', saveTransaction);

  app.post('/savePayment', savePayment);

  app.post('/savePayments', savePayments);

  app.post('/getAllUsersInGroup', getAllUsersInGroup);

  app.post('/getOverviewDataInGroup', getOverviewDataInGroup);

  // AllExpenses, ExpensesInvolevedAUser, ExpensesByAUser
  app.post('/getAllExpensesInGroup', getAllTransactionInGroup);
};

export { addRoutes };
