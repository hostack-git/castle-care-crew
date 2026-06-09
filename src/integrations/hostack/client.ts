import { createClient } from '@supabase/supabase-js';

export const hostackSupabase = createClient(
  'https://yskzkobduekupiobrbxr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlza3prb2JkdWVrdXBpb2JyYnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjAxNjAsImV4cCI6MjA5MDEzNjE2MH0.5t6mm90F7k_8zXVVzUJAYzFA4IoNdTm6-UTRWFzsjfg',
  {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export const TORRIDONIA_PROPERTY_ID = 'bf2720e8-eb8a-4c7e-9742-6b0dfe9e636a';
export const HOSTACK_SUPABASE_URL = 'https://yskzkobduekupiobrbxr.supabase.co';
