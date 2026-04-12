import { supabase } from './supabase';

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID;

export async function createCheckoutSessionUrl(userId: string) {
  if (!STRIPE_PRICE_ID) {
    throw new Error('stripe_price_id_missing');
  }

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      userId,
      priceId: STRIPE_PRICE_ID,
    },
  });

  if (error || !data?.url) {
    throw new Error('checkout_session_failed');
  }

  return data.url as string;
}
