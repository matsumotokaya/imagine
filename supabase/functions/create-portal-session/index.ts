import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const jsonError = (status: number, errorCode: string, message: string, errorId: string, details?: string) =>
  new Response(
    JSON.stringify({
      error: message,
      error_code: errorCode,
      error_id: errorId,
      details: details || message,
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )

const getStripeClient = (stripeMode: unknown) => {
  const normalizedMode = stripeMode === 'test' ? 'test' : 'live'
  const testKey = Deno.env.get('STRIPE_TEST_SECRET_KEY')
  const defaultKey = Deno.env.get('STRIPE_SECRET_KEY')

  const primaryKey = normalizedMode === 'test' && testKey
    ? testKey
    : defaultKey

  if (!primaryKey) {
    throw new Error('No Stripe secret key configured')
  }

  return new Stripe(primaryKey, {
    apiVersion: '2023-10-16',
  })
}

const resolveBaseUrl = (req: Request) => {
  const origin = req.headers.get('origin')
  if (origin && origin !== 'null') {
    return origin
  }

  const referer = req.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch (_error) {
      console.warn('Invalid referer URL:', referer)
    }
  }

  const configuredBaseUrl =
    Deno.env.get('SITE_URL') ||
    Deno.env.get('PUBLIC_SITE_URL') ||
    Deno.env.get('APP_URL')

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '')
  }

  throw new Error('Could not determine return URL for billing portal')
}

const resolveStripeCustomerId = async (
  stripe: Stripe,
  existingCustomerId: string | null,
  email: string | null
) => {
  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId)
      if (!customer.deleted) {
        return customer.id
      }
    } catch (error) {
      console.warn('Stored Stripe customer ID is invalid for requested Stripe mode:', existingCustomerId, error)
    }
  }

  if (!email) {
    return null
  }

  const customers = await stripe.customers.list({
    email,
    limit: 10,
  })

  const activeCustomer = customers.data.find((customer) => !customer.deleted)
  if (activeCustomer) {
    return activeCustomer.id
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const errorId = crypto.randomUUID()

  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase environment variables are not configured')
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return jsonError(
        401,
        'SubscriptionPortalUnauthorized',
        'Login session is missing or expired.',
        errorId
      )
    }

    const accessToken = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : ''

    if (!accessToken) {
      return jsonError(
        401,
        'SubscriptionPortalUnauthorized',
        'Login session is missing or expired.',
        errorId,
        'Authorization header did not contain a bearer token.'
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    })

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { data: { user }, error: authError } = await userClient.auth.getUser(accessToken)

    if (authError || !user) {
      return jsonError(
        401,
        'SubscriptionPortalUnauthorized',
        'Login session is missing or expired.',
        errorId,
        authError?.message
      )
    }

    let requestedCustomerId: string | null = null
    let stripeMode: string | null = null
    try {
      const body = await req.json()
      requestedCustomerId =
        typeof body?.customerId === 'string' && body.customerId.trim()
          ? body.customerId.trim()
          : null
      stripeMode =
        typeof body?.stripeMode === 'string' && body.stripeMode.trim()
          ? body.stripeMode.trim()
          : null
    } catch (_error) {
      requestedCustomerId = null
      stripeMode = null
    }

    const stripe = getStripeClient(stripeMode)

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return jsonError(
        500,
        'SubscriptionPortalProfileLookupFailed',
        'Failed to load billing profile.',
        errorId,
        profileError.message
      )
    }

    const profileEmail =
      (typeof profile?.email === 'string' && profile.email) ||
      user.email ||
      null

    const customerId = await resolveStripeCustomerId(
      stripe,
      requestedCustomerId || profile?.stripe_customer_id || null,
      profileEmail
    )

    if (!customerId) {
      return jsonError(
        404,
        'SubscriptionPortalCustomerNotFound',
        'No Stripe customer was found for this account.',
        errorId,
        `email=${profileEmail ?? 'n/a'} stripe_mode=${stripeMode ?? 'live'}`
      )
    }

    if (customerId !== profile?.stripe_customer_id) {
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) {
        console.error(`[${errorId}] Failed to persist recovered Stripe customer ID:`, updateError)
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${resolveBaseUrl(req)}/mypage`,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[${errorId}] Failed to create Stripe billing portal session:`, error)
    return jsonError(
      500,
      'SubscriptionPortalSessionCreateFailed',
      'Failed to create subscription management session.',
      errorId,
      message
    )
  }
})
