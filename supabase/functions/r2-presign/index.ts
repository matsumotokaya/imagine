import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Presigned PUT expiry. Short-lived: an upload only needs a few seconds.
const PRESIGN_EXPIRY_SECONDS = 600

// Validate that `key` is one this user is allowed to write, mirroring the
// existing Supabase Storage RLS:
//   user-images/{uid}/...   -> only the owning user
//   default-images/...      -> admins only
const encodeKeyPath = (key: string): string =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Server is missing Supabase configuration' }, 500)
    }

    // User-scoped client: getUser() verifies the JWT and yields the caller.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Invalid or expired session' }, 401)
    }

    const body = await req.json().catch(() => null)
    const key = typeof body?.key === 'string' ? body.key.replace(/^\/+/, '') : ''
    const contentType =
      typeof body?.contentType === 'string' ? body.contentType : 'application/octet-stream'

    if (!key) {
      return json({ error: 'Missing key' }, 400)
    }
    // Reject path traversal / empty segments.
    if (key.includes('..') || key.includes('//')) {
      return json({ error: 'Invalid key' }, 400)
    }

    const segments = key.split('/')
    const logicalBucket = segments[0]

    if (logicalBucket === 'user-images') {
      if (segments[1] !== user.id) {
        return json({ error: 'Forbidden: key is outside your namespace' }, 403)
      }
    } else if (logicalBucket === 'default-images') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role !== 'admin') {
        return json({ error: 'Forbidden: admin only' }, 403)
      }
    } else {
      return json({ error: 'Forbidden: unsupported bucket prefix' }, 403)
    }

    const accountId = Deno.env.get('R2_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const bucket = Deno.env.get('R2_BUCKET')
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      return json({ error: 'Server is missing R2 configuration' }, 500)
    }

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    })

    const endpoint =
      `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeKeyPath(key)}` +
      `?X-Amz-Expires=${PRESIGN_EXPIRY_SECONDS}`

    const signed = await r2.sign(endpoint, {
      method: 'PUT',
      aws: { signQuery: true },
    })

    return json({ url: signed.url, key, contentType })
  } catch (error) {
    return json({ error: (error as Error).message }, 500)
  }
})
