import { vi, describe, test, beforeEach, expect, Mock } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../../../src/split-backend/db/queries/group.js', () => {
  return {
    createGroup: vi.fn(),
    getGroup: vi.fn(),
    getGroups: vi.fn(),
    updateGroup: vi.fn(),
    getOverviewDataInGroup: vi.fn(),
  };
});

vi.mock('../../../src/split-backend/db/queries/user.js', () => {
  return {
    createUser: vi.fn(),
    getAllUsersInGroup: vi.fn(),
  };
});

vi.mock('../../../src/split-backend/db/queries/transaction.js', () => {
  return {
    saveTransaction: vi.fn(),
    savePayment: vi.fn(),
    savePayments: vi.fn(),
    getAllTransactionInGroup: vi.fn(),
  };
});

vi.mock('../../../src/split-backend/db/queries/device.js', () => {
  return {
    registerDevice: vi.fn(),
  };
});

vi.mock('../../../src/@rsaw409/crypto.js', () => {
  return {
    default: {
      encryptDeterministic: vi.fn(),
      decrypt: vi.fn(),
    },
  };
});

vi.mock('../../../src/split-backend/utils/send_notification.js', () => {
  return {
    send_push_notification: vi.fn(),
  };
});

const {
  createGroup: createGroupInDB,
  getGroup: getGroupInDB,
  getGroups: getGroupsInDB,
  updateGroup: updateGroupInDB,
  getOverviewDataInGroup: getOverviewDataInGroupFromDb,
} = await import('../../../src/split-backend/db/queries/group.js');

const {
  createUser: createUserInDB,
  getAllUsersInGroup: getAllUsersInGroupFromDB,
} = await import('../../../src/split-backend/db/queries/user.js');

const {
  getAllTransactionInGroup: getAllTransactionInGroupFromDB,
  savePayment: savePaymentInDB,
  savePayments: savePaymentsInDB,
  saveTransaction: saveTransactionInDB,
} = await import('../../../src/split-backend/db/queries/transaction.js');

const { registerDevice: registerDeviceInDB } =
  await import('../../../src/split-backend/db/queries/device.js');

const { default: crypto } = await import('../../../src/@rsaw409/crypto.js');
const { ErrorMessage } = await import('../../../src/@rsaw409/constant.js');
const { send_push_notification } =
  await import('../../../src/split-backend/utils/send_notification.js');

const {
  createGroup,
  joinGroup,
  createUser,
  getAllUsersInGroup,
  getAllTransactionInGroup,
  getOverviewDataInGroup,
  savePayment,
  savePayments,
  saveTransaction,
  registerDevice,
  getGroups,
  updateGroup,
} = await import('../../../src/split-backend/controller.js');

/** A stand-in for a Sequelize model instance. */
const row = (values: Record<string, any>) => {
  return { get: (key: string) => values[key] };
};

describe('Testing Controllers', () => {
  let res = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as any as Response;

  beforeEach(() => {
    vi.resetAllMocks();
    res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any as Response;
  });

  test('createGroup should throw error if name is not in payload', async () => {
    let req = {
      body: {},
    } as any as Request;
    await createGroup(req, res);
    expect(createGroupInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('name') })
    );
  });

  test('createGroup should create group', async () => {
    let req = {
      body: {
        name: 'test-group',
        currency_decimals: 2,
      },
    } as any as Request;
    (createGroupInDB as Mock).mockImplementation(() => {
      return {
        result: {
          group: row({
            id: 1,
            name: 'test-group',
            currency: 'INR',
            currency_decimals: 2,
          }),
          members: [],
        },
        replayed: false,
      };
    });
    await createGroup(req, res);
    // Without currency or members: an INR group with no members.
    expect(createGroupInDB).toHaveBeenCalledWith({
      name: 'test-group',
      currency: 'INR',
      currency_decimals: 2,
      members: [],
    });
    expect(crypto.encryptDeterministic).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  test('createGroup requires currency_decimals', async () => {
    let req = { body: { name: 'test-group' } } as any as Request;
    await createGroup(req, res);
    expect(createGroupInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: 'currency_decimals: is required',
    });
  });

  test('createGroup returns the group with its members', async () => {
    let req = {
      body: {
        name: 'Manali Trip',
        currency: 'inr',
        currency_decimals: 2,
        members: ['Rohit', ' Priya '],
        idempotency_key: 'k1',
      },
    } as any as Request;
    (createGroupInDB as Mock).mockResolvedValue({
      result: {
        group: row({
          id: 42,
          name: 'Manali Trip',
          currency: 'INR',
          currency_decimals: 2,
        }),
        members: [
          row({ id: 101, name: 'Rohit', group_id: 42 }),
          row({ id: 102, name: 'Priya', group_id: 42 }),
        ],
      },
      replayed: true,
    });
    (crypto.encryptDeterministic as Mock).mockReturnValue('enc-42');
    await createGroup(req, res);
    expect(createGroupInDB).toHaveBeenCalledWith({
      name: 'Manali Trip',
      currency: 'INR',
      currency_decimals: 2,
      members: ['Rohit', 'Priya'],
      idempotency_key: 'k1',
    });
    expect(crypto.encryptDeterministic).toHaveBeenCalledWith('42');
    // A replay answers exactly as the original call did.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      id: 42,
      name: 'Manali Trip',
      inviteId: 'enc-42',
      currency: 'INR',
      currency_decimals: 2,
      members: [
        { user_id: 101, name: 'Rohit' },
        { user_id: 102, name: 'Priya' },
      ],
    });
  });

  test('joinGroup should throw error if payload in invalid', async () => {
    let req = {
      body: {},
    } as any as Request;
    await joinGroup(req, res);
    expect(getGroupInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('invite_id') })
    );
  });

  test('joinGroup should throw error if group not found', async () => {
    let req = {
      body: {
        invite_id: '123',
      },
    } as any as Request;
    (crypto.decrypt as Mock).mockImplementation(() => 1);
    (getGroupInDB as Mock).mockImplementation(() => null);
    await joinGroup(req, res);
    expect(getGroupInDB).toHaveBeenCalledWith({ group_id: 1 });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No Group Found' })
    );
  });

  test('joinGroup should return success', async () => {
    let req = {
      body: {
        invite_id: '123',
      },
    } as any as Request;
    (crypto.decrypt as Mock).mockImplementation(() => 1);
    (getGroupInDB as Mock).mockImplementation(() => {
      return {
        id: 1,
      };
    });
    await joinGroup(req, res);
    expect(getGroupInDB).toHaveBeenCalledWith({ group_id: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  test('createUser should throw error for invalid payload', async () => {
    let req = {
      body: {},
    } as any as Request;
    await createUser(req, res);
    expect(createUserInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('createUser should success', async () => {
    let req = {
      body: {
        name: 'test',
        group_id: 1,
      },
    } as any as Request;
    (createUserInDB as Mock).mockImplementation(() => {
      return {
        id: 1,
      };
    });
    await createUser(req, res);
    expect(createUserInDB).toHaveBeenCalledWith({
      name: 'test',
      group_id: 1,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ id: 1 });
  });

  test('getAllUsersInGroup should throw error for invalid payload', async () => {
    let req = {
      body: {},
    } as any as Request;
    await getAllUsersInGroup(req, res);
    expect(getAllUsersInGroupFromDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('getAllUsersInGroup should return success', async () => {
    let req = {
      body: {
        group_id: 1,
      },
    } as any as Request;
    await getAllUsersInGroup(req, res);
    expect(getAllUsersInGroupFromDB).toHaveBeenCalledWith({ group_id: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  test('getAllTransactionInGroup should return success', async () => {
    let req = {
      body: {
        group_id: 1,
      },
    } as any as Request;
    await getAllTransactionInGroup(req, res);
    expect(getAllTransactionInGroupFromDB).toHaveBeenCalledWith({
      group_id: 1,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  test('getAllTransactionInGroup should return error if payload is incorrect', async () => {
    let req = {
      body: {},
    } as any as Request;
    await getAllTransactionInGroup(req, res);
    expect(getAllTransactionInGroupFromDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('getOverviewDataInGroup should return success', async () => {
    let req = {
      body: {
        group_id: 1,
      },
    } as any as Request;
    await getOverviewDataInGroup(req, res);
    expect(getOverviewDataInGroupFromDb).toHaveBeenCalledWith({
      group_id: 1,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  test('getOverviewDataInGroup should return error if payload is incorrect', async () => {
    let req = {
      body: {},
    } as any as Request;
    await getOverviewDataInGroup(req, res);
    expect(getOverviewDataInGroupFromDb).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('savePayment should return error if payload is incorrect', async () => {
    let req = {
      body: {},
    } as any as Request;
    await savePayment(req, res);
    expect(savePaymentInDB).not.toHaveBeenCalled();
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('savePayment should return success', async () => {
    let req = {
      body: { from: '1', to: '1', amount: 10000 },
    } as any as Request;
    (savePaymentInDB as Mock).mockImplementation(() => {
      return { result: { id: 1 }, replayed: false };
    });
    await savePayment(req, res);
    expect(savePaymentInDB).toHaveBeenCalledWith({
      from: 1,
      to: 1,
      amount: 10000,
    });
    expect(send_push_notification).toHaveBeenCalledWith({
      user_id: 1,
      headings: 'New Payment',
      title: expect.any(Function),
    });
    // The text is formatted in the group's currency, looked up when sending.
    const { title } = (send_push_notification as Mock).mock.calls[0][0];
    expect(title({ name: 'Trip', currency: 'INR', currency_decimals: 2 })).toBe(
      '₹100.00'
    );
    expect(title({ name: 'Trip', currency: 'JPY', currency_decimals: 0 })).toBe(
      '¥10,000'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ id: 1 });
  });

  test('savePayment rejects a fractional amount', async () => {
    let req = {
      body: { from: '1', to: '2', amount: 100.5 },
    } as any as Request;
    await savePayment(req, res);
    expect(savePaymentInDB).not.toHaveBeenCalled();
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: `amount: ${ErrorMessage.NotMinorUnits}`,
    });
  });

  test('savePayment should replay the stored response without notifying', async () => {
    let req = {
      body: { from: '1', to: '1', amount: 10000, idempotency_key: ' key-1 ' },
    } as any as Request;
    (savePaymentInDB as Mock).mockImplementation(() => {
      return { result: { id: 7 }, replayed: true };
    });
    await savePayment(req, res);
    expect(savePaymentInDB).toHaveBeenCalledWith({
      from: 1,
      to: 1,
      amount: 10000,
      idempotency_key: 'key-1',
    });
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ id: 7 });
  });

  test('savePayments should return error if req.body has incorrect schema in array', async () => {
    let req = {
      body: [{}],
    } as any as Request;
    await savePayments(req, res);
    expect(savePaymentsInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('savePayments should return error if req.body is empty array', async () => {
    let req = {
      body: [],
    } as any as Request;
    await savePayments(req, res);
    expect(savePaymentsInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('savePayments should return success', async () => {
    let req = {
      body: [{ from: '1', to: '2', amount: 10000, idempotency_key: ' pay-1 ' }],
    } as any as Request;
    (savePaymentsInDB as Mock).mockImplementation(() => {
      return { result: [{ id: 1 }], written: [true] };
    });
    await savePayments(req, res);
    expect(savePaymentsInDB).toHaveBeenCalledWith([
      {
        from: 1,
        to: 2,
        amount: 10000,
        idempotency_key: 'pay-1',
      },
    ]);
    expect(send_push_notification).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([{ id: 1 }]);
  });

  test('savePayments rejects a half-keyed batch', async () => {
    let req = {
      body: [
        { from: '1', to: '2', amount: 10000, idempotency_key: 'pay-1' },
        { from: '2', to: '3', amount: 5000 },
      ],
    } as any as Request;
    await savePayments(req, res);
    expect(savePaymentsInDB).not.toHaveBeenCalled();
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: ErrorMessage.IdempotencyKeyMissingInBatch,
    });
  });

  test('savePayments notifies only the payments it actually wrote', async () => {
    let req = {
      body: [
        { from: '1', to: '2', amount: 10000, idempotency_key: 'pay-1' },
        { from: '2', to: '3', amount: 5000, idempotency_key: 'pay-2' },
      ],
    } as any as Request;
    (savePaymentsInDB as Mock).mockImplementation(() => {
      return { result: [{ id: 1 }, { id: 2 }], written: [false, true] };
    });
    await savePayments(req, res);
    expect(send_push_notification).toHaveBeenCalledTimes(1);
    const [[call]] = (send_push_notification as Mock).mock.calls;
    expect(call.user_id).toBe(2);
    expect(
      call.title({ name: 'Trip', currency: 'INR', currency_decimals: 2 })
    ).toBe('₹50.00');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
  });

  test('savePayments sends no notification when the whole batch is a replay', async () => {
    let req = {
      body: [
        { from: '1', to: '2', amount: 10000, idempotency_key: 'pay-1' },
        { from: '2', to: '3', amount: 5000, idempotency_key: 'pay-2' },
      ],
    } as any as Request;
    (savePaymentsInDB as Mock).mockImplementation(() => {
      return { result: [{ id: 1 }, { id: 2 }], written: [false, false] };
    });
    await savePayments(req, res);
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
  });

  test('saveTransaction should return error if payload is incorrect', async () => {
    let req = {
      body: {
        by: '1',
        title: 'test',
      },
    } as any as Request;
    await saveTransaction(req, res);
    expect(saveTransactionInDB).not.toHaveBeenCalled();
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('saveTransaction should return error if transactionPart in incorrect in body', async () => {
    let req = {
      body: {
        by: '1',
        title: 'test',
        totalAmount: 10000,
        transactionParts: [{ user_id: 1 }, { user_id: 2, amount: 8000 }],
      },
    } as any as Request;
    await saveTransaction(req, res);
    expect(saveTransactionInDB).not.toHaveBeenCalled();
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('saveTransaction should return error if transactionPart does not sum as totalAmount', async () => {
    let req = {
      body: {
        by: '1',
        title: 'test',
        totalAmount: 10000,
        transactionParts: [
          { user_id: 1, amount: 9000 },
          { user_id: 2, amount: 8000 },
        ],
      },
    } as any as Request;
    await saveTransaction(req, res);
    expect(saveTransactionInDB).not.toHaveBeenCalled();
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('saveTransaction should return success', async () => {
    let req = {
      body: {
        by: '1',
        title: 'test',
        totalAmount: 10000,
        idempotency_key: 'expense-1',
        transactionParts: [
          { user_id: 1, amount: 2000 },
          { user_id: 2, amount: 8000 },
        ],
      },
    } as any as Request;
    (saveTransactionInDB as Mock).mockImplementation(() => {
      return { result: { id: 1 }, replayed: false };
    });
    await saveTransaction(req, res);
    expect(saveTransactionInDB).toHaveBeenCalledWith({
      by: 1,
      title: 'test',
      totalAmount: 10000,
      idempotency_key: 'expense-1',
      transactionParts: [
        { user_id: 1, amount: 2000 },
        { user_id: 2, amount: 8000 },
      ],
    });
    expect(send_push_notification).toHaveBeenCalledWith({
      user_id: 1,
      headings: 'New Expense',
      title: 'test',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ id: 1 });
  });

  test('saveTransaction ignores groupName from the request', async () => {
    let req = {
      body: {
        by: 1,
        title: 'test',
        totalAmount: 100,
        groupName: 'stale name',
        transactionParts: [{ user_id: 1, amount: 100 }],
      },
    } as any as Request;
    (saveTransactionInDB as Mock).mockResolvedValue({
      result: { id: 1 },
      replayed: false,
    });
    await saveTransaction(req, res);
    expect(saveTransactionInDB).toHaveBeenCalledWith(
      expect.not.objectContaining({ groupName: expect.anything() })
    );
    expect(send_push_notification).toHaveBeenCalledWith(
      expect.not.objectContaining({ groupName: expect.anything() })
    );
  });

  test('getGroups returns each known group with its invite id', async () => {
    let req = { body: { group_ids: [2, '1', 2, 99] } } as any as Request;
    (getGroupsInDB as Mock).mockResolvedValue([
      { id: 2, name: 'Goa', currency: 'INR', currency_decimals: 2 },
      { id: 1, name: 'Manali Trip', currency: 'INR', currency_decimals: 2 },
    ]);
    (crypto.encryptDeterministic as Mock).mockImplementation(
      (id: string) => `enc-${id}`
    );
    await getGroups(req, res);
    expect(getGroupsInDB).toHaveBeenCalledWith({ group_ids: [2, 1, 99] });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([
      {
        id: 2,
        name: 'Goa',
        inviteId: 'enc-2',
        currency: 'INR',
        currency_decimals: 2,
      },
      {
        id: 1,
        name: 'Manali Trip',
        inviteId: 'enc-1',
        currency: 'INR',
        currency_decimals: 2,
      },
    ]);
  });

  test('getGroups rejects a payload without a list of ids', async () => {
    let req = { body: { group_ids: 5 } } as any as Request;
    await getGroups(req, res);
    expect(getGroupsInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: `group_ids: ${ErrorMessage.NotAnIdList}`,
    });
  });

  test('updateGroup renames the group and returns it', async () => {
    let req = {
      body: { group_id: '42', name: '  Manali 2026 ' },
    } as any as Request;
    (updateGroupInDB as Mock).mockResolvedValue({
      group: {
        id: 42,
        name: 'Manali 2026',
        currency: 'INR',
        currency_decimals: 2,
      },
      previous: { name: 'Manali Trip', currency: 'INR', currency_decimals: 2 },
    });
    (crypto.encryptDeterministic as Mock).mockReturnValue('enc-42');
    await updateGroup(req, res);
    // Only the field sent is passed on, so currency is left as it is.
    expect(updateGroupInDB).toHaveBeenCalledWith({
      group_id: 42,
      name: 'Manali 2026',
    });
    expect(crypto.encryptDeterministic).toHaveBeenCalledWith('42');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      id: 42,
      name: 'Manali 2026',
      inviteId: 'enc-42',
      currency: 'INR',
      currency_decimals: 2,
    });
  });

  test("updateGroup notifies the group's devices of a rename", async () => {
    let req = { body: { group_id: 42, name: 'Manali 2026' } } as any as Request;
    (updateGroupInDB as Mock).mockResolvedValue({
      group: {
        id: 42,
        name: 'Manali 2026',
        currency: 'INR',
        currency_decimals: 2,
      },
      previous: { name: 'Manali Trip', currency: 'INR', currency_decimals: 2 },
    });
    await updateGroup(req, res);

    expect(send_push_notification).toHaveBeenCalledTimes(1);
    const call = (send_push_notification as Mock).mock.calls[0][0];
    expect(call).toMatchObject({
      group_id: 42,
      title: '"Manali Trip" is now "Manali 2026"',
    });
    // The heading is used whole, not as '... in <group name>'.
    expect(call.headings('Manali 2026')).toBe('Group Renamed');
  });

  test('updateGroup names every change in one notification', async () => {
    let req = {
      body: {
        group_id: 42,
        name: 'Manali 2026',
        currency: 'INR',
        currency_decimals: 2,
      },
    } as any as Request;
    (updateGroupInDB as Mock).mockResolvedValue({
      group: {
        id: 42,
        name: 'Manali 2026',
        currency: 'USD',
        currency_decimals: 2,
      },
      previous: { name: 'Manali Trip', currency: 'INR', currency_decimals: 2 },
    });
    await updateGroup(req, res);

    const call = (send_push_notification as Mock).mock.calls[0][0];
    expect(call.title).toBe(
      '"Manali Trip" is now "Manali 2026". Currency is now USD'
    );
    expect(call.headings('Manali 2026')).toBe('Group Updated');
  });

  test("updateGroup rejects decimals that are not the currency's", async () => {
    let req = {
      body: { group_id: 42, currency: 'INR', currency_decimals: 0 },
    } as any as Request;
    await updateGroup(req, res);
    expect(updateGroupInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: `currency_decimals: ${ErrorMessage.DecimalsMismatch} (2 for INR)`,
    });
  });

  test('updateGroup reports a change of decimals as a currency change', async () => {
    let req = {
      body: { group_id: 42, currency: 'INR', currency_decimals: 2 },
    } as any as Request;
    // The group had been stored with another scale; the query says what changed.
    (updateGroupInDB as Mock).mockResolvedValue({
      group: { id: 42, name: 'Goa', currency: 'INR', currency_decimals: 2 },
      previous: { name: 'Goa', currency: 'INR', currency_decimals: 0 },
    });
    await updateGroup(req, res);
    const call = (send_push_notification as Mock).mock.calls[0][0];
    expect(call.title).toBe('Currency is now INR');
  });

  test('updateGroup sends no notification when nothing changed', async () => {
    let req = { body: { group_id: 42, name: 'Manali Trip' } } as any as Request;
    (updateGroupInDB as Mock).mockResolvedValue({
      group: {
        id: 42,
        name: 'Manali Trip',
        currency: 'INR',
        currency_decimals: 2,
      },
      previous: { name: 'Manali Trip', currency: 'INR', currency_decimals: 2 },
    });
    await updateGroup(req, res);
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateGroup reports a currency change the group can no longer make', async () => {
    let req = {
      body: { group_id: 42, currency: 'INR', currency_decimals: 2 },
    } as any as Request;
    (updateGroupInDB as Mock).mockRejectedValue(
      new Error(ErrorMessage.CurrencyLocked)
    );
    await updateGroup(req, res);
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: ErrorMessage.CurrencyLocked,
    });
  });

  test('updateGroup reports an unknown group', async () => {
    let req = {
      body: { group_id: 404, currency: 'inr', currency_decimals: 2 },
    } as any as Request;
    (updateGroupInDB as Mock).mockResolvedValue(undefined);
    await updateGroup(req, res);
    expect(updateGroupInDB).toHaveBeenCalledWith({
      group_id: 404,
      currency: 'INR',
      currency_decimals: 2,
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: ErrorMessage.GroupNotFound,
    });
  });

  test('updateGroup rejects a request that changes nothing', async () => {
    let req = { body: { group_id: 42 } } as any as Request;
    await updateGroup(req, res);
    expect(updateGroupInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: ErrorMessage.NothingToUpdate,
    });
  });

  test('registerDevice rejects an invalid payload', async () => {
    let req = {
      body: { subscription_id: ' ', group_ids: 'x' },
    } as any as Request;
    await registerDevice(req, res);
    expect(registerDeviceInDB).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message:
        'subscription_id: must not be blank; group_ids: must be a list of group ids',
    });
  });

  test('registerDevice returns the groups it registered', async () => {
    let req = {
      body: {
        subscription_id: 'a1a3588d-8d75-4d23-879f-82aa4a2c23c7',
        group_ids: [1, '2', 3, 1],
      },
    } as any as Request;
    (registerDeviceInDB as Mock).mockResolvedValue([1, 2]);
    await registerDevice(req, res);
    expect(registerDeviceInDB).toHaveBeenCalledWith({
      subscription_id: 'a1a3588d-8d75-4d23-879f-82aa4a2c23c7',
      group_ids: [1, 2, 3],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      subscription_id: 'a1a3588d-8d75-4d23-879f-82aa4a2c23c7',
      group_ids: [1, 2],
    });
  });

  test('saveTransaction replay returns the original response and no notification', async () => {
    let req = {
      body: {
        by: '1',
        title: 'test',
        totalAmount: 10000,
        idempotency_key: 'expense-1',
        transactionParts: [
          { user_id: 1, amount: 2000 },
          { user_id: 2, amount: 8000 },
        ],
      },
    } as any as Request;
    (saveTransactionInDB as Mock).mockImplementation(() => {
      return { result: { id: 42 }, replayed: true };
    });
    await saveTransaction(req, res);
    expect(send_push_notification).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ id: 42 });
  });
});
