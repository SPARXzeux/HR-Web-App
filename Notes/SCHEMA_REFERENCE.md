# Delcargo HR — Confirmed live PocketBase schema (source: pb_schema_recent.json + live sampling, 2026-07-09)

Only `hr_*` collections belong to this app. Do not touch `users`, `packages`, `warehouse`, `login_history`.

## hr_profiles (populated, real data — 7 rows)
full_name, email, role, joined_date, onboarding_completed(bool), base_salary(num), teams(json),
password, is_team_lead(text "true"/"false"!), lead_teams(json), job_title, gender, bank_name,
account_number, iban, profile_picture, region, assigned_warehouses(json), tracking_enabled(bool),
is_warehouse_lead(bool), managed_warehouses(json), salary_start_date
NOTE: no offboarding/document columns exist — keep the hr_delcargo_store overlay
(key hr_profile_extra_<id>) for: offboarded, offboardDate, offboardingStatus,
lastIncrementProcessedYear, cvFileName, cvFileData, identityDocs, passportFileName, passportFileData.

## hr_leaves (matches app model)
employee_name, type, duration, reason, status

## hr_notifications (matches app model)
recipient_email, recipient_role, message, timestamp, read(bool)
BUG FOUND: hr/leaves/page.tsx used to write {userId, type} instead of
{recipient_email, recipient_role} — fixed during migration to hrData.ts.

## hr_warehouses (matches app model)
name, latitude(num), longitude(num), radius(num)

## hr_tasks (matches app model exactly)
title, description, assigned_to, assigned_email, team, due_date, priority, status, created_by

## hr_announcements (matches app model)
title, content, author, author_role, pinned(bool), target_role, timestamp, created_by, target

## hr_careers (matches app model)
title, department, location, type, description, requirements(json), status, created_by

## hr_career_applications (matches app model)
position_id, position_title, applicant_name, applicant_email, phone, cover_letter, resume_url,
status, submitted_at

## hr_tickets (DID NOT MATCH app model — app used "title", real field is "subject")
employee_email, employee_name, subject, description, status, priority, category, assigned_to,
resolution, replies(json)
NOTE: no created_at/created_by field — use PocketBase's own `created` system field.

## hr_payroll (mostly matches, has extra month/year + a duplicate name field)
employee_email, employee_name, employee_name2(!! duplicate/likely accidental, ignore on write),
month, year(num), base_salary(num), bonus(num), deductions(num), net_pay(num), status, paid_date,
employee_id, role, region, unpaid_leaves(num), processed(bool), increment_amount(num)
NOTE: live hr_payroll had 7 rows all zeroed out (created 2026-07-09, a bad auto-seed) — real
payroll history was sitting in hr_delcargo_store key "hr_payroll_prod_v1" (4 employees) and an
older "hr_payroll_v6" (2 seed accounts). Run migration_data/migrate_kv_to_collections.mjs once to
move it over.

## hr_teams (richer than old app model — adopted real structure)
name, lead_email, members(json array of emails), warehouse_id
KV data migrated in from hr_custom_teams_prod_v1 = ["Operations","BG Backend Support",
"Customer Support","SHIPPING"] via migration_data/migrate_kv_to_collections.mjs (members
backfilled from each profile's existing teams[] array).

## hr_timesheets (schema fixed by user 2026-07-09 — see below)
employee_id (stores employee email, matching the app's employeeEmail convention everywhere else),
date(date type), clock_in(text), clock_out(text), hours_worked(num), break_duration(num),
status(select: pending|approved|rejected — no "in_progress"), notes, duration(text)
listRule/viewRule/createRule/updateRule/deleteRule were `null` (superuser-only) — user cleared
these in the PocketBase admin UI on 2026-07-09, now public like every other hr_ collection.
DESIGN ADAPTATION: the fixed status enum doesn't have an "in_progress" value for open shifts.
hrData.ts uses presence/absence of clock_out to represent open/closed shift state (open =
clock_out empty), and treats `status` as a separate HR-approval flag layered on top (defaults to
"pending"; HR can set "approved"/"rejected" for a timesheet-approval workflow, independent of
clock in/out state). See TimesheetEntry.status ('in_progress'|'completed', derived) vs
TimesheetEntry.approvalStatus ('pending'|'approved'|'rejected', the real PocketBase field).

## hr_delcargo_store (generic KV, real collection — NOT localStorage)
key(text), value(json). Still legitimately used post-migration for: profile extras overlay,
tracking settings (hr_tracking_settings_prod_v1), screenshots (screenshot_<id> rows), tracker
heartbeats (tracker_heartbeat_<slug>), screenshot retention state, notification read/cleared
per-user maps (hr_notification_reads_prod_v1 / hr_notification_cleared_prod_v1), deleted-profile
tombstones (hr_deleted_profile_emails_v1). This is server storage, not localStorage — keeping it
here is fine; it's the *reading pattern* (never caching to localStorage as source of truth) that
changed.

## src/lib/hrData.ts
Single source of truth for all PocketBase access going forward. Query hooks (useProfiles,
useLeaves, useNotifications, useWarehouses, useTasks, useAnnouncements, useCareers,
useCareerApplications, useTickets, usePayroll, useTeams, useTimesheets, useKVByPrefix) — React
Query, in-memory cache only. Mutations via `hrActions.*`. No page/component should call
`pb.collection(...)` directly anymore; import from `@/lib/hrData` instead of `@/lib/db` or
`@/hooks/useQueries` (both now superseded — see migration task in progress).
