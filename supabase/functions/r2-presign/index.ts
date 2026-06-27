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

// Presigned URL expiry. Short-lived: a single upload/delete only needs a few
// seconds. Reused for both PUT (upload) and DELETE.
const PRESIGN_EXPIRY_SECONDS = 600

// Cap on keys per delete request to bound the work a single call can do.
const MAX_DELETE_KEYS = 1000

const encodeKeyPath = (key: string): string =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

// Validate that `key` is one this caller is allowed to mutate (PUT or DELETE),
// mirroring the existing Supabase Storage RLS:
//   user-images/{uid}/...   -> only the owning user
//   default-images/...      -> admins only
// Returns null when authorized, or a Response describing the rejection.
const authorizeKey = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  isAdmin: () => Promise<boolean>,
  key: string,
): Promise<Response | null> => {
  // Reject path traversal / empty segments.
  if (key.includes('..') || key.includes('//')) {
    return json({ error: `Invalid key: ${key}` }, 400)
  }

  const segments = key.split('/')
  const logicalBucket = segments[0]

  if (logicalBucket === 'user-images') {
    if (segments[1] !== userId) {
      return json({ error: `Forbidden: key is outside your namespace: ${key}` }, 403)
    }
    return null
  }
  if (logicalBucket === 'default-images') {
    if (!(await isAdmin())) {
      return json({ error: 'Forbidden: admin only' }, 403)
    }
    return null
  }
  return json({ error: `Forbidden: unsupported bucket prefix: ${key}` }, 403)
}

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

    // Lazily resolve admin role and memoize: a multi-key delete only needs one
    // profiles lookup even when several default-images keys are requested.
    let adminChecked = false
    let adminResult = false
    const isAdmin = async (): Promise<boolean> => {
      if (adminChecked) return adminResult
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      adminResult = profile?.role === 'admin'
      adminChecked = true
      return adminResult
    }

    const body = await req.json().catch(() => null)
    // `op` selects the operation; defaults to 'put' for backward compatibility
    // with existing upload callers that only send { key, contentType }.
    const op = typeof body?.op === 'string' ? body.op : 'put'

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

    const buildEndpoint = (key: string): string =>
      `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeKeyPath(key)}` +
      `?X-Amz-Expires=${PRESIGN_EXPIRY_SECONDS}`

    if (op === 'delete') {
      // Accept a single { key } or a batch { keys: [...] }. Each key is checked
      // against the same permission model as PUT, then deleted server-side so
      // R2 credentials never reach the client.
      const rawKeys: unknown = Array.isArray(body?.keys)
        ? body.keys
        : typeof body?.key === 'string'
          ? [body.key]
          : []

      const keys = (rawKeys as unknown[])
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.replace(/^\/+/, ''))
        .filter(Boolean)

      if (keys.length === 0) {
        return json({ error: 'Missing key(s)' }, 400)
      }
      if (keys.length > MAX_DELETE_KEYS) {
        return json({ error: `Too many keys (max ${MAX_DELETE_KEYS})` }, 400)
      }

      // Authorize every key before deleting any: an all-or-nothing check keeps
      // the symmetry with PUT (one key, one permission decision).
      for (const key of keys) {
        const rejection = await authorizeKey(supabase, user.id, isAdmin, key)
        if (rejection) return rejection
      }

      const results: Array<{ key: string; ok: boolean; status: number }> = []
      for (const key of keys) {
        const signed = await r2.sign(buildEndpoint(key), {
          method: 'DELETE',
          aws: { signQuery: true },
        })
        const res = await fetch(signed.url, { method: 'DELETE' })
        // R2/S3 DELETE is idempotent: a missing object returns 204, so any
        // 2xx (and 404) is treated as success.
        const ok = res.ok || res.status === 404
        results.push({ key, ok, status: res.status })
        // Drain the body so the connection can be reused.
        await res.arrayBuffer().catch(() => undefined)
      }

      const failed = results.filter((r) => !r.ok)
      if (failed.length > 0) {
        return json({ error: 'One or more deletes failed', results }, 502)
      }
      return json({ deleted: results.map((r) => r.key) })
    }

    // Default op: presigned PUT for uploads.
    const key = typeof body?.key === 'string' ? body.key.replace(/^\/+/, '') : ''
    const contentType =
      typeof body?.contentType === 'string' ? body.contentType : 'application/octet-stream'

    if (!key) {
      return json({ error: 'Missing key' }, 400)
    }

    const rejection = await authorizeKey(supabase, user.id, isAdmin, key)
    if (rejection) return rejection

    const signed = await r2.sign(buildEndpoint(key), {
      method: 'PUT',
      aws: { signQuery: true },
    })

    return json({ url: signed.url, key, contentType })
  } catch (error) {
    return json({ error: (error as Error).message }, 500)
  }
})
