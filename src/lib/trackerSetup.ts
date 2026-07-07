// Shared helpers for the DelCargo Tracker desktop agent's one-time setup
// code — used by both the HR/Admin Setup Agent modal (TrackingView.tsx)
// and the employee self-service setup card (employee/tracker/page.tsx), so
// the encoding logic only lives in one place.
//
// Format must stay in sync with decode_setup_code() in
// tracker-agent/agent_gui.py: base64url of JSON {"u": supabaseUrl,
// "k": anonKey, "t": agentToken}.

export const TRACKER_RELEASES_URL = 'https://github.com/SPARXzeux/HR-Web-App/releases';

export function encodeSetupCode(url: string, key: string, token: string): string {
  const json = JSON.stringify({ u: url, k: key, t: token });
  if (typeof window === 'undefined') return '';
  // btoa is ASCII-only; escape/encodeURIComponent round-trip handles UTF-8 safely.
  const b64 = window.btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getSupabasePublicConfig(): { url: string; key: string } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pftbzajbfelexyyhqmef.supabase.co',
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fqs9oSIYNtzkhqOa-xzAjg_9DxUGbAI',
  };
}
