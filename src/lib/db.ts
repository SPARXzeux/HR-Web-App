'use client';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: 'employee' | 'hr' | 'admin' | 'team_lead';
  joinedDate: string;
  onboardingCompleted: boolean;
  baseSalary: number;
  teams: string[];
  password?: string;
  isTeamLead?: boolean;
  leadTeams?: string[]; // teams this person is lead of
  isWarehouseLead?: boolean;
  managedWarehouses?: string[]; // warehouses this person manages
  jobTitle?: string;
  gender?: 'male' | 'female';
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  profilePicture?: string; // base64 string
  region?: 'USA' | 'Pakistan';
  assignedWarehouses?: string[];
  trackingEnabled?: boolean;
  offboarded?: boolean;
  offboardDate?: string;
  salaryStartDate?: string;
  offboardingStatus?: {
    itClearance: boolean;
    financeClearance: boolean;
    hrClearance: boolean;
    notes?: string;
    finalLeavePayout?: number; // full payout of remaining PTO/Sick bank at contract end
  };
  // Calendar year in which this employee's anniversary salary increment was
  // last actually folded into baseSalary (permanently). Prevents the same
  // year's increment from being applied twice if payroll is processed more
  // than once during the anniversary month.
  lastIncrementProcessedYear?: number;
}

export interface Warehouse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  createdBy: string;
  target: 'all' | 'usa' | 'pakistan' | string[]; // specific warehouse IDs
}

export interface LeaveApplication {
  id: string;
  employeeName: string;
  type: 'PTO' | 'Sick Leave' | 'Urgent' | 'Parental Leave';
  duration: string;
  reason: string;
  status: 'pending' | 'hr_approved' | 'approved' | 'rejected';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;       // employee fullName
  assignedEmail: string;
  team: string;
  dueDate: string;          // 'YYYY-MM-DD'
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  createdBy: string;        // role that created it
}

// A real clock-in/clock-out shift record. Created the moment an employee's
// shift actually starts (geofence entry for USA, manual button for remote)
// and completed the moment it actually ends — no simulated/randomized data.
export interface TimesheetEntry {
  id: string;
  employeeEmail: string;
  date: string;             // 'YYYY-MM-DD', the day the shift started
  clockIn: string;           // ISO timestamp
  clockOut?: string;         // ISO timestamp, set once the shift ends
  duration?: string;         // formatted "Xh Ym", computed once the shift ends
  status: 'in_progress' | 'completed';
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  region?: 'USA' | 'Pakistan';
  baseSalary: number;
  unpaidLeaves: number;
  bonus: number;
  deductions: number;
  processed: boolean;
  // Pending anniversary increment for THIS cycle only (0 unless this is the
  // employee's anniversary month and it hasn't been processed yet this
  // year). Shown as a distinct payslip line item. Once this record is
  // processed, the amount is folded permanently into the employee's real
  // baseSalary and this goes back to 0 for all future cycles.
  incrementAmount: number;
}

export interface Notification {
  id: string;
  recipientEmail: string;
  recipientRole: string;
  message: string;
  // `read` is only meaningful for notifications addressed to a single real
  // email (recipientEmail !== 'all'). For role-broadcast notifications
  // (recipientEmail === 'all'), per-user read state is tracked separately
  // in the `hr_notification_reads_prod_v1` KV store (see
  // markNotificationsAsRead/isNotificationRead) rather than as a column on
  // this row — this avoids requiring a new `profiles`/`notifications` table
  // column while the app is in its "don't touch the database schema" phase.
  read: boolean;
  timestamp: string;
}

// { [notificationId]: string[] of emails who've read this broadcast
// notification }. Stored via the generic delcargo_store KV table so no
// new Supabase table/column is required.
type NotificationReadMap = Record<string, string[]>;

export interface CareerPosition {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string[];
}

export interface CareerApplication {
  id: string;
  positionId: string;
  positionTitle: string;
  applicantName: string;
  applicantEmail: string;
  coverLetter: string;
  submittedAt: string;
}

export interface TicketReply {
  id: string;
  senderName: string;
  senderRole: 'employee' | 'hr' | 'admin' | 'team_lead';
  message: string;
  timestamp: string;
}

export interface Ticket {
  id: string;
  employeeName: string;
  employeeEmail: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  createdAt: string;
  replies: TicketReply[];
}

const isClient = typeof window !== 'undefined';

// Single source of truth for "daily salary rate" across the app (leave
// cash-out payouts, final settlement payout, urgent-leave deductions).
// Previously the urgent-leave deduction used ÷30 while every other daily-
// rate calculation used ÷22 (working days/month per the PTO policy) —
// standardizing on 22 here so all salary-per-day math agrees.
const WORKING_DAYS_PER_MONTH = 22;

const defaultEmployees: Profile[] = [
  { id: 'emp_admin', fullName: 'Admin', email: 'admin@delcargo.us', role: 'admin', joinedDate: '2026-07-01', onboardingCompleted: true, baseSalary: 12000, teams: [], password: 'Aamir@123', jobTitle: 'System Administrator', gender: 'male', region: 'USA', assignedWarehouses: [], bankName: '', accountNumber: '', iban: '', trackingEnabled: false },
  { id: 'emp_hr', fullName: 'HR Admin', email: 'hr@delcargo.us', role: 'hr', joinedDate: '2026-07-01', onboardingCompleted: true, baseSalary: 9500, teams: [], password: 'HR@123', jobTitle: 'HR Director', gender: 'male', region: 'USA', assignedWarehouses: [], bankName: '', accountNumber: '', iban: '', trackingEnabled: false }
];

const defaultWarehouses: Warehouse[] = [
  { id: 'wh_1', name: 'New York JFK Center', latitude: 40.6413, longitude: -73.7781, radius: 500 },
  { id: 'wh_2', name: 'Chicago O\'Hare Hub', latitude: 41.9742, longitude: -87.9073, radius: 600 },
  { id: 'wh_3', name: 'Houston Intercontinental Storage', latitude: 29.9902, longitude: -95.3368, radius: 450 }
];

const defaultAnnouncements: Announcement[] = [];

const defaultLeaves: LeaveApplication[] = [];

const defaultTasks: Task[] = [];

const defaultCareers: CareerPosition[] = [];

const defaultTickets: Ticket[] = [];

let lastSyncError: string | null = null;

async function syncFromSupabase() {
  if (typeof window === 'undefined') return;
  try {
    // Fetch all datasets in parallel to reduce load time
    const [
      resProfiles,
      resLeaves,
      resTasks,
      resTimesheets,
      resAnnouncements,
      resNotifications,
      resWarehouses,
      resStore
    ] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('leaves').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('timesheets').select('*'),
      supabase.from('announcements').select('*'),
      supabase.from('notifications').select('*'),
      supabase.from('warehouses').select('*'),
      supabase.from('delcargo_store').select('*')
    ]);

    const queryError = resProfiles.error || resLeaves.error || resTasks.error || resTimesheets.error || resAnnouncements.error || resNotifications.error || resWarehouses.error || resStore.error;
    if (queryError) {
      lastSyncError = `Supabase Query Error: ${queryError.message} (Code: ${queryError.code})`;
      console.error('[Supabase Sync] Query Error:', queryError);
    } else {
      lastSyncError = null;
    }

    const dbProfiles = resProfiles.data;
    const dbLeaves = resLeaves.data;
    const dbTasks = resTasks.data;
    const dbTimesheets = resTimesheets.data;
    const dbAnnouncements = resAnnouncements.data;
    const dbNotifications = resNotifications.data;
    const dbWarehouses = resWarehouses.data;
    const kvStore = resStore.data;

    let finalProfiles = dbProfiles || [];
    const hasAdmin = finalProfiles.some(p => p.email === 'admin@delcargo.us');
    const hasHr = finalProfiles.some(p => p.email === 'hr@delcargo.us');
    const missingSeeds = [];
    if (!hasAdmin) {
      const p = defaultEmployees[0];
      missingSeeds.push({
        id: p.id, full_name: p.fullName, email: p.email, role: p.role, joined_date: p.joinedDate, onboarding_completed: p.onboardingCompleted, base_salary: p.baseSalary, teams: p.teams, password: p.password, is_team_lead: p.isTeamLead, lead_teams: p.leadTeams, job_title: p.jobTitle, gender: p.gender, bank_name: p.bankName, account_number: p.accountNumber, iban: p.iban, profile_picture: p.profilePicture, region: p.region, assigned_warehouses: p.assignedWarehouses, tracking_enabled: p.trackingEnabled
      });
    }
    if (!hasHr) {
      const p = defaultEmployees[1];
      missingSeeds.push({
        id: p.id, full_name: p.fullName, email: p.email, role: p.role, joined_date: p.joinedDate, onboarding_completed: p.onboardingCompleted, base_salary: p.baseSalary, teams: p.teams, password: p.password, is_team_lead: p.isTeamLead, lead_teams: p.leadTeams, job_title: p.jobTitle, gender: p.gender, bank_name: p.bankName, account_number: p.accountNumber, iban: p.iban, profile_picture: p.profilePicture, region: p.region, assigned_warehouses: p.assignedWarehouses, tracking_enabled: p.trackingEnabled
      });
    }
    if (missingSeeds.length > 0) {
      await supabase.from('profiles').upsert(missingSeeds);
      const { data: refetched } = await supabase.from('profiles').select('*');
      if (refetched) finalProfiles = refetched;
    }

    if (finalProfiles.length > 0) {
      const dbEmails = new Set(finalProfiles.map(p => p.email.toLowerCase()));
      const localProfiles = (() => {
        try {
          const raw = localStorage.getItem('hr_employees_prod_v1');
          return raw ? JSON.parse(raw) as Profile[] : [];
        } catch {
          return [];
        }
      })();

      // Tombstone list of permanently-deleted employee emails, synced via the
      // generic delcargo_store KV table (see deleteEmployee()). Without this,
      // any device whose local cache still has a profile that was deleted
      // from Supabase by ANOTHER user/device would misclassify it as a
      // "local-only, not-yet-synced" profile below and re-upload it —
      // resurrecting deleted/offboarded accounts forever.
      const deletedEmailsRow = kvStore?.find((row: any) => row.key === 'hr_deleted_profile_emails_v1');
      const deletedEmails = new Set<string>(
        (Array.isArray(deletedEmailsRow?.value) ? deletedEmailsRow.value : []).map((e: string) => e.toLowerCase())
      );
      if (deletedEmails.size > 0) {
        localStorage.setItem('hr_deleted_profile_emails_v1', JSON.stringify(Array.from(deletedEmails)));
      }

      const localOnly = localProfiles.filter(p =>
        p && p.email &&
        !dbEmails.has(p.email.toLowerCase()) &&
        !deletedEmails.has(p.email.toLowerCase())
      );

      if (localOnly.length > 0) {
        console.log(`[Supabase Sync] Migrating ${localOnly.length} local-only profiles to Supabase...`);
        const rowsToSync = localOnly.map(p => ({
          id: p.id,
          full_name: p.fullName || '',
          email: p.email || '',
          role: p.role || 'employee',
          joined_date: p.joinedDate || new Date().toISOString().split('T')[0],
          onboarding_completed: p.onboardingCompleted !== undefined ? p.onboardingCompleted : false,
          base_salary: p.baseSalary || 0,
          teams: p.teams || [],
          password: p.password || 'employee123',
          is_team_lead: p.isTeamLead !== undefined ? p.isTeamLead : false,
          lead_teams: p.leadTeams || [],
          is_warehouse_lead: p.isWarehouseLead !== undefined ? p.isWarehouseLead : false,
          managed_warehouses: p.managedWarehouses || [],
          job_title: p.jobTitle || 'Staff',
          gender: p.gender || 'male',
          bank_name: p.bankName || null,
          account_number: p.accountNumber || null,
          iban: p.iban || null,
          profile_picture: p.profilePicture || null,
          region: p.region || 'Pakistan',
          assigned_warehouses: p.assignedWarehouses || [],
          tracking_enabled: p.trackingEnabled !== undefined ? p.trackingEnabled : true,
          salary_start_date: p.salaryStartDate || p.joinedDate || null
        }));
        
        supabase.from('profiles').upsert(rowsToSync).then(({ error }) => {
          if (error) {
            console.error('[Supabase Sync] Auto-migration error:', error);
          } else {
            console.log('[Supabase Sync] Auto-migration completed successfully.');
          }
        });
      }

      const mappedDb = finalProfiles.map(p => ({
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        role: p.role,
        joinedDate: p.joined_date,
        onboardingCompleted: p.onboarding_completed,
        baseSalary: Number(p.base_salary),
        teams: p.teams || [],
        password: p.password,
        isTeamLead: p.is_team_lead,
        leadTeams: p.lead_teams || [],
        isWarehouseLead: p.is_warehouse_lead,
        managedWarehouses: p.managed_warehouses || [],
        jobTitle: p.job_title,
        gender: p.gender,
        bankName: p.bank_name,
        accountNumber: p.account_number,
        iban: p.iban,
        profilePicture: p.profile_picture,
        region: p.region,
        assignedWarehouses: p.assigned_warehouses || [],
        trackingEnabled: p.tracking_enabled,
        salaryStartDate: p.salary_start_date || p.joined_date || ''
      }));

      const finalMapped = [...mappedDb, ...localOnly];
      localStorage.setItem('hr_employees_prod_v1', JSON.stringify(finalMapped));
    }

    // 2. Sync Leaves
    if (dbLeaves && dbLeaves.length > 0) {
      const mapped = dbLeaves.map(l => ({
        id: l.id,
        employeeName: l.employee_name,
        type: l.type,
        duration: l.duration,
        reason: l.reason,
        status: l.status
      }));
      localStorage.setItem('hr_leaves_prod_v1', JSON.stringify(mapped));
    } else {
      const seed = defaultLeaves.map(l => ({
        id: l.id,
        employee_name: l.employeeName,
        type: l.type,
        duration: l.duration,
        reason: l.reason,
        status: l.status
      }));
      await supabase.from('leaves').upsert(seed);
    }

    // 3. Sync Tasks
    if (dbTasks && dbTasks.length > 0) {
      const mapped = dbTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assignedTo: t.assigned_to,
        assignedEmail: t.assigned_email,
        team: t.team,
        dueDate: t.due_date,
        priority: t.priority,
        status: t.status,
        createdBy: t.created_by
      }));
      localStorage.setItem('hr_tasks_prod_v1', JSON.stringify(mapped));
    } else {
      const seed = defaultTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assigned_to: t.assignedTo,
        assigned_email: t.assignedEmail,
        team: t.team,
        due_date: t.dueDate,
        priority: t.priority,
        status: t.status,
        created_by: t.createdBy
      }));
      await supabase.from('tasks').upsert(seed);
    }

    // 4. Sync Timesheets
    if (dbTimesheets && dbTimesheets.length > 0) {
      const mapped = dbTimesheets.map(ts => ({
        id: ts.id,
        employeeEmail: ts.employee_email,
        date: ts.date,
        clockIn: ts.clock_in,
        clockOut: ts.clock_out,
        duration: ts.duration,
        status: ts.status
        // Note: the `timesheets.score` column that used to be read/written
        // here was dead — TimesheetEntry never declared a `score` field and
        // nothing ever set or displayed one, so every write silently
        // persisted 0. Removed rather than keep round-tripping a fake value.
      }));
      localStorage.setItem('hr_timesheets_prod_v1', JSON.stringify(mapped));
    }

    // 5. Sync Announcements
    if (dbAnnouncements && dbAnnouncements.length > 0) {
      const mapped = dbAnnouncements.map(ann => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        timestamp: ann.timestamp,
        createdBy: ann.created_by,
        // Guard against null/undefined target (e.g. a row inserted outside
        // this code path) — without this, a single bad announcement row
        // used to throw here and abort syncFromSupabase entirely, silently
        // blocking the sync of profiles/tasks/everything else in the same
        // try/catch.
        target: (() => {
          if (typeof ann.target !== 'string') return ann.target ?? 'all';
          if (!ann.target.startsWith('[')) return ann.target;
          try {
            return JSON.parse(ann.target);
          } catch {
            return ann.target;
          }
        })()
      }));
      localStorage.setItem('hr_announcements_prod_v1', JSON.stringify(mapped));
    } else {
      const seed = defaultAnnouncements.map(ann => ({
        id: ann.id,
        title: ann.title,
        content: ann.content,
        timestamp: ann.timestamp,
        created_by: ann.createdBy,
        target: typeof ann.target === 'string' ? ann.target : JSON.stringify(ann.target)
      }));
      await supabase.from('announcements').upsert(seed);
    }

    // 6. Sync Notifications
    if (dbNotifications && dbNotifications.length > 0) {
      const mapped = dbNotifications.map(n => ({
        id: n.id,
        recipientEmail: n.recipient_email,
        recipientRole: n.recipient_role,
        message: n.message,
        timestamp: n.timestamp,
        read: n.read
      }));
      localStorage.setItem('hr_notifications_prod_v1', JSON.stringify(mapped));
    }

    // 7. Sync Warehouses
    if (dbWarehouses && dbWarehouses.length > 0) {
      const mapped = dbWarehouses.map(w => ({
        id: w.id,
        name: w.name,
        latitude: Number(w.latitude),
        longitude: Number(w.longitude),
        radius: Number(w.radius)
      }));
      localStorage.setItem('hr_warehouses_prod_v1', JSON.stringify(mapped));
    } else {
      const seed = defaultWarehouses.map(w => ({
        id: w.id,
        name: w.name,
        latitude: w.latitude,
        longitude: w.longitude,
        radius: w.radius
      }));
      await supabase.from('warehouses').upsert(seed);
    }

    // 8. Key-Value Sync Fallback for tickets, custom teams, careers
    if (kvStore && kvStore.length > 0) {
      kvStore.forEach((row: any) => {
        if (['hr_tickets_prod_v1', 'hr_custom_teams_prod_v1', 'hr_careers_prod_v1', 'hr_payroll_prod_v1', 'hr_notification_reads_prod_v1', 'hr_deleted_profile_emails_v1', 'hr_career_applications_prod_v1'].includes(row.key)) {
          localStorage.setItem(row.key, JSON.stringify(row.value));
        }
      });
    }

    console.log('[Supabase Sync] SQL relational databases synchronized successfully.');
  } catch (err: any) {
    lastSyncError = `Relational fetch error: ${err?.message || String(err)}`;
    console.error('[Supabase Sync] Relational fetch error:', err);
  }
}

function formatDurationBetween(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hrs}h ${mins}m`;
}

function getInitialData<T>(key: string, fallback: T): T {
  if (!isClient) return fallback;
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  return JSON.parse(data);
}

// Upserts profile rows to Supabase, self-healing if the live table is missing
// a column the app expects (e.g. after a schema drift). Rather than hard-coding
// one specific column name, this detects "column not found" errors generically
// (PostgREST code PGRST204, or Postgres code 42703) by parsing the offending
// column out of the error message, strips it from every row, and retries.
// This prevents a single missing/renamed column from silently blocking every
// employee save (which is what happened with salary_start_date previously).
async function upsertProfilesWithFallback(rows: Record<string, any>[]): Promise<void> {
  let currentRows = rows;
  const droppedColumns: string[] = [];

  for (let attempt = 0; attempt < 10; attempt++) {
    const { error } = await supabase.from('profiles').upsert(currentRows);
    if (!error) {
      if (droppedColumns.length > 0) {
        const msg = `Supabase 'profiles' table is missing column(s): ${droppedColumns.join(', ')}. Data for these fields is NOT being saved. Add them with: ALTER TABLE profiles ADD COLUMN <name> TEXT;`;
        lastSyncError = msg;
        console.warn(`[Supabase Sync] ${msg}`);
      }
      return;
    }

    const isMissingColumnError = error.code === '42703' || error.code === 'PGRST204';
    const match = error.message?.match(/'([a-z_]+)' column/i) || error.message?.match(/column "?([a-z_]+)"?/i);
    const offendingColumn = match?.[1];

    if (isMissingColumnError && offendingColumn && offendingColumn in currentRows[0]) {
      droppedColumns.push(offendingColumn);
      currentRows = currentRows.map(({ [offendingColumn]: _drop, ...rest }) => rest);
      continue; // retry without the offending column
    }

    // Not a recoverable "missing column" error — surface it and stop.
    lastSyncError = `Supabase Save Error: ${error.message} (Code: ${error.code})`;
    console.error('[Supabase Sync] Unrecoverable profiles upsert error:', error);
    throw error;
  }

  lastSyncError = 'Supabase Save Error: repeated schema mismatches while saving profiles. Check console for details.';
}

async function saveData<T>(key: string, data: T): Promise<void> {
  if (isClient) {
    localStorage.setItem(key, JSON.stringify(data));
    
    try {
      if (key === 'hr_employees_prod_v1') {
        const rows = (data as Profile[]).map(p => ({
          id: p.id,
          full_name: p.fullName || '',
          email: p.email || '',
          role: p.role || 'employee',
          joined_date: p.joinedDate || new Date().toISOString().split('T')[0],
          onboarding_completed: p.onboardingCompleted !== undefined ? p.onboardingCompleted : false,
          base_salary: p.baseSalary || 0,
          teams: p.teams || [],
          password: p.password || 'employee123',
          is_team_lead: p.isTeamLead !== undefined ? p.isTeamLead : false,
          lead_teams: p.leadTeams || [],
          is_warehouse_lead: p.isWarehouseLead !== undefined ? p.isWarehouseLead : false,
          managed_warehouses: p.managedWarehouses || [],
          job_title: p.jobTitle || 'Staff',
          gender: p.gender || 'male',
          bank_name: p.bankName || null,
          account_number: p.accountNumber || null,
          iban: p.iban || null,
          profile_picture: p.profilePicture || null,
          region: p.region || 'Pakistan',
          assigned_warehouses: p.assignedWarehouses || [],
          tracking_enabled: p.trackingEnabled !== undefined ? p.trackingEnabled : true,
          salary_start_date: p.salaryStartDate || p.joinedDate || null
        }));
        await upsertProfilesWithFallback(rows);
      } else if (key === 'hr_leaves_prod_v1') {
        const rows = (data as LeaveApplication[]).map(l => ({
          id: l.id,
          employee_name: l.employeeName || '',
          type: l.type || 'vacation',
          duration: l.duration || 1,
          reason: l.reason || '',
          status: l.status || 'pending'
        }));
        await supabase.from('leaves').upsert(rows);
      } else if (key === 'hr_tasks_prod_v1') {
        const rows = (data as Task[]).map(t => ({
          id: t.id,
          title: t.title || '',
          description: t.description || '',
          assigned_to: t.assignedTo || '',
          assigned_email: t.assignedEmail || '',
          team: t.team || 'General',
          due_date: t.dueDate || '',
          priority: t.priority || 'medium',
          status: t.status || 'todo',
          created_by: t.createdBy || 'HR'
        }));
        await supabase.from('tasks').upsert(rows);
      } else if (key === 'hr_timesheets_prod_v1') {
        const rows = (data as any[]).map(ts => ({
          id: ts.id,
          employee_email: ts.employeeEmail || '',
          date: ts.date || '',
          clock_in: ts.clockIn || '',
          clock_out: ts.clockOut || null,
          duration: ts.duration || 0,
          status: ts.status || 'pending',
          // `score` is kept here only because the live Supabase `timesheets`
          // table may have this column as NOT NULL — always written as 0
          // since nothing in the app populates or displays a real value.
          // Not read back into the app's local cache (see syncFromSupabase).
          score: 0
        }));
        await supabase.from('timesheets').upsert(rows);
      } else if (key === 'hr_announcements_prod_v1') {
        const rows = (data as Announcement[]).map(ann => ({
          id: ann.id,
          title: ann.title || '',
          content: ann.content || '',
          timestamp: ann.timestamp || '',
          created_by: ann.createdBy || 'Admin',
          target: typeof ann.target === 'string' ? ann.target : JSON.stringify(ann.target || 'all')
        }));
        await supabase.from('announcements').upsert(rows);
      } else if (key === 'hr_notifications_prod_v1') {
        const rows = (data as Notification[]).map(n => ({
          id: n.id,
          recipient_email: n.recipientEmail || '',
          recipient_role: n.recipientRole || '',
          message: n.message || '',
          timestamp: n.timestamp || '',
          read: n.read !== undefined ? n.read : false
        }));
        await supabase.from('notifications').upsert(rows);
      } else if (key === 'hr_warehouses_prod_v1') {
        const rows = (data as Warehouse[]).map(w => ({
          id: w.id,
          name: w.name,
          latitude: w.latitude,
          longitude: w.longitude,
          radius: w.radius
        }));
        await supabase.from('warehouses').upsert(rows);
      } else {
        // Fallback key-value upsert for custom teams, support tickets, career positions
        await supabase.from('delcargo_store').upsert({ key: key, value: data });
      }
      console.log(`[Supabase Sync] Saved SQL/KV key ${key} successfully.`);
    } catch (err: any) {
      console.error(`[Supabase Sync] Unexpected save error for ${key}:`, err);
    }
  }
}

export const db = {
  syncFromSupabase,
  getEmployees: (): Profile[] => getInitialData('hr_employees_prod_v1', defaultEmployees),
  saveEmployees: (data: Profile[]) => saveData('hr_employees_prod_v1', data),

  getLeaves: (): LeaveApplication[] => getInitialData('hr_leaves_prod_v1', defaultLeaves),
  saveLeaves: (data: LeaveApplication[]) => saveData('hr_leaves_prod_v1', data),

  getTasks: (): Task[] => getInitialData('hr_tasks_prod_v1', defaultTasks),
  saveTasks: (data: Task[]) => saveData('hr_tasks_prod_v1', data),

  getCareers: (): CareerPosition[] => getInitialData('hr_careers_prod_v1', defaultCareers),
  saveCareers: (data: CareerPosition[]) => saveData('hr_careers_prod_v1', data),

  getTickets: (): Ticket[] => getInitialData('hr_tickets_prod_v1', defaultTickets),
  saveTickets: (data: Ticket[]) => saveData('hr_tickets_prod_v1', data),

  // Lightweight, ticket-only re-fetch from Supabase (rather than the full
  // 8-table syncFromSupabase). Lets the tickets view poll frequently for
  // near-real-time updates without hammering every table on every tick.
  refreshTickets: async (): Promise<Ticket[]> => {
    try {
      const { data, error } = await supabase
        .from('delcargo_store')
        .select('value')
        .eq('key', 'hr_tickets_prod_v1')
        .maybeSingle();

      if (error) {
        console.error('[Supabase Sync] Ticket refresh error:', error);
        return db.getTickets();
      }

      const freshTickets: Ticket[] = (data?.value as Ticket[]) || [];
      if (isClient) {
        localStorage.setItem('hr_tickets_prod_v1', JSON.stringify(freshTickets));
      }
      return freshTickets;
    } catch (err: any) {
      console.error('[Supabase Sync] Unexpected ticket refresh error:', err);
      return db.getTickets();
    }
  },

  createTicket: async (ticket: Omit<Ticket, 'id' | 'status' | 'createdAt' | 'replies'>) => {
    const list = db.getTickets();
    const newTicket: Ticket = {
      ...ticket,
      id: `t_${Date.now()}`,
      status: 'open',
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replies: []
    };
    await db.saveTickets([newTicket, ...list]);
    await db.addNotification('all', 'hr', `New support ticket opened: "${ticket.title}" by ${ticket.employeeName}.`);
    return newTicket;
  },

  addTicketReply: async (ticketId: string, reply: Omit<TicketReply, 'id' | 'timestamp'>) => {
    const list = db.getTickets();
    const updated = await Promise.all(list.map(async t => {
      if (t.id === ticketId) {
        const newReply: TicketReply = {
          ...reply,
          id: `rep_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        // Notify respective participants
        if (reply.senderRole === 'hr' || reply.senderRole === 'admin') {
          await db.addNotification(t.employeeEmail, 'employee', `Support response received from HR regarding ticket "${t.title}".`);
        } else {
          await db.addNotification('all', 'hr', `New support message from ${t.employeeName} on ticket "${t.title}".`);
        }
        return { ...t, replies: [...t.replies, newReply] };
      }
      return t;
    }));
    await db.saveTickets(updated);
    return updated;
  },

  updateTicketStatus: async (ticketId: string, status: 'open' | 'closed') => {
    const list = db.getTickets();
    const updated = await Promise.all(list.map(async t => {
      if (t.id === ticketId) {
        await db.addNotification(t.employeeEmail, 'employee', `Support ticket "${t.title}" was marked as ${status}.`);
        await db.addNotification('all', 'hr', `Support ticket "${t.title}" is now ${status}.`);
        return { ...t, status };
      }
      return t;
    }));
    await db.saveTickets(updated);
    return updated;
  },

  deleteCareer: async (id: string) => {
    const list = db.getCareers();
    const updated = list.filter(item => item.id !== id);
    await db.saveCareers(updated);
    return updated;
  },

  addCareer: async (position: Omit<CareerPosition, 'id'>) => {
    const list = db.getCareers();
    const newPos = { ...position, id: `car_${Date.now()}` };
    await db.saveCareers([...list, newPos]);
    return newPos;
  },

  getCareerApplications: (): CareerApplication[] => getInitialData('hr_career_applications_prod_v1', []),
  saveCareerApplications: (data: CareerApplication[]) => saveData('hr_career_applications_prod_v1', data),

  // Actually persists a job application (previously only a notification was
  // fired and the applicant's info/cover letter were discarded entirely —
  // there was no way to retrieve past applicants). Stored via the generic
  // delcargo_store KV table, no new Supabase table required.
  submitCareerApplication: async (app: Omit<CareerApplication, 'id' | 'submittedAt'>): Promise<CareerApplication> => {
    const list = db.getCareerApplications();
    const newApp: CareerApplication = {
      ...app,
      id: `capp_${Date.now()}`,
      submittedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    await db.saveCareerApplications([newApp, ...list]);
    return newApp;
  },

  addTask: async (task: Omit<Task, 'id'>) => {
    const tasks = db.getTasks();
    const newTask: Task = { ...task, id: `task_${Date.now()}` };
    await db.saveTasks([newTask, ...tasks]);
    await db.addNotification(task.assignedEmail, 'employee', `New task assigned: "${task.title}" due ${task.dueDate}.`);
    return newTask;
  },

  updateTaskStatus: async (id: string, status: Task['status']) => {
    const tasks = db.getTasks();
    const updated = tasks.map(t => t.id === id ? { ...t, status } : t);
    await db.saveTasks(updated);
    return updated;
  },

  deleteTask: async (id: string) => {
    const tasks = db.getTasks();
    const updated = tasks.filter(t => t.id !== id);
    await db.saveTasks(updated);
    return updated;
  },

  parseLeaveDates: (duration: string): { start: Date; end: Date } | null => {
    try {
      const parts = duration.split(' - ');
      if (parts.length < 2) {
        const d = new Date(parts[0]);
        return { start: d, end: d };
      }
      return { start: new Date(parts[0]), end: new Date(parts[1]) };
    } catch {
      return null;
    }
  },

  // Calculate tenure details: returns year count & month count
  calculateTenure: (joinedDate: string): { years: number; totalMonths: number } => {
    const start = new Date(joinedDate);
    const today = new Date();
    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < start.getDate())) {
      years--;
      months += 12;
    }
    const totalMonths = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    return { years: Math.max(0, years), totalMonths: Math.max(0, totalMonths) };
  },

  // Calculate PTO Accrual dynamically based on individual anniversary tenure months
  calculatePTOAccrued: (joinedDate: string): number => {
    const { totalMonths } = db.calculateTenure(joinedDate);
    let totalAccrued = 0;

    // Monthly accrual rate lookups depending on which service year the month belongs to
    for (let m = 0; m < totalMonths; m++) {
      const yearOfService = Math.floor(m / 12) + 1;
      let monthlyRate = 0.83; // Default Year 1

      if (yearOfService === 2) monthlyRate = 1.0;
      else if (yearOfService === 3) monthlyRate = 1.17;
      else if (yearOfService === 4) monthlyRate = 1.33;
      else if (yearOfService === 5) monthlyRate = 1.5;
      else if (yearOfService === 6) monthlyRate = 1.67;
      else if (yearOfService === 7) monthlyRate = 1.83;
      else if (yearOfService === 8) monthlyRate = 2.08;
      else if (yearOfService === 9) monthlyRate = 2.25;
      else if (yearOfService >= 10) monthlyRate = 2.5;

      totalAccrued += monthlyRate;
    }

    return Math.min(30, Math.round(totalAccrued * 100) / 100);
  },

  // Counts approved days taken for a given set of leave types (helper used
  // by the combined PTO+Sick bank below).
  getApprovedLeaveDays: (fullName: string, types: Array<'PTO' | 'Sick Leave'>): number => {
    const leaves = db.getLeaves();
    return leaves
      .filter(l => l.employeeName === fullName && l.status === 'approved' && types.includes(l.type as any))
      .reduce((acc, l) => {
        const dates = db.parseLeaveDates(l.duration);
        if (!dates) return acc + 1;
        const diff = Math.abs(dates.end.getTime() - dates.start.getTime());
        const days = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
        return acc + days;
      }, 0);
  },

  // Combined PTO + Sick Leave bank, per company policy: a single accrued
  // balance (see calculatePTOAccrued for the yearly-increment schedule,
  // individual anniversary date, capped at 30) that both PTO and Sick Leave
  // requests draw down from — there is no separate sick leave allotment.
  getRemainingPTO: (fullName: string, joinedDate: string): number => {
    const accrued = db.calculatePTOAccrued(joinedDate);
    const takenDays = db.getApprovedLeaveDays(fullName, ['PTO', 'Sick Leave']);
    return Math.max(0, Math.round((accrued - takenDays) * 100) / 100);
  },

  // Real, currently-effective base salary. Anniversary increments are no
  // longer computed on the fly every render — they're permanently folded
  // into profile.baseSalary exactly once, the moment that anniversary
  // month's payroll is actually processed (see getPendingIncrement /
  // applyAnniversaryIncrement below). This IS the number that's actually
  // paid out; nothing here is a projection.
  calculateCurrentSalary: (profile: Profile): number => {
    return profile.baseSalary;
  },

  // Determines whether THIS calendar cycle is this employee's anniversary
  // month, whether they've completed at least one full year of tenure (no
  // increment during the hire year itself), and whether that year's
  // increment has already been processed — using the individual anniversary
  // date (month + day), not a Jan 1 calendar-year cutoff.
  getPendingIncrement: (profile: Profile): number => {
    const anniversarySource = profile.salaryStartDate || profile.joinedDate;
    if (!anniversarySource) return 0;

    const anniversaryDate = new Date(anniversarySource);
    const now = new Date();
    const isAnniversaryMonth = now.getMonth() === anniversaryDate.getMonth();
    const { years } = db.calculateTenure(anniversarySource);
    const currentYear = now.getFullYear();
    const alreadyProcessedThisYear = profile.lastIncrementProcessedYear === currentYear;

    if (isAnniversaryMonth && years >= 1 && !alreadyProcessedThisYear) {
      return profile.region === 'USA' ? 100 : 10000;
    }
    return 0;
  },

  // Permanently applies a processed anniversary increment: bumps the
  // employee's real baseSalary and marks this year as done so it can't be
  // applied again. Called only when HR/Admin actually finalizes ("Process"
  // or "Release Monthly Funds") that employee's payroll for the cycle —
  // never just from viewing/computing payroll.
  applyAnniversaryIncrement: async (employeeId: string, incrementAmount: number): Promise<void> => {
    if (incrementAmount <= 0) return;
    const employees = db.getEmployees();
    const currentYear = new Date().getFullYear();
    const updated = employees.map(emp =>
      emp.id === employeeId
        ? { ...emp, baseSalary: emp.baseSalary + incrementAmount, lastIncrementProcessedYear: currentYear }
        : emp
    );
    await db.saveEmployees(updated);
  },

  // Full payout of the remaining combined PTO/Sick bank at contract end,
  // per company policy. Day rate = current monthly salary ÷ WORKING_DAYS_PER_MONTH
  // (same formula used by the Jan 31 settlement cash-out calculator).
  getFinalLeavePayout: (profile: Profile): number => {
    const remainingDays = db.getRemainingPTO(profile.fullName, profile.joinedDate);
    const dailyRate = db.calculateCurrentSalary(profile) / WORKING_DAYS_PER_MONTH;
    return Math.round(remainingDays * dailyRate);
  },

  getPayroll: (): PayrollRecord[] => {
    const employees = db.getEmployees().filter(emp => emp.role === 'employee' || emp.role === 'team_lead');
    const payroll: PayrollRecord[] = getInitialData('hr_payroll_prod_v1', []);
    const leaves = db.getLeaves();

    const updatedPayroll = employees.map(emp => {
      const existing = payroll.find(p => p.employeeId === emp.id);
      const realBaseSalary = emp.baseSalary;
      const pendingIncrement = db.getPendingIncrement(emp);

      const employeeUrgentLeaves = leaves.filter(l => l.employeeName === emp.fullName && l.type === 'Urgent' && l.status === 'approved');
      const urgentDays = employeeUrgentLeaves.reduce((acc, l) => {
        const parts = l.duration.split(' - ');
        if (parts.length < 2) return acc + 1;
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        const diff = Math.abs(end.getTime() - start.getTime());
        const days = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
        return acc + days;
      }, 0);

      const dailyRate = realBaseSalary / WORKING_DAYS_PER_MONTH;
      const urgentDeduction = Math.round(urgentDays * 2 * dailyRate);
      const onboardingPenalty = emp.onboardingCompleted ? 0 : (emp.region === 'USA' ? 10 : 200);

      if (existing) {
        // Once processed, this record is a historical payslip and should
        // stop changing — both incrementAmount and deductions now stay
        // frozen at whatever they were when finalized, instead of silently
        // drifting if leave records change retroactively after payout.
        // Unprocessed records keep tracking live values so they reflect
        // reality right up until they're finalized.
        return {
          ...existing,
          region: emp.region,
          baseSalary: realBaseSalary,
          deductions: existing.processed ? existing.deductions : urgentDeduction,
          incrementAmount: existing.processed ? existing.incrementAmount : pendingIncrement
        };
      }
      return {
        id: `pay_${emp.id}`,
        employeeId: emp.id,
        name: emp.fullName,
        // Honest fallback — don't invent a specific job title (e.g. "UX
        // Designer") out of team membership when jobTitle was never set;
        // that used to show up on real payslips as if it were factual.
        role: emp.jobTitle || 'Staff',
        region: emp.region,
        baseSalary: realBaseSalary,
        unpaidLeaves: emp.onboardingCompleted ? 0 : 2,
        bonus: 0,
        deductions: urgentDeduction + onboardingPenalty,
        incrementAmount: pendingIncrement,
        processed: false
      };
    });

    // getPayroll() is read-heavy (called on every payroll page render/poll),
    // so only write back to Supabase when something actually changed —
    // otherwise every read triggers a redundant upsert, widening the window
    // for two concurrent admin sessions to race and clobber each other's
    // writes. A plain JSON diff is sufficient here since PayrollRecord is a
    // small, fully-serializable shape.
    const unchanged = JSON.stringify(updatedPayroll) === JSON.stringify(payroll);
    if (!unchanged) {
      db.savePayroll(updatedPayroll);
    }
    return updatedPayroll;
  },

  savePayroll: (data: PayrollRecord[]) => saveData('hr_payroll_prod_v1', data),

  addEmployee: async (emp: Omit<Profile, 'id' | 'onboardingCompleted'>) => {
    const employees = db.getEmployees();
    const newEmp: Profile = { ...emp, id: `emp_${Date.now()}`, onboardingCompleted: false };
    await db.saveEmployees([...employees, newEmp]);

    // If this email was previously deleted/offboarded, clear its tombstone
    // so the freshly (re-)onboarded profile is allowed to sync normally.
    if (newEmp.email) {
      try {
        const { data: existingRow } = await supabase
          .from('delcargo_store')
          .select('value')
          .eq('key', 'hr_deleted_profile_emails_v1')
          .maybeSingle();
        const existingList: string[] = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const emailLower = newEmp.email.toLowerCase();
        if (existingList.map(e => e.toLowerCase()).includes(emailLower)) {
          const updatedList = existingList.filter(e => e.toLowerCase() !== emailLower);
          await supabase.from('delcargo_store').upsert({ key: 'hr_deleted_profile_emails_v1', value: updatedList });
          if (isClient) {
            localStorage.setItem('hr_deleted_profile_emails_v1', JSON.stringify(updatedList));
          }
        }
      } catch (err: any) {
        console.error('[Supabase Sync] Failed to clear deletion tombstone:', err);
      }
    }

    return newEmp;
  },

  deleteEmployee: async (id: string): Promise<Profile[]> => {
    const employees = db.getEmployees();
    const deletedEmployee = employees.find(emp => emp.id === id);
    const updated = employees.filter(emp => emp.id !== id);

    // Update local cache immediately
    if (isClient) {
      localStorage.setItem('hr_employees_prod_v1', JSON.stringify(updated));
    }

    // Permanently remove the row from Supabase (upsert alone never deletes rows)
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) {
        console.error('[Supabase Sync] Delete error:', error);
      } else {
        console.log(`[Supabase Sync] Permanently deleted profile ${id}.`);
      }
    } catch (err: any) {
      console.error('[Supabase Sync] Unexpected delete error:', err);
    }

    // Record a tombstone for this email so that OTHER devices/users whose
    // local cache still has this profile don't mistake it for a "local-only,
    // not-yet-synced" record on their next sync and re-upload it to Supabase
    // (this was the root cause of deleted/offboarded employees "coming back").
    if (deletedEmployee?.email) {
      try {
        const { data: existingRow } = await supabase
          .from('delcargo_store')
          .select('value')
          .eq('key', 'hr_deleted_profile_emails_v1')
          .maybeSingle();
        const existingList: string[] = Array.isArray(existingRow?.value) ? existingRow.value : [];
        const emailLower = deletedEmployee.email.toLowerCase();
        if (!existingList.map(e => e.toLowerCase()).includes(emailLower)) {
          const updatedList = [...existingList, emailLower];
          await supabase.from('delcargo_store').upsert({ key: 'hr_deleted_profile_emails_v1', value: updatedList });
          if (isClient) {
            localStorage.setItem('hr_deleted_profile_emails_v1', JSON.stringify(updatedList));
          }
        }
      } catch (err: any) {
        console.error('[Supabase Sync] Failed to record deletion tombstone:', err);
      }
    }

    return updated;
  },

  updateOnboardingStatus: async (email: string, completed: boolean) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => emp.email === email ? { ...emp, onboardingCompleted: completed } : emp);
    await db.saveEmployees(updated);
  },

  updateEmployeeTeams: async (employeeId: string, newTeams: string[]) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => emp.id === employeeId ? { ...emp, teams: newTeams } : emp);
    await db.saveEmployees(updated);
    return updated;
  },

  setTeamLead: async (employeeId: string, leadTeams: string[]) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => {
      if (emp.id === employeeId) {
        return { ...emp, isTeamLead: leadTeams.length > 0, leadTeams };
      }
      return emp;
    });
    await db.saveEmployees(updated);
    return updated;
  },

  getTeams: (): string[] => {
    const defaultTeams = ['Engineering', 'Design', 'Marketing', 'Operations', 'Sales'];
    return getInitialData('hr_custom_teams_prod_v1', defaultTeams);
  },

  saveTeams: (data: string[]) => saveData('hr_custom_teams_prod_v1', data),

  addTeam: async (name: string) => {
    const teams = db.getTeams();
    if (!teams.includes(name)) {
      const updated = [...teams, name];
      await db.saveTeams(updated);
      return updated;
    }
    return teams;
  },

  deleteTeam: async (name: string) => {
    const teams = db.getTeams();
    const updatedTeams = teams.filter(t => t !== name);
    await db.saveTeams(updatedTeams);
    const employees = db.getEmployees();
    const updatedEmployees = employees.map(emp => ({ ...emp, teams: emp.teams.filter(t => t !== name) }));
    await db.saveEmployees(updatedEmployees);
    return updatedTeams;
  },

  resetPassword: async (email: string, newPass: string) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => emp.email === email ? { ...emp, password: newPass } : emp);
    await db.saveEmployees(updated);
    return true;
  },

  getNotifications: (): Notification[] => getInitialData('hr_notifications_prod_v1', []),
  saveNotifications: (data: Notification[]) => saveData('hr_notifications_prod_v1', data),

  addNotification: async (email: string, role: string, message: string) => {
    const notifications = db.getNotifications();
    const newNotif: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      recipientEmail: email,
      recipientRole: role,
      message,
      read: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Dispatch custom event for real-time toast push notifications FIRST
    // (synchronously, unchanged) so the toast still feels instant, then
    // await the underlying save.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('newPushNotification', { detail: newNotif }));
    }

    await db.saveNotifications([newNotif, ...notifications]);
    return newNotif;
  },

  getNotificationReadMap: (): NotificationReadMap => getInitialData('hr_notification_reads_prod_v1', {}),
  saveNotificationReadMap: (data: NotificationReadMap) => saveData('hr_notification_reads_prod_v1', data),

  // Marks notifications as read FOR THIS USER ONLY. Personal notifications
  // (recipientEmail === email) still use the shared `read` boolean since
  // there's only ever one real recipient. Broadcast notifications
  // (recipientEmail === 'all') record this user's email in the separate
  // per-user read map instead of touching `read`, so other users of the
  // same role are unaffected.
  markNotificationsAsRead: async (email: string, role: string) => {
    const notifications = db.getNotifications();
    const emailLower = email.toLowerCase();

    const personalUpdated = notifications.map(n =>
      n.recipientEmail === email ? { ...n, read: true } : n
    );
    await db.saveNotifications(personalUpdated);

    const broadcastNotifs = notifications.filter(n => n.recipientRole === role && n.recipientEmail === 'all');
    if (broadcastNotifs.length > 0) {
      const readMap = db.getNotificationReadMap();
      let changed = false;
      broadcastNotifs.forEach(n => {
        const readers = readMap[n.id] || [];
        if (!readers.map(e => e.toLowerCase()).includes(emailLower)) {
          readMap[n.id] = [...readers, email];
          changed = true;
        }
      });
      if (changed) {
        await db.saveNotificationReadMap(readMap);
      }
    }
  },

  // Whether a given notification should be shown as read/unread to a
  // specific user — accounts for the per-user read map on role-broadcast
  // notifications.
  isNotificationRead: (n: Notification, email: string): boolean => {
    if (n.recipientEmail === email) return n.read;
    if (n.recipientEmail === 'all') {
      const readMap = db.getNotificationReadMap();
      return (readMap[n.id] || []).map(e => e.toLowerCase()).includes(email.toLowerCase());
    }
    return n.read;
  },

  getWarehouses: (): Warehouse[] => getInitialData('hr_warehouses_prod_v1', defaultWarehouses),
  saveWarehouses: (data: Warehouse[]) => saveData('hr_warehouses_prod_v1', data),
  addWarehouse: async (wh: Omit<Warehouse, 'id'>) => {
    const list = db.getWarehouses();
    const newWh = { ...wh, id: `wh_${Date.now()}` };
    await db.saveWarehouses([...list, newWh]);
    return newWh;
  },
  updateWarehouse: async (id: string, updates: Partial<Warehouse>) => {
    const list = db.getWarehouses();
    const updated = list.map(w => w.id === id ? { ...w, ...updates } : w);
    await db.saveWarehouses(updated);
    return updated;
  },
  deleteWarehouse: async (id: string) => {
    const list = db.getWarehouses();
    const updated = list.filter(w => w.id !== id);

    // Update local cache immediately
    if (isClient) {
      localStorage.setItem('hr_warehouses_prod_v1', JSON.stringify(updated));
    }

    // Permanently remove the row from Supabase — saveWarehouses() only
    // upserts, it never deletes rows, so without this the warehouse would
    // keep reappearing every time another device/page re-syncs from Supabase.
    try {
      const { error } = await supabase.from('warehouses').delete().eq('id', id);
      if (error) {
        console.error('[Supabase Sync] Warehouse delete error:', error);
      } else {
        console.log(`[Supabase Sync] Permanently deleted warehouse ${id}.`);
      }
    } catch (err: any) {
      console.error('[Supabase Sync] Unexpected warehouse delete error:', err);
    }

    // Also remove this warehouse from employee assignments
    const employees = db.getEmployees();
    const updatedEmployees = employees.map(emp => {
      if (emp.assignedWarehouses) {
        return { ...emp, assignedWarehouses: emp.assignedWarehouses.filter(wId => wId !== id) };
      }
      return emp;
    });
    await db.saveEmployees(updatedEmployees);
    return updated;
  },

  getAnnouncements: (): Announcement[] => getInitialData('hr_announcements_prod_v1', defaultAnnouncements),
  saveAnnouncements: (data: Announcement[]) => saveData('hr_announcements_prod_v1', data),
  addAnnouncement: async (title: string, content: string, target: Announcement['target'], createdBy: string) => {
    const list = db.getAnnouncements();
    const newAnn: Announcement = {
      id: `ann_${Date.now()}`,
      title,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(),
      createdBy,
      target
    };
    await db.saveAnnouncements([newAnn, ...list]);
    return newAnn;
  },

  updateProfileDetails: async (email: string, updates: Partial<Profile>) => {
    const employees = db.getEmployees();
    const updated = employees.map(emp => emp.email === email ? { ...emp, ...updates } : emp);
    await db.saveEmployees(updated);
    return updated;
  },

  getLastSyncError: () => lastSyncError,

  // --- Real timesheet / clock-in-out tracking ---
  // Backed by the same 'hr_timesheets_prod_v1' key that already syncs to the
  // Supabase 'timesheets' table, so shifts are visible to HR/Admin regardless
  // of which region/device the employee clocked in from.
  getTimesheets: (): TimesheetEntry[] => getInitialData('hr_timesheets_prod_v1', []),
  saveTimesheets: (data: TimesheetEntry[]) => saveData('hr_timesheets_prod_v1', data),

  // Returns the currently open (not yet clocked out) shift for an employee, if any.
  getOpenShift: (employeeEmail: string): TimesheetEntry | null => {
    const all = db.getTimesheets();
    return all.find(t => t.employeeEmail === employeeEmail && t.status === 'in_progress') || null;
  },

  // Starts a real shift. Idempotent — if a shift is already open for this
  // employee, returns the existing one instead of creating a duplicate.
  clockIn: async (employeeEmail: string): Promise<TimesheetEntry> => {
    const all = db.getTimesheets();
    const existingOpen = all.find(t => t.employeeEmail === employeeEmail && t.status === 'in_progress');
    if (existingOpen) return existingOpen;

    const now = new Date();
    const entry: TimesheetEntry = {
      id: `ts_${Date.now()}`,
      employeeEmail,
      date: now.toISOString().split('T')[0],
      clockIn: now.toISOString(),
      status: 'in_progress'
    };
    await db.saveTimesheets([entry, ...all]);
    return entry;
  },

  // Ends the employee's currently open shift, computing the real elapsed
  // duration from the actual clock-in timestamp. No-op if nothing is open.
  clockOut: async (employeeEmail: string): Promise<TimesheetEntry | null> => {
    const all = db.getTimesheets();
    const openEntry = all.find(t => t.employeeEmail === employeeEmail && t.status === 'in_progress');
    if (!openEntry) return null;

    const nowIso = new Date().toISOString();
    const updated = all.map(t =>
      t.id === openEntry.id
        ? { ...t, clockOut: nowIso, duration: formatDurationBetween(t.clockIn, nowIso), status: 'completed' as const }
        : t
    );
    await db.saveTimesheets(updated);
    return updated.find(t => t.id === openEntry.id) || null;
  }
};

export const formatMoney = (amount: number, region?: 'USA' | 'Pakistan') => {
  if (region === 'USA') {
    return `$${amount.toLocaleString()}`;
  }
  return `PKR ${amount.toLocaleString()}`;
};
