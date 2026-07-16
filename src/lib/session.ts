// Thin wrapper around the browser session-identity storage used across the
// dashboard. Login (src/app/auth/page.tsx) writes here via setSession();
// every other page that needs "who is logged in" should read through
// getSessionEmail()/getSessionRole() instead of hitting localStorage
// directly, so the "Remember me" checkbox on the login screen actually has
// an effect everywhere, not just at the moment of logging in.
//
// Remember me checked   -> localStorage   (survives closing the browser)
// Remember me unchecked -> sessionStorage (cleared when the tab/browser closes)

const EMAIL_KEY = 'user_email';
const ROLE_KEY = 'user_role';
const TOKEN_KEY = 'session_token';

export function setSession(email: string, role: string, remember: boolean, sessionToken?: string): void {
  if (typeof window === 'undefined') return;
  const primary = remember ? window.localStorage : window.sessionStorage;
  const other = remember ? window.sessionStorage : window.localStorage;
  primary.setItem(EMAIL_KEY, email);
  primary.setItem(ROLE_KEY, role);
  if (sessionToken) primary.setItem(TOKEN_KEY, sessionToken);
  else primary.removeItem(TOKEN_KEY);
  // Clear any stale copy left in the other storage — e.g. logging back in
  // without "Remember me" after a previous session had it checked.
  other.removeItem(EMAIL_KEY);
  other.removeItem(ROLE_KEY);
  other.removeItem(TOKEN_KEY);
}

export function getSessionEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(EMAIL_KEY) || window.sessionStorage.getItem(EMAIL_KEY);
}

export function getSessionRole(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ROLE_KEY) || window.sessionStorage.getItem(ROLE_KEY);
}

// Random per-login token used to enforce "one active session" for Employee
// (and Team Lead) accounts — see hrActions.claimUserSession/touchUserSession
// in hrData.ts. Not used for Admin/HR, who may be signed in from multiple
// places at once.
export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY);
}

export function generateSessionToken(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// Best-effort human-readable "which browser/device" label, shown to a user
// who gets blocked from logging in because another session is still live —
// mirrors the tracker agent's own device_label concept (agent_gui.py).
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'another device';
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' on ') || 'another device';
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(EMAIL_KEY);
  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(EMAIL_KEY);
  window.sessionStorage.removeItem(ROLE_KEY);
  window.sessionStorage.removeItem(TOKEN_KEY);
}
