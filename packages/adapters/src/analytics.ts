// Product analytics (D19, D24). PostHog arrives in phase 4 (D55); until then events go nowhere.
// Events carry no content (D9): every event and its properties are declared here, and a property
// is a number, a boolean or one of a fixed set of strings, never free text.

/** A property value: a count, a flag, or one of a closed set of words. */
export type AnalyticsValue = number | boolean | null;

/**
 * Every event we send, with its properties. Add an event here before sending it. A string property
 * must be a union of literals (`'direct' | 'group'`), checked by `ClosedProperties`.
 */
export interface AnalyticsEvents {
  /** D24: Messages sent per active Member per day. */
  message_sent: { chatKind: 'direct' | 'group' };
}

type IsClosed<T> = T extends AnalyticsValue
  ? true
  : T extends string
    ? string extends T
      ? false
      : true
    : false;

/** `never` when any property could hold free text, which makes `capture` impossible to call. */
export type ClosedProperties<P> = { [K in keyof P]: IsClosed<P[K]> }[keyof P] extends true
  ? P
  : never;

export interface Analytics {
  capture<E extends keyof AnalyticsEvents>(
    event: E,
    properties: ClosedProperties<AnalyticsEvents[E]>,
    /** The Member's ID; never an email or a name. */
    distinctId: string,
  ): void;
}

export function createNoopAnalytics(): Analytics {
  return { capture: () => undefined };
}
