// src/supabase-config.js
import { createClient } from '@supabase/supabase-js';

// =====================================================================
// ⚠️ REPLACE WITH YOUR SUPABASE PROJECT DETAILS
// =====================================================================
// You can paste your credentials directly below OR set them in your .env file
// as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'REPLACE_WITH_YOUR_SUPABASE_URL';
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY';

// Utility helper to check if real credentials have been supplied
export const isSupabaseConfigured = () => {
  return (
    supabaseUrl &&
    supabaseUrl !== 'REPLACE_WITH_YOUR_SUPABASE_URL' &&
    supabaseUrl.startsWith('http') &&
    supabaseKey &&
    supabaseKey !== 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY'
  );
};

// Use a safe fallback URL if not configured to prevent startup crashes in sandbox mode
const safeUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = isSupabaseConfigured() ? supabaseKey : 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);
