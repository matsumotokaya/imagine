import { getSupabase } from './supabase';

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID;
const STRIPE_MODE = import.meta.env.VITE_STRIPE_MODE === 'test' ? 'test' : 'live';

export interface SubscriptionPortalErrorDetails {
  code: string;
  errorId?: string;
  message: string;
  status?: number;
  copyText: string;
}

export class SubscriptionPortalError extends Error {
  details: SubscriptionPortalErrorDetails;

  constructor(details: SubscriptionPortalErrorDetails) {
    super(details.message);
    this.name = 'SubscriptionPortalError';
    this.details = details;
  }
}

const SESSION_RECOVERY_ERROR_CODES = new Set([
  'SubscriptionPortalUnauthorized',
  'SubscriptionPortalClientSessionFailed',
  'SubscriptionPortalClientSessionMissing',
]);

export function isSubscriptionPortalSessionRecoveryError(error: unknown) {
  return error instanceof SubscriptionPortalError
    && SESSION_RECOVERY_ERROR_CODES.has(error.details.code);
}

async function getAuthHeaders() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new SubscriptionPortalError({
      code: 'SubscriptionPortalClientSessionFailed',
      message: error.message,
      copyText: [
        'error_code=SubscriptionPortalClientSessionFailed',
        'status=n/a',
        'error_id=n/a',
        `message=${error.message}`,
      ].join('\n'),
    });
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new SubscriptionPortalError({
      code: 'SubscriptionPortalClientSessionMissing',
      message: 'Login session is missing on the client.',
      copyText: [
        'error_code=SubscriptionPortalClientSessionMissing',
        'status=n/a',
        'error_id=n/a',
        'message=Login session is missing on the client.',
      ].join('\n'),
    });
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function resolveAuthHeaders(accessToken?: string) {
  if (accessToken) {
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return getAuthHeaders();
}

async function parsePortalErrorResponse(response?: Response) {
  if (!response) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      return await response.clone().json();
    }

    return {
      error: await response.clone().text(),
    };
  } catch {
    return null;
  }
}

async function buildPortalError(error: unknown, response?: Response) {
  const payload = await parsePortalErrorResponse(response);
  const code = payload?.error_code
    || (error instanceof Error ? error.name : 'SubscriptionPortalUnknownError');
  const message = payload?.details
    || payload?.message
    || payload?.error
    || 'Subscription portal request failed';
  const status = response?.status;
  const errorId = payload?.error_id;

  const lines = [
    `error_code=${code}`,
    `status=${status ?? 'n/a'}`,
    `error_id=${errorId ?? 'n/a'}`,
    `message=${message}`,
  ];

  return new SubscriptionPortalError({
    code,
    errorId,
    message,
    status,
    copyText: lines.join('\n'),
  });
}

export async function createCheckoutSessionUrl(userId: string, accessToken?: string) {
  if (!STRIPE_PRICE_ID) {
    throw new Error('stripe_price_id_missing');
  }

  const headers = await resolveAuthHeaders(accessToken);
  const supabase = await getSupabase();

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    headers,
    body: {
      userId,
      priceId: STRIPE_PRICE_ID,
      stripeMode: STRIPE_MODE,
    },
  });

  if (error || !data?.url) {
    throw new Error('checkout_session_failed');
  }

  return data.url as string;
}

export async function createPortalSessionUrl(accessToken?: string) {
  const headers = await resolveAuthHeaders(accessToken);
  const supabase = await getSupabase();
  const { data, error, response } = await supabase.functions.invoke('create-portal-session', {
    headers,
    body: {
      stripeMode: STRIPE_MODE,
    },
  });

  if (error) {
    throw await buildPortalError(error, response);
  }

  if (!data?.url) {
    throw new SubscriptionPortalError({
      code: 'SubscriptionPortalMissingUrl',
      message: 'Subscription portal URL was missing from the response',
      copyText: [
        'error_code=SubscriptionPortalMissingUrl',
        'status=200',
        'error_id=n/a',
        'message=Subscription portal URL was missing from the response',
      ].join('\n'),
    });
  }

  return data.url as string;
}
