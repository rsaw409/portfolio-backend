import fetch from 'node-fetch';
import logger from '../../@rsaw409/logger.js';
import { getNotificationTarget } from '../db/queries/device.js';
import { isSubscriptionId } from './validator.js';

const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_APP_ID = 'e6cdb8fb-192b-4a0e-81e1-5762f7e0b630';

// OneSignal's limit on include_subscription_ids per request.
const MAX_SUBSCRIPTIONS_PER_CALL = 20000;

interface NotifiedGroup {
  name: string;
  currency: string;
  currency_decimals: number;
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Notifies every device following a group: the group of `user_id` (the user
 * who made the change), or `group_id` itself. The backend decides who gets it
 * from device_groups; nothing is targeted by OneSignal tag any more.
 *
 * A string heading reads '<headings> in <group name>'. Either the heading or
 * the text can instead be a function of the group as it is in the database
 * (its current name, currency and currency_decimals), returning the whole string; amounts are
 * formatted that way, in the group's currency.
 *
 * Fire-and-forget: it never throws, so callers need not await it, and a
 * notification failure never fails the write that triggered it.
 */
const send_push_notification = async ({
  headings,
  title,
  ...by
}: ({ user_id: number } | { group_id: number }) & {
  headings: string | ((group: NotifiedGroup) => string);
  title: string | ((group: NotifiedGroup) => string);
}): Promise<void> => {
  try {
    const target = await getNotificationTarget(by);
    if (!target) return;

    // registerDevice only accepts UUIDs, but one malformed id left in the table
    // would make OneSignal reject the whole call, so every device would miss
    // the notification. Skip such ids instead.
    const valid = target.subscription_ids.filter(isSubscriptionId);
    if (valid.length < target.subscription_ids.length) {
      logger.error(
        `Skipping malformed subscription ids: ${JSON.stringify(
          target.subscription_ids.filter((id) => !isSubscriptionId(id))
        )}`
      );
    }
    if (valid.length === 0) return;

    const group = {
      name: target.group_name,
      currency: target.currency,
      currency_decimals: target.currency_decimals,
    };
    const heading =
      typeof headings === 'function'
        ? headings(group)
        : `${headings} in ${group.name}`;
    const contents = typeof title === 'function' ? title(group) : title;

    for (const subscription_ids of chunk(valid, MAX_SUBSCRIPTIONS_PER_CALL)) {
      const response = await fetch(ONESIGNAL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${process.env.ONESIGNAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          target_channel: 'push',
          include_subscription_ids: subscription_ids,
          headings: { en: heading },
          contents: { en: contents },
        }),
      });
      const data = await response.json();
      if (response.ok) {
        logger.info(`Success: ${JSON.stringify(data)}`);
      } else {
        logger.error(`OneSignal ${response.status}: ${JSON.stringify(data)}`);
      }
    }
  } catch (error) {
    logger.error(error);
  }
};

export { send_push_notification, MAX_SUBSCRIPTIONS_PER_CALL };
