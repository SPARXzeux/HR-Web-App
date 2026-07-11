// DEPRECATED — superseded by src/lib/hrData.ts (2026-07-09 migration off
// localStorage). This was the old localStorage-first data layer whose
// syncFromSupabase() was never actually called anywhere, causing the app to
// silently fall back to hardcoded fake seed data on every fresh
// browser/device. Nothing in the app imports from this file anymore
// (verified via repo-wide grep). Kept as an empty stub rather than deleted
// because this tool session has no file-delete capability — safe to delete
// this file manually.
export {};
