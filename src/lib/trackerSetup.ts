// Shared helpers for the DelCargo Tracker desktop agent's one-time setup
// code — used by both the HR/Admin Setup Agent modal (TrackingView.tsx)
// and the employee self-service setup card (employee/tracker/page.tsx), so
// the encoding logic only lives in one place.
//
// Format must stay in sync with decode_setup_code() in
// tracker-agent/agent_gui.py: base64url of JSON {"u": pocketbaseUrl,
// "t": agentToken}. The old "k" (Supabase anon key) field has been removed;
// PocketBase's public collections require no API key for reads/writes.

export const TRACKER_RELEASES_URL = 'https://github.com/SPARXzeux/HR-Web-App/releases';

// Direct-download links to the actual installer files, instead of sending
// people to the GitHub Releases page and making them find/click the right
// asset themselves. GitHub's "/latest/download/<filename>" path always
// redirects to whichever release was published most recently (from the
// "tracker-agent-v*" tag build — see .github/workflows/build-tracker-agent.yml)
// and serves the file with a Content-Disposition: attachment header, so the
// browser starts downloading immediately instead of navigating to a page.
// Filenames must stay in sync with that workflow's release asset names.
export const TRACKER_DOWNLOAD_WINDOWS_URL = 'https://github.com/SPARXzeux/HR-Web-App/releases/latest/download/DelCargo_Tracker_Setup.exe';
export const TRACKER_DOWNLOAD_MAC_URL = 'https://github.com/SPARXzeux/HR-Web-App/releases/latest/download/DelCargo-Tracker-Mac.zip';

/** Best-effort OS guess from the browser, used only to default which
 * download button we highlight — both are always shown regardless. */
export function detectOS(): 'windows' | 'mac' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'mac';
  return 'other';
}

/** The PocketBase server URL used by both the web app and tracker agents. */
export const POCKETBASE_URL = 'http://157.230.7.89';

export function encodeSetupCode(url: string, token: string): string {
  const json = JSON.stringify({ u: url, t: token });
  if (typeof window === 'undefined') return '';
  // Use TextEncoder to handle UTF-8 safely instead of deprecated unescape()
  const utf8Bytes = new TextEncoder().encode(json);
  const binaryString = Array.from(utf8Bytes).map(byte => String.fromCharCode(byte)).join('');
  const b64 = window.btoa(binaryString);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns the PocketBase server URL for tracker agent setup. No anon key needed. */
export function getPocketBaseConfig(): { url: string } {
  return {
    url: POCKETBASE_URL,
  };
}
