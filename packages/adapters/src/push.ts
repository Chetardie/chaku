// Web Push (spec §5.5). `web-push` with VAPID keys arrives with the Push ticket; until then pushes
// are logged. The log names the push service's host only: the endpoint path identifies a device,
// and the payload can hold Message text (D9).
import type { Logger } from './log.ts';

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  subscription: PushSubscription;
  /** Encrypted for the subscription before it leaves the server. Never logged. */
  payload: string;
  /** Seconds the push service keeps it for an offline device. */
  ttl: number;
}

export type PushResult = 'sent' | 'expired';

export interface PushSender {
  /** `expired` means the subscription is gone and should be deleted. */
  send(message: PushMessage): Promise<PushResult>;
}

export function createLogPush(logger: Pick<Logger, 'info'>): PushSender {
  return {
    send({ subscription, ttl }) {
      logger.info(
        { pushService: new URL(subscription.endpoint).host, ttl },
        'push not sent (log adapter)',
      );
      return Promise.resolve('sent');
    },
  };
}
