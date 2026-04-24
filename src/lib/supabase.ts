import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PROJECT_URL_SUPABASE || '';
const supabaseAnonKey = process.env.ANON_PUBLIC_SUPABASE || '';
const supabaseServiceRole = process.env.SERVICE_ROLE_SUPABASE || '';

// Client for public access (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for backend admin access (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);
