interface createGroupPayload {
  name: string;
  // ISO 4217; defaults to INR.
  currency?: string;
  // Names of the users to create in the group along with it.
  members?: string[];
  idempotency_key?: string;
}

interface joinGroupPayload {
  invite_id: string;
}

interface createUserPayload {
  group_id: number;
  name: string;
}

interface saveTransactionPayload {
  // All amounts are whole paise.
  totalAmount: number;
  title: string;
  by: number;
  transactionParts: Array<{ user_id: number; amount: number }>;
  idempotency_key?: string;
}

interface savePaymentPayload {
  // In paise.
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

interface registerDevicePayload {
  // OneSignal subscription id: one per app install.
  subscription_id: string;
  // Every group the device follows; groups left out are unregistered.
  group_ids: number[];
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
  registerDevicePayload,
  User,
  IdempotentResult,
  IdempotentBatchResult,
};
