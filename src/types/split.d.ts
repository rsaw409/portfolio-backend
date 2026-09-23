interface createGroupPayload {
  name: string;
}

interface joinGroupPayload {
  invite_id: string;
}

interface createUserPayload {
  group_id: number;
  name: string;
}

interface saveTransactionPayload {
  groupName?: string;
  totalAmount: number;
  title: string;
  by: number;
  transactionParts: Array<{ user_id: number; amount: number }>;
  idempotency_key?: string;
}

interface savePaymentPayload {
  groupName?: string;
  amount: number;
  from: number;
  to: number;
  idempotency_key?: string;
}

interface getAllTransactionInGroupPayload {
  group_id: number;
  by?: number;
  user_id?: number;
  // true: payments only, false: expenses only, undefined: no filter.
  payments?: boolean;
}

interface User {
  name: string;
  group_id: number;
}

interface IdempotentResult<T> {
  result: T;
  // True when the key had already been used, so the existing row was returned
  // and nothing new was written.
  replayed: boolean;
}

interface IdempotentBatchResult<T> {
  result: T;
  // Parallel to the request: true where this call wrote the entry, false where
  // it already existed under that key and is being returned as-is.
  written: boolean[];
}

export {
  createGroupPayload,
  joinGroupPayload,
  createUserPayload,
  saveTransactionPayload,
  savePaymentPayload,
  getAllTransactionInGroupPayload,
  User,
  IdempotentResult,
  IdempotentBatchResult,
};
