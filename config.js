// TADEX Hub configuration.
// Supabase project "tadex-hub" (eu-central-1). Publishable (anon) key only. NEVER a secret/service_role key.
// The anon key is public by design. Access is enforced by Row Level Security (see supabase/setup.sql).
// Leave both empty to keep the hub in "not connected" mode.
// Browser traffic goes through our own domain (vercel.json rewrite /sb/* -> the Supabase project), so
// sign-in works where *.supabase.co is slow or blocked (China). Servers verify tokens against the project directly.
export const SUPABASE_PROJECT_URL = "https://ichcxptnnzakwzlmixvk.supabase.co";
export const SUPABASE_URL = location.origin + "/sb";
// Same localStorage key as before the proxy (derived from the project ref), so existing sessions survive
// and the calculator/CRM/Ponude (same origin) share the session.
export const SUPABASE_STORAGE_KEY = "sb-ichcxptnnzakwzlmixvk-auth-token";
export const SUPABASE_ANON_KEY = "sb_publishable_Jmg77iLX836M9HwOju8LdA_7_W7cTBo";
