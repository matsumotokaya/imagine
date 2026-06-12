import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

let supabasePromise: Promise<SupabaseClient> | null = null;

const createSupabaseClient = async () => {
  const { createClient } = await import('@supabase/supabase-js');

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'banalist-web',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
};

export const getSupabase = () => {
  if (!supabasePromise) {
    supabasePromise = createSupabaseClient();
  }

  return supabasePromise;
};

export const getSupabaseStoragePublicUrl = (bucket: string, storagePath: string) => {
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
};
