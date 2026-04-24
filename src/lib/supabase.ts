import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PROJECT_URL_SUPABASE || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.ANON_PUBLIC_SUPABASE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRole = process.env.SERVICE_ROLE_SUPABASE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  console.warn('⚠️ Advertencia: NEXT_PUBLIC_SUPABASE_URL no está configurada.');
}

// Client for public access (respects RLS)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

// Client for backend admin access (bypasses RLS)
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseServiceRole || 'placeholder'
);
