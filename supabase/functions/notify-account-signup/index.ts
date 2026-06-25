import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { sendSignupNotifications } from '../_shared/account-notifications.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SIGNUP_NOTIFICATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function readTimestamp(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function resolveProviderLabel(provider: string | null | undefined): string {
  switch (provider) {
    case 'google':
      return 'Google'
    case 'apple':
      return 'Apple'
    case 'email':
      return 'Email'
    default:
      return provider || 'Unknown'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Supabase environment variables are not configured')
    }

    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return jsonResponse(401, { error: 'Authorization header is required.' })
    }

    const accessToken = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : ''

    if (!accessToken) {
      return jsonResponse(401, { error: 'Bearer token is missing.' })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    })
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: authData, error: authError } = await userClient.auth.getUser(accessToken)
    if (authError || !authData.user) {
      return jsonResponse(401, { error: authError?.message ?? 'User session is invalid.' })
    }

    const authUser = authData.user
    const { data: currentUserData, error: currentUserError } = await adminClient.auth.admin.getUserById(authUser.id)
    if (currentUserError || !currentUserData.user) {
      return jsonResponse(500, { error: currentUserError?.message ?? 'Failed to load auth user.' })
    }

    const currentUser = currentUserData.user
    const existingNotifications = typeof currentUser.app_metadata?.notifications === 'object' &&
      currentUser.app_metadata?.notifications !== null
      ? currentUser.app_metadata.notifications as Record<string, unknown>
      : {}

    if (existingNotifications.signup_notified_at) {
      return jsonResponse(200, { alreadySent: true })
    }

    const provider = currentUser.app_metadata?.provider as string | undefined
    const emailConfirmedAt =
      readTimestamp(currentUser.email_confirmed_at) ??
      readTimestamp((currentUser as { confirmed_at?: string | null }).confirmed_at)

    if (provider === 'email' && !emailConfirmedAt) {
      return jsonResponse(200, { skipped: 'email_not_verified' })
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('email, full_name, created_at')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileError) {
      console.error('notify-account-signup: profile lookup failed, continuing with auth user fallback:', profileError)
    }

    const email = (profile?.email || authUser.email || '').trim()
    if (!email) {
      return jsonResponse(400, { error: 'No email address found for this account.' })
    }

    const authUserCreatedAt = typeof currentUser.created_at === 'string'
      ? currentUser.created_at
      : null
    const createdAtSource = profile?.created_at || authUserCreatedAt
    const createdAtValue = createdAtSource ? new Date(createdAtSource).getTime() : Date.now()
    const isRecentSignup = Number.isFinite(createdAtValue) &&
      Date.now() - createdAtValue <= SIGNUP_NOTIFICATION_WINDOW_MS

    if (!isRecentSignup) {
      return jsonResponse(200, { skipped: 'not_recent_signup' })
    }

    const providerLabel = resolveProviderLabel(provider)
    const origin = req.headers.get('origin')
    const appLabel = origin?.includes('whatif-ep.xyz') ? 'WHATIF Gallery' : 'IMAGINE'

    await sendSignupNotifications({
      email,
      fullName:
        profile?.full_name ??
        (typeof currentUser.user_metadata?.full_name === 'string' ? currentUser.user_metadata.full_name : null) ??
        (typeof currentUser.user_metadata?.name === 'string' ? currentUser.user_metadata.name : null),
      providerLabel,
      appLabel,
    })

    const nextAppMetadata = {
      ...(currentUser.app_metadata ?? {}),
      notifications: {
        ...existingNotifications,
        signup_notified_at: new Date().toISOString(),
      },
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
      app_metadata: nextAppMetadata,
    })

    if (updateError) {
      console.error('Failed to persist signup notification marker:', updateError)
    }

    return jsonResponse(200, { sent: true })
  } catch (error) {
    console.error('notify-account-signup failed:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
