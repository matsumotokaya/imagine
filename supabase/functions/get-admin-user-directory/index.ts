import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (callerProfileError) {
      return jsonResponse(500, { error: callerProfileError.message })
    }

    if (callerProfile?.role !== 'admin') {
      return jsonResponse(403, { error: 'Admin access required.' })
    }

    const { data: users, error: usersError } = await adminClient
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, subscription_tier, subscription_status, subscription_expires_at, created_at')
      .order('created_at', { ascending: false })

    if (usersError) {
      return jsonResponse(500, { error: usersError.message })
    }

    return jsonResponse(200, { users: users ?? [] })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
