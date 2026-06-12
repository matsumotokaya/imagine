import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const getStripeSecretKey = (stripeMode: unknown) => {
  const normalizedMode = stripeMode === 'test' ? 'test' : 'live'
  const testKey = Deno.env.get('STRIPE_TEST_SECRET_KEY')
  const defaultKey = Deno.env.get('STRIPE_SECRET_KEY')

  if (normalizedMode === 'test' && testKey) {
    return testKey
  }

  if (defaultKey) {
    return defaultKey
  }

  if (testKey) {
    return testKey
  }

  throw new Error('No Stripe secret key configured')
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, priceId, stripeMode } = await req.json()

    const stripe = new Stripe(getStripeSecretKey(stripeMode), {
      apiVersion: '2023-10-16',
    })

    if (!userId || !priceId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or priceId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/`,
      client_reference_id: userId,
      metadata: {
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
        },
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
