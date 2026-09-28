import { vi, describe, test, beforeEach, expect, Mock } from 'vitest';

vi.mock('node-fetch', () => {
  return {
    default: vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'notification-id' }),
      };
    }),
  };
});

vi.mock('../../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../../../../src/split-backend/db/queries/device.js', () => {
  return {
    getNotificationTarget: vi.fn(),
  };
});

const { send_push_notification, MAX_SUBSCRIPTIONS_PER_CALL } =
  await import('../../../../src/split-backend/utils/send_notification.js');
const { getNotificationTarget } =
  await import('../../../../src/split-backend/db/queries/device.js');
const { default: fetch } = await import('node-fetch');
const { default: logger } = await import('../../../../src/@rsaw409/logger.js');

/** A well-formed subscription id, distinct per n. */
const sub = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const bodyOf = (call: number) =>
  JSON.parse((fetch as unknown as Mock).mock.calls[call][1].body);

const expense = { user_id: 7, headings: 'New Expense', title: 'dinner' };

describe('SEND NOTIFICATION TEST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ONESIGNAL_KEY = 'test-key';
  });

  test("targets the group's registered devices by subscription id", async () => {
    (getNotificationTarget as Mock).mockResolvedValue({
      group_name: 'Manali Trip',
      subscription_ids: [sub(1), sub(2)],
    });

    await send_push_notification(expense);

    expect(getNotificationTarget).toHaveBeenCalledWith({ user_id: 7 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (fetch as unknown as Mock).mock.calls[0];
    expect(url).toEqual('https://onesignal.com/api/v1/notifications');
    expect(options).toHaveProperty('method', 'POST');
    expect(options.headers).toHaveProperty('Authorization', 'Basic test-key');
    expect(bodyOf(0)).toEqual({
      app_id: 'e6cdb8fb-192b-4a0e-81e1-5762f7e0b630',
      target_channel: 'push',
      include_subscription_ids: [sub(1), sub(2)],
      // The name comes from the database, not the request.
      headings: { en: 'New Expense in Manali Trip' },
      contents: { en: 'dinner' },
    });
    // No tag or segment targeting any more.
    expect(bodyOf(0)).not.toHaveProperty('filters');
  });

  test('sends nothing when the group has no registered devices', async () => {
    (getNotificationTarget as Mock).mockResolvedValue({
      group_name: 'Manali Trip',
      subscription_ids: [],
    });
    await send_push_notification(expense);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('skips malformed ids rather than lose the whole notification', async () => {
    (getNotificationTarget as Mock).mockResolvedValue({
      group_name: 'Manali Trip',
      subscription_ids: [sub(1), 'zz-verify-sub', sub(2)],
    });

    await send_push_notification(expense);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(bodyOf(0).include_subscription_ids).toEqual([sub(1), sub(2)]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('zz-verify-sub')
    );
  });

  test('sends nothing when every id is malformed', async () => {
    (getNotificationTarget as Mock).mockResolvedValue({
      group_name: 'Manali Trip',
      subscription_ids: ['zz-verify-sub'],
    });
    await send_push_notification(expense);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('sends nothing when the user does not exist', async () => {
    (getNotificationTarget as Mock).mockResolvedValue(undefined);
    await send_push_notification(expense);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('splits more than 20,000 subscriptions across calls', async () => {
    const subscription_ids = Array.from(
      { length: MAX_SUBSCRIPTIONS_PER_CALL * 2 + 1 },
      (_, i) => sub(i)
    );
    (getNotificationTarget as Mock).mockResolvedValue({
      group_name: 'Big Group',
      subscription_ids,
    });

    await send_push_notification(expense);

    expect(fetch).toHaveBeenCalledTimes(3);
    const sent = [0, 1, 2].map((i) => bodyOf(i).include_subscription_ids);
    expect(sent.map((ids) => ids.length)).toEqual([20000, 20000, 1]);
    expect(sent.flat()).toEqual(subscription_ids);
  });

  test('logs a OneSignal error response', async () => {
    (getNotificationTarget as Mock).mockResolvedValue({
      group_name: 'Manali Trip',
      subscription_ids: [sub(1)],
    });
    (fetch as unknown as Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ errors: ['bad request'] }),
    });

    await send_push_notification(expense);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('OneSignal 400')
    );
  });

  test('never throws, so a failed notification cannot fail the write', async () => {
    (getNotificationTarget as Mock).mockRejectedValue(new Error('db down'));
    await expect(send_push_notification(expense)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
