// The errors a login can end with, besides Better Auth's own (`INVALID_OTP`, `OTP_EXPIRED`,
// `TOO_MANY_ATTEMPTS`). Each is a Better Auth `APIError` whose JSON body carries `code`, so the
// login screen (CHK-41) can show the right words in EN and UK.
import { APIError } from 'better-auth/api';

export const loginErrorCodes = {
  /** No Member has this address, and signups need an Invite (CHK-21). */
  SIGNUP_CLOSED: 'SIGNUP_CLOSED',
  /** Banned for good (D37). */
  MEMBER_BANNED: 'MEMBER_BANNED',
  /** Suspended; the body's `banExpires` says until when (D37). */
  MEMBER_SUSPENDED: 'MEMBER_SUSPENDED',
  /** A D56 limit; the body's `retryAfter` is in seconds, as is the `Retry-After` header. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** The bot check refused the request (D44). */
  BOT_CHECK_FAILED: 'BOT_CHECK_FAILED',
  /** A login link that is unknown, used or expired. */
  INVALID_LINK: 'INVALID_LINK',
  /** Only email codes for logging in are sent from this endpoint. */
  UNSUPPORTED_CODE_TYPE: 'UNSUPPORTED_CODE_TYPE',
} as const;

export type LoginErrorCode = (typeof loginErrorCodes)[keyof typeof loginErrorCodes];

export function signupClosed(): APIError {
  return new APIError('FORBIDDEN', {
    code: loginErrorCodes.SIGNUP_CLOSED,
    message: 'Chaku is invite-only. Ask a friend who uses it for an Invite.',
  });
}

/** A ban or a suspension still running at `now`, or `null` when the Member may log in. */
export function banError(
  member: { banned: boolean; banExpires: Date | null },
  now = new Date(),
): APIError | null {
  if (!member.banned) return null;
  if (member.banExpires === null) {
    return new APIError('FORBIDDEN', {
      code: loginErrorCodes.MEMBER_BANNED,
      message: 'This account is banned.',
    });
  }
  if (member.banExpires <= now) return null;
  return new APIError('FORBIDDEN', {
    code: loginErrorCodes.MEMBER_SUSPENDED,
    message: 'This account is suspended.',
    banExpires: member.banExpires.toISOString(),
  });
}

export function rateLimited(retryAfter: number): APIError {
  return new APIError(
    'TOO_MANY_REQUESTS',
    {
      code: loginErrorCodes.RATE_LIMITED,
      message: 'Too many login codes. Try again later.',
      retryAfter,
    },
    { 'Retry-After': String(retryAfter) },
  );
}

export function botCheckFailed(): APIError {
  return new APIError('FORBIDDEN', {
    code: loginErrorCodes.BOT_CHECK_FAILED,
    message: 'The check that you are a person failed. Try again.',
  });
}

export function invalidLink(): APIError {
  return new APIError('BAD_REQUEST', {
    code: loginErrorCodes.INVALID_LINK,
    message: 'This login link has expired or was already used. Ask for a new code.',
  });
}

export function unsupportedCodeType(): APIError {
  return new APIError('BAD_REQUEST', {
    code: loginErrorCodes.UNSUPPORTED_CODE_TYPE,
    message: 'Only login codes are sent here.',
  });
}
