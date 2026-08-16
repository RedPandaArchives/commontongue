import { createClient } from "@supabase/supabase-js";

// The anon key is meant to be public — it's protected by Row Level Security
// on the database, not by secrecy. This is why it's safe in frontend code,
// unlike the Anthropic/DeepL key which must stay on the server.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
