import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder';

export function createClient() {
  return createBrowserClient<Database>(URL, KEY);
}

let browserClient: ReturnType<typeof createClient> | null = null;
export function getClient() {
  if (!browserClient) browserClient = createClient();
  return browserClient;
}

export const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co';
