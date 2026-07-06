import { createClient } from '@supabase/supabase-js';

// Supabase credentials for direct testing and deployment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pftbzajbfelexyyhqmef.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fqs9oSIYNtzkhqOa-xzAjg_9DxUGbAI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
