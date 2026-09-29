interface GroupMember {
  name: string;
  // Seed the app renders the avatar from.
  avatar?: string;
}

interface createGroupPayload {
  name: string;
  // ISO 4217; defaults to INR.
  currency?: string;
  // Decimals of the currency's minor unit (2 for INR): the scale of amounts.
  currency_decimals: number;
  // The users to create in the group along with it. Plain names are what app
  // versions from before avatars send; the validator turns them into objects.
  members?: Array<string | GroupMember>;
  idempotency_key?: string;
}

// createGroupPayload as the validator returns it.
interface createGroupInput extends Omit<createGroupPayload, 'members'> {
  members?: GroupMember[];
}

interface joinGroupPayload {
  invite_id: string;
}

interface createUserPayload {
  group_id: number;
  name: string;
  avatar?: string;
}

interface saveTransactionPayload {
  // All amounts are whole minor units of the group's currency (paise for INR).
  totalAmount: number;
  title: string;
  by: number;
  transactionParts: Array<{ user_id: number; amount: number }>;
  idempotency_key?: string;
}

interface savePaymentPayload {
  // In the group currency's minor unit.
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

interface getGroupsPayload {
  group_ids: number[];
}

interface updateGroupPayload {
  group_id: number;
  // Each is optional; only the fields sent are changed.
  name?: string;
  // currency_decimals is sent exactly when currency is.
  currency?: string;
  currency_decimals?: number;
}

interface GroupSummary {
  id: number;
  name: string;
  currency: string;
  // Decimals of the currency's minor unit: the scale of the group's amounts.
  currency_decimals: number;
}

interface User {
  name: string;
  group_id: number;
  avatar?: string;
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
  GroupMember,
  createGroupPayload,
  createGroupInput,
  joinGroupPayload,
  createUserPayload,
  saveTransactionPayload,
  savePaymentPayload,
  getAllTransactionInGroupPayload,
  registerDevicePayload,
  getGroupsPayload,
  updateGroupPayload,
  GroupSummary,
  User,
  IdempotentResult,
  IdempotentBatchResult,
};
